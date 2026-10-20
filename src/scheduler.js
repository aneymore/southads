#!/usr/bin/env node
import cron from 'node-cron';
import { config } from './config.js';
import { syncAds } from './syncer.js';

console.log(`[Scheduler Daemon] Starting standalone sync scheduler...`);
console.log(`[Scheduler Daemon] Schedule: ${config.syncCron} (Every ${config.syncIntervalHours} hours)`);

let isSyncing = false;
async function executeSync() {
  if (isSyncing) {
    console.log('[Scheduler Daemon] Previous sync is still running. Skipping...');
    return;
  }
  isSyncing = true;
  try {
    await syncAds();
  } catch (err) {
    console.error('[Scheduler Daemon] Sync error:', err.message);
  } finally {
    isSyncing = false;
  }
}

// 시작 시 1회 실행
if (config.autoSyncOnStart) {
  executeSync();
}

// 주기적 실행 등록
cron.schedule(config.syncCron, () => {
  console.log(`[Scheduler Daemon] Triggering scheduled sync...`);
  executeSync();
});
