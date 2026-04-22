### 발견사항

---

**[WARNING] 동일 비즈니스 규칙이 두 곳에 분산 구현됨**
- 위치: `workflow-assistant-stream.service.ts` — `evaluateFinishGuard` (기존) vs. 신규 `planProposedPendingApproval` 블록 (loop 후처리)
- 상세: "plan이 미승인 상태면 이번 턴에서 더 이상 진행하지 않는다"는 규칙이 두 곳에 독립적으로 인코딩돼 있습니다.
  - `evaluateFinishGuard`: `if (planForTurn && !planForTurn.approvedAt) return null;` — `finish`가 **호출된** 경우 처리
  - 신규 블록: `const planProposedPendingApproval = !!planForTurn && !planForTurn.approvedAt;` — `finish` 없이 `tool_calls`로 종료된 경우 처리
  
  두 경로가 커버하는 시나리오가 달라 분리 자체는 정당하지만, 조건식이 문자 그대로 동일하기 때문에 향후 규칙 변경 시(예: `approvedAt` → 다른 승인 플래그) 한 쪽만 수정하는 버그가 발생하기 쉽습니다.
- 제안: 판정 로직을 `isPlanPendingApproval(planForTurn): boolean` 같은 private 헬퍼로 추출하고 두 곳에서 호출. 조건 변경이 한 곳에서만 이루어지도록 단일 출처(SoT) 보장.

---

**[WARNING] `shouldContinueLoop` 내 이중 억제 메커니즘 — 의도 모호**
- 위치: `workflow-assistant-stream.service.ts:736~759` (루프 후처리 섹션)
- 상세: `planProposedPendingApproval`가 true일 때 두 가지 억제가 동시에 적용됩니다.
  1. `finishReason = 'stop'` (상태 변이) → `finishReason === 'tool_calls'` 경로 차단
  2. `!planProposedPendingApproval &&` (직접 부정) → `hadSuccessfulEditThisRound` 경로 차단

  ①만으로는 "plan 제안 전에 성공한 edit이 있었던 경우(`hadSuccessfulEditThisRound=true`)"의 round-trip을 막을 수 없어 ②가 필요합니다. 그러나 코드만 보면 두 억제의 역할이 즉시 구분되지 않고, `finishReason` 변이가 클라이언트 시그널용인지 루프 제어용인지 모호합니다.
- 제안: 주석으로 각 억제의 목적을 명시하거나, `shouldContinueLoop` 로직을 `computeShouldContinue(...)` 함수로 추출해 모든 조건을 한 곳에서 읽을 수 있게 정리. `finishReason` 변이는 "클라이언트 전달용"임을 명시.

---

**[INFO] `streamMessage`의 단일 책임 원칙 위반 (기존 문제, 변경으로 심화)**
- 위치: `workflow-assistant-stream.service.ts` — `streamMessage` 전체
- 상세: 이번 변경으로 `streamMessage` 내부의 루프 후처리 섹션에 또 하나의 인라인 가드가 추가됐습니다. 현재 이 메서드는 단일 메서드 내에서 ① 세션/설정 로딩, ② 메시지 조립, ③ tool 디스패치(4종), ④ finish guard, ⑤ review guard, ⑥ loop 제어, ⑦ plan-only guard, ⑧ 퍼시스턴스까지 담당합니다. 가드 로직이 늘어날수록 이 메서드의 유지보수 비용이 선형 이상으로 증가합니다.
- 제안: 단기적으로는 현재 구조를 유지하되, loop 후처리 섹션(`shouldContinueLoop` 결정부)을 `resolveLoopContinuation(...)` 같은 전용 메서드로 분리하는 것을 고려. 이 메서드에서 hadSuccessfulEdit, planPendingApproval, finishResolved 등을 입력으로 받아 `{ shouldContinue: boolean, overriddenFinishReason: string | null }` 반환.

---

**[INFO] 테스트 — 관련 시나리오 그룹화 없음**
- 위치: `workflow-assistant-stream.service.spec.ts` — 신규 테스트 케이스
- 상세: plan-only 턴 관련 테스트들(`allows finish without plan block`, `plan-only turn: finish always succeeds`, 신규 Gemini-3-flash 케이스)이 같은 `describe` 블록 없이 플랫하게 나열돼 있어 연관 시나리오를 찾기 어렵습니다. 테스트 자체의 문서화 품질(시나리오 설명, 기대 행동 명시)은 높습니다.
- 제안: `describe('plan-only turn guards', () => { ... })`로 묶어 탐색성 향상.

---

### 요약

이번 변경은 실제 사용자 보고 버그(gemini-3-flash의 핑퐁 루프)를 서버 레벨에서 강제 차단하는 최소 침습 패치입니다. 수정 범위가 좁고 기존 테스트를 보호하면서 새 테스트로 회귀를 고정한 점은 긍정적입니다. 아키텍처적으로는 "plan 미승인 시 진행 차단"이라는 규칙이 `evaluateFinishGuard`와 루프 후처리 두 곳에 나뉘어 있어 단일 출처 원칙이 무너져 있고, `finishReason` 변이와 `shouldContinueLoop` 직접 부정이라는 이중 억제가 의도를 모호하게 만드는 점이 주요 약점입니다. 이 두 문제는 조건 헬퍼 함수 하나와 loop 결정 로직 분리로 해소 가능하며, `streamMessage`의 메서드 비대화는 장기 리팩토링 대상으로 남겨 둬야 할 구조적 부채입니다.

### 위험도

**LOW** — 기능 정확성에는 문제가 없으며, 식별된 이슈들은 유지보수성 위험에 해당합니다.