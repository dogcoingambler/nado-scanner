'use client';

import { useMemo } from 'react';
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

interface FeeChartProps {
  data: { timestamp: string; fees: number }[];
  isLoading: boolean;
}

function formatLargeNumber(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

export default function FeeChart({ data, isLoading }: FeeChartProps) {
  // Compute cumulative fees
  const chartData = useMemo(() => {
    let cumulative = 0;
    return data.map((d) => {
      cumulative += d.fees;
      return { ...d, cumulativeFees: cumulative };
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
        <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
          <h2 className="text-lg font-bold text-white">Trading Fees</h2>
        </div>
        <div className="p-5">
          <div className="h-64 animate-pulse rounded" style={{ background: '#1A1A1A' }} />
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
        <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
          <h2 className="text-lg font-bold text-white">Trading Fees</h2>
        </div>
        <div className="p-12 text-center" style={{ color: '#6B6B6B' }}>
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const formatXAxis = (timestamp: string) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
      <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
        <h2 className="text-lg font-bold text-white">Trading Fees</h2>
        <p className="text-sm mt-1" style={{ color: '#6B6B6B' }}>The daily trading fees and the cumulative fees.</p>
      </div>
      <div className="p-5">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                stroke="#6B6B6B"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#1F1F1F' }}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={(value) => formatLargeNumber(value)}
                stroke="#6B6B6B"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#1F1F1F' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => formatLargeNumber(value)}
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
                  const label = name === 'fees' ? 'Daily Fees' : 'Cumulative';
                  return [formatLargeNumber(value as number), label];
                }}
                labelFormatter={(label) => {
                  const d = new Date(label);
                  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="fees"
                fill="#8B5CF6"
                opacity={0.8}
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativeFees"
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
