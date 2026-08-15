# 부작용(Side Effect) Review

## 검토 방법

`git diff origin/main...HEAD`(53개 파일, backend 코드 27개 + plan/review/spec 문서 26개)를 대상으로,
프롬프트의 diff 게이트가 잘린 핵심 파일 3개(`websocket-events.types.ts` 신규,
`websocket-events.types.spec.ts` 신규, `websocket.service.ts`)는 `Read`/`git diff` 로 전체를 직접
열람해 확인했다. `origin/main..HEAD` 커밋 8개 중 최근 3개(`fa1bca013`~`eeaf9c3ba`)는
`websocket-events.types.spec.ts` 단일 파일만 건드렸음을 `git diff --stat` 으로 확인했다(운영 코드
변경 없음, 가드 테스트 로직 정교화만).

## 발견사항

- **[INFO]** `execution-event-emitter.service.ts` 에 모듈 스코프 상수 `TERMINAL_SHAPE` 재도입
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` `TERMINAL_SHAPE` 선언부(클래스 `ExecutionEventEmitter` 바로 위) / `emitTerminalExecution` 메서드
  - 상세: #1174 회귀를 피하려 호출 시점 지연 평가로 우회했던 것을 모듈 스코프 상수로 되돌렸다. 관점 1·2("의도치 않은 상태 변경"/"전역 변수")에 형식적으로 해당하지만, (a) 참조하는 `ExecutionEventType`/`NodeEventType` 이 이제 import 0줄인 `websocket-events.types.ts` 에서 오므로 순환에 참여하지 않고, (b) `TERMINAL_SHAPE` 는 `as const` 로 선언되고 코드 전체에서 읽기(구조분해)만 하며 쓰기 경로가 없어 실질적인 상태 변경 위험은 없다. (c) 이 되돌림이 의도적 캐너리라는 근거(순환이 되살아나면 즉시 대량 실패)와 함께 상세 JSDoc 으로 문서화되어 있고, 새 정적 가드(`websocket-events.types.spec.ts`)가 이 전제(타입 모듈로의 eager 값 간선 부재)를 지킨다. `Object.freeze` 미적용은 별도 라운드(`20_27_08` INFO4)에서 "쓰기 경로 없음"으로 이미 검토·처분됨.
  - 제안: 신규 조치 불요. 문서화·가드 모두 충분.

- **[INFO]** 새 정적 가드 테스트가 `src/` 트리 전체를 재귀 스캔(`fs.readdirSync`/`fs.readFileSync`)
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` `allTsFiles`/`collectOffenders`
  - 상세: 관점 3("파일시스템 부작용")에 해당하나 전부 **읽기 전용**이며 인자가 `__dirname` 기반 정적 경로뿐이라 경로 탐색·쓰기 위험이 없다. test-only 코드이고 이미 별도 라운드에서 성능(~1초) 실측·처분됨.
  - 제안: 없음.

- **[INFO]** 하위호환 re-export facade가 재순환 재유입의 잠재 표면
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` 상단 `export { ExecutionEventType, NodeEventType, BackgroundRunEventType, NotificationEventType }` / `export type { ... }` 블록
  - 상세: 관점 5("인터페이스 변경")과 반대 방향 — 이번 변경은 공개 표면을 **깨지 않기 위해** re-export 를 추가했다. 기존 25개 이상 호출부가 값을 이 경로에서 가져오던 것과 호환되며, 실제로 변경 후에도 `websocket.service.ts` 에서 값 import 하는 지점(`websocket.service.spec.ts` facade 검증 제외)은 없음을 소스 대조로 확인했다. 다만 이 facade 자체가 향후 실수로 값-import 우회 경로가 될 수 있다는 점은 이미 이전 라운드(`19_27_37` dependency.md)에서 지적·INFO 처분된 바 있고, 이번 diff 는 그에 더해 `websocket-events.types.spec.ts` 의 4번째 테스트(`websocket.service` 로의 eager 값 간선 금지, facade spec 예외)로 이를 코드 레벨에서 강제한다.
  - 제안: 신규 조치 불요.

## 그 외 확인 (관점별 결론)

- **시그니처 변경(4)**: 없음. 27개 backend 코드 파일 diff 전부 `import` 문 경로/`type` 키워드 조정뿐이고, 함수·메서드·클래스 시그니처는 단 한 곳도 바뀌지 않았다(`git diff` 로 전수 확인).
- **인터페이스 변경(5)**: 값/타입 선언이 물리적으로 새 파일로 이동했지만 `websocket.service.ts` 가 동일 이름으로 재-export 하여 외부(다른 모듈)에서 보는 공개 API 표면은 불변. `emitTerminalExecution` 이 조립하는 wire payload(`status`/`eventType`/`durationMs`/`error`/`result`) 계산 로직도 `TERMINAL_SHAPE` 참조 방식만 바뀌었을 뿐 결과값은 동일.
- **환경 변수(6)**: diff 전체에 `process.env` 관련 추가/변경 없음.
- **네트워크 호출(7)**: 신규 외부 서비스 호출 없음(순수 내부 리팩터, `dependency.md`/`security.md` 리뷰와 일치).
- **이벤트/콜백(8)**: `emitExecutionEvent`/`emitNodeEvent`/`emitTerminalExecution` 등 실제 emit 호출 지점·인자·페이로드 구조는 변경되지 않았다. enum 값 자체(문자열 리터럴)도 그대로 `websocket-events.types.ts` 로 이동만 됐다.
- **plan/review/spec 문서 변경(26개 파일)**: 전부 서술·라인번호 정정·plan 후속 등재 등 텍스트 수정이며 코드 실행 경로에 영향 없음.

## 요약

이번 diff 는 `websocket.service.ts` 가 갖고 있던 이벤트 enum·타입 선언을 의존성-프리 모듈
`websocket-events.types.ts` 로 추출하고 25개 이상 소비 지점의 import 경로를 재배선한 순수 구조
리팩터로, 함수 시그니처·공개 API·환경 변수·네트워크 호출·emit 동작 어느 것도 실질적으로 바꾸지
않았다(전 파일 `git diff` 직접 대조로 확인). 유일하게 런타임 동작 표면에 걸리는 지점은
`execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 를 모듈 스코프 상수로 되돌린 것인데,
이는 순환 이탈(값이 이제 import-0 모듈에서 옴)을 전제로 한 의도적 조치이고 읽기 전용이며 정적
가드로 캐너리화되어 있어 부작용 관점에서 실질 위험이 없다. 신규 정적 가드 테스트는 소스 트리를
읽기 전용으로 스캔하는 test-only 코드로 파일시스템 부작용이 없다. Critical/Warning 대상 부작용
결함 없음.

## 위험도

LOW
