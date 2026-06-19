# 요구사항(Requirement) 리뷰 결과

리뷰 대상: C-1 후속 ④ — EngineDriver ISP 분할 + engine→Retry 단방향 DI 정리
(파일 17종 + 일관성 검토 보조 파일 6종)

---

## 발견사항

### [INFO] [SPEC-DRIFT] spec §Rationale C-1 "엔진 잔류" 기술이 구현과 상이
- 위치: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` 라인 1463–1464
- 상세: spec 라인 1463은 `applyRetryLastTurn`을 "실체=RetryTurnService; **엔진은 thin forwarding delegator 진입점만 잔류**"로 기술하고, 라인 1464는 **엔진 잔류** 항목에 "`retryLastTurn`·`applyRetryLastTurn` thin delegator"를 명시한다. 그러나 이번 변경(파일 11, `execution-engine.service.ts`)은 두 thin delegator 메서드를 엔진에서 완전히 제거하고, WS gateway(`websocket.gateway.ts`)와 `ContinuationExecutionProcessor`가 `RetryTurnService`를 직접 호출하도록 재배선한다. 이는 코드 버그가 아니라 `plan/in-progress/refactor/c1-engine-split.md` 라인 145–147에 명시된 백로그 항목("엔진→서비스 주입 방향 제거(caller-side 전환)")의 의도적 구현이다. engine→Retry 역방향 forwardRef 순환 DI를 제거하는 합리적·의도적 개선이므로 코드를 되돌리는 것이 오답이다.
- 제안: 코드 유지. spec 갱신 대상 — `spec/5-system/4-execution-engine.md` §Rationale C-1 라인 1463: "엔진은 thin forwarding delegator 진입점만 잔류" 삭제 또는 "후속 ④에서 delegator 제거 — WS gateway·continuation processor 가 RetryTurnService 직접 호출"로 교체. 라인 1464: **엔진 잔류** 목록에서 `retryLastTurn`·`applyRetryLastTurn` thin delegator 항목 제거.

### [INFO] [SPEC-DRIFT] spec §Rationale C-1의 단일 `EngineDriver` 계약 기술이 ISP 분할 후 구현과 상이
- 위치: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` 라인 1465, 193
- 상세: spec 라인 1465는 `EngineDriver`(token `ENGINE_DRIVER`, `useExisting: ExecutionEngineService`)를 단일 계약으로 기술한다. 이번 변경(파일 7, `engine-driver.interface.ts`)은 단일 `EngineDriver`를 `CoreEngineDriver` / `InteractionEngineDriver` / `ReentryStateDriver` / `AiTurnEngineDriver` / `RetryEngineDriver` 5개 부분 인터페이스로 분해하고 `EngineDriver`는 `AiTurnEngineDriver & RetryEngineDriver` 합집합 alias로만 잔류시킨다. 런타임 바인딩은 불변이며 컴파일 타임 가시성만 좁히는 합리적 ISP 적용이다. spec 라인 193의 "엔진이 in-process `EngineDriver`로 협력 서비스에 위임" 기술도 단일 계약 가정에서 서술된다.
- 제안: 코드 유지. 구현 완료 후 spec 갱신 대상 — `spec/5-system/4-execution-engine.md` §Rationale C-1 라인 1465: `EngineDriver` 단일 계약 기술에 ISP 분할 사실 및 각 소비자별 부분 인터페이스 이름(`AiTurnEngineDriver` / `InteractionEngineDriver` / `RetryEngineDriver`) 추가. 라인 193: "엔진이 in-process `EngineDriver`" 기술을 "소비자별 ISP slice(`AiTurnEngineDriver`/`InteractionEngineDriver`/`RetryEngineDriver`)"로 보강.

### [INFO] `FormInteractionService` / `ButtonInteractionService` 테스트 mock에 `applyPortSelection` 포함 — ISP 인터페이스 범위 초과
- 위치: `form-interaction.service.spec.ts` (파일 12), `button-interaction.service.spec.ts` (파일 3) — `mockDriver` 객체의 `applyPortSelection: jest.fn()` 항목
- 상세: `InteractionEngineDriver`는 `CoreEngineDriver`(`updateExecutionStatus`, `contextKeyOf`) + `stageDurableResumeSnapshot`만 포함하며, `applyPortSelection`은 `AiTurnEngineDriver`에만 존재한다. 두 서비스의 실제 구현체도 `driver.applyPortSelection()`를 호출하지 않는다. `as unknown as jest.Mocked<InteractionEngineDriver>` 캐스트로 런타임 오류는 없으나, ISP 설계 의도상 여분 mock 항목이다.
- 제안: 두 spec 파일의 `mockDriver` 객체에서 `applyPortSelection: jest.fn()` 제거. 차단 이슈 아님 — 별도 후속 허용.

### [INFO] `WebsocketGateway`의 `RetryTurnService` 주입에 `@Inject(forwardRef(...))` 추가 — 필요성 검증 권고
- 위치: `websocket.gateway.ts` (파일 17) `@Inject(forwardRef(() => RetryTurnService))`
- 상세: `RetryTurnService`는 `ENGINE_DRIVER(=엔진)`만 주입받으므로 WS 게이트웨이↔RetryTurnService 간 직접 순환이 없다. `ExecutionEngineModule`이 `RetryTurnService`를 export하고 `WebsocketModule`이 이 모듈을 import한다면 단방향 의존이며 `forwardRef` 없이도 NestJS가 해소 가능하다. 코드 주석은 "ws.service↔gateway↔event-emitter ES-module 순환이 더 짧은 경로로 노출됐다"며 이 `forwardRef`를 방어적 안전장치로 설명한다. 동작 불변이며 불필요한 `forwardRef`여도 오류는 없다.
- 제안: 단방향 의존 확인 후 `forwardRef` 제거 가능 여부를 검증. 모듈 로드 오류 없이 동작하면 단순 파라미터로 교체. 차단 이슈 아님.

---

## 요약

이번 변경(C-1 후속 ④)은 단일 12-멤버 `EngineDriver` 인터페이스를 소비자별 ISP 부분 인터페이스(`CoreEngineDriver` / `InteractionEngineDriver` / `ReentryStateDriver` / `AiTurnEngineDriver` / `RetryEngineDriver`)로 분해하고, engine→Retry 역방향 forwardRef 순환 DI를 제거해 `RetryTurnService`를 외부 진입점(WS gateway·continuation processor)이 직접 호출하도록 재배선한다. 모든 변경은 런타임 동작을 보존하며(토큰 `ENGINE_DRIVER`의 `useExisting: ExecutionEngineService` 바인딩 불변), 테스트 커버리지도 신규 라우팅에 맞게 일관되게 갱신됐다. 기능 완전성·엣지케이스(`retry_last_turn` bypasses isNodeExecutionWaiting guard 정확히 명시)·에러 시나리오(`RETRY_STATE_NOT_FOUND`/`NODE_NOT_RETRYABLE`/`RETRY_TOO_EARLY` 모두 테스트 커버)·비즈니스 로직 모두 요구사항을 충족한다. spec과의 불일치는 2건이며, 둘 다 코드가 의도적·합리적으로 개선한 결과 spec 본문이 낡은 SPEC-DRIFT 케이스로, 코드 되돌리기가 아니라 spec 갱신이 해결책이다(`spec/5-system/4-execution-engine.md §Rationale C-1` 라인 1463–1465 및 라인 193 대상). CRITICAL/WARNING 발견사항 없음.

---

## 위험도

LOW
