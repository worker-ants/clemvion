# 정식 규약 준수 검토 — G-01/G-02 audit (AUDIT_ACTIONS const + execution.re_run rename)

검토 대상: `git diff origin/main...HEAD` (audit-action.const.ts 신규 + 관련 서비스 파일 8개 수정)

---

## 발견사항

### [WARNING] `data-flow/1-audit.md §1.1` SoT 표 미갱신

- **target 위치**: 없음 — diff 에 `spec/data-flow/1-audit.md` 변경 없음
- **위반 규약**: `spec/data-flow/1-audit.md §1.1` 본문 ("이 표가 현재 코드에서 실제로 기록되는 action 의 SoT 다")
- **상세**: G-02 가 `re_run_initiated` → `execution.re_run` 으로 값을 변경했으나, data-flow/1-audit.md §1.1 의 표에는 여전히 `re_run_initiated` 가 남아 있다. 해당 문서는 구현 현황의 단일 진실(SoT)임을 명문화하고 있으므로("커버리지 확장 시 §1.1 표를 함께 갱신해야 한다"), 코드와 spec 이 어긋나는 상태가 된다. 또한 같은 표에 `integration.created/updated/deleted/rotated/scope_changed/reauthorized`, `workspace.transfer_ownership`, `auth_config.reveal` 전체가 이미 일관된 과거분사/dot-prefix 형으로 기록돼 있으므로, `execution.re_run` 행만 갱신하면 충분하다.
- **제안**: `spec/data-flow/1-audit.md §1.1` 의 `re_run_initiated` 행을 `execution.re_run` 으로 교체하고, 비고에 G-02 rename 근거("spec §4.1 naming 규약 정합화") 를 추가한다. spec 변경이므로 project-planner 역할 범위다.

---

### [WARNING] `spec/5-system/1-auth.md §4.1` 과 구현 간 action verb 시제 불일치 (사전 존재, diff 미해소)

- **target 위치**: diff 내 `audit-action.const.ts` JSDoc 및 실제 action 값
- **위반 규약**: `spec/5-system/1-auth.md §4.1` 표 — `integration.create`, `integration.update`, `integration.delete` (동사 원형)
- **상세**: spec §4.1 표는 `integration.create/update/delete` (동사 원형)를 명기하나, data-flow/1-audit.md §1.1 및 이번 diff 의 `AUDIT_ACTIONS` 는 `integration.created/updated/deleted` (과거분사) 를 사용한다. 이 불일치는 본 diff 이전부터 존재했고 (`data-flow/1-audit.md Rationale: "과거분사형... 혼재"` 서술 존재), 이번 diff 는 해소하지 않는다. `AUDIT_ACTIONS` 의 JSDoc 이 "verb 시제는 도메인별로 일관 유지한다" 고 자체 규약을 선언하고 있지만, spec §4.1 표의 동사 원형 표기를 공식으로 갱신하지 않는 한 spec↔구현 불일치로 남는다.
- **제안**: 두 가지 선택지 중 하나를 택해야 한다. (a) spec §4.1 표의 `integration.create/update/delete` 를 구현 현황에 맞게 `integration.created/updated/deleted` 로 갱신하고, 나아가 `execution.re_run` 항목도 추가 (현재 표에 없음). (b) spec §4.1 을 목표 설계(planned) 표기로 간주하고, data-flow §1.1 을 구현 현황 SoT 로 명시하는 주석을 spec §4.1 에 추가한다. 어느 선택이든 spec 변경이므로 project-planner 위임이 필요하다.

---

### [INFO] `AuditLogDto.action` 필드 타입 미강화

- **target 위치**: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts` — `action: string`
- **위반 규약**: `spec/conventions/swagger.md §1-2` (example 보강 의도), 직접 위반이라기보다 일관성 권고
- **상세**: `AuditLogsService.record` 의 `action` 인자는 `AuditAction` union 으로 강화됐으나, 응답 DTO `AuditLogDto.action` 는 여전히 `action: string` 이다. 이는 기능상 무해하고 swagger 출력에서도 string 으로만 노출된다. 이번 diff 에서 `@ApiProperty({ example: 'integration.updated' })` 로 example 을 갱신한 것은 올바른 개선이다. 다만 응답 DTO 에서도 `@ApiProperty({ enum: AUDIT_ACTIONS, enumName: 'AuditAction' })` 를 추가하면 Swagger 문서에서 가능한 값 목록이 드러나 API 소비자 친화성이 높아진다.
- **제안**: 즉시 필수는 아니나, 응답 DTO `action` 필드에 `@ApiProperty({ enum: Object.values(AUDIT_ACTIONS), example: 'integration.updated' })` 추가를 별도 INFO 과제로 기록해 두길 권장한다. 본 diff 의 스코프(G-01/G-02) 범위 밖으로 판단되면 스킵 가능.

---

### [INFO] `AUDIT_ACTIONS` const 파일 위치 및 파일명 규약 확인

- **target 위치**: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (신규)
- **위반 규약**: 직접 위반 없음 — NestJS 관례상 `*.const.ts` 는 허용 패턴
- **상세**: `audit-action.const.ts` 파일명은 NestJS 관례(`<name>.const.ts`)와 일치하고, 모듈 경계(`audit-logs/`) 안에 위치하며, export 는 `AUDIT_ACTIONS` 상수 (UPPER_SNAKE_CASE) + `AuditAction` type (PascalCase) 로 각각 규약에 맞다. `spec/conventions/error-codes.md §1` 의 도메인 prefix (`<DOMAIN>_<CONDITION>`) 패턴도 `INTEGRATION_CREATED`, `WORKSPACE_TRANSFER_OWNERSHIP`, `EXECUTION_RE_RUN` 등에서 일관되게 준수되고 있다. 특이사항 없음.

---

## 요약

이번 diff 의 핵심(G-01: `AUDIT_ACTIONS` union 강제, G-02: `execution.re_run` rename)은 정식 규약의 직접 위반이 없으며 코드 레벨 명명은 올바르다. 그러나 G-02 의 rename 이 `spec/data-flow/1-audit.md §1.1` SoT 표에 반영되지 않아 spec↔구현 불일치(WARNING)가 발생한다. 또한 spec §4.1 표가 동사 원형(`integration.create`) 을 사용하는 반면 구현이 과거분사(`integration.created`)를 사용하는 불일치는 본 diff 이전부터 존재하며 이번 diff 에서도 미해소(WARNING)다. 두 WARNING 모두 spec 갱신으로 해소 가능하며, 코드 자체의 재작업은 불필요하다.

## 위험도

MEDIUM
