
import { Tariff, LoadPreset, GasTariff } from './types';

export const DEFAULT_TARIFFS: Tariff[] = [
  // ============ PG&E Bundled Rates — March 2026 ============
  // PG&E restructured ALL residential rates effective March 1, 2026:
  //   - New ~$24/month Base Services Charge (BSC) on every plan
  //   - Per-kWh rates lowered ~$0.05-0.07/kWh across the board
  //   - Residential bundled rates ~13% lower than Jan 2024
  // Winter = Oct-May, Summer = Jun-Sep. rate = winter, summerRate = summer.
  //
  // EV2-A Mar 2026 rates confirmed via PG&E rate schedule:
  //   Winter: Peak 41¢, Partial-Peak 39¢, Off-Peak 23¢
  //   Summer: Peak 54¢, Partial-Peak 43¢, Off-Peak 23¢
  // E-1, E-TOU-C, E-ELEC: estimated from same ~7¢ delivery reduction — verify against your bill.
  {
    id: 'pge-e1',
    name: 'PG&E E-1 (Tiered)',
    description: 'Standard residential tiered rate. Tier 1 ~31¢, Tier 2 ~38¢. $24/mo BSC.',
    type: 'flat',
    fixedMonthlyCharge: 24,
    provider: 'pge-bundled',
    periods: [
      { name: 'Baseline Average', startHour: 0, endHour: 23, rate: 0.31, summerRate: 0.33 }
    ],
    rateHistory: [{
      effectiveBefore: '2026-03-01',
      fixedMonthlyCharge: 0,
      periods: [
        { name: 'Baseline Average', startHour: 0, endHour: 23, rate: 0.38, summerRate: 0.40 }
      ]
    }]
  },
  {
    id: 'pge-tou-c',
    name: 'PG&E TOU-C (4-9 PM)',
    description: 'Standard TOU. Peak 4–9 PM daily. $24/mo BSC.',
    type: 'tou',
    fixedMonthlyCharge: 24,
    provider: 'pge-bundled',
    periods: [
      { name: 'Peak', startHour: 16, endHour: 20, rate: 0.39, summerRate: 0.48 },
      { name: 'Off-Peak', startHour: 21, endHour: 15, rate: 0.32, summerRate: 0.40 }
    ],
    rateHistory: [{
      effectiveBefore: '2026-03-01',
      fixedMonthlyCharge: 0,
      periods: [
        { name: 'Peak', startHour: 16, endHour: 20, rate: 0.46, summerRate: 0.55 },
        { name: 'Off-Peak', startHour: 21, endHour: 15, rate: 0.39, summerRate: 0.47 }
      ]
    }]
  },
  {
    id: 'pge-ev2a',
    name: 'PG&E EV2-A (EV & Battery)',
    description: 'Best for EV owners. Cheapest overnight. $24/mo BSC. Mar 2026 rates confirmed.',
    type: 'tou',
    fixedMonthlyCharge: 24,
    provider: 'pge-bundled',
    // deliveryRate = PG&E delivery-only component (estimated ~6¢ lower after BSC split)
    periods: [
      { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.41, summerRate: 0.54, deliveryRate: 0.155, deliverySummerRate: 0.225 },
      { name: 'Partial-Peak (3-4 PM, 9-12 AM)', startHour: 15, endHour: 15, rate: 0.39, summerRate: 0.43, deliveryRate: 0.140, deliverySummerRate: 0.155 },
      { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.39, summerRate: 0.43, deliveryRate: 0.140, deliverySummerRate: 0.155 },
      { name: 'Off-Peak (12 AM-3 PM)', startHour: 0, endHour: 14, rate: 0.23, summerRate: 0.23, deliveryRate: 0.065, deliverySummerRate: 0.055 }
    ],
    rateHistory: [{
      effectiveBefore: '2026-03-01',
      fixedMonthlyCharge: 0,
      periods: [
        { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.486, summerRate: 0.61, deliveryRate: 0.220, deliverySummerRate: 0.295 },
        { name: 'Partial-Peak (3-4 PM, 9-12 AM)', startHour: 15, endHour: 15, rate: 0.469, summerRate: 0.50, deliveryRate: 0.200, deliverySummerRate: 0.215 },
        { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.469, summerRate: 0.50, deliveryRate: 0.200, deliverySummerRate: 0.215 },
        { name: 'Off-Peak (12 AM-3 PM)', startHour: 0, endHour: 14, rate: 0.300, summerRate: 0.30, deliveryRate: 0.130, deliverySummerRate: 0.120 }
      ]
    }]
  },
  {
    id: 'pge-e-home',
    name: 'PG&E E-ELEC (E-Home)',
    description: 'For electrified homes. Lower per-kWh peak rates. $24/mo BSC (was $15). Estimated.',
    type: 'tou',
    fixedMonthlyCharge: 24,
    provider: 'pge-bundled',
    // E-ELEC rates estimated: same ~7¢ reduction as EV2-A. Verify against your bill.
    periods: [
      { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.35, summerRate: 0.48 },
      { name: 'Partial-Peak', startHour: 15, endHour: 15, rate: 0.30, summerRate: 0.37 },
      { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.30, summerRate: 0.37 },
      { name: 'Off-Peak', startHour: 0, endHour: 14, rate: 0.23, summerRate: 0.27 }
    ],
    rateHistory: [{
      effectiveBefore: '2026-03-01',
      fixedMonthlyCharge: 15,
      periods: [
        { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.42, summerRate: 0.55 },
        { name: 'Partial-Peak', startHour: 15, endHour: 15, rate: 0.37, summerRate: 0.44 },
        { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.37, summerRate: 0.44 },
        { name: 'Off-Peak', startHour: 0, endHour: 14, rate: 0.30, summerRate: 0.34 }
      ]
    }]
  },

  // ============ MCE Light Green + PG&E Delivery — March 2026 ============
  // Combined rates (MCE generation + PG&E delivery). MCE generation unchanged;
  // PG&E delivery dropped ~7¢/kWh with new $24/mo BSC (same charge for MCE customers).
  // MCE also proposed 14% generation rate reduction effective April 2026 — not yet reflected.
  // PCIA modeled at $0.021/kWh (varies by enrollment vintage).
  {
    id: 'mce-e1',
    name: 'MCE Light Green E-1',
    description: 'MCE 60% renewable + PG&E delivery. Tiered. $24/mo BSC.',
    type: 'flat',
    fixedMonthlyCharge: 24,
    provider: 'mce-pge',
    pciaRate: 0.021,
    periods: [
      { name: 'Baseline Average', startHour: 0, endHour: 23, rate: 0.30, summerRate: 0.32 }
    ],
    rateHistory: [{
      effectiveBefore: '2026-03-01',
      fixedMonthlyCharge: 0,
      periods: [
        { name: 'Baseline Average', startHour: 0, endHour: 23, rate: 0.37, summerRate: 0.39 }
      ]
    }]
  },
  {
    id: 'mce-tou-c',
    name: 'MCE Light Green TOU-C',
    description: 'MCE 60% renewable + PG&E delivery. Peak 4-9 PM. $24/mo BSC.',
    type: 'tou',
    fixedMonthlyCharge: 24,
    provider: 'mce-pge',
    pciaRate: 0.021,
    periods: [
      { name: 'Peak', startHour: 16, endHour: 20, rate: 0.37, summerRate: 0.46 },
      { name: 'Off-Peak', startHour: 21, endHour: 15, rate: 0.31, summerRate: 0.38 }
    ],
    rateHistory: [{
      effectiveBefore: '2026-03-01',
      fixedMonthlyCharge: 0,
      periods: [
        { name: 'Peak', startHour: 16, endHour: 20, rate: 0.44, summerRate: 0.53 },
        { name: 'Off-Peak', startHour: 21, endHour: 15, rate: 0.38, summerRate: 0.45 }
      ]
    }]
  },
  {
    id: 'mce-ev2a',
    name: 'MCE Light Green EV2-A',
    description: 'MCE 60% renewable + PG&E delivery. Best for EV. $24/mo BSC.',
    type: 'tou',
    fixedMonthlyCharge: 24,
    provider: 'mce-pge',
    pciaRate: 0.021,
    // deliveryRate = PG&E delivery-only component (estimated ~6¢ lower after BSC split)
    periods: [
      { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.416, summerRate: 0.52, deliveryRate: 0.155, deliverySummerRate: 0.225 },
      { name: 'Partial-Peak (3-4 PM, 9-12 AM)', startHour: 15, endHour: 15, rate: 0.399, summerRate: 0.41, deliveryRate: 0.140, deliverySummerRate: 0.155 },
      { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.399, summerRate: 0.41, deliveryRate: 0.140, deliverySummerRate: 0.155 },
      { name: 'Off-Peak (12 AM-3 PM)', startHour: 0, endHour: 14, rate: 0.23, summerRate: 0.21, deliveryRate: 0.065, deliverySummerRate: 0.055 }
    ],
    rateHistory: [{
      effectiveBefore: '2026-03-01',
      fixedMonthlyCharge: 0,
      periods: [
        { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.486, summerRate: 0.59, deliveryRate: 0.220, deliverySummerRate: 0.295 },
        { name: 'Partial-Peak (3-4 PM, 9-12 AM)', startHour: 15, endHour: 15, rate: 0.469, summerRate: 0.48, deliveryRate: 0.200, deliverySummerRate: 0.215 },
        { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.469, summerRate: 0.48, deliveryRate: 0.200, deliverySummerRate: 0.215 },
        { name: 'Off-Peak (12 AM-3 PM)', startHour: 0, endHour: 14, rate: 0.300, summerRate: 0.28, deliveryRate: 0.130, deliverySummerRate: 0.120 }
      ]
    }]
  },
  {
    id: 'mce-e-elec',
    name: 'MCE Light Green E-ELEC',
    description: 'MCE 60% renewable + PG&E delivery. Electrified homes. $24/mo BSC.',
    type: 'tou',
    fixedMonthlyCharge: 24,
    provider: 'mce-pge',
    pciaRate: 0.021,
    periods: [
      { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.33, summerRate: 0.46 },
      { name: 'Partial-Peak', startHour: 15, endHour: 15, rate: 0.28, summerRate: 0.35 },
      { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.28, summerRate: 0.35 },
      { name: 'Off-Peak', startHour: 0, endHour: 14, rate: 0.21, summerRate: 0.25 }
    ],
    rateHistory: [{
      effectiveBefore: '2026-03-01',
      fixedMonthlyCharge: 15,
      periods: [
        { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.40, summerRate: 0.53 },
        { name: 'Partial-Peak', startHour: 15, endHour: 15, rate: 0.35, summerRate: 0.42 },
        { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.35, summerRate: 0.42 },
        { name: 'Off-Peak', startHour: 0, endHour: 14, rate: 0.28, summerRate: 0.32 }
      ]
    }]
  },

  // ============ MCE Deep Green (100% Renewable) ============
  // Deep Green adds $0.0125/kWh premium on all usage vs Light Green.
  {
    id: 'mce-deep-tou-c',
    name: 'MCE Deep Green TOU-C',
    description: 'MCE 100% renewable + PG&E delivery. +$0.0125/kWh vs Light Green. $24/mo BSC.',
    type: 'tou',
    fixedMonthlyCharge: 24,
    provider: 'mce-pge',
    pciaRate: 0.021,
    periods: [
      { name: 'Peak', startHour: 16, endHour: 20, rate: 0.383, summerRate: 0.473 },
      { name: 'Off-Peak', startHour: 21, endHour: 15, rate: 0.323, summerRate: 0.393 }
    ],
    rateHistory: [{
      effectiveBefore: '2026-03-01',
      fixedMonthlyCharge: 0,
      periods: [
        { name: 'Peak', startHour: 16, endHour: 20, rate: 0.453, summerRate: 0.543 },
        { name: 'Off-Peak', startHour: 21, endHour: 15, rate: 0.393, summerRate: 0.463 }
      ]
    }]
  },
  // ============ SCE Rates (approx. Jan 2026 — verify against your SCE bill) ============
  {
    id: 'sce-domestic',
    name: 'SCE Domestic (Tiered)',
    description: 'Standard residential tiered rate. Tier 1 ~$0.25, Tier 2 ~$0.36.',
    type: 'tiered',
    fixedMonthlyCharge: 0,
    provider: 'sce-bundled',
    tier2Multiplier: 1.44,
    periods: [
      { name: 'Baseline', startHour: 0, endHour: 23, rate: 0.25, summerRate: 0.26 }
    ]
  },
  {
    id: 'sce-tou-d-4-9pm',
    name: 'SCE TOU-D-4-9PM',
    description: 'Time-of-use plan. Peak 4–9 PM daily. Good for flexible households.',
    type: 'tou',
    fixedMonthlyCharge: 0,
    provider: 'sce-bundled',
    periods: [
      { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.40, summerRate: 0.52 },
      { name: 'Off-Peak', startHour: 21, endHour: 15, rate: 0.30, summerRate: 0.27 }
    ]
  },
  {
    id: 'sce-tou-d-prime',
    name: 'SCE TOU-D-PRIME (EV)',
    description: 'Best for EV owners. Super off-peak 9 PM–8 AM at ~$0.13/kWh all year.',
    type: 'tou',
    fixedMonthlyCharge: 0,
    provider: 'sce-bundled',
    periods: [
      { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.42, summerRate: 0.53 },
      { name: 'Off-Peak (8 AM-4 PM)', startHour: 8, endHour: 15, rate: 0.26, summerRate: 0.27 },
      { name: 'Super Off-Peak (9 PM-8 AM)', startHour: 21, endHour: 7, rate: 0.13, summerRate: 0.13 }
    ]
  },

  // ============ SDG&E Rates (approx. Jan 2026 — verify against your SDG&E bill) ============
  // SDG&E has the highest electricity rates in CA — roughly 20-30% above PG&E.
  {
    id: 'sdge-dr',
    name: 'SDG&E DR (Tiered)',
    description: 'Standard residential tiered rate. Tier 1 ~$0.29, Tier 2 ~$0.43.',
    type: 'tiered',
    fixedMonthlyCharge: 0,
    provider: 'sdge-bundled',
    tier2Multiplier: 1.48,
    periods: [
      { name: 'Baseline', startHour: 0, endHour: 23, rate: 0.29, summerRate: 0.31 }
    ]
  },
  {
    id: 'sdge-tou-dr1',
    name: 'SDG&E TOU-DR1',
    description: 'Standard TOU plan. On-peak 4–9 PM. High summer rates.',
    type: 'tou',
    fixedMonthlyCharge: 0,
    provider: 'sdge-bundled',
    periods: [
      { name: 'On-Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.47, summerRate: 0.62 },
      { name: 'Off-Peak', startHour: 21, endHour: 15, rate: 0.32, summerRate: 0.34 }
    ]
  },
  {
    id: 'sdge-ev-tou',
    name: 'SDG&E EV-TOU',
    description: 'For EV owners. Super off-peak midnight–6 AM at ~$0.14/kWh.',
    type: 'tou',
    fixedMonthlyCharge: 0,
    provider: 'sdge-bundled',
    periods: [
      { name: 'On-Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.47, summerRate: 0.62 },
      { name: 'Off-Peak', startHour: 6, endHour: 15, rate: 0.32, summerRate: 0.34 },
      { name: 'Super Off-Peak (midnight-6 AM)', startHour: 21, endHour: 5, rate: 0.14, summerRate: 0.14 }
    ]
  },

  {
    id: 'mce-deep-ev2a',
    name: 'MCE Deep Green EV2-A',
    description: 'MCE 100% renewable + PG&E delivery. Eco-conscious EV. $24/mo BSC.',
    type: 'tou',
    fixedMonthlyCharge: 24,
    provider: 'mce-pge',
    pciaRate: 0.021,
    // deliveryRate = same PG&E delivery as Light Green (only MCE generation premium differs)
    periods: [
      { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.429, summerRate: 0.533, deliveryRate: 0.155, deliverySummerRate: 0.225 },
      { name: 'Partial-Peak (3-4 PM, 9-12 AM)', startHour: 15, endHour: 15, rate: 0.412, summerRate: 0.423, deliveryRate: 0.140, deliverySummerRate: 0.155 },
      { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.412, summerRate: 0.423, deliveryRate: 0.140, deliverySummerRate: 0.155 },
      { name: 'Off-Peak (12 AM-3 PM)', startHour: 0, endHour: 14, rate: 0.243, summerRate: 0.223, deliveryRate: 0.065, deliverySummerRate: 0.055 }
    ],
    rateHistory: [{
      effectiveBefore: '2026-03-01',
      fixedMonthlyCharge: 0,
      periods: [
        { name: 'Peak (4-9 PM)', startHour: 16, endHour: 20, rate: 0.499, summerRate: 0.603, deliveryRate: 0.220, deliverySummerRate: 0.295 },
        { name: 'Partial-Peak (3-4 PM, 9-12 AM)', startHour: 15, endHour: 15, rate: 0.482, summerRate: 0.493, deliveryRate: 0.200, deliverySummerRate: 0.215 },
        { name: 'Partial-Peak Night', startHour: 21, endHour: 23, rate: 0.482, summerRate: 0.493, deliveryRate: 0.200, deliverySummerRate: 0.215 },
        { name: 'Off-Peak (12 AM-3 PM)', startHour: 0, endHour: 14, rate: 0.313, summerRate: 0.293, deliveryRate: 0.130, deliverySummerRate: 0.120 }
      ]
    }]
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
  // Rates verified against Dec 2025 actual bill (Zone X, Baseline Territory X):
  //   Tier 1 Dec: $2.82657 + $0.14324 PPP = $2.970/therm
  //   Tier 2 Dec: $3.34043 + $0.14324 PPP = $3.484/therm
  //   Baseline: 2.00 therms/day in winter (Zone X) → ~60 therms/month
  //   No separate fixed monthly charge on bill
  baselineRate: 2.97,
  overBaselineRate: 3.48,
  baselineTherms: 60,
  fixedMonthlyCharge: 0
};

// ============ SoCalGas Tariff (for SCE / SDG&E territory) ============
// Approximate Jan 2026 — significantly lower than PG&E gas rates
export const SOCALGAS_TARIFF: GasTariff = {
  id: 'socalgas-g1',
  name: 'SoCalGas G-1 (Residential)',
  description: 'Southern California Gas residential rate. Tiered based on baseline.',
  // Approximate rates — verify against your SoCalGas bill
  baselineRate: 1.20,
  overBaselineRate: 1.80,
  baselineTherms: 40, // ~40 therms/month winter baseline (Zone 3 approx.)
  fixedMonthlyCharge: 0
};

// Detect utility provider from lat/lon coordinates (approximate — edge cases may be wrong)
export const detectUtilityFromCoords = (lat: number, lon: number): 'pge' | 'sce' | 'sdge' => {
  if (lat < 33.5 && lon > -117.9) return 'sdge';   // San Diego County
  if (lat < 36.0 && lon > -120.5) return 'sce';    // Southern California
  return 'pge';                                      // Northern / Central California
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
