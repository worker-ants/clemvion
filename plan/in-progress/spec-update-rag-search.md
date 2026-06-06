---
worktree: rag-dynamic-cut-12fac1
started: 2026-06-06
owner: resolution-applier
---
# Spec Update Draft — rag-search (D1/D2 후속 보강)

## 분류
spec 결함 (spec 자체 누락·모순): spec §2.2, §3.1, §7, §4.2 에 아래 3개 항목이 누락됨

---

## 원본 발견사항

### SUMMARY#4 (W4 — spec §2.2 gradingNoGrounding tool_result 포맷 예시)

SUMMARY#4: `gradingNoGrounding = true` 시 tool_result 출력 포맷 명세 부재.
"관련 근거 없음" 신호가 어느 출력 필드로 나타나는지 spec §2.2 / §3.3 미정의로
구현자 해석 오류 가능. (카테고리: Maintainability, 위치: spec §4.2, §3.3)

### SUMMARY#7 (W7 — cutoffApplied 의미 변경 릴리즈노트 권장)

SUMMARY#7: `rerank.cutoffApplied` 의미 확장 — "점수 임계 컷" → "θ/token-budget/inject-cap
중 어느 것이든". 기존 소비자가 협의 해석 중이면 오탐 가능.
릴리즈 노트·마이그레이션 가이드에 의미 변경 명시 권장. (카테고리: API Contract, 위치: spec §4.2)

### SUMMARY#8 (W8 — spec §3.1/§7 pgvector wide-회수 인덱스 파라미터 follow-up)

SUMMARY#8: wide 회수 도입(`LIMIT 5 → LIMIT 50`)으로 pgvector ANN 스캔 비용 증가.
`hnsw.ef_search` / `ivfflat.probes` 인덱스 파라미터 조정 필요성이 spec·Rationale 어디에도
언급 없어 구현 시 지연 회귀 간과 위험.
spec §3.1 또는 §7 에 "wide 회수 도입에 따른 pgvector 인덱스 파라미터 검토 필요"를
Rationale 주석 또는 follow-up 항목으로 명시 권장. (카테고리: Performance, 위치: spec §3.1, §3.4)

---

## 제안 변경

### W4: spec §2.2 — KB tool 결과 포맷에 gradingNoGrounding 예시 추가

**before** (§2.2 KB tool 결과 포맷 섹션):
```
<!-- 현재 gradingNoGrounding=true 시 출력 포맷에 대한 명시 없음 -->
```

**after** (§2.2 에 다음 블록 추가):
```markdown
#### `gradingNoGrounding=true` 시 tool_result 포맷

LLM grading 이 모든 후보를 "관련 근거 없음"으로 판정하면 KB tool 은 다음 포맷으로
tool_result 를 반환한다:

```json
{
  "kb": "<KB 이름>",
  "query": "<검색 쿼리>",
  "grounding": "none",
  "note": "Relevance grading found no passages in this knowledge base that ground the query. Do not fabricate an answer from this KB.",
  "results": []
}
```

`grounding: "none"` 신호를 받은 AI Agent 는 해당 KB 기반 답변을 생성하지 않고
"관련 근거 없음"을 명시한다 (환각 억제 §3.3.2).
```

### W7: spec §4.2 — cutoffApplied 의미 변경 명시

**before** (`cutoffApplied` 필드 설명):
```
cutoffApplied: boolean  // 점수 임계(θ) 컷이 적용됐으면 true
```

**after**:
```
cutoffApplied: boolean
// θ(score threshold) / token-budget / inject-cap 중 하나라도 후보를 탈락시켰으면 true.
// v1 변경: "θ 전용"에서 "세 컷 중 하나라도"로 의미 확장됨.
// 기존 소비자가 "cutoffApplied=true → 반드시 θ 컷"으로 해석하고 있다면 오탐 가능.
// 강등(fallback) 경로에서도 token-budget/inject-cap 컷 발생 시 true 가 반환된다.
```

**Rationale 에 추가**:
```
### v1 breaking note: cutoffApplied 의미 확장
RAG P1 D1 구현으로 `cutoffApplied` 는 "θ 컷" 단독에서 "θ / token-budget / inject-cap
세 컷 중 하나 이상 발동"으로 의미가 확장됐다. 기존 소비자는 이 필드의 의미를 재확인해야 한다.
```

### W8: spec §3.1 Rationale 또는 §7 — pgvector 인덱스 파라미터 follow-up 추가

**before** (§3.1 wide 회수 설명, Rationale):
```
<!-- wide 회수(LIMIT 50) 도입의 pgvector 인덱스 영향 언급 없음 -->
```

**after** (§3.1 Rationale 또는 §7 follow-up 섹션에 추가):
```markdown
#### pgvector 인덱스 파라미터 조정 (follow-up)

wide 회수(LIMIT 5 → LIMIT 50) 도입으로 pgvector ANN 스캔 대상이 증가한다.
`hnsw.ef_search`(기본값 40) 및 `ivfflat.probes`(기본값 1) 파라미터가
wide 회수 목표(50)에 적합한지 프로덕션 부하 측정 후 조정이 필요할 수 있다.

- hnsw: `ef_search ≥ LIMIT` 권장 (ef_search < LIMIT 시 재현율 저하)
- ivfflat: `probes` 값이 낮으면 50 회수 목표를 미달할 수 있음
- 조정이 필요하다면 KB 수준 config 또는 DB 세션 파라미터로 노출 (후속)
```
