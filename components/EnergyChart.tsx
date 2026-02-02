
import React, { useMemo, useState, useEffect } from 'react';
import { CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis } from 'recharts';
import { EnergyReading, TimePeriod } from '../types';

interface EnergyChartProps {
  readings: EnergyReading[];
  period: TimePeriod;
  onBarClick?: (timestamp: number) => void;
}

type Granularity = '15m' | '1h' | '1d' | '1w' | '1m';

const EnergyChart: React.FC<EnergyChartProps> = ({ readings, period, onBarClick }) => {
  const [granularity, setGranularity] = useState<Granularity>('1h');

  useEffect(() => {
    if (period === 'day') setGranularity('1h');
    else if (period === 'week' || period === 'month') setGranularity('1d');
    else setGranularity('1m');
  }, [period]);

  const chartData = useMemo(() => {
    if (readings.length === 0) return [];

    const now = new Date();
    const map: Record<string, { usage: number; label: string; isPeak: boolean; timestamp: number; isFuture: boolean }> = {};

    readings.forEach(r => {
      let key = '';
      let label = '';
      const h = r.timestamp.getHours();
      const isPeak = h >= 16 && h <= 20;
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
        map[key] = { usage: 0, label, isPeak, timestamp: parseInt(key), isFuture };
      }
      map[key].usage += r.value;
      if (isFuture) map[key].isFuture = true;
    });

    return Object.values(map).sort((a, b) => a.timestamp - b.timestamp);
  }, [readings, granularity]);

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
            Load Profile
          </h3>
          <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">
            {granularity === '15m' ? 'Raw Meter Intervals' : `Aggregated by ${granularity}`}
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
              contentStyle={{ 
                borderRadius: '24px', 
                border: '1px solid #f1f5f9', 
                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                padding: '20px' 
              }}
              labelStyle={{ fontWeight: 900, color: '#0f172a', fontSize: '13px', marginBottom: '8px', textTransform: 'uppercase' }}
              itemStyle={{ fontWeight: 700, fontSize: '12px', color: '#3b82f6' }}
              formatter={(value: number, name: string, props: any) => {
                const isFuture = props.payload.isFuture;
                return [`${value.toFixed(3)} kWh${isFuture ? ' (Projected)' : ''}`, 'Usage'];
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
                let color = entry.isPeak ? '#f43f5e' : '#3b82f6';
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
         <div className="flex items-center gap-2">
           <div className="w-3 h-3 bg-rose-500 rounded-md"></div>
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Peak (4-9 PM)</span>
         </div>
         <div className="flex items-center gap-2">
           <div className="w-3 h-3 bg-blue-500 rounded-md"></div>
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Off-Peak</span>
         </div>
         <div className="flex items-center gap-2">
           <div className="w-3 h-3 bg-slate-300 rounded-md"></div>
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Projected / Incomplete</span>
         </div>
      </div>
    </div>
  );
};

export default EnergyChart;
