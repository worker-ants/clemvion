# 아키텍처 리뷰 — EIA 종결(terminal) `error` payload 정규화 (재검토, `22_55_51` 이후)

## 리뷰 범위 및 이전 라운드 대비

이 diff 는 `22_55_51` 라운드가 이미 한 차례 아키텍처 리뷰(WARNING 3 · INFO 1)를 마친 코드의
후속 상태다. `RESOLUTION.md` 대조 결과:

- 이전 WARNING 1(JSDoc 이 `execution.cancelled` 커버리지를 실제보다 넓게 주장) — **실측으로 확인, 수정됨**.
  `terminal-error-payload.ts:4-9` 가 이제 "현재 호출부는 `EXECUTION_FAILED` 4곳뿐" 이라 범위를
  명시하고, `execution.cancelled` 는 별도 비용 그룹으로 미룬다는 근거까지 남겼다.
- 이전 WARNING 2(`nodeId` optional 제거 제안) — **의도적으로 미채택, 근거 문서화됨**
  (`types.ts:402-406` — 13개 fixture 타입 오류 실측 후 producer/consumer 계약 구분 논리로 유지).
  타당한 판단으로 본다.
- 이전 WARNING 3(wire 타입 3중 독립 선언) — **부분 해소**. `chat-channel.dispatcher.ts` 의 로컬
  타입은 `EiaFailedEvent['error']` 재사용으로 통일돼(1건 감소) 실측 확인(`grep`)했다. 다만
  `TerminalErrorPayload`(execution-engine) 와 `EiaFailedEvent.error`(chat-channel) 두 선언은
  여전히 서로 참조 없이 남아 있다 — 아래 발견사항 1 참조.

새로 도입된 코드 자체(핵심 diff)에 대한 내 자체 검증은 아래 "발견사항"에 정리한다. 전부
INFO 수준이며, 모두 pre-existing 구조를 반영하거나 이미 문서화된 트레이드오프의 잔여분이라 이
라운드에서 새로 발견된 차단 사유는 없다.

## 발견사항

- **[INFO]** 같은 §6.4 wire 개념이 `execution-engine`(producer) 과 `chat-channel`(consumer) 양쪽에
  독립 선언으로 남아 있어, 향후 producer 쪽 필드 추가/변경이 컴파일러로 consumer 에 전파되지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:36-41`
    (`export interface TerminalErrorPayload`) vs
    `codebase/backend/src/modules/chat-channel/types.ts:395-408`
    (`EiaFailedEvent.error` 인라인 타입)
  - 상세: `grep -rn "TerminalErrorPayload" codebase/backend/src/modules/` 로 직접 확인한 결과 이
    타입을 import 하는 코드는 자기 자신의 파일(및 `.spec.ts`) 뿐이다. `chat-channel` 쪽은
    `execution-engine` 모듈을 전혀 import 하지 않는다(`grep -rn "from '.*execution-engine"
    codebase/backend/src/modules/chat-channel/*.ts` 0건) — 이는 두 모듈 간 역방향 의존을 만들지
    않으려는 **의도된 경계**로 읽히고, 그 자체는 합리적인 선택이다(순환 의존 방지). 다만 그
    대가로 emit 경계(`emitExecution(..., payload: unknown)`, 아래 발견사항 3)에서 타입 정보가
    이미 소실되기 때문에, 두 선언이 실제로 어긋나도(예: `nodeId` optional 여부처럼) 컴파일러가
    잡아주지 못한다. 이번 라운드에서 실제로 그 어긋남(`nodeId?`) 이 "의도된 것" 이라고 판단해
    미채택했지만, 판단 자체를 사람이 매번 다시 해야 하는 구조는 그대로 남는다.
  - 제안: 조치 불요(이미 검토·문서화된 트레이드오프). 다음에 이 wire 형태에 필드가 하나 더
    추가된다면, "손으로 하면 한 곳씩 빠진다" 는 이 PR 의 문제의식이 `execution-engine ↔
    chat-channel` 경계에도 적용됨을 상기할 것 — 예를 들어 `Pick<TerminalErrorPayload, ...>` 재사용
    또는 두 선언 상단에 상호 링크 주석을 남기는 정도로 충분하다.

- **[INFO]** `execution.cancelled` 계열(`emitCancellationEvent`, 호출부 5곳)은 이번 PR 이 도입한
  단일 정규화 지점(`toTerminalErrorPayload`)을 거치지 않아, 같은 "종결 error" 카테고리 안에서
  두 가지 다른 wire 스키마가 공존한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1079-1103`
    (`emitCancellationEvent` 정의, `opts.error?: { code: string; message: string }` — `code`
    non-nullable, `nodeId`/`details` 키 자체가 없음), 호출부 `:1056`·`:1169`·`:2807`·`:2844`·`:4792`.
    대응 소비 타입: `codebase/backend/src/modules/chat-channel/types.ts:413-423`
    (`EiaCancelledEvent.error?: { code: string; message?: string }`).
  - 상세: spec §6 필드 표는 `failed`/`cancelled`(시스템 취소 한정) 를 같은 목표 형태
    (`{code, message, nodeId, details?}`, `code`/`nodeId` nullable) 로 규정하는데,
    `emitCancellationEvent` 는 여전히 호출부마다 `{code, message}` 리터럴을 손으로 만든다 —
    정확히 이 PR 이 `EXECUTION_FAILED` 4곳에서 없앤 바로 그 패턴이 `EXECUTION_CANCELLED` 5곳에
    남아 있다. 다만 이는 오판이나 누락이 아니라 `terminal-error-payload.ts:4-9` 자신이 "DB write
    5곳을 함께 손봐야 해 `durationMs` 와 같은 비용 그룹" 이라고 명시적으로 스코프 밖에 둔
    것이라 정직하게 추적되고 있다.
  - 제안: 조치 불요(이번 PR 범위 밖, 이미 별도 비용 그룹으로 추적). 후속 PR 에서
    `emitCancellationEvent` 도 `toTerminalErrorPayload` (또는 그 하위집합)를 거치도록 통일하면
    "정규화는 한 곳에서" 원칙이 이벤트 카테고리 전체로 완결된다.

- **[INFO]** 이벤트 emit 경계(`emitExecution`)가 `payload: unknown` 으로 선언돼 있어, producer 가
  만든 강타입(`TerminalErrorPayload`)이 전송 경계를 넘는 순간 소실되고 각 consumer
  (`chat-channel.dispatcher.ts`, 프런트 `use-execution-events.ts`)가 다시 `as` 캐스팅으로
  형태를 재구성한다.
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:37-40`
    (`emitExecution(executionId, eventType, payload: unknown)`)
  - 상세: 이 설계 자체는 이번 diff 가 새로 만든 것이 아니라 이 이벤트 버스가 여러 이벤트
    타입(각기 다른 payload shape)을 하나의 시그니처로 받기 위해 이미 갖고 있던 구조다. 이번 PR
    에서 실제로 관측된 CRITICAL(프런트가 `error` 를 문자열로 캐스팅해 두고 있다가 백엔드가
    object 로 바꾼 것을 타입체커가 못 잡음, `RESOLUTION.md` §CRITICAL)이 바로 이 경계의
    타입 소실 때문에 발생했다 — 즉 지금 완료된 fix 는 이 경계의 증상(캐스팅 불일치) 하나를
    수동으로 재동기화한 것이지, 경계 자체를 타입 안전하게 만들지는 않았다. 같은 클래스의 회귀가
    다음 필드 변경에서 다시 나올 수 있는 구조적 여지가 남는다.
  - 제안: 이번 PR 범위에서 고칠 필요는 없다(이벤트 타입 전반에 걸친 광범위한 리팩터가 필요).
    다만 이 경계를 이벤트 타입별 discriminated payload union 으로 좁히는 것이 이 클래스의 회귀를
    구조적으로 막는 유일한 방법이라는 점을 별도 개선 항목으로 plan 에 남겨 둘 가치가 있다.

## 긍정적으로 확인한 점

- `toTerminalErrorPayload` 는 단일 책임(DB jsonb → wire 정규화)을 지는 순수 함수이며 부작용이
  없다. `finalizeStalledExhausted` 안에서 `stalledError.code` 를 자식 cascade UPDATE 에도
  재사용하도록 고쳐(`execution-engine.service.ts:3269`·`:3297`), 이 헬퍼가 애초에 막으려던
  "손으로 반복하면 갈린다" 패턴이 같은 함수 내부에서도 실제로 제거됐다(직접 확인).
- 4개 `EXECUTION_FAILED` emit 지점이 전부 이 헬퍼를 거치도록 배선돼 DRY 위반(및 과거 실제로
  발생했던 DB/wire 문구 drift)이 구조적으로 재발 방지된다.
- `chat-channel` 이 `execution-engine` 을 import 하지 않는 모듈 경계가 이번 diff 로도 그대로
  유지됐다(순환 의존 없음, 실측 확인) — presentation/business 레이어 간 결합을 낮게 유지하는
  선택이 일관적이다.
- CRITICAL 이었던 프런트 소비자 문제는 같은 파일의 기존 관용구(`typeof x === 'string' ? x :
  x?.message`)로 통일해 해결했고, 하류(store/render)는 계속 `string` 만 받으므로 블라스트
  반경을 좁게 유지했다 — 국소 수정이 적절하다.

## 요약

핵심 설계(단일 정규화 헬퍼 `toTerminalErrorPayload` + 4개 emit 지점 배선)는 SRP·DRY·낮은 결합도
관점에서 견고하고, 이전 라운드(`22_55_51`)가 지적한 아키텍처 WARNING 3건 중 하나(JSDoc 범위
과장)는 실측 재확인 결과 완전히 수정됐고, 나머지 둘(타입 3중 선언·`nodeId` optionality)은
의도적 트레이드오프로 판단해 유지하되 근거를 코드 주석에 남겨 다음 리뷰어가 반복 지적하지 않도록
처리했다. 이번 라운드에서 새로 발견한 것은 모두 이미 알려졌거나 스스로 스코프 밖으로 명시한
잔여 구조(`execution.cancelled` 미통일, emit 경계의 `unknown` 타입 소실)이며 전부 INFO 수준이다
— 기능을 깨뜨리지 않고, 이번 PR 이 자임한 좁은 관심사("`error` 객체화 4곳") 를 넘지 않는다.
차단 사유 없음.

## 위험도

LOW
