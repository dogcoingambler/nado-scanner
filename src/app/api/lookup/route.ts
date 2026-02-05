import { NextResponse } from 'next/server';
import { lookupWallet } from '@/lib/nado-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address')?.trim();

    if (!address) {
      return NextResponse.json(
        { error: 'Missing address parameter' },
        { status: 400 }
      );
    }

    // Basic validation: should look like an Ethereum address
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid address format. Expected 0x... (42 characters)' },
        { status: 400 }
      );
    }

    const result = await lookupWallet(address);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Lookup API error:', message);
    return NextResponse.json(
      { error: message || 'Failed to lookup wallet' },
      { status: 500 }
    );
  }
}
