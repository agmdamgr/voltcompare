
import { Tariff, LoadPreset, GasTariff } from './types';

export const DEFAULT_TARIFFS: Tariff[] = [
  // ============ PG&E Bundled Rates (Jan 2026) ============
  // Summer = Jun-Sep, Winter = Oct-May. rate = winter, summerRate = summer.
  {
    id: 'pge-e1',
    name: 'PG&E E-1 (Tiered)',
    description: 'Standard residential rate. Tier 1 (baseline) ~38¢, Tier 2 (above) ~47¢.',
    type: 'flat',
    fixedMonthlyCharge: 0,
    provider: 'pge-bundled',
    periods: [
      { name: 'Baseline Average', startHour: 0, endHour: 23, rate: 0.38, summerRate: 0.40 }
    ]
  },
  {
    id: 'pge-tou-c',
    name: 'PG&E TOU-C (4-9 PM)',
    description: 'Standard Time-of-Use plan. Peak hours are 4–9 PM every day. Summer rates higher.',
    type: 'tou',
    fixedMonthlyCharge: 0,
    provider: 'pge-bundled',
    periods: [
      { name: 'Peak', startHour: 16, endHour: 20, rate: 0.46, summerRate: 0.55 },
      { name: 'Off-Peak', startHour: 21, endHour: 15, rate: 0.39, summerRate: 0.47 }
    ]
  },
  {
    id: 'pge-ev2a',
    name: 'PG&E EV2-A (EV & Battery)',
    description: 'Best for EV owners. Cheapest overnight rates. Summer peak is steep.',
    type: 'tou',
    fixedMonthlyCharge: 0,
    provider: 'pge-bundled',
    periods: [
      { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.47, summerRate: 0.61 },
      { name: 'Partial-Peak (3-4 PM, 9-12 AM)', startHour: 15, endHour: 15, rate: 0.42, summerRate: 0.50 },
      { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.42, summerRate: 0.50 },
      { name: 'Off-Peak (12 AM-3 PM)', startHour: 0, endHour: 14, rate: 0.30, summerRate: 0.30 }
    ]
  },
  {
    id: 'pge-e-home',
    name: 'PG&E E-ELEC (E-Home)',
    description: 'For electrified homes with heat pumps or batteries. $15/mo fixed charge.',
    type: 'tou',
    fixedMonthlyCharge: 15,
    provider: 'pge-bundled',
    periods: [
      { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.42, summerRate: 0.55 },
      { name: 'Partial-Peak', startHour: 15, endHour: 15, rate: 0.37, summerRate: 0.44 },
      { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.37, summerRate: 0.44 },
      { name: 'Off-Peak', startHour: 0, endHour: 14, rate: 0.30, summerRate: 0.34 }
    ]
  },

  // ============ MCE Light Green + PG&E Delivery (Jan 2026) ============
  // MCE generation is ~1-2¢ cheaper than PG&E bundled gen. Delivery is same PG&E component.
  {
    id: 'mce-e1',
    name: 'MCE Light Green E-1',
    description: 'MCE 60% renewable generation + PG&E delivery. Standard tiered rate.',
    type: 'flat',
    fixedMonthlyCharge: 0,
    provider: 'mce-pge',
    periods: [
      { name: 'Baseline Average', startHour: 0, endHour: 23, rate: 0.37, summerRate: 0.39 }
    ]
  },
  {
    id: 'mce-tou-c',
    name: 'MCE Light Green TOU-C',
    description: 'MCE 60% renewable + PG&E delivery. Peak 4-9 PM daily.',
    type: 'tou',
    fixedMonthlyCharge: 0,
    provider: 'mce-pge',
    periods: [
      { name: 'Peak', startHour: 16, endHour: 20, rate: 0.44, summerRate: 0.53 },
      { name: 'Off-Peak', startHour: 21, endHour: 15, rate: 0.38, summerRate: 0.45 }
    ]
  },
  {
    id: 'mce-ev2a',
    name: 'MCE Light Green EV2-A',
    description: 'MCE 60% renewable + PG&E delivery. Best for EV owners.',
    type: 'tou',
    fixedMonthlyCharge: 0,
    provider: 'mce-pge',
    periods: [
      { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.45, summerRate: 0.59 },
      { name: 'Partial-Peak (3-4 PM, 9-12 AM)', startHour: 15, endHour: 15, rate: 0.40, summerRate: 0.48 },
      { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.40, summerRate: 0.48 },
      { name: 'Off-Peak (12 AM-3 PM)', startHour: 0, endHour: 14, rate: 0.28, summerRate: 0.28 }
    ]
  },
  {
    id: 'mce-e-elec',
    name: 'MCE Light Green E-ELEC',
    description: 'MCE 60% renewable + PG&E delivery. For electrified homes. $15/mo fixed.',
    type: 'tou',
    fixedMonthlyCharge: 15,
    provider: 'mce-pge',
    periods: [
      { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.40, summerRate: 0.53 },
      { name: 'Partial-Peak', startHour: 15, endHour: 15, rate: 0.35, summerRate: 0.42 },
      { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.35, summerRate: 0.42 },
      { name: 'Off-Peak', startHour: 0, endHour: 14, rate: 0.28, summerRate: 0.32 }
    ]
  },

  // ============ MCE Deep Green (100% Renewable) ============
  {
    id: 'mce-deep-tou-c',
    name: 'MCE Deep Green TOU-C',
    description: 'MCE 100% renewable + PG&E delivery. +$0.01/kWh vs Light Green.',
    type: 'tou',
    fixedMonthlyCharge: 0,
    provider: 'mce-pge',
    periods: [
      { name: 'Peak', startHour: 16, endHour: 20, rate: 0.45, summerRate: 0.54 },
      { name: 'Off-Peak', startHour: 21, endHour: 15, rate: 0.39, summerRate: 0.46 }
    ]
  },
  {
    id: 'mce-deep-ev2a',
    name: 'MCE Deep Green EV2-A',
    description: 'MCE 100% renewable + PG&E delivery. Best for eco-conscious EV owners.',
    type: 'tou',
    fixedMonthlyCharge: 0,
    provider: 'mce-pge',
    periods: [
      { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.46, summerRate: 0.60 },
      { name: 'Partial-Peak (3-4 PM, 9-12 AM)', startHour: 15, endHour: 15, rate: 0.41, summerRate: 0.49 },
      { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.41, summerRate: 0.49 },
      { name: 'Off-Peak (12 AM-3 PM)', startHour: 0, endHour: 14, rate: 0.29, summerRate: 0.29 }
    ]
  }
];

export const UTILITY_PARTNERS = [
  { name: 'PG&E', region: 'Northern/Central California' },
  { name: 'MCE (Marin Clean Energy)', region: 'Marin, Napa, Solano, Contra Costa' },
  { name: 'SCE', region: 'Southern California' },
  { name: 'SDG&E', region: 'San Diego' }
];

// ============ PG&E Gas Tariff ============
// Gas rates are simpler - tiered based on baseline allocation
// Baseline varies by climate zone (using Bay Area average)
export const DEFAULT_GAS_TARIFF: GasTariff = {
  id: 'pge-g1',
  name: 'PG&E G-1 (Residential Gas)',
  description: 'Standard residential gas rate. Tiered based on baseline allocation.',
  baselineRate: 2.516,        // $/therm for baseline usage (as of 2024)
  overBaselineRate: 3.014,    // $/therm for usage over baseline
  baselineTherms: 32,         // Monthly baseline (varies by climate zone, using Zone T avg)
  fixedMonthlyCharge: 18.68   // Monthly service charge
};

// Simulated load presets with realistic usage patterns
// hourlyPattern: 24 values (hours 0-23) representing % of daily usage per hour (should sum to 1.0)
// seasonalMultiplier: [winter, spring, summer, fall] multipliers
export const LOAD_PRESETS: LoadPreset[] = [
  {
    id: 'ev-standard',
    name: 'Electric Vehicle',
    icon: 'fa-car',
    description: '~12,000 mi/year, charging overnight (optimal for TOU)',
    monthlyKwh: 300,
    // Charges 10 PM - 6 AM (off-peak)
    hourlyPattern: [
      0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.04, 0.00, // 12am-7am
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, // 8am-3pm
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.12, 0.12  // 4pm-11pm
    ],
    seasonalMultiplier: [1.1, 1.0, 0.95, 1.0] // Slightly higher in winter (heating)
  },
  {
    id: 'ev-heavy',
    name: 'EV (Heavy Use)',
    icon: 'fa-truck-pickup',
    description: '~18,000 mi/year or electric truck, overnight charging',
    monthlyKwh: 500,
    hourlyPattern: [
      0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.04, 0.00,
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.12, 0.12
    ],
    seasonalMultiplier: [1.15, 1.0, 0.9, 1.0]
  },
  {
    id: 'heat-pump-hvac',
    name: 'Heat Pump HVAC',
    icon: 'fa-wind',
    description: 'Whole-home heating & cooling, replaces gas furnace + AC',
    monthlyKwh: 350,
    // Runs during occupied hours, peak in morning/evening
    hourlyPattern: [
      0.02, 0.02, 0.02, 0.02, 0.02, 0.03, 0.05, 0.06, // 12am-7am
      0.05, 0.04, 0.03, 0.03, 0.03, 0.04, 0.05, 0.06, // 8am-3pm
      0.07, 0.07, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02  // 4pm-11pm
    ],
    seasonalMultiplier: [1.8, 0.4, 1.5, 0.5], // High winter/summer, low spring/fall
    replacesGasTherms: 35,  // Average monthly gas furnace usage
    replacesGasAppliance: 'gas furnace'
  },
  {
    id: 'heat-pump-water',
    name: 'Heat Pump Water Heater',
    icon: 'fa-hot-tub-person',
    description: 'Efficient electric water heating, ~3x more efficient than resistance',
    monthlyKwh: 80,
    // Runs early morning and late evening (can be scheduled off-peak)
    hourlyPattern: [
      0.08, 0.08, 0.06, 0.04, 0.04, 0.06, 0.08, 0.06, // 12am-7am
      0.04, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.04, // 8am-3pm
      0.04, 0.04, 0.04, 0.06, 0.06, 0.04, 0.04, 0.08  // 4pm-11pm
    ],
    seasonalMultiplier: [1.3, 1.0, 0.8, 1.0], // Higher in winter
    replacesGasTherms: 20,  // Average monthly gas water heater usage
    replacesGasAppliance: 'gas water heater'
  },
  {
    id: 'pool-pump',
    name: 'Pool Pump',
    icon: 'fa-person-swimming',
    description: 'Variable speed pump, ~6 hrs/day (can schedule off-peak)',
    monthlyKwh: 100,
    // Runs mid-day (can be optimized for solar or off-peak)
    hourlyPattern: [
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, // 12am-7am
      0.08, 0.12, 0.14, 0.14, 0.14, 0.12, 0.10, 0.08, // 8am-3pm
      0.04, 0.02, 0.02, 0.00, 0.00, 0.00, 0.00, 0.00  // 4pm-11pm
    ],
    seasonalMultiplier: [0.3, 0.8, 1.5, 0.8] // Mostly summer
  },
  {
    id: 'electric-dryer',
    name: 'Electric Dryer',
    icon: 'fa-shirt',
    description: 'Standard electric dryer, ~4 loads/week',
    monthlyKwh: 50,
    // Evening/weekend usage
    hourlyPattern: [
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.02, // 12am-7am
      0.04, 0.06, 0.08, 0.08, 0.06, 0.04, 0.04, 0.04, // 8am-3pm
      0.06, 0.08, 0.10, 0.10, 0.08, 0.06, 0.04, 0.02  // 4pm-11pm
    ],
    seasonalMultiplier: [1.1, 1.0, 0.9, 1.0] // Slightly higher in winter
  },
  {
    id: 'induction-range',
    name: 'Induction Range',
    icon: 'fa-fire-burner',
    description: 'Electric induction cooktop + oven, replaces gas range',
    monthlyKwh: 30,
    // Meal times
    hourlyPattern: [
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.02, 0.08, // 12am-7am
      0.06, 0.02, 0.02, 0.04, 0.08, 0.04, 0.02, 0.02, // 8am-3pm
      0.04, 0.10, 0.14, 0.14, 0.10, 0.04, 0.02, 0.02  // 4pm-11pm
    ],
    seasonalMultiplier: [1.1, 1.0, 0.9, 1.0],
    replacesGasTherms: 3,  // Average monthly gas stove usage
    replacesGasAppliance: 'gas stove'
  },
  {
    id: 'hot-tub',
    name: 'Hot Tub / Spa',
    icon: 'fa-bath',
    description: 'Electric hot tub with cover, maintained at temp',
    monthlyKwh: 200,
    // Mostly heating overnight to maintain temp
    hourlyPattern: [
      0.06, 0.06, 0.06, 0.06, 0.05, 0.04, 0.03, 0.02, // 12am-7am
      0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.03, // 8am-3pm
      0.04, 0.05, 0.06, 0.08, 0.08, 0.08, 0.08, 0.06  // 4pm-11pm
    ],
    seasonalMultiplier: [1.4, 1.0, 0.6, 1.0] // Much higher in winter
  }
];
