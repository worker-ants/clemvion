# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: C-1 후속 ④ — EngineDriver ISP 분할 + engine→Retry 단방향 DI 정리
파일 수: 17개 (소스 코드 15개 + review 산출물 2개)

---

## 발견사항

- **[INFO]** `ReentryStateDriver` 인터페이스 JSDoc이 내용을 중복 서술
  - 위치: `engine-driver.interface.ts` — `ReentryStateDriver` 인터페이스 선언부 및 그 내부 `buildRetryReentryState` 메서드 JSDoc
  - 상세: 인터페이스 수준 JSDoc("AI resume(§7.5) ↔ retry-last-turn 재진입이 공유하는 `_resumeState` 재구성기. `AiTurnEngineDriver` 와 `RetryEngineDriver` 가 함께 소비한다.")과 메서드 수준 JSDoc("AI resume(§7.5) ↔ retry-last-turn 재진입이 공유하는 `_resumeState` 재구성기. `_resumeCheckpoint`/`_retryState` 로 turn-state 를 복원하고...")의 첫 문장이 거의 동일하게 반복된다. 인터페이스 주석은 "소비자 목록"을 강조하고 메서드 주석은 "동작"을 기술하는 역할 분리가 부분적으로만 이뤄졌다.
  - 제안: 인터페이스 JSDoc은 목적·소비자 관계 한 줄로 축약하고, 동작 상세는 메서드 JSDoc에만 기재해 중복을 제거한다.

- **[INFO]** `ENGINE_DRIVER` 토큰 JSDoc이 신규 소비자를 열거하지 않음
  - 위치: `engine-driver.interface.ts` — `ENGINE_DRIVER` 상수 직전 JSDoc 마지막 문장("'AiTurnOrchestrator' 가 본 토큰으로 엔진 잔류 메서드 capability 만 주입받아…")
  - 상세: ISP 분할로 소비자가 4개로 늘었으나 토큰 JSDoc은 PR2 당시 orchestrator 하나만 언급한다. 새 개발자가 이 파일을 읽을 때 본 토큰을 `AiTurnOrchestrator` 전용으로 오해할 수 있다.
  - 제안: `ENGINE_DRIVER` JSDoc의 예시 소비자 목록을 4개(`AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService`)로 갱신하거나, "각 소비자 서비스가 자신의 ISP slice 타입으로 주입받는다" 식으로 일반화한다.

- **[INFO]** `ExecutionEventEmitter` 생성자 주석의 인과 체인이 밀도 높음
  - 위치: `events/execution-event-emitter.service.ts` — 생성자 `@Inject(forwardRef(...))` 앞 블록 주석(4줄)
  - 상세: "engine→Retry 역방향 DI 제거 → retry-turn.service import 위치 이동 → ws.service↔gateway↔event-emitter ES-module 순환이 더 짧은 경로로 노출 → forwardRef로 견고화"라는 인과 체인을 한 블록에 서술하는데, 맥락을 모르는 독자는 "왜 event-emitter가 이 주석을 갖는가"를 파악하기 어렵다.
  - 제안: 핵심 이유("ws.service↔gateway ES-module 순환이 forwardRef 없이 노출될 수 있으므로 지연 해석")만 한 문장으로 압축하고, 변경 배경 맥락은 커밋/PR 링크로 대체해도 충분하다.

- **[INFO]** `continuation-execution.processor.ts`에서 동일 사유 설명이 클래스 JSDoc과 생성자 인라인 주석 양쪽에 중복 기재
  - 위치: `continuation/continuation-execution.processor.ts` — 클래스 수준 JSDoc 추가 단락과 생성자 내부 인라인 주석 `// C-1 후속 ④ — retry_last_turn ...`
  - 상세: "엔진 delegator 제거, RetryTurnService 직접 호출"이라는 동일 맥락 설명이 두 곳에 반복된다. 향후 동작 변경 시 두 곳을 동시 갱신해야 하는 부담이 생긴다.
  - 제안: 클래스 수준 JSDoc에만 "왜 RetryTurnService를 직접 주입하는가"를 기술하고, 생성자 인라인 주석은 참조 또는 한 줄로 축약한다.

- **[INFO]** `websocket.gateway.ts`에서 `forwardRef(() => RetryTurnService)`가 필요한 모듈 순환 경로가 주석에 명시되지 않음
  - 위치: `websocket.gateway.ts` — `@Inject(forwardRef(() => RetryTurnService))` 주입 선언 앞 주석
  - 상세: 주석에 "engine→Retry 순환 DI 제거" 목적은 기재됐으나, gateway→RetryTurnService 경로에서 `forwardRef`가 실제로 필요한 모듈 순환 구조(WebsocketModule ↔ ExecutionEngineModule)가 설명되지 않았다. 독자가 이 `forwardRef` 없이 무엇이 깨지는지 알 수 없다.
  - 제안: "WebsocketModule ↔ ExecutionEngineModule circular module import 때문"을 주석 한 문장으로 추가한다.

---

## 요약

이번 변경은 단일 `EngineDriver` 인터페이스를 `CoreEngineDriver` / `InteractionEngineDriver` / `ReentryStateDriver` / `AiTurnEngineDriver` / `RetryEngineDriver` / `EngineDriver`(합집합)로 ISP 분해하고, engine→Retry 역방향 DI를 제거해 단방향 의존으로 정리한 리팩터링이다. 변경 범위(17파일)에 비해 각 파일의 수정량은 대부분 타입 alias 교체와 주석 갱신에 집중되어 있어 로직 변경은 최소화됐다. 네이밍은 소비자의 역할을 명확히 나타내며(`AiTurnEngineDriver`, `InteractionEngineDriver`, `RetryEngineDriver`), 인터페이스 계층 구조도 직관적이다. 발견된 사항은 모두 INFO 수준이며, 주석 중복·JSDoc 불완전·forwardRef 사유 불명 등 문서화 밀도 문제에 해당한다. 이 수준의 이슈는 동작에 영향을 주지 않으며 단기 유지보수성에도 큰 위험이 없다. 함수 길이, 중첩 깊이, 매직 넘버, 코드 복잡도 측면에서 이 변경이 새로 도입한 문제는 없다.

---

## 위험도

NONE
