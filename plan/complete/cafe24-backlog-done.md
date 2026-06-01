---
worktree: cafe24-backlog-residual-batch
started: 2026-05-16
owner: developer
---

# Cafe24 백로그 — 완료 기록

> Cafe24 백로그 잔여 항목 중 **완료된 부분**의 기록. 미해소 잔여(운영/결정 의존 +
> field-set 확장)는 [`plan/in-progress/cafe24-backlog-residual.md`](../in-progress/cafe24-backlog-residual.md)
> 로 분리 (split, 2026-06-01). 이력·맥락 원본:
> `plan/complete/cafe24-followup-backlog.md`, `plan/complete/cafe24-pending-polish-followup.md`.

## A-1 — `integration_action_required` 알림 표시 UI ✅

- **상태**: spec + 신규 notifier + Cafe24ApiClient 통합 완료 (PR #116, 2026-05-16).
- [x] **frontend 액션 UI** (2026-05-21, worktree `integration-action-required-ui`):
  - 재인증 단축 링크 버튼 (Cafe24 통합 deep-link) — `integration_action_required` 카드 우측 inline "Reconnect / 재인증" 버튼 + `notificationHref` 옛 `/integration` 단수 버그를 `/integrations/<id>` 로 정정 + SAFE_ID 화이트리스트 (`/^[a-zA-Z0-9_-]{1,128}$/`) path traversal 방어
  - 알림 메시지 한·영 i18n — **사이드바 namespace 채택** (`sidebar.notificationFilter.*` + `sidebar.notificationCta.*`). backend message 의 frontend i18n 매핑(`backend-labels.ts` 패턴)은 cross-cutting 이라 별 plan 분리.
  - 알림 inbox type 필터 — popover 상단 칩 3-옵션 (`전체 / 일반 / 통합 액션 필요`), 클라이언트 사이드 필터, popover 닫힘 시 자동 리셋
  - helper 추출: `lib/notifications/{href,filter,types}.ts` 신설, 단위 18 + 컴포넌트 5 테스트 lock-in
- **영향 범위**: `components/layout/sidebar.tsx`, `lib/notifications/**`, `lib/i18n/dict/{ko,en}/sidebar.ts`

## B-5-8 alt — handleCallback / BullMQ refresh unit·integration 보강 ✅

- **상태**: e2e 는 outbound Cafe24 token endpoint mock 인프라 부담 과해 보류 (2026-05-16, `66920aeb`). unit/integration 으로 보강 완료 (2026-05-21).
- [x] `exchangeCodeForToken` / `refreshAccessToken` fetch 경로 unit 분리 + mock fetch + fixture
- 시나리오 (모두 unit lock-in):
  - [x] (a) callback 성공 → preview row 생성 (`integration-oauth.service.cafe24.spec.ts`)
  - [x] (b) callback `invalid_grant` → `error(auth_failed)` 전이 (secret 미누수 보장)
  - [x] (c) BullMQ refresh 성공 → atomic 4-field UPDATE (`cafe24-api.client.spec.ts`)
  - [x] (d) refresh `invalid_grant` → status 전이 + 14일 idle 보호 회귀
  - [x] (e) refresh transport 3연속 실패 → `error(network)`
- **영향 범위**: `modules/integrations/cafe24/**.spec.ts`

## Polish-followup (PR #18–#21 cycle) — 완료 항목

- [x] **C-3**: `isReauthorizeDisabled` 위치 이동 (2026-05-21). 함수 본체는 이미 `@/lib/integrations/reauthorize.ts` 로 이동돼 있었고, `status-badge.tsx` 의 transitional re-export + 중복 테스트 블록 제거.
- [x] **D-1**: 신규 에러 코드 2종 `@ApiResponse` (2026-05-17 확인). `CAFE24_INSTALL_INVALID_TOKEN(404)` → `ThirdPartyOAuthController.cafe24Install`; `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409)` → `IntegrationsController.oauthBegin`.
- [x] **E-1**: `buildIntegrationMeta` 직접 단위 테스트 (2026-05-21, PR #247). top-level 함수 추출 + cafe24/non-cafe24/unreadable 경계 cover.
- [x] **E-3**: `callbackContextOf` 단독 단위 테스트 (2026-05-21, PR #247). null/primitive/plain object 엣지 cover.
- [x] **F-2**: `spec/2-navigation/4-integration.md §6` 상태 전이 다이어그램에 install_token 보존/소거 라벨 (2026-05-21, `cafe24-spec-polish-f2-f3`).
- [x] **F-3**: `spec/conventions/swagger.md §2-4` 실재 확인 + cross-link 7건 정합 + dangling reference 정정 (2026-05-21).

## G-1 — `constraints` resource docs audit (cafe24 docs Latest 2026-03-01 기준)

> backend infra (types·validator·handler·MCP provider·tests) + `customer_list` 예시는
> `plan/complete/cafe24-conditional-required-impl.md` (commit d932cff9) 에서 완료. 아래는 resource 별 audit.

- [x] **G-1-customer**: customer 24 endpoint 전수 audit + field gap 정렬 (8a4e926f)
- [x] **G-1-privacy**: privacy path 정정 (`customersprivacy/*`) + customersprivacy_list 22 field (38c5f660)
- [x] **G-1-product**: product path/method 12건 + product_list/count `allOrNone [since, until]` (5dfca92f, 4ae303f4)
- [x] **G-1-order**: order path/method 19건 (63f4d0f3)
- [x] **G-1-community/promotion/application**: placeholder rename 13건 (939e0d36)
- [x] **G-1-category/design/shipping**: placeholder rename 10건 (7d05ce48)
- [x] **G-1-store**: store 13건 정정 (6e7f2cec)
- [x] **G-1-supply**: 5건 정정 (adaf9761)
- [x] **G-1-impliesValue**: `Cafe24FieldConstraint.impliesValue` kind 신설 (3de1e177) — value-aware implication + validator + MCP suffix + 6 unit. metadata 적용은 follow-up.
- [x] **G-1-batch12**: order placeholder/path 12건 + docs 부재 ops JSDoc 7건 (8b2b927b)

## 2026-05-21 batch 진행 기록

worktree `cafe24-backlog-residual-batch` 에서 의사결정 없이 처리 가능한 항목 일괄 해소.

**완료**: B-5-8 alt · C-3 · E-1 · E-3 (codebase 영역만)

**부수 fix** (out-of-scope but unblocking unit suite):
- `content/docs/07-workspace-and-team/security-2fa.{mdx,en.mdx}` 의 `code` frontmatter 가 PR #225 (WebAuthnController 분리) 파일 이동을 미반영 → `registry.test.ts` 실패하던 잔여 회귀를 경로 1자리 수정으로 unblock. user-guide-sync-reviewer (PR #244) 가 향후 동일 누락 자동 검출.
