import { NextResponse } from 'next/server';
import { fetchDashboardData } from '@/lib/nado-client';
import type { TimePeriod } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow up to 2 minutes for data fetching

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || '24h') as TimePeriod;

    // Validate period
    if (!['all', 'epoch', '24h'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period. Use: all, epoch, or 24h' },
        { status: 400 }
      );
    }

    const data = await fetchDashboardData(period);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('API route error:', message);
    return NextResponse.json(
      { error: message || 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
