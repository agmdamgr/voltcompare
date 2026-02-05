
import React, { useMemo, useState, useEffect } from 'react';
import { CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis } from 'recharts';
import { EnergyReading, TimePeriod, Tariff, TariffPeriod } from '../types';

type HourType = 'peak' | 'partial-peak' | 'off-peak' | 'flat';

const isSummerMonth = (month: number) => month >= 5 && month <= 8;

const getEffectiveRate = (period: TariffPeriod, month: number): number => {
  if (period.summerRate != null && isSummerMonth(month)) return period.summerRate;
  return period.rate;
};

const classifyHour = (hour: number, tariff: Tariff): HourType => {
  if (tariff.type === 'flat') return 'flat';

  for (const p of tariff.periods) {
    const inRange = p.startHour <= p.endHour
      ? hour >= p.startHour && hour <= p.endHour
      : hour >= p.startHour || hour <= p.endHour;

    if (inRange) {
      const name = p.name.toLowerCase();
      if (name.includes('partial')) return 'partial-peak';
      if (name.includes('peak') && !name.includes('off')) return 'peak';
      return 'off-peak';
    }
  }
  return 'off-peak';
};

const getRateForHour = (hour: number, month: number, tariff: Tariff): number => {
  for (const p of tariff.periods) {
    const inRange = p.startHour <= p.endHour
      ? hour >= p.startHour && hour <= p.endHour
      : hour >= p.startHour || hour <= p.endHour;
    if (inRange) return getEffectiveRate(p, month);
  }
  return getEffectiveRate(tariff.periods[0], month) ?? 0;
};

const hourTypeColor: Record<HourType, string> = {
  'peak': '#f43f5e',
  'partial-peak': '#f59e0b',
  'off-peak': '#3b82f6',
  'flat': '#3b82f6',
};

const hourTypeLabel: Record<HourType, string> = {
  'peak': 'Peak',
  'partial-peak': 'Partial-Peak',
  'off-peak': 'Off-Peak',
  'flat': 'Flat Rate',
};

interface EnergyChartProps {
  readings: EnergyReading[];
  period: TimePeriod;
  tariff: Tariff;
  onBarClick?: (timestamp: number) => void;
}

type Granularity = '15m' | '1h' | '1d' | '1w' | '1m';

const EnergyChart: React.FC<EnergyChartProps> = ({ readings, period, tariff, onBarClick }) => {
  const [granularity, setGranularity] = useState<Granularity>('1h');

  useEffect(() => {
    if (period === 'day') setGranularity('1h');
    else if (period === 'week' || period === 'month') setGranularity('1d');
    else setGranularity('1m');
  }, [period]);

  const chartData = useMemo(() => {
    if (readings.length === 0) return [];

    const now = new Date();
    const map: Record<string, { usage: number; cost: number; rate: number; label: string; hourType: HourType; timestamp: number; isFuture: boolean }> = {};

    readings.forEach(r => {
      let key = '';
      let label = '';
      const h = r.timestamp.getHours();
      const m = r.timestamp.getMonth();
      const hourType = classifyHour(h, tariff);
      const rate = getRateForHour(h, m, tariff);
      const isFuture = r.timestamp > now;

      if (granularity === '15m') {
        key = r.timestamp.getTime().toString();
        label = r.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      } else if (granularity === '1h') {
        const d = new Date(r.timestamp);
        d.setMinutes(0, 0, 0);
        key = d.getTime().toString();
        label = `${h}:00`;
      } else if (granularity === '1d') {
        const d = new Date(r.timestamp);
        d.setHours(0, 0, 0, 0);
        key = d.getTime().toString();
        label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } else if (granularity === '1w') {
        const d = new Date(r.timestamp);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        key = d.getTime().toString();
        label = `Wk of ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
      } else {
        const d = new Date(r.timestamp);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        key = d.getTime().toString();
        label = d.toLocaleString('default', { month: 'short' });
      }

      if (!map[key]) {
        map[key] = { usage: 0, cost: 0, rate, label, hourType, timestamp: parseInt(key), isFuture };
      }
      map[key].usage += r.value;
      map[key].cost += r.value * rate;
      if (isFuture) map[key].isFuture = true;
    });

    return Object.values(map).sort((a, b) => a.timestamp - b.timestamp);
  }, [readings, granularity, tariff]);

  const availableGranularities = useMemo((): Granularity[] => {
    if (period === 'day') return ['15m', '1h'];
    if (period === 'week') return ['1h', '1d'];
    if (period === 'month') return ['1d', '1w'];
    return ['1w', '1m'];
  }, [period]);

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 transition-all">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
            Usage Detail
          </h3>
          <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">
            {granularity === '15m' ? '15-Minute Intervals' : `Grouped by ${granularity === '1h' ? 'Hour' : granularity === '1d' ? 'Day' : granularity === '1w' ? 'Week' : 'Month'}`}
            {onBarClick && period !== 'day' && <span className="ml-2 text-blue-500">• Click bars to drill down</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 mr-1">Interval:</span>
          {availableGranularities.map(g => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all ${
                granularity === g 
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="label" 
              fontSize={9} 
              tick={{fill: '#94a3b8', fontWeight: 800}} 
              axisLine={false}
              tickLine={false}
              minTickGap={25}
            />
            <YAxis 
              fontSize={9} 
              tick={{fill: '#94a3b8', fontWeight: 800}} 
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{fill: '#f8fafc'}}
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload[0]) return null;
                const data = payload[0].payload;
                const color = hourTypeColor[data.hourType as HourType];
                return (
                  <div style={{
                    borderRadius: '24px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '20px',
                    background: 'white',
                    minWidth: '180px'
                  }}>
                    <p style={{ fontWeight: 900, color: '#0f172a', fontSize: '13px', marginBottom: '12px', textTransform: 'uppercase' }}>
                      {label}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '12px', color: '#64748b' }}>Usage</span>
                        <span style={{ fontWeight: 800, fontSize: '13px', color: color }}>
                          {data.usage.toFixed(3)} kWh
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '12px', color: '#64748b' }}>Cost</span>
                        <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                          ${data.cost.toFixed(2)}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        borderTop: '1px solid #f1f5f9', paddingTop: '6px', marginTop: '2px'
                      }}>
                        <span style={{ fontWeight: 700, fontSize: '11px', color: '#94a3b8' }}>Rate</span>
                        <span style={{ fontWeight: 700, fontSize: '11px', color }}>
                          {hourTypeLabel[data.hourType as HourType]} · ${data.rate.toFixed(2)}/kWh
                        </span>
                      </div>
                    </div>
                    {data.isFuture && (
                      <p style={{ fontWeight: 700, fontSize: '10px', color: '#94a3b8', marginTop: '8px', fontStyle: 'italic' }}>
                        Projected / Incomplete
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Bar 
              dataKey="usage" 
              radius={[6, 6, 0, 0]}
              onClick={(data) => {
                if (onBarClick && data.timestamp) {
                  onBarClick(data.timestamp);
                }
              }}
              style={{ cursor: onBarClick && period !== 'day' ? 'pointer' : 'default' }}
            >
              {chartData.map((entry, index) => {
                let color = hourTypeColor[entry.hourType];
                let opacity = 0.85;
                
                if (entry.isFuture) {
                  color = '#cbd5e1'; 
                  opacity = 0.5;
                }

                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={color} 
                    fillOpacity={opacity}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-4 border-t border-slate-50 pt-6">
         {tariff.type !== 'flat' && (() => {
           const hasPeak = tariff.periods.some(p => {
             const n = p.name.toLowerCase();
             return n.includes('peak') && !n.includes('off') && !n.includes('partial');
           });
           const hasPartialPeak = tariff.periods.some(p => p.name.toLowerCase().includes('partial'));
           const peakPeriod = tariff.periods.find(p => {
             const n = p.name.toLowerCase();
             return n.includes('peak') && !n.includes('off') && !n.includes('partial');
           });
           const partialPeakPeriods = tariff.periods.filter(p => p.name.toLowerCase().includes('partial'));

           const formatHour = (h: number) => {
             if (h === 0) return '12 AM';
             if (h === 12) return '12 PM';
             return h < 12 ? `${h} AM` : `${h - 12} PM`;
           };

           return (
             <>
               {hasPeak && peakPeriod && (
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 bg-rose-500 rounded-md"></div>
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                     Peak ({formatHour(peakPeriod.startHour)}-{formatHour(peakPeriod.endHour + 1)})
                   </span>
                 </div>
               )}
               {hasPartialPeak && (
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 bg-amber-500 rounded-md"></div>
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                     Partial-Peak ({partialPeakPeriods.map(p => `${formatHour(p.startHour)}-${formatHour(p.endHour + 1)}`).join(', ')})
                   </span>
                 </div>
               )}
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 bg-blue-500 rounded-md"></div>
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Off-Peak</span>
               </div>
             </>
           );
         })()}
         {tariff.type === 'flat' && (
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 bg-blue-500 rounded-md"></div>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Flat Rate (All Hours)</span>
           </div>
         )}
         <div className="flex items-center gap-2">
           <div className="w-3 h-3 bg-slate-300 rounded-md"></div>
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Projected / Incomplete</span>
         </div>
      </div>
    </div>
  );
};

export default EnergyChart;
