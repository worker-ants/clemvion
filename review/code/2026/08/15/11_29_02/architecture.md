STATUS=success

===REPORT_MARKDOWN_BELOW===
# 아키텍처(Architecture) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (2026-08-15 11:29)

## 리뷰 범위

- `codebase/backend/src/shared/utils/terminal-duration.ts` (신규 — 공용 헬퍼)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`, `types.ts`
- `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` (교차 확인용, diff 없음)
- `*.spec.ts` / `CHANGELOG.md` / `plan/**` / `review/code/2026/08/15/{09_58_24,10_18_38}/**` 는 이전 리뷰 라운드 산출물이 그대로 diff 에 포함된 것으로, 아키텍처 관점에서 별도 이슈 없음(문서·테스트이며 구조 변경 없음)

`terminal-duration.ts`/`execution-engine.service.ts`/`retry-turn.service.ts` 는 프롬프트 diff 가 크기 제한으로 생략된 부분이 있어 `Read`/`git diff origin/main -- <path>`/`grep -n` 으로 저장소를 직접 열어 대조했다.

## 발견사항

- **[WARNING]** 종결 이벤트 emit 에 "payload 조립을 강제하는 초크포인트"가 없다 — 필드 하나(`durationMs`)를 16 곳에 손으로 스레딩해야 했고, 그 과정에서 이 PR 자체가 두 라운드에 걸쳐 "헬퍼는 만들었는데 형제 4곳이 여전히 맨손"(`09_58_24` RESOLUTION W2), "grep 한 줄 패턴이 멀티라인을 놓쳐 9곳 중 3곳 누락"(`10_18_38` RESOLUTION W1) 결함을 냈다.
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:40` (`emitExecution(executionId, eventType, payload: unknown)`), 호출부는 `execution-engine.service.ts` 19곳 / `retry-turn.service.ts` 3곳
  - 상세: `ExecutionEventEmitter` 는 자신의 JSDoc(`옛 코드는 24곳에서 직접 호출... 본 facade 가 그 책임을 분리한다`)이 밝히듯 **전송(라우팅) 관심사**만 단일 진입점으로 묶었다 — `payload` 파라미터가 `unknown` 으로 선언돼 있어, 종결 이벤트의 **payload 형태**(status/durationMs/error 조합) 는 통합된 적이 없다. 그 결과 `status/durationMs/error` 를 항상 함께 실어야 한다는 불변식이 16개 호출부 각각의 리터럴 조립에 의존하는 사람의 습관에만 있다 — 컴파일러도 런타임 가드도 이를 강제하지 않는다. `resolveTerminalDurationMs` 헬퍼(계산 로직)는 이번에 잘 추출됐지만, 그 헬퍼를 "빼먹지 않고 부른다"는 보장은 여전히 사람이 16번 반복해서 지켜야 하는 규율이다. 이 저장소는 이미 같은 클래스의 문제를 "publisher chokepoint fail-closed" 패턴(EIA/WS continuation, `project_eia_waiting_surface_command_guard`)으로 다른 표면에서 풀어본 선례가 있다.
  - 제안: 종결 3종(`completed`/`failed`/`cancelled`) 전용으로 `{status, durationMs, error?}` 형태를 타입으로 강제하는 `emitTerminalExecutionEvent(executionId, type, {execution 또는 durationMs, error?})` 같은 좁은 파사드를 도입하면, 새 종결 경로가 추가될 때 `durationMs` 를 빼먹는 것 자체가 타입 오류가 된다. 이번 PR 범위를 넘는 리팩터이므로 즉시 조치보다는 다음 종결-이벤트 필드 추가 시점에 재검토 권장.

- **[INFO]** `RETURNING` 결과에서 `duration_ms` 를 뽑는 4~5줄 블록이 raw UPDATE 5경로에 그대로 반복되며, 그 자리마다 서비스(비즈니스) 레이어가 DB 원본 행의 snake_case 컬럼 구조(`result.raw?.[0]?.duration_ms`)를 직접 알아야 한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1045-1049`(`cancelParkedExecution`), `:1182-1186`(`markWebChatIdleTimeout`), `:2861-2865`(`markExecutionCancelled`), `:2910-2914`(`markQueueWaitTimeout` 부근), `:3363-3367`(`finalizeStalledExhausted` 부근)
  - 상세: 이 저장소는 이미 "raw 쿼리 결과 형태를 호출부가 몰라도 되게" 하는 원칙으로 `common/utils/update-returning-rows.ts`/`assert-row-array.ts` 를 만든 전례가 있다(그 문서 자체가 "지식이 지점에 갇히면 그 옆에서 같은 실수가 난다"고 명시). 이번 5경로는 `QueryBuilder.execute()` 의 `UpdateResult.raw` 를 쓰므로 저 두 헬퍼가 다루는 `manager.query()` 튜플 형태와는 API 표면이 달라 직접 재사용 대상은 아니지만, 같은 원칙(레이어 경계에서 raw 행 형태를 캡슐화)을 적용할 여지는 남아 있다. 이미 직전 라운드(`09_58_24` RESOLUTION W5)에서 "QueryBuilder 체인을 감싸면 오히려 읽기 어려워진다, 6번째가 생기면 재검토"로 명시적으로 보류됐고 지금도 5곳으로 그 판단 시점과 같다 — 재론을 요구하지 않는다.
  - 제안: 조치 불필요(이미 근거 있는 보류). `toFiniteNumber` 옆에 `extractReturningDurationMs(result: { raw?: unknown })` 1-라인 헬퍼를 추가하면 QueryBuilder 체인 자체는 건드리지 않고 이 4줄만 캡슐화할 수 있다는 점은 다음 6번째 경로 추가 시 참고.

- **[INFO]** `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스가 `durationMs?: number | null` 필드와 이를 설명하는 5줄 계약 주석을 글자 그대로 3중 복제한다.
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:392-397`, `:415-420`, `:433-438`
  - 상세: 같은 파일이 이미 `ChatChannelEventBase`(라우팅 공통 필드)와 `EiaEventBase`(EIA 전용 alias)로 "공유 필드는 base 로 뽑는다"는 패턴을 쓰고 있다(`types.ts:330`, `:343`). 다만 `durationMs` 는 5종 EIA 이벤트 중 종결 3종에만 있고 `EiaWaitingForInputEvent`/`EiaAiMessageEvent` 에는 없어 `EiaEventBase` 로 올릴 수는 없다 — 별도의 `interface EiaTerminalDurationField { durationMs?: number | null }` 를 두고 세 인터페이스가 `extends EiaEventBase, EiaTerminalDurationField` 하면 필드와 주석 둘 다 한 곳으로 모을 수 있다. 세 곳이 물리적으로 떨어져 있어 향후 계약 문구(예: null 의미, optional 유지 이유)를 한쪽만 고치는 drift 위험이 있다.
  - 제안: 강제 아님. 다음에 이 세 인터페이스 중 하나를 편집할 때 mixin 추출을 함께 고려.

- **[INFO]** 같은 wire 필드(`durationMs`)가 코드 경로에 따라 서로 다른 두 가지 물리량(실행 소요 시간 vs. 큐 대기 시간)을 나른다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `markQueueWaitTimeout` (주석: "이 경로의 durationMs 는 **큐 대기 시간**이다(실행 시간이 아니다)")
  - 상세: CHANGELOG·spec §6.5 에 명시적으로 문서화된 의도된 설계이며 새 버그는 아니다. 다만 인터페이스 관점에서는 소비자가 `error.code === 'EXECUTION_QUEUE_WAIT_TIMEOUT'` 를 먼저 확인해야만 `durationMs` 의 의미를 올바르게 해석할 수 있어, 필드 하나가 두 도메인 개념을 겸한다(암묵적 판별자에 의존하는 discriminated 값). 소비자가 늘어나면 이 오버로드가 파싱 실수의 소지가 된다.
  - 제안: 지금 범위에서 조치 불필요. 소비 측 혼란이 실제로 보고되면 `queueWaitMs` 같은 별도 필드 분리를 고려.

- **[INFO]** JS 경로(`resolveTerminalDurationMs`)와 SQL 경로(`TERMINAL_DURATION_MS_SQL`)가 같은 비즈니스 규칙(음수→null, int4 상한 클램프)을 두 언어로 독립 구현한다.
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:40-55`(JS) / `:101-104`(SQL 상수)
  - 상세: 엔티티가 로드된 경로와 raw UPDATE 경로가 실행 환경(Node vs Postgres)이 달라 완전한 코드 공유는 불가능하다는 제약은 합리적이다. 두 구현이 `PG_INT4_MAX` 상수를 공유하고, `terminal-duration.spec.ts` 가 `TERMINAL_DURATION_MS_SQL` 문자열에 그 상수가 포함되는지·`started_at` 을 참조하는지 등을 정적으로 교차 검증해 drift 를 어느 정도 잡아준다. 다만 이는 문자열 `toContain` 수준이라 실제 Postgres 산술 결과가 JS 산술과 일치하는지는 검증하지 않는다(이미 testing 계열 리뷰 W4/W10 로 트래커에 등재된 갭).
  - 제안: 추가 조치 불필요 — 이미 별도 트랙에서 추적 중.

## 긍정적으로 평가한 부분 (근거 포함)

- **SRP/DRY**: `terminal-duration.ts` 가 "종결 duration 을 어떻게 결정하는가"라는 단일 관심사를 한 모듈에 모았고, 직전 PR(`terminal-error-payload.ts`)이 `error` 필드에 대해 세운 선례를 그대로 따른다 — 이 저장소가 반복해서 겪은 "형제 경로가 처방을 놓친다" 패턴에 대한 정당한 대응.
- **ISP**: `resolveTerminalDurationMs(row: { durationMs?, startedAt?, finishedAt? })` 가 `Execution` 엔티티 전체가 아니라 필요한 최소 구조만 요구하는 구조적 타입이라, `savedExecution`/`reloaded`/부분 select 행 등 다양한 호출부에 그대로 재사용된다.
- **레이어 경계**: `chat-channel.dispatcher.ts` 는 payload 캐스팅 타입만 넓혔을 뿐(`{ durationMs?: number }` → `{ durationMs?: number | null }`) 그 외 어댑터/변환 책임 구조는 그대로다. presentation 경계(`toChatChannelEvent`)와 도메인 계산(`resolveTerminalDurationMs`)이 섞이지 않았다.
- **순환 의존성 없음**: `shared/utils/terminal-duration.ts` 는 애플리케이션 모듈을 import 하지 않는 리프 유틸이며, `modules/execution-engine/*` 에서만 단방향으로 참조한다(`grep -rln terminal-duration codebase/backend/src` 로 확인, `chat-channel` 은 이 파일을 참조하지 않는다).
- **부작용 격리**: `startedAt` 부재 시 `.getTime()` 이 throw 해 종결 emit 자체가 사라지던 회귀(JSDoc 에 명시)를 헬퍼 내부에서 `null` 로 흡수하도록 만들어, 계산 실패가 종결 흐름 자체를 깨뜨리지 않게 방어했다 — 이는 설계 원칙(fail-safe 계산, fail-visible 데이터)이 뚜렷하다.

## 요약

이번 변경은 3개 종결 이벤트 타입에 `durationMs` 를 채우는 배관 작업으로, 계산 로직을 `terminal-duration.ts` 라는 단일 유틸로 잘 추출해 SRP·DRY·ISP 측면에서 이전 PR(`terminal-error-payload.ts`)의 검증된 패턴을 일관되게 재사용했고, 레이어 경계·순환 의존성 문제는 없다. 가장 눈에 띄는 구조적 리스크는 "종결 이벤트 payload 조립"에 컴파일러가 강제하는 단일 초크포인트가 없다는 점이다 — 전송 계층(`ExecutionEventEmitter`)은 이미 단일 진입점으로 분리돼 있지만 `payload: unknown` 이라 형태는 강제되지 않고, 그 결과 같은 필드를 16곳에 손으로 스레딩하다 이 PR 안에서만 두 차례("헬퍼 존재하는데 형제 4곳 누락", "한 줄 grep 이 멀티라인 표현식을 놓쳐 3곳 누락") 같은 클래스의 결함이 재발했다. 이는 이번 PR 이 만든 신규 결함이 아니라 기존 emit 아키텍처의 구조적 한계이며, 다음에 종결 이벤트에 필드가 하나 더 추가될 때 같은 실패 모드가 다시 나타날 가능성이 높다. 나머지 발견(raw RETURNING 파싱 5중 반복, 타입 주석 3중 복제, `durationMs` 의 의미 오버로드, JS/SQL 이중 구현)은 모두 INFO 수준이며 대부분 이미 이전 리뷰 라운드에서 근거와 함께 보류된 상태다.

## 위험도

MEDIUM
