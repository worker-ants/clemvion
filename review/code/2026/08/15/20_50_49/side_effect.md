# 부작용(Side Effect) 리뷰 — `20_50_49`

## 검토 방법

이번 라운드 diff(`origin/main...HEAD`, 86개 파일)는 `ws-event-types-extract` 작업 전체와 그 위에
쌓인 3라운드 코드 리뷰(`19_27_37`→`20_05_17`→`20_27_08`) + 2라운드 consistency-check
(`18_53_27`/`20_05_19`)의 fix 커밋들을 누적 포함한다. 실제 런타임 동작에 영향을 줄 수 있는 코드는
파일 1~27(backend `.ts`/`.spec.ts`)뿐이고 28~86은 plan/review/spec 문서다. 세 라운드가 이미
side-effect 관점을 각각 검토했으므로(연속 NONE/LOW), 이번 라운드는 프롬프트 diff 조각이 아니라
**현재 소스 전문을 직접 `Read`/`grep`/`jest` 로 재검증**해 이전 라운드 결론이 실제로 유효한지, 그
사이 새 회귀가 섞이지 않았는지를 축으로 확인했다.

- `websocket-events.types.ts` 전체 — import 0줄인 "의존성-프리" 주장을 직접 대조
- `websocket.service.ts` 상단 re-export 블록(14~46행) — export 표면 보존 여부
- `websocket.gateway.ts` — `ExecutionEventType` import 경로가 실제로 전환됐는지
- `execution-event-emitter.service.ts` 전체 — `TERMINAL_SHAPE` 배치·사용부
- `websocket-events.types.spec.ts` 전체 — 신규 가드 테스트의 파일시스템 접근 성격
- `npx jest src/modules/websocket/websocket-events.types.spec.ts` 직접 실행 → 5/5 PASS
- `grep -rln "websocket.service"` 로 diff 밖 소비자(`notifications.service.ts` 등)가 값 import 를
  하는지 전수 확인

## 발견사항

- **[INFO]** `TERMINAL_SHAPE` 가 함수-지역 리터럴에서 **모듈 스코프 공유 객체**로 승격되며 평가 시점이 "호출마다"에서 "모듈 로드 1회"로 바뀌었다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:71`(선언, `const TERMINAL_SHAPE = {...} as const`), `:143`(`emitTerminalExecution` 사용부, `const { eventType, status } = TERMINAL_SHAPE[payload.type]`)
  - 상세: 이 변경 자체가 바로 이 리팩터가 고치려는 결함(#1174, 모듈 스코프 파생이 순환 위에서 `undefined`)과 **같은 클래스의 side effect 표면**이다 — 안전성이 "이제 이 파일이 참조하는 enum 의 출처(`websocket-events.types.ts`)가 import 0줄이라 순환에 참여하지 않는다"는 전이 사실 하나에 전적으로 의존한다. 직접 확인 결과 그 전제는 현재 성립한다(`websocket-events.types.ts` 전문에 `import` 문 없음, 테스트 3번째 케이스가 이를 정적으로 고정, `jest` 5/5 PASS로 재확인). `TERMINAL_SHAPE` 는 export 되지 않는 module-private 상수이고 diff 안에서 이 객체에 대한 쓰기 경로는 없다(구조 분해로 원시값만 꺼내 씀) — 런타임 `Object.freeze` 는 없지만 현재 접근 경로는 전부 read-only.
  - 제안: 조치 불요(현재 diff 범위에서는 안전, 근거가 JSDoc·전용 회귀 테스트로 문서화됨). 다만 이 파일이 향후 다시 값 import 를 `websocket.service` 경로로 되돌리거나 `websocket-events.types.ts` 에 새 import 가 추가되면 정확히 같은 실패 모드가 재발한다는 점은 이 PR 의 설계 자체가 안고 있는 잔여 리스크이며, 이를 막는 유일한 안전장치가 이번에 추가된 정적 가드(`websocket-events.types.spec.ts`)라는 점을 인지해 둘 것.

- **[INFO]** `websocket.service.ts` 의 하위호환 re-export 표면 — 값 4개 + 타입 8개, diff 전후 완전 일치 확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:14`~`27`(재-import), `:31`~`46`(`export {...}` / `export type {...}`)
  - 상세: `ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`/`NotificationEventType`(값) + `ExecutionChannelEvent`/`ChatChannelRoutingInfo`/`ExecutionRoutingContext`/`ToolCallStartedPayload`/`UserMessagePayload`/`ToolCallCompletedPayload`/`NotificationNewPayload`/`KbEventType`(타입) 12종 전부가 동일 이름·동일 런타임 값으로 재노출된다. `MAX_SANITIZE_DEPTH` 상수·`WebsocketService` 클래스는 이동 대상이 아니라 원 파일에 그대로 남아 있음도 확인. 이번 diff 밖에서 `from '.../websocket.service'` 로 값/타입을 가져오던 임의의 호출자가 있어도 인터페이스 파괴 없이 계속 동작한다.
  - 제안: 없음(확인용 기록).

- **[INFO]** `websocket.gateway.ts` — 직전 라운드(`19_27_37`)가 지적한 순환 잔존 노드가 실제로 전환됐음을 직접 재확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:23`(`import { ExecutionEventType } from './websocket-events.types';`)
  - 상세: `grep -n "websocket.service\|ExecutionEventType"` 로 재확인한 결과 gateway 는 더 이상 `./websocket.service` 를 값으로도 타입으로도 참조하지 않는다. `notifications.service.ts` 등 diff 밖 파일 중 `websocket.service` 를 여전히 참조하는 곳은 전수 확인했으나(`WebsocketService` 클래스만 DI 목적으로 값 import, enum 값 import 없음) 이는 가드가 명시적으로 허용하는 예외 형태(DI 불가피성)와 일치한다.
  - 제안: 없음.

- **[NONE]** 함수/메서드 시그니처·전역 변수·파일시스템·네트워크·환경변수·이벤트 emit 경로 — 전부 무변경
  - 상세: `execution-event-emitter.service.ts` 의 `emitExecution`/`emitTerminalExecution`/`emitNode`/`registerExecutionRouting`/`releaseExecutionRouting` 시그니처·본문 로직은 `TERMINAL_SHAPE` 참조 형태(인라인 리터럴 → 상수 참조)만 바뀌고 반환 shape·인자는 동일. 신규 `websocket-events.types.spec.ts` 는 `fs.readdirSync`/`fs.readFileSync` 로 `codebase/backend/src` 하위를 재귀 스캔하지만 **읽기 전용**(쓰기·삭제 없음)이고 테스트 프로세스 내에서만 실행돼 프로덕션 런타임에 영향 없음 — 직접 실행해 5/5 PASS·부작용 없음을 재확인했다. 신규 외부 네트워크 호출, env var 읽기/쓰기, 신규 전역 변수 도입은 없다.

## 요약

이번 라운드는 실질적으로 새 코드가 아니라 3라운드 코드 리뷰 + 2라운드 consistency-check 의 fix 가
누적된 최종 상태를 다시 검증하는 성격이다. 프롬프트 서술이 아니라 현재 소스를 직접 열어
재확인한 결과 — re-export 표면 12종 완전 보존, gateway 의 순환 참여 노드 전환 완료, 신규 회귀
가드(`websocket-events.types.spec.ts`) 5/5 PASS, diff 밖 소비자 전수 확인까지 — 모든 주장이
실측과 일치했다. 부작용 관점에서 유일하게 실질적인 항목은 `TERMINAL_SHAPE` 를 호출-시점 리터럴에서
모듈-스코프 상수로 되돌린 것인데, 이는 이 PR 이 고치는 결함(#1174)과 **같은 계열의 평가-시점
side effect**를 다시 도입하는 형태이면서도, 그 안전성이 "새 타입 모듈이 import 0줄"이라는 사실
하나에 의존한다는 점에서 설계상 주목할 가치가 있다. 다만 현재는 그 전제가 실제로 성립하고,
전용 정적 가드(뮤테이션 검증 포함)가 그 불변식을 회귀 방지로 고정해 뒀으므로 이번 PR 을 막을
사유는 아니다. 그 외 시그니처·전역 상태·파일시스템·네트워크·환경변수·이벤트 emit 경로 변경은
발견되지 않았다.

## 위험도

LOW
