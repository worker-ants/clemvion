# 부작용(Side Effect) 리뷰

## 리뷰 범위 및 방법

이번 changeset(merge-base `5791797`..`HEAD`, 44 파일)의 실질 코드 변경은 3파일뿐이다 —
`codebase/backend/src/shared/utils/terminal-error-payload.ts`(로직),
`codebase/backend/src/shared/utils/terminal-error-payload.spec.ts`(테스트),
`codebase/backend/src/modules/execution-engine/sanitize-error-message.ts`(docstring 전용,
`git diff` 로 로직 무변경 확인). 나머지는 `CHANGELOG.md`·`plan/**`·`review/**` 문서 산출물이다.

이 관점(side_effect)은 이미 같은 브랜치의 이전 두 라운드(`09_51_00`, `10_19_30`)가 다뤘다.
`git diff a50a5764e..7badf0318`(직전 코드 라운드 이후 마지막 커밋)로 대조한 결과, 그 이후
변경은 **JSDoc 본문 확장 + 테스트 케이스 2개 추가뿐**이고 `redactTerminalError`/
`toTerminalErrorPayload` 의 런타임 로직은 무변경이다. 따라서 이번 라운드는 (a) 기존 라운드가
검증한 항목을 독립적으로 재확인하고, (b) 아직 확인되지 않았던 부작용 경로(특히 마스킹된
payload 가 fanout 경계에서 우회될 수 있는지)를 추가로 조사했다.

## 발견사항

- **[INFO]** (신규 검증) SSE·outbound webhook fanout 이 `Execution.error` 를 재조회하지 않고
  이미 마스킹된 `event.payload` 를 그대로 전달한다 — 마스킹을 우회하는 별도 경로 없음을 확인
  - 위치: `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:132`
    (`payload: event.payload`), `codebase/backend/src/modules/external-interaction/sse-adapter.service.ts:162`
    (`payload: {`) — 둘 다 이번 diff 밖의 기존 코드
  - 상세: `toTerminalErrorPayload`(`terminal-error-payload.ts`)가 마스킹을 적용하는 지점은
    `execution-engine.service.ts`/`retry-turn.service.ts` 의 `emitTerminalExecution` 호출
    한 곳뿐이다. 이 마스킹이 실효를 가지려면 SSE·webhook fanout 이 그 결과 payload 를
    **그대로** 전달해야지, 자신이 별도로 `Execution.error`(raw, DB 원본)를 다시 읽어 온다면
    마스킹이 구조적으로 우회된다. 두 fanout 서비스를 직접 열어 확인한 결과 `notification-fanout.service.ts:132`
    와 `sse-adapter.service.ts:162` 모두 emit 된 `event.payload` 를 그대로 실어 보낼 뿐, DB
    재조회나 `error` 필드 재구성 로직이 없다. `notification-webhook.processor.ts` 도 큐에 실린
    payload 를 발송할 뿐 `Execution.error` 를 직접 참조하지 않는다. 즉 이번 PR 의 JSDoc 이
    "새 종결 emit 경로가 생겨도 마스킹이 구조적으로 빠질 수 없다"고 주장하는 근거(호출부 5곳이
    전부 `emitTerminalExecution` 앞단)가 fanout 쪽에서도 깨지지 않는다는 것을 소비 측에서
    독립적으로 확인했다.
  - 제안: 조치 불요(긍정적 확인). 이 조사 결과를 `terminal-error-payload.ts` JSDoc 이나 plan
    에 "fanout 은 재조회하지 않고 emit payload 를 그대로 미러링한다"는 한 줄로 남기면, 향후
    fanout 서비스가 리팩터되어 `Execution.error` 를 직접 읽는 지름길이 생겼을 때의 회귀를
    조사자가 더 빨리 알아챌 수 있다.

- **[INFO]** (재확인, `10_19_30/side_effect.md` 와 동일 관측) `execution.cancelled` 는 여전히
  `toTerminalErrorPayload`/`redactTerminalError` 마스킹 초크포인트를 완전히 우회한다 — 이번
  라운드의 diff 는 이 비대칭을 좁히지 않음
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:8-13`(docstring 이
    스스로 "시스템 `execution.cancelled`(`emitCancellationEvent` + 호출 5곳)은 아직
    `{code, message}` 를 손으로 만들고 ... 여기서 'cancelled 도 커버한다'고 쓰면 문서한
    보장이 구현보다 넓어진다"고 명시)
  - 상세: 현재는 취소 경로에 raw 예외 메시지가 실리는 사례가 없어(plan 감사로 확인된 고정
    코드/센티널 뿐) 안전하지만, 이 마스킹 도입 PR 자체는 그 경로를 다루지 않는다고 스스로
    선언한다. 새 코드가 이 비대칭을 만든 것은 아니고(선존 상태) JSDoc 이 정직하게 범위를
    좁혀 적어 두었으므로 문서화 완결성 문제는 아니다 — 다만 side effect 관점에서 "종결 이벤트
    3종 중 하나는 이번 하드닝의 적용 대상이 아니다"라는 사실 자체는 재확인해 둔다.
  - 제안: 조치 불요(이번 PR 범위 밖, 이미 plan 에 등재). 향후 취소 사유를 상세화하는 리팩터가
    오면 이 경로도 `toTerminalErrorPayload` 를 거치도록 강제할 것.

- **[INFO]** (재확인, `10_19_30/side_effect.md` 와 동일 관측) `chat-channel.dispatcher.ts` 의
  재정규화 경로에서 마스킹이 이중 실행되지만 idempotent 하여 관측 가능한 동작 변화 없음
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:107-115`(`redactTerminalError`),
    소비 지점은 diff 밖 `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:551`
  - 상세: emit 시점에 이미 마스킹된 `TerminalErrorPayload` 가 chat-channel dispatch 시
    `toTerminalErrorPayload` 를 다시 통과해 `deepRedactSecrets` 가 두 번째로 돈다. `***` 치환
    문자열은 `SECRET_LEAK_PATTERNS` 에 재매칭되지 않으므로 현재는 no-op 이지만, 향후 패턴이
    비-idempotent 하게 확장되면 결과가 바뀔 수 있는 잠재 지점이다. 이전 라운드가 이미 INFO 로
    기록했고 이번 diff 가 이 경로의 동작을 바꾸지 않았으므로 그대로 재확인만 한다.
  - 제안: 조치 불요.

## 확인된 안전한 설계 (직접 검증)

- **시그니처/인터페이스 불변**: `toTerminalErrorPayload(err: unknown): TerminalErrorPayload | null`
  파라미터·반환 타입, `TerminalErrorPayload` 인터페이스 모두 무변경. 5개 호출부
  (`execution-engine.service.ts:668,3400,5030`, `retry-turn.service.ts:1001`,
  `chat-channel.dispatcher.ts:551`) 전부 grep 으로 재확인 — 재컴파일 없이 그대로 동작.
- **DB write 없음**: 5개 호출부 모두 `this.eventEmitter.emitTerminalExecution(...)` 인자로만
  쓰이고, 직전 문맥에 `UPDATE`/`save`/`repo.update` 가 없다(직접 대조 재확인). `Execution.error`
  원본은 마스킹 이전 값 그대로 DB 에 남는다(EIA §R17 egress-only 원칙 유지).
- **mutation 없음**: `redactTerminalError`(`terminal-error-payload.ts:107-115`)는 spread 로 새
  객체를 반환하고, `deepRedactSecrets`/`deepRedactObject`(`sanitize-error-message.ts:127-171`,
  이번 diff 밖)는 copy-on-change 라 입력을 in-place 수정하지 않는다.
  `terminal-error-payload.spec.ts` 의 "마스킹할 게 없으면 details 참조를 보존한다" 테스트가
  이를 회귀 고정한다.
  - 참고: `redactTerminalError` 자체는 항상 새 최상위 객체를 만든다(`...p` spread) — 이는
    스코프 문서(`10_19_30`/RESOLUTION W3)가 이미 "바깥에서 관측 불가능해 의도적으로 제거"했다고
    밝힌 copy-on-change 조기반환의 부재이며, `message` 필드는 매 호출마다 새 문자열이 되지만
    (원시값이라 참조 개념 없음) `details` 는 `deepRedactSecrets` 의 자체 copy-on-change 로
    참조가 보존된다 — 설계 의도와 실제 동작이 일치.
- **순환 참조 없음**: `sanitize-error-message.ts`(shared/utils) 를 직접 열어 import 문이 0개임을
  확인 — `terminal-error-payload.ts:1-3` 의 신규 import 주석 주장이 정확하다.
- **환경변수·네트워크 호출 없음**: 세 핵심 파일 어디에도 `process.env` 읽기/쓰기, `fetch`/`http`
  호출이 없다.
- **이벤트 발행 로직 자체는 무변경**: `emitTerminalExecution` 의 라우팅/타입 결정 로직은 이번
  diff 대상이 아니며, emit 되는 `payload.error` **값**만 마스킹된 값으로 바뀐다 — 발행 여부·
  타이밍·채널은 그대로다.
- **fanout 경로도 재조회 없이 emit payload 를 그대로 미러링**(위 신규 검증 항목) — SSE·webhook
  이 별도로 raw `Execution.error` 를 읽어 마스킹을 우회하는 지름길이 없음을 확인.
- **파일시스템 부작용**: `plan/`·`review/` 하위 신규 파일은 developer/consistency-checker 의
  명시된 쓰기 권한 범위이고 내용도 실제 변경과 일치 — 의도치 않은 파일시스템 부작용 아님.
- **테스트 격리**: 신규 `describe` 블록의 모든 케이스가 매번 새 객체 리터럴을 입력으로 쓰므로
  `deepRedactSecrets` 의 module-level `WeakMap` 캐시(`DEEP_REDACT_CACHE`, identity 키)로 인한
  테스트 간 오염 가능성 없음.

## 요약

핵심 코드 변경은 이번 라운드에서 실질적으로 늘지 않았다 — 직전 코드 라운드(`10_19_30`) 이후
마지막 커밋은 JSDoc 본문 보강과 테스트 케이스 2개 추가뿐이고 `redactTerminalError`/
`toTerminalErrorPayload` 의 런타임 동작은 그대로다. 독립적으로 새로 조사한 것은 마스킹이
적용되는 단일 지점(`emitTerminalExecution` 호출 앞) 이후 SSE·outbound webhook fanout 이
`Execution.error` 를 별도로 재조회하지 않고 이미 마스킹된 emit payload 를 그대로 미러링한다는
점이며, 이는 "새 종결 emit 경로가 생겨도 마스킹이 구조적으로 빠질 수 없다"는 JSDoc 의 주장을
소비 측에서도 뒷받침한다. 시그니처·인터페이스 무변경, DB write 없음, mutation 없음, 순환 참조
없음, 환경변수/네트워크 호출 없음이 모두 코드 레벨에서 재확인됐다. 남은 두 관측(`execution.cancelled`
경로의 마스킹 비대칭, `chat-channel.dispatcher` 의 idempotent 이중 마스킹)은 이전 라운드가 이미
INFO 로 기록한 선존/무해 항목의 재확인이다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
