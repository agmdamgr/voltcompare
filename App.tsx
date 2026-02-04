
import React, { useState, useEffect, useMemo, useRef, useTransition } from 'react';
import { EnergyReading, Tariff, ComparisonResult, TimePeriod, SimulatedLoad, GasReading, GasComparisonResult } from './types';
import { DEFAULT_TARIFFS, LOAD_PRESETS, DEFAULT_GAS_TARIFF } from './constants';
import EnergyChart from './components/EnergyChart';
import { analyzeUsageWithClaude } from './services/claudeService';
import { compareTariffs, calculateDetailedCost } from './services/energyCalculator';
import { parsePgeIntervalCsv } from './services/pgeCsvParser';
import { parsePgeGasCsv } from './services/pgeGasCsvParser';
import { calculateGasComparison, calculateGasSavingsFromElectrification } from './services/gasCalculator';

const App: React.FC = () => {
  const [readings, setReadings] = useState<EnergyReading[]>([]);
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
        (pos) => setLocation(`PG&E (${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)})`),
        () => setLocation('PG&E Service Area')
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

  // Calculate gas comparison when gas readings change
  useEffect(() => {
    if (gasReadings.length > 0) {
      setGasComparison(calculateGasComparison(gasReadings, DEFAULT_GAS_TARIFF));
    } else {
      setGasComparison(null);
    }
  }, [gasReadings]);

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
      if (period === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

  const periodChunks = useMemo(() => getChunksForPeriod(readingsWithSimulation, selectedPeriod), [readingsWithSimulation, selectedPeriod]);

  useEffect(() => {
    if (isDrillingDown.current) {
      isDrillingDown.current = false;
      return;
    }
    setChunkIndex(0);
  }, [selectedPeriod]);

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
    if (selectedPeriod === 'month') return start.toLocaleDateString([], { month: 'long', year: 'numeric' });
    return `Full Dataset History (${start.getFullYear()})`;
  }, [filteredReadings, selectedPeriod]);

  const periodStats = useMemo(() => {
    if (filteredReadings.length === 0 || comparisons.length === 0) return null;
    const usage = filteredReadings.reduce((s, r) => s + r.value, 0);
    const tempCalc = calculateDetailedCost(filteredReadings, currentTariff);
    return { usage, cost: tempCalc.totalCost };
  }, [filteredReadings, comparisons, currentTariff]);

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
    setChunkIndex(prev => Math.max(0, Math.min(periodChunks.length - 1, prev + dir)));
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
        {readings.length === 0 ? (
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

              {/* Gas Data Section */}
              <div className={`rounded-[2rem] p-6 border ${gasReadings.length > 0 ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${gasReadings.length > 0 ? 'bg-orange-100' : 'bg-slate-100'}`}>
                      <i className={`fa-solid fa-fire-flame-simple text-xl ${gasReadings.length > 0 ? 'text-orange-600' : 'text-slate-400'}`}></i>
                    </div>
                    <div>
                      <h4 className={`text-sm font-black ${gasReadings.length > 0 ? 'text-orange-900' : 'text-slate-700'}`}>
                        {gasReadings.length > 0 ? 'Gas Data Loaded' : 'Add Gas Data (Optional)'}
                      </h4>
                      {gasReadings.length > 0 && gasComparison ? (
                        <p className="text-xs text-orange-700 font-medium">
                          {gasComparison.totalUsage.toFixed(0)} therms total · ${gasComparison.estimatedMonthlyCost.toFixed(0)}/mo avg
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">Upload PG&E gas Green Button CSV for complete cost picture</p>
                      )}
                    </div>
                  </div>
                  {gasReadings.length === 0 ? (
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl cursor-pointer transition-all">
                      <i className="fa-solid fa-cloud-arrow-up"></i>
                      Upload Gas CSV
                      <input type="file" className="hidden" onChange={handleGasFileUpload} accept=".csv" />
                    </label>
                  ) : (
                    <button
                      onClick={() => {
                        setGasReadings([]);
                        setGasUploadError(null);
                        setGasUploadWarnings([]);
                        setGasUploadedFileName(null);
                      }}
                      className="text-[10px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-700 px-3 py-2 rounded-lg hover:bg-orange-100 transition-all"
                    >
                      <i className="fa-solid fa-xmark mr-1"></i> Remove
                    </button>
                  )}
                </div>

                {gasUploadError && (
                  <div className="mt-4 bg-red-50 border border-red-100 text-red-700 rounded-xl p-4">
                    <p className="font-bold text-sm">{gasUploadError}</p>
                  </div>
                )}

                {gasUploadWarnings.length > 0 && (
                  <div className="mt-4 text-sm text-orange-700">
                    <ul className="list-disc pl-5 space-y-1">
                      {gasUploadWarnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {gasReadings.length > 0 && gasComparison && (
                  <div className="mt-4 pt-4 border-t border-orange-200 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Monthly Avg</p>
                      <p className="text-lg font-black text-orange-900">${gasComparison.estimatedMonthlyCost.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Total Usage</p>
                      <p className="text-lg font-black text-orange-900">{gasComparison.totalUsage.toFixed(0)} therms</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Combined Monthly</p>
                      <p className="text-lg font-black text-slate-900">
                        ${((comparisons.find(c => c.tariffId === currentTariff.id)?.estimatedMonthlyCost || 0) + gasComparison.estimatedMonthlyCost).toFixed(0)}
                      </p>
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
                        onClick={() => startPeriodTransition(() => setSelectedPeriod(p))}
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
                  { label: 'Est. Monthly Bill', val: `$${(comparisons.find(c => c.tariffId === currentTariff.id)?.estimatedMonthlyCost || 0).toFixed(0)}`, color: 'text-slate-400' }
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-7 rounded-3xl border border-slate-100 shadow-sm relative">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                    <p className={`text-2xl font-black ${stat.color}`}>{stat.val}</p>
                    {'simNote' in stat && stat.simNote && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">{stat.simNote}</span>
                    )}
                  </div>
                ))}
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
                onBarClick={handleDrillDown}
              />

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

            <div className="lg:col-span-4 space-y-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Rate Options</h3>
                <i className="fa-solid fa-sliders text-slate-300"></i>
              </div>

              {/* MCE + PG&E Delivery Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <i className="fa-solid fa-leaf text-green-600 text-sm"></i>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">MCE + PG&E Delivery</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Community Choice - 60-100% Renewable</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {sortedComparisons.filter(c => {
                    const t = DEFAULT_TARIFFS.find(tar => tar.id === c.tariffId);
                    return t?.provider === 'mce-pge';
                  }).map((c) => {
                    const t = DEFAULT_TARIFFS.find(tar => tar.id === c.tariffId)!;
                    const isCurrent = currentTariff.id === t.id;
                    const isBest = c.tariffId === bestTariff?.tariffId;
                    const isDeepGreen = t.id.includes('deep');

                    return (
                      <div
                        key={c.tariffId}
                        className={`p-6 rounded-[2rem] border-4 transition-all duration-700 relative overflow-hidden ${
                          isCurrent
                            ? 'bg-slate-900 border-slate-900 text-white shadow-2xl scale-105 z-10'
                            : isBest
                              ? 'bg-white border-green-400 shadow-xl shadow-green-50'
                              : 'bg-white border-slate-100'
                        }`}
                      >
                        {isCurrent && (
                          <div className="absolute top-0 right-0 bg-green-600 text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-bl-2xl">
                            Selected
                          </div>
                        )}

                        <div className="mb-6">
                          <h4 className={`text-lg font-black leading-tight mb-2 ${isCurrent ? 'text-white' : 'text-slate-900'}`}>{t.name}</h4>
                          <div className="flex flex-wrap gap-2">
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${isCurrent ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500'}`}>
                               {t.type === 'tou' ? 'Time-of-Use' : 'Tiered'}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${isCurrent ? 'bg-green-500/30 text-green-300' : isDeepGreen ? 'bg-green-100 text-green-700' : 'bg-emerald-50 text-emerald-600'}`}>
                               {isDeepGreen ? '100% Renewable' : '60% Renewable'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-end justify-between border-t pt-6 border-slate-100/10">
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isCurrent ? 'text-slate-400' : 'text-slate-400'}`}>Est. Monthly</p>
                            <p className="text-3xl font-black tracking-tighter">${c.estimatedMonthlyCost.toFixed(0)}</p>
                          </div>
                          <div className="text-right">
                             {!isCurrent && (
                               <div className={`flex flex-col items-end ${c.savingsVsCurrent > 0 ? 'text-green-500' : 'text-red-400'}`}>
                                 <span className="text-[10px] font-black uppercase tracking-widest mb-1">
                                   {c.savingsVsCurrent > 0 ? 'Saving' : 'Extra'}
                                 </span>
                                 <span className="text-lg font-black">
                                   {c.savingsVsCurrent > 0 ? '−' : '+'}${Math.abs(c.savingsVsCurrent).toFixed(0)}
                                 </span>
                               </div>
                             )}
                          </div>
                        </div>

                        <button
                          onClick={() => setCurrentTariff(t)}
                          disabled={isCurrent}
                          className={`w-full mt-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${
                            isCurrent
                              ? 'bg-white/10 text-white/30 pointer-events-none'
                              : 'bg-slate-900 text-white hover:bg-green-600 shadow-lg active:scale-95'
                          }`}
                        >
                          {isCurrent ? 'Baseline' : 'Set as Current'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PG&E Bundled Section */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <i className="fa-solid fa-bolt text-blue-600 text-sm"></i>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">PG&E Bundled</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Generation + Delivery from PG&E</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {sortedComparisons.filter(c => {
                    const t = DEFAULT_TARIFFS.find(tar => tar.id === c.tariffId);
                    return t?.provider === 'pge-bundled';
                  }).map((c) => {
                    const t = DEFAULT_TARIFFS.find(tar => tar.id === c.tariffId)!;
                    const isCurrent = currentTariff.id === t.id;
                    const isBest = c.tariffId === bestTariff?.tariffId;

                    return (
                      <div
                        key={c.tariffId}
                        className={`p-6 rounded-[2rem] border-4 transition-all duration-700 relative overflow-hidden ${
                          isCurrent
                            ? 'bg-slate-900 border-slate-900 text-white shadow-2xl scale-105 z-10'
                            : isBest
                              ? 'bg-white border-blue-400 shadow-xl shadow-blue-50'
                              : 'bg-white border-slate-100'
                        }`}
                      >
                        {isCurrent && (
                          <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-bl-2xl">
                            Selected
                          </div>
                        )}

                        <div className="mb-6">
                          <h4 className={`text-lg font-black leading-tight mb-2 ${isCurrent ? 'text-white' : 'text-slate-900'}`}>{t.name}</h4>
                          <div className="flex flex-wrap gap-2">
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${isCurrent ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500'}`}>
                               {t.type === 'tou' ? 'Time-of-Use' : 'Tiered'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-end justify-between border-t pt-6 border-slate-100/10">
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isCurrent ? 'text-slate-400' : 'text-slate-400'}`}>Est. Monthly</p>
                            <p className="text-3xl font-black tracking-tighter">${c.estimatedMonthlyCost.toFixed(0)}</p>
                          </div>
                          <div className="text-right">
                             {!isCurrent && (
                               <div className={`flex flex-col items-end ${c.savingsVsCurrent > 0 ? 'text-green-500' : 'text-red-400'}`}>
                                 <span className="text-[10px] font-black uppercase tracking-widest mb-1">
                                   {c.savingsVsCurrent > 0 ? 'Saving' : 'Extra'}
                                 </span>
                                 <span className="text-lg font-black">
                                   {c.savingsVsCurrent > 0 ? '−' : '+'}${Math.abs(c.savingsVsCurrent).toFixed(0)}
                                 </span>
                               </div>
                             )}
                          </div>
                        </div>

                        <button
                          onClick={() => setCurrentTariff(t)}
                          disabled={isCurrent}
                          className={`w-full mt-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${
                            isCurrent
                              ? 'bg-white/10 text-white/30 pointer-events-none'
                              : 'bg-slate-900 text-white hover:bg-blue-600 shadow-lg active:scale-95'
                          }`}
                        >
                          {isCurrent ? 'Baseline' : 'Set as Current'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
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
