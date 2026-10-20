# SouthAds (Marble Race 광고 사이트 & 동기화 서비스)

[Marble Race](https://lazyque.github.io/)가 호출하는 광고 목록과 이미지를 제공하는 사이트입니다.
원본 광고 API(`https://marblerouletteshop.com/api/ads/active`)로부터 광고 데이터와 이미지를 6시간마다 자동으로 동기화하여 동일한 규격의 API 및 정적 파일로 서비스합니다.

---

## 📌 주요 특징

1. **원본과 100% 동일한 API 응답 규격**
   - 원본 API의 모든 메타데이터(`ads`, `creatives`, `wide`, `square`, `advertiser`, `tagline`, `qrImage`, `linkUrl`, `slots` 등)를 그대로 유지합니다.
   - 외부 이미지 URL만 로컬/정적 경로(`/creative/...`)로 안전하게 치환하여 서비스합니다.

2. **6시간 주기 자동 동기화 지원**
   - **GitHub Pages 정적 모드**: GitHub Actions Cron 워크플로(`.github/workflows/sync-ads.yml`)를 통해 6시간마다 자동으로 원본 데이터를 수집하고 최신 데이터로 커밋 & 갱신합니다.
   - **독립 API 서버 모드**: `node-cron` 내장 스케줄러를 통해 서버가 실행 중일 때 6시간마다 백그라운드 동기화를 수행합니다.

3. **환경변수 기반 유연한 설정**
   - 소스 URL, 저장 디렉토리, 출력 파일 경로, 서빙 포트, 크론 주기 등을 `.env`로 손쉽게 설정할 수 있습니다.

4. **CORS 및 캐시 헤더 최적화**
   - 모든 도메인(`Access-Control-Allow-Origin: *`)에서 브라우저 Mixed Content 또는 CORS 문제 없이 이미지를 캔버스에 로드할 수 있습니다.

---

## 📁 디렉토리 구조

```text
ads-site/
├── .github/
│   └── workflows/
│       └── sync-ads.yml      # 6시간 주기 자동 동기화 GitHub Actions 워크플로
├── api/
│   └── ads/
│       └── active            # 가공된 최종 광고 목록 JSON (확장자 없음)
├── creative/                 # 다운로드된 광고 이미지 저장 경로
├── src/
│   ├── config.js             # 환경변수 로더 및 설정
│   ├── syncer.js             # 데이터 수집, 이미지 다운로드, URL 치환 핵심 로직
│   ├── sync.js               # 1회성 동기화 CLI 스크립트
│   ├── scheduler.js          # 스케줄러 데몬 단독 실행 스크립트
│   └── server.js             # Express 기반 광고 API 서버
├── .env.example              # 환경변수 템플릿
├── .gitignore
├── package.json
└── README.md
```

---

## ⚙️ 환경변수 설정 (`.env`)

`.env.example`을 복사하여 `.env`를 구성합니다:

```bash
cp .env.example .env
```

| 환경변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `3100` | 로컬 API 서버 포트 |
| `SOURCE_API_URL` | `https://marblerouletteshop.com/api/ads/active` | 원본 광고 API 주소 |
| `STORAGE_DIR` | `./creative` | 다운로드한 이미지를 저장할 로컬 경로 |
| `OUTPUT_API_FILE` | `./api/ads/active` | 변환된 광고 JSON 데이터를 저장할 파일 경로 |
| `IMAGE_PUBLIC_PREFIX` | `/creative` | JSON 내 이미지 URL의 경로 접두사 |
| `SYNC_INTERVAL_HOURS`| `6` | 동기화 주기 (시간) |
| `SYNC_CRON` | `0 */6 * * *` | 크론 표현식 (기본 6시간 주기) |
| `AUTO_SYNC_ON_START` | `true` | 서버 시작 시 즉시 동기화 실행 여부 |

---

## 🚀 사용 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. 수동 즉시 동기화 (CLI)
원본 API에서 데이터를 가져와 이미지를 다운로드하고 `api/ads/active` 파일을 즉시 갱신합니다:
```bash
npm run sync
```

### 3. API 서버 실행 (개발/프로덕션)
서버를 띄우면 시작 시 1회 동기화를 수행하고, 이후 6시간마다 백그라운드에서 자동 갱신됩니다:
```bash
# 일반 실행
npm start

# 코드 변경 감지 개발 모드
npm run dev
```

서버 엔드포인트:
- `GET /api/ads/active` : 원본과 동일한 형태의 활성 광고 JSON 반환
- `GET /creative/:filename` : 광고 이미지 정적 파일 서빙
- `POST /api/ads/:id/impression` : 광고 노출 신호 처리 (204 No Content)
- `GET /health` : 서버 상태 및 설정 확인

### 4. 스케줄러 데몬 단독 실행 (서버 없이 주기적 동기화만 돌릴 때)
```bash
npm run schedule
```

---

## 🔄 GitHub Pages & GitHub Actions 자동 배포

저장소(`https://github.com/aneymore/southads`)에 푸시하면 `.github/workflows/sync-ads.yml`이 동작합니다:
- **자동 실행**: 매 6시간마다(`0 */6 * * *`) GitHub Actions가 원본 API를 호출하여 이미지와 `api/ads/active`를 최신으로 갱신 후 커밋합니다.
- **수동 실행**: GitHub 리포지토리의 `Actions` 탭 → `Sync Ads (Every 6 Hours)` → `Run workflow` 클릭으로 언제든 즉시 동기화할 수 있습니다.
- GitHub Pages가 켜져 있으면 게임 클라이언트는 별도의 추가 서버 없이도 항상 최신 광고 데이터를 받아갈 수 있습니다.
