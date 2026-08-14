# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

실제 코드 변경(TS)은 아래 9개 파일. 나머지(`plan/**`, `review/consistency/**`, `spec/**`)는 문서·산출물이라
유지보수성(가독성/네이밍/함수 길이/중첩/매직넘버/중복/복잡도/일관성) 관점 적용 대상에서 제외했다.

- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts`
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`
- `codebase/backend/src/modules/chat-channel/types.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/execution-engine/terminal-error-payload.spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts` (신규)

## 발견사항

- **[WARNING]** 매직 문자열 `'WORKER_HEARTBEAT_TIMEOUT'` 이 한 함수 안에서 두 번 손으로 반복되고, 방금
  추출한 변수를 재사용하지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3269`
    (신규 `stalledError.code`) 와 `:3297` (같은 함수 `finalizeStalledExhausted` 안, `NodeExecution`
    cascade 마감 UPDATE 의 `error.code`)
  - 상세: 이번 diff 는 `stalledError` 변수를 도입한 이유로 정확히 "DB 와 emit 이 같은 객체를 쓰게 한
    곳에 둔다. 종전엔 emit 이 이 message 를 손으로 다시 적었고, 그 과정에서 attempts 가 빠져 두 표현이
    이미 어긋나 있었다" 는 코멘트(`:3266-3267`)를 남겼다. 그런데 30줄 아래(`:3297`)의 자식
    `NodeExecution` cascade 마감 UPDATE 는 여전히 `'WORKER_HEARTBEAT_TIMEOUT'` 를 별도로 손으로
    적는다. 지금은 두 값이 우연히 같지만, 이 자리가 정확히 "손으로 다시 적어 어긋난 전례"가 있던
    자리이기도 하다(같은 코드 코멘트가 그 사고 사례로 인용). `stalledError.code` 를 참조하면 이 클래스의
    drift 를 이 함수 안에서도 구조적으로 막을 수 있다.
  - 제안: `code: 'WORKER_HEARTBEAT_TIMEOUT'` (`:3297`) 를 `code: stalledError.code` 로 교체.

- **[WARNING]** 종결 이벤트 `error` wire 형태가 세 곳에서 독립적으로 재정의되고, 그중 `nodeId`
  optionality 가 하나만 다르다
  - 위치:
    - `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:30-35`
      (`TerminalErrorPayload` — `nodeId: string | null;` **필수**)
    - `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:545-550`
      (`toChatChannelEvent` 내 로컬 `error` 타입 — `nodeId?: string | null;` **옵셔널**)
    - `codebase/backend/src/modules/chat-channel/types.ts:399-404`
      (`EiaFailedEvent.error` — `nodeId?: string | null;` **옵셔널**)
  - 상세: `terminal-error-payload.ts` 의 JSDoc(`:8-21`)이 명시하는 이 헬퍼의 존재 이유가 바로 "부재
    표현이 DB 와 wire 에서 다르고, 그 변환을 emit 지점마다 손으로 하면 한 곳씩 빠진다 — 이 저장소의
    반복 형태" 라는 것이다. 그런데 동일한 wire shape 를 소비하는 쪽(dispatcher.ts)과 그 결과를 담는
    타입(types.ts `EiaFailedEvent`)은 `TerminalErrorPayload` 를 import 해 재사용하지 않고 각자 유사한
    inline/interface 정의를 새로 썼다(`grep` 확인: `TerminalErrorPayload` 를 실제로 import 하는 코드는
    없다 — 코멘트에서만 이름이 언급됨). 그 결과 세 정의 중 하나(`nodeId`)만 optionality 가 달라졌다.
    현재는 emit 측이 항상 `toTerminalErrorPayload` 를 거쳐 `nodeId` 를 채우므로 실제 값 유실은 없지만,
    타입이 약속하는 계약이 실제 불변식보다 느슨해 향후 다른 코드가 `nodeId` 를 생략하고
    `EiaFailedEvent`/dispatcher 로컬 타입을 손으로 구성해도 컴파일러가 잡아주지 못한다.
  - 제안: dispatcher.ts 로컬 `error` 타입과 `types.ts` 의 `EiaFailedEvent.error` 를
    `Pick<TerminalErrorPayload, ...>` 또는 직접 `TerminalErrorPayload` 재사용으로 통일(단, 모듈 경계상
    `chat-channel` → `execution-engine` import 가 새 방향 결합을 만드는 점은 감안 — 대안으로 공용 wire
    타입을 두 모듈이 참조하는 위치로 옮기는 것도 고려).

- **[WARNING]** `terminal-error-payload.ts` 모듈 docstring 이 실제 호출 범위보다 넓은 대상을 선언한다
  - 위치: `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:2`
    ("종결 이벤트(`execution.failed` / 시스템 `execution.cancelled`)의 `error` 를 … 정규화한다")
    vs `execution-engine.service.ts:1079-1104` (`emitCancellationEvent`, `error?: { code: string;
    message: string }` — 별도 shape, `toTerminalErrorPayload` 미호출)
  - 상세: docstring 1문단이 이 헬퍼의 대상으로 `execution.failed` 뿐 아니라 "시스템
    `execution.cancelled`" 도 명시하지만, 실제로 `toTerminalErrorPayload` 를 호출하는 지점은 4곳
    (`failFirstSegmentSetup`/`finalizeStalledExhausted`/`finalizeFailedExecution`/`failRetryExecution`)
    전부 FAILED 상태 emit 이다(같은 docstring `:12-21` 이 정확히 이 4곳만 나열·"네 emit 지점이 전부
    이 함수를 부른다" 라 적는다). `RESUME_*`/`WEBCHAT_IDLE_TIMEOUT` 등 실제 시스템 취소 코드를 만드는
    `emitCancellationEvent` 의 `error` 옵션은 이 PR 범위 밖이라 여전히 별도 shape(`nodeId`·`details`
    없음, `code` non-nullable)를 쓰고 이 헬퍼를 거치지 않는다. 즉 docstring 첫 문장이 약속하는 적용
    범위가 실제 구현보다 넓다 — 다음 사람이 이 문장만 읽고 "취소 이벤트도 이미 정규화됐다" 고 오해할
    수 있다.
  - 제안: 1문장을 현재 실제 범위("execution.failed 4개 emit 지점")로 좁히거나, "시스템
    execution.cancelled" 를 다루려면 `emitCancellationEvent` 도 이 헬퍼를 거치도록 후속 작업으로 등재.

## 긍정적으로 확인한 점

- `terminal-error-payload.ts` 는 단일 책임(DB → wire 정규화)의 순수 함수로 분리 위치가 적절하고,
  분기(null/undefined·string·number/boolean/bigint·object·필드별 타입가드)가 평이하며 중첩이 없다.
  각 분기 코멘트가 "왜 이 분기가 필요한가"를 정확히 설명한다.
- 신규 `terminal-error-payload.spec.ts` 는 뮤테이션 테스트로 실제 가드(특히 `code`/`nodeId` 타입가드)가
  살아있는지 확인한 케이스를 포함해(코멘트에 뮤턴트 생존 이력 명시) 회귀 방지 수준이 높다.
- 4개 emit 지점을 한 헬퍼로 통일한 것 자체가 이 PR 이전에 실제로 존재했던 DB-wire 문구 drift
  (`finalizeStalledExhausted` 의 `attempts` 누락 불일치)를 구조적으로 제거한다 — 중복 제거 방향은
  올바르다.
- `chat-channel.dispatcher.ts` 의 `code: null` 전환 관련 긴 코멘트(`:560-567`)는 장황하지만, "왜
  `'INTERNAL_ERROR'` 를 지어내지 않는가" 라는 비직관적 결정을 정당화하는 데 필요한 근거를 담고 있어
  과도한 코멘트로 보지 않았다.
- 네이밍(`toTerminalErrorPayload`/`TerminalErrorPayload`/`stalledError`)이 목적을 명확히 드러내고
  기존 컨벤션(`toChatChannelEvent` 등 `to*` prefix)과 일관된다.

## 요약

이번 diff 의 핵심은 4개 emit 지점의 손-반복 코드를 `toTerminalErrorPayload` 라는 단일 헬퍼로 통합한
것으로, 그 자체는 유지보수성을 실질적으로 개선한다(중복 제거·DB-wire drift 구조적 방지·꼼꼼한 테스트).
다만 그 통합이 완전하지 않다 — 같은 함수 안에 남은 매직 문자열 중복 1건, 통합의 이유가 됐던 바로 그
wire shape 가 세 곳에서 재정의되며 `nodeId` optionality 가 갈라진 점, 그리고 새 헬퍼의 docstring 이
실제 호출 범위(FAILED 4곳)보다 넓은 범위(취소 포함)를 약속하는 점은 모두 "한 곳씩 빠진다"는 이 PR
자신의 문제의식이 이번에도 완전히 닫히지 않았음을 보여준다. 셋 다 기능 결함은 아니고 지금 당장 버그를
일으키지 않지만, 다음 사람이 이 코드를 다시 만질 때 정확히 이 PR 이 고치려던 것과 같은 클래스의 drift
를 재도입할 여지를 남긴다.

## 위험도

LOW
