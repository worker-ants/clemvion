# 테스트(Testing) 리뷰

## 검토 방법

프롬프트의 unified diff(43개 파일, 대부분 import 경로 교체) 전체를 확인하고, 핵심 신규/변경
테스트 파일은 `Read`로 원본을 직접 열어 대조했다. 추가로 실제 테스트를 실행해 통과 여부를
독립 검증했다:

```
npx jest src/modules/websocket/websocket-events.types.spec.ts \
         src/modules/execution-engine/events/execution-event-emitter.service.spec.ts \
         src/modules/websocket/websocket.service.spec.ts \
         src/modules/websocket/websocket.gateway.spec.ts
→ Test Suites: 4 passed, 4 total / Tests: 118 passed, 118 total
```

`plan/in-progress/ws-event-types-extract.md`에 기록된 다회 뮤테이션 테스트 이력(17 RED / 5
GREEN 최종 라운드, `git log --oneline`으로 실제 커밋 이력과 대조해 실재 확인)도 근거로 삼았다.

## 발견사항

- **[INFO]** 신규 회귀 가드(`websocket-events.types.spec.ts`)는 이 PR에서 가장 테스트 관점의
  주목도가 높은 산출물이며, 품질이 우수하다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` (신규 파일 전체)
  - 상세: `#1174`(72 suites 장애) 재발을 막는 정적 가드로, TS 컴파일러 API로 실제 소스를 AST
    파싱해 "이 타입 전용 모듈이 어떤 형태로도 값 간선을 갖지 않는가"를 5개 테스트로 검증한다.
    `import`/`export … from`/`import x = require()`/top-level `require()`/동적 `import()`를
    하나의 `moduleRefs()` 헬퍼로 통합 열거하고, `WebsocketService` DI 예외는 **원 export
    식별자**(로컬 별칭이 아니라)로 판정한다 — plan 문서에 남은 실측(별칭 FN `ExecutionEventType
    as WebsocketService`가 가드를 무력화했던 사례)이 이 설계의 근거다. 공허 방지(vacuous-test
    prevention) 단언(`sf.statements.length`, `typeOnly.size`)도 각 테스트에 포함되어 "빈 파일이라
    자동 통과" 케이스를 막는다. 직접 실행해 GREEN을 확인했다.
  - 제안: 없음 — 우수 사례.

- **[INFO]** `TERMINAL_SHAPE`(module-scope 상수화) 리팩터는 기존 회귀 테스트로 완전히 커버된다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
    (신설 `TERMINAL_SHAPE`), `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.spec.ts`
    의 `describe('emitTerminalExecution — 종결 payload wire 형태', …)` 블록
  - 상세: 이 변경은 "호출 시점 지연 평가 → 모듈 스코프 상수"로 되돌리는 것이라 순환 재편입 시
    `TERMINAL_SHAPE.completed.eventType`이 `undefined`가 될 수 있는 지점이다. 기존 spec은
    completed/failed/cancelled 세 분기 모두에서 `ExecutionEventType.EXECUTION_COMPLETED` 등
    **테스트 파일이 직접 import한 실제 enum 값**과 `toHaveBeenCalledWith`로 대조하므로, 순환이
    되살아나 `TERMINAL_SHAPE`가 `undefined`를 담으면 이 테스트들이 즉시 깨진다 — 캐너리로
    문서화된 의도가 실제로 이 테스트에 의해 뒷받침된다. `error: null`(명시적 null 유지)·
    `cancelledBy: 'user'`(error 키 자체 부재, `'error' in wire === false`로 검증) 등 엣지 케이스도
    이미 커버돼 있다. 이번 diff로 새로 뚫린 코드 경로는 없다.
  - 제안: 없음.

- **[INFO]** `websocket.gateway.ts`의 `ExecutionEventType` import 경로 전환(`./websocket.service`
  → `./websocket-events.types`)에 대응하는 실행-값 검증은 기존 `websocket.gateway.spec.ts`가
  이미 수행 중
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:23`(import), `:400`
    (`client.emit(ExecutionEventType.EXECUTION_SNAPSHOT, …)`) / 대응 테스트
    `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:512`
    (`'should emit execution.snapshot to the subscribing client when execution exists'`)
  - 상세: 해당 테스트는 문자열 리터럴 `'execution.snapshot'`과 실제 emit 인자를 대조하므로,
    새 import 경로에서 `ExecutionEventType.EXECUTION_SNAPSHOT`이 `undefined`가 되면 즉시
    실패한다. 이 파일은 이번 diff의 43개 파일 목록에 포함되지 않았지만(수정 불필요), 이전 리뷰
    라운드(`19_27_37` architecture WARNING)가 지적했던 "gateway.ts 누락" 갭이 이번 diff에서
    실제로 닫혔음을(파일 24 diff에서 확인) 테스트 실행으로 재확인했다.
  - 제안: 없음 — 회귀 테스트 관점에서 이미 안전.

- **[INFO]** 8개 spec 파일의 "값 import → `import type`" 전환은 순수 컴파일타임 변경이며
  런타임 테스트 동작에 영향이 없다
  - 위치: `chat-channel.dispatcher.spec.ts`, `ai-turn-orchestrator.service.spec.ts`,
    `execution-event-emitter.service.spec.ts`, `execution-engine.service.spec.ts`,
    `retry-turn.service.spec.ts`, `interaction-stream.controller.spec.ts`,
    `notification-fanout.service.spec.ts`, `sse-adapter.service.spec.ts`,
    `websocket.service.spec.ts` — 전부 `ExecutionChannelEvent`/`ExecutionRoutingContext` 등
    interface만 `type` 키워드 추가
  - 상세: 이 전환은 `websocket-events.types.spec.ts`의 5번째 테스트("타입 전용 심볼을 `type`
    표시 없이 import하는 곳이 없다")를 통과시키기 위한 기계적 수정이다. interface는 애초에
    런타임 값이 없으므로 `type` 표시 유무와 무관하게 테스트 동작(assertion 대상 데이터)은
    바뀌지 않는다 — 실행 결과(118/118 GREEN)로 확인.
  - 제안: 없음.

- **[INFO]** (기존 패턴, 이번 diff로 신규 도입 아님) `execution-event-emitter.service.spec.ts`가
  `WebsocketService`를 `as unknown as WebsocketService`로 캐스팅한 손수 작성 mock을 사용
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.spec.ts`
    의 `beforeEach` 블록 (`websocket = { emitExecutionEvent: jest.fn(), … }; emitter = new
    ExecutionEventEmitter(websocket as unknown as WebsocketService);`)
  - 상세: `as unknown as`는 TS 타입 체크를 완전히 우회하므로, `WebsocketService`에 새 필수
    메서드가 추가돼도 컴파일 타임에는 잡히지 않고 실제 emitter가 그 메서드를 호출할 때만
    런타임 `TypeError`로 드러난다. 이번 diff는 이 패턴 자체를 도입하거나 확대하지 않았고
    (import 경로만 바뀜), 저장소 전반에 이미 퍼진 기존 컨벤션이라 이번 PR의 책임 범위는
    아니다 — 참고용으로만 남긴다.
  - 제안: 이번 PR 범위 밖. 후속 개선 시 `jest.Mocked<WebsocketService>` 같은 타입 안전 mock
    헬퍼로 전환 고려.

## 요약

이번 변경은 25개 소비 지점의 import 경로 교체 + `TERMINAL_SHAPE` module-scope 복원이 핵심이고,
테스트 관점에서는 두 축 모두 이례적으로 두텁게 커버돼 있다. 신규 회귀 가드
`websocket-events.types.spec.ts`는 TS AST 파서 기반으로 "값 간선 0줄"이라는 불변식을 5개
테스트로 고정했고, plan 문서에 남은 다회 뮤테이션 실측(별칭 오판정·`require()` 미검출 등 네 차례
재발 후 구조를 통합해 최종 17 RED/5 GREEN)과 이번 세션의 직접 실행(GREEN, 4 suites/118 tests)
양쪽으로 검증됐다. `TERMINAL_SHAPE` 리팩터는 completed/failed/cancelled 3분기·`error: null`
명시 유지·`cancelledBy` 키 부재 등 엣지 케이스까지 기존 `emitTerminalExecution` 테스트가 실제
enum 값 대조로 캐너리 역할을 겸하고 있어 별도 신규 테스트가 필요하지 않다. 나머지 22개 파일의
import-only 변경(또는 `import type` 표시 추가)은 런타임 동작에 영향이 없는 기계적 수정이며
회귀 테스트가 이미 충분히 넓게 걸려 있음을 실행으로 확인했다. Critical/Warning 급 테스트 갭은
발견되지 않았다.

## 위험도
NONE
