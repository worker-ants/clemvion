STATUS: OK

# Cross-Spec 일관성 검토

## 검토 범위

- target: `re_run_initiated → execution.re_run` 개명 + `AUDIT_ACTIONS` union 상수 도입 (9 call site 전환) + `spec §4.1` 구현됨/Planned 구분 — 코드 diff 기준
- 비교 대상 spec:
  - `spec/5-system/1-auth.md §4.1`
  - `spec/5-system/13-replay-rerun.md §11`
  - `spec/data-flow/1-audit.md §1.1, Rationale`
  - `spec/1-data-model.md §2.18`

---

## 발견사항

### [CRITICAL] `spec/5-system/13-replay-rerun.md §11` 가 개명 전 `re_run_initiated` 를 여전히 명시

- **target 위치**: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` — `EXECUTION_RE_RUN: 'execution.re_run'` 정의. `executions.service.ts` 호출부 `action: AUDIT_ACTIONS.EXECUTION_RE_RUN`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/13-replay-rerun.md §11` (line ~400)
  ```
  | `event_type` | `action` | `re_run_initiated` |
  ```
  및 §11 서두 "신규 이벤트 `re_run_initiated` 를 기록한다", §479 "§11 — `re_run_initiated` 이벤트"
- **상세**: 구현이 `re_run_initiated` → `execution.re_run` 으로 바뀌었으나 13-replay-rerun.md 는 이전 값을 여전히 SoT 로 명시. 두 문서 중 어느 쪽을 따르는지 일의적으로 결정할 수 없으므로 그대로 채택하면 spec §11 이 구현과 어긋나게 된다.
- **제안**: `spec/5-system/13-replay-rerun.md §11` 의 action 값을 `execution.re_run` 으로 일괄 교체. 동반 변경 위치: §11 표 `re_run_initiated` 행, §11 서두 설명 문장, 요약 표 §479.

---

### [CRITICAL] `spec/data-flow/1-audit.md §1.1` 표가 개명 전 값을 SoT 로 선언

- **target 위치**: 코드 diff — `executions.service.ts` 호출부 (action 값 변경)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/data-flow/1-audit.md §1.1` (line ~52)
  ```
  | `executions/executions.service.ts` | `re_run_initiated` | execution | ...
  ```
  및 Rationale 섹션 (line ~58, ~190):
  ```
  `re_run_initiated` 는 dot-prefix 없이 규약 자체를 이탈한다
  이탈(`re_run_initiated`) 이 이미 혼재 적재되고 있다 (§1.1).
  ```
- **상세**: data-flow/1-audit.md §1.1 표는 "현재 코드에서 실제로 기록되는 action 의 SoT" 라고 명시하므로, 코드 변경 후에는 이 표가 직접 모순이 된다. Rationale 의 "비일관이 실제 존재한다" 서술도 re_run_initiated 를 예시로 드는데 해당 예시가 소멸되므로 업데이트 필요.
- **제안**: `spec/data-flow/1-audit.md §1.1` 표의 executions 행 action 값을 `execution.re_run` 으로 수정. Rationale 의 `re_run_initiated` 예시를 새 값으로 교체하거나 해당 주석 자체를 재서술.

---

### [WARNING] `spec/5-system/1-auth.md §4.1` 의 Integration action 명명이 구현 const 와 불일치

- **target 위치**: `audit-action.const.ts` — `INTEGRATION_CREATED: 'integration.created'`, `INTEGRATION_UPDATED: 'integration.updated'`, `INTEGRATION_DELETED: 'integration.deleted'`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/1-auth.md §4.1` (line ~350)
  ```
  | Integration | integration.create, integration.update, integration.delete |
  ```
- **상세**: auth spec §4.1 은 현재시제·명령형(`integration.create/update/delete`)을 사용하나 구현 const 및 data-flow/1-audit.md §1.1 표는 과거분사형(`integration.created/updated/deleted`)을 사용. 새 `AUDIT_ACTIONS` 상수가 이 값을 코드 레벨 SoT 로 고정함으로써 불일치가 더 명확해졌다. 필터 UI 나 audit 조회 쿼리에서 `action='integration.create'` 로 검색하면 결과가 0건이 된다.
- **제안**: `spec/5-system/1-auth.md §4.1` Integration 행을 `integration.created, integration.updated, integration.deleted, integration.rotated, integration.scope_changed, integration.reauthorized` 로 수정해 실제 구현된 값을 반영. `AUDIT_ACTIONS` 에 있으나 §4.1 에 없는 세 액션(`rotated`·`scope_changed`·`reauthorized`) 도 추가 필요.

---

### [WARNING] `spec/5-system/1-auth.md §4.1` 에 `execution.re_run` 및 `auth_config.reveal` 누락

- **target 위치**: `audit-action.const.ts` — `EXECUTION_RE_RUN`, `AUTH_CONFIG_REVEAL`, `WORKSPACE_TRANSFER_OWNERSHIP`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/1-auth.md §4.1` (line 342–352) — `execution.*` 카테고리 행 없음, `workspace.transfer_ownership` 행 없음
- **상세**: §4.1 은 `workflow.execute` 를 워크플로우 카테고리로 포함하지만 `execution.re_run` 은 없고, `auth_config.reveal` 은 §4.1 표 설정 카테고리 안에 없다. `workspace.transfer_ownership` 도 §4.1 의 워크스페이스 행(`workspace.create/update/delete`)에 없다. `AUDIT_ACTIONS` 상수가 구현 SoT 로 확정되면서 §4.1 과의 갭이 노출된다.
- **제안**: `spec/5-system/1-auth.md §4.1` 표에 execution 카테고리 행(`execution.re_run`)과 `workspace.transfer_ownership`, `auth_config.reveal` 추가. 단 §4.1 의 다수 항목이 Planned(미구현) 이므로 구현됨/Planned 구분 기호를 사용해 현재 구현된 9종과 미구현 항목을 분리 표시.

---

### [INFO] `spec/data-flow/1-audit.md` Rationale — "AuditAction 0건" 주석이 이제 사실과 다름

- **target 위치**: `audit-action.const.ts` — `export type AuditAction` 정의 + `audit-logs.service.ts` `action: AuditAction` 시그니처 변경
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/data-flow/1-audit.md` Rationale (line ~60):
  ```
  record 시그니처가 `action: string` 자유 문자열이고 application 단에 action union/enum
  타입이 없어 (grep `AuditAction` 0건) 이를 막는 장치가 없다
  ```
  및 Rationale (line ~188–193) 의 동일 맥락 서술
- **상세**: `AuditAction` type 이 도입되고 `record` 의 `action` 파라미터가 `AuditAction` 으로 좁혀졌으므로 "장치가 없다" 서술 및 grep 0건 주석이 구현 현실과 어긋난다.
- **제안**: `spec/data-flow/1-audit.md` Rationale 의 해당 서술을 "AuditAction union type + AUDIT_ACTIONS const 가 도입되어 인라인 문자열 직접 사용이 타입 레벨에서 차단됨" 으로 갱신. "표기 통일은 미해결 과제" 서술도 해소 여부 명시.

---

## 요약

이번 변경의 핵심은 audit action 값 `re_run_initiated` → `execution.re_run` 개명과 `AUDIT_ACTIONS` 상수 도입이다. 코드 레벨은 일관되게 전환되었으나, `spec/5-system/13-replay-rerun.md §11` 과 `spec/data-flow/1-audit.md §1.1` 이 여전히 구 값(`re_run_initiated`)을 SoT 로 명시하고 있어 두 곳에서 직접 충돌이 발생한다. 추가로 `spec/5-system/1-auth.md §4.1` 의 Integration action 명칭이 과거부터 현재시제와 과거분사형 사이 불일치를 가지고 있었는데, `AUDIT_ACTIONS` const 가 과거분사형을 코드 SoT 로 고정함으로써 이 불일치가 확정·가시화됐다. 충돌 두 건(replay-rerun §11, data-flow/1-audit §1.1)은 채택 즉시 spec 과 구현이 어긋나므로 반드시 동반 갱신이 필요하고, §4.1 명명 불일치 및 누락 액션은 감사 로그 필터 검색 오작동 가능성이 있어 갱신 권장이다.

## 위험도

HIGH
