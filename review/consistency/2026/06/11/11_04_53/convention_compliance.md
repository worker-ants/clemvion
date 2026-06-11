# 정식 규약 준수 검토 결과

검토 모드: `--impl-done` / diff-base: `origin/main`
검토 대상: `G-01/G-02 audit (rebase 후 재검)` — `audit-action.const.ts` 신설 + 인라인 문자열 → `AUDIT_ACTIONS` 상수 교체

---

## 발견사항

### 1. **[CRITICAL]** `spec/data-flow/1-audit.md §1.1` 표가 구현과 불일치 — `re_run_initiated` 잔존

- **target 위치**: `spec/data-flow/1-audit.md`, §1.1 표 8번째 row (`executions/executions.service.ts` writer)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1.1` 의 단일 진실 원칙. `data-flow/1-audit.md §1.1` 표는 현재 코드에서 실제로 기록되는 action 의 "SoT" 라고 본 spec 스스로 선언하고 있다 (`이 표가 현재 코드에서 실제로 기록되는 action 의 SoT 다`).
- **상세**: 구현 diff 는 `executions.service.ts` 의 action 문자열을 `'re_run_initiated'` → `AUDIT_ACTIONS.EXECUTION_RE_RUN` (`'execution.re_run'`) 으로 변경했다. 그러나 `/Volumes/project/private/clemvion/spec/data-flow/1-audit.md` §1.1 표는 여전히 `re_run_initiated` 를 action 값으로 기록하고 있으며, Rationale 절(`Action 은 자유 문자열, event 는 DB CHECK 로 고정`) 도 "dot-prefix 없이 규약 자체를 이탈한다" 는 서술이 `re_run_initiated` 를 예시로 들어 실제 코드 사실로 묘사하고 있다. 구현이 `execution.re_run` 으로 바뀐 지금은 이 Rationale 서술도 현황과 다르다.
- **제안**: `spec/data-flow/1-audit.md` §1.1 표 8번째 row 의 action 컬럼을 `execution.re_run` 으로 갱신한다. Rationale 의 `re_run_initiated` 예시 서술도 제거하거나 "이미 교정됨" 으로 갱신한다. 또한 `audit-action.const.ts` JSDoc 이 "data-flow/1-audit.md §1.1 목표 커버리지" 를 언급하므로, §1.1 표가 SoT 임을 유지하려면 동반 갱신이 필수다.

---

### 2. **[CRITICAL]** `spec/5-system/1-auth.md §4.1` 표가 실제 구현 action 명과 불일치

- **target 위치**: `spec/5-system/1-auth.md`, §4.1 `기록 대상 액션` 표
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2, §3` — `status: partial` spec 의 `code:` 경로는 구현 현황을 추적해야 하고, spec 본문이 선언한 surface 는 실제 구현과 정합해야 한다는 원칙.
- **상세**:
  1. §4.1 표의 Integration 카테고리는 `integration.create`, `integration.update`, `integration.delete` 를 기재하고 있으나, 구현(`audit-action.const.ts`)은 과거분사형 `integration.created`, `integration.updated`, `integration.deleted` 를 사용한다. 단순 오탈자가 아닌 동사 형태(현재형 vs 과거분사) 불일치다.
  2. §4.1 표에는 `execution.re_run`, `integration.rotated`, `integration.scope_changed`, `integration.reauthorized`, `workspace.transfer_ownership` 이 누락되어 있다. `audit-action.const.ts` 는 이 action 들을 구현된(현재) action 으로 정의하고 있으나, §4.1 은 이를 포함하지 않는다.
  3. `auth_config.reveal` 은 §4.1 표에 있고 구현도 동일 문자열을 사용 중이어서 일치하나, 위 두 불일치가 전체 표의 신뢰성을 저해한다.
- **제안**: `spec/5-system/1-auth.md §4.1` 표를 두 레이어로 분리하거나 현황 표를 추가한다. (a) `integration.create` → `integration.created` 등 동사형 수정. (b) 현재 구현된 액션(`execution.re_run`, `integration.rotated`, `integration.scope_changed`, `integration.reauthorized`, `workspace.transfer_ownership`)을 표에 추가. 이미 `data-flow/1-audit.md §1.1` 이 구현 SoT 임을 선언하고 있으므로 §4.1 은 "목표(planned) 카탈로그" 와 "현재 구현" 을 명확히 구분하는 것이 좋다.

---

### 3. **[WARNING]** `audit-action.const.ts` JSDoc 의 Planned action 목록이 `spec/5-system/1-auth.md §4.1` 와 교차-링크만 하고 실제 명칭 불일치를 숨김

- **target 위치**: `codebase/backend/src/modules/audit-logs/audit-action.const.ts`, JSDoc 블록 (line 48–51)
- **위반 규약**: 해당 JSDoc 은 "spec §4.1 의 Planned 액션" 을 참조하나, §4.1 표의 action 명이 구현과 불일치하는 상황에서 "이 const 에 없다" 는 서술이 독자에게 §4.1 을 신뢰하게 만든다.
- **상세**: JSDoc 이 `workflow.* · trigger.* · schedule.* · member.* · llm_config.* · rerank_config.* · password_change · 2fa_*` 를 Planned 로 열거하는 것은 맞으나, 동시에 §4.1 이 `integration.create` (비과거분사) 형태로 표기 중이라 JSDoc ↔ spec ↔ 구현 간 형태가 일관되지 않다. 이 JSDoc 을 읽는 개발자가 §4.1 을 신뢰하고 `integration.create` 를 사용하면 규약 위반 action 이 DB 에 삽입된다 (`AuditAction` union 타입이 이를 차단하기 때문에 실제로는 컴파일 에러가 나지만, spec 자체의 혼선이 바람직하지 않다).
- **제안**: §4.1 표 갱신(발견사항 2) 을 먼저 수행한 뒤 JSDoc 의 spec 참조가 정확한 명칭을 가리키도록 확인한다. 필요하다면 JSDoc 에 "spec §4.1 의 표기와 구현 명칭이 다를 경우 본 const 가 SoT" 임을 명시한다.

---

### 4. **[INFO]** `AuditLogDto` 응답 DTO `@ApiProperty({ example: ... })` 변경은 규약에 부합

- **target 위치**: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts`
- **위반 규약**: 없음.
- **상세**: diff 는 `example: 'workflow.update'` → `example: 'integration.updated'` 로 변경한다. `spec/conventions/swagger.md §1-2` 는 예시 값이 실제 사용되는 값과 정합하도록 권장하므로, 이 변경은 규약에 부합한다. `action: string` 타입 선언 자체는 여전히 `AuditAction` union 을 `@ApiProperty` 로 노출하지 않으나, 이는 기존 패턴이라 이번 diff 범위 밖이다.

---

### 5. **[INFO]** `data-flow/1-audit.md` 는 frontmatter 의무 대상 범위 밖 — frontmatter 부재는 위반 아님

- **target 위치**: `spec/data-flow/1-audit.md`
- **위반 규약**: 없음.
- **상세**: `spec/conventions/spec-impl-evidence.md §1` 의 frontmatter 의무 대상 목록(`spec/2-navigation`, `spec/3-workflow-editor`, `spec/4-nodes`, `spec/5-system`, `spec/7-channel-web-chat`, `spec/conventions`)에 `spec/data-flow/` 가 포함되지 않는다. 따라서 `data-flow/1-audit.md` 에 `id`/`status` frontmatter 가 없는 것은 규약 위반이 아니다.

---

## 요약

이번 diff 는 인라인 action 문자열을 `AUDIT_ACTIONS` 상수로 교체하고 `execution.re_run` (구 `re_run_initiated`) 으로 명칭을 정규화하는 올바른 구현 방향을 취하고 있다. 그러나 구현 변경이 spec 동반 갱신 없이 머지되면 `spec/data-flow/1-audit.md §1.1` 표(스스로 "현재 코드 action 의 SoT" 라 선언)와 `spec/5-system/1-auth.md §4.1` 표(integration action 명 동사형 오류 + execution.re_run 누락) 두 곳에서 규약 위반 상태가 지속된다. CRITICAL 2건은 spec 동반 갱신 없이 채택 시 단일 진실 원칙을 직접 침해한다.

## 위험도

**HIGH**

STATUS: ISSUES_FOUND
