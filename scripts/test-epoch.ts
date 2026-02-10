#!/usr/bin/env npx tsx
/**
 * Test script: fetch and analyze a single epoch to diagnose volume accuracy.
 *
 * Usage: npx tsx scripts/test-epoch.ts
 */

import {
  fetchAllSubaccounts,
  fetchEpochLeaderboard,
  EPOCHS,
  formatVolume,
  extractCumulativeVolumes,
  fromX18,
  isPerpProduct,
} from '../src/lib/nado-client';

// We'll also directly test a small batch to inspect raw data
const ARCHIVE_URL = 'https://archive.prod.nado.xyz/v1';
const API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept-Encoding': 'gzip, deflate, br',
};

async function fetchRawSnapshot(subaccounts: string[], timestamp: number) {
  const response = await fetch(ARCHIVE_URL, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify({
      account_snapshots: { subaccounts, timestamps: [timestamp] },
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

async function main() {
  const epoch = EPOCHS.find(e => e.name === 'Private Alpha');
  if (!epoch) {
    console.error('Private Alpha epoch not found');
    process.exit(1);
  }

  console.log(`\n=== Testing Private Alpha ===`);
  console.log(`Period: ${epoch.start} → ${epoch.end}\n`);

  // Step 1: Fetch subaccounts
  console.log('Fetching subaccounts...');
  const subaccounts = await fetchAllSubaccounts(40000);
  console.log(`Got ${subaccounts.length} subaccounts from ${new Set(subaccounts.map(s => s.address.toLowerCase())).size} wallets\n`);

  const subaccountIds = subaccounts.map(s => s.subaccount);

  // Step 2: Test a small raw batch first to inspect the data format
  console.log('--- Raw data inspection (first 5 subaccounts) ---');
  const testBatch = subaccountIds.slice(0, 5);
  const endTs = Math.floor(new Date(epoch.end).getTime() / 1000);

  try {
    const rawData = await fetchRawSnapshot(testBatch, endTs);
    const snapshots = rawData.snapshots || {};

    for (const [subaccount, tsData] of Object.entries(snapshots)) {
      const data = tsData as Record<string, unknown>;
      for (const [ts, products] of Object.entries(data)) {
        const prods = products as { product_id: number; quote_volume_cumulative: string }[];
        console.log(`\nSubaccount: ${subaccount.slice(0, 20)}...`);
        console.log(`  Timestamp: ${ts}`);
        for (const p of prods) {
          if (!isPerpProduct(p.product_id)) continue;
          const rawVol = p.quote_volume_cumulative;
          const parsed = fromX18(rawVol);
          console.log(`  Product ${p.product_id}: raw="${rawVol}" → parsed=$${parsed.toFixed(2)}`);
        }
      }
    }
  } catch (err) {
    console.error('Raw inspection failed:', err);
  }

  // Step 3: Compute the epoch leaderboard
  console.log('\n\n--- Computing Private Alpha leaderboard ---');
  console.log('This will take several minutes...\n');

  const startTime = Date.now();
  const leaderboard = await fetchEpochLeaderboard(epoch, subaccountIds);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n=== Private Alpha Results (${elapsed}s) ===`);
  console.log(`Total volume: $${(leaderboard.totalVolume / 1e9).toFixed(3)}B`);
  console.log(`Traders: ${leaderboard.traders.length}`);
  console.log(`Expected: ~$21.5B`);
  console.log(`Ratio: ${(leaderboard.totalVolume / 21_500_000_000 * 100).toFixed(1)}% of expected`);

  // Top 20 traders
  console.log(`\nTop 20 traders:`);
  for (const t of leaderboard.traders.slice(0, 20)) {
    console.log(`  #${t.rank.toString().padStart(3)} ${t.address.slice(0, 10)}...  ${formatVolume(t.volume).padStart(12)}  ${t.volumeShare.toFixed(2)}%  ${t.productCount} markets`);
  }

  // Volume distribution
  const vol1B = leaderboard.traders.filter(t => t.volume >= 1_000_000_000).length;
  const vol100M = leaderboard.traders.filter(t => t.volume >= 100_000_000).length;
  const vol10M = leaderboard.traders.filter(t => t.volume >= 10_000_000).length;
  const vol1M = leaderboard.traders.filter(t => t.volume >= 1_000_000).length;

  console.log(`\nVolume distribution:`);
  console.log(`  >= $1B:   ${vol1B} traders`);
  console.log(`  >= $100M: ${vol100M} traders`);
  console.log(`  >= $10M:  ${vol10M} traders`);
  console.log(`  >= $1M:   ${vol1M} traders`);
  console.log(`  Total:    ${leaderboard.traders.length} traders`);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
