# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `TERMINAL_SHAPE` 가 함수-지역 리터럴에서 모듈 스코프 상수(새 "전역"에 준하는 공유 객체)로 승격됐다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:71`(선언), `:143`(사용부, `emitTerminalExecution`)
  - 상세: 종전엔 `emitTerminalExecution` 호출마다 `{ completed: {...}, failed: {...}, cancelled: {...} }[payload.type]` 리터럴을 새로 만들어 그 호출 스코프에서만 살아 있었다. 이제는 모듈 로드 시 1회 생성된 단일 객체를 모든 호출(=모든 execution, 모든 request)이 공유해서 읽는다. `as const` 로 컴파일 타임 readonly 는 보장되지만 런타임 `Object.freeze` 는 아니므로, 타입 우회(`as any` 등)로 필드를 변경하는 코드가 어딘가에 섞여 들어가면 그 변경이 프로세스 수명 동안 **모든 이후 종결 이벤트**의 `eventType`/`status` 매핑에 누출된다 — 종전 구조에서는 불가능했던 실패 모드다. 다만 현재 diff 안에서 이 객체를 쓰기 경로로 접근하는 코드는 없고(읽기 전용 구조 분해 `const { eventType, status } = TERMINAL_SHAPE[payload.type]` 뿐), JSDoc 이 이 상수가 회귀 캐너리로 의도된 것임을 상세히 밝히고 있어 실질 위험은 낮다.
  - 제안: 조치 불요(설계 의도가 명시되어 있고 현재 접근 경로가 모두 read-only). 다만 향후 이 상수에 프로퍼티를 쓰기 접근하는 코드가 추가되면 반드시 리젝트할 것 — lint 규칙(`no-param-reassign` 류)이나 `Object.freeze(TERMINAL_SHAPE)` 로 런타임에도 봉인해 두면 이 부작용 표면을 완전히 닫을 수 있다.

- **[INFO]** `websocket.service.ts` 가 enum/타입 선언을 `websocket-events.types.ts` 로 이전하고 re-export 하는 방식이 기존 소비자의 import 경로를 보존한다 — 인터페이스 파괴 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:14-46` (re-import + `export {}` / `export type {}` 블록)
  - 상세: `ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`/`NotificationEventType` 값과 `ExecutionChannelEvent` 등 8개 타입 전부가 동일한 이름·동일한 런타임 값으로 `websocket.service.ts` 경유 재노출된다. `websocket.service.spec.ts` 를 제외한 20여개 소비 파일은 신규 `websocket-events.types.ts` 를 직접 가리키도록 옮겨졌지만, 옛 경로를 여전히 쓰는 임의의 코드(이 diff 밖)가 있어도 값이 동일하므로 깨지지 않는다. 클래스 본문(`WebsocketService`)의 메서드 시그니처·구현은 diff 전 구간에서 변경이 없음을 `git diff origin/main` 전문으로 확인했다.
  - 제안: 없음 — 하위호환 유지가 의도대로 동작.

- **[INFO]** 신규 회귀 가드 스펙이 `src/` 전체를 동기 재귀 순회하며 매 파일을 TS 파서로 파싱한다 — read-only, 파일 생성/수정/삭제 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:159-167`(`allTsFiles`), `:197-206`(호출부)
  - 상세: `fs.readdirSync`/`fs.readFileSync` 로 `SRC_ROOT`(`codebase/backend/src`) 하위 모든 `.ts` 파일을 열어 module specifier 를 추출한다. 쓰기 동작은 없고 `node_modules` 는 `SRC_ROOT` 바깥이라 스캔 대상에 들지 않는다. 테스트 프로세스 안에서만 일어나는 부작용이라 프로덕션 런타임에는 영향이 없다.
  - 제안: 없음 — 부작용 관점에서는 무해(성능 관점은 별도 리뷰어 소관).

## 요약

이번 diff 는 26개 backend 소스 파일 중 24개가 `websocket.service` → `websocket-events.types` 로의 **import 경로 재배선뿐**이며(각 파일 diff stat 2~6줄, 전부 import 문 내부), 함수/메서드 시그니처·클래스 필드·이벤트 발행 호출·네트워크 호출·환경 변수 접근 어디에도 변경이 없다. 유일한 로직 변경은 `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 를 함수-지역 리터럴에서 모듈 스코프 `as const` 상수로 승격한 것인데, 참조하는 값(`ExecutionEventType`/`ExecutionStatus`)과 반환 매핑이 기존과 동일해 관측 가능한 동작 변화가 없고 read-only 접근만 존재한다. `websocket.service.ts` 는 이전 export 표면을 re-export 로 그대로 보존해 기존 호출자에게 인터페이스 파괴가 없음을 소스 전문 대조로 확인했다(`git diff origin/main` 전체 diff 검토, RESOLUTION.md 의 W1 — gateway.ts 옛 경로 잔존 — 이미 현재 소스에서 수정 확인). 신규 `websocket-events.types.spec.ts` 는 프로덕션 코드가 아닌 테스트 프로세스 내에서만 파일시스템을 읽기 전용으로 순회하며, 쓰기·삭제·네트워크·환경변수 접근은 전무하다. 전반적으로 부작용 관점의 실질 리스크는 없다.

## 위험도
NONE
