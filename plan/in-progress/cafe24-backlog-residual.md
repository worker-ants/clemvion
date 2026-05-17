---
worktree: TBD
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
- [ ] **frontend 액션 UI**: 알림 표시에 type-specific 핸들링 추가
  - 재인증 단축 링크 버튼 (Cafe24 통합으로 deep-link)
  - 알림 메시지의 한·영 i18n 키 (`notifications.types.integration_action_required.*`)
  - 알림 inbox 의 type 필터 옵션 추가
- **영향 범위**: `frontend/src/components/notifications/*`, `frontend/src/lib/i18n/dict/{ko,en}.ts`

### B-5-8 alt — handleCallback / BullMQ refresh unit·integration 보강

- **상태**: e2e 는 outbound Cafe24 token endpoint mock 인프라(nock/msw or stub container) 부담 과해 보류 결정 (2026-05-16, commit `66920aeb`). 대신 unit/integration 으로 보강.
- [ ] `exchangeCodeForToken` / `refreshAccessToken` 의 fetch 경로를 unit 으로 분리해 mock fetch + 응답 fixture 로 검증
- **대상 시나리오**:
  - (a) callback 성공 → preview row 생성
  - (b) callback `invalid_grant` → `error(auth_failed)` 전이
  - (c) BullMQ refresh 성공 → atomic 4-field UPDATE
  - (d) refresh `invalid_grant` → status 전이 + 14일 idle 보호 회귀
  - (e) refresh transport 3연속 실패 → `error(network)`
- **영향 범위**: `backend/src/modules/integrations/cafe24/**.spec.ts`

### Polish-followup 잔여 (PR #18–#21 cycle)

대부분 후속 PR 로 흡수됨. 다음 항목들만 미해소로 확인됨:

- [ ] **운영(A-2)**: nginx access log 의 `:installToken` segment 마스킹 또는 query parameter 이동 검토. (ai-review W6 / W11) — 운영 ops 작업, 코드 변경 없음
- [ ] **운영(A-3)**: install endpoint IP 기반 rate limiting 추가 layer (현재 30 req/min throttle 만 적용). token oracle enumeration 방어 강화. (ai-review W7)
- [ ] **C-3**: `isReauthorizeDisabled` 위치 이동 — badge UI 컴포넌트(`status-badge.tsx`) 에서 export 중 → `lib/integrations/utils.ts` 등 도메인 모듈로. (ai-review I6) — ⚠ **integration-token-ui-autorefresh PR (구현 worktree `integration-token-ui-autorefresh-a3f9b2`) merge 이후 진행**. 그 PR 이 `status-badge.tsx` 의 `computeStatus`·`needsAttention` 분기를 동시 수정하므로 동일 파일에서 merge conflict 위험. 출처: `review/consistency/2026/05/17/12_34_47/SUMMARY.md` W-2 / `2026/05/17/12_16_00/SUMMARY.md` W-3.
- [ ] **C-6**: `buildIntegrationMeta` 레지스트리 패턴 — 현재 cafe24 만 하드코딩. 두 번째 provider 추가 직전 시점에 `Map<serviceType, (entity) => IntegrationMeta>` 로 전환. (deferred)
- [x] **D-1**: 신규 에러 코드 2종 `@ApiResponse` 데코레이터 — `CAFE24_INSTALL_INVALID_TOKEN(404)`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409)` swagger 명시. (ai-review I19) — 확인 (2026-05-17): 두 코드 모두 이미 controller 에 명시되어 있다.
  - `CAFE24_INSTALL_INVALID_TOKEN(404)` → `ThirdPartyOAuthController.cafe24Install` 의 `@ApiNotFoundResponse` (`third-party-oauth.controller.ts:73-76`)
  - `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409)` → `IntegrationsController.oauthBegin` 의 `@ApiConflictResponse` (`integrations.controller.ts:170-173`) — spec §9.2 "app_type 무관" 명시 + 코드 이름의 `PRIVATE` 가 historical artifact 임을 description 에 적어 클라이언트가 코드 이름이 아닌 의미로 분기하도록 안내.
- [ ] **D-2**: `process()` 에러 격리 정책 spec 명시 (`.catch(logger.error)` BullMQ 재시도 회피) — Sentry/Datadog 연동 검토. (ai-review W7)
- [ ] **E-1**: `buildIntegrationMeta` 직접 단위 테스트 — cafe24 외 serviceType / unreadable credentials 경계. (ai-review batch 2 W14)
- [ ] **E-3**: `callbackContextOf` 단독 단위 테스트 — null/primitive 등 엣지. (이전 review Info 6)
- [ ] **F-2**: `spec/2-navigation/4-integration.md §6` mermaid 에 `install_token` 보존 정책 명시 (data-flow §1.2.1 에는 이미 있음). (이전 review I3)
  > ※ 같은 파일을 `plan/in-progress/cafe24-restricted-scopes.md` (worktree `cafe24-restricted-scopes-a1b2c3`) 가 §3.2 / §4.4 / §5 / §9.4 / §10.4 / Rationale 영역에서 동시 수정 중이다. consistency-check (`review/consistency/2026/05/17/12_12_46/`) W-8 으로 검출. **머지 순서 권장**: F-2 는 cafe24-restricted-scopes 가 main 에 머지된 후 착수 (영역은 §6 mermaid 로 분리되나 안전 확보).
- [ ] **F-3**: `spec/conventions/swagger.md §2-4` 실재 확인 및 cross-link 정정. (이전 review I5)

## 처리 후

각 항목 완료 시 본 plan 의 체크박스 갱신. 모든 항목 처리되면 `plan/complete/` 로 `git mv` (history 보존).
