#!/usr/bin/env npx tsx
/**
 * Diagnostic test script for Private Alpha epoch volume accuracy.
 *
 * Does the computation step-by-step with detailed logging to pinpoint
 * any discrepancy between our calculation and expected values.
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
  fromX18,
  isPerpProduct,
} from '../src/lib/nado-client';

const DEFILLAMA_URL = 'https://api.llama.fi/summary/derivatives/nado';

async function main() {
  const epoch = EPOCHS.find(e => e.name === 'Private Alpha');
  if (!epoch) {
    console.error('Private Alpha epoch not found');
    process.exit(1);
  }

  const startTs = Math.floor(new Date(epoch.start).getTime() / 1000);
  const endTs = Math.floor(new Date(epoch.end).getTime() / 1000);

  console.log(`\n=== Diagnosing Private Alpha Volume ===`);
  console.log(`Period: ${epoch.start} → ${epoch.end}`);
  console.log(`Unix:   ${startTs} → ${endTs}\n`);

  // ─────────────────────────────────────────────
  // Step 0: DefiLlama cross-reference
  // ─────────────────────────────────────────────
  console.log('--- Step 0: DefiLlama Cross-Reference ---');
  try {
    const resp = await fetch(DEFILLAMA_URL);
    if (resp.ok) {
      const data = await resp.json();
      console.log(`DefiLlama totalAllTime: ${formatVolume(data.totalAllTime)}`);
      console.log(`DefiLlama total24h: ${formatVolume(data.total24h)}`);

      // Sum daily volumes during Private Alpha period
      const chart: [number, number][] = data.totalDataChart || [];
      let defiLlamaPAVolume = 0;
      let daysInPA = 0;
      for (const [ts, dailyVol] of chart) {
        if (ts >= startTs && ts < endTs) {
          defiLlamaPAVolume += dailyVol;
          daysInPA++;
        }
      }
      console.log(`DefiLlama Private Alpha volume (sum of daily): ${formatVolume(defiLlamaPAVolume)} (${daysInPA} days)`);
      console.log(`  → This is the EXPECTED volume for Private Alpha from DefiLlama\n`);
    } else {
      console.log(`DefiLlama fetch failed: ${resp.status}\n`);
    }
  } catch (err) {
    console.log(`DefiLlama fetch failed: ${err}\n`);
  }

  // ─────────────────────────────────────────────
  // Step 1: Fetch subaccounts
  // ─────────────────────────────────────────────
  console.log('--- Step 1: Fetch subaccounts ---');
  const subaccounts = await fetchAllSubaccounts(40000);
  const totalWallets = new Set(subaccounts.map(s => s.address.toLowerCase())).size;
  console.log(`Total subaccounts: ${subaccounts.length} (${totalWallets} wallets)`);

  // Filter to subaccounts created before epoch end
  const relevantSubs = subaccounts.filter(s => {
    const createdTs = parseInt(s.created_at, 10);
    return !isNaN(createdTs) && createdTs <= endTs;
  });
  const relevantIds = relevantSubs.map(s => s.subaccount);
  console.log(`Filtered to ${relevantIds.length} subaccounts created before epoch end`);

  // Also check: how many were created BEFORE epoch start?
  const preEpochSubs = subaccounts.filter(s => {
    const createdTs = parseInt(s.created_at, 10);
    return !isNaN(createdTs) && createdTs < startTs;
  });
  const duringEpochSubs = relevantSubs.filter(s => {
    const createdTs = parseInt(s.created_at, 10);
    return !isNaN(createdTs) && createdTs >= startTs && createdTs <= endTs;
  });
  console.log(`  Created before epoch start: ${preEpochSubs.length}`);
  console.log(`  Created during epoch: ${duringEpochSubs.length}\n`);

  // ─────────────────────────────────────────────
  // Step 2: Fetch end-of-epoch snapshots
  // ─────────────────────────────────────────────
  console.log('--- Step 2: Fetch end-of-epoch snapshots ---');
  const snapshotsEnd = await fetchAccountSnapshots(relevantIds, endTs);
  console.log(`End-of-epoch snapshots: ${snapshotsEnd.size}/${relevantIds.length} subaccounts\n`);

  // ─────────────────────────────────────────────
  // Step 3: Fetch start-of-epoch snapshots (only for those with end data)
  // ─────────────────────────────────────────────
  const activeIds = Array.from(snapshotsEnd.keys());
  console.log('--- Step 3: Fetch start-of-epoch snapshots ---');
  const snapshotsStart = await fetchAccountSnapshots(activeIds, startTs);
  console.log(`Start-of-epoch snapshots: ${snapshotsStart.size}/${activeIds.length} subaccounts\n`);

  // ─────────────────────────────────────────────
  // Step 4: Detailed volume analysis
  // ─────────────────────────────────────────────
  console.log('--- Step 4: Detailed volume analysis ---');

  const endVolumes = extractCumulativeVolumes(snapshotsEnd);
  const startVolumes = extractCumulativeVolumes(snapshotsStart);

  // Sum total cumulative at end and start
  let totalCumulativeEnd = 0;
  let totalCumulativeStart = 0;
  for (const [, prodMap] of endVolumes) {
    for (const [, vol] of prodMap) totalCumulativeEnd += vol;
  }
  for (const [, prodMap] of startVolumes) {
    for (const [, vol] of prodMap) totalCumulativeStart += vol;
  }

  console.log(`Total cumulative at epoch END (Jan 16):   ${formatVolume(totalCumulativeEnd)}`);
  console.log(`Total cumulative at epoch START (Nov 21): ${formatVolume(totalCumulativeStart)}`);
  console.log(`Simple difference (end - start):          ${formatVolume(totalCumulativeEnd - totalCumulativeStart)}`);

  // Breakdown: paired (both start & end) vs unpaired (end only)
  let volumePaired = 0;
  let volumeUnpaired = 0;
  let pairedCount = 0;
  let unpairedCount = 0;

  for (const [subaccount, endProdMap] of endVolumes) {
    const startProdMap = startVolumes.get(subaccount);
    let subVol = 0;

    if (startProdMap) {
      // Paired: has both start and end data
      pairedCount++;
      for (const [productId, endVol] of endProdMap) {
        const startVol = startProdMap.get(productId) || 0;
        const diff = endVol - startVol;
        if (diff > 0) subVol += diff;
      }
      volumePaired += subVol;
    } else {
      // Unpaired: only has end data, start defaults to 0
      unpairedCount++;
      for (const [, endVol] of endProdMap) {
        subVol += endVol;
      }
      volumeUnpaired += subVol;
    }
  }

  console.log(`\nPaired subaccounts (both start & end data): ${pairedCount}`);
  console.log(`  Volume from paired: ${formatVolume(volumePaired)}`);
  console.log(`Unpaired subaccounts (end only, start=0):   ${unpairedCount}`);
  console.log(`  Volume from unpaired: ${formatVolume(volumeUnpaired)}`);
  console.log(`Total period volume: ${formatVolume(volumePaired + volumeUnpaired)}`);

  // Check: what are the top start-of-epoch cumulative values?
  // For the FIRST epoch, these should all be ~0
  const startCumulativePerSub: { subaccount: string; cumulative: number }[] = [];
  for (const [sub, prodMap] of startVolumes) {
    let total = 0;
    for (const [, vol] of prodMap) total += vol;
    if (total > 0) startCumulativePerSub.push({ subaccount: sub, cumulative: total });
  }
  startCumulativePerSub.sort((a, b) => b.cumulative - a.cumulative);

  console.log(`\nStart-of-epoch cumulative > 0: ${startCumulativePerSub.length} subaccounts`);
  if (startCumulativePerSub.length > 0) {
    console.log('Top 10 start-of-epoch cumulative values (should be ~0 for first epoch):');
    for (const s of startCumulativePerSub.slice(0, 10)) {
      console.log(`  ${s.subaccount.slice(0, 20)}... → ${formatVolume(s.cumulative)}`);
    }
    const totalNonZeroStart = startCumulativePerSub.reduce((sum, s) => sum + s.cumulative, 0);
    console.log(`Total non-zero start cumulative: ${formatVolume(totalNonZeroStart)}`);
  }

  // ─────────────────────────────────────────────
  // Step 5: Compare with computePeriodVolume function result
  // ─────────────────────────────────────────────
  console.log('\n--- Step 5: computePeriodVolume function result ---');
  const periodVolumes = computePeriodVolume(endVolumes, startVolumes);

  // Aggregate per wallet
  const walletVolumes = new Map<string, number>();
  let totalPeriodVolume = 0;
  for (const [subaccount, productMap] of periodVolumes) {
    const address = extractWalletAddress(subaccount);
    const prev = walletVolumes.get(address) || 0;
    let subVol = 0;
    for (const [, vol] of productMap) subVol += vol;
    walletVolumes.set(address, prev + subVol);
    totalPeriodVolume += subVol;
  }

  const traderCount = Array.from(walletVolumes.values()).filter(v => v > 0).length;

  console.log(`Total period volume (computePeriodVolume): ${formatVolume(totalPeriodVolume)}`);
  console.log(`Traders: ${traderCount}`);

  // ─────────────────────────────────────────────
  // Step 6: Per-product volume breakdown
  // ─────────────────────────────────────────────
  console.log('\n--- Step 6: Per-product volume breakdown ---');
  const productTotals = new Map<number, { end: number; start: number; period: number }>();

  for (const [sub, endProdMap] of endVolumes) {
    const startProdMap = startVolumes.get(sub);
    for (const [productId, endVol] of endProdMap) {
      if (!productTotals.has(productId)) {
        productTotals.set(productId, { end: 0, start: 0, period: 0 });
      }
      const t = productTotals.get(productId)!;
      t.end += endVol;
      const startVol = startProdMap?.get(productId) || 0;
      t.start += startVol;
      const diff = endVol - startVol;
      if (diff > 0) t.period += diff;
    }
  }

  const sortedProducts = Array.from(productTotals.entries()).sort((a, b) => b[1].period - a[1].period);
  console.log(`${'Product'.padEnd(20)} ${'End Cumul'.padStart(12)} ${'Start Cumul'.padStart(12)} ${'Period Vol'.padStart(12)}`);
  let productPeriodTotal = 0;
  for (const [pid, t] of sortedProducts) {
    const name = `${pid}: ${isPerpProduct(pid) ? 'PERP' : 'SPOT'}`;
    console.log(`${name.padEnd(20)} ${formatVolume(t.end).padStart(12)} ${formatVolume(t.start).padStart(12)} ${formatVolume(t.period).padStart(12)}`);
    productPeriodTotal += t.period;
  }
  console.log(`${'TOTAL'.padEnd(20)} ${formatVolume(totalCumulativeEnd).padStart(12)} ${formatVolume(totalCumulativeStart).padStart(12)} ${formatVolume(productPeriodTotal).padStart(12)}`);

  // ─────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────
  console.log(`\n=== SUMMARY ===`);
  console.log(`Our calculated Private Alpha volume:  ${formatVolume(totalPeriodVolume)}`);
  console.log(`User expected:                        ~$21.5B`);
  console.log(`Ratio: ${(totalPeriodVolume / 21_500_000_000 * 100).toFixed(1)}% of expected`);
  console.log(`\nSnapshot capture rates:`);
  console.log(`  End-of-epoch:   ${snapshotsEnd.size}/${relevantIds.length} (${(snapshotsEnd.size / relevantIds.length * 100).toFixed(1)}%)`);
  console.log(`  Start-of-epoch: ${snapshotsStart.size}/${activeIds.length} (${(snapshotsStart.size / activeIds.length * 100).toFixed(1)}%)`);
  console.log(`  Missing start:  ${unpairedCount} subaccounts → their FULL cumulative counted as period vol`);
  console.log(`\nVolume breakdown:`);
  console.log(`  From paired (end - start):  ${formatVolume(volumePaired)} (${(volumePaired / totalPeriodVolume * 100).toFixed(1)}%)`);
  console.log(`  From unpaired (end only):   ${formatVolume(volumeUnpaired)} (${(volumeUnpaired / totalPeriodVolume * 100).toFixed(1)}%)`);

  // Top 20 traders
  const sortedTraders = Array.from(walletVolumes.entries())
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  console.log(`\nTop 20 traders:`);
  for (let i = 0; i < Math.min(20, sortedTraders.length); i++) {
    const [addr, vol] = sortedTraders[i];
    const share = (vol / totalPeriodVolume * 100).toFixed(2);
    console.log(`  #${(i + 1).toString().padStart(3)} ${addr.slice(0, 10)}...  ${formatVolume(vol).padStart(12)}  ${share}%`);
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
