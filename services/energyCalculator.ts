
import { EnergyReading, Tariff, TariffPeriod, ComparisonResult, MonthlyBreakdown } from '../types';

// PG&E summer = Jun-Sep (months 5-8), winter = Oct-May
const isSummerMonth = (month: number) => month >= 5 && month <= 8;

const getEffectiveRate = (period: TariffPeriod, month: number): number => {
  if (period.summerRate != null && isSummerMonth(month)) {
    return period.summerRate;
  }
  return period.rate;
};

export const calculateDetailedCost = (readings: EnergyReading[], tariff: Tariff): { totalCost: number, breakdown: MonthlyBreakdown[] } => {
  const periodMap: Record<string, { usage: number, cost: number }> = {};
  let totalCost = 0;

  // Tiered pricing state for E-1 (Simple monthly reset simulation)
  let monthlyUsageCounter = 0;
  let currentMonth = -1;

  readings.forEach(reading => {
    const date = reading.timestamp;

    // Period keys for grouping - use padded month for correct sorting
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

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

      // Use seasonal base rate
      const baseRate = getEffectiveRate(tariff.periods[0], month);
      // Tier 1: up to baseline at base rate
      // Tier 2: above baseline at ~1.24x (reflects E-1 Tier 2 at ~47¢ vs Tier 1 ~38¢)
      if (monthlyUsageCounter < baseline) {
        rate = baseRate;
      } else {
        rate = baseRate * 1.24;
      }
    } else {
      const period = tariff.periods.find(p => {
        if (p.startHour <= p.endHour) {
          return hour >= p.startHour && hour <= p.endHour;
        } else {
          return hour >= p.startHour || hour <= p.endHour;
        }
      });
      rate = period ? getEffectiveRate(period, month) : getEffectiveRate(tariff.periods[0], month);
    }

    const energyCost = reading.value * rate;
    periodMap[monthKey].usage += reading.value;
    periodMap[monthKey].cost += energyCost;
    monthlyUsageCounter += reading.value;
    totalCost += energyCost;
  });

  const breakdown: MonthlyBreakdown[] = Object.keys(periodMap).map(key => {
    const data = periodMap[key];
    return {
      monthName: key,
      usage: data.usage,
      cost: data.cost + tariff.fixedMonthlyCharge
    };
  }).sort((a, b) => b.monthName.localeCompare(a.monthName)); // Show newest months first

  const totalWithFixed = totalCost + (breakdown.length * tariff.fixedMonthlyCharge);

  return { totalCost: totalWithFixed, breakdown };
};

export const compareTariffs = (readings: EnergyReading[], currentTariffId: string, allTariffs: Tariff[]): ComparisonResult[] => {
  if (readings.length === 0) return [];

  const currentTariff = allTariffs.find(t => t.id === currentTariffId) || allTariffs[0];
  const currentCalc = calculateDetailedCost(readings, currentTariff);

  const msInReadings = readings[readings.length - 1].timestamp.getTime() - readings[0].timestamp.getTime();
  const daysInReadings = Math.max(0.1, msInReadings / (1000 * 60 * 60 * 24));
  const monthMultiplier = 30 / daysInReadings;

  // Separate energy cost from fixed charges for proper scaling
  const currentEnergyOnly = currentCalc.totalCost - (currentCalc.breakdown.length * currentTariff.fixedMonthlyCharge);
  const currentMonthlyEstimate = (currentEnergyOnly * monthMultiplier) + currentTariff.fixedMonthlyCharge;

  return allTariffs.map(t => {
    const calc = calculateDetailedCost(readings, t);
    // Scale only energy costs, then add fixed charge once for monthly estimate
    const energyCostOnly = calc.totalCost - (calc.breakdown.length * t.fixedMonthlyCharge);
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
