# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** 순환의 두 핵심 노드 중 하나(`websocket.gateway.ts`)가 이번 분리에서 빠졌다 — "13→0 stragglers" 완료 주장이 실측과 다르다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:23`(import), `:400`(사용부, `emitExecutionSnapshot` 메서드 내부) — 이 파일은 이번 diff 에 포함되지 않아 게이트 번호가 없다. `Read` 로 직접 열어 확인한 실제 소스 줄 번호다.
  - 상세: 이번 리팩터의 문제 서술 자체가 순환을 `ws.service ↔ gateway ↔ execution-engine/retry-turn ↔ event-emitter` 로 규정한다(`websocket-events.types.ts:6-8`, `websocket.service.ts:7-9`). 그런데 정작 그 순환의 두 핵심 노드 중 하나인 `websocket.gateway.ts` 는 여전히 `ExecutionEventType` 을 **옛 경로**(`./websocket.service`)로 import 한다. 반대 방향으로 `websocket.service.ts` 는 생성자 DI 를 위해 `WebsocketGateway` 클래스를 값으로 import 한다(`websocket.service.ts:3,185`) — 즉 `websocket.service.ts` ↔ `websocket.gateway.ts` 는 **이 두 파일만으로 완성되는 직접 2-파일 순환**이고, 이번 PR 은 이 순환을 그대로 남겨 뒀다. 오늘은 `ExecutionEventType` 사용이 메서드 본문(`emitExecutionSnapshot`) 안에 있어 모듈 평가 시점 undefined 버그는 발현하지 않지만, `plan/in-progress/ws-event-types-extract.md` 의 "타입만 쓰는 12곳" 목록·"9곳 분리" 목록 어디에도 `websocket.gateway.ts` 가 없다 — grep 기반 실측(`websocket\.service` importer 25곳)이 같은 디렉터리의 상대경로(`from './websocket.service'`)를 놓친 것으로 보인다(다른 소비자는 모두 `../websocket/websocket.service` 형태). 이 파일이 `WebsocketService` 를 주입받지 않고 순수하게 `ExecutionEventType` 값만 쓰는데도 새 의존성-프리 모듈로 전환되지 않은 유일한 소비자다.
  - 왜 이게 "완료" 주장을 무너뜨리는가: `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 사례에서 보듯, 이 저장소는 "모듈 스코프 파생"을 실제로 계속 추가하는 패턴을 보인다. `websocket.gateway.ts` 가 향후 같은 패턴(예: 채널명↔이벤트타입 매핑을 모듈 스코프 상수로 승격)으로 바뀌면, 정확히 같은 두 파일(`service.ts`/`gateway.ts`)에서 정확히 같은 `undefined` 버그(#1174, 72 suites)가 재발한다. 이번 작업이 성공 기준으로 못박은 "역재현(캐너리)"은 `event-emitter.service.ts` 한 곳만 되돌려 검증했을 뿐 `gateway.ts` 경로는 커버하지 않는다.
  - 이 리팩터의 검증 가능성 주장에 대한 반례: plan 은 "tsc 가 전수 검사한다"를 성공 기준으로 든다. 그러나 옛 경로(`websocket.service.ts` 를 통한 re-export)는 여전히 유효한 타입이라 `tsc` 는 "의도된 facade 사용"과 "전환 누락"을 구분하지 못한다 — 이번 사례가 그 사각지대의 실례다.
  - 제안: `websocket.gateway.ts:23` 의 import 를 `import { ExecutionEventType } from './websocket-events.types';` 로 전환. 이번 PR 범위에 없더라도, `plan/in-progress/ws-event-types-extract.md` 의 "12곳" 실측·체크리스트에 이 파일을 추가해 완료 주장을 정정하고, 가능하면 `grep -rln "from '\./websocket\.service'\|from '\.\./.*websocket/websocket\.service'"` 로 상대경로 형태 두 가지를 모두 포괄하는 재실측을 후속 커밋에서 수행할 것.

- **[INFO] `NotificationEventType` 위에 놓인 disambiguation JSDoc 블록이 이 리팩터가 이미 알고 있는 "orphaned JSDoc" 패턴을 새 파일에서 재현한다**
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:209-212`(첫 블록, "사용자 알림 도메인 이벤트...") 바로 다음 `:213-219`(두 번째 블록, "⚠️ 인앱 알림 벨 전용...") — 둘 다 `:220` 의 `export enum NotificationEventType` 위에 연속 배치.
  - 상세: `websocket.service.ts:126-127`(구 코드, 이번 diff 로 삭제된 KB union 관련 주석)이 바로 이 패턴("블록 JSDoc 으로 두었더니 붙을 선언이 없어 바로 아래 문서로 읽혔다 — `14_55_29` maintainability W4")을 이미 문제로 인지하고 남긴 흔적이다. 그런데 이번 리팩터가 신설한 `websocket-events.types.ts` 에서 정확히 같은 형태(연속된 JSDoc 블록 두 개, 첫 블록은 코드가 아니라 다음 주석 블록과 인접)가 `NotificationEventType` 위에 다시 생겼다. 대부분의 문서 도구/IDE hover 는 선언에 **가장 인접한** 마지막 블록만 연결하므로 첫 블록(일반 설명)은 사실상 고아 상태가 된다.
  - 제안: 두 블록을 하나로 합치거나(권장), 첫 블록을 두 번째 블록 안의 도입부 문단으로 흡수.

- **[INFO] `ExecutionEventEmitter` 클래스 JSDoc 이 `TERMINAL_SHAPE` 상수 삽입으로 클래스 선언과 떨어졌다**
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` — 클래스 설명 JSDoc(`실행 엔진이 발행하는 도메인 이벤트의 단일 진입점...`)과 `export class ExecutionEventEmitter`(`:101`) 사이에 이번 PR 이 새로 삽입한 `TERMINAL_SHAPE` 용 JSDoc + 상수 선언(`:68-98`)이 끼어 있다.
  - 상세: 기능적 결함은 아니지만, 바로 위 WARNING 항목에서 지적한 "이 저장소가 이미 겪은 문서-인접성 실수(`14_55_29` W4)"와 같은 클래스다. 클래스 레벨 문서가 `TERMINAL_SHAPE` 문서로 오인되거나 도구에서 누락될 수 있다.
  - 제안: `TERMINAL_SHAPE` 선언(및 그 JSDoc)을 클래스 JSDoc **위**로 옮기거나, `@Injectable()` 데코레이터 바로 앞으로 클래스 JSDoc 을 재배치.

## 요약

이번 PR 의 핵심은 `websocket.service.ts` 가 짊어졌던 "서비스 구현체 + 런타임 값(enum)·타입 선언"의 이중 책임을 `websocket-events.types.ts`(의존성 0)로 분리해, ES-module 순환 위에서 모듈-스코프 값 파생이 `undefined` 로 평가되던 근본 원인(#1174, 72 suites 장애)을 제거하는 것이다. 설계 자체는 정석적이다 — 값/타입 전용 leaf 모듈로 순환을 끊는 기법은 SRP·의존성 역전 원칙에 부합하고, `websocket.service.ts` 의 re-export 로 하위 호환을 유지하면서 "타입만 쓰는 소비자"와 "서비스+타입 모두 쓰는 소비자"를 구분해 20개 파일의 import 를 기계적으로 전환한 실행도 꼼꼼하다(`execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 모듈-스코프 상수를 의도적으로 되살려 회귀 캐너리로 삼은 점도 검증 설계로서 훌륭하다). 다만 정작 문제 서술이 명시한 순환의 두 핵심 노드 중 하나인 `websocket.gateway.ts` 가 실측 목록에서 빠져 옛 경로로 `ExecutionEventType` 을 계속 가져오고 있어, "13→0 stragglers" 완료 선언과 실제 코드 상태 사이에 간극이 있다. 오늘 당장 깨지는 버그는 아니지만(사용부가 함수 본문 내부), 정확히 같은 두 파일에서 같은 undefined 버그가 재발할 수 있는 잠재 위험이 남아 있고 이 PR/plan 의 "tsc 전수 검사"·"역재현 캐너리" 검증 근거로는 잡히지 않는 사각지대다. 그 외 레이어 책임·모듈 경계·확장성 관점에서는 새 리스크가 없다(DI 그래프·`forwardRef`·emit 경로 불변, `WebsocketService` 단일 sink 정책 유지).

## 위험도
MEDIUM
