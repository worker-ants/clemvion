# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 검토 범위 요약

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- spec 델타: 0개 파일 (이 브랜치는 `spec/5-system/` 을 바꾸지 않음 — 정상)
- 코드 diff: 3개 파일 / 229줄
  - `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
  - `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
  - `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts`
- 변경 내용: `ExecutionDto`(`triggerId`/`finishedAt`/`durationMs`/`inputData`/`outputData`/`error`/`executedBy`/`parentExecutionId`/`reRunOf`/`chainId`)와 `ExecutionStatusDto`(`durationMs`/`currentNode`/`context`/`result`/`error`)를 `@ApiPropertyOptional` + `field?: T | null` 에서 `@ApiProperty({ nullable: true })` + `field: T | null` 로 전환 — "null 은 상시 존재(required)" 규약 위반을 정정. git log 확인 결과 이 3개 파일은 더 큰 배치(`499675277 fix(dto): 응답 83곳의 required 를 실제와 맞춘다`, `441761478 fix(dto): 배치를 83 → 15 로 좁힌다`)의 일부로 이미 커밋되어 있다.

## 교차 검증 대상

1. `spec/5-system/2-api-convention.md` §5.4 "부재 표현 — `null` vs 키 생략"
2. `spec/conventions/swagger.md` §1-3 "Optional 필드"
3. `spec/5-system/14-external-interaction-api.md` §5.3 "단발 상태 조회"
4. `spec/2-navigation/14-execution-history.md` 목록/상세 API 응답 예시
5. `spec/1-data-model.md` §2.13 Execution 컬럼 정의

## 발견사항

없음. 아래는 확인한 정합 근거.

- **api-convention §5.4 와 정합**: "`null` 을 쓰는(상시 존재) 필드 → `@ApiProperty({ nullable: true })` + `field: T | null`" 규칙을 그대로 반영한다. diff 이전 상태(`@ApiPropertyOptional` + `field?: T | null`)가 오히려 이 절이 명시적으로 금지하는 "OpenAPI 가 null 가능성을 감춰 소비자가 키 부재 분기를 쓰게 되는" 상태였다.
- **swagger.md §1-3 과 정합**: 해당 절이 정확히 EIA §5.3 을 근거 사례로 들어 `@ApiPropertyOptional` 대신 `@ApiProperty({ nullable: true })` 를 써야 하는 이유를 문서화하고 있다(라인 107-109).
- **EIA §5.3 과 정합**: `getStatus` 응답 JSON 스키마 주석이 `durationMs`/`currentNode`/`context`/`result`/`error` 를 전부 "종결 전에는 null (키는 present)" 로 명시한다. diff 는 이 5개 필드를 정확히 required+nullable 로 맞췄다(테스트 추가분도 동일 5개 필드).
- **execution-history.md 예시와 정합**: 목록/상세 API 응답 예시 JSON 이 `triggerId`/`executedBy`/`parentExecutionId`/`reRunOf`/`chainId`/`error`/`finishedAt`/`durationMs`/`inputData`/`outputData` 를 이미 전부 "키 present, 값 `null`" 형태로 보여준다 — diff 이전 TS 옵셔널 선언(`?`)과 OpenAPI `required:false` 출력은 이 예시와 어긋나 있었고, diff 가 그 어긋남을 해소한다.
- **data-model.md §2.13 과 정합**: `trigger_id`/`finished_at`/`duration_ms`/`input_data`/`output_data`/`error`/`executed_by`/`parent_execution_id`/`re_run_of`/`chain_id` 는 모두 DB 레벨 nullable 컬럼(`?`/`NULLABLE`)으로 정의되어 있다. "컬럼이 nullable" 은 "응답 키를 생략해도 된다" 를 함의하지 않으며, §5.4 규칙에 따라 DTO 는 `T | null` + required 여야 한다 — diff 의 방향과 일치한다.
- 다른 영역에서 이 5개(EIA)·10개(ExecutionDto) 필드를 "옵셔널 키"로 규정하는 상충 서술은 발견하지 못했다. `spec/5-system/4-execution-engine.md` (`ExecuteOptions.triggerId?`/`executedBy?`)와 `spec/5-system/14-external-interaction-api.md` §3.3.1 (`InteractionRequestContext.triggerId?: string | null`)에 유사한 필드명의 `?` 선언이 있으나, 이들은 응답 DTO 가 아니라 **내부 함수 호출 옵션 / in-process 컨텍스트 타입**이라 §5.4 의 적용 범위(응답 바디) 밖이며 diff 와 충돌하지 않는다.
- `spec/conventions/chat-channel-adapter.md` 의 WS 이벤트(`execution.completed`/`failed`/`cancelled`) 타입에 `durationMs?: number | null` (키 생략 **and** nullable 병기)이 pre-existing 으로 남아 있으나, 이는 이 diff 가 건드리지 않은 별개 WS wire 표면이며 §5.4 자체가 적용 범위를 "응답 바디"로 한정해 REST DTO 규칙과 직접 충돌하지 않는다 — 잠재적 후속 정리 대상일 수 있으나 이번 diff 가 유발한 신규 모순은 아니다(참고용, 등급 부여 대상 아님).

## 요약

이번 diff 는 `spec/5-system/` 자체를 변경하지 않는 순수 코드 diff로, `ExecutionDto`/`ExecutionStatusDto` 의 nullable-vs-optional DTO 선언을 `spec/5-system/2-api-convention.md` §5.4 및 `spec/conventions/swagger.md` §1-3 규칙에 맞추는 정정이다. EIA §5.3 스펙 본문, `execution-history.md` 응답 예시, `1-data-model.md` 컬럼 정의를 대조한 결과 모두 diff 의 방향(필드는 상시 존재 + `null` 값)과 부합하며, 다른 spec 영역과의 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다. 이미 git log 상 더 큰 정합 배치의 일부로 커밋돼 있어 계획적·일관된 방향의 연속 작업으로 보인다.

## 위험도

NONE
