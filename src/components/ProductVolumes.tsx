'use client';

import { formatVolume } from '@/lib/nado-client';
import type { ProductVolume } from '@/lib/types';

interface ProductVolumesProps {
  data: ProductVolume[];
  isLoading: boolean;
}

export default function ProductVolumes({ data, isLoading }: ProductVolumesProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
        <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
          <h2 className="text-lg font-bold text-white">[ VOLUME BY MARKET ]</h2>
        </div>
        <div className="p-5 animate-pulse space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 rounded w-20" style={{ background: '#2A2A2A' }} />
              <div className="flex-1 h-6 rounded" style={{ background: '#1A1A1A' }} />
              <div className="h-4 rounded w-16" style={{ background: '#2A2A2A' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
        <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
          <h2 className="text-lg font-bold text-white">[ VOLUME BY MARKET ]</h2>
        </div>
        <div className="p-12 text-center" style={{ color: '#6B6B6B' }}>
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const maxVolume = Math.max(...data.map(p => p.volume24h));

  // Color palette for different markets
  const colors = [
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

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
      <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
        <h2 className="text-lg font-bold text-white">[ VOLUME BY MARKET ]</h2>
        <p className="text-sm mt-1" style={{ color: '#6B6B6B' }}>All-time perp volume by product</p>
      </div>
      <div className="p-5 space-y-4">
        {data.slice(0, 10).map((product, index) => {
          const percentage = (product.volume24h / maxVolume) * 100;
          const color = colors[index % colors.length];

          return (
            <div key={product.productId} className="group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                  {product.name}
                </span>
                <span className="text-sm font-mono font-bold" style={{ color }}>
                  {formatVolume(product.volume24h)}
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: '#1A1A1A' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    background: color,
                    opacity: 0.8,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
