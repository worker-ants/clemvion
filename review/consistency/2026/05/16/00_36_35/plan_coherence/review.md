# Plan 정합성 검토 결과

- 검토 모드: 구현 착수 전 검토 (--impl-prep)
- 대상: `spec/2-navigation/4-integration.md`
- 검토 범위: `plan/in-progress/cafe24-request-scopes-ui.md` (worktree: `cafe24-request-scopes-ui-b6e34d`)

---

## 발견사항

### 발견사항 없음 (INFO 수준 메모 1건)

- **[INFO]** `spec-update-cafe24-app-url-reuse` plan 이 동일 spec §4.4 를 참조하나 직접 충돌 없음
  - target 위치: `spec/2-navigation/4-integration.md` §4.4 `[Request scopes]` 행 (line 270)
  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`)
  - 상세: `spec-update-cafe24-app-url-reuse` plan 은 §4.4 를 포함해 §3.2, §6, §9, §10.2, Rationale 등 다수 섹션을 갱신 예정이며, 아직 spec 갱신이 미완료 (`[ ] spec 갱신` 체크박스 미체크)이다. target plan (`cafe24-request-scopes-ui`) 이 착수하는 구현은 **frontend 의 `requestMutation.onSuccess` 한 분기 추가 + i18n 키 추가**에 한정된다. 두 plan 이 건드리는 실제 파일이 다르다 — `spec-update-cafe24-app-url-reuse` 는 spec 파일과 backend 코드, target plan 은 `frontend/src/app/(main)/integrations/[id]/page.tsx` 와 i18n 사전. 직접적인 코드·spec 파일 경합은 없다. 다만 `spec-update-cafe24-app-url-reuse` 의 spec 갱신 완료 이후 §4.4 안내 문구가 변경될 경우, target plan 이 추가한 i18n 값(`requestScopesCafe24PrivatePendingDesc`) 과 맞지 않을 수 있다.
  - 제안: target plan 의 i18n 안내 문구는 현행 `spec/2-navigation/4-integration.md §4.4` 의 안내 문구를 그대로 사용하므로 현재 spec 기준으로는 정합. `spec-update-cafe24-app-url-reuse` spec 갱신이 완료된 시점에 i18n 값을 재검토하면 된다. 작업 차단 불필요.

---

## 5가지 점검 관점 요약

### 1. 미해결 결정과의 충돌

해당 없음. target plan 이 착수하는 결정(inline alert + toast.info 표시, `cafe24_private_pending` 분기 추가)은 spec §4.4 에 이미 명시된 동작이며, 어떤 plan 에서도 "결정 필요"로 남겨 둔 항목이 아니다.

### 2. 중복 작업 (병렬 worktree 경합)

해당 없음. target plan 의 변경 범위는 `frontend/src/app/(main)/integrations/[id]/page.tsx`, `ko.ts`, `en.ts` 세 파일이다. 현재 활성 worktree 중 동일 파일을 다루는 plan 은 없다.

- `cafe24-pending-polish-followup` (worktree: `cafe24-pending-polish-7fdb7e`) — PR #18~21 스택, 이미 완료/머지 대기 단계. `[id]/page.tsx` 의 폴링 훅 관련 항목은 PR #21 에서 처리됐으나, request-scopes onSuccess 분기와 파일 레벨 충돌 가능성은 낮다(서로 다른 mutation).
- `spec-update-cafe24-app-url-reuse` (worktree: `cafe24-app-url-reuse-f9a2e3`) — spec 및 backend 파일 수정 예정. `[id]/page.tsx` 수정은 포함되지 않는다.
- `spec-update-cafe24-install-recovery` (worktree: `cafe24-install-recovery-8b3c4d`) — backend + frontend `src/lib/api/integrations.ts` 타입 수정. `[id]/page.tsx` 직접 수정 없음.

### 3. 선행 plan 미해소

해당 없음. target plan 이 전제하는 사전 조건(응답 shape `{ mode: 'cafe24_private_pending', ... }` 이 백엔드에서 정상 반환됨)은 이미 구현 완료 상태이며, spec §4.4 에도 명시되어 있다.

### 4. 후속 항목 누락

해당 없음. target plan 의 변경은 좁은 범위이며, 이로 인해 무효화되거나 새로 생성되어야 하는 다른 plan 의 후속 항목이 없다.

### 5. worktree 충돌 (spec 파일 동시 수정)

해당 없음. target plan (worktree: `cafe24-request-scopes-ui-b6e34d`) 은 `spec/2-navigation/4-integration.md` 를 **읽기 전용으로만 참조**하고 수정하지 않는다 (변경 범위: frontend 코드 + i18n 사전). 현재 해당 spec 파일을 수정 예정인 plan 은 `spec-update-cafe24-app-url-reuse`(worktree: `cafe24-app-url-reuse-f9a2e3`) 이나, target plan 과는 시점·범위가 다르므로 실질적 충돌이 없다.

---

## 요약

`cafe24-request-scopes-ui` plan 은 이미 spec 에 명세된 `cafe24_private_pending` 응답 분기를 UI 에서 처리하지 않는 버그를 수정하는 좁은 범위의 작업이다. 변경 파일이 `frontend/src/app/(main)/integrations/[id]/page.tsx` 와 i18n 사전에 한정되어, 현재 진행 중인 다른 어떤 plan 과도 spec 파일·코드 파일 레벨의 경합이 없다. 미해결 결정과의 충돌, 선행 조건 미해소, 후속 항목 누락 모두 해당 없다. INFO 1건(spec-update-cafe24-app-url-reuse spec 갱신 완료 후 i18n 재검토 권장)이 있으나 작업을 차단하지 않는다.

---

## 위험도

NONE
