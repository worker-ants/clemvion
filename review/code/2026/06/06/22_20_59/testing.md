# Testing Review

## 발견사항

### [INFO] 테스트 존재 여부 — 전 계층 커버 우수
- 위치: 파일 1(rag-search.service.spec.ts), 파일 3(ai-agent.handler.spec.ts), 파일 6(kb-tool-provider.spec.ts), 파일 8(knowledge-bases-page.test.tsx)
- 상세: 변경된 4개 핵심 코드 단위(RagSearchService, KbToolProvider, AiAgentHandler, KnowledgeBasesPage) 모두에 대응하는 테스트가 선작성·보강됐다. plan 체크리스트에도 "테스트 선작성" 완료가 명시돼 있다.
- 제안: 없음.

---

### [INFO] 커버리지 갭 — `unsearchableHit && results.length === 0` 조건 분기 미테스트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-unsearchable-warning-b47e20/codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts` +281 `if (unsearchableHit && results.length === 0)`
- 상세: `kb-tool-provider.spec.ts`의 신규 테스트 두 건은 모두 `results: []` 경로(unsearchableHit true + results 0건)만 검증한다. `unsearchable` 배열이 존재하지만 `unsearchableHit`가 없는 경우(다른 kbId의 unsearchable만 포함된 경우), 그리고 `unsearchableHit`는 있지만 `results`가 비어있지 않은 경우(논리적으로 불가능해 보이지만 방어적 경계)는 테스트되지 않는다. 전자는 실제로는 단일-KB 호출 패턴에서 발생하기 어렵지만, `find` 로직이 올바르게 동작함을 보증하는 단위 테스트가 없다.
- 제안: `unsearchable` 배열에 현재 kbId 가 없는 경우(다른 KB의 unsearchable만 포함) 시 `not_searchable` 봉투가 반환되지 않고 정상 흐름으로 이어짐을 확인하는 케이스 1건 추가 권장.

---

### [INFO] 커버리지 갭 — `withUnsearchable` 헬퍼가 rerank 경로에서도 호출됨을 검증하는 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-unsearchable-warning-b47e20/codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` +236 `return withUnsearchable(await this.searchWithRerank(...))`
- 상세: `rag-search.service.spec.ts` 신규 케이스 4건은 rerank 경로를 타지 않는 케이스만 다룬다. `searchableKbs.length === 1 && rerankMode !== 'off'`인 KB와 `embeddingDimension == null`인 다른 KB가 혼재할 때 `withUnsearchable`가 rerank 결과에도 정상 적용되는지는 커버되지 않는다.
- 제안: mixed + rerank 경로 케이스(searchable 1개 rerank 모드 + unsearchable 1개) 테스트 1건 추가 권장. 현재 누락이지만 기존 rerank 테스트와 조합이 복잡하므로 follow-up으로 처리해도 위험 낮음.

---

### [INFO] 엣지 케이스 — `embeddingDimension == null`이면서 `reembedStatus`가 정의된 두 값 외의 경우 미테스트
- 위치: `rag-search.service.ts` +202-206 `reason` 결정 로직
- 상세: `reembedStatus`가 `'idle'` 또는 `'in_progress'`인 두 케이스는 모두 테스트돼 있다. DB 스키마 타입이 현재 `'idle' | 'in_progress'`로 제한돼 있어 이 외의 값이 런타임에 올 가능성은 낮으나, TS 타입 외부(raw DB row, 마이그레이션 기간 데이터 등)에서 예상치 못한 값이 올 경우 `'reembedding_required'` 로 폴스루한다. 이 폴스루 동작의 의도성 여부가 주석·테스트에서 명시되지 않았다.
- 제안: 타입 정의상 현실적 위험이 낮으므로 INFO 수준. 주석에 폴스루 의도 명시("그 외 idle 처리") 또는 exhaustive guard(`assertNever`) 추가를 고려.

---

### [INFO] Mock 적절성 — `ai-agent.handler.spec.ts`의 `searchWithMeta` mock이 kbId 무관하게 단일 응답을 반환
- 위치: 파일 3, +290-293
- 상세: `mockRagService.searchWithMeta.mockResolvedValue(...)` 로 모든 호출에 단일 unsearchable 응답을 반환하므로, 실제 구현에서 kbId 매칭이 올바른지는 검증하지 않는다. 핸들러 레벨 테스트의 특성상 허용 범위이나, KbToolProvider 테스트에서는 이미 kbId 매칭이 검증되고 있으므로 중복 검증 불필요. 현재 mock 전략은 적절하다.
- 제안: 없음. 현재 계층 분리가 올바름.

---

### [INFO] 테스트 격리 — `knowledge-bases-page.test.tsx` `beforeEach`에 `cleanup()` 호출
- 위치: 파일 8, +596 `cleanup()`
- 상세: 신규 describe 블록 `beforeEach`에 `vi.clearAllMocks()` + `cleanup()` 이 있어 테스트 간 DOM 상태가 정리된다. 상위 describe 블록의 `beforeEach`와 동일 패턴을 일관되게 따르고 있으며 격리가 적절하다. 단, `createWrapper()`가 각 테스트마다 새 `QueryClient`를 생성하지 않고 `renderPage()` 호출 시마다 생성하므로, react-query 캐시가 테스트 간 공유되지 않아 격리에 문제없다.
- 제안: 없음.

---

### [INFO] 테스트 가독성 — `kb-tool-provider.spec.ts` 두 번째 신규 케이스가 단일 assertion만 포함
- 위치: 파일 6, +486-500 `'maps reembed in_progress to reembedding_in_progress reason'`
- 상세: `reembedding_in_progress` reason 매핑만 단독으로 검증하며, `status: 'not_searchable'`, `results: []`, `ragDiagnosticsDelta.unsearchable` 등 첫 번째 케이스에서 검증한 나머지 필드들은 재검증하지 않는다. 이는 의도적 분리로 가독성상 합리적이나, `reason` 값 하나만 달라진다는 점에서 파라미터화 테스트(`it.each`)로 통합할 여지가 있다.
- 제안: 현재 구조는 허용 범위. 향후 케이스가 늘어나면 `it.each([['reembedding_required', 'idle'], ['reembedding_in_progress', 'in_progress']])` 패턴으로 리팩터링 고려.

---

### [INFO] 회귀 테스트 — 기존 `kbs`를 `searchableKbs`로 변경한 로직이 기존 테스트를 깨지 않는지
- 위치: `rag-search.service.ts` +211, +251-252 (`vectorKbs`, `graphKbs` 필터 대상 변경)
- 상세: `kbs → searchableKbs` 치환은 기존 테스트들이 모두 `embeddingDimension` 이 non-null인 KB로 fixture를 구성하므로, `searchableKbs === kbs` 가 되어 기존 동작을 보존한다. plan 체크리스트에 `unit ✓ (40)` 이 명시돼 있어 회귀가 없음을 확인.
- 제안: 없음. 기존 테스트가 자연스럽게 회귀 테스트 역할을 수행.

---

### [INFO] 테스트 용이성 — `RagAccumulator`가 private class로 내부화되어 직접 단위 테스트 없음
- 위치: `ai-agent.handler.ts` `class RagAccumulator` (private / 내부 class)
- 상세: `diagnosticCount`, `unsearchableCount` 집계 로직과 `skipReason` 판정 분기는 `RagAccumulator.build()` 내부에 있으며, 이를 핸들러 통합 테스트를 통해 간접 검증한다. `ai-agent.handler.spec.ts`의 신규 케이스 1건이 `diag.skipReason === 'kb_unsearchable'`을 확인하므로 핵심 경로는 커버된다. 단, `diagnosticCount > 0 && unsearchableCount === diagnosticCount` 조건의 경계값(일부만 unsearchable인데 `kb_unsearchable`이 되지 않아야 하는 케이스)이 통합 테스트로 검증되지 않는다.
- 제안: "kb 일부만 unsearchable + 결과 0건이면 `no_results`를 반환한다" 케이스 1건 추가 권장. (예: `diagnosticCount=2, unsearchableCount=1, resultCount=0` → `skipReason='no_results'`)

---

## 요약

신규 기능 전체(RagSearchService unsearchable 판정, KbToolProvider not_searchable 봉투 변환, AiAgentHandler skipReason, 프론트엔드 경고 배지)에 대응하는 테스트가 모두 선작성됐으며 unit 40건 통과가 확인된다. 주요 정상 경로(idle/in_progress 두 상태, mixed KB 조합, 건강 KB 정상 동작)가 충실히 커버된다. 식별된 갭은 두 가지: (1) `unsearchableHit` kbId 불일치 경계 케이스 미검증, (2) `diagnosticCount > unsearchableCount`일 때 `no_results`가 반환됨을 보증하는 케이스 없음. 두 갭 모두 현행 구현의 버그를 유발할 수 있는 경로이나, 실제 호출 패턴(단일 KB 호출)과 기존 통합 테스트의 간접 보증으로 즉각적 위험은 낮다. 나머지는 가독성·구조 개선 수준의 INFO 사항이다.

## 위험도

LOW
