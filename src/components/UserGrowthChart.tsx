'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { UserGrowthPoint } from '@/lib/types';

interface UserGrowthChartProps {
  data: UserGrowthPoint[];
  isLoading: boolean;
}

export default function UserGrowthChart({ data, isLoading }: UserGrowthChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
        <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
          <h2 className="text-lg font-bold text-white">Daily New & Total Users</h2>
          <p className="text-sm mt-1" style={{ color: '#6B6B6B' }}>The daily new users and the cumulative.</p>
        </div>
        <div className="p-5">
          <div className="h-72 animate-pulse rounded" style={{ background: '#1A1A1A' }} />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
        <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
          <h2 className="text-lg font-bold text-white">Daily New & Total Users</h2>
        </div>
        <div className="p-12 text-center" style={{ color: '#6B6B6B' }}>
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const formatXAxis = (date: string) => {
    // date is "YYYY-MM-DD" format
    const d = new Date(date + 'T00:00:00Z');
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatUsers = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toString();
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
      <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
        <h2 className="text-lg font-bold text-white">Daily New & Total Users</h2>
        <p className="text-sm mt-1" style={{ color: '#6B6B6B' }}>The daily new users and the cumulative.</p>
      </div>
      <div className="p-5">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                stroke="#6B6B6B"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#1F1F1F' }}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={formatUsers}
                stroke="#6B6B6B"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#1F1F1F' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={formatUsers}
                stroke="#6B6B6B"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#1F1F1F' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1A1A',
                  border: '1px solid #2A2A2A',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#6B6B6B' }}
                formatter={(value, name) => {
                  const label = name === 'newUsers' ? 'New Users' : 'Total Users';
                  return [(value as number).toLocaleString(), label];
                }}
                labelFormatter={(label) => {
                  const d = new Date(label + 'T00:00:00Z');
                  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="newUsers"
                fill="#8B5CF6"
                opacity={0.8}
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativeUsers"
                stroke="#FFFFFF"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
