
import React, { useState, useEffect, useMemo, useRef, useTransition } from 'react';
import { EnergyReading, Tariff, ComparisonResult, TimePeriod, SimulatedLoad, GasReading, GasComparisonResult, ProviderType } from './types';
import { DEFAULT_TARIFFS, LOAD_PRESETS, DEFAULT_GAS_TARIFF, SOCALGAS_TARIFF, detectUtilityFromCoords } from './constants';
import EnergyChart from './components/EnergyChart';
import { analyzeUsageWithClaude } from './services/claudeService';
import { compareTariffs, calculateDetailedCost, calculateMonthlyDeliveryCost, calculateMonthlyGrossConsumption } from './services/energyCalculator';
import { parsePgeIntervalCsv } from './services/pgeCsvParser';
import { parsePgeGasCsv } from './services/pgeGasCsvParser';
import { calculateGasComparison, calculateGasSavingsFromElectrification } from './services/gasCalculator';

const App: React.FC = () => {
  const [readings, setReadings] = useState<EnergyReading[]>([]);
  const [provider, setProvider] = useState<ProviderType | null>(
    () => (localStorage.getItem('vc_provider') as ProviderType | null) ?? null
  );
  const [detectedRegion, setDetectedRegion] = useState<'pge' | 'sce' | 'sdge' | null>(null);
  const [zipInput, setZipInput] = useState('');
  const [zipLookupStatus, setZipLookupStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [customBillingDates, setCustomBillingDates] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('vc_billing_dates') ?? '[]'); } catch { return []; }
  });
  const [billingDatesInput, setBillingDatesInput] = useState<string>(() => {
    try {
      const dates = JSON.parse(localStorage.getItem('vc_billing_dates') ?? '[]') as string[];
      return dates.map(d => { const [y, m, day] = d.split('-'); return `${m}/${day}/${y}`; }).join(', ');
    } catch { return ''; }
  });
  const [nemEnabled, setNemEnabled] = useState<boolean>(
    () => localStorage.getItem('vc_nem') === 'true'
  );
  const [showRefinements, setShowRefinements] = useState<boolean>(false);
  const [location, setLocation] = useState<string>('San Francisco Bay Area');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
  const [currentTariff, setCurrentTariff] = useState<Tariff>(
    DEFAULT_TARIFFS.find(t => t.id === 'mce-ev2a') || DEFAULT_TARIFFS[0]
  );
  const [comparisons, setComparisons] = useState<ComparisonResult[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [simulatedLoads, setSimulatedLoads] = useState<SimulatedLoad[]>([]);
  const [showSimPanel, setShowSimPanel] = useState(false);
  const isDrillingDown = useRef(false);
  const anchorDateRef = useRef<Date | null>(null);
  const periodChangedRef = useRef(false);
  const [isPeriodPending, startPeriodTransition] = useTransition();

  // Gas state
  const [gasReadings, setGasReadings] = useState<GasReading[]>([]);
  const [gasComparison, setGasComparison] = useState<GasComparisonResult | null>(null);
  const [gasUploadError, setGasUploadError] = useState<string | null>(null);
  const [gasUploadWarnings, setGasUploadWarnings] = useState<string[]>([]);
  const [gasUploadedFileName, setGasUploadedFileName] = useState<string | null>(null);
  const [isLoadingGas, setIsLoadingGas] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lon } = pos.coords;
          const region = detectUtilityFromCoords(lat, lon);
          setDetectedRegion(region);
          const names = { pge: 'PG&E', sce: 'SCE', sdge: 'SDG&E' };
          setLocation(`${names[region]} (${lat.toFixed(2)}, ${lon.toFixed(2)})`);
        },
        () => setLocation('California')
      );
    }
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setUploadError(null);
    setUploadWarnings([]);

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result ?? '');
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.xml')) {
          throw new Error('XML upload is not supported yet. Please export your Green Button interval data as a CSV and upload that file.');
        }
        if (!lower.endsWith('.csv')) {
          throw new Error('Unsupported file type. Please upload a .csv export of your Green Button interval data.');
        }

        const result = parsePgeIntervalCsv(text);
        setReadings(result.readings);
        setUploadWarnings(result.warnings);
        setChunkIndex(0);
      } catch (err: any) {
        setReadings([]);
        setUploadWarnings([]);
        setUploadError(err?.message ? String(err.message) : 'Failed to parse the uploaded file.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setIsLoading(false);
      setUploadError('Failed to read the file in your browser. Please try again.');
    };
    reader.readAsText(file);
  };

  const handleGasFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setGasUploadedFileName(file.name);
    setGasUploadError(null);
    setGasUploadWarnings([]);

    setIsLoadingGas(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result ?? '');
        const lower = file.name.toLowerCase();
        if (!lower.endsWith('.csv')) {
          throw new Error('Please upload a .csv export of your PG&E gas interval data.');
        }

        const result = parsePgeGasCsv(text);
        setGasReadings(result.readings);
        setGasUploadWarnings(result.warnings);
      } catch (err: any) {
        setGasReadings([]);
        setGasUploadWarnings([]);
        setGasUploadError(err?.message ? String(err.message) : 'Failed to parse the gas file.');
      } finally {
        setIsLoadingGas(false);
      }
    };
    reader.onerror = () => {
      setIsLoadingGas(false);
      setGasUploadError('Failed to read the gas file. Please try again.');
    };
    reader.readAsText(file);
  };

  // Use SoCalGas tariff for SCE/SDG&E territory, PG&E gas otherwise
  const activeGasTariff = (provider === 'sce-bundled' || provider === 'sdge-bundled') ? SOCALGAS_TARIFF : DEFAULT_GAS_TARIFF;

  // Auto-expand refinements panel when any refinement data is active
  useEffect(() => {
    if (gasReadings.length > 0 || nemEnabled || customBillingDates.length > 0) {
      setShowRefinements(true);
    }
  }, [gasReadings.length, nemEnabled, customBillingDates.length]);

  // Calculate gas comparison when gas readings or territory changes
  useEffect(() => {
    if (gasReadings.length > 0) {
      setGasComparison(calculateGasComparison(gasReadings, activeGasTariff));
    } else {
      setGasComparison(null);
    }
  }, [gasReadings, provider]);

  const lookupZip = async () => {
    const z = zipInput.trim();
    if (z.length < 5) return;
    setZipLookupStatus('loading');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${z}&country=us&format=json&limit=1`);
      const data = await res.json();
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setDetectedRegion(detectUtilityFromCoords(lat, lon));
        setZipLookupStatus('idle');
      } else {
        setZipLookupStatus('error');
      }
    } catch {
      setZipLookupStatus('error');
    }
  };

  const pickProvider = (p: ProviderType) => {
    localStorage.setItem('vc_provider', p);
    setProvider(p);
  };

  // Calculate simulated load additions for each reading
  const readingsWithSimulation = useMemo(() => {
    if (readings.length === 0 || simulatedLoads.length === 0) return readings;

    const enabledLoads = simulatedLoads.filter(l => l.enabled);
    if (enabledLoads.length === 0) return readings;

    return readings.map(reading => {
      const hour = reading.timestamp.getHours();
      const month = reading.timestamp.getMonth();
      // Map month to season: 0=winter(Dec-Feb), 1=spring, 2=summer, 3=fall
      const seasonIdx = month <= 1 ? 0 : month <= 4 ? 1 : month <= 7 ? 2 : month <= 10 ? 3 : 0;

      let additionalKwh = 0;
      for (const load of enabledLoads) {
        // Daily kWh = monthly / 30.44 days
        const dailyKwh = (load.monthlyKwh * load.seasonalMultiplier[seasonIdx]) / 30.44;
        // Per-interval kWh based on hourly pattern (assuming 15-min intervals = 4 per hour)
        const hourlyShare = load.hourlyPattern[hour];
        additionalKwh += (dailyKwh * hourlyShare) / 4; // Divide by 4 for 15-min intervals
      }

      return {
        ...reading,
        value: reading.value + additionalKwh
      };
    });
  }, [readings, simulatedLoads]);

  // Calculate total simulated monthly kWh
  const simulatedMonthlyKwh = useMemo(() => {
    return simulatedLoads
      .filter(l => l.enabled)
      .reduce((sum, load) => sum + load.monthlyKwh, 0);
  }, [simulatedLoads]);

  // Calculate gas savings from electrification
  const gasSavings = useMemo(() => {
    const enabledLoads = simulatedLoads.filter(l => l.enabled);
    if (enabledLoads.length === 0) return null;
    return calculateGasSavingsFromElectrification(enabledLoads, DEFAULT_GAS_TARIFF);
  }, [simulatedLoads]);

  useEffect(() => {
    if (readings.length > 0) {
      setComparisons(compareTariffs(readingsWithSimulation, currentTariff.id, DEFAULT_TARIFFS));
    }
  }, [readings, readingsWithSimulation, currentTariff]);

  const getChunksForPeriod = (data: EnergyReading[], period: TimePeriod) => {
    if (data.length === 0) return [];
    if (period === 'year') return [data];

    const groupByKey = (d: Date) => {
      if (period === 'day') return d.toLocaleDateString();
      if (period === 'week') {
        const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
        const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
        return `${d.getFullYear()}-W${Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)}`;
      }
      if (period === 'month') {
        if (customBillingDates.length > 0) {
          const readingTs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).getTime();
          const readingDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const toKey = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

          const knownEnd = customBillingDates.find(ed => ed >= readingDateStr);
          if (knownEnd) {
            const [ey, em, eday] = knownEnd.split('-').map(Number);
            const endTs = new Date(ey, em - 1, eday, 12, 0, 0).getTime();
            const daysToEnd = (endTs - readingTs) / 86400000;
            if (daysToEnd <= 33) return knownEnd;
            // Reading is too far before this end date — extrapolate backward in ~30-day steps
            const stepsBack = Math.ceil((daysToEnd - 33) / 30);
            return toKey(new Date(endTs - stepsBack * 30 * 86400000));
          }

          // After last known date — extrapolate forward in ~30-day steps
          const last = customBillingDates[customBillingDates.length - 1];
          const [ly, lm, ld] = last.split('-').map(Number);
          const lastEndTs = new Date(ly, lm - 1, ld, 12, 0, 0).getTime();
          const stepsAhead = Math.ceil((readingTs - lastEndTs) / (30 * 86400000));
          return toKey(new Date(lastEndTs + stepsAhead * 30 * 86400000));
        }
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      return '';
    };

    const chunks: EnergyReading[][] = [];
    let currentChunk: EnergyReading[] = [];
    let lastKey = groupByKey(data[0].timestamp);

    data.forEach(r => {
      const key = groupByKey(r.timestamp);
      if (key !== lastKey) {
        chunks.push(currentChunk);
        currentChunk = [];
        lastKey = key;
      }
      currentChunk.push(r);
    });
    chunks.push(currentChunk);
    return chunks.reverse();
  };

  const periodChunks = useMemo(() => getChunksForPeriod(readingsWithSimulation, selectedPeriod), [readingsWithSimulation, selectedPeriod, customBillingDates]);

  useEffect(() => {
    if (isDrillingDown.current) {
      isDrillingDown.current = false;
      return;
    }
    if (!periodChangedRef.current) return;
    periodChangedRef.current = false;

    const anchor = anchorDateRef.current;
    anchorDateRef.current = null;
    if (anchor && periodChunks.length > 0) {
      const idx = periodChunks.findIndex(chunk => {
        if (chunk.length === 0) return false;
        const start = chunk[0].timestamp;
        const end = chunk[chunk.length - 1].timestamp;
        return anchor >= start && anchor <= end;
      });
      setChunkIndex(idx >= 0 ? idx : 0);
    } else {
      setChunkIndex(0);
    }
  }, [selectedPeriod, periodChunks]);

  const filteredReadings = useMemo(() => {
    if (periodChunks.length === 0) return [];
    const idx = Math.min(chunkIndex, periodChunks.length - 1);
    return periodChunks[idx] || [];
  }, [periodChunks, chunkIndex]);

  // Pre-aggregate readings for chart to avoid processing 35K+ items
  const chartReadings = useMemo(() => {
    if (filteredReadings.length <= 2000) return filteredReadings;

    const map = new Map<number, EnergyReading>();

    if (selectedPeriod === 'year') {
      // Aggregate 15-min intervals to daily (~365 items instead of ~35K)
      filteredReadings.forEach(r => {
        const d = new Date(r.timestamp);
        d.setHours(0, 0, 0, 0);
        const key = d.getTime();
        const existing = map.get(key);
        if (existing) {
          existing.value += r.value;
        } else {
          map.set(key, { timestamp: d, value: r.value });
        }
      });
    } else {
      // Aggregate to hourly for week/month views
      filteredReadings.forEach(r => {
        const d = new Date(r.timestamp);
        d.setMinutes(0, 0, 0);
        const key = d.getTime();
        const existing = map.get(key);
        if (existing) {
          existing.value += r.value;
        } else {
          map.set(key, { timestamp: d, value: r.value });
        }
      });
    }

    return Array.from(map.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [filteredReadings, selectedPeriod]);

  const handleDrillDown = (timestamp: number) => {
    const targetDate = new Date(timestamp);
    let nextPeriod: TimePeriod = selectedPeriod;

    if (selectedPeriod === 'year') nextPeriod = 'month';
    else if (selectedPeriod === 'month' || selectedPeriod === 'week') nextPeriod = 'day';
    else return; 

    const nextChunks = getChunksForPeriod(readingsWithSimulation, nextPeriod);
    const targetKey = (d: Date) => {
      if (nextPeriod === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (nextPeriod === 'day') return d.toLocaleDateString();
      return '';
    };

    const targetVal = targetKey(targetDate);
    const foundIdx = nextChunks.findIndex(chunk => targetKey(chunk[0].timestamp) === targetVal);

    if (foundIdx !== -1) {
      isDrillingDown.current = true;
      setSelectedPeriod(nextPeriod);
      setChunkIndex(foundIdx);
    }
  };

  const isOngoingPeriod = useMemo(() => {
    if (filteredReadings.length === 0) return false;
    const now = new Date();
    return filteredReadings.some(r => r.timestamp > now);
  }, [filteredReadings]);

  const rangeLabel = useMemo(() => {
    if (filteredReadings.length === 0) return '';
    const start = filteredReadings[0].timestamp;
    const end = filteredReadings[filteredReadings.length - 1].timestamp;

    if (selectedPeriod === 'day') return start.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    if (selectedPeriod === 'week') return `Week of ${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    if (selectedPeriod === 'month') {
      if (customBillingDates.length > 0) {
        return `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
      return start.toLocaleDateString([], { month: 'long', year: 'numeric' });
    }
    return `Full Dataset History (${start.getFullYear()})`;
  }, [filteredReadings, selectedPeriod]);

  const periodStats = useMemo(() => {
    if (filteredReadings.length === 0 || comparisons.length === 0) return null;
    const usage = filteredReadings.reduce((s, r) => s + r.value, 0);
    const tempCalc = calculateDetailedCost(filteredReadings, currentTariff);
    return { usage, cost: tempCalc.totalCost };
  }, [filteredReadings, comparisons, currentTariff]);

  const periodMonthKey = useMemo(() => {
    if (filteredReadings.length === 0) return null;
    const d = filteredReadings[0].timestamp;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [filteredReadings]);

  const periodGasCost = useMemo(() => {
    if (filteredReadings.length === 0) return null;
    const start = filteredReadings[0].timestamp;
    const end = filteredReadings[filteredReadings.length - 1].timestamp;

    if (selectedPeriod === 'year') {
      if (!gasComparison || gasComparison.breakdown.length === 0) return null;
      const year = start.getFullYear();
      return gasComparison.breakdown
        .filter(b => b.monthName.startsWith(`${year}-`))
        .reduce((sum, b) => sum + b.cost, 0);
    }

    if (selectedPeriod === 'month') {
      // Sum gas readings that actually fall within this billing period's date range.
      // Using periodMonthKey (calendar month of period start) misses gas timestamped in
      // the next calendar month — e.g. a Nov 27–Dec 29 billing period has most readings in Dec.
      if (gasReadings.length === 0) return null;
      const periodStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const periodEnd   = new Date(end.getFullYear(),   end.getMonth(),   end.getDate(), 23, 59, 59);
      const inPeriod = gasReadings.filter(r => r.timestamp >= periodStart && r.timestamp <= periodEnd);
      if (inPeriod.length === 0) return null;
      const therms = inPeriod.reduce((sum, r) => sum + r.value, 0);
      // Prorate baseline for actual period length (baseline is expressed as a daily rate)
      const periodDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const proratedBaseline = activeGasTariff.baselineTherms * periodDays / 30;
      const baseline = Math.min(therms, proratedBaseline);
      const overBase = Math.max(0, therms - proratedBaseline);
      return (baseline * activeGasTariff.baselineRate) + (overBase * activeGasTariff.overBaselineRate) + activeGasTariff.fixedMonthlyCharge;
    }

    // day / week: prorate the calendar-month entry by period length
    if (!gasComparison || gasComparison.breakdown.length === 0) return null;
    const monthEntry = gasComparison.breakdown.find(b => b.monthName === periodMonthKey);
    if (!monthEntry) return null;
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const periodDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    return (monthEntry.cost / daysInMonth) * periodDays;
  }, [selectedPeriod, filteredReadings, gasReadings, gasComparison, periodMonthKey, activeGasTariff]);

  const NEM_MIN_DELIVERY = 13.30; // PG&E minimum monthly delivery charge paid regardless
  // Non-Bypassable Charges: PPP + nuclear decom + CTC + wildfire fund ≈ $0.035/kWh
  // These apply to ALL gross grid consumption and defer to True-Up (NEM customers can't offset them)
  const NEM_NBC_RATE = 0.035;

  const nemTrueUp = useMemo(() => {
    if (!nemEnabled || comparisons.length === 0) return null;
    const breakdown = comparisons.find(c => c.tariffId === currentTariff.id)?.breakdown ?? [];
    const sorted = [...breakdown].sort((a, b) => a.monthName.localeCompare(b.monthName));

    // Check if this tariff has delivery rates (needed for MCE/NEM split)
    const hasDeliveryRates = currentTariff.periods.some(p => p.deliveryRate != null);

    let runningBalance = 0;
    let deliveryByMonth: Record<string, number> = {};
    if (hasDeliveryRates) {
      deliveryByMonth = calculateMonthlyDeliveryCost(readingsWithSimulation, currentTariff);
    }

    // Gross consumption per month (positive readings only) for NBC calculation
    const grossByMonth = calculateMonthlyGrossConsumption(readingsWithSimulation);

    const pciaRate = currentTariff.pciaRate ?? 0;
    const monthlyCredit = currentTariff.monthlyCredit ?? 0;

    const months = sorted.map(m => {
      const totalCost = m.cost;
      const grossConsumption = grossByMonth[m.monthName] ?? Math.max(0, m.usage);
      // NBCs on gross consumption — deferred to True-Up
      const nbcCost = NEM_NBC_RATE * grossConsumption;
      // PCIA on gross consumption — defers to True-Up for MCE/CCA customers
      const pciaCost = pciaRate * grossConsumption;

      if (hasDeliveryRates) {
        // MCE NEM model: generation paid monthly; delivery + PCIA + NBCs defer to True-Up
        const deliveryCost = deliveryByMonth[m.monthName] ?? 0;
        const generationCost = totalCost - deliveryCost; // generation + fixed charges
        // Monthly statement: generation + minimum delivery + any monthly credits
        const electricityStatement = generationCost + NEM_MIN_DELIVERY;
        const statementAmount = electricityStatement + monthlyCredit;
        // True-Up accumulates: delivery + NBCs + PCIA
        runningBalance += deliveryCost + nbcCost + pciaCost;
        return { monthName: m.monthName, usage: m.usage, netCost: totalCost, deliveryCost, generationCost, electricityStatement, pciaCost, nbcCost, statementAmount, runningBalance };
      } else {
        // PG&E bundled NEM: full cost defers, plus NBCs
        const electricityStatement = totalCost > NEM_MIN_DELIVERY ? totalCost : NEM_MIN_DELIVERY;
        const statementAmount = electricityStatement + monthlyCredit;
        runningBalance += totalCost + nbcCost;
        return { monthName: m.monthName, usage: m.usage, netCost: totalCost, deliveryCost: totalCost, generationCost: 0, electricityStatement, pciaCost, nbcCost, statementAmount, runningBalance };
      }
    });

    const trueUpBalance = runningBalance;
    const totalStatements = months.reduce((s, m) => s + m.statementAmount, 0);
    return { months, trueUpBalance, totalStatements, hasDeliveryRates };
  }, [nemEnabled, comparisons, currentTariff, readingsWithSimulation]);

  const sortedComparisons = useMemo(() => {
    if (comparisons.length === 0) return [];
    const currentEntry = comparisons.find(c => c.tariffId === currentTariff.id);
    const otherEntries = comparisons
      .filter(c => c.tariffId !== currentTariff.id)
      .sort((a, b) => a.estimatedMonthlyCost - b.estimatedMonthlyCost);
    return currentEntry ? [currentEntry, ...otherEntries] : otherEntries;
  }, [comparisons, currentTariff]);

  const bestTariff = comparisons.length > 0
    ? [...comparisons].sort((a, b) => a.estimatedMonthlyCost - b.estimatedMonthlyCost)[0]
    : null;

  const dataCoverage = useMemo(() => {
    if (readings.length < 2) return null;
    const start = readings[0].timestamp;
    const end = readings[readings.length - 1].timestamp;
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const months = Math.round(days / 30.44);
    const hasSummer = readings.some(r => {
      const m = r.timestamp.getMonth();
      return m >= 5 && m <= 8; // June-Sept
    });
    const hasWinter = readings.some(r => {
      const m = r.timestamp.getMonth();
      return m <= 1 || m >= 10; // Nov-Feb
    });
    return { days, months, hasSummer, hasWinter, start, end };
  }, [readings]);

  const navigate = (dir: number) => {
    setChunkIndex(prev => {
      const current = Math.min(prev, periodChunks.length - 1);
      return Math.max(0, Math.min(periodChunks.length - 1, current + dir));
    });
  };

  const toggleSimulatedLoad = (presetId: string) => {
    setSimulatedLoads(prev => {
      const existing = prev.find(l => l.id === presetId);
      if (existing) {
        // Toggle enabled state
        return prev.map(l => l.id === presetId ? { ...l, enabled: !l.enabled } : l);
      } else {
        // Add new load from preset
        const preset = LOAD_PRESETS.find(p => p.id === presetId);
        if (!preset) return prev;
        return [...prev, { ...preset, enabled: true }];
      }
    });
  };

  const isLoadEnabled = (presetId: string) => {
    const load = simulatedLoads.find(l => l.id === presetId);
    return load?.enabled ?? false;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans antialiased">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2.5 rounded-2xl shadow-lg">
              <i className="fa-solid fa-bolt-lightning text-yellow-400 text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tighter leading-none">VoltCompare</h1>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">Meter Analytics Pro</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden md:flex flex-col items-end mr-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Utility Territory</span>
                <span className="text-xs font-bold text-slate-800">{location}</span>
             </div>
             {readings.length > 0 && (
               <button onClick={() => {
                 setReadings([]);
                 setAiAnalysis(null);
                 setUploadError(null);
                 setUploadWarnings([]);
                 setUploadedFileName(null);
                 setGasReadings([]);
                 setGasUploadError(null);
                 setGasUploadWarnings([]);
                 setGasUploadedFileName(null);
                 setSimulatedLoads([]);
               }} className="group w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all shadow-sm">
                 <i className="fa-solid fa-rotate-left group-hover:rotate-[-90deg] transition-transform"></i>
               </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-10">
        {readings.length === 0 && provider === null ? (
          <div className="max-w-2xl mx-auto py-16 bg-white rounded-[3.5rem] shadow-2xl shadow-slate-200 border border-slate-100 px-10">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-blue-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-lg">
                <i className="fa-solid fa-location-dot text-3xl text-blue-600"></i>
              </div>
              <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tighter">Who delivers your power?</h2>
              <p className="text-slate-500 font-medium max-w-md mx-auto">Share your location or ZIP code and we'll detect your utility automatically.</p>
            </div>

            {/* Location detection */}
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(pos => {
                      const r = detectUtilityFromCoords(pos.coords.latitude, pos.coords.longitude);
                      setDetectedRegion(r);
                    });
                  }
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm rounded-xl transition-all"
              >
                <i className="fa-solid fa-location-crosshairs"></i> Use my location
              </button>
              <input
                type="text"
                placeholder="ZIP code"
                maxLength={5}
                value={zipInput}
                onChange={e => setZipInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && lookupZip()}
                className="flex-1 px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={lookupZip}
                disabled={zipLookupStatus === 'loading'}
                className="px-4 py-2.5 bg-slate-900 hover:bg-blue-600 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50"
              >
                {zipLookupStatus === 'loading' ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Look up'}
              </button>
            </div>
            {zipLookupStatus === 'error' && <p className="text-xs text-red-500 font-bold mb-3">ZIP not found — select manually below.</p>}

            {detectedRegion && (
              <div className="mb-6 px-4 py-2.5 bg-green-50 border border-green-100 rounded-xl text-sm font-bold text-green-700">
                <i className="fa-solid fa-circle-check mr-2"></i>
                Detected: <span className="uppercase">{{ pge: 'PG&E territory (NorCal)', sce: 'SCE territory (SoCal)', sdge: 'SDG&E territory (San Diego)' }[detectedRegion]}</span>
                <span className="text-green-500 font-medium ml-1">— select below to confirm</span>
              </div>
            )}

            {/* Utility territory cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {([
                { region: 'pge' as const, label: 'PG&E', sub: 'NorCal / Central CA', icon: 'fa-bolt', color: 'blue' },
                { region: 'sce' as const, label: 'SCE', sub: 'Southern California', icon: 'fa-sun', color: 'orange' },
                { region: 'sdge' as const, label: 'SDG&E', sub: 'San Diego', icon: 'fa-water', color: 'cyan' },
              ] as const).map(({ region, label, sub, icon, color }) => {
                const isDetected = detectedRegion === region;
                const colorMap = {
                  blue: { border: isDetected ? 'border-blue-400 bg-blue-50' : 'border-slate-100', icon: 'bg-blue-100 text-blue-600', badge: 'bg-blue-200 text-blue-800' },
                  orange: { border: isDetected ? 'border-orange-400 bg-orange-50' : 'border-slate-100', icon: 'bg-orange-100 text-orange-600', badge: 'bg-orange-200 text-orange-800' },
                  cyan: { border: isDetected ? 'border-cyan-400 bg-cyan-50' : 'border-slate-100', icon: 'bg-cyan-100 text-cyan-600', badge: 'bg-cyan-200 text-cyan-800' },
                };
                const c = colorMap[color];
                return (
                  <button
                    key={region}
                    onClick={() => { /* handled by sub-options for pge, direct for others */ if (region === 'sce') pickProvider('sce-bundled'); else if (region === 'sdge') pickProvider('sdge-bundled'); else setDetectedRegion('pge'); }}
                    className={`flex flex-col items-center gap-3 p-5 rounded-[1.5rem] border-2 ${c.border} hover:shadow-lg bg-white transition-all hover:-translate-y-0.5 relative`}
                  >
                    {isDetected && <span className={`absolute top-2 right-2 text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${c.badge}`}>Detected</span>}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.icon}`}>
                      <i className={`fa-solid ${icon} text-xl`}></i>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-900">{label}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* PGE sub-options — shown when PGE territory is selected/detected */}
            {(detectedRegion === 'pge' || detectedRegion === null) && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">PG&E Territory — choose your generation provider</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => pickProvider('pge-bundled')}
                    className="group flex flex-col items-center gap-3 p-6 rounded-[1.5rem] border-2 border-slate-100 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-50 bg-white transition-all hover:-translate-y-1"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-600 transition-all">
                      <i className="fa-solid fa-bolt text-xl text-blue-600 group-hover:text-white transition-all"></i>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-900">PG&E Bundled</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">Generation + Delivery from PG&E</p>
                    </div>
                  </button>
                  <button
                    onClick={() => pickProvider('mce-pge')}
                    className="group flex flex-col items-center gap-3 p-6 rounded-[1.5rem] border-2 border-slate-100 hover:border-green-400 hover:shadow-xl hover:shadow-green-50 bg-white transition-all hover:-translate-y-1"
                  >
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center group-hover:bg-green-600 transition-all">
                      <i className="fa-solid fa-leaf text-xl text-green-600 group-hover:text-white transition-all"></i>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-900">MCE Clean Energy</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">MCE generation + PG&E delivery</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            <p className="text-[10px] text-slate-300 font-medium text-center mt-6">SCE and SDG&E rates are approximate — verify against your bill. PG&E rates verified Dec 2025.</p>
          </div>
        ) : readings.length === 0 ? (
          <div className="max-w-3xl mx-auto text-center py-24 bg-white rounded-[3.5rem] shadow-2xl shadow-slate-200 border border-slate-100 px-12">
            <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center mx-auto mb-10 transform rotate-12 shadow-lg">
              <i className="fa-solid fa-file-invoice-dollar text-4xl text-blue-600"></i>
            </div>
            <h2 className="text-5xl font-black text-slate-900 mb-6 tracking-tighter">Your Bill, Decoded.</h2>
            <p className="text-xl text-slate-500 mb-12 max-w-xl mx-auto leading-relaxed font-medium">
              We precisely map your usage patterns to find the exact tariff that saves you the most.
            </p>
            <label className="group relative inline-flex items-center gap-4 bg-slate-900 hover:bg-blue-600 text-white font-black py-7 px-14 rounded-[2.5rem] cursor-pointer transition-all transform hover:-translate-y-2 shadow-2xl shadow-blue-300 overflow-hidden">
              <i className="fa-solid fa-cloud-arrow-up text-xl transition-transform group-hover:scale-125"></i>
              <span className="text-lg">Upload Green Button CSV</span>
              <input type="file" className="hidden" onChange={handleFileUpload} accept=".csv" />
            </label>

            {/* Help section for getting data */}
            <div className="mt-10 pt-8 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Don't have your data yet?</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="https://myaccount.pge.com/myaccount/s/usageandconsumption-homepage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm rounded-xl transition-all"
                >
                  <i className="fa-solid fa-chart-line"></i>
                  PG&E Usage & Consumption
                  <i className="fa-solid fa-arrow-up-right-from-square text-xs opacity-50"></i>
                </a>
                <a
                  href="https://mcecleanenergy.org/your-account/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-green-50 hover:bg-green-100 text-green-700 font-bold text-sm rounded-xl transition-all"
                >
                  <i className="fa-solid fa-leaf"></i>
                  MCE Account Portal
                  <i className="fa-solid fa-arrow-up-right-from-square text-xs opacity-50"></i>
                </a>
              </div>
              <div className="mt-6 text-left max-w-md mx-auto bg-slate-50 rounded-2xl p-5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Quick Steps</p>
                <ol className="text-sm text-slate-600 space-y-2 font-medium">
                  <li className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 bg-slate-200 rounded-full text-[10px] font-black flex items-center justify-center">1</span>
                    <span>Log in to your PG&E account</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 bg-slate-200 rounded-full text-[10px] font-black flex items-center justify-center">2</span>
                    <span>Go to <strong>Energy Use</strong> → <strong>Green Button</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 bg-slate-200 rounded-full text-[10px] font-black flex items-center justify-center">3</span>
                    <span>Select <strong>Export usage data</strong> (CSV format)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 bg-slate-200 rounded-full text-[10px] font-black flex items-center justify-center">4</span>
                    <span>Choose <strong>1 year</strong> of interval data, then download</span>
                  </li>
                </ol>
              </div>
            </div>

            {(uploadError || uploadedFileName) && (
              <div className="mt-8 max-w-2xl mx-auto text-left">
                {uploadedFileName && (
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Selected file: <span className="text-slate-700">{uploadedFileName}</span>
                  </p>
                )}
                {uploadError && (
                  <div className="bg-red-50 border border-red-100 text-red-700 rounded-2xl p-5">
                    <p className="font-black uppercase tracking-widest text-[10px] mb-1">Upload error</p>
                    <p className="font-bold">{uploadError}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-10">
              {/* Data Coverage & Warnings */}
              {(uploadWarnings.length > 0 || dataCoverage) && (
                <div className="space-y-4">
                  {/* Data Coverage Indicator */}
                  {dataCoverage && (
                    <div className={`rounded-[2rem] p-6 border ${
                      dataCoverage.months >= 12
                        ? 'bg-green-50 border-green-100'
                        : dataCoverage.months >= 6
                          ? 'bg-blue-50 border-blue-100'
                          : 'bg-amber-50 border-amber-100'
                    }`}>
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          dataCoverage.months >= 12
                            ? 'bg-green-100'
                            : dataCoverage.months >= 6
                              ? 'bg-blue-100'
                              : 'bg-amber-100'
                        }`}>
                          <i className={`fa-solid ${
                            dataCoverage.months >= 12
                              ? 'fa-circle-check text-green-600'
                              : dataCoverage.months >= 6
                                ? 'fa-chart-line text-blue-600'
                                : 'fa-triangle-exclamation text-amber-600'
                          } text-xl`}></i>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <p className={`text-[10px] font-black uppercase tracking-widest ${
                              dataCoverage.months >= 12
                                ? 'text-green-700'
                                : dataCoverage.months >= 6
                                  ? 'text-blue-700'
                                  : 'text-amber-700'
                            }`}>
                              Data Coverage: {dataCoverage.months} month{dataCoverage.months !== 1 ? 's' : ''} ({dataCoverage.days} days)
                            </p>
                            {dataCoverage.months >= 12 && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-green-200 text-green-800 rounded-full">Excellent</span>
                            )}
                            {dataCoverage.months >= 6 && dataCoverage.months < 12 && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full">Good</span>
                            )}
                            {dataCoverage.months < 6 && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full">Limited</span>
                            )}
                          </div>
                          <p className={`text-sm font-medium ${
                            dataCoverage.months >= 12
                              ? 'text-green-800'
                              : dataCoverage.months >= 6
                                ? 'text-blue-800'
                                : 'text-amber-800'
                          }`}>
                            {dataCoverage.start.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} — {dataCoverage.end.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          {dataCoverage.months < 12 && (
                            <p className={`text-xs mt-2 ${
                              dataCoverage.months >= 6 ? 'text-blue-600' : 'text-amber-600'
                            }`}>
                              {dataCoverage.months < 6
                                ? '⚠️ Limited data may affect accuracy. For best results, upload 12 months to capture seasonal patterns.'
                                : !dataCoverage.hasSummer || !dataCoverage.hasWinter
                                  ? `💡 Missing ${!dataCoverage.hasSummer ? 'summer' : 'winter'} data. Full year recommended for accurate TOU comparisons.`
                                  : '💡 Good coverage! 12 months would capture full seasonal variation.'
                              }
                            </p>
                          )}
                          {dataCoverage.months >= 12 && (
                            <p className="text-xs mt-2 text-green-600">
                              ✓ Full year of data provides accurate seasonal cost projections.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Import Notes */}
                  {uploadWarnings.length > 0 && (
                    <div className="bg-slate-50 border border-slate-100 text-slate-700 rounded-[2rem] p-6">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2 text-slate-500">Import notes</p>
                      <ul className="list-disc pl-5 space-y-1 text-sm font-medium">
                        {uploadWarnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Refine Your Analysis — collapsible optional enhancements */}
              <div className="rounded-[2rem] border border-slate-200 bg-white overflow-hidden">
                {/* Header — always visible */}
                <button
                  onClick={() => setShowRefinements(v => !v)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-sliders text-slate-400 text-sm"></i>
                    <span className="text-sm font-black text-slate-700">Refine your analysis</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full">Optional</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Active badges — visible when collapsed */}
                    {!showRefinements && (
                      <div className="flex items-center gap-1.5">
                        {nemEnabled && <span className="text-[9px] font-black bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Solar NEM</span>}
                        {gasReadings.length > 0 && <span className="text-[9px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Gas</span>}
                        {customBillingDates.length > 0 && <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{customBillingDates.length} periods</span>}
                        {!nemEnabled && gasReadings.length === 0 && customBillingDates.length === 0 && (
                          <span className="text-[10px] text-slate-400 font-medium">Solar · Gas · Billing dates</span>
                        )}
                      </div>
                    )}
                    <i className={`fa-solid fa-chevron-${showRefinements ? 'up' : 'down'} text-slate-300 text-xs ml-1`}></i>
                  </div>
                </button>

                {/* Expandable content */}
                {showRefinements && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">

                    {/* Solar / NEM */}
                    <div className={`px-6 py-4 transition-colors ${nemEnabled ? 'bg-yellow-50' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <i className={`fa-solid fa-solar-panel text-base ${nemEnabled ? 'text-yellow-500' : 'text-slate-300'}`}></i>
                          <div>
                            <h4 className={`text-sm font-black ${nemEnabled ? 'text-yellow-900' : 'text-slate-600'}`}>Solar / NEM</h4>
                            <p className={`text-xs font-medium ${nemEnabled ? 'text-yellow-600' : 'text-slate-400'}`}>
                              {nemEnabled ? 'True-Up mode active — credits defer to anniversary' : 'Have rooftop solar? Enable for NEM True-Up tracking'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const next = !nemEnabled;
                            localStorage.setItem('vc_nem', String(next));
                            setNemEnabled(next);
                          }}
                          className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${nemEnabled ? 'bg-yellow-400' : 'bg-slate-200'}`}
                        >
                          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${nemEnabled ? 'left-6' : 'left-1'}`} />
                        </button>
                      </div>
                    </div>

                    {/* Gas Data */}
                    <div className={`px-6 py-4 transition-colors ${gasReadings.length > 0 ? 'bg-orange-50' : ''}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <i className={`fa-solid fa-fire-flame-simple text-base flex-shrink-0 ${gasReadings.length > 0 ? 'text-orange-500' : 'text-slate-300'}`}></i>
                          <div className="min-w-0">
                            <h4 className={`text-sm font-black ${gasReadings.length > 0 ? 'text-orange-900' : 'text-slate-600'}`}>Gas Data</h4>
                            {gasReadings.length > 0 && gasComparison ? (
                              <p className="text-xs text-orange-600 font-medium">{gasComparison.totalUsage.toFixed(0)} therms · ${gasComparison.estimatedMonthlyCost.toFixed(0)}/mo avg</p>
                            ) : (
                              <p className="text-xs text-slate-400 font-medium">Upload gas Green Button CSV to include gas in your total bill</p>
                            )}
                          </div>
                        </div>
                        {gasReadings.length === 0 ? (
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold text-xs rounded-xl cursor-pointer transition-all flex-shrink-0">
                            <i className="fa-solid fa-cloud-arrow-up text-xs"></i>
                            Upload CSV
                            <input type="file" className="hidden" onChange={handleGasFileUpload} accept=".csv" />
                          </label>
                        ) : (
                          <button
                            onClick={() => { setGasReadings([]); setGasUploadError(null); setGasUploadWarnings([]); setGasUploadedFileName(null); }}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                          >
                            <i className="fa-solid fa-xmark mr-1"></i>Remove
                          </button>
                        )}
                      </div>
                      {gasUploadError && (
                        <div className="mt-3 bg-red-50 border border-red-100 text-red-700 rounded-xl p-3">
                          <p className="font-bold text-xs">{gasUploadError}</p>
                        </div>
                      )}
                      {gasReadings.length > 0 && gasComparison && (
                        <div className="mt-3 pt-3 border-t border-orange-200 grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Monthly Avg</p>
                            <p className="text-base font-black text-orange-900">${gasComparison.estimatedMonthlyCost.toFixed(0)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Total Usage</p>
                            <p className="text-base font-black text-orange-900">{gasComparison.totalUsage.toFixed(0)} therms</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Combined</p>
                            <p className="text-base font-black text-slate-900">
                              ${((comparisons.find(c => c.tariffId === currentTariff.id)?.estimatedMonthlyCost || 0) + gasComparison.estimatedMonthlyCost).toFixed(0)}/mo
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Billing Period End Dates */}
                    <div className={`px-6 py-4 transition-colors ${customBillingDates.length > 0 ? 'bg-blue-50' : ''}`}>
                      <div className="flex items-start gap-3">
                        <i className={`fa-solid fa-calendar-days text-base mt-0.5 flex-shrink-0 ${customBillingDates.length > 0 ? 'text-blue-500' : 'text-slate-300'}`}></i>
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-black ${customBillingDates.length > 0 ? 'text-blue-900' : 'text-slate-600'}`}>Billing Period End Dates</h4>
                          <p className={`text-xs font-medium mb-2 ${customBillingDates.length > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                            {customBillingDates.length > 0
                              ? `${customBillingDates.length} periods — month view aligned to your actual bill cycles`
                              : 'Paste end dates from your NEM YTD table to align month view to actual bill cycles'}
                          </p>
                          <textarea
                            rows={2}
                            placeholder="e.g. 05/27/2025, 06/26/2025, 07/28/2025, 08/27/2025 …"
                            value={billingDatesInput}
                            onChange={e => {
                              const raw = e.target.value;
                              setBillingDatesInput(raw);
                              const parts = raw.split(/[\s,;]+/).filter(Boolean);
                              const dates: string[] = [];
                              for (const part of parts) {
                                const mmddyyyy = part.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                                if (mmddyyyy) { dates.push(`${mmddyyyy[3]}-${mmddyyyy[1].padStart(2,'0')}-${mmddyyyy[2].padStart(2,'0')}`); continue; }
                                const mmddyy = part.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
                                if (mmddyy) { dates.push(`20${mmddyy[3]}-${mmddyy[1].padStart(2,'0')}-${mmddyy[2].padStart(2,'0')}`); continue; }
                                if (/^\d{4}-\d{2}-\d{2}$/.test(part)) dates.push(part);
                              }
                              const sorted = dates.sort();
                              localStorage.setItem('vc_billing_dates', JSON.stringify(sorted));
                              setCustomBillingDates(sorted);
                            }}
                            className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 resize-none placeholder:text-slate-300"
                          />
                          {customBillingDates.length > 0 && (
                            <button
                              onClick={() => { setBillingDatesInput(''); setCustomBillingDates([]); localStorage.removeItem('vc_billing_dates'); }}
                              className="mt-1.5 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-red-500 transition-all"
                            >
                              <i className="fa-solid fa-xmark mr-1"></i>Clear dates
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex justify-center mb-4">
                  <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                    {(['day', 'week', 'month', 'year'] as TimePeriod[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          anchorDateRef.current = filteredReadings[0]?.timestamp ?? null;
                          periodChangedRef.current = true;
                          startPeriodTransition(() => setSelectedPeriod(p));
                        }}
                        className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                          selectedPeriod === p ? 'bg-white text-slate-900 shadow-md transform scale-105' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => navigate(1)}
                    disabled={chunkIndex >= periodChunks.length - 1}
                    className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-900 hover:bg-slate-100 disabled:opacity-20 disabled:pointer-events-none transition-all flex items-center justify-center border border-slate-100"
                    aria-label="Previous period"
                  >
                    <i className="fa-solid fa-chevron-left text-lg"></i>
                  </button>
                  <div className="text-center px-4">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">
                      {isOngoingPeriod ? 'Ongoing Period (Estimate)' : 'Active Window'}
                    </p>
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{rangeLabel}</h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">Window {chunkIndex + 1} of {periodChunks.length}</p>
                  </div>
                  <button
                    onClick={() => navigate(-1)}
                    disabled={chunkIndex <= 0}
                    className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-900 hover:bg-slate-100 disabled:opacity-20 disabled:pointer-events-none transition-all flex items-center justify-center border border-slate-100"
                    aria-label="Next period"
                  >
                    <i className="fa-solid fa-chevron-right text-lg"></i>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  {
                    label: `Usage (${selectedPeriod})`,
                    val: `${periodStats?.usage.toFixed(0)} kWh`,
                    color: 'text-slate-900',
                    simNote: simulatedMonthlyKwh > 0 ? `+${Math.round(simulatedMonthlyKwh * (selectedPeriod === 'day' ? 1/30 : selectedPeriod === 'week' ? 7/30 : 1))} sim` : null
                  },
                  {
                    label: 'Status',
                    val: simulatedMonthlyKwh > 0 ? 'Simulated' : (isOngoingPeriod ? 'Partial' : 'Complete'),
                    color: simulatedMonthlyKwh > 0 ? 'text-violet-500' : (isOngoingPeriod ? 'text-amber-500' : 'text-slate-400')
                  },
                  { label: `Period Cost`, val: `$${periodStats?.cost.toFixed(2)}`, color: 'text-blue-600' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-7 rounded-3xl border border-slate-100 shadow-sm relative">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                    <p className={`text-2xl font-black ${stat.color}`}>{stat.val}</p>
                    {'simNote' in stat && stat.simNote && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">{stat.simNote}</span>
                    )}
                  </div>
                ))}
                {/* Period Bill breakdown card */}
                <div className="bg-white p-7 rounded-3xl border border-slate-100 shadow-sm relative">
                  {(() => {
                    const elecCost = periodStats?.cost ?? 0;
                    const gasCost = periodGasCost;
                    // NEM: monthly statement shows minimum bill for net-export months
                    const nemMonthEntry = nemEnabled && selectedPeriod === 'month' && periodMonthKey
                      ? nemTrueUp?.months.find(m => m.monthName === periodMonthKey)
                      : null;
                    const displayElec = nemMonthEntry ? nemMonthEntry.statementAmount : elecCost;
                    const displayPcia = nemMonthEntry ? nemMonthEntry.pciaCost : 0;
                    // Net-export month = delivery was a credit (generation still charged)
                    const isNemMinMonth = nemMonthEntry != null && nemMonthEntry.deliveryCost < 0;
                    const total = displayElec + (gasCost ?? 0);
                    const cardLabel = {
                      day: isOngoingPeriod ? 'Day-to-Date Bill' : "Day's Bill",
                      week: isOngoingPeriod ? 'Week-to-Date Bill' : "Week's Bill",
                      month: isOngoingPeriod ? 'Month-to-Date Bill' : (nemEnabled ? 'Monthly Statement' : 'Monthly Bill'),
                      year: isOngoingPeriod ? 'Year-to-Date Bill' : 'Annual Bill',
                    }[selectedPeriod];
                    return (
                      <>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{cardLabel}</p>
                        <p className="text-2xl font-black text-slate-900">${total.toFixed(2)}</p>
                        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Electricity</span>
                            <span className="text-[11px] font-black text-slate-700">
                              ${(displayElec - displayPcia).toFixed(2)}
                              {isNemMinMonth && <span className="text-[9px] font-bold text-yellow-600 ml-1">gen+min del.</span>}
                            </span>
                          </div>
                          {displayPcia > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">PCIA</span>
                              <span className="text-[11px] font-black text-slate-700">${displayPcia.toFixed(2)}</span>
                            </div>
                          )}
                          {gasCost != null ? (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Gas</span>
                              <span className="text-[11px] font-black text-slate-700">${gasCost.toFixed(2)}{selectedPeriod !== 'month' && selectedPeriod !== 'year' && <span className="text-[9px] font-medium text-slate-400 ml-1">est.</span>}</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-orange-300 uppercase tracking-widest">Gas</span>
                              <span className="text-[10px] text-slate-300 font-bold">No data</span>
                            </div>
                          )}
                          {isNemMinMonth && (
                            <p className="text-[9px] text-yellow-600 font-bold pt-1">Net export — delivery credit defers to True-Up</p>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {isPeriodPending && (
                <div className="flex items-center justify-center py-8">
                  <i className="fa-solid fa-spinner animate-spin text-blue-500 text-xl mr-3"></i>
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading...</span>
                </div>
              )}
              <EnergyChart
                readings={chartReadings}
                period={selectedPeriod}
                tariff={currentTariff}
                gasReadings={gasReadings.length > 0 ? gasReadings : undefined}
                onBarClick={handleDrillDown}
              />

              {/* NEM True-Up Tracker */}
              {nemTrueUp && (
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-[2.5rem] p-8 border border-yellow-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-yellow-200 flex items-center justify-center shadow">
                        <i className="fa-solid fa-solar-panel text-yellow-800 text-xl"></i>
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900">NEM True-Up Tracker</h3>
                        <p className="text-sm text-slate-500 font-medium">12-month net balance · credits defer to anniversary</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Projected True-Up</p>
                      <p className={`text-3xl font-black tracking-tighter ${nemTrueUp.trueUpBalance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {nemTrueUp.trueUpBalance > 0 ? '+' : ''}${nemTrueUp.trueUpBalance.toFixed(0)}
                      </p>
                      <p className={`text-[10px] font-bold mt-1 ${nemTrueUp.trueUpBalance > 0 ? 'text-red-400' : 'text-green-500'}`}>
                        {nemTrueUp.trueUpBalance > 0 ? 'you owe at anniversary' : 'credit at anniversary'}
                      </p>
                    </div>
                  </div>

                  {/* Summary strip */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white/70 rounded-2xl p-4 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly Statement</p>
                      <p className="text-xl font-black text-slate-900">${(nemTrueUp.totalStatements / nemTrueUp.months.length).toFixed(0)}<span className="text-sm font-bold text-slate-400">/mo avg</span></p>
                      <p className="text-[9px] text-slate-400 mt-0.5">gen + min delivery</p>
                    </div>
                    <div className="bg-white/70 rounded-2xl p-4 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">True-Up Charges</p>
                      <p className="text-xl font-black text-slate-900">${Math.max(0, nemTrueUp.trueUpBalance).toFixed(0)}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">delivery net owed</p>
                    </div>
                    <div className="bg-white/70 rounded-2xl p-4 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">True-Up Credits</p>
                      <p className="text-xl font-black text-green-600">${Math.abs(Math.min(0, nemTrueUp.trueUpBalance)).toFixed(0)}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">delivery net credit</p>
                    </div>
                  </div>

                  {/* Month-by-month table */}
                  <div className="bg-white/70 rounded-2xl overflow-hidden">
                    <div className={`grid px-4 py-2 border-b border-yellow-100 ${nemTrueUp.hasDeliveryRates ? 'grid-cols-5' : 'grid-cols-4'}`}>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Month</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Net kWh</span>
                      {nemTrueUp.hasDeliveryRates && <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Delivery</span>}
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Statement</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">True-Up Balance</span>
                    </div>
                    {[...nemTrueUp.months].reverse().map((m, i) => {
                      const [year, mo] = m.monthName.split('-');
                      const label = new Date(+year, +mo - 1, 1).toLocaleDateString([], { month: 'short', year: '2-digit' });
                      const isNetExport = m.deliveryCost < 0;
                      return (
                        <div key={i} className={`grid px-4 py-2.5 border-b border-yellow-50 last:border-0 ${nemTrueUp.hasDeliveryRates ? 'grid-cols-5' : 'grid-cols-4'} ${isNetExport ? 'bg-green-50/50' : ''}`}>
                          <span className="text-xs font-bold text-slate-700">{label}</span>
                          <span className={`text-xs font-bold text-right ${m.usage < 0 ? 'text-green-600' : 'text-slate-600'}`}>
                            {m.usage < 0 ? '−' : ''}{Math.abs(m.usage).toFixed(0)}
                          </span>
                          {nemTrueUp.hasDeliveryRates && (
                            <span className={`text-xs font-bold text-right ${isNetExport ? 'text-green-600' : 'text-slate-600'}`}>
                              {isNetExport ? '−$' : '$'}{Math.abs(m.deliveryCost).toFixed(0)}
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-700 text-right">
                            ${m.statementAmount.toFixed(0)}
                          </span>
                          <span className={`text-xs font-black text-right ${m.runningBalance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {m.runningBalance > 0 ? '+' : ''}${m.runningBalance.toFixed(0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[10px] text-slate-400 font-medium mt-4">
                    {nemTrueUp.hasDeliveryRates
                      ? `⚡ Generation + gas paid monthly. Delivery accrues to True-Up at anniversary. PCIA modeled at $${(currentTariff.pciaRate ?? 0).toFixed(3)}/kWh (varies by enrollment vintage — check page 2 of your PG&E bill). MCE Storage Credit not modeled (if enrolled, ~−$12/mo — enter as monthlyCredit on tariff).`
                      : '⚡ True-Up settles the full 12-month net at your anniversary date. Add delivery rate data to your tariff for MCE-accurate split.'
                    }
                  </p>
                </div>
              )}

              {/* Simulation Panel */}
              <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-[2.5rem] p-8 border border-violet-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg">
                      <i className="fa-solid fa-flask text-white text-xl"></i>
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900">What-If Simulator</h3>
                      <p className="text-sm text-slate-500 font-medium">Add future loads to see rate impact</p>
                    </div>
                  </div>
                  {simulatedMonthlyKwh > 0 && (
                    <div className="bg-violet-100 px-4 py-2 rounded-xl">
                      <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Simulating</p>
                      <p className="text-lg font-black text-violet-800">+{simulatedMonthlyKwh} kWh/mo</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {LOAD_PRESETS.map(preset => {
                    const enabled = isLoadEnabled(preset.id);
                    const replacesGas = preset.replacesGasTherms && preset.replacesGasTherms > 0;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => toggleSimulatedLoad(preset.id)}
                        className={`p-4 rounded-2xl border-2 transition-all text-left relative ${
                          enabled
                            ? 'bg-violet-600 border-violet-600 text-white shadow-lg scale-105'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-violet-300 hover:bg-violet-50'
                        }`}
                      >
                        {replacesGas && (
                          <span className={`absolute top-2 right-2 text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${enabled ? 'bg-orange-400 text-white' : 'bg-orange-100 text-orange-600'}`}>
                            −Gas
                          </span>
                        )}
                        <div className="flex items-center gap-3 mb-2">
                          <i className={`fa-solid ${preset.icon} text-lg ${enabled ? 'text-violet-200' : 'text-violet-500'}`}></i>
                          <span className={`text-xs font-black uppercase tracking-wide ${enabled ? 'text-violet-200' : 'text-slate-400'}`}>
                            +{preset.monthlyKwh} kWh
                          </span>
                        </div>
                        <p className={`font-bold text-sm ${enabled ? 'text-white' : 'text-slate-800'}`}>{preset.name}</p>
                        <p className={`text-xs mt-1 ${enabled ? 'text-violet-200' : 'text-slate-400'}`}>{preset.description.split(',')[0]}</p>
                      </button>
                    );
                  })}
                </div>

                {simulatedMonthlyKwh > 0 && (
                  <div className="mt-6 pt-6 border-t border-violet-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-1">With Simulated Loads</p>
                        <p className="text-sm text-slate-600">
                          Your monthly estimate includes <strong>+{simulatedMonthlyKwh} kWh</strong> from simulated loads.
                          {simulatedLoads.filter(l => l.enabled).some(l => l.id.includes('ev')) && (
                            <span className="text-violet-600"> EV charging is optimized for overnight off-peak hours.</span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => setSimulatedLoads([])}
                        className="text-[10px] font-black uppercase tracking-widest text-violet-500 hover:text-violet-700 px-3 py-2 rounded-lg hover:bg-violet-100 transition-all"
                      >
                        <i className="fa-solid fa-xmark mr-1"></i> Clear All
                      </button>
                    </div>

                    {/* Gas Savings from Electrification */}
                    {gasSavings && gasSavings.monthlyThermsOffset > 0 && (
                      <div className="bg-gradient-to-r from-orange-100 to-green-100 rounded-2xl p-4 mt-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-green-500 flex items-center justify-center">
                            <i className="fa-solid fa-leaf text-white"></i>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-green-700 uppercase tracking-widest">Gas Savings from Electrification</p>
                            <p className="text-sm text-slate-700">
                              Replacing <strong>{gasSavings.appliances.join(', ')}</strong> saves ~<strong>{gasSavings.monthlyThermsOffset} therms/mo</strong>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-green-600 uppercase">Monthly Gas Savings</p>
                            <p className="text-2xl font-black text-green-700">−${gasSavings.monthlySavings.toFixed(0)}</p>
                          </div>
                        </div>
                        {gasReadings.length === 0 && (
                          <p className="text-xs text-slate-500 mt-3 italic">
                            Upload your gas bill to see actual savings based on your usage.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-slate-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden border border-slate-800">
                <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 pointer-events-none">
                  <i className="fa-solid fa-money-bill-trend-up text-[12rem] text-green-400"></i>
                </div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-tr from-green-500 to-emerald-400 flex items-center justify-center shadow-xl shadow-green-900/40">
                        <i className="fa-solid fa-magnifying-glass-chart text-white text-2xl"></i>
                      </div>
                      <div>
                        <h3 className="text-3xl font-black tracking-tight">Best Bang for Buck</h3>
                        <p className="text-emerald-400 font-bold text-xs uppercase tracking-widest mt-1">ROI-Focused Insights</p>
                      </div>
                    </div>
                  </div>
                  
                  {aiAnalysis ? (
                    <div className="space-y-6">
                      <div className="bg-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/10 prose prose-invert max-w-none">
                        <div className="text-slate-200 text-lg font-medium leading-relaxed whitespace-pre-wrap">{aiAnalysis}</div>
                      </div>
                      <button onClick={() => setAiAnalysis(null)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white mt-4">
                        <i className="fa-solid fa-rotate mr-2"></i>Re-Run Habit Check
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xl text-slate-400 mb-10 leading-relaxed font-medium">
                        We don't just compare plans—we find the <strong>biggest savings opportunities</strong> hiding in your daily routine. Let's find your "Bang for Buck" wins.
                      </p>
                      <button 
                        onClick={async () => {
                          setIsAnalyzing(true);
                          setAiAnalysis(await analyzeUsageWithClaude(readings, DEFAULT_TARIFFS, location));
                          setIsAnalyzing(false);
                        }}
                        disabled={isAnalyzing}
                        className="bg-white text-slate-900 px-10 py-5 rounded-2xl font-black text-lg transition-all hover:scale-105 active:scale-95 shadow-xl disabled:opacity-50"
                      >
                        {isAnalyzing ? (
                          <span className="flex items-center gap-2">
                             <i className="fa-solid fa-spinner animate-spin"></i> Analyzing...
                          </span>
                        ) : 'Find Savings Opportunities'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-10">
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Historical Billing Breakdown</h3>
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                     Fixed Charges Included
                   </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Billing Month</th>
                        <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Usage</th>
                        <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Bill (Current)</th>
                        <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Bill (Best)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(comparisons.find(c => c.tariffId === currentTariff.id)?.breakdown || []).map((row, idx) => {
                        const bestRow = bestTariff?.breakdown.find(b => b.monthName === row.monthName);
                        const monthParts = row.monthName.split('-');
                        const rowDate = new Date(parseInt(monthParts[0]), parseInt(monthParts[1]) - 1);
                        const isThisMonth = rowDate.getMonth() === new Date().getMonth() && rowDate.getFullYear() === new Date().getFullYear();
                        const monthLabel = rowDate.toLocaleString('default', { month: 'long', year: 'numeric' });
                        
                        return (
                          <tr key={idx} className={`group hover:bg-slate-50/50 transition-colors ${isThisMonth ? 'bg-blue-50/30' : ''}`}>
                            <td className="py-6 font-bold text-slate-800">
                              {monthLabel} {isThisMonth && <span className="ml-2 text-[8px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded uppercase">Ongoing</span>}
                            </td>
                            <td className="py-6 font-medium text-slate-500">{row.usage.toFixed(1)} kWh</td>
                            <td className="py-6 font-black text-slate-900">${row.cost.toFixed(2)}</td>
                            <td className="py-6 font-black text-green-600">
                              ${bestRow?.cost.toFixed(2)}
                              <span className="ml-3 text-[10px] bg-green-100 px-2 py-1 rounded-lg">-{(((row.cost - (bestRow?.cost || 0)) / row.cost) * 100).toFixed(0)}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Rate Options</h3>
                {(provider === 'pge-bundled' || provider === 'mce-pge') && (
                  <button
                    onClick={() => {
                      const next = provider === 'pge-bundled' ? 'mce-pge' : 'pge-bundled';
                      localStorage.setItem('vc_provider', next);
                      setProvider(next);
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-slate-700 uppercase tracking-widest transition-all"
                  >
                    <i className="fa-solid fa-arrow-right-arrow-left text-xs"></i>
                    Swap Order
                  </button>
                )}
              </div>

              {/* Dynamic rate sections based on provider */}
              {(() => {
                const renderTariffCard = (c: typeof sortedComparisons[0], accentColor: string) => {
                  const t = DEFAULT_TARIFFS.find(tar => tar.id === c.tariffId)!;
                  const isCurrent = currentTariff.id === t.id;
                  const isBest = c.tariffId === bestTariff?.tariffId;
                  const bestBorder = accentColor === 'green' ? 'border-green-400 shadow-xl shadow-green-50' : accentColor === 'orange' ? 'border-orange-400 shadow-xl shadow-orange-50' : accentColor === 'cyan' ? 'border-cyan-400 shadow-xl shadow-cyan-50' : 'border-blue-400 shadow-xl shadow-blue-50';
                  const btnHover = accentColor === 'green' ? 'hover:bg-green-600' : accentColor === 'orange' ? 'hover:bg-orange-500' : accentColor === 'cyan' ? 'hover:bg-cyan-600' : 'hover:bg-blue-600';
                  const badgeColor = t.id.includes('deep') ? 'bg-green-100 text-green-700' : t.provider === 'mce-pge' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500';
                  return (
                    <div key={c.tariffId} className={`p-6 rounded-[2rem] border-4 transition-all duration-700 relative overflow-hidden ${isCurrent ? 'bg-slate-900 border-slate-900 text-white shadow-2xl scale-105 z-10' : isBest ? `bg-white ${bestBorder}` : 'bg-white border-slate-100'}`}>
                      {isCurrent && <div className={`absolute top-0 right-0 ${accentColor === 'green' ? 'bg-green-600' : accentColor === 'orange' ? 'bg-orange-500' : accentColor === 'cyan' ? 'bg-cyan-600' : 'bg-blue-600'} text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-bl-2xl`}>Selected</div>}
                      <div className="mb-6">
                        <h4 className={`text-lg font-black leading-tight mb-2 ${isCurrent ? 'text-white' : 'text-slate-900'}`}>{t.name}</h4>
                        <div className="flex flex-wrap gap-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${isCurrent ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500'}`}>{t.type === 'tou' ? 'Time-of-Use' : 'Tiered'}</span>
                          {(t.provider === 'mce-pge') && <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${isCurrent ? 'bg-green-500/30 text-green-300' : badgeColor}`}>{t.id.includes('deep') ? '100% Renewable' : '60% Renewable'}</span>}
                          {(t.provider === 'sce-bundled' || t.provider === 'sdge-bundled') && <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-amber-50 text-amber-600">Approx. rates</span>}
                        </div>
                      </div>
                      <div className="border-t pt-6 border-slate-100/10">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-400">Est. Monthly</p>
                            <p className="text-3xl font-black tracking-tighter">${(c.estimatedMonthlyCost + (gasComparison?.estimatedMonthlyCost ?? 0)).toFixed(0)}</p>
                          </div>
                          {!isCurrent && <div className={`flex flex-col items-end ${c.savingsVsCurrent > 0 ? 'text-green-500' : 'text-red-400'}`}><span className="text-[10px] font-black uppercase tracking-widest mb-1">{c.savingsVsCurrent > 0 ? 'Saving' : 'Extra'}</span><span className="text-lg font-black">{c.savingsVsCurrent > 0 ? '−' : '+'}${Math.abs(c.savingsVsCurrent).toFixed(0)}</span></div>}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between"><span className={`text-[10px] font-bold uppercase tracking-widest ${isCurrent ? 'text-blue-400' : 'text-blue-500'}`}>Electricity</span><span className={`text-[11px] font-black ${isCurrent ? 'text-slate-300' : 'text-slate-600'}`}>${c.estimatedMonthlyCost.toFixed(0)}</span></div>
                          {gasComparison && <div className="flex items-center justify-between"><span className={`text-[10px] font-bold uppercase tracking-widest ${isCurrent ? 'text-orange-400' : 'text-orange-500'}`}>Gas</span><span className={`text-[11px] font-black ${isCurrent ? 'text-slate-300' : 'text-slate-600'}`}>${gasComparison.estimatedMonthlyCost.toFixed(0)}</span></div>}
                        </div>
                      </div>
                      <button onClick={() => setCurrentTariff(t)} disabled={isCurrent} className={`w-full mt-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${isCurrent ? 'bg-white/10 text-white/30 pointer-events-none' : `bg-slate-900 text-white ${btnHover} shadow-lg active:scale-95`}`}>{isCurrent ? 'Baseline' : 'Set as Current'}</button>
                    </div>
                  );
                };

                const sections: Array<{ providerFilter: ProviderType; label: string; sub: string; icon: string; iconBg: string; iconColor: string; accent: string; secondary?: boolean }> = provider === 'mce-pge'
                  ? [
                      { providerFilter: 'mce-pge', label: 'MCE + PG&E Delivery', sub: 'Community Choice — 60-100% Renewable', icon: 'fa-leaf', iconBg: 'bg-green-100', iconColor: 'text-green-600', accent: 'green' },
                      { providerFilter: 'pge-bundled', label: 'PG&E Bundled', sub: 'Generation + Delivery from PG&E', icon: 'fa-bolt', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', accent: 'blue', secondary: true },
                    ]
                  : provider === 'pge-bundled'
                  ? [
                      { providerFilter: 'pge-bundled', label: 'PG&E Bundled', sub: 'Generation + Delivery from PG&E', icon: 'fa-bolt', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', accent: 'blue' },
                      { providerFilter: 'mce-pge', label: 'MCE + PG&E Delivery', sub: 'Community Choice — 60-100% Renewable', icon: 'fa-leaf', iconBg: 'bg-green-100', iconColor: 'text-green-600', accent: 'green', secondary: true },
                    ]
                  : provider === 'sce-bundled'
                  ? [{ providerFilter: 'sce-bundled', label: 'SCE Rate Options', sub: 'Southern California Edison — approximate rates', icon: 'fa-sun', iconBg: 'bg-orange-100', iconColor: 'text-orange-600', accent: 'orange' }]
                  : [{ providerFilter: 'sdge-bundled', label: 'SDG&E Rate Options', sub: 'San Diego Gas & Electric — approximate rates', icon: 'fa-water', iconBg: 'bg-cyan-100', iconColor: 'text-cyan-600', accent: 'cyan' }];

                return sections.map(({ providerFilter, label, sub, icon, iconBg, iconColor, accent, secondary }) => (
                  <div key={providerFilter} className={`space-y-4 ${secondary ? 'pt-4 border-t border-slate-200' : ''}`}>
                    <div className="flex items-center gap-3 px-2">
                      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}><i className={`fa-solid ${icon} ${iconColor} text-sm`}></i></div>
                      <div><h4 className="text-sm font-black text-slate-900">{label}</h4><p className="text-[10px] text-slate-400 font-medium">{sub}</p></div>
                    </div>
                    <div className="space-y-4">
                      {sortedComparisons.filter(c => DEFAULT_TARIFFS.find(tar => tar.id === c.tariffId)?.provider === providerFilter).map(c => renderTariffCard(c, accent))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </main>

      {(isLoading || isLoadingGas) && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-2xl z-[100] flex flex-col items-center justify-center">
           <div className="relative mb-8">
              <div className="w-24 h-24 border-[10px] border-slate-100 rounded-full"></div>
              <div className={`w-24 h-24 border-[10px] ${isLoadingGas ? 'border-orange-500' : 'border-blue-600'} border-t-transparent rounded-full animate-spin absolute top-0`}></div>
           </div>
           <p className="text-2xl font-black text-slate-900 tracking-tighter uppercase">
             {isLoadingGas ? 'Analyzing Gas Data' : 'Analyzing Meter Profile'}
           </p>
           <p className="text-slate-400 font-bold mt-2">
             {isLoadingGas ? 'Processing PG&E gas interval data...' : 'Correlating with MCE & PG&E rate schedules...'}
           </p>
        </div>
      )}
    </div>
  );
};

export default App;
