import { GasReading, GasTariff, GasComparisonResult, MonthlyBreakdown } from '../types';

export interface GasDetailedCost {
  totalTherms: number;
  totalCost: number;
  baselineTherms: number;
  overBaselineTherms: number;
  baselineCost: number;
  overBaselineCost: number;
  fixedCharges: number;
}

export const calculateGasCost = (
  readings: GasReading[],
  tariff: GasTariff
): GasDetailedCost => {
  if (readings.length === 0) {
    return {
      totalTherms: 0,
      totalCost: 0,
      baselineTherms: 0,
      overBaselineTherms: 0,
      baselineCost: 0,
      overBaselineCost: 0,
      fixedCharges: 0
    };
  }

  // Group readings by month
  const monthlyUsage = new Map<string, number>();

  for (const reading of readings) {
    const monthKey = `${reading.timestamp.getFullYear()}-${String(reading.timestamp.getMonth() + 1).padStart(2, '0')}`;
    monthlyUsage.set(monthKey, (monthlyUsage.get(monthKey) ?? 0) + reading.value);
  }

  let totalTherms = 0;
  let baselineTherms = 0;
  let overBaselineTherms = 0;
  let baselineCost = 0;
  let overBaselineCost = 0;
  const numMonths = monthlyUsage.size;

  for (const [, usage] of monthlyUsage) {
    totalTherms += usage;

    const baseline = Math.min(usage, tariff.baselineTherms);
    const overBaseline = Math.max(0, usage - tariff.baselineTherms);

    baselineTherms += baseline;
    overBaselineTherms += overBaseline;
    baselineCost += baseline * tariff.baselineRate;
    overBaselineCost += overBaseline * tariff.overBaselineRate;
  }

  const fixedCharges = numMonths * tariff.fixedMonthlyCharge;
  const totalCost = baselineCost + overBaselineCost + fixedCharges;

  return {
    totalTherms,
    totalCost,
    baselineTherms,
    overBaselineTherms,
    baselineCost,
    overBaselineCost,
    fixedCharges
  };
};

export const calculateGasMonthlyBreakdown = (
  readings: GasReading[],
  tariff: GasTariff
): MonthlyBreakdown[] => {
  if (readings.length === 0) return [];

  // Group readings by month
  const monthlyData = new Map<string, GasReading[]>();

  for (const reading of readings) {
    const monthKey = `${reading.timestamp.getFullYear()}-${String(reading.timestamp.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, []);
    }
    monthlyData.get(monthKey)!.push(reading);
  }

  const breakdown: MonthlyBreakdown[] = [];

  for (const [monthName, monthReadings] of monthlyData) {
    const usage = monthReadings.reduce((sum, r) => sum + r.value, 0);

    // Calculate cost for this month
    const baseline = Math.min(usage, tariff.baselineTherms);
    const overBaseline = Math.max(0, usage - tariff.baselineTherms);
    const cost = (baseline * tariff.baselineRate) +
                 (overBaseline * tariff.overBaselineRate) +
                 tariff.fixedMonthlyCharge;

    breakdown.push({ monthName, usage, cost });
  }

  // Sort by month
  breakdown.sort((a, b) => a.monthName.localeCompare(b.monthName));

  return breakdown;
};

export const calculateGasComparison = (
  readings: GasReading[],
  tariff: GasTariff
): GasComparisonResult => {
  const breakdown = calculateGasMonthlyBreakdown(readings, tariff);
  const totalUsage = breakdown.reduce((sum, m) => sum + m.usage, 0);
  const totalCost = breakdown.reduce((sum, m) => sum + m.cost, 0);
  const estimatedMonthlyCost = breakdown.length > 0 ? totalCost / breakdown.length : 0;

  return {
    tariffId: tariff.id,
    tariffName: tariff.name,
    totalUsage,
    totalCost,
    estimatedMonthlyCost,
    breakdown
  };
};

// Calculate estimated monthly gas savings from electrification
export const calculateGasSavingsFromElectrification = (
  enabledLoads: Array<{ replacesGasTherms?: number; replacesGasAppliance?: string }>,
  tariff: GasTariff
): { monthlySavings: number; monthlyThermsOffset: number; appliances: string[] } => {
  let monthlyThermsOffset = 0;
  const appliances: string[] = [];

  for (const load of enabledLoads) {
    if (load.replacesGasTherms && load.replacesGasTherms > 0) {
      monthlyThermsOffset += load.replacesGasTherms;
      if (load.replacesGasAppliance) {
        appliances.push(load.replacesGasAppliance);
      }
    }
  }

  // Calculate average cost per therm (weighted toward baseline rate since most usage is baseline)
  const avgRate = (tariff.baselineRate + tariff.overBaselineRate) / 2;
  const monthlySavings = monthlyThermsOffset * avgRate;

  return { monthlySavings, monthlyThermsOffset, appliances };
};
