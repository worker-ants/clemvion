STATUS: OK

### 발견사항
(없음)

target 은 `ExecutionEngineService` 의 두 FAILED 종결 경로(초기 세그먼트 `runExecution` catch, 재개 세그먼트 `finalizeResumedExecutionOutcome`)가 near-identical 블록을 각자 유지하던 것을 `finalizeFailedExecution` 사설 헬퍼로 통합하고, 재개 경로가 status 마킹·DB save·`EXECUTION_FAILED` WS emit·`execution_failed` dispatch 를 빠짐없이 수행하는지 검증하는 회귀 가드 unit 을 추가했다. Rationale 연속성 관점에서 점검한 결과:

1. **기각된 대안의 재도입 없음** — 이 리팩터는 과거 Rationale 에서 명시적으로 기각된 설계(예: `WFI→running→failed` 2단계 전이, `waiting_for_retry` 신설(R2), 암호화 기반 `_resumeState` 영속 등)를 재도입하지 않는다. 단순 중복 코드 통합(behavior-preserving)이며 상태 전이표(`ALLOWED_TRANSITIONS`)나 원자성 계약을 건드리지 않는다.

2. **합의된 원칙과 정합** — `spec/5-system/4-execution-engine.md §4.4` (표, PR #841 각주)는 "`ExecutionEngineService → NotificationsService` 의 런타임 지연 해석 미해소 시 `execution_failed` dispatch 가 조용히 no-op 된다"는 버그를 이미 문서화하고 있고, `spec/data-flow/8-notifications.md` 의 `execution_failed` 행("초기 세그먼트 및 재개 세그먼트 양쪽에서 발사해야 누락이 없다")이 두 경로 모두에서의 dispatch 를 명시적으로 요구한다. target 의 공유 헬퍼는 이 요구를 구조적으로 강제하는 방향이며 원칙에 반하지 않는다.

3. **결정 번복 아님, 코드 정리** — 이 변경은 과거 결정을 뒤집는 것이 아니라 두 코드 경로의 drift(한쪽만 갱신되는 재발 패턴)를 없애는 리팩터다. 새 Rationale 이 diff 내 주석("근거: 두 종결 경로가 near-identical 블록을 각자 보유해 PR #841 에서 재개 경로에만 dispatch 가 누락되던 버그가 있었다")으로 함께 기록되어 있어 무근거 번복에 해당하지 않는다. 다만 이 근거가 코드 주석에만 있고 spec 문서의 `## Rationale` 절에는 별도 항목으로 반영되지 않았다 — spec 은 "구현 재량 영역"(C-1 strangler-fig 선례: "메서드 물리 위치는 spec 이 정의하지 않는 구현 재량 영역")과 일치하는 순수 내부 리팩터이므로 spec 갱신 불요로 판단된다(INFO 수준의 관찰이며 CRITICAL/WARNING 대상 아님).

4. **암묵적 가정 충돌 없음** — `dispatchExecutionFailedNotification` 자체는 변경되지 않았다(best-effort try/catch, `!parentExecutionId` 게이트, owner+executedBy dedup 수신자 모두 유지 확인). `§1.4` sentinel error code 보존, `finishedAt`/`durationMs` 계산, stack 미저장(보안) 등 기존 invariant 도 헬퍼 내부에 그대로 이전되어 있다.

### 요약
target 변경(`finalizeFailedExecution` 공유 헬퍼 추출 + 회귀 가드 테스트)은 `spec/5-system/4-execution-engine.md §4.4` 와 `spec/data-flow/8-notifications.md` §1.1 이 이미 문서화한 "PR #841 재개 경로 dispatch 누락" 버그를 구조적으로 재발 방지하는 방향의 순수 behavior-preserving 리팩터다. 과거 Rationale 에서 기각된 대안을 재도입하지 않고, 합의된 원칙(단일 sink 정책·원자성·best-effort dispatch 계약)을 그대로 보존하며, C-1 strangler-fig 선례("메서드 물리 위치는 spec 재량")와도 부합한다. Rationale 연속성 관점에서 문제 없음.

### 위험도
NONE
