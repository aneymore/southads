# Marble Race 광고 (정적)

Marble Race(https://lazyque.github.io/) 가 읽는 광고 목록과 이미지. 서버 코드 없이 GitHub Pages 로만 서비스한다.

- `api/ads/active` — 광고 목록 JSON (확장자 없음). 게임이 60초마다 다시 받는다.
- `creative/` — 이미지. 광고판(`goal`)은 가로 4 : 세로 1, 로고(`preroll`, `result`)와 QR 은 정사각형.

광고를 바꾸려면 파일을 고쳐 `main` 에 push 하면 1~2분 뒤 반영된다. 형식 설명은 게임 저장소의 `docs/ad-server.md` 참고.
