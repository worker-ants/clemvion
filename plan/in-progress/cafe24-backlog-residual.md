---
worktree: cafe24-backlog-residual-batch
started: 2026-05-16
owner: developer (다음 진입자)
---

# Cafe24 백로그 잔여 항목

## 출처

다음 두 백로그 plan 의 잔여 항목을 모아 추적한다. 이력·맥락은 원본 참고.

- `plan/complete/cafe24-followup-backlog.md` — 42건 cycle (PR #52 → #85 + 후속 PR) 의 backlog
- `plan/complete/cafe24-pending-polish-followup.md` — PR #18–#21 cycle 의 polish 잔여 (대부분 후속 PR 로 흡수, 일부만 남음)

## 잔여 항목

### A-1 follow-up — `integration_action_required` 알림 표시 UI

- **상태**: spec + 신규 notifier + Cafe24ApiClient 통합은 완료 (PR #116, 2026-05-16). 현재 frontend 는 type 을 generic 으로 렌더링.
- [x] **frontend 액션 UI**: 알림 표시에 type-specific 핸들링 추가 — **완료 (2026-05-21, worktree `integration-action-required-ui`, PR 별도)**:
  - 재인증 단축 링크 버튼 (Cafe24 통합으로 deep-link) — `integration_action_required` 카드 우측 inline "Reconnect / 재인증" 버튼 + `notificationHref` 옛 `/integration` 단수 버그를 `/integrations/<id>` 로 정정 + SAFE_ID 화이트리스트 (`/^[a-zA-Z0-9_-]{1,128}$/`) path traversal 방어
  - 알림 메시지의 한·영 i18n 키 — **사이드바 namespace 채택** (parent 의 `notifications.types.*` 제안 대신 `sidebar.notificationFilter.*` + `sidebar.notificationCta.*` 로 결정). backend message 의 frontend i18n 매핑 (`backend-labels.ts` 패턴) 은 cross-cutting 작업이라 별 plan 으로 분리.
  - 알림 inbox 의 type 필터 옵션 추가 — popover 상단 칩 3-옵션 (`전체 / 일반 / 통합 액션 필요`), 클라이언트 사이드 필터링, popover 닫힘 시 자동 리셋
  - helper 추출: `lib/notifications/{href,filter,types}.ts` 신설, 단위 테스트 18개 + 컴포넌트 테스트 5개 lock-in
- **영향 범위**: `codebase/frontend/src/components/layout/sidebar.tsx` (algorithm 영역의 `components/notifications/*` 디렉토리는 미실재 — sidebar 내장 알림 popover 가 SoT), `codebase/frontend/src/lib/notifications/**`, `codebase/frontend/src/lib/i18n/dict/{ko,en}/sidebar.ts`

### B-5-8 alt — handleCallback / BullMQ refresh unit·integration 보강

- **상태**: e2e 는 outbound Cafe24 token endpoint mock 인프라(nock/msw or stub container) 부담 과해 보류 결정 (2026-05-16, commit `66920aeb`). 대신 unit/integration 으로 보강. **완료 (2026-05-21)**.
- [x] `exchangeCodeForToken` / `refreshAccessToken` 의 fetch 경로를 unit 으로 분리해 mock fetch + 응답 fixture 로 검증
- **대상 시나리오** (모두 unit 으로 lock-in):
  - [x] (a) callback 성공 → preview row 생성 — `integration-oauth.service.cafe24.spec.ts` `handleCallback — cafe24 stub flow` + real fetch path (scopes ARRAY / expires_at ISO / 2h default fallback) 묶음으로 cover
  - [x] (b) callback `invalid_grant` → `error(auth_failed)` 전이 — `reauthorize on connected row — fetch invalid_grant → row demoted to error(auth_failed) chain` (2026-05-21 신설). connected row + state 재인증 → fetch 400 `{error:'invalid_grant'}` → `OAUTH_TOKEN_EXCHANGE_FAILED` → `markIntegrationCallbackError` → `status='error', statusReason='auth_failed'` 전 체인 검증 + lastError.message 의 secret 미누수 보장
  - [x] (c) BullMQ refresh 성공 → atomic 4-field UPDATE — `cafe24-api.client.spec.ts` `token refresh` describe 가 in-process refresh 의 atomic UPDATE (credentials.access_token + refresh_token + expires_at + tokenExpiresAt + status='connected' + lastRotatedAt) 를 lock-in
  - [x] (d) refresh `invalid_grant` → status 전이 + 14일 idle 보호 회귀 — `cafe24-api.client.spec.ts` `refresh 401 marks Integration as auth_failed` + `integration-expiry-scanner.service.spec.ts` `IntegrationExpiryScannerService.enqueueCafe24BackgroundRefresh` describe (REFRESH_PROACTIVE_THRESHOLD_DAYS / cutoff / IsNull belt-and-suspenders / status='connected' 필터) 가 14일 만료 사전 갱신 회귀 보호
  - [x] (e) refresh transport 3연속 실패 → `error(network)` — `cafe24-api.client.spec.ts` `consecutive network failures (REQ-C2)` describe 가 counter 증가 / 3회 격하 (status='error', statusReason='network', consecutiveNetworkFailures=0 리셋) / 성공 시 카운터 리셋·rapid path 모두 cover
- **영향 범위**: `codebase/backend/src/modules/integrations/cafe24/**.spec.ts`

### Polish-followup 잔여 (PR #18–#21 cycle)

대부분 후속 PR 로 흡수됨. 다음 항목들만 미해소로 확인됨:

- [ ] **운영(A-2)**: nginx access log 의 `:installToken` segment 마스킹 또는 query parameter 이동 검토. (ai-review W6 / W11) — 운영 ops 작업, 코드 변경 없음
- [ ] **운영(A-3)**: install endpoint IP 기반 rate limiting 추가 layer (현재 30 req/min throttle 만 적용). token oracle enumeration 방어 강화. (ai-review W7)
- [x] **C-3**: `isReauthorizeDisabled` 위치 이동 — badge UI 컴포넌트(`status-badge.tsx`) 에서 export 중 → `lib/integrations/utils.ts` 등 도메인 모듈로. (ai-review I6) — **완료 (2026-05-21)**. blocker 였던 integration-token-ui-autorefresh PR #146 + cafe24-restricted-scopes PR #150 모두 main 머지 완료. 함수 본체는 이미 `@/lib/integrations/reauthorize.ts` 로 이동되어 있었고 (`reauthorize.ts:23`), `status-badge.tsx` 의 transitional re-export + 중복 테스트 블록만 잔존. 이번 batch 에서:
  - `status-badge.tsx`: `isReauthorizeDisabled` import + re-export 제거 (`INSTALL_TIMEOUT_REASON`·`pickErrorMessage` 는 잔존). 직접 컨슈머 (`integrations/[id]/page.tsx`) 는 이미 `@/lib/integrations/reauthorize` 경로 사용.
  - `_shared/__tests__/status-badge.test.tsx`: 중복 `describe("isReauthorizeDisabled", ...)` 블록 제거 — `lib/integrations/__tests__/reauthorize.test.ts` 가 동일 의미 + 추가 케이스 (expired without install_timeout) 까지 cover.
- [ ] **C-6**: `buildIntegrationMeta` 레지스트리 패턴 — 현재 cafe24 만 하드코딩. 두 번째 provider 추가 직전 시점에 `Map<serviceType, (entity) => IntegrationMeta>` 로 전환. (deferred)
- [x] **D-1**: 신규 에러 코드 2종 `@ApiResponse` 데코레이터 — `CAFE24_INSTALL_INVALID_TOKEN(404)`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409)` swagger 명시. (ai-review I19) — 확인 (2026-05-17): 두 코드 모두 이미 controller 에 명시되어 있다.
  - `CAFE24_INSTALL_INVALID_TOKEN(404)` → `ThirdPartyOAuthController.cafe24Install` 의 `@ApiNotFoundResponse` (`third-party-oauth.controller.ts:73-76`)
  - `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409)` → `IntegrationsController.oauthBegin` 의 `@ApiConflictResponse` (`integrations.controller.ts:170-173`) — spec §9.2 "app_type 무관" 명시 + 코드 이름의 `PRIVATE` 가 historical artifact 임을 description 에 적어 클라이언트가 코드 이름이 아닌 의미로 분기하도록 안내.
- [ ] **D-2**: `process()` 에러 격리 정책 spec 명시 (`.catch(logger.error)` BullMQ 재시도 회피) — Sentry/Datadog 연동 검토. (ai-review W7)
- [x] **E-1**: `buildIntegrationMeta` 직접 단위 테스트 — cafe24 외 serviceType / unreadable credentials 경계. (ai-review batch 2 W14) — **완료 (2026-05-21, PR #247)**. `IntegrationsService.buildIntegrationMeta` 의 derive 로직을 동명 top-level 함수 `buildIntegrationMeta(entity, credsUnreadable)` 로 추출 (인스턴스 메서드는 shim 으로 유지). `integrations.service.spec.ts` 끝에 `describe('buildIntegrationMeta (standalone)')` 신설:
  - cafe24 + readable: appType=private / public
  - cafe24 + 비정상 app_type (typo 'PRIVATE' / 빈문자 / 누락 / number / null) → null
  - non-cafe24 serviceType (google·slack·notion·미래 service): credentials 에 `app_type:'private'` 이 있어도 leakage 없이 null
  - credsUnreadable=true override / `__unreadable` 센티넬 자동 감지 / false override 시 정상 derive
- [x] **E-3**: `callbackContextOf` 단독 단위 테스트 — null/primitive 등 엣지. (이전 review Info 6) — **완료 (2026-05-21, PR #247)**. `callbackContextOf` 를 export 로 격상 (페어인 `attachCallbackContext` 가 이미 export). `integration-oauth.service.spec.ts` 끝에 `describe('callbackContextOf')` 신설:
  - attach 한 ctx normal Error → 그 ctx 반환 / attach 없는 Error → undefined
  - null·undefined → undefined / 4종 primitive (string·number·boolean·bigint) → undefined
  - context key 없는 plain object → undefined / `context: undefined` 명시 attach → undefined surface
- [x] **F-2**: `spec/2-navigation/4-integration.md §6` ASCII 상태 전이 다이어그램에 `install_token` 보존/소거 정책 가시화. (이전 review I3) — **완료 (2026-05-21, project-planner 사이클 worktree `cafe24-spec-polish-f2-f3`)**. 세 분기에 install_token 라벨 추가:
  - `pending_install → connected` 화살표 아래 `(install_token 보존)`
  - `install TTL 24h 만료 → expired` 라인에 `, install_token=NULL`
  - `callback 실패 → pending_install` 자기 루프에 `status·install_token 보존` (consistency-check INFO #1 반영)
- [x] **F-3**: `spec/conventions/swagger.md §2-4` 실재 확인 및 cross-link 정정. (이전 review I5) — **완료 (2026-05-21, 같은 project-planner 사이클)**. §2-4 ("상태 코드 응답 규칙", swagger.md line 135) 실재 확인 + 참조 측 cross-link 7건 (`§2-4` × 2, `§2-1`, `§5`, `§5-1` 등) 모두 정합 검증. 부수 발견: `spec/2-navigation/4-integration.md` line 1349 의 `swagger.md 의 의미 기반 명명 원칙` 이 swagger.md 어느 § 에도 정의되지 않은 dangling reference → self-contained 표현으로 정정 (swagger.md 신규 § 추가 안 함 — scope 확장은 별 결정).
- [ ] **F-3 follow-up**: 에러 코드 의미 기반 명명 원칙의 정식 규약화 — `spec/conventions/error-codes.md` (또는 `naming.md`) 신설 여부 결정. 현재는 `4-integration.md` line 1349 의 self-contained 진술만 SoT. 신규 코드가 늘면 conventions 문서로 격상 검토. (consistency-check `2026/05/21/19_46_41` INFO #6 출처)

### G-1 — `constraints` 18 resource docs audit (2026-05-22)

- **상태**: backend infra (types · validator · handler · MCP provider · tests) 와 `customer_list` 1건 예시는 `plan/complete/cafe24-conditional-required-impl.md` 에서 완료 (commit d932cff9). 18 resource 약 500 endpoint 의 cafe24 docs 본문 박스 audit 은 미수행.
- **출처**: 사용자 보고 (2026-05-22) `customer_list` 사례 — docs 표상 모두 optional 인데 본문 박스에 "X·Y·Z 중 한 가지는 반드시 입력" 같은 조건부 제약 명시. AND-only `requiredFields` 가 표현 불가 → AI Agent 잘못 추론.
- **블로커**: WebFetch 가 cafe24 docs SPA 의 본문 박스 (조건 제약) 까지 렌더링 못함 (2026-05-22 본 worktree 에서 재확인). chrome extension 이 동작하는 세션이나 사용자가 endpoint 별 본문 박스 텍스트를 paste 하는 별도 트랙 필요.
- [ ] **G-1**: chrome-equipped 세션 또는 사용자 paste 흐름으로 18 resource audit + `Cafe24OperationMetadata.constraints` row 채움. 우선순위: customer (24) → order (106) → product (63) → community → promotion → store → 나머지. resource batch 마다 commit 분리, 마지막에 단일 PR. spec/conventions/cafe24-api-metadata.md §6 step 5 "조건부 제약 확인" 절차가 audit 단계의 SoT.

## 처리 후

각 항목 완료 시 본 plan 의 체크박스 갱신. 모든 항목 처리되면 `plan/complete/` 로 `git mv` (history 보존).

## 2026-05-21 batch 진행 기록

worktree `cafe24-backlog-residual-batch` 에서 의사결정 없이 처리 가능한 항목 일괄 해소.

**완료**: B-5-8 alt · C-3 · E-1 · E-3 (codebase 영역만)

**미해소 잔여** (사유 명시):
- A-1: 프론트엔드 UI 디자인 결정 (재인증 deep-link 버튼·필터 UX) 필요
- A-2 / A-3: 운영/인프라 결정 (nginx 로그 마스킹 정책·rate limiter layer 위치/threshold) 필요
- C-6: 두 번째 provider 추가 시점까지 deferred
- D-2: Sentry/Datadog 등 관측 도구 선정 결정 필요
- F-2 / F-3: `spec/` 직접 수정 — developer skill 권한 밖, project-planner 위임 필요

**부수 fix** (out-of-scope but unblocking unit suite):
- `codebase/frontend/src/content/docs/07-workspace-and-team/security-2fa.{mdx,en.mdx}` 의 `code` frontmatter 가 PR #225 (`refactor(backend/auth): WebAuthnController 분리`) 의 파일 이동 (`modules/auth/webauthn.service.ts` → `modules/auth/webauthn/webauthn.service.ts`) 을 반영하지 않아 `registry.test.ts` "모든 .mdx frontmatter 의 spec/code 경로가 실재해요" 가 실패하던 잔여 회귀 — 두 mdx 의 경로 1자리 수정으로 unblock. user-guide-sync-reviewer (PR #244 신설) 의 trigger 매트릭스가 향후 동일 누락을 자동 검출한다.
