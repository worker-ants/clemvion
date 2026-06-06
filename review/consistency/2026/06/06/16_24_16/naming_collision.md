# 신규 식별자 충돌 검토 결과

## 발견사항

### [INFO] `tokenBudget` 필드명이 working-memory 영역에서 이미 동일 이름으로 사용 중
- **target 신규 식별자**: `DynamicCutOptions.tokenBudget`, `RerankParams.tokenBudget` (RAG 주입 토큰 예산)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` line 272 — `tokenBudget: number` (working-memory 압축 예산)
  - 동일 파일 lines 298, 324, 345 및 spec 파일 내 `agent-memory-injection.spec.ts` 전반
- **상세**: 두 `tokenBudget` 은 **의미가 다르다** — RAG 쪽은 "KB 청크 주입 토큰 상한", 메모리 쪽은 "working-memory 압축 임계". 이름 자체는 충돌하지 않는다(다른 interface/scope 내 필드). 코드 주석(`dynamic-cut.util.ts` line 125-126)에서도 둘이 별개임을 명시하고 있다. 충돌은 아니지만 동일 이름이 두 맥락에서 등장하므로 검색·리뷰 시 혼동 가능성이 있다.
- **제안**: 현 설계 유지 가능. 명확성을 높이려면 RAG 쪽을 `ragInjectTokenBudget` 으로 명명하는 방안이 있으나, interface-scoped 필드이므로 현재도 컴파일·런타임 충돌은 없다.

---

### [INFO] `RAG_INJECT_TOKEN_BUDGET = 8000` 과 `DEFAULT_MEMORY_TOKEN_BUDGET = 8000` 값 일치 — 별개 상수
- **target 신규 식별자**: `RAG_INJECT_TOKEN_BUDGET` (`dynamic-cut.util.ts` line 126)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts` line 29 `DEFAULT_MEMORY_TOKEN_BUDGET = 8000`, re-export 된 `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` line 55
- **상세**: 이름은 다르고 별개 모듈에 정의됐다. 코드 주석에서도 "값은 같으나 쓰임새(KB 주입 상한 vs working-memory 압축)가 다른 별개 상수"임을 명시. 이름 충돌 없음. INFO 수준 메모: 두 값이 함께 변경되어야 하는 경우 동기화 위험이 있다.
- **제안**: 현 설계 유지. 만약 두 값을 공통 상수로 올린다면 `spec/conventions` 수준 논의가 필요하다.

---

### [INFO] `RAG_RECALL_K = 50` 과 DB 컬럼 `rerank_candidate_k` default 50 — 수치 일치, 의미 별개
- **target 신규 식별자**: `RAG_RECALL_K = 50` (`dynamic-cut.util.ts` line 123)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/knowledge-base/entities/knowledge-base.entity.ts` line 102 `@Column({ name: 'rerank_candidate_k', default: 50 })` (KB 엔티티 필드 `rerankCandidateK`)
- **상세**: 코드 주석에서도 "off(vector) 경로의 wide 회수 폭. rerank_candidate_k 기본값(50)과 수치만 같고 독립 코드패스"임을 명시. 이름·심볼 충돌 없음. 값이 같을 뿐.
- **제안**: 현 설계 유지.

---

### [WARNING] i18n 키 `"RAG Top-K (default)"` — origin/main 에 잔존, worktree 에서 `"RAG Top-K (cap)"` 으로 교체됨
- **target 신규 식별자**: `"RAG Top-K (cap)"` (worktree `backend-labels.ts` line 133 및 `ai-agent.schema.ts` label)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/backend-labels.ts` line 133 (origin/main) — `"RAG Top-K (default)": "RAG Top-K (기본값)"` 가 여전히 존재
- **상세**: 이 차이는 이 diff 가 의도한 변경이다 — worktree 의 `backend-labels.ts` 는 구키 `"RAG Top-K (default)"` 를 제거하고 `"RAG Top-K (cap)"` 으로 교체했다. 그러나 origin/main 기준으로 `"RAG Top-K (default)"` 키는 `ai-agent.schema.ts` (origin line 286)에서 `label: 'RAG Top-K (default)'` 로 참조된다. 이 diff 가 그 label 도 `'RAG Top-K (cap)'` 으로 바꿨으므로 PR merge 후 불일치는 해소된다. **단**, 다른 미변경 파일에서 `"RAG Top-K (default)"` 키를 직접 문자열로 참조하는 곳이 있다면 번역 누락이 발생한다. 직접 문자열 참조는 발견되지 않았다(schema 내 label 필드가 유일한 소스).
- **제안**: 이 diff 내 변경으로 충분. merge 후 origin/main 의 `"RAG Top-K (default)"` 키는 dead key 가 되지만, PR merge 시 worktree 버전이 적용되어 제거된다.

---

### [WARNING] `ragTopK` 기본값 5 → optional(undefined) 변경 — 비변경 테스트/서비스에 hardcode 잔존
- **target 신규 식별자**: `ragTopK` 의 의미 변경 (schema `optional()`, 기본값 제거)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/core/node-component.registry.spec.ts` lines 163, 171 — `ragTopK: z.number().default(5)` / `ragTopK: 5` (mock schema 에 고정 기본값 5 하드코드)
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/ai-agent.cleanup.spec.ts` line 133 — `ragTopK: 5`
  - `/Volumes/project/private/clemvion/codebase/backend/src/modules/workflows/workflows.service.spec.ts` lines 800, 825 — `ragTopK: 5`
  - `/Volumes/project/private/clemvion/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 4566 — `ragTopK: s.ragTopK` (값 통과)
- **상세**: `node-component.registry.spec.ts` 의 mock schema 는 실제 `ai-agent.schema.ts` 와 독립된 제어용 mock 이므로 직접 충돌은 없다. `workflows.service.spec.ts` / `ai-agent.cleanup.spec.ts` 의 `ragTopK: 5` 는 테스트 fixture 값으로, 실제 스키마 변경 후에도 숫자를 전달하면 optional 스키마가 그 값을 그대로 수용하므로 런타임 오류는 없다. 그러나 이 fixture 들이 "기본값 5" 를 전제하고 있다면 로직 상 의미가 달라진다 — 이제 `ragTopK: undefined` 가 "동적 컷 위임"을 뜻하기 때문이다. 이 diff 는 해당 파일들을 변경하지 않았다.
- **제안**: 위 파일들에서 `ragTopK: 5` 가 "기존 동작 검증"인지 "명시적 cap=5 케이스 검증"인지 의미를 재확인하고, 동적 컷 경로(`ragTopK: undefined`)를 별도 케이스로 추가하는 것을 권장한다. 런타임 충돌은 없지만 테스트 의도 불명확.

---

### [INFO] `injectCap` 파라미터명 — `RerankParams.topK` → `injectCap` 르네임
- **target 신규 식별자**: `RerankParams.injectCap` (rerank.service.ts line 822)
- **기존 사용처**: `RerankParams.topK` (origin/main rerank.service.ts line 45) — 이 diff 가 `topK` 를 제거하고 `injectCap + tokenBudget` 으로 교체
- **상세**: 동일 interface 내 르네임이므로 기존 `topK` 와의 이름 충돌은 없다. `RerankCandidate` 의 `score` 필드 등 나머지 인터페이스 구조는 변경 없음. 충돌 없음.
- **제안**: 없음.

---

### [INFO] `SearchWithMetaResult` 타입 신규 export — 기존 anonymous inline 타입 대체
- **target 신규 식별자**: `export type SearchWithMetaResult` (`rag-search.service.ts` 상단)
- **기존 사용처**: origin/main 에서는 `searchWithMeta` 반환 타입이 inline anonymous 객체였으며 별도 named type 없었음. `/Volumes/project/private/clemvion/codebase/backend/src/scripts/eval-retrieval.ts` 가 `searchWithMeta` 를 호출하지만 반환 타입을 named import 하지는 않음.
- **상세**: 새 named export 는 기존 다른 심볼과 충돌하지 않는다.
- **제안**: 없음.

---

### [INFO] `gradingNoGrounding` 필드 신규 추가 — `RerankDiagnostics` 인터페이스 확장
- **target 신규 식별자**: `RerankDiagnostics.gradingNoGrounding: boolean`
- **기존 사용처**: `RerankDiagnostics` 는 rerank.service.ts 에만 정의됐고, 외부 소비처는 `kb-tool-provider.ts` 와 `ai-agent.handler.spec.ts` (line 325 의 `cutoffApplied: true` fixture). 기존 `diagnostics` 객체에 `gradingNoGrounding` 없었음.
- **상세**: 필드 추가이므로 기존 코드에서 이 필드를 참조하지 않던 곳은 영향 없음. `ai-agent.handler.spec.ts` line 325 의 fixture 에는 아직 `gradingNoGrounding` 가 없는데, 이 diff 는 해당 파일을 수정하지 않았다. 타입스크립트 구조적 타이핑 상 fixture 가 필드를 누락해도 컴파일 오류는 없으나 `gradingNoGrounding: false` 기대값이 검증되지 않는 상태다.
- **제안**: `ai-agent.handler.spec.ts` 의 `RerankDiagnostics` fixture 에 `gradingNoGrounding: false` 추가를 권장.

---

## 요약

이 diff 가 도입하는 신규 식별자(`RAG_RECALL_K`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT`, `DynamicCutOptions`, `DynamicCutResult`, `applyDynamicCut`, `SearchWithMetaResult`, `injectCap`, `gradingNoGrounding`, `shouldEscalateGrading`, `ESCALATE_TOP_SCORE_FLOOR`, `ESCALATE_FLAT_REL_GAP`) 중 기존에 동일 이름으로 다른 의미로 사용된 심볼은 발견되지 않았다. 주요 유의점은 두 가지다: (1) `tokenBudget` 필드명이 working-memory 영역과 중복되나 별개 scope 이므로 충돌은 아님, (2) i18n 키 `"RAG Top-K (default)"` 가 origin/main `backend-labels.ts` 에 잔존하나 이 diff 의 의도된 삭제 대상이며 merge 후 해소된다. `ragTopK` 기본값 제거로 인해 비변경 테스트 파일들(node-component.registry.spec, workflows.service.spec, ai-agent.cleanup.spec)에 `ragTopK: 5` 하드코드가 잔존하는 점은 런타임 오류가 아니나 테스트 의미 명확화가 필요하다.

## 위험도

LOW
