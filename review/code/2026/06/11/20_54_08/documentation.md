# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `audit-action.const.ts` — 모듈 수준 독스트링 품질 우수
- 위치: `/codebase/backend/src/modules/audit-logs/audit-action.const.ts` (전체)
- 상세: 신규 파일의 모듈 독스트링이 (1) SoT 참조(`spec/5-system/1-auth.md §4.1`), (2) 네이밍 규약 설명(`<resource>.<verb>`), (3) 미구현 Planned 액션 목록 및 후속 작업 포인터(`data-flow/1-audit.md §1.1`)를 모두 명시하고 있어 유지 보수자가 new action 추가 절차를 파악하는 데 충분하다.
- 제안: 없음. 현재 수준이 적절하다.

### [WARNING] `AuditLogDto.action` 필드 타입이 `string`으로 유지됨 — 응답 DTO 와 상수 간 타입 연결 없음
- 위치: `/codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts` L301
- 상세: `audit-logs.service.ts`의 `record()` 파라미터 타입은 `AuditAction` union으로 강제되었으나, 응답 DTO인 `AuditLogDto.action`은 여전히 `string`이다. API 문서(Swagger)의 `@ApiProperty({ example: 'integration.updated' })` 예시는 변경되었지만, 허용 값의 범위(`enum`)는 문서화되지 않아 소비자가 가능한 action 값을 알 수 없다.
- 제안: `@ApiProperty({ example: 'integration.updated', description: 'AUDIT_ACTIONS 상수에 정의된 action 식별자. 형식: <resource>.<verb>' })` 또는 `enum` 키를 명시한다. 타입을 `AuditAction`으로 변경하는 것은 엔티티→DTO 직렬화 경계가 있어 별도 작업이지만, 최소한 Swagger description에 가능한 값 목록을 링크하거나 열거하는 것이 권장된다.

### [INFO] `AuditLogsService.record()` 독스트링 — swallow 정책 명시
- 위치: `/codebase/backend/src/modules/audit-logs/audit-logs.service.ts` L200-L203
- 상세: `record()` 메서드에 "Failures are swallowed — audit logging must never break the primary action." 주석이 있어 핵심 계약이 명시되어 있다. 이 정책은 테스트(`executions-rerun.service.spec.ts` W6/W7 케이스)에서도 검증된다.
- 제안: 없음.

### [INFO] `executions.module.ts` 인라인 주석 — action 명 변경에 맞게 갱신됨
- 위치: `/codebase/backend/src/modules/executions/executions.module.ts` L1379
- 상세: `// re_run_initiated 감사 로그 기록` → `// execution.re_run 감사 로그 기록` 으로 갱신되어 코드와 주석이 일치한다.
- 제안: 없음.

### [INFO] 테스트 파일 인라인 주석 — action 명 갱신 일관성
- 위치:
  - `/codebase/backend/src/modules/executions/executions-rerun.service.spec.ts` L144, L824
  - `/codebase/backend/src/modules/executions/executions.service.spec.ts` L143, L409, L564
- 상세: 두 spec 파일 모두 mock 주석의 `re_run_initiated` → `execution.re_run` 으로 일관되게 갱신되었다.
- 제안: 없음.

### [WARNING] Planned 액션 목록 — spec 참조와 실제 const 간 동기화 책임이 수동
- 위치: `/codebase/backend/src/modules/audit-logs/audit-action.const.ts` L45-L47
- 상세: 독스트링에 "spec §4.1 의 Planned 액션은 미구현이라 본 const 에 없다"라고 명시되어 있으나, spec 변경 시 이 주석을 함께 갱신해야 한다는 절차가 어디에도 강제되지 않는다. Planned 목록이 spec에서 변경되어도 이 const 주석은 stale해질 위험이 있다.
- 제안: 주석에 "구현 시 spec §4.1 의 Planned 항목을 본 const 와 독스트링에 동시 추가한다"는 한 줄을 추가해 갱신 책임을 명시한다. 또는 spec에 동일한 노트를 추가한다.

### [INFO] `integrations.service.ts` — 대량 인라인 문자열 제거, 주석 변경 없음
- 위치: `/codebase/backend/src/modules/integrations/integrations.service.ts` (6개 사이트)
- 상세: 인라인 문자열(`'integration.created'` 등)이 상수로 교체되었을 뿐 로직 주석은 없다. 각 `record()` 호출 사이트에 별도 주석이 없는 것은 해당 메서드가 self-documenting한 네이밍을 갖고 있어 적절하다.
- 제안: 없음.

### [INFO] `auth-configs.service.ts` — `reveal()` 메서드 독스트링 참조 정확
- 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L516-L519
- 상세: `reveal()` 독스트링이 `spec/2-navigation/6-config.md §A.4`를 참조하며, audit 기록이 `AUDIT_ACTIONS.AUTH_CONFIG_REVEAL` 상수로 교체되어 주석과 구현이 일치한다.
- 제안: 없음.

### [INFO] CHANGELOG / README 업데이트
- 위치: 전체 변경 세트
- 상세: 이번 변경은 공개 API 계약(엔드포인트, 요청/응답 스키마)을 변경하지 않고 내부 상수화(refactor)를 수행했다. 단, `execution.re_run`(구 `re_run_initiated`) 은 감사 로그 `action` 문자열이 DB에 저장되는 값이므로, 기존 운영 데이터에 `re_run_initiated`가 존재하면 필터 쿼리가 달라진다.
- 제안: 운영 환경에서 이미 `re_run_initiated` action 값이 감사 로그에 저장된 경우를 위해 CHANGELOG 또는 마이그레이션 노트에 "기존 `re_run_initiated` 레코드는 소급 갱신되지 않음 — 이전 값 필터링이 필요하면 양쪽 값을 OR로 조회해야 함"을 기재하는 것을 권장한다. 현재 변경에 migration SQL이 포함되지 않은 것은 WARNING 수준이다.

### [WARNING] DB 저장 값 변경(`re_run_initiated` → `execution.re_run`) — 마이그레이션 문서 부재
- 위치: `/codebase/backend/src/modules/executions/executions.service.ts` diff (L419)
- 상세: `action` 컬럼은 DB에 저장되는 실제 문자열이다. `re_run_initiated`에서 `execution.re_run`으로 변경되면 기존 레코드와 신규 레코드 간 값이 달라진다. 코드베이스 어디에도 이 값 변경을 위한 DB 마이그레이션 또는 운영 주의사항 문서를 찾을 수 없다.
- 제안: plan 문서 또는 spec의 감사 로그 관련 섹션에 "레거시 값 `re_run_initiated`는 하위 호환 조회를 위해 OR 조건 처리가 필요하다"는 노트를 추가한다. 필요 시 DB 값을 일괄 갱신하는 마이그레이션 스크립트를 별도 작성한다.

---

## 요약

전반적으로 문서화 수준은 양호하다. 신규 `audit-action.const.ts` 파일은 SoT 참조, 네이밍 규약, 미구현 목록을 포함한 충실한 모듈 독스트링을 갖추었고, 변경된 모든 인라인 주석과 테스트 주석이 새 action 명으로 일관되게 갱신되었다. 다만 두 가지 WARNING이 있다: (1) 응답 DTO `AuditLogDto.action`의 Swagger 문서에 허용 값 범위가 없어 API 소비자가 가능한 값을 추론하기 어렵고, (2) `re_run_initiated` → `execution.re_run` 값 변경이 DB 저장 값에 영향을 미침에도 마이그레이션 문서나 운영 주의사항이 코드베이스 어디에도 기재되지 않아 향후 레거시 데이터 필터링 시 혼선이 우려된다.

## 위험도

MEDIUM
