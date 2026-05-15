### 발견사항

---

**[WARNING] `recoverLeakedPlan`의 O(n²) 최악 케이스**
- 위치: `recover-leaked-plan.ts` — `recoverLeakedPlan` 함수 내 for 루프
- 상세: 텍스트에서 `{`를 만날 때마다 `findMatchingBrace`를 호출해 해당 위치부터 문자열 끝까지 재스캔한다. 매칭 성공 후 `isProposePlanShape`가 false를 반환하면, 루프는 `i+1`부터 재시작하여 방금 스캔한 객체 내부의 모든 `{`를 다시 시도한다. 최악 케이스(많은 중첩 `{` 포함 시)는 O(n²). 실제 LLM 응답은 수 KB 수준이므로 프로덕션 임팩트는 제한적이지만, 구조적 비효율이다.
- 제안: 유효하지 않은 후보 객체를 만나면 `i = end`로 점프해 내부 `{` 재탐색을 건너뛴다. `propose_plan` JSON은 항상 최상위 객체이므로 동작 정확도에 영향 없다.
```typescript
// 현재
if (parsed && isProposePlanShape(parsed)) {
  return { args: parsed, matched: candidate };
}
// 이 {에서 시작한 객체는 propose_plan 이 아니었음.

// 개선
if (parsed && isProposePlanShape(parsed)) {
  return { args: parsed, matched: candidate };
}
i = end; // 내부 {를 다시 시도할 필요 없음 — O(n) 보장
```

---

**[INFO] 매 턴 `recoverLeakedPlan` 호출 — 불필요한 스캔 범위**
- 위치: `workflow-assistant-stream.service.ts` — 턴 종료 직전 블록
- 상세: `planForTurn === null && assistantText` 게이트는 적절하다. 그러나 `assistantText`가 길 경우(LLM이 장문 응답을 생성한 정상 턴에서 우연히 tool 호출이 없었을 때) 전체 문자열을 스캔한다. 이 경우 plan leak이 아님에도 O(n) 스캔이 발생한다.
- 제안: `assistantText`에 `"title"` 또는 `"steps"` 키워드가 없으면 즉시 반환하는 조기 종료 추가:
```typescript
// recoverLeakedPlan 최상단에 fast-path 추가
if (!text.includes('"title"') || !text.includes('"steps"')) return null;
```
이미 문자열 검색이지만 O(n) 한 번의 `includes` 두 번으로 대부분의 정상 응답을 즉시 걸러낼 수 있다.

---

**[INFO] `system-prompt.spec.ts` — `prompt.toLowerCase()` 반복 호출**
- 위치: `system-prompt.spec.ts` — 새로 추가된 테스트 및 기존 테스트 전반
- 상세: 동일 테스트 내에서 `prompt.toLowerCase()`를 여러 번 독립적으로 호출한다. 프롬프트는 수 KB 규모이며 각 호출은 새 문자열을 할당한다. 프로덕션 영향은 없지만 테스트가 느려질 수 있다. `const promptLower = prompt.toLowerCase()`로 한 번만 변환하면 충분하다.

---

**[INFO] `assistantText.replace(leak.matched, '')` — 첫 번째 일치만 제거**
- 위치: `workflow-assistant-stream.service.ts` — leak 복구 블록
- 상세: `String.prototype.replace(string, ...)` 첫 번째 인자가 문자열이면 첫 번째 일치만 교체한다. leak JSON이 텍스트에 두 번 나타나는 경우(매우 드물지만) 두 번째 는 남는다. 동작 자체는 설계 의도에 부합하나, `String.prototype.replaceAll`이나 명시적 RegExp flag로 의도를 명확히 하면 유지보수 시 혼란을 줄일 수 있다.

---

### 요약

변경된 코드의 성능 설계는 전반적으로 양호하다. `expressionReferenceCache`로 매 턴 `getAllFunctionNames()` 재계산을 방지하고, 정적 블록을 상수로 분리해 프롬프트 조립 비용을 최소화했으며, leak 복구 게이트(`planForTurn === null`)로 불필요한 스캔을 대부분 차단한다. 실질적 위험은 `recoverLeakedPlan`의 O(n²) 최악 케이스뿐이며, 이는 `i = end` 점프 한 줄로 O(n)으로 낮출 수 있다. LLM 응답이 수 KB 수준인 현재 환경에서는 프로덕션 장애를 유발할 수준이 아니지만, 구조적으로 수정해 두는 것이 바람직하다.

### 위험도

**LOW**