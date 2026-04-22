### 발견사항

- **[INFO]** `hadSuccessfulEditThisRound` 무조건 계산
  - 위치: `workflow-assistant-stream.service.ts` — `planProposedPendingApproval` 체크 직전 블록
  - 상세: `hadSuccessfulEditThisRound`(O(n×m) — `.some()` 안에서 `.find()` 선형 탐색)가 `planProposedPendingApproval` 판정보다 먼저 계산됨. `planProposedPendingApproval=true`인 Gemini-3-flash 시나리오에서는 그 결과가 `shouldContinueLoop`에서 **단락(short-circuit) 평가로 참조되지 않는데도** 항상 연산이 수행됨.
  - 제안: 두 상수의 선언 순서를 바꾸거나 lazy 평가를 적용.
    ```ts
    const planProposedPendingApproval = !!planForTurn && !planForTurn.approvedAt;
    const hadSuccessfulEditThisRound =
      !planProposedPendingApproval &&
      pendingResultsForLlm.some((r) => { ... });
    ```
    이렇게 하면 plan-only 종료 경로에서 배열 탐색 자체를 건너뜀.

- **[INFO]** `hadSuccessfulEditThisRound`의 O(n×m) 탐색 (기존 코드)
  - 위치: `shouldContinueLoop` 계산 직전 `.some()` + `.find()` 중첩
  - 상세: `pendingResultsForLlm`(최대 ~tool-budget 개)를 순회하면서 각 원소마다 `pendingToolCalls`에서 `.find()`로 id를 재탐색. 두 배열 모두 동일 소스에서 생성되므로 `pendingToolCalls`를 `Map<id, record>`로 보조 인덱싱하면 O(n)으로 개선 가능.
  - 제안: 이번 diff의 직접 변경은 아니나, `while` 루프 최상단에서 `pendingToolCallsById = new Map(pendingToolCalls.map(c => [c.id, c]))` 유지 후 `.find()` 대신 `.get()` 사용.

---

### 요약

이번 변경의 핵심 성능 효과는 **개선**이다. Gemini-3-flash 패턴에서 발생하던 최대 50회 LLM API round-trip을 1회로 차단해, 실제 비용·레이턴시 폭주를 원천 봉쇄한다. 신규 도입된 `planProposedPendingApproval` 체크 자체는 O(1) 필드 접근이라 오버헤드가 없다. 다만 `hadSuccessfulEditThisRound` 계산이 `planProposedPendingApproval` 선언보다 앞서 배치되어 plan-only 종료 경로에서 불필요한 배열 탐색이 수행되는 사소한 순서 문제가 있다. 이 배열의 최대 크기는 tool-call budget(기본 48, 상한 200)으로 제한되어 있어 실제 영향은 미미하다.

### 위험도

**LOW**