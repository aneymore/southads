import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

/**
 * MIME 타입에 따른 파일 확장자 매핑
 */
const MIME_EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/x-icon': '.ico',
};

/**
 * URL에서 기본 확장자 추출
 */
function extractExtFromUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl, 'https://dummy.local');
    const ext = path.extname(parsed.pathname).toLowerCase();
    if (ext && ext.length <= 5) {
      return ext;
    }
  } catch {
    // ignore
  }
  return '';
}

/**
 * 안전한 파일 이름 조각으로 변환
 */
function sanitizeName(name) {
  return String(name).replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * 단일 이미지 다운로드 및 로컬 저장
 * @param {string} rawImageUrl 원본 이미지 URL (상대 또는 절대)
 * @param {string} sourceBaseUrl 원본 API 베이스 URL
 * @param {string} storageDir 저장할 로컬 디렉토리
 * @param {string} filenameBase 파일명 접두사 (확장자 제외)
 * @returns {Promise<string>} 저장된 파일명
 */
export async function downloadImage(rawImageUrl, sourceBaseUrl, storageDir, filenameBase) {
  // 상대 경로인 경우 sourceBaseUrl 기준으로 절대 경로 생성
  const absoluteUrl = rawImageUrl.startsWith('http://') || rawImageUrl.startsWith('https://')
    ? rawImageUrl
    : new URL(rawImageUrl, sourceBaseUrl).href;

  const res = await fetch(absoluteUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AdsSiteSyncer/1.0)',
      'Accept': 'image/*,*/*'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to download image: ${absoluteUrl} (HTTP ${res.status})`);
  }

  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  let ext = MIME_EXTENSIONS[contentType] || extractExtFromUrl(rawImageUrl) || '.png';

  const filename = `${filenameBase}${ext}`;
  const targetPath = path.join(storageDir, filename);

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 디렉토리 확인 및 생성
  await fs.mkdir(storageDir, { recursive: true });

  // 변경 사항이 있는 경우에만 덮어쓰거나 저장
  let shouldWrite = true;
  try {
    const existing = await fs.readFile(targetPath);
    if (existing.equals(buffer)) {
      shouldWrite = false;
    }
  } catch {
    // 파일이 없으면 쓰기 진행
  }

  if (shouldWrite) {
    await fs.writeFile(targetPath, buffer);
    console.log(`[Syncer] Saved image: ${filename} (${buffer.length} bytes)`);
  } else {
    console.log(`[Syncer] Image up-to-date (cached): ${filename}`);
  }

  return filename;
}

/**
 * 원본 API에서 광고 JSON 데이터를 가져와 이미지를 다운로드하고 경로를 치환하여 저장
 * @param {Object} options 사용자 지정 옵션 (기본값은 config 참조)
 */
export async function syncAds(options = {}) {
  const sourceApiUrl = options.sourceApiUrl || config.sourceApiUrl;
  const storageDir = options.storageDir || config.storageDir;
  const outputApiFile = options.outputApiFile || config.outputApiFile;
  const imagePublicPrefix = options.imagePublicPrefix || config.imagePublicPrefix;

  console.log(`\n========================================`);
  console.log(`[Syncer] Starting ads synchronization...`);
  console.log(`[Syncer] Time: ${new Date().toISOString()}`);
  console.log(`[Syncer] Source URL: ${sourceApiUrl}`);
  console.log(`[Syncer] Storage Directory: ${storageDir}`);
  console.log(`[Syncer] Output File: ${outputApiFile}`);
  console.log(`========================================\n`);

  // 1. 원본 API 호출
  const response = await fetch(sourceApiUrl, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; AdsSiteSyncer/1.0)'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ads from source: ${sourceApiUrl} (HTTP ${response.status})`);
  }

  const rawData = await response.json();
  if (!rawData || !Array.isArray(rawData.ads)) {
    throw new Error('Invalid ads format received: expected {"ads": [...]} structure');
  }

  console.log(`[Syncer] Received ${rawData.ads.length} ad(s) from source.`);

  // 2. 이미지 다운로드 및 경로 치환
  const cleanPrefix = imagePublicPrefix.replace(/\/$/, '');
  const updatedAds = [];

  for (let adIdx = 0; adIdx < rawData.ads.length; adIdx++) {
    const originalAd = rawData.ads[adIdx];
    const adId = sanitizeName(originalAd.id || `ad-${adIdx}`);
    const clonedAd = { ...originalAd };

    // creatives 슬롯 처리 (goal, preroll, result 등)
    if (originalAd.creatives && typeof originalAd.creatives === 'object') {
      const updatedCreatives = {};
      for (const [slot, imgList] of Object.entries(originalAd.creatives)) {
        if (Array.isArray(imgList)) {
          const updatedList = [];
          for (let imgIdx = 0; imgIdx < imgList.length; imgIdx++) {
            const rawImgUrl = imgList[imgIdx];
            if (typeof rawImgUrl === 'string' && rawImgUrl.trim()) {
              const baseName = `${adId}-${sanitizeName(slot)}-${imgIdx}`;
              const savedFilename = await downloadImage(rawImgUrl, sourceApiUrl, storageDir, baseName);
              updatedList.push(`${cleanPrefix}/${savedFilename}`);
            }
          }
          updatedCreatives[slot] = updatedList;
        } else {
          updatedCreatives[slot] = imgList;
        }
      }
      clonedAd.creatives = updatedCreatives;
    }

    // wide 필드 처리 (구 버전 호환성)
    if (Array.isArray(originalAd.wide)) {
      const updatedWide = [];
      for (let imgIdx = 0; imgIdx < originalAd.wide.length; imgIdx++) {
        const rawImgUrl = originalAd.wide[imgIdx];
        if (typeof rawImgUrl === 'string' && rawImgUrl.trim()) {
          const baseName = `${adId}-wide-${imgIdx}`;
          const savedFilename = await downloadImage(rawImgUrl, sourceApiUrl, storageDir, baseName);
          updatedWide.push(`${cleanPrefix}/${savedFilename}`);
        }
      }
      clonedAd.wide = updatedWide;
    }

    // square 필드 처리 (구 버전 호환성)
    if (Array.isArray(originalAd.square)) {
      const updatedSquare = [];
      for (let imgIdx = 0; imgIdx < originalAd.square.length; imgIdx++) {
        const rawImgUrl = originalAd.square[imgIdx];
        if (typeof rawImgUrl === 'string' && rawImgUrl.trim()) {
          const baseName = `${adId}-square-${imgIdx}`;
          const savedFilename = await downloadImage(rawImgUrl, sourceApiUrl, storageDir, baseName);
          updatedSquare.push(`${cleanPrefix}/${savedFilename}`);
        }
      }
      clonedAd.square = updatedSquare;
    }

    // qrImage 필드 처리
    if (typeof originalAd.qrImage === 'string' && originalAd.qrImage.trim()) {
      const baseName = `${adId}-qr`;
      const savedFilename = await downloadImage(originalAd.qrImage, sourceApiUrl, storageDir, baseName);
      clonedAd.qrImage = `${cleanPrefix}/${savedFilename}`;
    }

    updatedAds.push(clonedAd);
  }

  const finalData = {
    ...rawData,
    ads: updatedAds
  };

  // 3. 출력 JSON 파일 저장
  const outputDir = path.dirname(outputApiFile);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputApiFile, JSON.stringify(finalData, null, 2), 'utf-8');

  console.log(`[Syncer] Successfully saved synchronized ads JSON to: ${outputApiFile}`);
  console.log(`[Syncer] Synchronization finished successfully.\n`);

  return finalData;
}
