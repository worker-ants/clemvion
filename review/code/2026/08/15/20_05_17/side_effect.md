# 부작용(Side Effect) 리뷰 — websocket.service 값/타입 의존성-프리 모듈 분리

## 검토 방법

- `git diff origin/main...HEAD --stat` (53개 파일) 로 프롬프트 목록과 실제 diff 를 대조 — 일치 확인.
- 신설 파일 `codebase/backend/src/modules/websocket/websocket-events.types.ts` 전문을 `Read` 로 직접 확인.
- `websocket.service.ts`(re-export facade), `execution-event-emitter.service.ts`(`TERMINAL_SHAPE`),
  `websocket.gateway.ts`(import 전환)를 워크트리에서 직접 열어 현재 상태를 확인.
- `git diff` 전수에 `process.env|fs\.|writeFile|readFile|console\.|fetch|axios|require\(|child_process`
  패턴을 grep — 신설 테스트 파일(`websocket-events.types.spec.ts`)의 `fs.readFileSync`/`fs.readdirSync`
  외에는 매치 없음을 확인.
- `execution-event-emitter.service.spec.ts` diff 로 mock 구성이 실제로 안 바뀌었는지 확인.

## 발견사항

- **[INFO]** 모듈 스코프 상수 부활(`TERMINAL_SHAPE`) — 평가 시점(evaluation-timing)이 바뀌는 유일한 지점
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` `TERMINAL_SHAPE` 선언 (게이트 71-84) 및 `emitTerminalExecution`(143)
  - 상세: 나머지 22개 소스 파일은 전부 import 경로만 바뀌는 기계적 변경인데, 이 파일만 유일하게 "호출 시점 지연 평가"(이전 워크어라운드)를 "모듈 스코프 상수"로 되돌린다. 이 패턴은 정확히 #1174(72 suites `Cannot read properties of undefined`)를 낸 형태이므로 side-effect 관점에서 재발 위험을 짚을 가치가 있다. 다만 이번엔 `ExecutionEventType`/`ExecutionStatus` 의 출처가 import 0줄인 `websocket-events.types.ts`(직접 확인, 이 모듈은 정말로 어떤 module specifier 도 갖지 않음)로 바뀌어 순환 밖에 있고, 회귀 가드(`websocket-events.types.spec.ts`, 6개 뮤테이션 전부 RED)와 역재현(12곳만 옮겼을 때 66 suites 실패 → 9곳 분리 후 425/425 통과)으로 실측 검증되어 있다. 전역 상태를 export 하지도 않는 module-private `as const` 객체라 외부에서 뮤테이션할 표면도 없다.
  - 제안: 조치 불필요 — 이미 이전 리뷰 라운드(`19_27_37`)에서 동일 항목이 INFO 로 확인되었고, 이번 라운드 diff 는 그 상태를 그대로 유지한다.

- **[INFO]** `websocket.gateway.ts` 의 값 import 경로 전환 — 이전 라운드에서 지적된 순환 참여자 누락(W1)이 이번 diff 에서 해소됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:23`
  - 상세: 직접 `Read`로 확인한 결과 `import { ExecutionEventType } from './websocket-events.types';` 로 이미 전환되어 있다(`RESOLUTION.md` W1 반영과 일치). `ws.service ↔ gateway` 직접 2-노드 순환의 두 당사자 모두 이제 의존성-프리 모듈만 값으로 참조하므로, 향후 이 파일이 모듈 스코프 파생을 추가하더라도 #1174 급 재발 표면이 남지 않는다.
  - 제안: 없음(확인 완료).

- **[INFO]** 공개 export 표면(re-export facade) 보존 — 기존 호출자에 대한 시그니처/인터페이스 영향 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:14-46`
  - 상세: `websocket.service.ts` 가 이동된 값 4개(`export {...}`)·타입 8개(`export type {...}`)를 그대로 재-export 하므로, `from '.../websocket.service'` 로 값/타입을 계속 가져오는 13곳(`WebsocketService` 클래스도 함께 쓰는 소비처)은 이번 diff 밖에서 무변경으로 계속 컴파일·동작한다. `MAX_SANITIZE_DEPTH`·`sanitizePayloadForWs`·`CREDENTIAL_KEY_PATTERN`·`TERMINAL_EXECUTION_EVENTS` 등 구현 세부와 클래스 본문(`emitExecutionEvent`/`emitNodeEvent`/`registerExecutionRouting`/`releaseExecutionRouting` 등)은 바이트 단위로 보존되어 emit 경로·시그니처 변경이 없다.
  - 제안: 없음(확인 완료).

- **[INFO]** 22개 파일의 import 경로 교체는 순수 정적 재배선 — 런타임 부작용 없음
  - 위치: 파일 1~6, 8~21, 24, 26 (chat-channel.dispatcher, ai-turn-orchestrator, button/form-interaction, execution-engine.service, background-execution.processor, retry-turn, interaction-stream/sse-adapter/notification-fanout, embedding/graph-extraction, ai-turn-executor 등)
  - 상세: 전부 `from '../websocket/websocket.service'` → `from '../websocket/websocket-events.types'` (또는 `import type` 분리) 형태의 1:1 치환이며, `git diff` 로 대조한 결과 로직·함수 시그니처·호출 순서·반환값 변경이 전혀 없다. 새 전역 변수, 신규 env var 읽기/쓰기, 신규 네트워크 호출, 신규 파일 I/O 는 도입되지 않았다.
  - 제안: 없음.

- **[INFO]** 신설 테스트 `websocket-events.types.spec.ts` 의 파일시스템 접근은 테스트 스코프 내 read-only
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` (`fs.readFileSync`/`fs.readdirSync` 게이트 55-104 부근)
  - 상세: 이 정적 가드는 TS 파서로 `websocket-events.types.ts` 의 module specifier 를 세고(0개여야 함), `src/modules` 하위 전체(~1,230 파일 규모)를 재귀 탐색해 `websocket.service` 를 값으로 import 하는 파일이 있는지 검사한다. 전부 read-only(`readFileSync`/`readdirSync`)이며 파일 쓰기·삭제·환경변수 변경은 없다. CI/로컬 테스트 실행 시마다 디렉터리 전체를 훑는 비용이 있으나(성능 관점, side-effect 아님) 기능적 부작용은 없다.
  - 제안: 없음(부작용 관점 문제 아님 — 필요하면 별도 testing/performance 리뷰에서 다룰 사안).

- **[NONE]** 전역 변수 도입, 함수/메서드 시그니처 변경, 환경 변수 읽기/쓰기, 의도치 않은 네트워크 호출, emit 이벤트 경로/콜백 변경 — 전부 미발견
  - 상세: `spec/`·`plan/`·`review/` 하위 문서 변경(파일 27~53)은 라인 인용 심볼화, 신규 plan/review 산출물, spec frontmatter `code:` 1줄 추가로 전부 프로세스 문서이며 런타임 부작용과 무관.

## 요약

이번 diff 는 `websocket.service.ts` 가 함께 export 하던 값(enum)·타입 선언을 의존성-프리 신규 모듈 `websocket-events.types.ts` 로 분리하고, 22개 소비 파일의 import 경로를 재배선한 사실상 전량 기계적 리팩터다. 공개 export 표면은 re-export facade 로 완전히 보존되어 기존 호출자에 영향이 없고, 함수 시그니처·emit 경로·전역 상태·환경변수·네트워크 호출은 하나도 바뀌지 않았다. 유일하게 "평가 시점"이 바뀌는 지점(`execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 모듈 스코프 상수 부활)은 과거 실제 장애(#1174, 72 suites)와 같은 형태이지만, 그 위험의 근본 전제(ES-module 순환 참여)가 이번 리팩터로 제거되었음을 정적 가드(모듈 specifier 0개 단언 + 6/6 뮤테이션 RED)와 역재현(66 suites 실패 → 425/425 통과)으로 실측 검증했고, 이전 리뷰 라운드에서 지적된 유일한 실질 결함(`websocket.gateway.ts` 가 순환 참여자임에도 이동 대상에서 누락)도 이번 diff 에서 이미 반영되어 있다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

NONE
