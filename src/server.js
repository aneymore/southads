import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import fs from 'node:fs/promises';
import { config } from './config.js';
import { syncAds } from './syncer.js';

const app = express();

// CORS 활성화
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// 검색엔진 수집 및 색인 방지 (X-Robots-Tag)
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// robots.txt 제공
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nDisallow: /\n');
});

// 정적 이미지 서빙 (CORS 및 캐시 헤더 추가)
app.use('/creative', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cache-Control', 'public, max-age=86400');
  next();
}, express.static(config.storageDir));

/**
 * 광고 목록 제공 API
 * 원본 API(https://marblerouletteshop.com/api/ads/active)와 동일한 형식으로 반환
 */
app.get('/api/ads/active', async (req, res) => {
  try {
    const rawContent = await fs.readFile(config.outputApiFile, 'utf-8');
    const data = JSON.parse(rawContent);

    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });
    return res.status(200).json(data);
  } catch (err) {
    console.error('[Server] Failed to read cached ads file:', err.message);
    // 파일이 없거나 오류 발생 시 긴급 즉시 동기화 시도
    try {
      console.log('[Server] Attempting on-demand synchronization...');
      const freshData = await syncAds();
      res.set({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      });
      return res.status(200).json(freshData);
    } catch (syncErr) {
      console.error('[Server] On-demand sync also failed:', syncErr.message);
      return res.status(500).json({ error: 'Failed to retrieve active ads', message: syncErr.message });
    }
  }
});

/**
 * 광고 노출 신호 처리 API
 */
/*app.post('/api/ads/:id/impression', (req, res) => {
  const adId = req.params.id;
  console.log(`[Impression] Ad ID: ${adId} at ${new Date().toISOString()}`);
  res.status(204).end();
});*/

/**
 * 헬스 체크 엔드포인트
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    config: {
      sourceApiUrl: config.sourceApiUrl,
      storageDir: config.storageDir,
      syncIntervalHours: config.syncIntervalHours
    }
  });
});

// 스케줄러 등록 (기본값: 6시간마다 0 */6 * * *)
let isSyncing = false;
async function runScheduledSync() {
  if (isSyncing) {
    console.log('[Scheduler] Previous sync still in progress, skipping...');
    return;
  }
  isSyncing = true;
  try {
    console.log(`[Scheduler] Starting periodic sync at ${new Date().toISOString()}...`);
    await syncAds();
  } catch (err) {
    console.error('[Scheduler] Periodic sync failed:', err.message);
  } finally {
    isSyncing = false;
  }
}

// cron 스케줄 등록
cron.schedule(config.syncCron, () => {
  console.log(`[Cron Trigger] Triggered cron expression: ${config.syncCron}`);
  runScheduledSync();
});

// 서버 기동
const server = app.listen(config.port, async () => {
  console.log(`=================================================`);
  console.log(` Ads Server running on: http://localhost:${config.port}`);
  console.log(` Active Ads Endpoint:   http://localhost:${config.port}/api/ads/active`);
  console.log(` Creative Static Dir:   http://localhost:${config.port}/creative/`);
  console.log(` Sync Cron Schedule:    ${config.syncCron} (Every ${config.syncIntervalHours} hours)`);
  console.log(`=================================================`);

  // 시작 시 자동 동기화
  if (config.autoSyncOnStart) {
    console.log('[Startup] Executing initial ads synchronization...');
    await runScheduledSync();
  }
});

export default app;
