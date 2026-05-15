## 발견사항

### [CRITICAL] `resolveEffectiveOutputPorts`에 대한 직접 단위 테스트 부재
- **위치**: `review-workflow.ts` — `collectDanglingOutputPorts` 내 `resolveEffectiveOutputPorts` 호출
- **상세**: `DANGLING_OUTPUT_PORTS` 검사의 핵심 로직이 `resolveEffectiveOutputPorts`에 위임되어 있으나, 이 함수에 대한 직접 테스트가 리뷰 대상 파일에 없음. 버튼/케이스 포트 강도(strong vs weak) 판정 오류가 있어도 `buildReviewChecklist` 통합 테스트에서 올바른 결과가 나오면 탐지 불가
- **제안**: `resolve-dynamic-ports.ts`에 대한 전용 spec을 작성하거나, 현 spec 내 `DANGLING_OUTPUT_PORTS` describe에 `error` 포트·`continue` 포트·`fallback` 포트를 명시적으로 각각 검증하는 케이스 추가

---

### [CRITICAL] 프롬프트 성장에 취약한 `❌[\s\S]{0,400}` 슬라이딩 윈도우 정규식
- **위치**: `system-prompt.spec.ts` — `Null-safe $node referencing` 테스트
- **상세**: `expect(prompt).toMatch(/❌[\s\S]{0,400}\.output\.interaction\?\.data/)` — 프롬프트가 성장하면서 `❌`와 패턴 사이 거리가 400자를 초과하면 테스트가 false negative를 냄. 프롬프트 리팩터링 시 규칙이 존재하나 테스트가 통과되는 "조용한 회귀" 위험
- **제안**: `❌` 이후 해당 블록의 다음 헤더(`###` 또는 `##`)까지만 추출하여 블록 범위 내 검증 패턴으로 교체

---

### [WARNING] `remove_edge` 회복 경로가 테스트되지 않음
- **위치**: `review-workflow.ts:isRecoveredLater` / `review-workflow.spec.ts:UNRESOLVED_FAILED_CALLS`
- **상세**: `isRecoveredLater`가 `remove_edge`를 `args.id` 기반으로 매칭하는 분기가 있으나, spec에서 `add_edge`, `update_node`, `remove_node`만 회복 케이스를 검증. `remove_edge` 실패 후 재시도 성공 케이스가 누락
- **제안**: `remove_edge` 회복 테스트 케이스 추가

```ts
it('recognises remove_edge recovery by matching id', () => {
  const calls: AssistantToolCallRecord[] = [
    { id: 'c1', name: 'remove_edge', arguments: { id: 'edge-bad' }, kind: 'edit',
      result: { ok: false, error: 'EDGE_NOT_FOUND' } },
    { id: 'c2', name: 'remove_edge', arguments: { id: 'edge-bad' }, kind: 'edit',
      result: { ok: true, id: 'edge-bad' } },
  ];
  expect(buildReviewChecklist(baseInput({ pendingToolCalls: calls }))).toEqual([]);
});
```

---

### [WARNING] `hasReachableAncestorContainer`의 순환 참조 방어(visited Set)가 테스트되지 않음
- **위치**: `review-workflow.ts:hasReachableAncestorContainer`
- **상세**: `visited` Set으로 무한 순회를 막는 방어 코드가 있으나, 실제로 `containerId`가 순환(A→B→A)하는 데이터로 검증한 테스트 없음. 데이터 손상 시나리오에서 무한 루프 없이 올바르게 종료되는지 보장 불가
- **제안**: `containerId`가 순환되는 fixture를 만들어 `collectOrphans`가 정상 반환되는지 확인하는 defensive 테스트 추가

---

### [WARNING] `resetExpressionCacheForTesting` 테스트가 실제 캐시 초기화를 검증하지 않음
- **위치**: `system-prompt.spec.ts` — `edge cases` describe 마지막 테스트
- **상세**: 리셋 전후 동일 결과를 `toBe`로 확인하는 것은 "리셋 후에도 같은 결과를 낸다"는 사실만 증명. `expressionReferenceCache`가 실제로 `null`로 초기화되고 lazy-init 경로가 재실행되는지 확인하지 않음. `resetExpressionCacheForTesting`이 no-op이어도 테스트 통과
- **제안**: `getAllFunctionNames`를 spy로 교체하여 리셋 후 두 번째 `buildSystemPrompt` 호출 시 재호출되는지 검증

---

### [WARNING] `getAllFunctionNames()` 실제 엔진에 의존 — 테스트-엔진 커플링
- **위치**: `system-prompt.ts:getExpressionReferenceSection` / `system-prompt.spec.ts`
- **상세**: 프롬프트 테스트 전체가 `@workflow/expression-engine`의 실제 `getAllFunctionNames()` 출력에 의존. 엔진 함수 목록이 바뀌면 프롬프트 내용이 바뀌고 무관한 테스트가 실패할 수 있음. `resetExpressionCacheForTesting` 메커니즘이 있음에도 mock을 활용한 격리 테스트가 없음
- **제안**: 특정 함수 목록을 고정한 mock을 사용하는 격리 describe 블록을 별도 추가

---

### [WARNING] `configWarnings: []`(명시적 빈 배열)과 `configWarnings` 미존재를 구분하는 테스트 없음
- **위치**: `review-workflow.spec.ts` — `NODE_CONFIG_WARNINGS` describe
- **상세**: 현재 "later update_node clears warnings" 테스트는 `result: { ok: true }` (필드 자체 없음)만 검증. `result: { ok: true, configWarnings: [] }` (명시적 빈 배열)도 같은 결과를 내야 하나 미검증
- **제안**: `configWarnings: []` 케이스를 명시적으로 추가

---

### [WARNING] `REQUEST_COVERAGE_LOW` 임계값 경계(30%)가 테스트되지 않음
- **위치**: `review-workflow.ts:REQUEST_COVERAGE_THRESHOLD = 0.3` / 관련 spec
- **상세**: 30% 미만에서 경고가 발생하고 30% 이상에서 통과되는 경계가 명시적으로 테스트되지 않음. 임계값 변경 시 기존 테스트만으로 회귀 감지 불가
- **제안**: 정확히 임계값에 해당하는 fixture (토큰 10개 중 3개 매칭 = 30%)로 경계값 테스트 추가

---

### [WARNING] `PENDING_USER_CONFIG_UNMENTIONED` — `assistantText` 빈 문자열/null 처리 미검증
- **위치**: `review-workflow.ts:collectUnmentionedPendingUserConfig` (`input.assistantText ?? ''`)
- **상세**: 구현에서 `null`/`undefined` 방어 코드가 있으나, `assistantText`를 명시적으로 빈 문자열이나 생략한 상태에서 플래그가 올바르게 발동하는지 테스트 없음
- **제안**: `assistantText: ''` 및 `assistantText`를 생략한(`baseInput` 기본값) 케이스 각각 검증

---

### [INFO] `checklistBlocks([])` 빈 배열 케이스 미검증
- **위치**: `review-workflow.spec.ts` — `checklistBlocks` describe
- **상세**: 현재 테스트는 비차단 항목만 있는 경우와 차단 항목이 섞인 경우만 확인. 빈 배열은 `buildReviewChecklist`가 정상 케이스에서 이미 반환하므로 간접 검증은 되나, `checklistBlocks` 단위 테스트에는 빠짐
- **제안**: `expect(checklistBlocks([])).toBe(false)` 추가 (1줄)

---

### [INFO] `tokenize` 함수 직접 단위 테스트 부재
- **위치**: `review-workflow.ts:tokenize`
- **상세**: 한국어 조사 제거, 길이 2 미만 토큰 제외, 혼합 언어 처리 등 비자명한 로직이 있으나 `REQUEST_COVERAGE_LOW` 통합 경로에서만 간접 검증됨
- **제안**: `tokenize`를 export하여 직접 단위 테스트 추가, 또는 경계 케이스를 커버하는 `REQUEST_COVERAGE_LOW` 테스트를 보강

---

### [INFO] 복수 trigger 노드 환경에서의 orphan 판정 미검증
- **위치**: `review-workflow.spec.ts` — `ORPHAN_NODES`
- **상세**: 구현이 모든 trigger에서 BFS를 시작하나, trigger가 2개 이상일 때 각 trigger에서만 도달 가능한 노드를 정상으로 판정하는 시나리오 테스트 없음
- **제안**: `manual_trigger` + `webhook_trigger` 두 개가 있고 각자 별도 서브그래프를 가질 때 orphan이 0개인 케이스 추가

---

## 요약

테스트 구조와 커버리지는 전반적으로 높은 수준이다. `describe` 계층, 팩토리 함수, 의도 설명 주석이 잘 갖춰져 있고 보안 인젝션 방어, 절단 상한, 회복 패턴 등 비자명한 엣지 케이스도 다수 검증된다. 다만 `resolveEffectiveOutputPorts` 직접 테스트 부재와 `❌[\s\S]{0,400}` 정규식 윈도우 취약성은 실질적 회귀 위험으로, 프롬프트가 성장하거나 동적 포트 해석 로직이 변경될 때 탐지 실패로 이어질 수 있다. `remove_edge` 회복 경로, 순환 `containerId` 방어, 캐시 초기화 검증 등 중간 수준의 누락도 보완이 필요하다.

## 위험도

**MEDIUM**