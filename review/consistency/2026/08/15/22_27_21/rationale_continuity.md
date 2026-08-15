# Rationale 연속성 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 대상 파악

- spec 변경은 `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록에
  `codebase/backend/src/modules/websocket/websocket-events.types.ts` 1줄 추가뿐 (본문 무변경).
- 실질 변경은 코드 쪽: `websocket.service.ts` 에 있던 이벤트 enum/payload 타입 선언
  (`ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`/`NotificationEventType`/
  `KbEventType`/`ExecutionChannelEvent`/`ChatChannelRoutingInfo`/`ExecutionRoutingContext`/
  `ToolCall*Payload`/`UserMessagePayload`/`NotificationNewPayload`)을 의존성-0 신규 모듈
  `websocket-events.types.ts` 로 추출하고, `websocket.service.ts` 는 이를 re-export.
  나머지 26개 파일 변경은 전부 import 경로만 새 모듈로 갈아탄 것(값은 그대로,
  일부는 `type` import 로 정밀화). `execution-event-emitter.service.ts` 는 `#1174` 에서
  호출 시점 지연 평가로 우회했던 `TERMINAL_SHAPE` 파생을 다시 모듈 스코프 상수로
  되돌렸다(순환에서 빠졌으므로 안전하다는 것이 이 PR 의 핵심 주장).

## 관련 Rationale 대조

1. **[Spec 실행 엔진 §4.4](spec/5-system/4-execution-engine.md#44-이벤트-발행-sink--websocketservice-단일-sink-정책)**
   — "단일 sink" 정책 + "순환 의존 처리" 표(`forwardRef` / `ModuleRef.get`) +
   "순환 자체를 이벤트 기반 디커플링 등으로 근본 축소하는 것은 별도 대규모 리팩터링
   backlog — 현재는 두 기법으로 봉인한 상태를 유지한다."
   - 코드 확인: `execution-event-emitter.service.ts` 생성자는 여전히
     `@Inject(forwardRef(() => WebsocketService))` (변경 없음, git diff 로 확인).
     엔진/자매 서비스들의 emit 호출부(`ExecutionEventEmitter` 경유)도 변경 없음 — 값
     import 경로만 바뀌었을 뿐 DI 그래프·`forwardRef`·emit call-site 는 그대로다.
   - 새 모듈 `websocket-events.types.ts` 자신의 헤더 주석이 명시적으로
     "DI 그래프·`forwardRef`·emit 경로는 불변이다 … 유예한 것은 '이벤트 기반
     디커플링 등으로 순환을 근본 축소'하는 대규모 리팩터고, 이 모듈은 그 봉인 기법을
     **대체하지 않는 보완 조치**"라고 §4.4 를 인용하며 스스로 경계를 긋는다.
   - 판정: §4.4 가 유예한 "근본 축소"를 이 PR 이 몰래 수행하는 것이 아니라, §4.4 가
     열거한 두 기법(forwardRef/ModuleRef) 과 **직교하는** 별도 문제(ESM 순환 위 파일의
     모듈-스코프 값 평가 순서)를 다룬다. 순환 위상 자체(어떤 서비스가 어떤 서비스를
     순환 참조하는가)는 손대지 않았다 — 위반 아님.

2. **[Spec EIA §R10](spec/5-system/14-external-interaction-api.md#r10-websocketservice-단일-sink-정책의-확장)**
   — "엔진은 여전히 `WebsocketService.emitToExecution` 한 곳만 호출(단일 sink)",
     "새 sink 도입 없음".
   - 새 모듈의 `ExecutionChannelEvent` JSDoc 이 그대로 "[Spec EIA §R10] — ExecutionEngine
     단일 sink 정책 유지. emit 호출 측은 여전히 WebsocketService.emitExecutionEvent /
     emitNodeEvent 하나만" 이라고 재인용 — 문구까지 이식했고 emit 호출부 diff 도 없다.
     위반 아님.

3. **`14_55_29` maintainability W4 / `18_53_27` naming W3** (코드 인라인에서 인용된
   과거 리뷰 결정) — KB union 문서 위치 오귀속 정정, `NotificationEventType` 이름
   충돌 경고를 그대로 승계·재확인하는 주석을 신규 모듈에 유지. 과거 리뷰 결정을
   뒤집지 않고 이어받았다.

4. **§2.2 Redis-only 정책(2026-06-02)** — `ExecutionSeqAllocator`/`ws-error-codes.ts`/
   `strip-external-only-fields.ts` 는 이번 diff 에서 미변경. 접촉 없음.

## 발견사항

해당 없음 — CRITICAL/WARNING 급 발견 없음.

- **[INFO]** §4.4 "순환 의존 처리" 표에 세 번째 기법 각주 추가 검토
  - target 위치: 코드 `codebase/backend/src/modules/websocket/websocket-events.types.ts` 헤더 주석 (신규)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4.4 "순환 의존 처리" 표(두 기법: `forwardRef`, `ModuleRef.get`)
  - 상세: 이번 PR 은 §4.4 표가 다루는 "DI 순환"과는 다른 계층인 "ESM 순환 위 파일의 모듈-스코프 값 평가 순서" 문제를 "의존성-프리 타입 모듈 추출"이라는 세 번째 완화 기법으로 봉인했다. 코드 주석에는 충분히 설명돼 있고 §4.4 본문·EIA §R10 의 기존 문구를 정확히 재인용하므로 모순은 없지만, spec 본문 §4.4 표는 여전히 "두 기법"만 언급해 다음 리더가 이 세 번째 기법의 존재를 spec 에서 찾지 못할 수 있다.
  - 제안: 필수는 아니나, §4.4 "순환 의존 처리" 문단에 "값/타입 선언을 의존성-프리 모듈로 분리해 ESM 순환의 평가-순서 위험을 제거하는 보완 기법(코드: `websocket-events.types.ts`)"을 한 문장으로 추가하면 향후 동일 패턴 재사용 시 탐색 비용이 준다.

## 요약

이번 diff 는 `spec/5-system/`에 실질 본문 변경이 없고(frontmatter `code:` 목록 1줄 추가뿐), 코드 쪽은 `websocket.service.ts` 의 순수 값/타입 선언을 의존성-0 신규 모듈로 옮기고 나머지 26개 파일은 import 경로만 갈아탄 behavior-preserving 리팩터다. `forwardRef` DI 배선·emit call-site·`ExecutionEventEmitter` 단일 sink 구조는 diff 전후 동일하며, 신규 모듈 자신의 JSDoc 이 [Spec 실행 엔진 §4.4]의 "순환 근본 축소는 별도 backlog, 현재는 봉인 기법 유지" 결정과 [Spec EIA §R10]의 "엔진은 여전히 `WebsocketService.emit*` 한 곳만" 문구를 정확히 인용하며 스스로 경계를 명시한다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 어느 관점에서도 충돌을 찾지 못했다.

## 위험도

NONE
