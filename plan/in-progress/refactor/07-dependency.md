# Refactor 백로그 — 의존성 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 2 / Major 4 / Minor 9 — **spec/문서 대조(2026-06-10) 후 유효 9건 / 철회·종결 5건(M-1, M-3, m-3, m-5, m-7)**. C-1 은 Critical→Major 재분류.
> **spec 대조 판정 분포**: A 1 (m-9) / B 5 / C 2 (m-1, m-8 — Node 버전 문서 괴리) / D 2 / E 4. (registry/lock 실측 기반 — `npm audit`·`npm view` 실행 검증.)
> 전반 평가: NestJS 11 + Next.js 16 + TS 5.7 구성 합리적. lock 파일로 재현성 확보.

## Critical → Major 재분류

- [ ] **C-1 [Critical→M] `jsonwebtoken` devDependencies 분류 오류 — 단 현재 런타임 오류는 미발현** — `backend/package.json:110` vs `interaction-token.service.ts:8-13`
  - **spec 대조**: B — EIA spec(§3.3/§7.3/§8.3)은 토큰 설계(HS256, sub/aud/exp/jti)만 규정 — 라이브러리 무관. **심각도 정정**: lock 실측 결과 `@nestjs/jwt@11.0.2`(prod dep)가 `jsonwebtoken: 9.0.3` 을 전이 설치 → `Dockerfile:43` 의 `npm prune --omit=dev` 후에도 유지 — **현재 프로덕션 오류 없음** (전이 의존에 우연히 기대는 fragile 상태). Critical → Major.
  - **개선 방안**: 1. (최소) `jsonwebtoken` 을 dependencies 로 이동 (`@types/jsonwebtoken` 은 devDeps 유지 가능) + `npm install` lock 재생성. 2. (구조, 선택) 이미 prod dep 인 `@nestjs/jwt` `JwtService` 로 교체 — websocket·webauthn 모듈이 이미 사용 중이라 일관성 개선. 에러 클래스 re-export(`TokenExpiredError`) 여부는 구현 시 확인.
  - 검증: `npm run build && npm test -- interaction-token` + Docker 빌드 후 `node -e "require('jsonwebtoken')"` smoke + EIA e2e. / 회귀 위험: 방안 1 은 ~0, 방안 2 는 `reason: 'expired'|'malformed'` 매핑 회귀 — unit 선행. / spec 갱신: 불요.

- [ ] **C-2 hono override 버전이 CVE fix 미달 — 실노출면 낮음(클라이언트 전용)** — `backend/package.json` overrides
  - **spec 대조**: B — hono 는 `@modelcontextprotocol/sdk`(spec `11-mcp-client.md:525` 가 채택 명시)의 **전이 의존**. override `^4.12.18` 핀 결정의 근거 기록은 spec/plan/git 어디에도 없음. `npm audit` 실측으로 CVE 4건 재확인(모두 patched `>=4.12.21`). **단 backend 는 MCP client 로만 SDK 사용 — hono 서버를 띄우지 않아 4건(IP restriction/Set-Cookie/JWT middleware/path routing) 모두 서버 기능 취약점이라 실공격면 거의 없음** — audit-clean 목적의 저비용 정리.
  - **개선 방안**: 1. `overrides.hono` → `^4.12.21` + `npm install`. 2. `npm audit` 로 4건 소거 확인. 3. override 사유를 package.json 인접 주석 또는 본 항목에 기록 (m-6 핀 정책과 묶음).
  - 검증: build + MCP client unit + `make e2e-test` + audit 0 moderate. / 회귀 위험: patch 상향 — 매우 낮음. / spec 갱신: 불요.

## Major

- [x] ~~**M-1 ts-jest ^29 + jest ^30 메이저 불일치 (7개 패키지)**~~ — **철회 (2026-06-10 registry 실측)**
  - **사유**: E — `ts-jest@29.4.6` 의 peerDependencies = `"jest": "^29.0.0 || ^30.0.0"` — **ts-jest 29.4.x 가 곧 Jest 30 공식 지원 라인** (ts-jest 는 Jest 메이저와 버전을 정렬하지 않음 — versioning 오해). 현 조합으로 전 패키지 테스트 통과 중. (선택 cosmetic: 7개 패키지의 ts-jest 선언을 `^29.4.10` 으로 통일.)

- [ ] **M-2 `@vitejs/plugin-react` 메이저 불일치 (^6 vs ^4) + jsdom (^29 vs ^25)** — `channel-web-chat/package.json`
  - **spec 대조**: B — channel-web-chat spec/README/plan 에 버전 결정 기록 없음 — 생성 시점 스캐폴드 잔재. 둘 다 React 19.2.4 + vitest 4 메이저 — 통일 비용 낮음.
  - **개선 방안**: 1. `@vitejs/plugin-react` `^4` → `^6.0.1`, `jsdom` `^25` → `^29.0.1` + `npm install`. 2. (주의) channel-web-chat 은 worktree 에서 node_modules 실복사 환경 — 로컬 재설치 필요.
  - 검증: `npm run test && npm run build && npm run typecheck`. / 회귀 위험: jsdom 25→29 DOM 거동 변화로 단위 테스트 일부 깨질 수 있음 — 테스트 한정, 런타임 무관. / spec 갱신: 불요.

- [x] ~~**M-3 `pdf-parse ^2.x` — 타 maintainer 포크 (공급망 리스크)**~~ — **철회 (2026-06-10 registry 실측)**
  - **사유**: E — npm maintainer 는 `mehmet.kozan` 단독이며 **v1.1.1(2018)과 v2 전 버전을 같은 계정이 발행** — "원작자와 다른 maintainer 의 포크" 가 registry 데이터와 불일치 (원작자 본인의 v2 리라이트). 라이브러리 채택 자체는 spec 명시(`3-ai/_product-overview.md:159`, `8-embedding-pipeline.md:67`).
  - (잔여 정리) `@types/pdf-parse ^1.1.5` 는 **사실상 미사용** — `pdf.parser.ts:15` 가 인라인 캐스트로 자가 타입 정의. → `npm uninstall @types/pdf-parse` 또는 v2 번들 타입으로 정식 import 전환. 검증: `npm run build && npm test -- pdf.parser`.

- [ ] **M-4 `dayjs` 버전 스큐 — 현재 미발현(단일 dedupe), 예방 정렬** — `packages/expression-engine/package.json:14`
  - **spec 대조**: B — 버전 기록 없음. **보정**: lock 실측 — `^1.11.13 ∩ ^1.11.20` → 1.11.20 단일 dedupe (인스턴스 2개 아님). `dayjs.extend` 사용처도 backend transform.handler 1곳뿐(expression-engine 은 plugin 미사용) — 원안의 plugin 공유 버그는 현재 미발현. 향후 backend 가 ^1.12 로 가는 순간 중첩 설치 발생 — 예방 차원 유효, 긴급도 낮음.
  - **개선 방안**: 1. expression-engine 의 dayjs → `^1.11.20` + 3개 lock 재생성.
  - 검증: expression-engine `npm test` + backend unit(transform customParseFormat 경로). / 회귀 위험: patch 수준 — 매우 낮음. / spec 갱신: 불요.

## Minor

- [ ] **m-1 `@types/node` 불일치 — 단 "Node 22" 전제 자체가 문서 괴리 (floor 결정 선행)** — frontend `^20`, sdk `^20.0.0`, backend `^22.10.7`
  - **spec 대조**: **C(문서 괴리)** — 원안 전제 "실행환경 Node 22" 가 어느 문서와도 불일치: Dockerfile 은 `node:24-alpine`, CI `node-version: '24'`, README:88 "Node.js 20+", `.nvmrc` 없음. 타입을 floor(20)에 맞출지 운영(24)에 맞출지 **결정이 선행**돼야 하는 항목.
  - **개선 방안**: 1. Node 지원 floor 결정 (권장: 운영·CI 와 일치하는 24 를 운영 기준으로, README "20+" 단일화 여부 포함) — **m-8 과 한 PR**. 2. 결정값으로 backend/frontend/sdk `@types/node` 동일 메이저 통일 + `npm install`. 3. README:88 동기화.
  - 검증: 각 패키지 build + unit. / 회귀 위험: 타입 상향 신규 컴파일 에러(빌드가 즉시 검출). / spec 갱신: 불요 (README/PROJECT.md 영역).

- [ ] **m-2 테스트 프레임워크 이원화 — "장기 통일" 에서 "정책 문서화" 로 축소** —
  - **spec 대조**: D — `PROJECT.md:26` 이 이원화를 **현황으로 명시** (run-test.sh wrapper 가 양쪽을 묶어 운용). M-1 철회로 "결합 시 리스크 증폭" 논거 소멸 — 통일 편익이 마이그레이션 비용을 정당화 못 함 (생태계 기본값 준수가 사실상 의도).
  - **개선 방안**: 1. PROJECT.md §빌드·테스트에 1줄 정책 추가: "backend·packages=jest / frontend·channel-web-chat=vitest, 신규 패키지는 소속 스택을 따른다". 2. packages/* vitest 이행은 별도 트리거(jest 가 막는 ESM 의존 등장) 전까지 보류.
  - 검증: 문서 변경뿐. / spec 갱신: 불요 (PROJECT.md 가 SoT).

- [x] ~~**m-3 frontend axios 잔량 적음 → fetch 통일**~~ — **철회 (2026-06-10 실측 — 전제 수치 오류)**
  - **사유**: E — 실측: axios import **11개 파일** vs fetch 5개 파일. `lib/api/client.ts` 가 `axios.create` 기반 **중앙 apiClient** (withCredentials·커스텀 paramsSerializer — backend ValidationPipe 호환 주석 명시·workspace 헤더 주입) — axios 가 주 경로, fetch 가 잔량. fetch 전환은 interceptor·직렬화·타입가드 전면 재구현의 중규모 마이그레이션 — ~13KB 절감 대비 비용 과대.
  - (역방향 대체 후보) 산발 fetch 5건을 apiClient 로 수렴하는 일원화 — 단 SSE/스트리밍(assistant) 은 fetch 유지 필수. 필요 시 별건 등재.

- [ ] **m-4 마크다운 렌더러 이원화 — sanitize 정책 매트릭스 문서화가 본체** — marked(web-chat) vs react-markdown(frontend assistant 패널 1곳)
  - **spec 대조**: D — web-chat 측 선택은 문서화됨(README:68, plan, `4-security.md:34` 가 sanitize 의무를 위젯 책임으로 명시). frontend 측은 무문서. 번들 환경이 달라(경량 CSR vs React 트리) 이원화 자체는 합리 — "문서화 우선" 결론 유지.
  - **개선 방안**: 1. `spec/7-channel-web-chat/4-security.md` sanitize 행에 정책 매트릭스 1절 (위젯: marked+DOMPurify allowlist·noopener / 메인 앱: react-markdown 기본 escape·raw HTML 미허용) — **planner 위임**. 2. 양쪽 XSS unit 을 동일 페이로드 셋(script 주입·`javascript:` 링크·이벤트 핸들러 속성)으로 정렬.
  - 검증: `npm test -- safe-html` + `npm test -- markdown-renderer`. / spec 갱신: 위 1 이 본체 (planner).

- [x] **m-5 `@nestjs/config ^4` — NestJS 11 대응 정상 (기록용)** — 독립 versioning 확인, 조치 불요 (2026-06-10).

- [ ] **m-6 버전 핀 정책 비일관 — "패키지 내부까지 비일관" 으로 보정** —
  - **spec 대조**: B — 핀 정책 문서 0건. **보정**: channel-web-chat 도 전부 exact 아님(dompurify/marked/react 만 exact, next 는 caret) + frontend 에 `three ~0.184.0` tilde — 패키지 *내부*까지 비일관.
  - **개선 방안**: 1. PROJECT.md 에 3줄 정책: (a) 기본 caret, (b) lock 이 재현성 SoT, (c) exact/tilde 는 사유 주석 필수(예: three 는 0.x semver 특성). 2. 정책 확정 후 web-chat 의 exact 들을 caret 완화하거나 사유 명기.
  - 검증: web-chat install+test+build. / 회귀 위험: lock 고정이라 즉시 영향 없음. / spec 갱신: 불요 (PROJECT.md).

- [x] ~~**m-7 three.js 번들 — dynamic import 적용 확인**~~ — **종결 = 기적용 확인 (2026-06-10)**
  - **사유**: E — `graph-visualization.tsx:31` 에서 `dynamic(() => import("./graph-3d-renderer"), ...)` + docstring "부모에서 next/dynamic + ssr:false 로 lazy load" — **이미 적용됨**. (선택: 빌드 청크 리포트에서 three 분리 1회 확인.)

- [ ] **m-8 `engines.node` 미선언 — floor 결정 선행 (제안값 22 는 출처 불명)** —
  - **spec 대조**: **C(문서 괴리)** — 원안 `>=22.0.0` 이 README("20+")·기존 선언(web-chat/sdk `>=20`)·운영(`node:24`) 어느 쪽과도 불일치. m-1 과 동일한 floor 결정 선행 — README·engines·@types/node 를 단일 결정으로 정렬.
  - **개선 방안**: 1. floor 결정 — **`packages/sdk` 는 외부 배포 의도(`@workflow/sdk`)가 있으므로 보수적 floor(>=20) 유지 권장**, 내부 앱(backend/frontend/내부 packages)만 운영 floor. 2. 결정값으로 미선언 패키지에 `engines` 추가. 3. m-1·README 와 같은 PR.
  - 검증: `npm install` 경고 없음(engines 는 advisory — engine-strict 미사용 확인) + CI. / 회귀 위험: 거의 없음. / spec 갱신: 불요.

- [ ] **m-9 otplib — "유지관리 정지" 전제 오류, 올바른 조치는 ^13 업그레이드** ⚠️ **(A — 라이브러리 선택은 spec 명시)** — `backend/package.json:68` (v12.0.1)
  - **spec 대조**: **A** — `1-data-model.md:66` "two_factor_secret | TOTP secret (**otplib base32**)" — spec 데이터 모델이 otplib 지정. **전제 반증**: otplib 는 활발히 유지 중 — 13.0.2(2026-01)~13.4.1(2026-05-30) 연속 릴리스. "2021년 정지" 는 v12 라인 한정 과거 사실. **남는 문제**: 사용 버전이 4년 stale 한 12.0.1 — 직접 구현(원안)이 아니라 **^13 메이저 업그레이드**가 올바른 조치. **사용자 보고 대상(기존 secret 호환성 게이트).**
  - **개선 방안**: 1. 항목을 "otplib ^13 업그레이드" 로 재정의 — 영향 코드는 `totp.service.ts` 단일 파일(4 API: options/generateSecret/keyuri/check), v13 의 import 경로·crypto 플러그인(`@otplib/plugin-crypto-noble`·base32-scure) 재편 대응. 2. **게이트: 기존 발급 secret 호환성** — v12 발급 base32 secret 이 v13 디코딩과 동일한지 cross-version 회귀 테스트 (기존 사용자 2FA lockout 방지). 3. `npm install otplib@^13` + totp unit + 2FA e2e.
  - 검증: `npm test -- totp` + 2FA 가입·로그인 e2e + v12 secret cross-version check 케이스. / 회귀 위험: **중간** — secret 인코딩/기본 옵션(window·step) 차이 = 사용자 lockout. cross-version 테스트 선행 필수. / spec 갱신: 불요 ("otplib base32" 표기는 버전 무관).
