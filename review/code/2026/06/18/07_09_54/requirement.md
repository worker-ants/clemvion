# 요구사항(Requirement) 리뷰 — C-1 step4 RetryTurnService 추출

## 발견사항

### [INFO] spec fidelity — C-1 step4 리팩토링은 spec 정의 행동 영역 외부
- 위치: 전체 변경
- 상세: spec/5-system/4-execution-engine.md §1.3, spec/5-system/6-websocket-protocol.md §4.2, spec/4-nodes/3-ai/1-ai-agent.md §7.9 가 retry_last_turn 의 행동을 정의한다. 이번 변경은 순수 아키텍처 재구성(god-class 분해)이며, 외부 행동 계약(에러 코드·검증 순서·atomic consume·TTL 정책·continuation bus handoff·downstream graph 진행)은 모두 보존됐다. spec 이 architecture 내부(서비스 명칭·클래스 경계)를 언급하지 않으므로 spec 위반 없음.
- 제안: 없음 (spec fidelity 충족).

### [INFO] applyRetryLastTurn 통합 테스트가 엔진 spec 에 잔류
- 위치: retry-turn.service.spec.ts 주석 (lines 1554-1557)
- 상세: `applyRetryLastTurn`·`resumeGraphAfterRetry` 의 deep-integration 테스트는 엔진 thin delegator 경유로 `execution-engine.service.spec.ts` 에 잔류하는 것이 의도적 결정임을 주석이 명시하고 있다 (mock-heavy 이관 시 테스트 의미 소실). 이는 기능 커버리지 결함이 아니라 의도된 전략이다.
- 제안: 없음.

### [INFO] retryLastTurn 단위 테스트 하니스 — `dataSource` per-test override 방식
- 위치: retry-turn.service.spec.ts의 `installRetryMocks` 함수 (line 1667)
- 상세: `(service as unknown as { dataSource: unknown }).dataSource = { ... }` 로 private 필드를 직접 재할당하는 방식을 사용한다. TypeScript 타입 안전성을 우회하지만, `retryLastTurn` 이 `this.dataSource.transaction(...)` 을 호출하는 구조에서 NestJS DI 없이 단순 생성자 주입으로 인스턴스를 만들 때 per-test override 하기 위한 실용적 접근이다. 기능상 결함 없음.
- 제안: 없음 (허용 가능한 테스트 패턴).

### [WARNING] applyRetryLastTurn 에서 PARK_RELEASED 시 finally 의 contextService.deleteContext 호출
- 위치: retry-turn.service.ts lines 2526-2540 (applyRetryLastTurn try/finally 블록)
- 상세: `turnSignal === PARK_RELEASED` 분기에서 `return;` 하면 `finally` 블록이 실행되어 `contextService.deleteContext(executionId)` 가 호출된다. 그러나 PARK_RELEASED 는 "대화 계속 — re-park 됨 (Execution WAITING)" 상태로, 다음 turn 이 §7.5 rehydration 으로 재개될 때까지 context 를 살려 두어야 한다. context 를 삭제하면 다음 turn 이 동일 인스턴스에서 재개될 때 in-memory context 재사용이 불가능해 DB rehydrate 경로를 강제하게 된다. 이는 기능 오류가 아니다 — spec 은 rehydrate 경로가 항상 동작해야 함을 정의하며, 코드의 주석도 "다음 turn 은 §7.5 rehydration 으로 재개" 라고 명시한다. 그러나 동일 인스턴스에서 곧바로 다음 turn 이 도착할 경우 in-memory context hit 를 기대하는 성능 경로가 손상된다. 원본 `applyRetryLastTurn` (god-class 시절)도 동일한 finally 구조였으므로 verbatim 이전된 기존 행위다.
- 제안: 이 행위는 verbatim 이전이므로 본 PR 에서 변경 불필요. 단 PARK_RELEASED 분기에서 context 보존이 필요한지에 대한 별도 검토 후속 이슈로 추적 권장.

### [INFO] [SPEC-DRIFT] ExecutionCancelledError 이동 — spec 미언급
- 위치: workflow-errors.ts lines 2885-2896, execution-engine.service.ts diff (class 제거)
- 상세: `ExecutionCancelledError` 가 god-class 인라인 정의에서 `workflow-errors.ts` leaf 로 이동했다. 이는 engine↔retry value cross-import 순환 방지를 위한 합리적 결정이며 외부 계약 변경 없음. spec 은 이 클래스의 위치를 언급하지 않으므로 spec 위반이 아니다. 단 해당 클래스가 이제 `ExecutionError` 계층(exported) 이 아닌 `Error` 를 직접 extends 하는 plain sentinel 로 `workflow-errors.ts` 에 공개 export 됨. spec 문서 어디에도 이 클래스의 소속·export 범위를 명시하지 않으므로 spec-drift 로 분류 — spec 이 낡은 것이 아니라 단순 spec 침묵 영역이다.
- 제안: spec 반영 불필요 (spec 이 구현 파일 수준 class 위치를 정의하지 않음). INFO 수준 유지.

### [INFO] EngineDriver 인터페이스 +5 멤버 — 인터페이스 surface 확대
- 위치: engine-driver.interface.ts lines 87-125 (5개 메서드 추가)
- 상세: `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache` 5개 메서드가 `EngineDriver` 인터페이스에 추가됐다. 기존 메서드들은 모두 `public` 으로 공개됐다. 이는 ISP(인터페이스 분리 원칙) 관점에서 `RetryTurnService` 외 다른 소비자가 `EngineDriver` 를 주입받을 경우 필요하지 않은 메서드에 노출된다는 점이 있다. 그러나 plan 문서(c1-engine-split.md §후속 고려)에서 "체인 종료 시 EngineDriver ISP 소비자별 부분 인터페이스" 로 후속 처리 예정임이 명시돼 있다. 현 시점 기능적 문제 없음.
- 제안: 없음 (계획된 후속 리팩토링 대상).

### [INFO] spec fidelity — 검증 순서 일치
- 위치: retry-turn.service.ts lines 2248-2313 (retryLastTurn 검증 로직)
- 상세: spec/5-system/6-websocket-protocol.md §4.2 의 검증 순서와 코드 구현의 일치 여부를 점검했다. spec §4.2 에러 코드 표는 `INVALID_EXECUTION_STATE` (lookup 실패/소속 불일치/비 FAILED 상태), `NODE_NOT_RETRYABLE`, `RETRY_STATE_NOT_FOUND` (부재/만료), `RETRY_TOO_EARLY` 를 정의한다. 코드의 검증 순서: (1) lookup + 소속 → INVALID_EXECUTION_STATE, (2) 비 FAILED → INVALID_EXECUTION_STATE, (3) retryable !== true → NODE_NOT_RETRYABLE, (4) _retryState 부재/TTL 만료 → RETRY_STATE_NOT_FOUND, (5) retryAfterSec 미경과 → RETRY_TOO_EARLY, (6) atomic consume + spawn. spec 정의와 순서 일치. 에러 코드도 `ErrorCode` enum 에서 파생돼 일치.
- 제안: 없음.

### [INFO] spec fidelity — atomic consume JSONB 연산
- 위치: retry-turn.service.ts lines 2321-2349
- 상세: spec/5-system/6-websocket-protocol.md §4.2 "단일 소비 (atomic consume)" 조항 — "동일 트랜잭션 안에서 `_retryState` 키를 제거(JSONB `-` 연산, null-set) 하면서 새 NodeExecution row 를 spawn". 코드는 `output_data - '_retryState'` + `jsonb_exists` guard 로 구현. affected=1 확인 후 spawn, affected=0 시 RETRY_STATE_NOT_FOUND — spec 계약 완전 충족.
- 제안: 없음.

### [INFO] spec fidelity — downstream graph 진행 (§7.9 + §12.8)
- 위치: retry-turn.service.ts lines 2534, 2613-2747 (resumeGraphAfterRetry)
- 상세: spec/4-nodes/3-ai/1-ai-agent.md §12.8 "retry_last_turn 성공 후 downstream graph 진행" — 재진입 성공 시 일반 COMPLETED 와 동일하게 downstream 노드로 그래프 진행. spec/5-system/6-websocket-protocol.md §4.2 "재진입 종결 후 graph 진행" 조항과 일치. `resumeGraphAfterRetry` 가 `loadAndBuildGraph` → reachability seed → `runNodeDispatchLoop` → COMPLETED finalize 를 수행. 자연 종결(parked=false)이면 `updateExecutionStatus(COMPLETED)` + `EXECUTION_COMPLETED` 이벤트 emit. parked=true 면 WAITING 유지 후 return. spec 완전 충족.
- 제안: 없음.

### [INFO] spec fidelity — continuation bus handoff
- 위치: retry-turn.service.ts lines 2351-2364 (retryLastTurn 마지막 부분)
- 상세: spec §4.2 "Continuation Bus 경유 (worker handoff)" — "검증·atomic consume·새 row spawn 후 continuation 큐에 job publish 해 worker 로 handoff". `retryLastTurn` 은 spawn 후 `spawnedNodeExecutionId` 를 반환하며 publish 하지 않는다. publish 는 caller(WS gateway, `websocket.gateway.ts` line 806)가 `publishRetryLastTurn` 으로 수행한다. 코드 주석도 이를 명시. spec 계약상 "caller 가 publish" 구조이며 WS gateway 구현과 일치.
- 제안: 없음.

---

## 요약

이번 변경은 `ExecutionEngineService` god-class 에서 `retry_last_turn` 생명주기를 `RetryTurnService` 로 추출하는 순수 아키텍처 리팩토링이다. spec 이 정의하는 외부 행동 계약(에러 코드·검증 순서·JSONB atomic consume·TTL 정책·continuation bus handoff·downstream graph 진행·상태 전이)은 verbatim 이전으로 모두 보존됐다. EngineDriver 인터페이스 +5 멤버 확장, ExecutionCancelledError leaf 이동, thin delegator 패턴은 모두 의도된 설계이며 spec 위반 없음. 테스트는 `retryLastTurn` 8건이 신설 spec 으로 이관됐고, `applyRetryLastTurn`·`resumeGraphAfterRetry` 통합 테스트는 엔진 spec 에 잔류하는 전략이 합리적으로 문서화돼 있다. 주의할 점으로 PARK_RELEASED 시 finally 블록의 `contextService.deleteContext` 호출이 in-memory context 를 삭제하는 동작이 있으나, 이는 verbatim 이전된 기존 행위이며 spec 은 rehydrate 경로의 항시 동작을 보장하므로 기능 결함은 아니다.

## 위험도

LOW
