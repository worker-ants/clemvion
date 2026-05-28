# Plan 정합성 검토 결과

대상 문서: `plan/in-progress/spec-draft-auth-config-webhook-wiring.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-28

---

## 발견사항

### [WARNING] R-2 TBD 일방 해소 — /auth/rotate-secret 예약 행 제거

- **target 위치**: spec-draft §5.2 "§3 API 표 — `/auth/rotate-secret` 행 제거 (C-5 반영)"
- **관련 plan**: `plan/in-progress/spec/2-navigation/2-trigger-list.md` (현행 spec, line 135) / `plan/in-progress/eia-secret-rotation-revoke-api.md`
- **상세**: `spec/2-navigation/2-trigger-list.md` §3 API 표 line 135 에는 `POST /api/triggers/:id/auth/rotate-secret` 가 "v1.1 예약 (실제 endpoint 신설은 별 spec PR)" 으로 등재되어 있으며, 해당 행 주석에 "경로명·grace 기간·응답 shape 는 TBD — `plan/in-progress/eia-secret-rotation-revoke-api.md` 합의 후 확정" 이라고 명시한다. Rationale R-2 도 동일하게 이 TBD 를 의식적 미결정으로 선언한다. 대상 spec-draft (C-5) 는 이 행을 "미존재 endpoint 에 Deprecated+410 기록은 논리 모순"으로 판단해 예약 행 자체를 제거하고, inbound webhook auth 회전은 `auth-configs/:id/regenerate` 로 일원화한다고 선언한다. 이 결정은 R-2 TBD 를 eia-secret-rotation-revoke-api 합의 없이 일방적으로 종결시키는 것이다. `eia-secret-rotation-revoke-api.md` 의 scope 는 실제로 outbound notification secret (`/notification/rotate-secret`) 이며 inbound webhook auth rotate endpoint 를 직접 소유하지 않지만, spec line 135 의 "합의 후 확정" 문구로 연계 의존이 명시적으로 선언되어 있다.
- **실제 위험 평가**: `eia-secret-rotation-revoke-api.md` 가 `/auth/rotate-secret` 를 자체 작업 단위에 포함하지 않으므로 실제 구현 경합은 없다. 그러나 spec 의 명시적 TBD 연계를 건너뛰는 형태이므로 plan 갱신이 권장된다.
- **제안**: 대상 spec-draft §5.4 Rationale R-14 에 "R-2 TBD 해소 경위" 항목을 보강해 inbound webhook auth rotate 가 `auth-configs/:id/regenerate` 로 흡수됨을 명시하고, `eia-secret-rotation-revoke-api.md` 에 "inbound rotation (v1.1 예약 `/auth/rotate-secret`) 은 auth-config-webhook-wiring PR 에서 auth-configs/:id/regenerate 로 흡수되어 별 endpoint 신설 불요" 한 줄을 side-effect 추가 권장 항목으로 기록한다 (대상 plan §Side-effect 영향 영역의 I-11 항목이 이미 이 추가를 권장하고 있으므로, 해당 권장을 의무 수준으로 격상하는 것이 적절).

---

### [WARNING] trigger-drawer-tests.md 케이스 6 무효화 — plan 갱신 의무 미이행

- **target 위치**: spec-draft §5.4 Rationale R-14 끝 "(W-10: ... developer Phase 5 에서 처리, 본 plan §미해결에 등재)"
- **관련 plan**: `plan/in-progress/trigger-drawer-tests.md` 케이스 6 "authType 별 i18n 렌더링 (hmac / bearer / none)"
- **상세**: 대상 spec-draft 는 `trigger-drawer-tests.md` 의 케이스 6 을 "AuthConfig.type selector 기준으로 갱신" 해야 한다고 명시한다. 그러나 현재 `trigger-drawer-tests.md` 의 케이스 6 은 삭제 대상인 `authType` (hmac/bearer/none inline 필드) 을 기준으로 작성되어 있다. 이 케이스는 대상 spec-draft 가 확정되면 무효화되며, spec 갱신 완료 후 developer Phase 5 에서 처리한다고 명시하지만 `trigger-drawer-tests.md` plan 자체에는 아무런 표시가 없다. plan 이 갱신되지 않은 채 developer 가 해당 plan 에 따라 케이스 6 을 구현하면 삭제될 `authType` enum 에 의존하는 테스트가 생성된다.
- **제안**: `trigger-drawer-tests.md` 케이스 6 항목에 "※ auth-config-webhook-wiring spec-draft 확정 시 `AuthConfig.type` selector 기준으로 재작성 필요 — inline authType(hmac/bearer/none) 삭제됨" 주석 추가. 또는 `auth-config-webhook-wiring.md` §미해결·후속 에 "trigger-drawer-tests.md 케이스 6 갱신 (Phase 5 선행)" 을 명시적 미해결 항목으로 등재.

---

### [INFO] eia-secret-rotation-revoke-api.md 에 I-11 한 줄 추가 — 권장 수준 확인

- **target 위치**: spec-draft §Side-effect 영향 영역 `plan/in-progress/eia-secret-rotation-revoke-api.md (I-11)`
- **관련 plan**: `plan/in-progress/eia-secret-rotation-revoke-api.md`
- **상세**: 대상 spec-draft 는 `eia-secret-rotation-revoke-api.md` 에 "inbound rotation 은 본 PR 에서 auth-configs/:id/regenerate 로 흡수됨" 한 줄 추가를 **권장 (권장)** 으로 표기한다. 해당 plan 에는 이 내용이 없다. outbound rotation 과 inbound rotation 의 분리를 명확히 하는 데 유용하며, 해당 plan 의 미해결 결정 (rotation grace 기간, 응답 shape 등) 이 inbound webhook auth 에는 무관함을 확인하는 데도 도움이 된다.
- **제안**: 권장 수준을 유지하되, spec-draft 확정 시 `eia-secret-rotation-revoke-api.md` 에 scope clarification 메모를 추가하는 것을 Phase 0 side-effect checklist 에 포함한다.

---

### [INFO] stale worktree 로 skip 한 항목

(상세는 아래 전용 섹션 참조)

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 대상:
- `.claude/worktrees/cafe24-mcp-label-i18n` (branch `claude/cafe24-mcp-label-i18n`)
- `.claude/worktrees/integration-activity-api-label-ed0a6e` (branch `claude/integration-activity-api-label-ed0a6e`)
- `.claude/worktrees/frontend-csr-only-a985da` (branch `claude/frontend-csr-only-a985da`)

**판정 결과**:

- `cafe24-mcp-label-i18n` (branch `claude/cafe24-mcp-label-i18n`) — Step 1: NOT ancestor (exit 1). Step 2: PR state = `MERGED`. **stale skip**. 해당 worktree 가 손대는 spec 파일(`spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/*`, `spec/5-system/11-mcp-client.md`, `spec/conventions/cafe24-api-metadata.md`)은 대상 spec-draft 의 7개 대상 파일과 겹치지 않음.

- `integration-activity-api-label-ed0a6e` (branch `claude/integration-activity-api-label-ed0a6e`) — Step 1: NOT ancestor (exit 1). Step 2: PR state = `MERGED`. **stale skip**. 동일 spec 파일 셋, 대상과 겹침 없음.

- `frontend-csr-only-a985da` (branch `claude/frontend-csr-only-a985da`) — Step 1: NOT ancestor (exit 1). Step 2: PR list 결과 empty (`[]`, PR 없음). Step 3 fallback — **active 로 처리**. 단, 이 worktree 가 손대는 spec 파일은 `spec/0-overview.md` 와 `spec/conventions/frontend-rendering.md` 뿐이며 대상 spec-draft 의 7개 파일(`spec/1-data-model.md`, `spec/5-system/12-webhook.md`, `spec/5-system/1-auth.md`, `spec/2-navigation/6-config.md`, `spec/2-navigation/2-trigger-list.md`, `spec/data-flow/10-triggers.md`, `spec/conventions/secret-store.md`)과 겹치지 않아 worktree 충돌 해당 없음. stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 `cleanup-worktree-all.sh` 실행 후 재검토 권장.

stale skip 수: **2건** (cafe24-mcp-label-i18n, integration-activity-api-label-ed0a6e). 이 worktree 들은 활성으로 남아있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

대상 `spec-draft-auth-config-webhook-wiring.md` 는 사용자 확정 5건을 기반으로 7개 spec 파일을 일관되게 수정하며, 전체적으로 plan 정합성이 양호하다. 주된 우려 사항은 두 가지다. 첫째, `spec/2-navigation/2-trigger-list.md` Rationale R-2 가 `eia-secret-rotation-revoke-api.md` 와의 합의를 조건으로 명시하는 TBD 를 대상 draft 가 단독으로 해소(C-5: `/auth/rotate-secret` 예약 행 제거)하는 점이다 — 실제 구현 경합은 없으나 plan 문서 내 명시적 연계 의존을 건너뛰는 형태이므로 사이드이펙트 처리 권장 수준을 의무로 격상할 필요가 있다. 둘째, `trigger-drawer-tests.md` 케이스 6 ("authType 별 i18n 렌더링 hmac/bearer/none") 이 삭제될 inline authType 에 의존해 있어, spec 갱신 후 해당 plan 에 무효화 주석이 없으면 개발자가 잘못된 방향으로 케이스를 구현할 수 있다. 이 두 항목은 WARNING 수준이다. worktree 충돌 후보 3건 중 stale 2건 skip, active 1건 분석 — active worktree 는 대상 spec 파일과 중첩 없음.

---

## 위험도

LOW
