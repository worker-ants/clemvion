# 요구사항(Requirement) 리뷰 결과

리뷰 대상: C-1 후속 ④ — EngineDriver ISP 부분인터페이스 분할 + engine→Retry 순환 DI 제거

---

## 발견사항

### [INFO] [SPEC-DRIFT] spec §Rationale C-1 "엔진 잔류" 항목이 thin delegator 패턴을 기술하나 코드는 이를 제거

- 위치: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` §Rationale C-1 line 1464
- 상세: spec line 1464 는 "**엔진 잔류**: registry(resume-turn-dispatch)·dispatch-loop·**외부 진입점(retryLastTurn·applyRetryLastTurn thin delegator)**·EngineDriver 멤버" 라고 명시한다. 그러나 본 변경은:
  - `execution-engine.service.ts` 에서 `retryLastTurn`·`applyRetryLastTurn` thin delegator 를 완전 제거.
  - `websocket.gateway.ts` 가 `ExecutionEngineService.retryLastTurn` 대신 `RetryTurnService.retryLastTurn` 을 직접 호출.
  - `continuation-execution.processor.ts` 가 `ExecutionEngineService.applyRetryLastTurn` 대신 `RetryTurnService.applyRetryLastTurn` 을 직접 호출.

  이 변경은 의도적 아키텍처 개선이다 — plan c1-engine-split.md L131 에서 "후속 ④ forwardRef 순환 DI 제거(고위험·단독·e2e 필수)" 로 명시했고, 코드 주석도 "engine→Retry 역방향 주입 제거(engine→Retry 순환 DI 해소)" 와 "외부 진입점은 RetryTurnService 를 직접 호출(아래 exports)" 라고 일관되게 설명한다. thin delegator 제거는 strangler-fig 의 최종 정리이며, 되돌리는 것이 오답이다.

  spec line 1464 의 "외부 진입점(retryLastTurn·applyRetryLastTurn thin delegator)" 기술은 이제 구현과 일치하지 않는다. 코드가 아니라 **spec 이 낡았다**.

- 제안: 코드 유지. spec 갱신 — `spec/5-system/4-execution-engine.md §Rationale C-1` (line 1463~1464) 의 "엔진 잔류" 설명에서 retryLastTurn·applyRetryLastTurn thin delegator 항목을 제거하고, 외부 진입점(websocket.gateway, continuation processor)이 RetryTurnService 를 직접 호출한다는 내용으로 갱신. 갱신 대상 스코프: project-planner.

---

### [INFO] EngineDriver ISP 분할 결과가 spec 에 미반영 (구현 완료 후 정상 선행 상태)

- 위치: `spec/5-system/4-execution-engine.md §Rationale C-1` line 1465 ("엔진 내부 통신 = EngineDriver")
- 상세: spec 은 단일 EngineDriver 계약으로 기술하고 있으나, 코드는 CoreEngineDriver / InteractionEngineDriver / ReentryStateDriver / AiTurnEngineDriver / RetryEngineDriver / EngineDriver(합집합) 로 ISP 분할됐다. 일관성 검토(cross_spec.md INFO-3, consistency SUMMARY INFO-3)에서도 "구현 착수 전 정상 선행 상태" 로 확인된 항목이다. 구현이 완료된 현 시점에서는 spec 갱신 후속이 필요하다.
- 제안: 코드 유지. `spec/5-system/4-execution-engine.md §Rationale C-1` 에 ISP 분할 결과(5개 부분인터페이스 계층·각 소비자 매핑) 반영 — project-planner.

---

### [INFO] ExecutionEngineModule exports 에 RetryTurnService 추가 — 기능 완전성 확인

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts` exports 배열
- 상세: RetryTurnService 를 exports 에 추가해 WebsocketModule / ContinuationExecutionProcessor 가 직접 주입받을 수 있도록 했다. websocket.gateway.ts 의 @Inject(forwardRef(() => RetryTurnService)) 주입과 continuation-execution.processor.ts 의 직접 생성자 주입이 모두 일관되게 이 export 에 의존한다. 기능적으로 완전하다.
- 제안: 없음.

---

### [INFO] forwardRef 를 WebsocketGateway 에 추가 및 ExecutionEventEmitter 에 적용

- 위치: `websocket.gateway.ts` / `events/execution-event-emitter.service.ts`
- 상세: 코드 주석에서 "ws.service↔gateway↔event-emitter ES-module 순환이 더 짧은 경로로 노출됐다. forwardRef 로 주입을 지연 해석해 데코레이터 메타데이터 eval 순서와 무관하게 견고화한다(동작 불변)" 라고 의도를 명시한다. 동작 불변, 순환 해소 목적으로 합리적이다.
- 제안: 없음.

---

### [INFO] 테스트 커버리지 — retry_last_turn dispatch 경로가 RetryTurnService 에서 호출되는지 검증 완료

- 위치: `continuation-execution.processor.spec.ts` / `execution-engine.service.spec.ts` / `websocket.gateway.spec.ts`
- 상세:
  - continuation-execution.processor.spec.ts — retry_last_turn dispatch 3개 케이스(payload.spawnedNodeExecutionId 사용, fallback to job.nodeExecutionId, isNodeExecutionWaiting bypass)가 retry.applyRetryLastTurn 대상으로 전환됐다.
  - execution-engine.service.spec.ts — 14개 applyRetryLastTurn 호출이 전부 retryTurnService.applyRetryLastTurn 으로 전환됐다. 실 인스턴스(module.get(RetryTurnService))를 사용하므로 엔진 내부 협력(ENGINE_DRIVER via 엔진)이 그대로 exercise 된다.
  - websocket.gateway.spec.ts — retryLastTurn 호출과 에러 케이스(RETRY_STATE_NOT_FOUND / NODE_NOT_RETRYABLE / RETRY_TOO_EARLY / InvalidExecutionStateError)가 모두 mockRetry.retryLastTurn 대상으로 전환됐다.
  - 누락된 엣지 케이스 없음.
- 제안: 없음.

---

### [INFO] node_modules symlink 변경 — 리뷰 대상 외

- 위치: diff 파일 14 (node_modules symlink)
- 상세: worktree 환경 준비 아티팩트이며 기능 리뷰 범위 외다.
- 제안: 없음.

---

## 요약

본 변경(C-1 후속 ④)은 EngineDriver 인터페이스를 소비자별 최소 부분인터페이스(ISP)로 분해하고, engine→RetryTurnService 역방향 forwardRef 순환 DI 를 제거해 외부 진입점(WebsocketGateway, ContinuationExecutionProcessor)이 RetryTurnService 를 직접 호출하도록 재배선한 아키텍처 정리다. 구현은 의도한 기능을 완전히 구현하며, 엣지 케이스(isNodeExecutionWaiting bypass, payload fallback, 에러 코드 전파)도 테스트로 검증된다. TODO/FIXME 없음. 유일한 spec fidelity 이슈는 spec/5-system/4-execution-engine.md §Rationale C-1 line 1464 가 thin delegator 잔류를 기술하는 반면 코드는 이를 의도적으로 제거한 SPEC-DRIFT 다 — 코드가 옳고 spec 이 낡았다. 요구사항 충족 관점에서 차단 이슈는 없다.

---

## 위험도

NONE
