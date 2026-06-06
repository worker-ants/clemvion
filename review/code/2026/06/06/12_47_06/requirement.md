# 요구사항(Requirement) Review

## 발견사항

### **[INFO]** 파일 1 — rag-search.service.spec.ts: graph 모드 inputType='query' 계약 고정 추가

- 위치: `rag-search.service.spec.ts` diff, lines 37–46 (기존 테스트 케이스 내부에 추가된 `expect` 블록)
- 상세: `routes graph KB through searchGraphKb` 테스트에 `mockLlmService.embed`가 `inputType='query'`(`'query'` 5번째 위치 인자)로 호출됐는지 검증하는 `expect` 절을 추가했다. 이는 `searchGraphKb()` 내부에서 `this.llmService.embed(llmConfig, [query], kb.embeddingModel, undefined, 'query')`를 사용하는 실제 구현 `/Volumes/project/private/clemvion/.claude/worktrees/embedding-followup-c09eb2/codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` (line 449–455)와 완전히 일치한다. spec `spec/5-system/9-rag-search.md §5 비대칭 입력` 및 `spec/5-system/8-embedding-pipeline.md §5.4`가 "검색 쿼리 임베딩은 `LlmService.embed(..., inputType:'query')` 로 호출한다"고 명시하므로 코드와 spec이 일치한다.
- 제안: 이슈 없음.

---

### **[INFO]** 파일 2 — local.client.spec.ts: LocalClient 상속 경로 회귀 가드 신규 추가

- 위치: 전체 신규 파일 (56라인)
- 상세: `LocalClient`는 `OpenAIClient`를 상속하고, `OpenAIClient.embed()`가 `applyEmbeddingInputPrefix()` 를 호출해 e5 접두사를 처리한다(`openai.client.ts` line 208). 테스트는 `client.client`에 embeddings stub을 주입하는 `@ts-expect-error` 방식으로 내부 SDK 호출을 인터셉트한다. 이 패턴은 다른 OpenAI 클라이언트 테스트와 일관적이다. 네 케이스 모두 `embedding-input-type.ts`의 `E5_PREFIX_PATTERN` 및 `applyEmbeddingInputPrefix()` 로직과 정합하다.
- 제안: 이슈 없음. bge-m3 케이스(대칭 모델, prefix 없음)가 명시적으로 커버되어 경계 케이스도 고정됐다.

---

### **[INFO]** 파일 3 — embedding-input-type.spec.ts: 멱등성 부재 계약 고정 추가

- 위치: diff lines 846–868
- 상세: `applyEmbeddingInputPrefix`가 멱등이 아니라는 사실을 계약으로 명시하는 테스트를 추가했다. 실제 구현(`embedding-input-type.ts` line 66–74)은 prefix 중복 검사 없이 단순 `map`으로 prefix를 붙이므로 이중 호출 시 `query: query: ...`가 된다. 이 계약은 호출자(`searchVectorGroup`, `searchGraphKb`)가 단 한 번만 호출함을 전제로 성립하며, 코드 상으로도 `llmService.embed()` 안에서 prefix가 한 번(client.embed 내부) 적용된다. 이중 적용 경로는 현재 없어 위험이 실재하지 않는다.
- 제안: 이슈 없음. 향후 dedup 로직 추가를 막는 방어적 문서화로 적절하다.

---

### **[INFO]** 파일 4 — llm.service.spec.ts: inputType 배치 전파 + withTimeout 경로 테스트 추가

- 위치: diff lines 1018–1079
- 상세: 두 개의 테스트 케이스가 추가됐다. (a) 25개 텍스트를 20+5 두 배치로 쪼개도 `inputType='query'`가 각 배치에 보존되는지 검증, (b) `timeoutMs > 0`일 때 `withTimeout` 경로를 통해도 `inputType`이 유실되지 않는지 검증. 실제 `llm.service.ts` `embed()` 메서드(lines 219–246)는 `client.embed(batch, model, inputType)` 3-arg 호출을 사용하며 두 경로(`withTimeout` / 직접) 모두 동일 인자를 전달한다. 테스트의 `expect.toHaveBeenNthCalledWith`가 정확히 이 3-arg 시그니처를 고정한다. spec `7-llm-client.md §8.3` 및 `8-embedding-pipeline.md §5.4`와 일치.
- 제안: 이슈 없음.

---

### **[INFO]** 파일 5 — embedding-model-combobox.test.tsx: 한국어 추천 배지 렌더링 통합 테스트 추가

- 위치: diff lines 1102–1141
- 상세: `multilingual-e5-large`는 배지 포함, `text-embedding-3-small`은 배지 없음을 select option 텍스트로 검증한다. 실제 컴포넌트(`embedding-model-combobox.tsx`)는 `formatEmbeddingOptionLabel`을 `renderOption`으로 `ModelSelectField`에 전달하며, 이 순수함수가 option 텍스트를 생성한다. spec `2-navigation/5-knowledge-base.md §2.2`의 현재 텍스트(KURE/arctic-embed/bge-m3/multilingual-e5 추천, text-embedding-3 제외)와 테스트 기댓값이 일치한다.
- 제안: 이슈 없음.

---

### **[INFO]** 파일 6 — embedding-model-combobox.tsx: renderOption 추출 리팩터링

- 위치: diff lines 1596–1644
- 상세: 인라인 람다 `(m) => { ... }` 를 `useCallback`으로 래핑한 `renderOption`으로 추출하고, 로직은 `formatEmbeddingOptionLabel` 순수함수로 위임했다. 기능적으로 동일하다 — `ModelSelectField`가 현재 memo화되어 있지 않으므로 리렌더 최적화 효과는 없으나, 코드 주석에 이를 명시한다. `t`가 stable reference임을 가정해 `useCallback` deps에 `[t]`만 둔 것은 `useT()`의 일반적 안정성 계약에 의존하는 패턴으로 적절하다.
- 제안: 이슈 없음.

---

### **[INFO]** 파일 7 — embedding-model-recommendation.test.ts: text-embedding-3 추천 제외 + formatEmbeddingOptionLabel 테스트 추가

- 위치: diff lines 1757–1843
- 상세: `text-embedding-3-small`과 `text-embedding-3-large`가 `isKoreanRecommendedEmbeddingModel()` 추천 목록에서 제거됐다(이제 `false` 반환 케이스로 이동). `formatEmbeddingOptionLabel` 테스트가 6개 케이스(배지 추가, 배지 없음, name/id 혼합, 동일, 빈 name, 다른 배지 문구)를 커버한다. 실제 구현과 정합하다.
- 제안: 이슈 없음.

---

### **[INFO]** 파일 8 — embedding-model-recommendation.ts: `text-embedding-3` 패턴 제거 + `formatEmbeddingOptionLabel` 함수 추가

- 위치: diff lines 1948–2012
- 상세: `KOREAN_RECOMMENDED_PATTERNS`에서 `/text-embedding-3/i` 패턴 삭제, 주석에 제외 근거(한국어 벤치마크 하위) 명시. `formatEmbeddingOptionLabel` 순수함수 추가 — `Pick<ModelInfo, 'id' | 'name'>` + 배지 문구를 받아 option 라벨 문자열 반환. i18n 의존을 끊어 테스트 용이성 확보.
- 제안: 이슈 없음.

---

### **[INFO]** 파일 9 — spec/2-navigation/5-knowledge-base.md: 한국어 추천 모델 목록 갱신

- 위치: diff line 2094–2095 (§2.2 임베딩 모델 필드 설명 갱신)
- 상세: 기존 spec 텍스트에서 `text-embedding-3` 패턴을 추천 목록에서 제거하고, 제외 근거(한국어 벤치마크 하위)를 명시했다. 추천 순위도 `KURE/arctic-embed > BGE-M3 > multilingual-e5` 로 정렬 정리. 코드(`embedding-model-recommendation.ts`)의 `KOREAN_RECOMMENDED_PATTERNS` 배열과 정확히 일치.
- 제안: 이슈 없음.

---

### **[INFO]** 파일 10 — spec/4-nodes/3-ai/3-information-extractor.md: recall `inputType:'query'` 배선 명시

- 위치: diff line 2331 (§7.1 회수 목록에 라인 추가)
- 상세: "recall 은 queryText 를 inputType:'query' 로 임베딩한다"는 배선 계약을 spec에 추가했다. 이는 agent memory recall 경로의 비대칭 모델 대응을 문서화한 것이다. 코드 구현(`agent-memory.service.ts`)이 실제로 이 계약을 지키는지는 본 리뷰 diff 범위 밖이지만, spec 자체로 모순이 없고 §17 링크도 정확하다.
- 제안: agent-memory recall 경로의 `inputType:'query'` 실제 구현은 별도 리뷰에서 확인 권장.

---

### **[INFO]** 파일 11 — spec/5-system/17-agent-memory.md: 일괄 재임베딩 경로 부재 결정 문서화

- 위치: diff lines 2355–2362 (새 Rationale 단락 추가)
- 상세: agent memory에 KB 식 일괄 재임베딩 경로를 두지 않는다는 의도적 결정과 근거(휘발성, dedup UPDATE 자연 수렴, 비용 대비 이득 낮음)를 문서화했다. 이는 spec 갱신이며 구현 코드 변경이 아니다. 논리적으로 일관성 있고 §4 (회수) 및 §3 (추출/dedup)의 기존 spec과 충돌하지 않는다.
- 제안: 이슈 없음.

---

## 요약

11개 파일 전체에 걸친 변경이 의도한 기능(임베딩 비대칭 inputType 배선을 테스트로 고정, 한국어 추천 모델에서 text-embedding-3 제외, formatEmbeddingOptionLabel 순수함수 추출, agent memory/extractor spec 갱신)을 완전히 구현하고 있다. 각 테스트 파일은 실제 구현과 1:1 계약으로 대응되며, spec 갱신(파일 9·10·11)은 코드 변경과 일치한다. TODO/FIXME/HACK 주석 없음. 비즈니스 로직(text-embedding-3 추천 제외, graph 모드 query 임베딩 계약, 멱등성 부재 계약, 배치 전파)이 코드와 spec 모두에 정확히 반영됐다. 기능 완전성·엣지 케이스·에러 시나리오 처리 모두 충족. CRITICAL/WARNING 발견사항 없음.

## 위험도

NONE
