# Requirement Review — spec/5-system/9-rag-search.md (D1/D2 동적 컷)

## 발견사항

### **[WARNING]** `fallback()` 에서 `cutoffApplied` 를 항상 `false` 로 하드코딩

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/codebase/backend/src/modules/knowledge-base/search/rerank.service.ts` line 348
- 상세: `fallback()` 메서드는 주석("강등 경로도 §3.4 일관")대로 `applyDynamicCut`을 호출하지만(line 336), 반환된 `cutoffApplied` 값을 무시하고 `diagnostics.cutoffApplied: false`를 하드코딩한다. spec §4.2 는 "§3.4 동적 점수 컷이 후보를 하나라도 떨어뜨렸으면 `true` — rerank 점수 컷(θ) / token-budget 컷 / inject-cap 컷 중 어느 것이든 적용 시 포함"으로 정의한다. 강등 경로(`RERANK_ENDPOINT_FAILED`, `RERANK_NO_VALID_RESULTS`, `RERANK_CONFIG_INVALID`)에서 inject-cap 또는 token-budget 컷이 실제로 발생해도 `cutoffApplied=false`가 외부로 노출된다. 이는 spec §4.2 정의 위반이며 진단 정확도 저하를 유발한다.
- 제안: `applyDynamicCut` 반환값을 포착해 `cutoffApplied`에 반영한다.
  ```ts
  const { kept, cutoffApplied } = applyDynamicCut(sorted, {
    tokenBudget: params.tokenBudget,
    maxCount: params.injectCap,
  });
  // ... diagnostics: { ..., cutoffApplied, error }
  ```

---

### **[INFO]** `no_grounding` 경로에서 `cutoffApplied` 의미 관찰

- 위치: `rerank.service.ts` line 161-165, 172-184
- 상세: `graded.outcome === 'no_grounding'` 일 때 `reranked = []`로 비운 후 동적 컷 코드(line 173-184)가 빈 배열 위에서 실행된다. 결과 `cutoffApplied = false`(빈 → 빈이라 드롭 없음)가 되고, spec §4.2의 `cutoffApplied: false`는 "droping이 없었음"을 정확히 표현한다. 기능상 문제 없음. 단, spec §3.4 "최소 1개 보장"은 `applyDynamicCut` 내부의 `kept.length > 0` 조건으로 `no_grounding` 시에는 발동하지 않는다(이미 빈 배열이 입력되므로). spec §3.4는 "단 최소 1개 보장"을 빈 입력 케이스에 적용할 의도가 없다는 게 명확하므로 INFO 수준.

---

### **[INFO]** `shouldEscalateGrading` 평탄도 임계 — spec 에 "provisional" 명시, 수치 미정의

- 위치: `rerank.service.ts` line 18-19 (`ESCALATE_TOP_SCORE_FLOOR = 0.6`, `ESCALATE_FLAT_REL_GAP = 0.05`)
- 상세: spec §3.3.2 및 §Rationale "D2"는 "escalate 진입 정량 임계는 합리적 default로 시작(§Rationale)하고, P0 골든셋 기반 A/B 확정은 후속"이라고 명시한다. 구현 상수 주석도 "provisional default"를 명시한다. spec이 의도적으로 수치를 위임한 영역으로, 불일치 아님. 단 상수 정의 위치(모듈 레벨)와 이름이 spec 약속과 일치한다.

---

### **[INFO]** multi-KB merge 경로에서 `cutoffApplied` 진단 미노출 — spec 의도적 생략과 일치

- 위치: `rag-search.service.ts` line 187-192, spec §4.2
- 상세: `off` 경로(multi-KB merge)에서 `applyDynamicCut` 결과의 `cutoffApplied`를 반환 메타에 포함하지 않는다. spec §4.2는 "`rerank` 서브객체는 `rerank_mode ≠ off` 호출에만 존재하므로 off 경로의 동적 컷 적용 여부는 v1 에서 진단에 노출하지 않는다(의도적 생략)"라고 명시한다. 구현이 spec 의도와 일치함. INFO.

---

### **[INFO]** `top_k` tool description 문구 — spec §2.1 과 구현 불일치 없음

- 위치: spec §2.1 tool ToolDef JSON: `"Max chunks to inject. If omitted, a dynamic token-budget cut applies (internal ceiling). Increase for broader recall."` vs 구현 `kb-tool-provider.ts` line 161: `'Max chunks to inject. If omitted, a dynamic token-budget cut decides the count. Increase for broader recall.'`
- 상세: 문구가 약간 다르다("applies (internal ceiling)"  vs "decides the count"). 의미 전달은 동일하며 spec이 완전 literal 일치를 요구하는 형태가 아니라 의미·행위 명세이므로 기능 불일치 없음. INFO.

---

### **[INFO]** spec-fidelity: 관련 spec 문서 coverage 완전

- spec/5-system/9-rag-search.md §3.1 `$4` 파라미터 정의 → `rag-search.service.ts` `RAG_RECALL_K` 적용(line 169): 일치.
- spec §3.4 상수 3종(`RAG_RECALL_K`=50, `RAG_INJECT_TOKEN_BUDGET`=8000, `RAG_MAX_INJECT_COUNT`=12) → `dynamic-cut.util.ts` line 11–16: 일치.
- spec §3.4 "최소 1개 보장" → `dynamic-cut.util.ts` line 56 조건(`kept.length > 0`): 일치.
- spec §3.3.2 step 3 "survivors(~15)" → `rerank.service.ts` `LLM_GRADING_POOL = 15`: 일치.
- spec §3.3.1 `gradingNoGrounding` 정의 → `rerank.service.ts` + `kb-tool-provider.ts` `grounding:'none'` 신호: 일치.
- spec §2.1 `top_k` optional(미지정 시 동적 컷) → `kb-tool-provider.ts` `explicitTopK = args.topK ?? (ctx.config.ragTopK as number | undefined)` + `undefined` 그대로 전달: 일치.
- spec §6 에러 테이블 항목 4종 → `rerank.service.ts` fallback 경로 4종 매핑: 일치.
- spec §4.2 `llmGradingApplied` 정의("escalate + grading 성공 시만 true") → 구현 line 158-165: 일치.

---

## 요약

이번 변경은 D1(동적 점수 컷) + D2(conditional escalate) 두 기능을 spec/5-system/9-rag-search.md 갱신과 함께 구현한 것이다. spec 본문(§3.1~§3.4, §4.2, §6, Rationale)과 구현(dynamic-cut.util.ts, rag-search.service.ts, rerank.service.ts, kb-tool-provider.ts)은 대부분 정밀하게 일치한다. 주요 발견 사항은 `rerank.service.ts` `fallback()` 메서드에서 `applyDynamicCut`의 `cutoffApplied` 반환값을 활용하지 않고 `false`로 하드코딩하는 문제다. spec §4.2 는 강등 경로 포함 모든 §3.4 적용 시 `cutoffApplied=true`를 요구하므로, 강등 경로에서 inject-cap/token-budget 컷이 발생하는 케이스에 진단 정보가 부정확해진다. 이 외의 로직은 기능 완전성·엣지 케이스(최소 1개 보장, 빈 입력, 빈 결과, grading 실패 fallback)·에러 시나리오 처리 모두 spec을 충실히 반영한다.

## 위험도

LOW
