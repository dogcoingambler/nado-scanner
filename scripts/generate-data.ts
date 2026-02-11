#!/usr/bin/env npx tsx
/**
 * Generate static leaderboard data.
 *
 * Run this locally before deploying:
 *   npm run generate
 *
 * This fetches all data from the Nado API and writes it to
 * public/data/leaderboard.json so the site can be fully static.
 *
 * Past epoch leaderboards are cached in public/data/epoch-cache.json
 * so they don't need to be re-fetched on subsequent runs.
 *
 * Volume accuracy: We use DefiLlama daily chart data as the source of
 * truth for epoch total volumes, and scale per-account volumes
 * proportionally. This corrects for the double-counting inherent in
 * summing both sides of each trade from account snapshots.
 */

import {
  fetchDashboardData,
  fetchEpochLeaderboard,
  fetchAllSubaccounts,
  fetchDerivativesStats,
  computeEpochVolumeFromChart,
  EPOCHS,
  getCurrentEpoch,
} from '../src/lib/nado-client';
import type { EpochLeaderboard } from '../src/lib/types';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const outDir = join(__dirname, '..', 'public', 'data');
const epochCachePath = join(outDir, 'epoch-cache.json');

function loadEpochCache(): EpochLeaderboard[] {
  try {
    if (existsSync(epochCachePath)) {
      const raw = readFileSync(epochCachePath, 'utf-8');
      const cache = JSON.parse(raw) as EpochLeaderboard[];
      console.log(`Loaded epoch cache: ${cache.length} epochs cached`);
      return cache;
    }
  } catch (err) {
    console.warn('Could not load epoch cache:', err);
  }
  return [];
}

function saveEpochCache(epochs: EpochLeaderboard[]): void {
  writeFileSync(epochCachePath, JSON.stringify(epochs));
  console.log(`Saved epoch cache: ${epochs.length} epochs`);
}

async function fetchSubaccountsWithRetry() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const subaccounts = await fetchAllSubaccounts(40000);
    if (subaccounts.length > 0) return subaccounts;
    console.log(`Subaccount fetch returned 0 (attempt ${attempt + 1}/3), retrying in 15s...`);
    await new Promise(r => setTimeout(r, 15000));
  }
  return [];
}

async function main() {
  const start = Date.now();
  console.log('Generating leaderboard data...');
  console.log('This scans ~39k subaccounts — may take several minutes.\n');

  try {
    // Step 1: Fetch main dashboard data (includes user growth, OI, volume, all-time leaderboard)
    const data = await fetchDashboardData('all');

    // Step 1b: Fetch DefiLlama daily chart for epoch volume calibration
    console.log('\n=== Fetching DefiLlama chart for volume calibration ===');
    const defiLlamaStats = await fetchDerivativesStats();
    const dailyChart: [number, number][] = defiLlamaStats?.totalDataChart || [];
    if (dailyChart.length > 0) {
      console.log(`DefiLlama daily chart: ${dailyChart.length} data points`);
    } else {
      console.warn('Warning: No DefiLlama daily chart data — epoch volumes will NOT be calibrated');
    }

    // Step 2: Compute epoch leaderboards
    console.log('\n=== Computing epoch leaderboards ===');
    const currentEpoch = getCurrentEpoch();
    const now = new Date();

    // Load cached epoch data (past epochs are immutable)
    const epochCache = loadEpochCache();
    const cachedNames = new Set(epochCache.map(e => e.epochName));

    // Determine which past epochs need computing
    const pastEpochs = EPOCHS.filter(e => new Date(e.end) <= now && e.name !== currentEpoch?.name);
    const uncachedPastEpochs = pastEpochs.filter(e => !cachedNames.has(e.name));

    // Check if we need subaccounts (for uncached past epochs or current epoch)
    const needsSubaccounts = uncachedPastEpochs.length > 0 || currentEpoch != null;
    let allSubaccounts: Awaited<ReturnType<typeof fetchSubaccountsWithRetry>> = [];
    let subaccountIds: string[] = [];

    if (needsSubaccounts) {
      // Wait before fetching to avoid rate limiting from the main data fetch
      console.log('Waiting 10s before epoch computation to avoid rate limiting...');
      await new Promise(r => setTimeout(r, 10000));

      allSubaccounts = await fetchSubaccountsWithRetry();
      subaccountIds = allSubaccounts.map(s => s.subaccount);
      if (subaccountIds.length === 0) {
        console.warn('Could not fetch subaccounts for epoch leaderboards.');
      }
    }

    // Compute uncached past epochs
    if (uncachedPastEpochs.length === 0) {
      console.log(`All ${pastEpochs.length} past epochs already cached.`);
    } else if (subaccountIds.length > 0) {
      console.log(`Computing ${uncachedPastEpochs.length} past epoch(s): ${uncachedPastEpochs.map(e => e.name).join(', ')}`);
      for (const epoch of uncachedPastEpochs) {
        try {
          // Compute target volume from DefiLlama chart
          const targetVolume = dailyChart.length > 0
            ? computeEpochVolumeFromChart(dailyChart, epoch.start, epoch.end)
            : undefined;
          const leaderboard = await fetchEpochLeaderboard(epoch, subaccountIds, allSubaccounts, targetVolume || undefined);
          epochCache.push(leaderboard);
          // Save after each epoch so progress isn't lost
          saveEpochCache(epochCache);
        } catch (err) {
          console.error(`Failed to compute epoch ${epoch.name}:`, err);
        }
        // Delay between epochs to avoid rate limiting
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    // Compute current epoch leaderboard (always recompute since it changes)
    if (currentEpoch && subaccountIds.length > 0) {
      console.log(`\nComputing current epoch: ${currentEpoch.name}`);
      // Remove stale entry if exists
      const existingIdx = epochCache.findIndex(e => e.epochName === currentEpoch.name);
      if (existingIdx >= 0) {
        epochCache.splice(existingIdx, 1);
      }

      try {
        // Use "now" as the end timestamp for the current epoch
        const currentEpochWithNow = {
          ...currentEpoch,
          end: new Date().toISOString(),
        };
        // Compute target volume from DefiLlama chart (up to now)
        const targetVolume = dailyChart.length > 0
          ? computeEpochVolumeFromChart(dailyChart, currentEpoch.start, currentEpochWithNow.end)
          : undefined;
        const leaderboard = await fetchEpochLeaderboard(currentEpochWithNow, subaccountIds, allSubaccounts, targetVolume || undefined);
        // Store with original epoch boundaries for display
        leaderboard.epochName = currentEpoch.name;
        leaderboard.epochStart = currentEpoch.start;
        leaderboard.epochEnd = currentEpoch.end;
        epochCache.push(leaderboard);
        console.log(`Current epoch ${currentEpoch.name}: ${leaderboard.traders.length} traders, $${(leaderboard.totalVolume / 1e6).toFixed(1)}M volume`);
      } catch (err) {
        console.error(`Failed to compute current epoch ${currentEpoch.name}:`, err);
      }
    }

    // Sort epoch leaderboards chronologically
    epochCache.sort((a, b) => a.epochStart.localeCompare(b.epochStart));

    // Save final epoch cache
    saveEpochCache(epochCache);

    // Build final output
    const output = {
      ...data,
      epochLeaderboards: epochCache,
      generatedAt: new Date().toISOString(),
    };

    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'leaderboard.json');
    writeFileSync(outPath, JSON.stringify(output));

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const sizeMb = (Buffer.byteLength(JSON.stringify(output)) / 1024 / 1024).toFixed(2);

    console.log(`\n=== Generation complete ===`);
    console.log(`  Time: ${elapsed}s`);
    console.log(`  Traders: ${data.traders.length}`);
    console.log(`  Total users: ${data.totalUsers || 0}`);
    console.log(`  Open interest: $${((data.totalOpenInterest || 0) / 1e6).toFixed(1)}M`);
    console.log(`  Epoch leaderboards: ${epochCache.length} (${pastEpochs.length} past + ${currentEpoch ? '1 current' : '0 current'})`);
    console.log(`  Calculated all-time volume: $${(data.calculatedVolume || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
    console.log(`  Output: ${outPath} (${sizeMb} MB)`);

    // Print epoch summary
    console.log(`\n  Epoch breakdown:`);
    for (const e of epochCache) {
      const traderCount = e.traders.length.toString().padStart(5);
      const vol = `$${(e.totalVolume / 1e6).toFixed(1)}M`.padStart(12);
      console.log(`    ${e.epochName.padEnd(20)} ${traderCount} traders  ${vol}`);
    }

    console.log(`\nNext step: deploy with "npx vercel --prod"`);
  } catch (err) {
    console.error('Failed to generate data:', err);
    process.exit(1);
  }
}

main();
