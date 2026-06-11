# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `record()` 파라미터 타입 강화 — 기존 호출자 컴파일 차단 가능
- 위치: `audit-logs.service.ts` L124 (`action: string` → `action: AuditAction`)
- 상세: `record()` 의 `action` 필드 타입이 `string` 에서 `AuditAction` (좁은 리터럴 union) 으로 변경되었다. TypeScript 컴파일 타임에 `AUDIT_ACTIONS.*` 외의 임의 문자열을 넘기는 기존 호출자가 있다면 빌드 에러가 발생한다. 런타임 동작(DB에 기록되는 값)은 변경 전과 동일하므로 실제 데이터 부작용은 없다. 이번 변경 범위에서 확인된 모든 호출자(integrations, executions, auth-configs, workspaces)는 이미 const 값으로 교체되었으므로 현재 코드베이스 내 컴파일 에러는 없다. 단, 아직 교체되지 않은 호출자가 코드베이스에 잔존할 경우 빌드 차단이 발생한다.
- 제안: `grep -r 'auditLogsService.record' codebase/backend/src` 로 잔여 인라인 문자열 호출자를 확인한다.

### [INFO] `AUDIT_ACTIONS` 새 전역 상수 도입 — 의도된 변경
- 위치: `audit-action.const.ts` (신규 파일)
- 상세: `AUDIT_ACTIONS` 는 `as const` 객체이므로 런타임에 변이되지 않는다. 모듈 스코프 상수로 export 되어 전역 변수는 아니다. 신규 파일 도입은 의도된 변경이다.
- 제안: 없음.

### [INFO] `AuditLogDto.action` / `AuditLogDto.resourceType` — example 값만 변경, 필드 타입 그대로
- 위치: `audit-log-response.dto.ts` (`@ApiProperty({ example: ... })`)
- 상세: OpenAPI Swagger 문서의 example 값만 바뀌었다(`workflow.update` → `integration.updated`, `workflow` → `integration`). 런타임 직렬화·역직렬화에는 영향이 없다. 이전 example 이 실제 존재하지 않는 action 이름을 노출하고 있었으므로 수정이 타당하다.
- 제안: 없음.

### [INFO] 기존 인라인 문자열 값과 새 const 값의 동일성 확인
- 위치: 파일 4, 8, 9, 10 전체
- 상세: 교체 전 인라인 문자열 값과 `AUDIT_ACTIONS.*` 의 값이 정확히 일치하는지 확인한다. 검증 결과:
  - `'auth_config.reveal'` ↔ `AUDIT_ACTIONS.AUTH_CONFIG_REVEAL = 'auth_config.reveal'` — 일치
  - `'re_run_initiated'` ↔ `AUDIT_ACTIONS.EXECUTION_RE_RUN = 'execution.re_run'` — **변경됨** (의도된 rename)
  - `'integration.created'` ↔ `AUDIT_ACTIONS.INTEGRATION_CREATED = 'integration.created'` — 일치
  - 나머지 integration.* / workspace.* 값 모두 일치
- 상세(EXECUTION_RE_RUN rename): `re_run_initiated` → `execution.re_run` 변경은 DB에 이미 존재하는 audit log 레코드와의 불일치를 야기한다. 기존에 기록된 `re_run_initiated` 행과 신규 기록될 `execution.re_run` 행이 혼재하게 된다. 이 변경은 의도된 것으로 보이며(commit 메시지 G-02), 단순 부작용이 아닌 계획된 데이터 마이그레이션 필요 사항이다.
- 제안: 기존 `action = 're_run_initiated'` 레코드를 `execution.re_run` 으로 backfill 하는 DB 마이그레이션이 필요한지 검토한다. 감사 로그를 `action` 으로 필터링하는 UI·API가 있다면 이전 값으로 조회 시 누락이 발생한다.

### [INFO] 테스트 파일 assertion 값 업데이트 — 런타임 부작용 없음
- 위치: `executions-rerun.service.spec.ts` L827, `executions.service.spec.ts` L1410
- 상세: 테스트의 expect 값과 주석이 새 action 명칭으로 갱신되었다. 실제 서비스 동작에는 영향 없다.
- 제안: 없음.

### [INFO] `executions.module.ts` 주석 업데이트 — 부작용 없음
- 위치: `executions.module.ts` L1337
- 상세: 모듈 import 옆 주석만 변경. NestJS DI 그래프에 영향 없다.
- 제안: 없음.

---

## 요약

이번 변경은 감사 로그 action 식별자를 인라인 문자열에서 중앙 집중 상수(`AUDIT_ACTIONS`)로 전환하고 `record()` 의 파라미터 타입을 강화한 리팩토링이다. 전역 상태 변경·파일시스템 부작용·환경 변수·네트워크 호출·이벤트 발생은 없다. 유일한 주의 사항은 `re_run_initiated` → `execution.re_run` rename으로 인해 기존 DB 레코드와 신규 레코드 간 action 값이 불일치하게 된다는 점이며, 이는 의도된 변경(G-02)이지만 감사 로그 필터링 UI 사용처에서 이전 값 조회 시 데이터 누락이 발생할 수 있으므로 backfill 필요 여부를 확인해야 한다.

---

## 위험도

LOW
