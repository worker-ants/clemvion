STATUS=success

===REPORT_MARKDOWN_BELOW===
# 아키텍처(Architecture) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 방법론 노트

프롬프트 번들에서 `execution-engine.service.ts`/`execution-engine.service.spec.ts` 의 diff 가
크기 제한으로 생략돼 있어 `git diff origin/main -- <path>` 와 `Read` 로 저장소를 직접 열어
대조했다. 해당 두 파일에 대한 발견사항의 위치는 (프롬프트에 게이트가 없으므로) **함수명 +
직접 확인한 소스 줄 번호**로 표기한다. `terminal-duration.ts`/`.spec.ts`, `chat-channel/types.ts`,
`chat-channel.dispatcher.ts`, `retry-turn.service.ts` 는 프롬프트 diff 의 게이트 숫자를 그대로
썼다. `review/**`·`plan/**` 산출물은 프로세스 문서라 아키텍처 관점 평가 대상에서 제외했다.

## 발견사항

- **[WARNING]** 하나의 비즈니스 불변식(`durationMs` = 음수 시계역행 → `null`, int4 상한
  saturate)이 **TS 와 SQL 두 언어로 독립 구현**돼 있고, 둘의 동등성을 보장하는 장치가 문자열
  `toContain` 단언뿐이다.
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` — `resolveTerminalDurationMs`
    (게이트 28-42) vs `TERMINAL_DURATION_MS_SQL` (게이트 87-90)
  - 상세: JS 경로는 `span >= 0 ? span : null` 로 음수를 걸러내고, SQL 경로는
    `CASE WHEN :terminalFinishedAt < started_at THEN NULL ELSE LEAST(2147483647, …) END` 로 같은
    규칙을 SQL 문자열 리터럴 안에 재작성한다. 두 표현은 지금은 일치하지만, 이를 보장하는 것은
    사람이 손으로 맞춘 것뿐이다 — `terminal-duration.spec.ts` 의 SQL 테스트(게이트 110-133)는
    `toContain('LEAST(2147483647'...)` 류 **문자열 부분일치**이지 실제 Postgres 를 태운
    행태 검증이 아니다(팀 스스로도 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    에 "TERMINAL_DURATION_MS_SQL 이 실 Postgres 값 수준 검증이 없다" 를 W10 으로 등재해 인지하고
    있다). 아키텍처 관점에서는 **단일 진실 원천(SoT)이 없는 상태로 하나의 규칙이 두 런타임에
    걸쳐 이원화**된 것이 근본 원인이다 — 내일 클램프 임계값(예: `INTEGER`→`BIGINT` 마이그레이션)이
    바뀌면 두 곳을 각각 기억해서 고쳐야 한다.
  - 제안: 이미 트래커에 등재된 e2e `duration_ms >= 0`/값 검증(W10)을 우선순위로 당기거나,
    적어도 클램프 상수(`2147483647`)를 JS 쪽에도 동일 이름의 export 로 두어 "숫자가 하나"라는
    사실이라도 코드로 드러낼 것(현재는 SQL 문자열 안에만 존재).

- **[INFO]** 신규 모듈이 순수 계산(TS)과 Postgres 방언 SQL 조각을 한 파일에 함께 담아, 이
  `shared/utils` "terminal-*" 계열에서 **처음으로** persistence 세부사항이 utils 레이어에
  섞이는 선례를 만든다.
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` (게이트 1-96, 특히 87-90)
  - 상세: 자매 파일 `terminal-error-payload.ts` (`toTerminalErrorPayload`)는 순수 TS
    변환 함수만 담고 있어 프레임워크/DB 에 무관하다. 반면 `terminal-duration.ts` 는
    `::timestamptz`, `EXTRACT(EPOCH …)`, `LEAST`, 컬럼명 `started_at` 을 문자열 리터럴로
    보유한다 — DB 가 Postgres 라는 사실과 컬럼 스키마에 직접 결합된다. 엔티티 미로드 5경로가
    "같은 UPDATE 문 안에서 계산" 해야 한다는 제약(Rationale JSDoc 게이트 6-15에 근거 명시)을
    감안하면 실용적 트레이드오프이나, `shared/utils` 라는 이름이 암시하는 "프레임워크 불가지
    유틸리티" 경계를 이 파일이 처음으로 넘는다.
  - 제안: 강제 사항은 아님. 다음에 유사한 raw-UPDATE SQL 상수가 또 필요해지면 `shared/utils`
    보다는 `shared/persistence/` 같은 별도 네임스페이스로 분리해 "순수 계산" 과 "SQL 방언"
    사이 경계를 이름으로도 드러내는 편을 고려.

- **[INFO]** `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스가
  `durationMs?: number | null` 필드와 동일한 5줄 근거 주석을 문자 그대로 3중 복제한다 —
  단, 공유 베이스로 끌어올리는 것은 부적절하다(정당한 중복).
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:392-397`(Completed),
    `:415-420`(Failed), `:433-438`(Cancelled)
  - 상세: 셋 다 `EiaEventBase` 를 직접 extends 하는데, `EiaEventBase` 는 `EiaWaitingForInputEvent`·
    `EiaAiMessageEvent` 등 **비종결(non-terminal) 이벤트도 공유**하는 베이스다(`types.ts:343`,
    `:345`, `:366`). 따라서 `durationMs` 를 `EiaEventBase` 로 끌어올리면 종결과 무관한 이벤트에도
    필드가 새는 LSP/ISP 위반이 된다 — 지금처럼 3곳에 개별 선언한 것은 **의도적으로 옳은
    설계**다. 다만 종결 3종만 묶는 중간 인터페이스가 없어 필드+주석이 통째로 3중 복제됐다.
  - 제안: `interface EiaTerminalEventBase extends EiaEventBase { durationMs?: number | null }`
    를 도입해 세 인터페이스가 `EiaEventBase` 대신 이를 extends 하도록 하면, 비종결 이벤트의
    형태는 전혀 건드리지 않으면서 필드·주석 3중복을 1곳으로 줄일 수 있다. 저위험 순수 추가
    리팩터(기존 필드 구성은 100% 동일하게 유지)라 다음 편집 때 시도할 만하다.

- **[INFO]** `compute → assign → emit` 관용구가 이미 거대한 서비스(`execution-engine.service.ts`)
  안에 ~16개 호출부로 재삽입돼, 공통 "종결 payload 구성" 책임이 여전히 클래스 경계를 넘어
  중앙화되지 않았다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
    함수 `cancelParkedExecution`(직접 확인 소스 라인 1023 부근)·`markWebChatIdleTimeout`(1158
    부근)·`runExecution`/`resumeGraphAfterRetry`/`driveResumeAwaited`/`driveCallStackResume`
    의 completed 마감부(2413·2578·3565·4295·4755 각 부근)·`markQueueWaitTimeout`(2884
    부근)·`finalizeStalledExhausted`(3344 부근)·`finalizeCancelledExecution`(4876 부근)·
    `failFirstSegmentSetup`(4940 부근). `retry-turn.service.ts` 에도 동형 4곳(게이트 711-714,
    889-897, 902-909, 946-949, 968-974).
  - 상세: `resolveTerminalDurationMs` 추출 자체는 좋은 SRP 개선이나, "계산해서 엔티티에
    쓰고, 몇 줄 뒤 같은 값을 emit payload 에 다시 계산해 넣는" **2단계 반복 패턴**은 여전히
    각 호출부가 직접 손으로 오케스트레이션한다. `ExecutionEngineService` 는 이미 실행
    오케스트레이션·취소·노드 디스패치·타임아웃 처리·재개까지 떠안은 8000줄+ god-service 다(이
    PR 이 만든 문제는 아니고 사전 존재하는 아키텍처 부채). 이 PR 은 그 경향을 강화하는 방향으로
    16곳에 동일 2줄 관용구를 흩뿌렸다 — 다음에 `result.outputs` 같은 신규 종결 필드가 추가되면
    또 같은 16곳을 손으로 고쳐야 한다(이미 plan 문서가 `result.outputs` 를 "이번 PR 제외" 로
    분리해 둔 것과 무관하게, 그 필드가 들어올 때 이 배관 구조 자체는 그대로 재사용될 것이다).
  - 제안: 강제 사항 아님(리스크 낮음, 이번 PR 범위 밖). 다음에 종결 payload 에 필드가 하나 더
    추가되는 시점에, `ExecutionEngineService`/`RetryTurnService` 가 공유하는
    `buildTerminalPayload(entity, {status, error?})` 같은 파사드를 만들어 "계산 1회 + payload
    구성 1회" 로 좁히는 편을 고려. (`review/code/2026/08/15/09_58_24/RESOLUTION.md` W5 가 이미
    "6번째가 생기면 재검토" 라 적어 둔 것과 같은 결이며, raw-UPDATE 쪽은 5곳에서 멈췄지만 emit
    관용구 쪽은 16곳으로 그보다 넓다는 점만 덧붙인다.)

- **[INFO, 긍정]** `resolveTerminalDurationMs` 는 `Execution` 엔티티 클래스가 아니라
  `{durationMs?, startedAt?, finishedAt?}` 구조적(duck-typed) 파라미터에 의존한다 — 좋은
  ISP/DIP 적용.
  - 위치: `terminal-duration.ts:28-32` (게이트)
  - 상세: 이 설계 덕에 `Execution`·`NodeExecution`·부분 SELECT 원본 행·테스트 fixture 가
    상속 관계 없이 동일 함수를 그대로 만족한다. 실제로 `execution-engine.service.ts` 안에서
    `row`/`savedExecution`/`nodeExecution`/`reloaded` 4종 서로 다른 타입에 재사용되는 것으로
    확인된다. 유틸리티가 구체 타입이 아니라 필요한 최소 형태에만 의존하는 좋은 예다.

- **[INFO, 긍정]** `emitCancellationEvent` 의 `opts` 에 `durationMs?: number | null` 을 추가한
  방식이 개방-폐쇄 원칙을 지킨다.
  - 위치: `execution-engine.service.ts` 함수 `emitCancellationEvent` 시그니처(직접 확인 소스
    라인 1103 부근)
  - 상세: 필드가 optional 이고 내부에서 `opts.durationMs ?? null` 로 기본값 처리되므로, 이
    메서드를 호출하는 기존/향후 다른 경로가 `durationMs` 를 안 넘겨도 깨지지 않는다. 새 관심사를
    추가하면서 기존 계약을 넓히기만 했지 좁히지 않았다 — LSP/OCP 관점에서 안전한 확장.

## 순환 의존성 / 모듈 경계

`terminal-duration.ts` 는 leaf 모듈(다른 도메인 모듈을 import 하지 않음)이고
`execution-engine.service.ts`/`retry-turn.service.ts` 가 이를 단방향으로 의존한다 — 순환 없음.
`chat-channel/types.ts` → `chat-channel.dispatcher.ts` 방향의 소비 관계도 기존과 동일하게
단방향이며 새로운 순환을 만들지 않는다.

## 요약

이번 변경은 신규 순수 유틸(`resolveTerminalDurationMs`/`toFiniteNumber`)을 통해 16개 종결
emit 경로에 흩어져 있던 계산·null 처리 로직을 응집력 있게 추출한 점, 그리고 엔티티를 로드하지
않는 5개 raw UPDATE 경로에서 DB 와 wire 가 같은 값을 쓰도록 `RETURNING` 을 활용한 설계가
아키텍처적으로 타당하다. `chat-channel/types.ts` 의 3중 필드 복제는 공유 베이스가 비종결
이벤트까지 포괄하기 때문에 실은 **정당한 중복**이며(끌어올리면 오히려 LSP 위반), 다만 종결
전용 중간 인터페이스가 없어 주석까지 통째로 복제된 것은 저비용으로 줄일 수 있는 여지다. 가장
눈에 띄는 구조적 긴장은 "durationMs 클램프/부호 불변식"이 TS 함수와 Postgres SQL 상수 두
곳에 독립적으로 존재하면서 이를 묶는 단일 진실 원천이 없다는 점과, 이미 비대한
`ExecutionEngineService` 에 종결 payload 구성 관용구가 16곳으로 더 흩뿌려졌다는 점이다.
둘 다 이번 PR 이 새로 만든 근본 결함이라기보다 기존 구조적 제약(엔티티 미로드 raw UPDATE
5곳, 이미 거대한 god-service) 위에서 나온 실용적 절충이고, 팀 스스로도 SQL 검증 공백(W10)과
헬퍼 승격 임계치(W5)를 트래커에 이미 등재해 두었다. 즉시 차단할 사안은 없다.

## 위험도

LOW
