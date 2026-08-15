# 테스트(Testing) 리뷰 — ws-event-types-extract (누적 diff, origin/main...HEAD 73 파일)

## 검토 방법

이번 diff 는 `origin/main...HEAD` 전체(73개 파일)로, (a) 실제 프로덕션/스펙 코드
변경(파일 1~26, `websocket.service.ts` 의 값·타입 선언을 의존성-프리 모듈로 추출하는
import 재배선 + `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 모듈 스코프
복원), (b) plan 문서 갱신(파일 27~31), (c) 이미 두 라운드(`19_27_37`, `20_05_17`)를 거쳐
Warning 전부 반영 완료된 과거 코드 리뷰·consistency 산출물(파일 32~72, 마크다운/JSON),
(d) spec frontmatter 1줄(파일 73) 로 구성된다. (c) 는 프로세스 산출물이라 테스트 관점
재검토 대상이 아니며, 그 안에 기록된 테스트 관련 발견(WARNING 5건 + WARNING 2건)은 모두
`RESOLUTION.md` 로 반영이 확인되어 있다.

이번 라운드는 **가장 최신 커밋(`a6d764ac6`, 직전 라운드 `20_05_17` W2 fix)이 새로 도입한
`valueEdgeToWebsocketService` 헬퍼**를 실제로 `Read` 하고, worktree 안에 프로브 파일을
만들어 뮤테이션을 주입해 검출/미검출을 실측했다(검증 후 즉시 삭제, `git status --porcelain`
으로 클린 확인 완료 — 공유 워크트리 오염 없음).

## 발견사항

- **[WARNING] 신규 회귀 가드의 `WebsocketService` 예외 처리가 로컬 바인딩 이름으로 판정한다 — alias 하나로 우회되거나 무고한 코드가 오탐된다 (양방향으로 실측 확인)**
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 함수 `valueEdgeToWebsocketService` — named import 분기(126~131행, 특히 `129~130행: .map((el) => el.name.text).filter((n) => n !== 'WebsocketService')`). (이 파일은 이번 프롬프트에서 diff 가 "생략"돼 게이트가 없어, 저장소의 실제 소스를 `Read` 로 직접 열어 확인한 줄 번호다.)
  - 상세: 이 헬퍼는 `20_05_17` 라운드가 지적한 "세 번째 테스트가 `export … from` 을 못 잡는다" 결함(W2)의 fix 로 이번 diff 의 최신 커밋(`a6d764ac6`)에서 신설됐다. `import`/`export … from`/`import = require()` 5가지 형태를 전부 순회하도록 잘 고쳐졌지만, 그중 named-import 분기가 "이 이름이 `WebsocketService` 인가"를 **`ts.ImportSpecifier.name`(별칭이 있으면 로컬 바인딩 이름)** 으로 비교한다 — 원래 export 된 식별자(`propertyName`)가 아니다. 두 방향으로 실제로 어긋난다는 걸 프로브로 확인했다:
    1. **false positive**: `import { WebsocketService as WS } from './websocket.service';` (합법적인 서비스 클래스 alias import) — `el.name.text` 가 `'WS'` 이므로 필터에서 제외되지 않고 offender 로 잡힌다. 실측: `websocket-events.types.spec.ts` 세 번째 `it` 이 **RED** — `offenders: ["modules/websocket/__probe_alias_import.ts → WS"]`.
    2. **false negative (더 심각)**: `import { ExecutionEventType as WebsocketService } from './websocket.service';` — 로컬 이름이 문자 그대로 `'WebsocketService'` 이므로 필터가 이를 "그 서비스 클래스"로 오인해 제외한다. 이건 정확히 이 가드가 막으려는 결함 클래스(#1174 재발 — enum 값을 순환 위 `websocket.service` 경유로 다시 값 import) 그 자체인데, 실측 결과 **4/4 GREEN — 미검출**이었다.
    - 두 프로브 모두 `codebase/backend/src/modules/websocket/` 아래 임시 파일을 만들어 `npx jest src/modules/websocket/websocket-events.types.spec.ts` 로 확인했고, 확인 직후 파일을 삭제해 `git status --porcelain` 클린을 재확인했다(저장소 변경 없음).
  - 이 갭이 우연이 아닌 이유: 이 PR 은 **같은 파일에서 이미 한 번** "narrow 하게 짠 자매 검사가 정밀 함수보다 좁다"는 결함(W2, `20_05_17`)을 겪었고, 커밋 메시지 자체가 "가드에 '한 칸 좁게 잡지 마라' 라고 써 놓고 같은 파일에서 그걸 했다" 다. 이번 발견은 **그 fix 커밋이 새로 도입한 헬퍼 안에서 정확히 같은 유형의 결함(정체성 판별을 좁게 잡음 — propertyName 대신 로컬 이름)이 세 번째로 재발**한 것이다. `export … from` 분기(136~146행)는 아예 `WebsocketService` 예외가 없어 named-import 분기와 비대칭이기도 하다(현재 저장소에 `export { WebsocketService } from '.../websocket.service'` 형태의 실사용처는 없어 당장 오탐을 내지는 않지만, 두 분기의 판별 기준이 다르다는 것 자체가 유지보수 함정이다).
  - 이번 diff 의 11개 뮤테이션(M1~M11, N1)·6개 뮤테이션(M1~M6) 표 어디에도 이 alias 시나리오는 없다 — mutation-testing 이 실측했다고 주장하는 커버리지가 이 특정 identity-check 분기까지는 미치지 못한다.
  - 제안: `el.name.text` 대신 원 export 식별자로 비교한다 — `(el.propertyName ?? el.name).text !== 'WebsocketService'`. `export … from` 분기(142~145행)에도 동일한 예외 처리를 추가해 두 분기의 판별 기준을 통일한다. 뮤테이션 표에 "M12: `WebsocketService as X` alias import (false positive 방향)"·"M13: `X as WebsocketService` alias import (false negative 방향, 최우선)" 를 추가해 고정할 것.

- **[INFO] 위 WARNING 을 제외하면, 최신 fix 커밋의 나머지 부분은 견고함을 재확인했다**
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 전체, `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.spec.ts` 전체
  - 상세: `npx jest src/modules/websocket/websocket-events.types.spec.ts src/modules/execution-engine/events/execution-event-emitter.service.spec.ts` 직접 실행 — **2 suites / 14 tests 전부 PASS** (베이스라인, 프로브 제거 후). `execution-event-emitter.service.spec.ts` 는 `TERMINAL_SHAPE[payload.type]` 가 실제로 매 `it` 마다 평가되도록 `completed`/`failed`(error 포함·`null`)/`cancelled`(user/timeout, `result` 중첩, 키 존재/부재 구분)를 각각 단언해 §6.4/§6.5 계약(닫힌 3값 union, `null` 대 키 부재)을 정확히 커버한다. `TerminalEventPayload` 의 판별 유니온 필수 필드는 `@ts-expect-error` 5건으로 타입 수준 계약을 고정하고, jest 가 이를 강제하지 않는다는 사실(타입 strip)과 실제 강제 주체(타입 래칫 게이트)를 스스로 주석에 명시해 "테스트가 무엇을 실제로 보장하는가"를 오도하지 않는다 — 이 저장소가 기록해 온 "테스트가 검증한다고 주장하는 것과 실제로 검증하는 것의 괴리" 실패 형태를 이 파일 스스로는 정직하게 서술하고 있다.
  - 제안: 없음(확인 목적).

- **[INFO] 나머지 20여 개 import-path 전용 변경 파일은 회귀 위험이 낮음 — 재확인**
  - 위치: `chat-channel.dispatcher.ts`/`.spec.ts`, `ai-turn-orchestrator.service.ts`/`.spec.ts`, `button-interaction.service.ts`, `form-interaction.service.ts`, `execution-engine.service.ts`/`.spec.ts`, `background-execution.processor.ts`, `retry-turn.service.ts`/`.spec.ts`, `interaction-stream.controller.ts`/`.spec.ts`, `notification-fanout.service.ts`/`.spec.ts`, `sse-adapter.service.ts`/`.spec.ts`, `embedding.service.ts`, `graph-extraction.service.ts`, `ai-turn-executor.ts`, `websocket.gateway.ts`
  - 상세: 전부 `from '.../websocket.service'` → `from '.../websocket-events.types'` 1:1 import 경로 치환이며 로직·시그니처·호출 순서 변경이 없다. 대응 스펙이 있는 파일은 스펙도 같은 치환만 받았고, 스펙이 없거나 mock 만 쓰는 파일(button/form-interaction, background-execution.processor)은 애초에 실제 모듈을 참조하지 않아 stale import 위험이 없다. 이전 두 라운드가 이미 이 부분을 상세히 검증했고 이번 라운드도 소스 대조로 재확인했다 — 새로 지적할 것 없음.

## 요약

핵심 발견은 하나다 — 직전 라운드(`20_05_17`)의 testing WARNING(`export … from` 미검출)을
고친 최신 커밋(`a6d764ac6`)이 새로 도입한 `valueEdgeToWebsocketService` 헬퍼가, `WebsocketService`
예외 처리를 **원 export 식별자가 아니라 로컬(별칭) 바인딩 이름**으로 판별해 alias import
한 줄로 뒤집힌다는 것을 실제 프로브로 양방향(오탐/미검출) 모두 재현했다. 특히 미검출 방향
(`ExecutionEventType as WebsocketService`)은 이 가드가 통째로 존재하는 이유인 #1174 재발
클래스를 정확히 놓치는 경로다. 이 PR 은 같은 파일에서 이미 두 번(직전 라운드 W2, 이번 커밋
메시지가 스스로 인정) "한 칸 좁게 잡는" 패턴을 겪었는데, 그 두 번째 fix 자체가 세 번째
사례를 새로 만든 셈이다. 다만 현재 저장소에 이 alias 패턴을 실제로 쓰는 코드는 없고, 익스플로잇
하려면 다소 부자연스러운(혹은 우연한) 이름 충돌이 필요해 이번 PR 의 프로덕션 런타임을 당장
막을 사유는 아니다. 그 외 `execution-event-emitter.service.spec.ts` 를 비롯한 회귀 테스트는
견고하고, 22개 이상의 import-path 전용 파일은 회귀 위험이 낮다는 이전 라운드들의 판단을
재확인했다.

## 위험도

LOW
