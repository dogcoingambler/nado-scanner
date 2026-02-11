#!/usr/bin/env npx tsx
/**
 * Diagnostic test script for Private Alpha epoch volume.
 *
 * Usage: npx tsx scripts/test-epoch.ts
 */

import {
  fetchAllSubaccounts,
  fetchAccountSnapshots,
  EPOCHS,
  formatVolume,
  extractCumulativeVolumes,
  computePeriodVolume,
  extractWalletAddress,
  isPerpProduct,
} from '../src/lib/nado-client';

async function main() {
  const epoch = EPOCHS.find(e => e.name === 'Private Alpha');
  if (!epoch) {
    console.error('Private Alpha epoch not found');
    process.exit(1);
  }

  const startTs = Math.floor(new Date(epoch.start).getTime() / 1000);
  const endTs = Math.floor(new Date(epoch.end).getTime() / 1000);

  console.log(`\n=== Private Alpha Volume (Raw from Nado API) ===`);
  console.log(`Period: ${epoch.start} → ${epoch.end}`);
  console.log(`Unix:   ${startTs} → ${endTs}\n`);

  // Step 1: Fetch subaccounts
  console.log('--- Step 1: Fetch subaccounts ---');
  const subaccounts = await fetchAllSubaccounts(40000);
  const totalWallets = new Set(subaccounts.map(s => s.address.toLowerCase())).size;
  console.log(`Total subaccounts: ${subaccounts.length} (${totalWallets} wallets)`);

  const relevantSubs = subaccounts.filter(s => {
    const createdTs = parseInt(s.created_at, 10);
    return !isNaN(createdTs) && createdTs <= endTs;
  });
  const relevantIds = relevantSubs.map(s => s.subaccount);
  console.log(`Filtered to ${relevantIds.length} subaccounts created before epoch end\n`);

  // Step 2: Fetch end-of-epoch snapshots
  console.log('--- Step 2: Fetch end-of-epoch snapshots ---');
  const snapshotsEnd = await fetchAccountSnapshots(relevantIds, endTs);
  console.log(`End-of-epoch snapshots: ${snapshotsEnd.size}/${relevantIds.length} (${(snapshotsEnd.size / relevantIds.length * 100).toFixed(1)}%)\n`);

  // Step 3: Fetch start-of-epoch snapshots
  const activeIds = Array.from(snapshotsEnd.keys());
  console.log('--- Step 3: Fetch start-of-epoch snapshots ---');
  const snapshotsStart = await fetchAccountSnapshots(activeIds, startTs);
  console.log(`Start-of-epoch snapshots: ${snapshotsStart.size}/${activeIds.length} (${(snapshotsStart.size / activeIds.length * 100).toFixed(1)}%)\n`);

  // Step 4: Compute volumes
  console.log('--- Step 4: Volume computation ---');
  const endVolumes = extractCumulativeVolumes(snapshotsEnd);
  const startVolumes = extractCumulativeVolumes(snapshotsStart);
  const periodVolumes = computePeriodVolume(endVolumes, startVolumes);

  // Aggregate per wallet
  const walletVolumes = new Map<string, number>();
  let totalVolume = 0;
  for (const [subaccount, productMap] of periodVolumes) {
    const address = extractWalletAddress(subaccount);
    const prev = walletVolumes.get(address) || 0;
    let subVol = 0;
    for (const [, vol] of productMap) subVol += vol;
    walletVolumes.set(address, prev + subVol);
    totalVolume += subVol;
  }

  const traderCount = Array.from(walletVolumes.values()).filter(v => v > 0).length;
  console.log(`Total period volume: ${formatVolume(totalVolume)}`);
  console.log(`Traders: ${traderCount}`);

  // Step 5: Per-product breakdown
  console.log('\n--- Step 5: Per-product volume breakdown ---');
  const productTotals = new Map<number, number>();
  for (const [sub, endProdMap] of endVolumes) {
    const startProdMap = startVolumes.get(sub);
    for (const [productId, endVol] of endProdMap) {
      const startVol = startProdMap?.get(productId) || 0;
      const diff = endVol - startVol;
      if (diff > 0) {
        productTotals.set(productId, (productTotals.get(productId) || 0) + diff);
      }
    }
  }

  const sortedProducts = Array.from(productTotals.entries()).sort((a, b) => b[1] - a[1]);
  for (const [pid, vol] of sortedProducts) {
    const name = `${pid}: ${isPerpProduct(pid) ? 'PERP' : 'SPOT'}`;
    console.log(`  ${name.padEnd(12)} ${formatVolume(vol).padStart(12)}`);
  }

  // Summary
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total volume: ${formatVolume(totalVolume)}`);
  console.log(`Traders: ${traderCount}`);
  console.log(`Snapshot capture: end=${snapshotsEnd.size}/${relevantIds.length}, start=${snapshotsStart.size}/${activeIds.length}`);

  // Top 20 traders
  const sortedTraders = Array.from(walletVolumes.entries())
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  console.log(`\nTop 20 traders:`);
  for (let i = 0; i < Math.min(20, sortedTraders.length); i++) {
    const [addr, vol] = sortedTraders[i];
    const share = (vol / totalVolume * 100).toFixed(2);
    console.log(`  #${(i + 1).toString().padStart(3)} ${addr.slice(0, 10)}...  ${formatVolume(vol).padStart(12)}  ${share}%`);
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
