### 발견사항

- **[WARNING]** 새 테스트에서 `add_node` 호출의 `PLAN_AWAITING_APPROVAL` 응답을 검증하지 않음
  - 위치: `spec.ts` — 새로 추가된 테스트 어서션 블록
  - 상세: 테스트는 `chatStream` 호출 횟수·`done` 이벤트·error 이벤트 부재만 확인한다. `propose_plan` 이후 LLM이 발사한 3개의 `add_node`가 실제로 `PLAN_AWAITING_APPROVAL` 오류를 받았는지는 검증하지 않아, 가드가 올바른 이유로 동작하는지(단순히 finishReason 덮어쓰기로만 우연히 통과하는지) 구별할 수 없다. 기존 `plan-only turn: finish always succeeds…` 테스트는 `expect(editToolEvent?.data.result.error).toBe('PLAN_AWAITING_APPROVAL')` 형태로 이를 검증한다.
  - 제안: `events.filter(e => e.event === 'tool_call' && e.data.name === 'add_node')` 로 3개를 확인하고, 각각의 `result.error === 'PLAN_AWAITING_APPROVAL'` 를 어서션에 추가

- **[WARNING]** `propose_plan`이 실행 턴 중간 라운드에서 발행되는 경우 미검증
  - 위치: `service.ts` `planProposedPendingApproval` 판정 로직
  - 상세: History에 approved plan이 있고 Round 1에서 `add_node`(tool_calls 종료) → Round 2에서 `propose_plan`만 emit하고 `finish` 없이 `tool_calls`로 종료되는 경우, 새 가드가 Round 3 진입을 막고 s2/s3가 미완인 채로 `finishReason='stop'`으로 종료된다. 이 동작이 의도적인지 여부가 테스트로 고정되어 있지 않아, 향후 가드 변경 시 의도치 않은 회귀가 발생할 수 있다.
  - 제안: "propose_plan-mid-execution: guard only blocks after plan is proposed in current turn, not from history plan" 시나리오 테스트 추가. 또는 memory 문서에 이 경우의 의도된 동작을 명시

- **[WARNING]** `finishResolved=true`일 때 가드의 `finishReason` 덮어쓰기가 중복 작동
  - 위치: `service.ts` L736–760 (계산 위치: `shouldContinueLoop` 직전)
  - 상세: `propose_plan` → `finish`(정상 통과)가 같은 라운드에 있으면 `finishResolved=true`, `finishReason='stop'` 이 이미 설정된다. 이 상태에서 `planProposedPendingApproval=true` 가드가 다시 `finishReason='stop'`을 쓰고, `shouldContinueLoop=false`를 만드는데, 전자는 이미 `false`(`finishReason !== 'tool_calls'`)라 redundant하다. 무해하지만 두 경로가 동일한 결과를 내는 이유가 명시되지 않아 향후 코드 독자가 혼란을 겪을 수 있다.
  - 제안: `if (planProposedPendingApproval && !finishResolved)` 로 조건을 좁히거나, 현재처럼 둘 경우 주석에 "finishResolved=true인 경우 redundant하지만 harmless"를 명시

- **[INFO]** 테스트 제목의 모델명이 mock 데이터와 미세하게 다름
  - 위치: 새 테스트 `it()` 첫 인자 vs mock `model: 'gemini-3-flash-preview'`
  - 상세: 테스트 제목은 `"Gemini-3-flash pattern"`이지만 mock은 `'gemini-3-flash-preview'`를 사용. 오보는 아니지만 `gemini-3-flash` vs `gemini-3-flash-preview` 의 혼용이 문서·memory·테스트 간 일관성을 낮춘다.
  - 제안: 테스트 제목을 `"(Gemini-3-flash-preview pattern)"` 으로 통일

- **[INFO]** `planForTurn.approvedAt`이 truthy한 경우에 대한 경로 미검증
  - 위치: `service.ts` `planProposedPendingApproval` 계산
  - 상세: `buildPlanFromArgs`는 `approvedAt`를 설정하지 않으므로 정상 경로에서는 이 조건이 항상 `false`다. 불변식으로 보장되어 있어 테스트 자체는 불필요하지만, 인터페이스(`AssistantPlanRecord`)가 `approvedAt`를 허용하므로 미래 변경 시 테스트 없이 로직이 깨질 수 있다.
  - 제안: 주석 한 줄로 `planForTurn.approvedAt`은 현재 턴에서 항상 falsy임을 명시하거나 단위 테스트에서 `buildPlanFromArgs` 결과에 `approvedAt`가 없음을 확인

---

### 요약

새로 추가된 테스트는 보고된 Gemini-3-flash 핑퐁 루프 버그를 직접적으로 재현하고 핵심 어서션(1-라운드 종료, `finishReason=stop`, 에러 없음)을 올바르게 검증한다. 구현 가드는 논리적으로 건전하고, 기존 플래닝 관련 테스트들도 호환성 경로(propose+finish, execute turn, re-plan)를 충분히 커버한다. 다만 새 테스트에서 `add_node` 호출들이 실제로 `PLAN_AWAITING_APPROVAL` 오류를 받았는지를 검증하지 않아 가드가 올바른 이유로 작동함을 테스트가 완전히 보장하지 못하는 점, 그리고 실행 턴 중간에 `propose_plan`이 발행되는 엣지 케이스가 미검증인 점이 개선 여지로 남는다.

### 위험도

**LOW**