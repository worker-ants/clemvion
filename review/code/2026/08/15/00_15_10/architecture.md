# 아키텍처 리뷰 — EIA 종결(terminal) `error` payload 정규화 (6차, `00_15_10`)

## 리뷰 범위 및 이전 라운드 대비

이 changeset 의 핵심 소스(`terminal-error-payload.ts`(신규)·`chat-channel.dispatcher.ts`·
`chat-channel/types.ts`·`execution-engine.service.ts`·`retry-turn.service.ts`·
`use-execution-events.ts`)는 이미 5차례(`22_55_51`→`23_17_57`→`23_34_12`→`23_49_41`→`00_02_43`)
ai-review 를 거쳤고, 그중 아키텍처 관점은 `23_17_57`·`23_34_12`·`00_02_43` 세 차례 모두 LOW 로
수렴했다. `git log --oneline -- <핵심 소스 6파일>` 로 직접 대조한 결과 마지막 소스 변경 커밋은
`66baf81f0`/`5776126bd`/`6aa0699b8` 이며, 이번 라운드(`00_15_10`)의 diff 는 그 이후 추가된
테스트 단언(`execution-engine.service.spec.ts`·`retry-turn.service.spec.ts`·
`chat-channel.dispatcher.spec.ts`·`use-execution-events.test.ts`)과 `CHANGELOG.md`/`plan/**`/
`spec/**` 문서뿐이다 — **아키텍처 구조를 바꾸는 소스 변경은 이번 라운드에 없다.**

**직접 재검증한 핵심 설계 (변경 없음을 확인):**

- **순환 의존 없음.** `grep -rln "terminal-error-payload" codebase/backend/src` 로 직접 확인 —
  소비처는 `chat-channel.dispatcher.ts`(consumer 1곳) + `execution-engine.service.ts`·
  `retry-turn.service.ts`(producer 2곳) + spec 1곳뿐이고, `shared/utils/terminal-error-payload.ts`
  는 어느 모듈도 역참조하지 않는 순수 함수다. `chat-channel/*.ts` → `execution-engine` import,
  `execution-engine/*.ts` → `chat-channel` import 를 각각 grep 했을 때 둘 다 0건 — `shared/utils/`
  승격이 순환을 실제로 차단하고 있다.
- **SRP + DRY.** `toTerminalErrorPayload` 는 "DB 의 부분 객체/문자열/스칼라를 §6.4 wire 형태로
  정규화" 라는 단일 책임만 갖고, producer 4곳(엔진 2곳·stalled·retry-turn)과 consumer 1곳이 같은
  함수를 공유한다 — dispatcher 가 예전에 갖고 있던 3-way 손수 정규화(object 분기의
  `errorRaw as typeof error` 무검증 캐스팅 포함)가 제거된 상태가 그대로 유지된다.
  이 PR 이 헬퍼를 도입한 근거("정규화를 emit 지점마다 손으로 하면 한 곳씩 빠진다")가 소비자
  쪽에서도 실제로 지켜지고 있다.
- **레이어 분리.** DB 쓰기(`row.error = { message: errMessage }` 류)는 계속 부분 객체(키 생략)를
  저장하고, wire 변환은 emit 호출부에서만 일어난다. 영속 표현과 전송 표현이 한 경계에서만
  변환되므로 과거 실제 발생했던 DB/wire 문구 drift(`finalizeStalledExhausted` 의 `attempts`
  누락) 클래스가 구조적으로 재발하지 않는다.
- **타입 경계 정규화.** 프런트 `use-execution-events.ts` 의 `handleExecutionFailed` 도 같은 파일
  `node.failed` 핸들러가 이미 쓰던 `typeof x === "string" ? x : x?.message` 관용구로 통일해,
  캐스팅-only(`data as { error?: string }`) 로 인한 계약 불일치 무검출 문제(직전 라운드 CRITICAL)
  가 경계 정규화 + 회귀 테스트로 재발 방지되어 있다.

## 발견사항 (전량 이월 — 3~5라운드 연속 동일 판정, 신규 아키텍처 결함 없음)

- **[INFO]** 같은 §6.4 wire 형태가 `TerminalErrorPayload`와 `EiaFailedEvent.error`(인라인 타입)
  두 곳에 독립 선언으로 남아 있다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` (`TerminalErrorPayload`
    인터페이스), `codebase/backend/src/modules/chat-channel/types.ts` (`EiaFailedEvent.error`
    인라인 타입, `code`/`message`/`nodeId`/`details` 필드)
  - 상세: `chat-channel/types.ts` 는 `TerminalErrorPayload` 를 import 하지 않고 같은 모양을
    손으로 다시 선언한다. 3라운드 전(`23_17_57`)에 3중 선언을 2중으로 줄인 이후(dispatcher 로컬
    변수를 `EiaFailedEvent['error']` 재사용으로 통일) 추가 개선은 없다. 두 타입은 현재
    구조적으로 호환되고(`nodeId` optionality 차이는 producer/consumer 계약 구분이라는 명시적
    근거로 의도됨, `types.ts` 인라인 주석 참조), 정합은 사람이 매번 판단해야 하고 컴파일러가
    보장하지 않는다.
  - 제안: 조치 불요(안정적 트레이드오프, 4라운드 연속 검토·수용). §6.4 필드가 추가될 때
    producer 만 갱신하고 consumer 를 빠뜨리는 회귀가 재발할 수 있음을 인지하고, 그때
    `Pick<TerminalErrorPayload, ...>` 재사용을 고려할 것.

- **[INFO]** `execution.cancelled` 계열은 이번 정규화 대상에서 계속 제외돼, 같은 "종결 error"
  카테고리 안에 두 스키마(신규 nullable-object `EiaFailedEvent.error` vs 기존 non-nullable
  `EiaCancelledEvent.error`)가 공존한다
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` (`EiaCancelledEvent.error?: {
    code: string; message?: string }`), `codebase/backend/src/modules/execution-engine/
    execution-engine.service.ts` (`emitCancellationEvent`, 이번 diff 밖)
  - 상세: spec §6 필드 표는 `failed`/`cancelled`(시스템 취소 한정)를 같은 목표 형태로 규정하지만,
    `emitCancellationEvent` 호출 5곳은 여전히 `{code, message}` 리터럴을 손으로 만들고
    `toTerminalErrorPayload` 를 거치지 않는다. 이는 누락이 아니라 `terminal-error-payload.ts`
    자신의 JSDoc 이 "DB write 5곳을 함께 손봐야 해 `durationMs` 와 같은 비용 그룹" 이라고
    명시한 것이며, code·spec(`spec/5-system/14-external-interaction-api.md`)·plan
    (`plan/in-progress/spec-sync-external-interaction-api-gaps.md`) 세 층위에서 일관되게
    추적된다.
  - 제안: 조치 불요(범위 밖, 명시적으로 추적됨). 후속 PR 에서 `emitCancellationEvent` 도 같은
    헬퍼(또는 부분집합)로 통일하면 "정규화는 한 곳에서" 원칙이 완결된다.

- **[INFO]** 이벤트 emit 경계(`emitExecution`)가 `payload: unknown` 으로 선언돼, producer 의
  강타입(`TerminalErrorPayload`)이 전송 경계를 넘는 순간 소실되고 각 consumer 가 `as` 캐스팅으로
  형태를 재구성한다 — 이 diff 가 새로 만든 구조는 아니다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
    (`emitExecution(executionId, eventType, payload: unknown)`)
  - 상세: 이번 PR 에서 실제로 발생했던 CRITICAL(프런트가 `error` 를 문자열로 캐스팅해 두고
    있다가 백엔드가 object 로 바꾼 것을 타입체커가 못 잡음)의 근본 원인이 이 경계의 타입
    소실이다. 완료된 fix(양쪽에서 관용구 통일 + 회귀 테스트)는 이 경계의 증상 하나를
    재동기화한 것이지, 경계 자체를 타입 안전하게 만들지는 않는다 — 같은 클래스의 회귀가 다음
    필드 변경에서 재발할 수 있는 구조적 여지가 남는다.
  - 제안: 이번 PR 범위에서 고칠 필요는 없다(이벤트 타입 전반에 걸친 광범위한 리팩터 필요).
    discriminated payload union 으로 좁히는 안을 별도 개선 항목으로 등재하는 정도면 충분.

## 요약

핵심 소스는 3라운드 전(`23_34_12`) 이후 한 줄도 바뀌지 않았고, 이번 라운드에 추가된 것은
테스트 단언·CHANGELOG·plan/spec 문서뿐이라 아키텍처 관점에서 재평가할 새 표면이 없다. 직접
재검증한 결과 정규화 책임이 순수 함수(`toTerminalErrorPayload`) 하나에 집중된 SRP, producer
4곳 + consumer 1곳이 같은 헬퍼를 공유하는 DRY, `shared/utils/` 승격을 통한
`execution-engine`↔`chat-channel` 무순환 모듈 경계(직접 grep 으로 재확인), DB 영속 표현과 wire
전송 표현을 emit 경계 한 곳에서만 변환하는 레이어 분리가 전부 유지되고 있다. 남은 관찰
셋(`TerminalErrorPayload`/`EiaFailedEvent.error` 2중 선언, `execution.cancelled` 미통일,
`emitExecution` 의 `payload: unknown` 타입 소실 경계)은 3~5라운드 연속으로 같은 판단이
유지되는 pre-existing 트레이드오프이며, code·spec·plan 세 층위에서 일관되게 문서화·추적돼
은폐가 아니다. 이번 라운드에서 새로 발견된 아키텍처 결함은 없다.

## 위험도

LOW
