# 아키텍처(Architecture) Review

## 대상 변경 요약

`ExecutionEngineService.execute()` 의 `ExecuteOptions` 판별 유니온에 `triggerType?: ExecutionRunTriggerType` 필드를 추가해, `execution-run` BullMQ 큐 job priority 를 `manual(1) > webhook(2) > schedule(3)` 3-tier 로 세분화한 변경. 호출부(`hooks.service.ts` webhook/chat-channel, `schedule-runner.service.ts`)가 `Trigger.type` 을 `execute()` 에 threading 하고, `execute()` 내부는 `executedBy` 존재 여부를 우선 판정해 `manual` 을 결정한 뒤, 트리거 발화 분기에서 `options.triggerType ?? 'webhook'` fallback 을 적용한다. 이번 diff base(`origin/main...HEAD`) 에는 코드 변경 커밋(`1eefcca12`) + 그 ai-review 조치 커밋(`73af2682c`, 주석/spec 문서 정정) + 후속 doc-sync 커밋(`190c4060f`, 코드 무변경) 이 포함되어 있고, 실질 아키텍처 대상은 파일 1~6(소스 6개)이다.

## 발견사항

- **[INFO]** priority 계산이 단일 지점에 응집되어 있고 관심사 분리가 명확함
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` (`EXECUTION_RUN_PRIORITY`, `resolveExecutionRunPriority`), `execution-engine.service.ts:3237-3245` 부근 (`triggerType` 판정 → `resolveExecutionRunPriority` 호출)
  - 상세: priority 값 테이블(`EXECUTION_RUN_PRIORITY`)과 판정 함수(`resolveExecutionRunPriority`)가 큐 모듈에 캡슐화돼 있고, `execute()` 는 트리거 판정(`executedBy` 우선, fallback `webhook`) 만 담당한다. "무엇이 priority 를 결정하는가"(정책)와 "어떤 값을 매핑하는가"(테이블)가 분리돼 있어 OCP 관점에서 향후 tier 추가(예: `internal` 등) 시 큐 모듈만 수정하면 되는 구조. 새 코드가 기존 구조를 그대로 확장한 것이며 별도 안티패턴 없음.
  - 제안: 없음 (양호).

- **[INFO]** 판별 유니온(discriminated union)의 타입 표현력과 실제 불변식 사이의 간극
  - 위치: `execution-engine.service.ts:384-410` (`ExecuteOptions` 두 번째 분기 `triggerType?: ExecutionRunTriggerType`)
  - 상세: `triggerId` 분기의 `triggerType` 타입은 `ExecutionRunTriggerType`(`'manual' | 'webhook' | 'schedule'`) 전체를 허용하지만, 실제 불변식(주석 JSDoc)은 "webhook/schedule 만 유효, manual 은 `executedBy` 분기로만 판정"이다. 즉 `{ triggerId: 'x', triggerType: 'manual' }` 도 타입 체커를 통과한다 — 컴파일러가 도메인 불변식을 강제하지 못하는 인터페이스 분리 관점의 미세한 누수. 다만 현재 3개 호출부(hooks x2, schedule-runner) 모두 안전한 리터럴만 전달하고, 이 필드는 내부 서비스 타입(공개 API 아님)이라 실제 리스크는 낮다. 이미 이전 리뷰 세션(19_02_17 SUMMARY)에서 INFO 로 식별·기록됐고 재발이 아님.
  - 제안: 필요시 `triggerType?: Exclude<ExecutionRunTriggerType, 'manual'>` 로 좁혀 컴파일 타임 표현력을 불변식과 일치시킬 수 있으나, 현재 리스크가 낮아 우선순위는 낮음(defer 가능).

- **[INFO]** fallback 정책 이중화 (`execute()` 의 `?? 'webhook'` vs `resolveExecutionRunPriority` 내부 `undefined → schedule`)
  - 위치: `execution-engine.service.ts:3237` (`options?.triggerType ?? 'webhook'`) vs `execution-run.queue.ts` `resolveExecutionRunPriority` (`return EXECUTION_RUN_PRIORITY.schedule`)
  - 상세: 두 fallback 값이 다르다(`webhook` vs `schedule`). 현재 `execute()` 가 `resolveExecutionRunPriority` 의 유일 호출자이고 항상 resolved(`'manual'|'webhook'|'schedule'`) 값을 넘기므로 `resolveExecutionRunPriority` 의 `undefined` 분기는 dead path — 기능 결함은 아니다. 다만 두 계층에 서로 다른 "안전측" 기본값 정책이 중복 존재하는 것은 향후 두 번째 호출자가 생길 때(예: 다른 서비스가 직접 `resolveExecutionRunPriority` 호출) 놀라움을 유발할 수 있는 잠재적 유지보수 함정이다. 이전 리뷰(19_02_17)에서도 INFO 로 식별되어 "유지" 결정됨.
  - 제안: 두 fallback 을 동일 상수로 통일하거나, `resolveExecutionRunPriority` 의 fallback 결정 근거(경고성 주석: "왜 schedule 이 fallback 인지")를 `execute()` 의 fallback 근거(webhook, "비-HTTP 트리거 방어")와 나란히 두어 정책 불일치가 의도적임을 명시. 즉시 조치 불요.

- **[INFO]** 계층 경계 준수 — `triggerType` 이 payload 로 새지 않음
  - 위치: `execution-engine.service.ts:3242-3250` 부근 (`executionRunQueue.add('execution-run', { executionId, input }, ...)`)
  - 상세: `triggerType` 은 BullMQ job data(`ExecutionRunJob` = `{ executionId, input }`)에 포함되지 않고 오직 `add()` 의 `priority` 옵션 계산에만 소비된다. 이는 "큐 payload 스키마는 안정적으로 유지하고, 계산된 부가 정보는 enqueue 시점에만 쓰고 버린다"는 명확한 경계 설정으로, §9.3 문서에도 명시돼 있다. `Execution.triggerSource`(DB 파생 5-way 필드, 표시용)와도 명확히 분리되어 이름 충돌/혼동으로 인한 레이어 오염이 없다. 레이어 책임 분리 관점에서 모범적.
  - 제안: 없음 (양호).

- **[INFO]** 호출부 3곳의 threading 패턴 일관성
  - 위치: `hooks.service.ts:197,629`, `schedule-runner.service.ts:163-166`
  - 상세: 세 호출부 모두 `triggerId` + `triggerType` 리터럴을 나란히 전달하는 동일 패턴을 따른다(hooks 는 `'webhook'` 리터럴 2곳, schedule-runner 는 `'schedule'` 1곳). 별도 추상화(팩토리, 빌더 등) 없이 단순 리터럴 전달로 처리한 것은 현재 3-tier 규모에 적절한 수준 — 과도한 추상화를 도입하지 않은 점이 긍정적. 호출부가 늘어나거나 tier 판정 로직이 복잡해지면(예: IP 대역/역할 기반 추가 분기) 판정 로직을 별도 헬퍼로 추출할 필요가 생기겠지만, 현재는 YAGNI 원칙에 부합.
  - 제안: 없음 (양호). 향후 호출부가 4곳 이상으로 늘거나 판정 조건이 늘면 재검토.

- **[INFO]** 순환 의존성 없음
  - 위치: `execution-engine.service.ts` → `queues/execution-run.queue.ts` (단방향 import), `hooks.service.ts`/`schedule-runner.service.ts` → `execution-engine.service.ts` (단방향 import)
  - 상세: 신규 `type ExecutionRunTriggerType` import 는 큐 모듈에서 서비스 모듈로의 단방향 흐름이며, 기존 의존 방향(서비스가 큐 모듈 타입/함수를 소비)을 그대로 따른다. 순환 참조 없음.
  - 제안: 없음.

## 요약

이번 변경은 기존에 설계된 3-tier priority 테이블(`EXECUTION_RUN_PRIORITY`)과 판정 함수(`resolveExecutionRunPriority`)를 그대로 활용해 미완성이던 트리거 타입 threading 만 채워 넣은 점진적 확장으로, SOLID(특히 OCP·SRP) 와 레이어 경계(큐 payload vs priority 계산 vs 표시용 파생 필드) 를 잘 지킨 구조다. `ExecuteOptions` 판별 유니온은 컴파일 타임에 `executedBy`/`triggerId` 상호 배제를 강제하는 기존 패턴을 유지하며 신규 필드를 옵셔널로만 추가해 하위 호환을 보장했고, 순환 의존성이나 레이어 위반은 발견되지 않았다. 유일하게 남는 미세한 사항은 `triggerId` 분기의 `triggerType` 타입이 실제 불변식(webhook/schedule 만 유효)보다 넓다는 점과 두 계층의 fallback 정책 불일치인데, 둘 다 이전 ai-review 세션(19_02_17)에서 이미 식별·기록되어 "유지" 결정된 낮은 리스크의 INFO 성격이며 이번 diff 에서 재발하거나 악화되지 않았다.

## 위험도

NONE

STATUS: SUCCESS
