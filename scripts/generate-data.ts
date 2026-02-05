#!/usr/bin/env npx tsx
/**
 * Generate static leaderboard data.
 *
 * Run this locally before deploying:
 *   npx tsx scripts/generate-data.ts
 *
 * This fetches all data from the Nado API and writes it to
 * public/data/leaderboard.json so the site can be fully static.
 */

import { fetchDashboardData } from '../src/lib/nado-client';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function main() {
  const start = Date.now();
  console.log('Generating leaderboard data...');
  console.log('This scans ~39k subaccounts — may take 1-2 minutes.\n');

  try {
    const data = await fetchDashboardData('all');

    // Add generation metadata
    const output = {
      ...data,
      generatedAt: new Date().toISOString(),
    };

    const outDir = join(__dirname, '..', 'public', 'data');
    mkdirSync(outDir, { recursive: true });

    const outPath = join(outDir, 'leaderboard.json');
    writeFileSync(outPath, JSON.stringify(output));

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const sizeMb = (Buffer.byteLength(JSON.stringify(output)) / 1024 / 1024).toFixed(2);

    console.log(`\nDone in ${elapsed}s`);
    console.log(`  Traders: ${data.traders.length}`);
    console.log(`  Calculated volume: $${(data.calculatedVolume || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
    console.log(`  Output: ${outPath} (${sizeMb} MB)`);
    console.log(`\nNext step: deploy with "npx vercel --prod"`);
  } catch (err) {
    console.error('Failed to generate data:', err);
    process.exit(1);
  }
}

main();
