# 부작용(Side Effect) Review

## 대상 변경 요약

`ExecuteOptions`(내부 판별 유니온 타입)에 `triggerType?: ExecutionRunTriggerType`
필드를 추가하고, `ExecutionEngineService.execute()` 내부의 priority 계산을
`executedBy ? 'manual' : 'webhook'` (2-tier) 에서
`executedBy ? 'manual' : (options?.triggerType ?? 'webhook')` (3-tier) 로 변경.
호출부 3곳(`hooks.service.ts` webhook/chat-channel, `schedule-runner.service.ts`)이
새 `triggerType` 리터럴을 threading. 나머지 파일은 spec 문서·plan 문서·이전
리뷰 세션(`19_02_17`)·consistency-check(`18_33_09`, `19_17_50`) 산출물로, 코드
동작에 영향 없는 문서/기록 변경.

## 점검 관점별 분석

### 1. 의도치 않은 상태 변경
- 변경은 순수 값 계산(`triggerType` 문자열 결정) + 그 값을 큐 `add()`
  옵션의 `priority` 숫자로 소비하는 것뿐. 새로 도입되거나 변경되는 공유
  상태(인메모리 캐시, 클래스 필드, 모듈 레벨 변수)는 없음.
- `triggerType` 은 `ExecutionRunJob` payload(BullMQ job data)에 싣지 않는다고
  코드 주석(§9.3)에 명시되어 있고 실제로 `queue.add('execution-run',
  { executionId, input }, ...)` 호출에서 job data 는 변경되지 않음 —
  BullMQ consumer/재생 로직에 스키마 영향 없음. 확인함.

### 2. 전역 변수
- 해당 없음. `EXECUTION_RUN_PRIORITY`, `ExecutionRunTriggerType`,
  `resolveExecutionRunPriority` 는 기존에 이미 존재하던 모듈 상수/타입/함수이며
  이번 diff 로 새로 도입되지 않음(이전 PR 에서 이미 정의). 이번 변경은 그 값을
  실제로 소비하는 소비자(consumer) 측(`execute()`)만 확장.

### 3. 파일시스템 부작용
- 코드 파일 6개는 순수 로직/타입/테스트 변경으로 파일시스템 부작용 없음.
- `plan/complete/exec-intake-queue-impl.md`(frontmatter `spec_impact` 추가),
  `plan/in-progress/exec-intage-followups.md`(체크박스 갱신),
  `review/code/2026/07/04/19_02_17/*`(RESOLUTION/SUMMARY 등 리뷰 산출물),
  `review/consistency/2026/07/04/{18_33_09,19_17_50}/*` 는 프로젝트 규약상
  정규 산출물 경로(`review/**`, `plan/**`)에 정확히 기록된 문서 변경 — "예상치
  못한" 파일시스템 부작용이 아니라 워크플로 규약이 요구하는 정상 산출물.
  런타임 코드 실행 중 발생하는 파일 I/O 는 아니므로 이 관점의 위험 범주에
  해당하지 않음.

### 4. 시그니처 변경
- `ExecuteOptions` 판별 유니온에 `triggerType` 필드가 추가됨. 세 분기 모두
  구조적으로 하위 호환:
  - `executedBy` 분기: `triggerType?: never` 추가 — 기존 호출부가 `triggerType`
    을 넘기지 않으므로 컴파일 영향 없음 (미전달은 옵셔널 필드 생략과 동일).
  - `triggerId` 분기: `triggerType?: ExecutionRunTriggerType` 옵셔널 추가 —
    기존 호출부(있었다면)는 그대로 컴파일되고 런타임은 `?? 'webhook'` fallback
    으로 이전과 동일한 동작(webhook priority) 유지.
  - no-op 분기: `triggerType?: never` 추가 — 동일하게 하위 호환.
  - 실제로 `executedBy` variant 호출부 4곳(`workflows.controller.ts` 2곳,
    `schedules.service.ts` runNow, `executions.service.ts` re-run) 을 확인—
    전부 `triggerType` 미전달이며 `executedBy` 존재로 무조건 `manual` 분기를
    타므로 이번 변경으로 인한 동작 변화가 전혀 없음. 확인함.
  - `execute()` 의 공개 시그니처(파라미터 개수·순서·반환 타입) 자체는 불변 —
    `options` 파라미터의 내부 유니온 타입만 확장.
- **위험 없음** — 순수 추가(additive)이고 optional field 이므로 컴파일 타임/
  런타임 모두 기존 호출자에 영향 없음.

### 5. 인터페이스 변경
- `ExecuteOptions`/`execute()` 는 `execution-engine.service.ts` 내부에서만
  쓰이는 TS 타입/메서드로, 어떤 컨트롤러 `@Body()` DTO 도 아니고 OpenAPI/Swagger
  스키마에 노출되지 않는다 (이전 `api_contract` 리뷰·consistency-check 에서도
  동일 결론). 공개 HTTP API 계약(요청/응답 스키마, 상태 코드)에는 영향 없음.
- `EXECUTION_RUN_PRIORITY`, `ExecutionRunTriggerType`, `resolveExecutionRunPriority`
  는 export 되어 있으나 이번 diff 에서 새로 export 되는 게 아니라 기존 export 를
  import 해 쓰는 것뿐(`execution-engine.service.ts` 상단 `import { ...
  type ExecutionRunTriggerType } from './queues/execution-run.queue'`).

### 6. 환경 변수
- 해당 변경 없음. env 참조·수정 코드 없음.

### 7. 네트워크 호출
- 해당 변경 없음. 외부 서비스 호출을 추가/제거하지 않음. BullMQ 자체는 기존과
  동일하게 Redis 에 `add()` 하나만 호출(변경은 `priority` 숫자 값 결정 로직뿐).

### 8. 이벤트/콜백
- `resolveExecutionRunPriority`/`EXECUTION_RUN_PRIORITY` 소비 지점은 여전히
  `execute()` 내부 `executionRunQueue.add()` 호출 1곳뿐. 새 이벤트 발행이나
  콜백 등록/해제는 없음.
- `EXECUTION_RUN_QUEUE`(BullMQ)의 실제 **작업 처리 순서**는 `priority` 값에
  따라 바뀐다 — 이는 의도된 기능적 효과(§4.3 3-tier)이지 부작용은 아니나,
  운영상 특기할 사항으로 기록: 기존에는 schedule 트리거도 `webhook`(2)
  priority 를 받았지만 이제 `schedule`(3, 최저)로 내려간다. 즉 schedule 실행이
  이전보다 **상대적으로 지연될 수 있다** (webhook/manual 대비 후순위). 이는
  spec §4.3 의도된 요구사항이며 기존 RESOLUTION/SUMMARY 문서에서도 이미 논의된
  사항 — 새로운 부작용이 아니라 의도된 우선순위 재조정.

## 기록된 pre-existing INFO (재확인, 이번 리뷰에서 신규 발견 아님)

- **fallback 비대칭**: `execute()` 내부 `options?.triggerType ?? 'webhook'`
  vs `resolveExecutionRunPriority` 내부 `undefined → schedule`(가장 낮은
  우선순위로 보수적 처리). 코드상 `execute()` 가 `resolveExecutionRunPriority`
  의 유일한 호출자이고 항상 resolved 된 `triggerType` 문자열(`'manual'|'webhook'
  |'schedule'`)을 전달하므로 `resolveExecutionRunPriority` 내부의
  `undefined` 분기는 현재 도달 불가능한 dead path. 기능적 영향 없음 — 다만
  두 곳의 "미상 트리거" 기본값이 서로 다르다는 점(`webhook` vs `schedule`)은
  향후 `resolveExecutionRunPriority` 가 다른 호출자를 얻게 될 경우 혼동
  소지가 있어 유지보수 관점 참고 사항으로만 기록(이전 세션에서 이미 동일하게
  판정·유지 결정됨. 코드 재변경 불필요).

## 종합 판단

이번 변경은 옵셔널 필드 추가 + 순수 값 계산 로직 확장으로, 기존 호출자·공개
API·전역 상태·파일시스템·네트워크·이벤트 경로 어디에도 破壊적 영향을 주지
않는 구조적으로 안전한 additive 변경이다. BullMQ job priority 값이 일부
시나리오(schedule 트리거)에서 이전과 달라지는 것은 의도된 기능 변경(spec §4.3)
이지 의도치 않은 부작용이 아니다. 코드 변경분(파일 1-6)에서 신규 CRITICAL/
WARNING 급 부작용은 발견되지 않았다.

## 발견사항

없음 (no findings).

## 위험도

NONE
