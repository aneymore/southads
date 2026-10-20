#!/usr/bin/env node
import { syncAds } from './syncer.js';

async function main() {
  try {
    await syncAds();
    process.exit(0);
  } catch (err) {
    console.error('[Syncer CLI Error]', err);
    process.exit(1);
  }
}

main();
