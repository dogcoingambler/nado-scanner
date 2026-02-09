#!/usr/bin/env npx tsx
/**
 * Generate static leaderboard data.
 *
 * Run this locally before deploying:
 *   npx tsx scripts/generate-data.ts
 *
 * This fetches all data from the Nado API and writes it to
 * public/data/leaderboard.json so the site can be fully static.
 *
 * Past epoch leaderboards are cached in public/data/epoch-cache.json
 * so they don't need to be re-fetched on subsequent runs.
 */

import {
  fetchDashboardData,
  fetchEpochLeaderboard,
  fetchAllSubaccounts,
  fetchDerivativesStats,
  computeEpochVolumesFromChart,
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

async function main() {
  const start = Date.now();
  console.log('Generating leaderboard data...');
  console.log('This scans ~39k subaccounts — may take several minutes.\n');

  try {
    // Step 1: Fetch main dashboard data (includes user growth, OI, volume)
    const data = await fetchDashboardData('all');

    // Step 2: Compute epoch leaderboards for past epochs
    console.log('\n=== Computing epoch leaderboards ===');
    const currentEpoch = getCurrentEpoch();
    const now = new Date();

    // Load cached epoch data
    let epochCache = loadEpochCache();
    const cachedNames = new Set(epochCache.map(e => e.epochName));

    // Determine which past epochs need computing
    const pastEpochs = EPOCHS.filter(e => new Date(e.end) <= now && e.name !== currentEpoch?.name);
    const uncachedEpochs = pastEpochs.filter(e => !cachedNames.has(e.name));

    if (uncachedEpochs.length === 0) {
      console.log(`All ${pastEpochs.length} past epochs already cached, skipping.`);
    } else {
      console.log(`Need to compute ${uncachedEpochs.length} new epoch(s): ${uncachedEpochs.map(e => e.name).join(', ')}`);

      // Wait before fetching to avoid rate limiting from the main data fetch
      console.log('Waiting 10s before epoch computation to avoid rate limiting...');
      await new Promise(r => setTimeout(r, 10000));

      // Fetch subaccounts with retry for epoch leaderboard computation
      let subaccounts;
      for (let attempt = 0; attempt < 3; attempt++) {
        subaccounts = await fetchAllSubaccounts(40000);
        if (subaccounts.length > 0) break;
        console.log(`Subaccount fetch returned 0 (attempt ${attempt + 1}/3), retrying in 15s...`);
        await new Promise(r => setTimeout(r, 15000));
      }
      if (!subaccounts || subaccounts.length === 0) {
        console.warn('Could not fetch subaccounts for epoch leaderboards, skipping.');
      }
      const subaccountIds = (subaccounts || []).map(s => s.subaccount);

      if (subaccountIds.length > 0) {
        for (const epoch of uncachedEpochs) {
          try {
            const leaderboard = await fetchEpochLeaderboard(epoch, subaccountIds);
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
    }

    // Sort epoch leaderboards chronologically
    epochCache.sort((a, b) => a.epochStart.localeCompare(b.epochStart));

    // Compute accurate per-epoch volumes from DefiLlama daily chart
    const derivStats = await fetchDerivativesStats();
    if (derivStats?.totalDataChart) {
      const epochChartVolumes = computeEpochVolumesFromChart(derivStats.totalDataChart, EPOCHS);
      for (const ep of epochCache) {
        const cv = epochChartVolumes.get(ep.epochName);
        if (cv !== undefined && cv > 0) {
          ep.chartVolume = cv;
          console.log(`  ${ep.epochName}: chartVolume=$${(cv / 1e9).toFixed(2)}B (Nado API=$${(ep.totalVolume / 1e9).toFixed(2)}B)`);
        }
      }
    }

    // Add generation metadata
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

    console.log(`\nDone in ${elapsed}s`);
    console.log(`  Traders: ${data.traders.length}`);
    console.log(`  Total users: ${data.totalUsers || 0}`);
    console.log(`  Open interest: $${((data.totalOpenInterest || 0) / 1e6).toFixed(1)}M`);
    console.log(`  Epoch leaderboards: ${epochCache.length}`);
    console.log(`  Calculated volume: $${(data.calculatedVolume || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
    console.log(`  Output: ${outPath} (${sizeMb} MB)`);
    console.log(`\nNext step: deploy with "npx vercel --prod"`);
  } catch (err) {
    console.error('Failed to generate data:', err);
    process.exit(1);
  }
}

main();
