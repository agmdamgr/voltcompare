
import { EnergyReading, Tariff, TariffPeriod, ComparisonResult, MonthlyBreakdown } from '../types';

// PG&E summer = Jun-Sep (months 5-8), winter = Oct-May
const isSummerMonth = (month: number) => month >= 5 && month <= 8;

const getEffectiveRate = (period: TariffPeriod, month: number): number => {
  if (period.summerRate != null && isSummerMonth(month)) {
    return period.summerRate;
  }
  return period.rate;
};

// Resolve the correct rate version for a given date.
// If tariff has rateHistory, check if the date falls before any version's effectiveBefore cutoff.
// Returns the matching periods and fixedMonthlyCharge for that date.
const resolveRateVersion = (tariff: Tariff, date: Date): { periods: TariffPeriod[], fixedMonthlyCharge: number } => {
  if (tariff.rateHistory) {
    for (const version of tariff.rateHistory) {
      if (date < new Date(version.effectiveBefore)) {
        return { periods: version.periods, fixedMonthlyCharge: version.fixedMonthlyCharge };
      }
    }
  }
  // Default: current rates (in tariff.periods / tariff.fixedMonthlyCharge)
  return { periods: tariff.periods, fixedMonthlyCharge: tariff.fixedMonthlyCharge };
};

export const calculateDetailedCost = (readings: EnergyReading[], tariff: Tariff): { totalCost: number, breakdown: MonthlyBreakdown[] } => {
  const periodMap: Record<string, { usage: number, cost: number }> = {};
  let totalCost = 0;

  // Cache resolved rate versions per month to avoid re-resolving for every reading
  const rateVersionCache: Record<string, { periods: TariffPeriod[], fixedMonthlyCharge: number }> = {};

  // Tiered pricing state for E-1 (Simple monthly reset simulation)
  let monthlyUsageCounter = 0;
  let currentMonth = -1;

  readings.forEach(reading => {
    const date = reading.timestamp;

    // Period keys for grouping - use padded month for correct sorting
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    // Resolve rate version for this month (cached)
    if (!rateVersionCache[monthKey]) {
      rateVersionCache[monthKey] = resolveRateVersion(tariff, date);
    }
    const { periods, fixedMonthlyCharge } = rateVersionCache[monthKey];

    // Reset tiered usage if month changes
    if (date.getMonth() !== currentMonth) {
      monthlyUsageCounter = 0;
      currentMonth = date.getMonth();
    }

    if (!periodMap[monthKey]) {
      periodMap[monthKey] = { usage: 0, cost: 0 };
    }

    let rate = 0;
    const hour = date.getHours();
    const month = date.getMonth();

    if (tariff.type === 'flat' || tariff.type === 'tiered') {
      // PG&E-style tiered pricing with seasonal baseline
      // Summer (Jun-Sep): ~270 kWh baseline, Winter: ~350 kWh baseline
      const isSummer = isSummerMonth(month);
      const baseline = isSummer ? 270 : 350;

      // Use seasonal base rate from resolved periods
      const baseRate = getEffectiveRate(periods[0], month);
      // Tier 1: up to baseline at base rate
      // Tier 2: above baseline at ~1.24x (reflects E-1 Tier 2 at ~47¢ vs Tier 1 ~38¢)
      if (monthlyUsageCounter < baseline) {
        rate = baseRate;
      } else {
        rate = baseRate * (tariff.tier2Multiplier ?? 1.24);
      }
    } else {
      const period = periods.find(p => {
        if (p.startHour <= p.endHour) {
          return hour >= p.startHour && hour <= p.endHour;
        } else {
          return hour >= p.startHour || hour <= p.endHour;
        }
      });
      rate = period ? getEffectiveRate(period, month) : getEffectiveRate(periods[0], month);
    }

    const energyCost = reading.value * rate;
    periodMap[monthKey].usage += reading.value;
    periodMap[monthKey].cost += energyCost;
    monthlyUsageCounter += reading.value;
    totalCost += energyCost;
  });

  const breakdown: MonthlyBreakdown[] = Object.keys(periodMap).map(key => {
    const data = periodMap[key];
    const fixed = rateVersionCache[key]?.fixedMonthlyCharge ?? tariff.fixedMonthlyCharge;
    return {
      monthName: key,
      usage: data.usage,
      cost: data.cost + fixed
    };
  }).sort((a, b) => b.monthName.localeCompare(a.monthName)); // Show newest months first

  const totalFixedCharges = Object.keys(periodMap).reduce((sum, key) => {
    return sum + (rateVersionCache[key]?.fixedMonthlyCharge ?? tariff.fixedMonthlyCharge);
  }, 0);
  const totalWithFixed = totalCost + totalFixedCharges;

  return { totalCost: totalWithFixed, breakdown };
};

// Returns PG&E delivery-only cost per calendar month (for NEM True-Up tracking).
// Only meaningful for tariffs with deliveryRate defined on periods.
export const calculateMonthlyDeliveryCost = (readings: EnergyReading[], tariff: Tariff): Record<string, number> => {
  const monthly: Record<string, number> = {};
  const rateVersionCache: Record<string, { periods: TariffPeriod[], fixedMonthlyCharge: number }> = {};

  readings.forEach(reading => {
    const date = reading.timestamp;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const hour = date.getHours();
    const month = date.getMonth();

    // Resolve rate version for this month (cached)
    if (!rateVersionCache[monthKey]) {
      rateVersionCache[monthKey] = resolveRateVersion(tariff, date);
    }
    const { periods } = rateVersionCache[monthKey];

    let dr = 0;
    if (tariff.type === 'flat' || tariff.type === 'tiered') {
      const p = periods[0];
      dr = (p.deliverySummerRate != null && isSummerMonth(month)) ? p.deliverySummerRate : (p.deliveryRate ?? 0);
    } else {
      const period = periods.find(p =>
        p.startHour <= p.endHour ? (hour >= p.startHour && hour <= p.endHour) : (hour >= p.startHour || hour <= p.endHour)
      );
      if (period) {
        dr = (period.deliverySummerRate != null && isSummerMonth(month)) ? period.deliverySummerRate : (period.deliveryRate ?? 0);
      }
    }

    monthly[monthKey] = (monthly[monthKey] ?? 0) + reading.value * dr;
  });

  return monthly;
};

// Returns gross grid consumption per month (sum of POSITIVE readings only).
// NEM non-bypassable charges apply to every kWh consumed, even in net-export months.
export const calculateMonthlyGrossConsumption = (readings: EnergyReading[]): Record<string, number> => {
  const monthly: Record<string, number> = {};
  readings.forEach(reading => {
    if (reading.value > 0) {
      const d = reading.timestamp;
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[mk] = (monthly[mk] ?? 0) + reading.value;
    }
  });
  return monthly;
};

// Helper: extract total fixed charges from breakdown (each month's cost includes its fixed charge)
// breakdown cost = energy + fixed, and we sum the energy portions from periodMap, so:
// totalFixed = totalCost - (sum of energy-only costs)
// But simpler: just sum the per-month fixed charges by resolving rate versions.
const getTotalFixedCharges = (readings: EnergyReading[], tariff: Tariff): number => {
  const months = new Set<string>();
  const rateCache: Record<string, number> = {};
  readings.forEach(r => {
    const d = r.timestamp;
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months.has(mk)) {
      months.add(mk);
      rateCache[mk] = resolveRateVersion(tariff, d).fixedMonthlyCharge;
    }
  });
  return Array.from(months).reduce((sum, mk) => sum + rateCache[mk], 0);
};

export const compareTariffs = (readings: EnergyReading[], currentTariffId: string, allTariffs: Tariff[]): ComparisonResult[] => {
  if (readings.length === 0) return [];

  const currentTariff = allTariffs.find(t => t.id === currentTariffId) || allTariffs[0];
  const currentCalc = calculateDetailedCost(readings, currentTariff);

  const msInReadings = readings[readings.length - 1].timestamp.getTime() - readings[0].timestamp.getTime();
  const daysInReadings = Math.max(0.1, msInReadings / (1000 * 60 * 60 * 24));
  const monthMultiplier = 30 / daysInReadings;

  // Separate energy cost from fixed charges for proper scaling
  const currentTotalFixed = getTotalFixedCharges(readings, currentTariff);
  const currentEnergyOnly = currentCalc.totalCost - currentTotalFixed;
  // Use current (latest) fixed charge for monthly estimate going forward
  const currentMonthlyEstimate = (currentEnergyOnly * monthMultiplier) + currentTariff.fixedMonthlyCharge;

  return allTariffs.map(t => {
    const calc = calculateDetailedCost(readings, t);
    const totalFixed = getTotalFixedCharges(readings, t);
    const energyCostOnly = calc.totalCost - totalFixed;
    // Use current (latest) fixed charge for monthly estimate going forward
    const estimatedMonthlyCost = (energyCostOnly * monthMultiplier) + t.fixedMonthlyCharge;

    return {
      tariffId: t.id,
      tariffName: t.name,
      totalUsage: readings.reduce((s, r) => s + r.value, 0),
      totalCost: calc.totalCost,
      estimatedMonthlyCost,
      savingsVsCurrent: currentMonthlyEstimate - estimatedMonthlyCost,
      breakdown: calc.breakdown
    };
  });
};
