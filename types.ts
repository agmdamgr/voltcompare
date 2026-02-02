
export interface EnergyReading {
  timestamp: Date;
  value: number; // in kWh
}

export interface TariffPeriod {
  name: string;
  startHour: number; // 0-23
  endHour: number;   // 0-23
  rate: number;      // price per kWh
}

export interface Tariff {
  id: string;
  name: string;
  description: string;
  type: 'flat' | 'tou' | 'tiered';
  periods: TariffPeriod[];
  fixedMonthlyCharge: number;
  provider?: 'pge-bundled' | 'mce-pge';
}

export interface MonthlyBreakdown {
  monthName: string;
  usage: number;
  cost: number;
}

export interface ComparisonResult {
  tariffId: string;
  tariffName: string;
  totalUsage: number;
  totalCost: number;
  estimatedMonthlyCost: number;
  savingsVsCurrent: number;
  breakdown: MonthlyBreakdown[];
}

export type TimePeriod = 'day' | 'week' | 'month' | 'year';

export interface SimulatedLoad {
  id: string;
  name: string;
  icon: string;
  description: string;
  monthlyKwh: number;
  // Usage pattern: array of 24 values (0-23 hours) representing % of daily usage per hour
  hourlyPattern: number[];
  // Seasonal multiplier: [winter, spring, summer, fall] (Dec-Feb, Mar-May, Jun-Aug, Sep-Nov)
  seasonalMultiplier: number[];
  enabled: boolean;
  // If this load replaces a gas appliance
  replacesGasTherms?: number;
  replacesGasAppliance?: string;
}

export interface LoadPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  monthlyKwh: number;
  hourlyPattern: number[];
  seasonalMultiplier: number[];
  // If this load replaces a gas appliance, how many therms/month it offsets
  replacesGasTherms?: number;
  replacesGasAppliance?: string; // e.g., "gas furnace", "gas water heater", "gas stove"
}

// ============ Gas Types ============

export interface GasReading {
  timestamp: Date;
  value: number; // in therms
}

export interface GasTariff {
  id: string;
  name: string;
  description: string;
  // PG&E gas is tiered based on baseline allocation
  baselineRate: number;      // $/therm for baseline usage
  overBaselineRate: number;  // $/therm for usage above baseline
  baselineTherms: number;    // Monthly baseline allocation (varies by climate zone, ~25-50 therms)
  fixedMonthlyCharge: number;
}

export interface GasComparisonResult {
  tariffId: string;
  tariffName: string;
  totalUsage: number;      // therms
  totalCost: number;
  estimatedMonthlyCost: number;
  breakdown: MonthlyBreakdown[];
}
