# 온의 언어 : 한글

온 의사소통 연구소 — 엘코닌 박스로 배우는 한글 첫걸음. Vite + React 기반 PWA.

## 로컬 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
npm run preview   # 빌드 결과 로컬 확인
```

## PWA

- `manifest.webmanifest`는 `vite.config.js`의 `VitePWA` 설정에서 생성됩니다.
- 아이콘은 `public/icons/`, `public/apple-touch-icon.png`, `public/favicon.png`에 있습니다.
  (`make-icons.ps1`로 재생성 가능 — Node.js 없이 PowerShell만으로 동작)
- `display: standalone`, `orientation: any`로 설정되어 아이패드/태블릿 가로·세로 모두에서
  홈 화면 아이콘으로 실행 시 브라우저 주소창 없이 앱처럼 전체화면으로 뜹니다.
- 학습 기록은 `localStorage`(`mh-data` 키)에 저장됩니다.

## Vercel 배포

1. https://vercel.com 가입 후 로그인
2. 이 프로젝트를 GitHub 저장소로 push
3. Vercel 대시보드에서 "Add New… → Project" → 해당 저장소 선택
4. Framework Preset은 Vite로 자동 감지됨 (Build Command: `npm run build`, Output Directory: `dist`)
5. Deploy 클릭 → 완료 후 `https://프로젝트명.vercel.app` 주소 발급
