# 테스트(Testing) 리뷰 — ws-event-types-extract (누적 diff, 4라운드째 fresh review)

## 검토 방법

이 PR 은 이미 3라운드(`19_27_37` → `20_05_17` → `20_27_08`)의 코드 리뷰를 거쳤고, 매 라운드
testing 관점에서 정확히 같은 파일(`websocket-events.types.ts` 신설 회귀 가드
`websocket-events.types.spec.ts`)에서 "식별 기준을 한 칸 좁게 잡은" 결함을 하나씩 찾아 고쳤다
(W5: 가드 부재 → 신설 / W2: `ts.isImportDeclaration` 만 순회 → `valueEdgeToWebsocketService` 로
5~7형태 통합 / W2: 로컬 별칭 이름으로 `WebsocketService` 예외 판정 → 원 export 식별자
(`propertyName ?? name`)로 교정). 이번 라운드는 그 3번의 수정이 반영된 최종 상태
(`e8585b574`)를 대상으로, 프롬프트 diff 만 보지 않고 실제 소스(`Read`)와 **worktree 안에 임시
프로브 파일을 만들어 직접 `npx jest` 로 뮤테이션을 실행**해 검증했다(검증 직후 프로브 삭제,
`git status --porcelain` 클린 재확인 완료 — 공유 워크트리 오염 없음).

## 발견사항

- **[WARNING] 회귀 가드가 자신의 헤더 주석이 명시한 "CommonJS `require()` 로도 값 간선이
  생긴다"를 실제로는 검사하지 않는다 — 실측 프로브로 4번째 미검출(GREEN)을 재현했다**
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 함수
    `valueEdgeToWebsocketService`(`:112-173`, 특히 `for (const st of sf.statements)` 로만
    순회하고 `ts.isImportDeclaration`/`ts.isExportDeclaration`/`ts.isImportEqualsDeclaration`
    세 가지만 처리) — 이 파일은 이번 프롬프트에서 diff 가 "생략"돼 게이트가 없어, 저장소의
    실제 소스를 `Read` 로 직접 열어 확인한 줄 번호다.
  - 상세: 파일 최상단 모듈 JSDoc(`:20-24`)은 이렇게 명시한다 — "모듈 간선은 `import` 말고도
    `export … from`(re-export) · `import x = require()` · 동적 `import()` · **`require()`**
    로도 생긴다. 그래서 정규식이 아니라 TypeScript 파서로 모든 module specifier 를 센다." 그런데
    실제로 이 4형태를 전부 세는 함수는 `moduleSpecifiersOf`(`:64-94`, `ts.forEachChild` 로
    재귀 순회하며 `ts.isCallExpression` 분기로 `require(...)`/동적 `import(...)` 를 모두 잡는다)
    **하나뿐**이고, 이 함수는 오직 첫 번째 테스트("타입 모듈 자신은 간선이 0개")에만 쓰인다.
    정작 "다른 모든 소스 파일이 `websocket.service` 로 값 간선을 만들지 않는다"를 검사하는
    세 번째 테스트가 호출하는 `valueEdgeToWebsocketService` 는 **top-level statement 종류
    3가지만** 검사하고, 바로 몇 줄 위에 있는 자매 함수 `moduleSpecifiersOf` 가 이미 구현해 둔
    `ts.isCallExpression` + `require` 식별자 분기를 재사용하지 않는다.
  - **실측 재현**: `src/modules/websocket/__probe_bare_require.ts` 에 아래를 넣고
    `npx jest src/modules/websocket/websocket-events.types.spec.ts` 를 실행했다.
    ```ts
    const { ExecutionEventType } = require('../websocket/websocket.service');
    export const probe = ExecutionEventType;
    ```
    결과: **5/5 PASS — 미검출.** 세 번째 테스트("`websocket.service` 로의 값 간선이 없다")가
    이 offender 를 전혀 잡지 못했다. 검증 후 프로브 파일 삭제, `git status --porcelain` 클린
    확인함.
  - **왜 이론적 엣지케이스가 아닌가**: 이 저장소에 지역(상대경로) 모듈을 `require()` 로 불러오는
    선례가 이미 있다 — `src/bootstrap/undici-dispatcher.spec.ts:32`
    (`const mod = require('./undici-dispatcher') as {...}`). 즉 "circular-import 회피/모듈
    재평가를 노리고 상대경로 모듈을 CommonJS `require()` 로 지연 로드한다"는 패턴은 이 팀이
    이미 실제로 쓰고 있는 관용구다. `websocket.service ↔ gateway ↔ execution-engine/retry-turn
    ↔ event-emitter` 순환 위에 있는 파일에서 누군가 "모듈 스코프에서 import 하면 안 된다"는
    걸 알면서 `require()` 로 우회하면(모듈 스코프에 두면 이 역시 즉시 평가되므로 #1174 와
    **완전히 동일한 실패 모드**를 재현한다), 이 PR 이 3라운드를 들여 막으려던 정확히 그 버그가
    소리 없이 되돌아오고, 이 가드는 GREEN 인 채로 아무 것도 알리지 않는다. `export … from` 형태
    누락(`20_05_17` W2)·별칭 로컬명 오판(`20_27_08` W2)과 완전히 같은 클래스의 결함이 **3번째가
    아니라 4번째**로 재발한 것이다.
  - 제안: `valueEdgeToWebsocketService` 에 `ts.isVariableStatement` 분기를 추가해, top-level
    변수 선언의 initializer 가 `require('.../websocket.service')` 호출인 경우를 값 간선으로
    잡는다. 구조분해 바인딩(`const { A, B: C } = require(...)`) 이라면 프로퍼티 키 기준으로
    (별칭이 아니라) `WebsocketService` 예외를 판정해야 한다 — 이미 두 번(`20_27_08` W2) 겪은
    "로컬 이름이 아니라 원 식별자로 비교" 교훈을 여기서도 그대로 적용할 것. 함수 본문 안에서만
    호출되는 `require()`(지연 평가, 안전)까지 잡을 필요는 없다 — 그건 top-level statement 순회
    설계와 자연히 일치한다(동적 `import()` 를 의도적으로 제외한 것과 같은 이유). 뮤테이션 표에
    "M15: 지역 모듈 bare `require()`(top-level, 이번 프로브 그대로)" 를 추가해 고정할 것.
    구조적으로는 `moduleSpecifiersOf` 의 `ts.isCallExpression` 분기를 재사용/공유해 두 함수가
    같은 로직을 따로 구현하지 않게 하면, 이런 종류의 "한쪽만 좁게 구현" 재발을 원천 차단할 수
    있다.

- **[INFO] 위 WARNING 을 제외하면, 4라운드째 반복 검증에도 나머지 가드 로직은 견고함을 재확인했다**
  - 상세: `websocket-events.types.spec.ts` 의 named-import/`export … from` 별칭 판정
    (`originalName = (el) => (el.propertyName ?? el.name).text`, `:126-127`)은 `WebsocketService`
    로 별칭을 걸거나(`as WS`) `ExecutionEventType as WebsocketService` 로 위장하는 두 방향
    모두(`20_27_08` M12/M13/N2 대응) 원 식별자 기준으로 정확히 판정하고 있음을 소스 재확인으로
    검증했다. 다섯 번째 테스트("타입 전용 심볼을 `type` 표시 없이 import 하는 곳이 없다",
    `:241-284`)도 같은 `propertyName ?? name` 패턴을 재사용해 별칭 회피를 막는다.
    `execution-event-emitter.service.spec.ts` 는 `emitTerminalExecution` 의 3분기
    (`completed`/`failed`/`cancelled`, `error` 의 `null` 대 키-부재 구분 포함)를 각각 단언해
    `TERMINAL_SHAPE` 모듈 스코프 복귀가 실제로 매 테스트마다 평가됨을 확인했고, 타입 계약
    (`@ts-expect-error` 5건)이 jest 로는 강제되지 않는다는 사실을 스스로 주석에 정직하게 밝혀 둔
    점도 이전 라운드 판단과 일치한다.
  - 제안: 없음(확인 목적).

- **[INFO] 나머지 22개 이상의 import-path 전용 변경 파일은 여전히 회귀 위험이 낮다 — 재확인**
  - 상세: `chat-channel.dispatcher.ts`/`.spec.ts`, `ai-turn-orchestrator.service.ts`/`.spec.ts`,
    `button-interaction.service.ts`, `form-interaction.service.ts`, `execution-engine.service.ts`/
    `.spec.ts`, `background-execution.processor.ts`, `retry-turn.service.ts`/`.spec.ts`,
    `interaction-stream.controller.ts`/`.spec.ts`, `notification-fanout.service.ts`/`.spec.ts`,
    `sse-adapter.service.ts`/`.spec.ts`, `embedding.service.ts`, `graph-extraction.service.ts`,
    `ai-turn-executor.ts`, `websocket.gateway.ts`(+`websocket.gateway.spec.ts` 존재 확인,
    다만 이 스펙은 `ExecutionEventType`/`websocket-events.types` 를 참조하지 않아 이번 import
    전환과 무관) — 전부 `from '.../websocket.service'` → `from '.../websocket-events.types'`
    1:1 치환이며 로직·시그니처·호출 순서 변경이 없다. 이전 세 라운드가 이미 상세히 검증했고
    이번 라운드도 소스 대조로 재확인했다.

## 요약

3라운드에 걸쳐 이 PR 은 정확히 같은 회귀 가드 파일 안에서 "식별 기준을 한 칸 좁게 잡는" 결함을
세 번 고쳤다(가드 부재 → `export … from` 미검출 → 별칭 로컬명 오판). 이번 4번째 검토에서
그 패턴이 **한 번 더** — 이번엔 CommonJS `require()` 값 간선 — 재발했음을 실제 프로브
(`npx jest`, 5/5 GREEN)로 재현했다. 특히 이 결함은 특이한 점이 있다: 가드 파일 자신의 헤더
JSDoc 이 "require() 로도 간선이 생긴다"고 이미 명시하고 있고, 그걸 검사하는 코드
(`ts.isCallExpression` 분기)도 **같은 파일 안 다른 함수**(`moduleSpecifiersOf`)에 이미
존재하는데, 정작 "다른 파일들이 `websocket.service` 를 값으로 끌어오지 않는다"를 검사하는
함수(`valueEdgeToWebsocketService`)만 그걸 재사용하지 않았다. 저장소에 이미 지역 모듈을
`require()` 로 지연 로드하는 선례(`undici-dispatcher.spec.ts`)가 있어 순수 이론적 위험이
아니다. 현재 소스에는 이 형태로 `websocket.service` 를 값 import 하는 실사용처가 없어 이번
PR 의 프로덕션 런타임을 당장 막을 사유는 아니지만, 이 PR 전체의 존재 이유(#1174 재발 방지)를
정확히 놓치는 미검출 경로이므로 다음 라운드로 넘기지 말고 이번에 닫는 편이 싸다. 그 외
`execution-event-emitter.service.spec.ts` 를 비롯한 회귀 테스트, 22개 이상의 import-path
전용 파일은 이전 라운드들의 판단대로 견고하다.

## 위험도

MEDIUM
