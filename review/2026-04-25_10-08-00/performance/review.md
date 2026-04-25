분석 완료했습니다.

---

## 성능 코드 리뷰 결과

### 발견사항

---

- **[WARNING]** BFS에서 `queue.shift()` 사용 — O(n) 디큐
  - 위치: `review-workflow.ts` → `collectOrphans()` 내 BFS 루프
  - 상세: `Array.prototype.shift()`는 배열의 모든 원소를 앞으로 이동시켜 O(n)입니다. 노드 N개·엣지 E개 그래프에서 BFS 전체 복잡도가 O(N+E)에서 **O(N²+E)**로 퇴화합니다. 현재 워크플로우 규모(~100 노드)에서는 체감 지연이 미미하지만, 대형 워크플로우에서는 실측 병목이 될 수 있습니다.
  - 제안: 인덱스 포인터 방식(`let head = 0; while (head < queue.length) { const cur = queue[head++]; ... }`)으로 교체하면 O(N+E) 복잡도를 회복합니다.

---

- **[WARNING]** `renderNodeCatalog`가 매 턴 재계산됨 — 동일한 패턴의 `expressionReferenceCache`가 이미 있음
  - 위치: `system-prompt.ts` → `buildSystemPrompt()`, `renderNodeCatalog()`
  - 상세: `nodeDefs`는 프로세스 수명 동안 불변(node type 등록은 시작 시 1회)임에도 `buildSystemPrompt()`가 호출될 때마다 `.map().join()` 체인이 전체 실행됩니다. 같은 파일에서 `expressionReferenceCache`를 통해 정확히 동일한 최적화를 이미 적용한 패턴이 있으므로 일관성도 깨집니다. 노드 정의가 수십 개일 경우 turn당 불필요한 문자열 객체가 반복 생성됩니다.
  - 제안: `let catalogCache: string | null = null`로 모듈 스코프 캐시를 추가하고, `nodeDefs`가 처음 전달될 때 한 번만 빌드합니다. 테스트 격리가 필요하면 `resetExpressionCacheForTesting()`과 동일한 방식으로 `resetCatalogCacheForTesting()`을 노출합니다. 단, `nodeDefs` 참조 동일성을 키로 쓰거나, 단순히 첫 호출 결과를 영구 캐시해도 프로덕션에서는 안전합니다.

---

- **[WARNING]** `checkRequestCoverage`의 토큰 매칭이 문자열 `includes()` — O(tokens × corpus_len)
  - 위치: `review-workflow.ts` → `checkRequestCoverage()` 내 `labelCorpus.includes(t)` 루프
  - 상세: 노드 라벨을 모두 join한 문자열에서 각 토큰마다 `includes()`를 수행합니다. 요청 토큰이 T개, 라벨 총 길이가 L이면 O(T×L)입니다. 또한 `tokenize(request)`가 호출될 때마다 정규식 `.match(/[a-z0-9가-힣]+/gu)`를 실행합니다.
  - 제안: 노드 라벨도 `tokenize()`로 변환해 `Set<string>`을 만들고, `reqTokens`의 각 토큰을 O(1)로 조회합니다(`labelTokenSet.has(t)`). 전체 복잡도가 O(T+L)로 개선됩니다.

---

- **[WARNING]** `isRecoveredLater`가 중첩 루프로 O(n²) 최악 케이스 생성
  - 위치: `review-workflow.ts` → `collectUnresolvedFailures()` + `isRecoveredLater()`
  - 상세: 실패 call이 k개면 `isRecoveredLater`를 k번 호출하고, 내부에서 나머지 calls를 선형 탐색합니다. 한 턴에 수십 개 tool call이 발생하는 병렬 배치 패턴(BLOCK 1에서 장려)에서 최악 O(n²) 케이스가 현실적으로 발생합니다.
  - 제안: `collectUnresolvedFailures` 진입 시 성공 call을 (name, key) → true 맵으로 인덱싱하고, 실패 call별로 O(1) 조회합니다. 사전 인덱스 구축 비용은 O(n)이며 전체가 O(n)으로 감소합니다.

---

- **[WARNING]** `collectDanglingOutputPorts`에서 `defsByType` Map을 매 호출마다 재생성
  - 위치: `review-workflow.ts` → `collectDanglingOutputPorts()` 첫 두 줄
  - 상세: `new Map(nodeDefs.map((d) => [d.metadata.type, d]))`가 `buildReviewChecklist` 호출마다 실행됩니다. `renderNodeCatalog` 캐싱 이슈와 동일 원인. `nodeDefs`가 정적이므로 Map도 정적으로 취급 가능합니다.
  - 제안: 호출부(`buildReviewChecklist`)에서 `defsByType`을 외부에서 미리 구성해 주입하거나, 함수 내부에 간단한 lazy-init 캐시를 추가합니다.

---

- **[INFO]** `JSON.stringify(toWorkflowView(snapshot))`이 매 턴 전체 직렬화
  - 위치: `system-prompt.ts` → `buildSystemPrompt()` 내 `snapshotJson`
  - 상세: 스냅샷이 크더라도 LLM context에 전체를 넣어야 하므로 직렬화 자체는 불가피합니다. 그러나 `toWorkflowView`가 내부적으로 변환 작업을 수행한다면 그 비용이 추가됩니다. 스냅샷이 변경되지 않은 턴(read-only 쿼리)에도 동일 비용이 발생합니다. 현재 규모에서는 INFO 수준이지만, 수백 노드 워크플로우에서는 측정해볼 만합니다.
  - 제안: 단기적으로는 현 구조 유지. 필요시 snapshot 참조 동일성 기반 직렬화 캐시를 추가할 수 있습니다.

---

- **[INFO]** `resolveEffectiveOutputPorts`의 `dedupeById`가 매 노드마다 새 `Set` + 배열 할당
  - 위치: `resolve-dynamic-ports.ts` → `dedupeById()`
  - 상세: `collectDanglingOutputPorts`가 워크플로우의 모든 노드마다 `resolveEffectiveOutputPorts`를 호출하고, 내부적으로 `dedupeById`가 `Set`과 결과 배열을 각각 생성합니다. 노드당 포트 수가 적어 현재는 무해하나, 중첩 배열 스프레드(`[...condPorts, ...]`)도 여러 곳에서 나타납니다.
  - 제안: 현 규모에서는 변경 불필요. 향후 수천 노드 배치 검증이 필요해지면 포트 배열을 직접 push로 누적하는 방식으로 최적화 가능.

---

### 요약

전반적으로 코드는 의도가 명확하고 상수를 모듈 스코프에 올려두거나 `expressionReferenceCache`처럼 캐싱을 적용하는 좋은 패턴을 이미 일부 포함하고 있습니다. 주요 위험은 두 곳입니다. 첫째, `collectOrphans`의 `queue.shift()`는 BFS를 O(N²)으로 퇴화시키며 인덱스 포인터 한 줄로 수정됩니다. 둘째, `nodeDefs`가 정적임에도 `renderNodeCatalog`과 `defsByType` Map이 매 턴 재계산되는데, `expressionReferenceCache`와 동일한 캐시 패턴이 이미 코드베이스에 있어 일관성 있는 수정이 가능합니다. `isRecoveredLater`의 O(n²)과 `checkRequestCoverage`의 선형 문자열 탐색도 실용적 수정 대상이지만, 현재 운영 규모(턴당 tool call 수십 개, 노드 수십~수백 개)에서 체감 성능 문제를 일으킬 가능성은 낮습니다.

### 위험도

**LOW** — 현재 운영 규모에서 실제 사용자 영향은 거의 없으나, `queue.shift()` 와 `renderNodeCatalog` 재계산은 간단한 수정으로 제거 가능한 불필요한 비용입니다.