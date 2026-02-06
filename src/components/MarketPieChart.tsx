'use client';

import dynamic from 'next/dynamic';
import { formatVolume } from '@/lib/nado-client';
import type { ProductVolume } from '@/lib/types';

// Dynamic import recharts to avoid SSR issues
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });

interface MarketPieChartProps {
  data: ProductVolume[];
  isLoading: boolean;
}

const COLORS = [
  '#22C55E', // Green
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#6366F1', // Indigo
];

export default function MarketPieChart({ data, isLoading }: MarketPieChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
        <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
          <h2 className="text-lg font-bold text-white">Volume by Market</h2>
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
          <h2 className="text-lg font-bold text-white">Volume by Market</h2>
        </div>
        <div className="p-12 text-center" style={{ color: '#6B6B6B' }}>
          <p>No data available</p>
        </div>
      </div>
    );
  }

  // Take top 8 markets and group the rest as "Other"
  const top = data.slice(0, 8);
  const rest = data.slice(8);
  const otherVolume = rest.reduce((sum, p) => sum + p.volume24h, 0);

  const chartData = [
    ...top.map(p => ({ name: p.name, value: p.volume24h })),
    ...(otherVolume > 0 ? [{ name: 'Other', value: otherVolume }] : []),
  ];

  const totalVolume = chartData.reduce((sum, d) => sum + d.value, 0);

  const renderLabel = (props: { name?: string; percent?: number }) => {
    const { name, percent } = props;
    if (!name || !percent || percent < 0.03) return '';
    return `${name} ${(percent * 100).toFixed(0)}%`;
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
      <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
        <h2 className="text-lg font-bold text-white">Volume by Market</h2>
        <p className="text-sm mt-1" style={{ color: '#6B6B6B' }}>
          All-time perp volume — Total: {formatVolume(totalVolume)}
        </p>
      </div>
      <div className="p-5">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                dataKey="value"
                label={renderLabel}
                labelLine={false}
                stroke="#0D0D0D"
                strokeWidth={2}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1A1A',
                  border: '1px solid #2A2A2A',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                formatter={(value) => [formatVolume(value as number), 'Volume']}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconSize={10}
                formatter={(value) => (
                  <span style={{ color: '#A1A1A1', fontSize: '11px' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
