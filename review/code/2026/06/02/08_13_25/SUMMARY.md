# Code Review 통합 보고서

**대상**: channel-web-chat-followups D#3~D#7 (embed-config soft 검증, presentation 렌더, 토큰 자동갱신, BYO-UI headless, CI wiring)
**리뷰 일시**: 2026-06-02 08:13:25

---

## 전체 위험도

**MEDIUM** — 보안·요구사항·유저가이드 영역에서 WARNING 11건이 발견됨. CRITICAL 없음. 즉각 수정이 필요한 XSS 경로(javascript: 스킴)와 spec-impl 갭(waiting_for_input presentations, authConfigId 필터 누락), 사용자 가시 기능의 가이드 문서 미비가 주요 이슈.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 보안 | link 버튼 URL에 프로토콜 검증 누락 — `javascript:` 스킴 삽입 시 XSS 경로 | `channel-web-chat/src/widget/components/presentations.tsx` `ButtonBar`, `src/lib/presentation.ts` `asButtons()` | `asButtons()`에서 `https:`/`http:` 프로토콜만 허용하는 `isSafeUrl()` 필터 적용 |
| W2 | 보안 | embed allowlist soft 검증이 client-side JS에만 의존 — JavaScript 수정 시 우회 가능 | `channel-web-chat/src/widget/use-widget.ts` `isEmbedAllowed()` | fail-open + client-side 특성을 API 응답 설명 및 운영 문서에 명시; hard 차단 필요 시 opt-in `frame-ancestors` CSP 안내 |
| W3 | 요구사항 | `waiting_for_input` 이벤트의 presentations 렌더 미구현 — spec §1-widget-app §2 갭 | `channel-web-chat/src/widget/use-widget.ts` `handleEiaEvent`, `src/lib/eia-types.ts` `WaitingForInputEvent` | spec 의미 명확화 후 `WaitingForInputEvent`에 `presentations` 필드 추가 및 handler 처리 로직 구현 |
| W4 | 요구사항 | `EmbedConfigService.resolve`에 `authConfigId IS NULL` 공개 webhook 필터 누락 — 인증 webhook의 allowlist 정보 공개 노출 | `backend/src/modules/hooks/embed-config.service.ts` L38 `where: { endpointPath, type: 'webhook' }` | `where` 조건에 `authConfigId: IsNull()` 추가 또는 의도적이라면 서비스 주석에 근거 명시 |
| W5 | 아키텍처 | `EmbedConfigService`가 `Workspace` 엔티티에 직접 의존 — workspaces 모듈 경계 경미 우회 | `backend/src/modules/hooks/embed-config.service.ts` `@InjectRepository(Workspace)` | 현재 수준 허용 가능; 장기적으로 `WorkspacesModule`에 `getEmbedConfig` 인터페이스 캡슐화 검토 |
| W6 | 테스트 | `widget-app.test.tsx`의 `document.referrer` 전역 상태 복원이 `try/finally` 없이 취약 — 어설션 실패 시 이후 테스트 오염 | `channel-web-chat/src/widget/widget-app.test.tsx` 임베드 불허 테스트 | `afterEach` 또는 `try/finally`로 복원 보장 |
| W7 | 유저가이드 | 신규 embed-config 공개 엔드포인트 — `interactionAllowedOrigins` 설정 효과(위젯 전면 차단) 가이드 미존재 | `backend/src/modules/hooks/hooks.controller.ts` 신규 `GET :endpointPath/embed-config` | `frontend/src/content/docs/06-integrations-and-config/web-chat.{mdx,en.mdx}` 신설 또는 기존 workspaces 페이지에 설명 추가 |
| W8 | 유저가이드 | 채널 web-chat 통합 기능(embed allowlist, rich presentations, BYO-UI) — 통합 가이드 페이지 미존재 | `channel-web-chat/src/widget/`, `packages/web-chat-sdk/README.md` 전반 | `frontend/src/content/docs/06-integrations-and-config/web-chat.{mdx,en.mdx}` 신설 — 스니펫, allowlist 설정, presentation 노드 사용법, BYO-UI 포함 |
| W9 | API 계약 | fail-open degrade 정책(`allowlist:[], enforce:false` + HTTP 200)이 Swagger 에러 계약에 미반영 | `backend/src/modules/hooks/hooks.controller.ts` `getEmbedConfig()` | `@ApiOperation` description에 fail-open 정책 명시; `@ApiInternalServerErrorResponse` 추가 |
| W10 | API 계약 | `Cache-Control: public, max-age=300` 응답 헤더가 Swagger API 계약에 누락 | `backend/src/modules/hooks/hooks.controller.ts` `getEmbedConfig()` | `@ApiResponse` headers에 `Cache-Control` 명시 |
| W11 | 의존성 | `byo-ui-headless.ts`가 `@workflow/sdk`를 import하나 `package.json`에 미선언 — 예제 실행 시 모듈 해석 실패 | `packages/web-chat-sdk/examples/byo-ui-headless.ts` L1 | `devDependencies`에 `"@workflow/sdk": "file:../sdk"` 추가 또는 실행 전 수동 설치 안내 주석 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 보안 | embed config `Cache-Control: max-age=300` — allowlist 변경 후 최대 5분 반영 지연 | `backend/src/modules/hooks/hooks.controller.ts` L510 | spec §3-① 또는 운영 문서에 캐시 지연 명시 |
| I2 | 보안 | `detectHostOrigin` — `document.referrer` 폴백의 신뢰성 한계(referrer-policy에 따라 fail-open) | `channel-web-chat/src/widget/use-widget.ts` `isEmbedAllowed()` | soft 검증 한계로 문서화 수용 |
| I3 | 보안 | `EmbedConfigService.resolve` — DB 오류 시 allow-all degrade | `backend/src/modules/hooks/embed-config.service.ts` catch 블록 | 운영 문서에 "DB 장애 시 allowlist 검증 비활성" 동작 명시 |
| I4 | 보안 | 카루셀 이미지 `src` 프로토콜 검증 누락 — mixed content 가능성 | `channel-web-chat/src/widget/components/presentations.tsx` `CarouselView` L108 | `isSafeUrl()` 필터 또는 `img-src https:` CSP 설정 검토 |
| I5 | 보안 | CI 워크플로우 `actions/checkout@v5`, `actions/setup-node@v6` — 공식 릴리스 태그 확인 권고 | `.github/workflows/web-chat-checks.yml` L121, L126, L145, L150 | 실제 릴리스 태그 확인; 보안 환경에서 SHA 고정 |
| I6 | 요구사항 | `PieSlices` — 단일 슬라이스(100%) 시 SVG arc 렌더 실패 엣지케이스 | `channel-web-chat/src/widget/components/presentations.tsx` `PieSlices` L286-299 | 단일 슬라이스 시 `<circle>` 대체 렌더 또는 테스트 추가 |
| I7 | 요구사항 | `Cache-Control: max-age=300` 수치가 spec에 미명시 | `backend/src/modules/hooks/hooks.controller.ts` L511 | spec §3-①에 max-age 허용 범위 수치 기재 (project-planner 위임) |
| I8 | 요구사항 | `classifyPresentation` — `output.data` 배열 존재로 chart 판별 시 미래 신규 타입 false-positive 가능성 | `channel-web-chat/src/lib/presentation.ts` L89 | 장기적으로 envelope에 명시적 `type` 필드 추가 검토 |
| I9 | 성능 | `PieSlices` O(n²) prefix-sum — 슬라이스 수 적어 실질 무해 | `channel-web-chat/src/widget/components/presentations.tsx` `PieSlices` | 필요 시 O(n) 누적 루프로 단순화 가능 |
| I10 | 성능 | `EmbedConfigService.resolve` — trigger→workspace 순차 2-hop DB 조회, 서버 레벨 인메모리 캐시 없음 | `backend/src/modules/hooks/embed-config.service.ts` | CDN 캐시 의존 설계로 현재 허용 가능; 트래픽 증가 시 NestJS CacheModule 또는 JOIN 쿼리 검토 |
| I11 | 아키텍처 | `EmbedAllowlist`와 `EmbedConfigDto` 이중 정의 — 단일 진실 원칙 경미 위반 | `backend/src/modules/hooks/embed-config.service.ts`, `dto/responses/embed-config.dto.ts` | `EmbedConfigDto extends EmbedAllowlist` 패턴으로 단일화 |
| I12 | 아키텍처 | `classifyPresentation` — spec zod schema와 직접 연결되지 않는 shape 기반 분류 | `channel-web-chat/src/lib/presentation.ts` | 현재 테스트 커버리지 수준에서 허용 가능; 백엔드 `type` 필드 추가 시 명시 필드 우선 분기 권장 |
| I13 | 테스트 | `conversation.test.ts` — presentations-only turn, text+presentations 동시 존재 등 신규 경로 미커버 | `channel-web-chat/src/lib/conversation.test.ts` | 3개 케이스(presentations-only, text+presentations, presentations:[]) 추가 |
| I14 | 테스트 | `widget-state.test.ts` — `AI_MESSAGE presentations` 전파 경로 미테스트 | `channel-web-chat/src/lib/widget-state.test.ts` | presentations 있는 `AI_MESSAGE` dispatch 및 빈 배열 케이스 추가 |
| I15 | 테스트 | `presentation.test.ts` — `toTable` config.columns/rows 폴백 경로 미테스트 | `channel-web-chat/src/lib/presentation.test.ts` | config.columns / config.rows 폴백 케이스 추가 |
| I16 | 유지보수성 | `ChartView` SVG 매직 넘버(W=280)가 `styles.ts`와 분산 — 한쪽만 변경 시 불일치 | `channel-web-chat/src/widget/components/presentations.tsx` `ChartView` | `CHART_SVG_W/H/PAD` 상수로 추출, `styles.ts`와 동기화 주석 추가 |
| I17 | 유지보수성 | `hooks.controller.ts` 인라인 매직 넘버 `300` (Cache-Control max-age) | `backend/src/modules/hooks/hooks.controller.ts` | `const EMBED_CONFIG_CACHE_SEC = 300`으로 추출 |
| I18 | 유지보수성 | `EmbedConfigService.resolve` — `settings?.['interactionAllowedOrigins']` 브라켓 접근 오타 취약성 | `backend/src/modules/hooks/embed-config.service.ts` | `Workspace.settings` 타입에 `interactionAllowedOrigins?: string[]` 추가 또는 상수 추출 |
| I19 | 문서화 | `toCarousel/toTable/toChart/toTemplate` 공개 변환 함수 JSDoc 없음 | `channel-web-chat/src/lib/presentation.ts` | 각 함수에 주요 동작 분기(dynamic/static 폴백, 기본값 클램프) 기술하는 JSDoc 추가 |
| I20 | 문서화 | `HeadlessChat` 인터페이스의 `end`(서버 신호)와 `close`(SSE 해제만) 차이 미문서화 | `packages/web-chat-sdk/examples/byo-ui-headless.ts` `HeadlessChat` | 각 멤버에 용도 명확화 JSDoc 추가 |
| I21 | 문서화 | `widget-state.ts` `BLOCKED` action `reason` 허용 값 범위 미정의 | `channel-web-chat/src/lib/widget-state.ts` | `reason?: "origin_not_allowed" | string` 리터럴 유니온 또는 JSDoc 기술 |
| I22 | 데이터베이스 | `Trigger.endpointPath` + `type` 복합 조건 인덱스 존재 여부 미확인 | `backend/src/modules/hooks/embed-config.service.ts` L351-354 | `Trigger` 엔티티 정의에 `@Index(['endpointPath', 'type'])` 존재 확인 |
| I23 | 동시성 | `refreshToken` `.catch()` 빈 블록 — 갱신 실패 시 운영 추적 불가 | `channel-web-chat/src/widget/use-widget.ts` setTimeout 콜백 | `console.warn` 또는 logger 수준 로깅 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | link 버튼 URL javascript: 스킴 XSS 경로(W1), embed soft 검증 client-side 우회(W2) |
| requirement | MEDIUM | waiting_for_input presentations 미구현(W3), authConfigId IS NULL 필터 누락(W4) |
| user_guide_sync | MEDIUM | web-chat 통합 가이드 페이지 미존재(W7, W8) |
| architecture | LOW | Workspace 엔티티 직접 의존(W5), EmbedAllowlist/DTO 이중 정의(I11) |
| api_contract | LOW | fail-open 정책 Swagger 미반영(W9), Cache-Control 헤더 미반영(W10) |
| scope | LOW | document.referrer 복원 취약(W6), package-lock.json 미커밋 잔존 주의 |
| dependency | LOW | byo-ui-headless.ts @workflow/sdk 미선언(W11) |
| testing | LOW | document.referrer 복원 불안정(W6), presentations 신규 경로 미커버(I13-I15) |
| documentation | LOW | 공개 변환 함수 JSDoc 누락(I19-I21) |
| database | LOW | 2-hop 순차 쿼리(I10), 인덱스 확인 필요(I22) |
| performance | NONE | 전반적 양호; O(n²) prefix-sum 등 INFO 수준 |
| maintainability | NONE | SVG 매직 넘버, applyConfig 책임 혼합 등 INFO 수준 |
| concurrency | NONE | JavaScript 싱글스레드 환경, cancelled 플래그 정상 적용 |
| side_effect | (파일 없음) | 결과 파일 미존재로 읽지 못함 |

---

## 발견 없는 에이전트

- **concurrency**: 실질 위험 없음 — JavaScript 이벤트 루프 특성상 경쟁 조건 없음, CI concurrency 설정 적절
- **performance**: 전반 양호 — 외부 차트 라이브러리 미사용(번들 크기 절감), 캐시 설계 적절
- **maintainability**: CRITICAL/WARNING 없음 — 헬퍼 함수 추출·상수화 일관 적용

---

## 권장 조치사항

1. **(즉각 수정)** `asButtons()`에 `isSafeUrl()` 프로토콜 필터 추가 — `javascript:` 스킴 XSS 차단 (W1)
2. **(즉각 수정)** `widget-app.test.tsx` `document.referrer` 복원을 `afterEach` / `try/finally`로 보호 (W6)
3. **(즉각 수정)** `byo-ui-headless.ts` `@workflow/sdk` — `package.json` `devDependencies`에 선언 추가 또는 실행 전 수동 설치 안내 주석 (W11)
4. **(spec 확인 후 수정)** `EmbedConfigService.resolve`에 `authConfigId: IsNull()` 조건 추가 — 인증 webhook allowlist 정보 공개 노출 방지 (W4)
5. **(spec 확인 후 수정)** `WaitingForInputEvent`에 `presentations` 필드 추가 및 handler 처리 구현 (W3)
6. **(단기)** `frontend/src/content/docs/06-integrations-and-config/web-chat.{mdx,en.mdx}` 신설 — embed allowlist 동작, presentation 노드 사용법, BYO-UI 안내 포함 (W7, W8)
7. **(단기)** embed soft 검증의 fail-open + client-side 특성, `Cache-Control: max-age=300` 지연을 운영 문서 및 Swagger에 명시 (W2, W9, W10)
8. **(중기)** `interactionAllowedOrigins` 키를 `Workspace.settings` 타입에 명시적 선언 (I18)
9. **(중기)** `conversation.test.ts`, `widget-state.test.ts` — presentations 신규 경로 단위 테스트 추가 (I13, I14)
10. **(참고)** `Trigger` 엔티티 `endpointPath+type` 복합 인덱스 존재 여부 확인 (I22)

---

## 라우터 결정

라우터가 선별 실행함 (`routing=done`).

- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
- **제외**: 없음 (모든 reviewer 실행)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)

> 참고: `side_effect.md` 파일이 디스크에 존재하지 않아 해당 reviewer 결과를 읽지 못함. 에이전트별 요약에 "(파일 없음)"으로 표기.