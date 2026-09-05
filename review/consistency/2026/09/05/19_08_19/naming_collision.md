# 신규 식별자 충돌 검토

## 검토 범위 확인

- `spec/5-system/` 델타: **0개 파일** (이번 브랜치는 그 spec 영역을 바꾸지 않았다 — 정상).
- 실제 변경은 코드 전용 sweep: `git diff origin/main...HEAD -- codebase/` = 26개 파일 / 849 삽입 · 35 삭제
  (`.claude/worktrees/sweep-response-contract-5ba0ad` 워킹트리에서 직접 실측).
  `git diff --diff-filter=A/D` 결과 0건 — **신규·삭제 파일 없음**, 전부 기존 파일 수정.
- 내용: `§5.4 응답-계약(response-contract)` 검증자를 14개 엔드포인트로 추가 배선하고, 그 스윕이
  찾은 실제 drift(트리거 회전 secret 유출 2건 + 미선언 필드 24건)를 수정한 sweep. 새 API
  endpoint·요구사항 ID·환경변수·이벤트명·spec 파일 경로는 도입되지 않았다.

아래는 이 diff 가 실제로 새로 도입한 식별자들을 대상으로 한 충돌 점검이다.

## 발견사항

- **[WARNING]** `OPTIONAL_NULLABLE_DRIFT` (기존) vs `EXPECTED_OPTIONAL_NULLABLE_DRIFT` (신규) — 근접한 이름의 두 베이스라인이 같은 10개 항목을 무교차 참조로 중복 추적
  - target 신규 식별자: `EXPECTED_OPTIONAL_NULLABLE_DRIFT` (신규 상수, `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:365`) — `required:false`+`nullable:true` 금지 조합의 저장소 전수 래칫 목록(78건, `<파일>:<클래스>.<필드>` 키 형식)
  - 기존 사용처: `OPTIONAL_NULLABLE_DRIFT` (기존 상수, `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.spec.ts:63`, 커밋 `f5d97aa39`/#1288 로 이미 origin/main 에 존재) — `ExecutionDto` 스키마 레벨 회귀 가드 전용, 필드명만(클래스 접두 없이) 10개 나열
  - 상세: 신규 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 안의 다음 10개 키가 기존 `OPTIONAL_NULLABLE_DRIFT` 10개 항목과 **완전히 동일한 대상**을 가리킨다 — `execution-response.dto.ts:ExecutionDto.{chainId, durationMs, error, executedBy, finishedAt, inputData, outputData, parentExecutionId, reRunOf, triggerId}`. 즉 같은 부채(§5.4 금지 조합)를 두 개의 서로 다른 파일이, 서로 다르지만 매우 비슷한 이름의 상수로, **상호 참조 없이** 각자 고정하고 있다. `grep`으로 이름만 보면 어느 것이 "그 축의 SoT" 인지 판별하기 어렵고, 향후 `ExecutionDto` 의 이 필드들을 정정(부채 상환)하면 두 파일을 **모두** 갱신해야 하는데 어느 쪽도 그 사실을 알려주는 포인터가 없다 — 한쪽만 고치면 다른 쪽 목록이 조용히 stale 해진다.
  - `spec/conventions/swagger.md` §5 는 정확히 이 유형의 위험을 "**이름 충돌을 피합니다** — 도메인 접두로 다른 모듈의 동명 상수와 grep 을 가른다" 로 명문화하고 있고, `spec/5-system/2-api-convention.md` "검증 층" 절도 "두 검증자는 **이름이 인접하니** 어느 쪽인지 먼저 가려야 한다" 고 이미 한 번 이 문제(파일 단위, `swagger-dto-contract-guard.ts` vs `response-contract.ts`)를 다뤘다 — 그러나 이번에 새로 생긴 것은 **상수 단위**의 같은 패턴이며 아직 그 경계 설명에 반영돼 있지 않다.
  - 제안: 둘 중 하나로 정리. (a) `swagger-dto-contract.spec.ts` 의 신규 저장소-전수 래칫이 `ExecutionDto` 10건을 이미 포함하므로, `execution-response.dto.spec.ts` 의 `OPTIONAL_NULLABLE_DRIFT`/관련 `it.each` 블록을 새 래칫에 흡수시키고 옛 목록은 제거 (중복 SoT 해소). (b) 유지가 필요하면(스키마 레벨 가드가 다른 축을 본다는 사유), 두 상수 각각의 JSDoc 에 **서로를 가리키는 포인터**를 추가 — "이 10개 항목은 `swagger-dto-contract.spec.ts:EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에도 등재돼 있다. 상환 시 양쪽 동시 갱신" 식으로 명시. 두 경우 모두 `spec/5-system/2-api-convention.md` "검증 층" 표 하단에 "상수 레벨 근접 명명"에 대한 한 줄을 추가해 다음 sweep 이 같은 패턴을 반복하지 않게 한다.

## 그 외 점검 관점별 결과 (충돌 없음)

- **요구사항 ID**: 신규 ID 없음 (spec 델타 0).
- **엔티티/타입명**: `ScheduleTriggerRefDto`·`ScheduleTriggerWorkflowRefDto`(신규 DTO 클래스), `OptionalNullableOffender`(신규 인터페이스) — 저장소 전체에 동명 사용처 없음, 충돌 없음. `TriggerChatChannelHealth`/`TriggerNotificationHealth` 타입은 이번 diff 가 아니라 기존 `trigger.entity.ts` 에 이미 선언돼 있던 것을 DTO 가 import 한 것뿐이라 신규 도입이 아니다.
- **API endpoint**: 신규 endpoint 없음 — 기존 `GET/POST/PATCH /api/schedules*`, `/api/triggers*` 등의 **응답 필드**만 확장. method+path 신규 등록 없음.
- **이벤트/메시지명**: 신규 webhook·queue·SSE 이벤트 없음.
- **환경변수·설정키**: 신규 ENV/config key 없음.
- **파일 경로**: 신규 파일 0개 (`--diff-filter=A` 확인) — 명명 컨벤션 위반·기존 파일 경로 충돌 여지 없음.
- 함수/상수 이름 재확인: `sanitizeForResponse`(구 `sanitizeChatChannelForResponse` 리네임), `TRIGGER_RESPONSE_STRIP_COLUMNS`, `NOTIFICATION_SIGNING_STRIP_KEYS`, `toResponse`(SchedulesController private 메서드), `allowMissing`(ContractCheckOptions 신규 필드), `contractCache`/`buildContractForDto`(response-contract.ts 내부) — 전부 grep 결과 저장소 내 동명 다른 의미 사용처 없음. `toResponse` 는 `ExecutionsService.toResponseExecution` 과 이름이 겹치지 않고 오히려 같은 "응답 경계 변환" 패턴을 따르는 관용적 명명이라 충돌이 아니라 일관성 있는 선례.

## 요약

이 브랜치는 `spec/5-system/` 을 건드리지 않는 코드 전용 sweep(§5.4 응답-계약 검증자 배선 확대 + 트리거 회전 secret 유출 수정 + 24개 미선언 필드 문서화)이라, 요구사항 ID·API endpoint·이벤트명·환경변수·spec 파일 경로 축에서는 신규 식별자 충돌이 없다. 유일한 발견은 코드 내부 테스트 상수 레벨의 근접 명명이다 — 신규 `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(전수 래칫)가 기존 `OPTIONAL_NULLABLE_DRIFT`(`ExecutionDto` 전용 스키마 가드)와 정확히 같은 10개 필드를 상호 참조 없이 중복 추적해, 향후 부채 상환 시 한쪽만 갱신되고 다른 쪽이 조용히 stale 해질 위험이 있다. 이는 `spec/conventions/swagger.md` 가 이미 명문화한 "이름 충돌을 피한다"는 원칙의 결이 다른 재발이며, 기능 결함이 아니라 유지보수 시점의 혼선 위험이므로 WARNING 등급이 적절하다.

## 위험도

LOW
