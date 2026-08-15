# 아키텍처(Architecture) 리뷰

## 검토 방법

이번 diff(파일 1~53)는 `plan/in-progress/ws-event-types-extract.md` 구현과, 그 구현의 직전
`19_27_37` 코드 리뷰(Warning 5건)에 대한 `RESOLUTION.md` 반영분, 그리고 그 반영을 촉발한
`18_53_27` consistency-check 산출물을 모두 포함한다. 즉 이번 라운드는 사실상
"fix 이후 fresh review" 다. 프롬프트에 실린 unified diff 외에 아래를 직접 `Read`/`Grep` 로
대조했다 — diff 조각만으로는 JSDoc 인접성·순환 참여 여부를 판정할 수 없기 때문이다.

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` 전체
- `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` 전체
- `codebase/backend/src/modules/websocket/websocket.service.ts` 상단(re-export/구현 세부 배치)
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` 의 import·사용처
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` /
  `retry-turn.service.ts` 의 `websocket.service` 참조 여부(잔여 순환 경로 재확인)
- `npx jest src/modules/websocket/websocket-events.types.spec.ts` 직접 실행 (4/4 PASS)

## 발견사항

이번 라운드에서 새로 지적할 CRITICAL/WARNING 급 아키텍처 결함은 없다. 직전 라운드
(`19_27_37`)가 찾은 두 건은 현재 소스에서 실제로 해소되었음을 직접 확인했다:

- **[WARNING → 해소 확인]** `websocket.gateway.ts` 가 순환의 두 핵심 노드 중 하나로서
  `ExecutionEventType` 을 옛 경로(`./websocket.service`)로 여전히 값 import 하던 결함
  (직전 라운드 W1) — 이번 diff(파일 24)에서 `import { ExecutionEventType } from
  './websocket-events.types';` 로 전환되었고, `grep -n "WebsocketService\|ExecutionEventType"
  websocket.gateway.ts` 로 직접 재확인한 결과 gateway 는 이제 `websocket.service` 를 값으로도
  타입으로도 전혀 참조하지 않는다. `websocket-events.types.spec.ts` 의 3번째 테스트(TS 파서로
  `src/` 전체를 스캔해 `websocket.service` 경유 값 import 를 찾는 회귀 가드)도 로컬 실행에서
  4/4 PASS 로 이 상태를 정적으로 고정하고 있다.
  - 참고로 원래의 4-노드 순환(`websocket.service → websocket.gateway → execution-engine.service
    → execution-event-emitter.service → websocket.service`(forwardRef))은 이번 작업의 명시적
    범위 밖(`forwardRef` 제거는 별도 판단)이라 여전히 존재한다. 다만 이제 그 순환 위 파일들이
    모듈 스코프에서 참조하는 `ExecutionEventType` 등의 **선언 자체**는 순환 밖(의존성-프리
    모듈)에서 오므로, `TERMINAL_SHAPE` 류의 모듈 스코프 파생이 다시 안전해졌다는 설계 목표가
    실제로 달성됐다.

- **[WARNING → 해소 확인]** `ExecutionEventEmitter` 클래스 JSDoc이 새로 삽입된
  `TERMINAL_SHAPE` JSDoc 에 가로막혀 클래스 선언에서 분리(orphan)되던 결함 (직전 라운드 W2) —
  `execution-event-emitter.service.ts` 를 다시 읽은 결과, 순서가
  `[TerminalEventPayload 문서] → [TERMINAL_SHAPE JSDoc+선언] → [클래스 JSDoc] → [@Injectable()]
  → [export class]` 로 교정되어, 클래스 JSDoc(라인 86~102)과 `@Injectable()`/클래스 선언(103~104)
  사이에 공백·다른 선언이 끼지 않는다. TS/IDE 의 "선언 바로 위, 가장 가까운 블록만 채택" 규칙상
  이제 클래스 문서가 정상적으로 부착된다.

- **[INFO]** `websocket.service.ts` 의 re-export facade(값 4 + 타입 8, `websocket.service.ts:31-46`)는
  여전히 수동 나열 동기화 지점이지만, 이번 라운드에서 확인한 `websocket-events.types.spec.ts`
  세 번째 테스트가 "`websocket.service` 경유 값 import 금지"를 **저장소 전체 파일 트리**(`SRC_ROOT`
  = `src/` 전체, re-export facade 검증용 spec 1곳만 allowlist) 대상으로 강제하므로, 직전
  `19_27_37/dependency.md` 가 제안했던 `eslint no-restricted-imports` 급 정적 가드의 실질적
  대체물이 이미 확보된 상태다. 즉 "미래에 누군가 실수로 `websocket.service` 에서 enum 을 값으로
  다시 import 하면"이라는 리스크는 lint 가 아니라 **CI 상 jest** 로 이미 fail-closed 다. 신규
  조치는 불필요.

- **[INFO]** `spec/5-system/10-graph-rag.md:552` 가 `KbEventType` union 의 정본 선언 위치를
  여전히 `websocket.service.ts` 로 서술하는 점(re-export 덕에 문장 자체는 참, canonical 위치는
  `websocket-events.types.ts`)은 이번 diff 로 해소되지 않았고, `plan/in-progress/
  ws-event-types-extract.md` 의 "후속 (이 PR 범위 밖)" 절에 planner 턴 항목으로 정확히 등재돼
  있다 — developer 권한(`spec/` read-only) 밖이므로 이 아키텍처 리뷰 범위에서는 차단 사유가 아니다.

## 설계 평가 (참고)

이 리팩터의 핵심 기법 — "순환 위에 있는 서비스 구현체에서 값/타입 선언만 떼어 **의존성 0**인
leaf 모듈로 옮기고, 원 파일은 re-export 로 하위호환을 유지한다" — 는 ES-module 순환에서 값
평가 순서 문제를 근본 차단하는 정석적인 해법이다. SRP 관점에서 `websocket.service.ts` 가
지던 "구현체 + 공유 값/타입 정의처" 이중 책임이 분리됐고, 의존성 역전 관점에서도 다수 소비자가
이제 구현체가 아니라 값-전용 계약 모듈에 의존하게 되어 결합도가 낮아졌다. `forwardRef`/DI
그래프·emit 단일 sink 정책(§4.4/R10)은 의도적으로 불변으로 남겨 이번 작업의 범위를 좁게
유지했고, 그 경계가 plan 문서(`ws-event-types-extract.md` "§4.4 가 유예한 것과 이건 다른
층위다")에 명시적으로 기록되어 있어 향후 "sink 분리 시도"로 오탐될 여지도 줄여 놓았다.
25→13개 import 재배선, 66 suites 실패 → 425/425 통과라는 역재현 검증, TS 파서 기반 회귀
가드(`websocket-events.types.spec.ts`, mutation 6/6 RED)까지 갖춰 이 구조적 불변식("이 모듈은
의존성 0 이어야 한다")이 주석 서술이 아니라 실행 가능한 테스트로 고정되어 있다는 점이 특히
견고하다.

## 요약

직전 라운드(`19_27_37`)가 지적한 두 건의 아키텍처 WARNING — `websocket.gateway.ts` 가 옛
경로로 `ExecutionEventType` 값을 계속 가져오던 순환 참여 잔존 문제, `ExecutionEventEmitter`
클래스 JSDoc 이 `TERMINAL_SHAPE` 삽입으로 고아화되던 문제 — 는 이번 diff 에서 실제로 수정되어
있음을 소스 직접 대조 + 회귀 가드 테스트 실행(4/4 PASS)으로 확인했다. 새로 발견한 CRITICAL/
WARNING 급 이슈는 없다. 설계 자체(순환 위 값 평가 순서 문제를 의존성-프리 leaf 모듈 분리로
근본 차단, re-export 로 하위호환 유지, 저장소 전체 스캔 기반 회귀 가드)는 SOLID·결합도·순환
의존성 관점에서 모범적인 리팩터로 판단된다. `WebsocketService` 자체의 책임 분리와 `forwardRef`
제거는 의도적으로 범위 밖에 남아 있으며 이는 plan 이 명시한 결정이다.

## 위험도

NONE
