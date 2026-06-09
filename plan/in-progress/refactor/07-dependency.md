# Refactor 백로그 — 의존성 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 2 / Major 4 / Minor 9.
> 전반 평가: NestJS 11 + Next.js 16 + TS 5.7 구성 합리적. lock 파일 존재로 재현성 확보.

## Critical

- [ ] **C-1 `jsonwebtoken` 이 devDependencies 인데 프로덕션 코드가 직접 import** — `backend/package.json:110` vs `src/modules/external-interaction/interaction-token.service.ts`
  dist 빌드가 devDependency 에 의존 — 프로덕션 컨테이너(`npm ci --omit=dev` 류)에서 모듈 누락 런타임 오류 가능.
  → `jsonwebtoken` + `@types/jsonwebtoken` 을 dependencies 로 이동, 또는 이미 dependencies 에 있는 `@nestjs/jwt` JwtService 기반으로 리팩토링해 직접 의존 제거.

- [ ] **C-2 hono override 버전이 CVE fix 미달** — `backend/package.json` overrides (`^4.12.18` → lock 상 4.12.19 설치)
  moderate CVE 4건의 취약 범위 `<=4.12.20` 에 포함: IPv6 IP restriction bypass(GHSA-xrhx-7g5j-rcj5), Set-Cookie injection(GHSA-3hrh-pfw6-9m5x), JWT scheme bypass(GHSA-f577-qrjj-4474), percent-encoded path routing(GHSA-2gcr-mfcq-wcc3).
  → `overrides.hono` 를 `^4.12.21` 로 상향 + `npm install` 재생성.

## Major

- [ ] **M-1 ts-jest ^29 + jest ^30 메이저 불일치 — 7개 패키지** — `backend/package.json`, `packages/{expression-engine,graph-warning-rules,chat-channel-validation,node-summary,web-chat-sdk,sdk}/package.json`
  ts-jest 30.x 는 미출시(latest 29.4.11) — Jest 30 내부 API 변화와의 호환성 갭, 무음 실패 위험.
  → (a) jest 를 `^29.7.0` 으로 정렬하거나 (b) `@swc/jest` 로 transform 교체 중 택일 (ts-jest 의 Jest 30 공식 지원 출시 시 재상향).

- [ ] **M-2 `@vitejs/plugin-react` 메이저 불일치 (frontend ^6 vs channel-web-chat ^4) + jsdom (^29 vs ^25)** — 양쪽 모두 React 19.2.4 사용 중이라 v4 유지 사유 없음.
  → channel-web-chat 을 `^6` / `^29` 로 통일.

- [ ] **M-3 `pdf-parse ^2.x` — 원작자와 다른 maintainer 의 포크 (공급망 리스크)** — `backend/package.json:73` (`@types/pdf-parse ^1.1.5` 가 v1 타입 참조하는 비대칭도 방증)
  → 원본 `^1.1.1` 회귀, 또는 `pdfjs-dist`/`pdf.js-extract` 평가, 최소한 v2 레포 코드 직접 검토 후 사용 결정.

- [ ] **M-4 `dayjs` 버전 스큐 — expression-engine(^1.11.13) vs backend/frontend(^1.11.20)** — `packages/expression-engine/package.json:14`
  `file:` 링크 패키지라 dayjs 인스턴스 2개 설치 시 `dayjs.extend` 플러그인 등록이 공유되지 않는 버그 가능.
  → `^1.11.20` 으로 상향 통일.

## Minor

- [ ] **m-1 `@types/node` 불일치 (frontend·sdk ^20 vs 실행환경 Node 22)** → `^22` 통일.
- [ ] **m-2 테스트 프레임워크 이원화 (Jest: backend·packages / Vitest: frontend·web-chat)** — M-1 과 결합 시 리스크 증폭 → 장기적으로 packages/* 를 Vitest 통일 검토.
- [ ] **m-3 frontend axios 사용 잔량 적음 (직접 import 4건 vs fetch 7건)** → native fetch + 공통 HttpError 유틸로 점진 교체 (~13KB min+gz 절감). `axios.isAxiosError` 타입가드 사용처 마이그레이션 포함.
- [ ] **m-4 마크다운 렌더러 이원화 (marked vs react-markdown)** — 두 앱 독립이라 즉각 문제는 없음 → sanitization 정책 동일성 문서화 우선.
- [x] **m-5 `@nestjs/config ^4` — NestJS 11 대응 정상 (기록용)** — 독립 versioning 으로 v4 가 NestJS 11 대응 릴리스임을 확인. 조치 불요 (2026-06-10 확인 완료).
- [ ] **m-6 버전 핀 정책 비일관 (channel-web-chat 만 exact pin)** → 정책을 `spec/conventions/` 또는 README 에 명시.
- [ ] **m-7 three.js 번들 (~600KB) — `graph-3d-renderer.tsx` 단일 사용처** → `next/dynamic({ ssr: false })` code-splitting 적용 여부 확인, 미적용 시 추가.
- [ ] **m-8 `engines.node` 미선언 (channel-web-chat·sdk 외)** → 전 패키지 `"engines": { "node": ">=22.0.0" }` 추가.
- [ ] **m-9 `otplib 12.0.1` — 2021년 이후 유지관리 정지** → 단기 유지 가능, 중기적으로 Web Crypto 기반 직접 구현(~50줄) 또는 활성 대안 교체 백로그.
