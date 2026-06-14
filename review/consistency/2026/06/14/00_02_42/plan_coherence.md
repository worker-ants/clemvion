# Plan 정합성 검토 결과

## 발견사항

### 1. [INFO] `auth_config.*` 5종 전체가 "구현됨"으로 등재되어 있으나 plan 은 일부 진행 중

- **target 위치**: `spec/conventions/audit-actions.md §3 도메인별 분류 레지스트리` — `auth_config` 행: `create`, `update`, `delete`, `regenerate`, `reveal` 5종 전부 상태="구현"
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md §1 AuthConfig CRUD audit 기록` 체크리스트 전 항목 [x] 완료 + "§1 완료 (2026-06-11)" 표기 확인됨
- **상세**: `auth-config-webhook-followups.md` §1 은 이미 완료(2026-06-11) 처리됐고, `AUDIT_ACTIONS` 에 `AUTH_CONFIG_CREATE/UPDATE/DELETE/REGENERATE` 4종 추가 및 service 구현·spec §4.1 반영까지 전 단계가 [x] 처리되어 있다. target 의 "구현" 표기는 실제 완료 상태와 일치한다. 충돌 없음.
- **제안**: 조치 불요. 단, §2~4 잔여 항목(rate-limit, spec 보완 등)은 이 레지스트리와 무관한 별도 surface.

---

### 2. [INFO] `user.*` 3종 "구현됨" 등재 — 관련 plan 완료 상태와 일치

- **target 위치**: `spec/conventions/audit-actions.md §3` — `user` 행: `password_changed`, `2fa_enabled`, `2fa_disabled` 상태="구현"
- **관련 plan**: `plan/in-progress/refactor-04-followup-pwchange-userip.md` — 구현 체크리스트 전 항목 [x] 완료, `/consistency-check --impl-done` BLOCK:NO 확인
- **상세**: `refactor-04-followup-pwchange-userip.md` 의 모든 구현·테스트·리뷰 단계가 완료되어 있으며, `user.password_changed`/`2fa_enabled`/`2fa_disabled` 가 구현됐음을 확인할 수 있다. target 의 "구현" 표기는 plan 상태와 일치한다.
- **제안**: 조치 불요.

---

### 3. [WARNING] `workspace.transfer_ownership` 시제 분류 미해결 — plan 에 명시적 후속 항목으로 등록됨

- **target 위치**: `spec/conventions/audit-actions.md §3` — `workspace` 행: `transfer_ownership`, 패턴="도메인 동사 (§2.3)", 상태="구현"
- **관련 plan**: `plan/in-progress/refactor-04-followup-pwchange-userip.md §후속(범위 밖 — planner)` — "impl-done WARNING: `workspace.transfer_ownership` 시제 규약 카테고리 미분류(기존 액션). `spec/conventions/audit-actions.md` 신설 또는 §4.1 예외 명시."
- **상세**: `refactor-04-followup-pwchange-userip.md` 의 `--impl-done` 검토가 `workspace.transfer_ownership` 에 대해 "시제 규약 카테고리 미분류"를 WARNING 으로 제기했고, target `audit-actions.md` 의 신설 또는 §4.1 예외 명시를 요구했다. 현재 target `audit-actions.md` 는 `workspace.transfer_ownership` 을 §2.3 도메인 고유 동사로 분류하고 있어 해당 요구를 충족한다. 그러나 plan 의 후속 항목은 아직 해소됐다고 명시적으로 표기되지 않은 상태(체크박스 없음 — 단순 서술형 메모). 어느 쪽이 선행했는지(target 이 plan 을 해소한 것인지, plan 이 아직 열린 것인지)가 불명확.
- **제안**: `refactor-04-followup-pwchange-userip.md §후속` 의 해당 메모에 "→ `spec/conventions/audit-actions.md` §2.3 분류로 해소됨" 을 추가해 plan 을 닫는다. target 변경이 plan 의 의도를 충족했음을 명시.

---

### 4. [INFO] `spec-code-cross-audit-2026-06-10.md` G-01 완료와 target 의 정합성

- **target 위치**: `spec/conventions/audit-actions.md §1 구조` — `AUDIT_ACTIONS` union·인라인 문자열 금지·`AuditLogsService.record({ action })` 타입 강제 서술
- **관련 plan**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §처리 내역 G-01·G-02 — 완료([x]) 처리됨
- **상세**: G-01(`audit-action.const.ts` union 인프라 신설)·G-02(`re_run_initiated`→`execution.re_run` 개명) 가 완료됐고, target 이 이 구조를 §1 본문에 반영한 상태다. 정합.
- **제안**: 조치 불요.

---

### 5. [INFO] `spec-sync-data-flow-12-workspace-gaps.md` 의 workspace audit 미결 항목과 target 의 "Planned" 등재

- **target 위치**: `spec/conventions/audit-actions.md §3` — `workspace` 행 `created`, `updated`, `deleted` 상태="Planned"
- **관련 plan**: `plan/in-progress/spec-sync-data-flow-12-workspace-gaps.md §미구현 항목` — "워크스페이스 액션 audit 적재 범위 — 현재 `workspace.transfer_ownership` 1건만 기록. create/delete/rename/member 변경 등 audit 적재 여부 결정 필요(과거 spec 은 `workspace.*` 전체 적재로 약속)."
- **상세**: `spec-sync-data-flow-12-workspace-gaps.md` 가 workspace audit 적재 여부를 "결정 필요" 로 열어두고 있는데, target 은 `workspace.created/updated/deleted` 를 "Planned"(미구현·미결정)으로 등재했다. 이는 "결정이 아직 안 됐음"을 반영한 것이므로 미해결 결정을 일방적으로 내리고 있지 않다 — 정합. 단, target 이 §3 레지스트리에서 `member`·`workflow`·`trigger`·`schedule`·`model_config` 의 Planned 액션도 열거하고 있으나, `spec-sync-data-flow-12-workspace-gaps.md` 의 "결정 필요" 표기와의 관계에서 `workspace.created/updated/deleted` 를 "Planned" 로 열거하는 것은 **결정을 내린 것이 아니라 목표 상태를 식별한 것** — 충돌 아님.
- **제안**: 조치 불요. `spec-sync-data-flow-12-workspace-gaps.md` 의 해당 결정 항목이 해소될 때 이 레지스트리 행을 동기 갱신하면 된다.

---

### 6. [INFO] `spec-draft-unified-model-management.md` 의 `model_config` 와 target `model_config` 행

- **target 위치**: `spec/conventions/audit-actions.md §3` — `model_config` 행: `create`, `update`, `delete`, `set-default` 상태="Planned"
- **관련 plan**: `plan/in-progress/spec-draft-unified-model-management.md` — `llm_config`→`model_config` 리네임 + `kind` 분류 추가. 마이그레이션 V088~V092 미머지.
- **상세**: target 은 `model_config` 를 Planned 으로 등재한다. `spec-draft-unified-model-management.md` 가 `llm_config`→`model_config` 리네임을 수행하는 과정에서 audit action resource 이름도 `model_config` 로 통일됨이 자연스럽다. target 이 `model_config` 라는 리소스명을 채택한 것은 해당 plan 의 리네임 결정과 일치한다. 단, unified-model-management plan 이 아직 미머지(V088~V092 미반영)인 상황이므로, 실제 DB/코드의 resource 이름이 `llm_config` 인 동안 target 의 `model_config` 표기가 "미래 상태"를 선제 채택한 것이 된다. `status: Planned` 로 명시되어 있어 충돌보다는 전망 표기에 해당 — 허용 범위.
- **제안**: `spec-draft-unified-model-management.md` 가 머지될 때 `model_config` audit 액션의 resource 이름이 일치하는지 교차 확인을 권장한다. 현 시점에서 차단 사유는 아님.

---

## 요약

`spec/conventions/audit-actions.md` 는 감사 액션 명명·시제 규칙과 도메인별 분류 레지스트리를 정의하는 신규 규약 문서다. 진행 중인 plan 들과의 관계를 검토한 결과, `auth_config.*` 5종·`user.*` 3종의 "구현됨" 표기는 각각 `auth-config-webhook-followups.md §1`(완료)·`refactor-04-followup-pwchange-userip.md`(완료) 와 정합한다. 가장 주목할 항목은 `refactor-04-followup-pwchange-userip.md §후속` 이 `workspace.transfer_ownership` 시제 분류를 "미해결 후속"으로 메모해뒀는데 target 이 이를 §2.3으로 분류해 실질적으로 해소하고 있다는 점이다 — 단 plan 의 해당 메모가 해소 완료로 닫히지 않아 추적 상태가 불명확하다. 미해결 결정을 우회하거나 미해소 선행 조건을 전제하는 CRITICAL/BLOCKING 사안은 없으나, `refactor-04-followup-pwchange-userip.md` 의 후속 메모를 명시적으로 닫아 plan 을 정리하는 것이 권장된다.

## 위험도

LOW
