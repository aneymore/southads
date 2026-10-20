import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export const config = {
  port: parseInt(process.env.PORT || '3100', 10),
  sourceApiUrl: process.env.SOURCE_API_URL || 'https://marblerouletteshop.com/api/ads/active',
  storageDir: path.resolve(ROOT_DIR, process.env.STORAGE_DIR || './creative'),
  outputApiFile: path.resolve(ROOT_DIR, process.env.OUTPUT_API_FILE || './api/ads/active'),
  imagePublicPrefix: process.env.IMAGE_PUBLIC_PREFIX || '/creative',
  syncIntervalHours: parseInt(process.env.SYNC_INTERVAL_HOURS || '6', 10),
  syncCron: process.env.SYNC_CRON || '0 */6 * * *',
  autoSyncOnStart: process.env.AUTO_SYNC_ON_START !== 'false',
  rootDir: ROOT_DIR,
};
