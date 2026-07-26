# 테스트(Testing) 리뷰 — ie-resume-turn-boundary-cancel

## 발견사항

- **[WARNING]** `assertLinkedTransitionApplied` 소비처 4곳 중 2곳(첫 turn park / retry-last-turn RUNNING 재claim)은 `ExecutionCancelledError` 인스턴스만 검증하고 `phase` 문자열까지는 확인하지 않는다 — 나머지 2곳(re-park / RUNNING 유지 분기)은 `.rejects.toThrow(/cancelled during .../)` 로 phase 문자열까지 고정한다.
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts` (실제 파일 줄번호, Read/Grep 확인) — 313행 `it('park 이 선점당하면(false) ...')`, 376행 `it('RUNNING 재claim 이 선점당하면(false) ...')`. 대조군(phase 확인 포함): 210행 `/cancelled during AI turn — re-park/`, 532행 `/cancelled during AI turn 종료 처리\(RUNNING 유지\)/`.
  - 상세: `assertLinkedTransitionApplied`의 4개 호출부는 각각 다른 `phase` 문자열(`'AI turn — re-park'` / `'첫 AI turn park'` / `'AI turn 종료 처리(RUNNING 유지)'` / `'AI turn 종료 처리(RUNNING 재claim)'`)을 넘긴다. `toBeInstanceOf(ExecutionCancelledError)` 만으로는 이 두 branch의 phase 문자열이 서로 뒤바뀌거나(mutation) 잘못된 상수를 참조해도 테스트가 GREEN 을 유지한다 — 즉 이 두 호출 지점에서는 "어느 분기에서 취소됐는지" 라는 진단 정보의 회귀를 잡지 못한다.
  - 참고: 이 갭은 이미 3차 라운드 ai-review WARNING #8 로 식별돼 "4곳 중 최소 2곳 충족" 으로 의도적으로 부분 반영된 상태다(`review/code/2026/07/26/22_11_22/RESOLUTION.md` 참조). 새 결함이 아니라 잔여 항목이지만, 완결성 관점에서 남은 2곳도 동일한 `rejects.toThrow(/cancelled during .../)` 패턴을 추가할 것을 재확인 권고한다.
  - 제안: 313행·376행 테스트에 `await expect(promise).rejects.toThrow(/cancelled during 첫 AI turn park/)` 및 `/cancelled during AI turn 종료 처리\(RUNNING 재claim\)/` 단언을 추가.

- **[INFO]** `NON_TERMINAL_STATUSES_SQL`(execution-engine.service.ts:507-512, `ExecutionStatus` 값에서 `TERMINAL_STATUSES` 를 제외해 만드는 SQL 리터럴)는 별도 단위 테스트 없이, `linkedNodeExec` 짝 전이·`assertActiveExecutionAndSaveNodeExec` 두 describe 블록의 정규식 단언(`/status IN \('pending', 'running', 'waiting_for_input'\)/`)으로만 간접 검증된다. enum 파생 값이라 위험은 낮지만, `ExecutionStatus` 에 새 값이 추가되고 `TERMINAL_STATUSES`/이 필드 중 하나만 갱신되는 경우를 즉시 잡아낼 전용 케이스는 없다.

- **[INFO]** 새로 추가된 FOR UPDATE 가드(짝 전이 분기, `assertActiveExecutionAndSaveNodeExec`)의 "동시 두 트랜잭션이 실제로 행 잠금을 두고 경합"하는 시나리오는 unit(mock `manager.query`)·e2e(순차적 HTTP 호출: Stop 이 지연 응답보다 먼저 커밋되도록 설계된 결정적 순서) 어느 쪽도 진짜 동시 레이스로 재현하지 않는다. 발견된 실결함(stale in-memory 엔티티에 의한 lost update)은 정확히 재현하지만, `FOR UPDATE` 락 자체가 실제 Postgres 동시성 하에서 두 번째 트랜잭션을 올바르게 차단하는지는 Postgres 의미론에 대한 신뢰에 의존한다. 이 종류의 변경에서 흔한 트레이드오프이며 즉시 조치가 필요한 수준은 아니다.

## 확인된 양호 사항 (근거 포함)

- 4개 소비처(re-park·첫 turn park·retry-last-turn RUNNING 재claim·`finalizeAiNode` RUNNING 유지 분기) 전부 "적용됨(true)"/"선점당함(false)" 양쪽을 대조 테스트로 짝지어 뒀다 — 부정 단언만 있는 vacuous 테스트가 없다(예: `driver.markNodeCancelled).not.toHaveBeenCalled()` 를 반드시 대조군에서 확인).
- mutation 사각지대를 스스로 찾아 메운 흔적이 있다 — `assertLinkedTransitionApplied`의 `nodeExec === null` 분기(`if (nodeExec)` 가드 제거해도 안 잡히던 사각지대)를 위해 re-park 경로에 `nodeExec=null` 전용 케이스를 별도 추가함(주석에 "3개 테스트 스위트 어디에서도 실행되지 않아" 라고 근거 명시).
- 테스트 격리: `ai-turn-orchestrator.service.spec.ts`는 `beforeEach` 에서 `makeMockDriver()`(신선한 jest.fn 세트)를 매번 재생성하고 `afterEach(() => jest.restoreAllMocks())` 로 spy 잔존을 방지한다. `execution-engine.service.spec.ts`도 `mockTxManagerQuery` 를 `beforeEach` 안에서 재생성해 `mockResolvedValueOnce` 가 테스트 간 누출되지 않는다.
- e2e(`execution-park-resume.e2e-spec.ts`)는 고정 `setTimeout` 대신 실측 가능한 상태 전이를 폴링하는 기존 컨벤션을 그대로 따른다(`pollNodeExecutionTerminal` 신규 헬퍼, timeout 시 명시적 에러로 무한 대기 방지) — CI 부하로 인한 flake 가능성을 낮춘다. 핵심 회귀 단언(`finished_at` 불변, `node_execution.status==='cancelled'`, 즉 되살아나지 않음)이 실제 버그 시나리오와 정확히 대응한다.
- `stub.client.spec.ts`의 상한(cap) 테스트는 `jest.useFakeTimers()`를 `try/finally` 로 감싸 단언 실패 시에도 실제 타이머로 복원되도록 해, 후속 테스트로의 오염을 방지한다. 지연 테스트(`elapsed >= 25`)는 하한만 확인해 CI 슬로우다운에 강인하고, 실제 버그(지연이 걸리지 않음)만 잡도록 설계됐다.
- `524건`의 관련 unit 테스트(ai-turn-orchestrator/execution-engine/stub.client 3개 spec, `jest ai-turn-orchestrator.service.spec.ts execution-engine.service.spec.ts stub.client.spec.ts` 직접 실행 확인) 전부 GREEN — `.only`/`.skip`/`xit`/`xdescribe` 오용 없음.
- `updateExecutionStatus` 시그니처 변경(`Promise<void>` → `Promise<boolean>`)에 맞춰 기존 테스트의 타입 단언을 함께 교정한 것도 확인됨 — "옛 선언이 `expect(applied).toBe(...)` 를 `void` 대상으로 만들어 무의미했다" 는 주석으로 스스로 문제를 진단하고 고침.

## 요약

이번 변경은 이미 3차례의 `/ai-review` 라운드를 거치며 테스트 커버리지를 적극적으로 보강한 상태다 — 4개 취소-가드 소비처 전부에 true/false 대조 테스트, mutation 사각지대(널 nodeExec) 전용 케이스, e2e 폴링 전환, fake timer 격리까지 갖췄고 전체 unit 실행도 GREEN 이다. 남은 갭은 실질적으로 하나뿐이다: `assertLinkedTransitionApplied`의 4개 호출부 중 2곳이 아직 phase 문자열 회귀 단언을 갖추지 못했는데, 이는 이미 팀이 스스로 식별해 "부분 반영" 으로 기록해 둔 잔여 항목이다. 그 외 SQL 상수 간접검증·실 동시성 미재현은 이 규모 변경에서 통상적인 수준의 잔여 리스크로, 즉시 차단 사유는 아니다.

## 위험도

LOW
