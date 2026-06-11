# 신규 식별자 충돌 검토 결과

검토 대상: G-01/G-02 audit (rebase onto #542). `execution.re_run` + `AUDIT_ACTIONS` union + spec §4.1 구현됨/Planned 구조.
diff-base: origin/main

---

### 발견사항

- **[INFO]** `AuditLogDto` Swagger example 값 변경 (`workflow.update` → `integration.updated`)
  - target 신규 식별자: `@ApiProperty({ example: 'integration.updated' })` (audit-log-response.dto.ts)
  - 기존 사용처: origin/main `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:28` — `example: 'workflow.update'`
  - 상세: `workflow.update` 는 origin/main 에서 Swagger 예시값으로만 존재하며 실제 코드에서 `auditLogsService.record({ action: 'workflow.update' })` 호출은 없다. `integration.updated` 는 spec §4.1 "현재 구현된 액션" 표에 실재하는 action 값이므로 예시가 더 정확해진다. 충돌이 아니라 개선이다.
  - 제안: 변경 유지. `workflow.update` 는 spec §4.1 "Planned" 에 있는 미구현 action이어서 예시로 부적합했다.

- **[INFO]** `execution.re_run` 이 DB 레거시 row `re_run_initiated` 와 의미상 병존
  - target 신규 식별자: `execution.re_run` (AUDIT_ACTIONS.EXECUTION_RE_RUN)
  - 기존 사용처: origin/main `codebase/backend/src/modules/executions/executions.service.ts:421` — 인라인 문자열 `'re_run_initiated'`; DB 기존 row 에 해당 값이 적재돼 있을 수 있음
  - 상세: DB column `audit_log.action` 은 `varchar(100)` 으로 enum 제약 없음. 신규 row 는 `execution.re_run` 으로 기록되고, 기존 `re_run_initiated` row 는 append-only 보존(audit 불변 원칙). spec `data-flow/1-audit.md §Rationale` 및 `spec/5-system/13-replay-rerun.md §11` 에 이 이중 적재 상황이 명시·승인돼 있다. 코드 단 충돌은 없으며 조회 쿼리에서 두 값을 OR 결합해야 하는 운영 유의사항이 존재한다.
  - 제안: 기존 설계 의도대로 유지. 충돌 없음. 조회 API(`QueryAuditLogDto.action` 필터)가 단일 문자열 일치만 지원하므로, 재실행 이력 완전 조회가 필요한 경우 `re_run_initiated` OR `execution.re_run` 쿼리가 별도로 필요함을 운영 주석에 보존하는 것을 권장한다 (이미 `data-flow/1-audit.md §Rationale` 에 기재됨).

---

### 요약

신규 식별자(`AUDIT_ACTIONS` 상수 9개, `AuditAction` 타입, `audit-action.const.ts` 파일) 는 origin/main 에 동명의 선행 정의가 전혀 없으며, 도입되는 action 문자열 값(`integration.created` 등)은 spec §4.1 및 `data-flow/1-audit.md` 에 이미 정의된 값과 완전히 일치한다. `workflow.update` Swagger 예시 교체는 더 정확한 실재 action 값으로의 개선이다. `re_run_initiated` DB 레거시 row 와의 병존은 spec 에서 승인된 append-only 상황으로 코드 레벨 충돌이 아니다. CRITICAL 또는 WARNING 등급의 식별자 충돌은 발견되지 않았다.

### 위험도

NONE
