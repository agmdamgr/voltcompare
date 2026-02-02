
import { EnergyReading, Tariff, ComparisonResult, MonthlyBreakdown } from '../types';

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

    if (tariff.type === 'flat' || tariff.type === 'tiered') {
      // PG&E-style tiered pricing with seasonal baseline
      // Summer (Jun-Sep): ~270 kWh baseline, Winter: ~350 kWh baseline
      const month = date.getMonth();
      const isSummer = month >= 5 && month <= 8;
      const baseline = isSummer ? 270 : 350;

      // Tier 1: up to baseline at base rate
      // Tier 2: 101-400% of baseline at ~1.28x
      // Tier 3: over 400% of baseline at ~1.45x (high usage penalty)
      const baseRate = tariff.periods[0].rate;
      if (monthlyUsageCounter < baseline) {
        rate = baseRate;
      } else if (monthlyUsageCounter < baseline * 4) {
        rate = baseRate * 1.28;
      } else {
        rate = baseRate * 1.45;
      }
    } else {
      const period = tariff.periods.find(p => {
        if (p.startHour <= p.endHour) {
          return hour >= p.startHour && hour <= p.endHour;
        } else {
          return hour >= p.startHour || hour <= p.endHour;
        }
      });
      rate = period ? period.rate : tariff.periods[0].rate;
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
