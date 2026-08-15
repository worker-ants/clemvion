# 부작용(Side Effect) 리뷰

## 개요

`websocket.service.ts` 가 함께 export 하던 값(enum)·타입 선언을 의존성-프리 신규 모듈
`codebase/backend/src/modules/websocket/websocket-events.types.ts` 로 옮기고, 나머지 24개
파일은 그중 **타입/enum 만 쓰는 import 를 새 모듈로 갈라 재지정**한 기계적 리팩터. 실제 코드
동작이 바뀌는 지점은 `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 하나뿐이며,
나머지는 전부 import 경로만 바뀐다. `websocket.service.ts` 는 옮긴 값/타입 12개(값 4 +
타입 8)를 전부 `export { … } / export type { … }` 로 재-export 해 기존 import 경로
(`from '.../websocket.service'`)를 깨지 않는다 — 실제로 원본 파일의 top-level `export` 12종과
신/구 파일의 export 집합을 diff 대조해 1:1 일치를 확인했다(`MAX_SANITIZE_DEPTH` 상수와
`WebsocketService` 클래스는 이동 대상이 아니라 원 파일에 그대로 남아 있음도 확인).

## 발견사항

- **[INFO] 모듈 스코프 상수 부활(`TERMINAL_SHAPE`) — 이 PR 에서 유일하게 실행 순서에 의존하는 변경**
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` (`TERMINAL_SHAPE` 상수 선언부, `emitTerminalExecution` 메서드)
  - 상세: 종전에는 ES-module 순환(`websocket.service ↔ gateway ↔ execution-engine/retry-turn ↔ event-emitter`) 위에서 모듈 평가 시점에 `ExecutionEventType` 이 `undefined` 로 읽히는 문제(#1174, 72 suites 실패)를 피하려고 `{eventType, status}` 매핑을 **호출 시점**에 인라인으로 파생시키는 우회를 썼다. 이번 변경은 그 매핑을 다시 **모듈 스코프 상수**로 끌어올렸다. 안전성은 전적으로 `ExecutionEventType` 의 출처가 이제 import 0줄인 `websocket-events.types.ts` (실측 확인: `grep -c "^import"` = 0)라는 사실에 의존한다. 이 파일이 순환에 참여하지 않으므로 어느 시점에 평가되든 완전히 초기화된 상태로 읽힌다는 것이 근거이며, plan 문서(`plan/in-progress/ws-event-types-extract.md`)가 "12곳만 옮겼을 때 66 suites 실패 → 9곳(서비스+타입 동시 사용처)까지 갈랐더니 425/425 통과"라는 역재현으로 실측 검증했다고 기록하고 있다.
  - 리스크: `TERMINAL_SHAPE` 는 export 되지 않는 module-private 상수라 외부에서 직접 뮤테이션할 표면은 없다. 다만 이 안전성이 "미래에 누군가 이 파일의 `ExecutionEventType` import 를 다시 `websocket.service` 로 되돌리거나, `websocket-events.types.ts` 에 새 import 를 추가해 순환에 편입시키지 않는다"는 암묵적 불변식에 의존한다 — 코드 주석이 이를 "회귀 시 대량 테스트 실패로 즉시 드러나는 캐너리"라고 명시적으로 설계해 뒀으므로 조용한 회귀 가능성은 낮다.
  - 제안: 조치 불필요(설계·검증 근거가 문서화되어 있고 방어적으로 캐너리화됨). 향후 `websocket-events.types.ts` 에 import 를 추가하려는 PR이 있다면 이 파일이 이 안전성의 근거임을 상기시키는 리뷰 체크가 유효.

- **[INFO] 공개 export 표면 보존 — 인터페이스 변경 없음 (확인 완료)**
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts`
  - 상세: `git show origin/main:.../websocket.service.ts | grep '^export'` 결과(12개 타입/enum + `MAX_SANITIZE_DEPTH` + `WebsocketService`)와 변경 후 `websocket.service.ts`+`websocket-events.types.ts` 의 export 집합을 대조한 결과 완전히 일치. 기존에 `from '.../websocket.service'` 로 값/타입을 가져오던 13곳(서비스도 함께 쓰는 호출부)은 이번 diff 밖에서도 무변경으로 계속 동작.
  - 제안: 없음(확인용 기록).

- **[INFO] `websocket.gateway.ts` 는 여전히 값 import 를 `websocket.service` 경로에서 가져오지만 안전 — 이동 대상에서 의도적으로 제외**
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (`import { ExecutionEventType } from './websocket.service'`, 사용처는 `client.emit(ExecutionEventType.EXECUTION_SNAPSHOT, …)`)
  - 상세: 이 import 는 모듈 스코프가 아니라 함수 본문(런타임 호출 시점)에서만 `ExecutionEventType` 을 참조하므로, 이번 리팩터가 고치려는 "모듈 평가 시점 undefined" 클래스의 위험에 해당하지 않는다. plan 문서의 "타입만 쓰는 12곳"/"둘 다 쓰는 9곳" 실측 분류와도 정합적이며, 이 파일이 전환 대상에서 빠진 것은 누락이 아니라 위험 클래스 밖이기 때문으로 판단된다.
  - 제안: 조치 불필요.

- **[NONE] 함수/메서드 시그니처, 전역 변수, 파일시스템·네트워크·환경변수, emit 이벤트 경로 — 전부 무변경**
  - 상세: 24개 backend 소스/spec 파일 diff 전수를 확인한 결과 import 문 재배치 외의 로직 변경은 위 `TERMINAL_SHAPE` 한 곳뿐이며, 그마저 계산 결과(반환 shape)는 기존과 동일하다(리터럴 인라인 → 상수 참조로 형태만 변경, 값·타입 불변). `emitExecutionEvent`/`emitNodeEvent`/`emitTerminalExecution` 등 emit 호출부·시그니처·인자 순서는 이번 diff에서 하나도 건드리지 않았다. 신규 전역 상태·파일 I/O·env var 읽기/쓰기·외부 네트워크 호출은 도입되지 않았다.

- **[NONE] `spec/`·`plan/`·`review/` 문서 변경들 (파일 25~38)**
  - 상세: 라인 인용을 심볼 기준으로 갱신한 plan 문서 4건, 신규 plan 문서(`ws-event-types-extract.md`), consistency 리뷰 산출물 신규 파일 8건, spec frontmatter `code:` 목록 1줄 추가는 이 turn의 정상적인 문서 워크플로 산출물이며 런타임 부작용과 무관.

## 요약

이번 PR은 순환 의존성 위에 있던 `websocket.service.ts` 의 값/타입 선언을 의존성-프리 모듈로 물리적으로 분리하는 거의 전량 기계적인 import 경로 재배치이며, 공개 export 표면(12 types/enums + `WebsocketService` + `MAX_SANITIZE_DEPTH`)은 재-export 로 완전히 보존되어 기존 호출자에 영향이 없다. 유일하게 실행 순서 의존적인 변경은 `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 를 호출-시점 파생에서 모듈-스코프 상수로 되돌린 부분인데, 이는 새 의존성-프리 모듈(실측: import 0줄)이 순환에서 완전히 벗어나 있다는 사실에 근거해 설계되었고, plan 문서가 "부분 이동(12곳) 시 66 suites 실패 → 전체 이동(9곳 추가 분리) 후 425/425 통과"라는 역재현으로 실제로 검증했다고 기록하고 있다. 이 module-private 상수는 export 되지 않으며, 회귀 시 조용히 넘어가지 않고 대량 테스트 실패로 즉시 드러나도록 의도적으로 설계된 "캐너리"다. 전역 상태 오염, 시그니처/인터페이스 파괴, 파일시스템·네트워크·환경변수 부작용, 이벤트 emit 경로 변경은 발견되지 않았다.

## 위험도

LOW
