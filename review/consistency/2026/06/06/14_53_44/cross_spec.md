# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-rag-dynamic-cut.md`
검토 기준 영역: `spec/5-system/9-rag-search.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/5-system/17-agent-memory.md`, `spec/5-system/10-graph-rag.md`, `spec/1-data-model.md`

---

## 발견사항

### **[WARNING]** `ragTopK` 기본값 제거 — `1-ai-agent.md` §1 config 표와 충돌

- **target 위치**: draft §B1 — "기본값 칸 `5` 제거(공란 또는 '—')"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` 라인 40: `| ragTopK | Integer | | \`5\` | KB tool 호출 시 반환할 청크 수의 기본값 …`
- **상세**: draft 는 `ragTopK` 기본값 `5` 를 제거해 "선택적 상한 override" 로 의미를 바꾼다. 그런데 동일 파일 §1 config 표에서 `ragTopK` 의 기본값 컬럼이 `5` 로 명시되어 있다. draft §B2(config 예시 JSON)에서 `"ragTopK": 5` 라인은 유지하면서 설명만 추가하는 경우, 기본값 컬럼(`5`) 잔존과 설명 변경이 앞뒤가 맞지 않는 상태가 된다. draft §B1이 기본값 칸을 `—` 으로 비우고, §B2 예시 행에 "(선택 — 미지정 시 동적 컷)" 주석만 달 경우에는 일관되나, 이 변경이 실제 spec 편집 시 **config 표의 기본값 컬럼(4번째 열)**과 **예시 JSON 라인** 두 곳을 모두 수정해야 한다는 점이 명시되지 않으면 편집 누락 위험이 있다.
- **제안**: draft §B1/B2 지시에 "config 표 4번째 컬럼(기본값)을 `5`→`—`(또는 공란)으로 교체"와 "예시 JSON 행에 인접 주석 추가"를 각각 명시적으로 지정해 편집 누락 방지.

---

### **[WARNING]** `0-common.md` §2 `ragTopK` 설명의 "(기본: 5)" 문구 잔존 충돌

- **target 위치**: draft §C — `spec/4-nodes/3-ai/0-common.md` 라인 45 교체 지시
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/0-common.md` 라인 45: `| ragTopK | Integer | RAG 검색 결과 수 (기본: 5). graph 모드 KB 에서도 동일 …`
- **상세**: draft §C 는 해당 행을 교체 지시하고 있으나, 교체 후 텍스트에 "graph 모드 KB 에서도 동일" 문구는 유지된다. `0-common.md` §2 는 AI Agent 전용 필드를 정의하는 공통 규약이므로, graph 모드에서 `ragTopK` 가 동적 컷 하에서 어떻게 동작하는지(`§3.4` cross-ref) 가 반영되지 않으면 graph 경로(§E)와 설명이 어긋난다. 또한 draft §C 지시 텍스트 "graph 모드 KB 에서도 동일. (RAG 검색 §3.4)" 에서 'graph 모드 동일'의 의미가 "동적 컷도 동일하게 적용됨"인지 "상한 override 의미가 동일함"인지 모호하다.
- **제안**: draft §C 교체 텍스트에 "graph 모드 KB — vector seed/expanded 통합 결과 최종 주입 단계에 동일 동적 컷 적용" 을 명시하거나, `0-common.md §2` 의 표 하단 주석으로 graph 경로 동작을 짧게 기술.

---

### **[WARNING]** `17-agent-memory.md` §4 "기본값은 RAG 정합을 위해 동일(`5` / `0.7`)" 문구 — draft §D 의 갱신 범위가 일부만 처리

- **target 위치**: draft §D — `spec/5-system/17-agent-memory.md` 라인 83 교체 지시
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/17-agent-memory.md` 라인 83: `기본값은 RAG 정합을 위해 동일(\`5\` / \`0.7\`)하나 별도 필드다.`
- **상세**: draft §D 의 신규 서술은 라인 83을 교체하며 `ragTopK` 의 고정 기본값 없음을 반영하고 "RAG 정합" 문구를 제거한다. 그러나 동일 파일 **요구사항 절(AGM-05)**: `memoryTopK`/`memoryThreshold`의 독립성 서술 및 회수 파이프라인 §4 도입부에 "기본값은 RAG 정합을 위해 동일(`5` / `0.7`)" 맥락이 묵시적으로 여전히 residual comment 로 남아 있을 수 있다. draft §D 는 라인 83만 교체하고 동 파일의 다른 부위(예: §4 첫 문단의 "독립" 서술)는 건드리지 않는다고 볼 수 있으나, 향후 독자가 §4를 읽을 때 `ragTopK`의 고정 기본값 개념이 사라졌음을 알기 어려울 수 있다.
- **제안**: draft §D 에 "§4 `memoryTopK`/`memoryThreshold` 회수 전용 서술 부분에서 '기본값은 RAG 정합을 위해 동일' 문구의 완전 제거 여부를 확인" 지시를 추가하고, `ragTopK` 기본값 변경이 해당 파일의 다른 위치에도 영향을 미치지 않는지 명시.

---

### **[WARNING]** `10-graph-rag.md` §4.1 step [7] 및 §4.2 SQL `LIMIT $5` 라벨 — graph 회수 vs 주입 책임 분리 표현의 모호성

- **target 위치**: draft §E — graph-rag.md 라인 417, 471 교체 지시
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/10-graph-rag.md` 라인 417: `[7] 상위 ragTopK 만 컨텍스트에 주입`; 라인 471: `LIMIT $5;        -- ragTopK`
- **상세**: draft §E 는 라인 471 SQL 주석을 `-- 회수 폭(recall): vectorSeedTopK + expandedChunkLimit (최종 주입은 §3.4 동적 컷)` 으로 교체한다. 그런데 현재 graph-rag §4.2 SQL 의 `$5` 는 실제로 `ragTopK`(5) 였던 값이다. draft 는 graph SQL 의 LIMIT 가 회수 폭을 담당(즉, `$5` = `vectorSeedTopK + expandedChunkLimit`)이라고 서술하나, graph SQL 파라미터 표(현행 graph-rag 미포함)나 구현(`rag-search.service.ts`의 graph 분기)에서 `$5` 가 실제로 `vectorSeedTopK + expandedChunkLimit` 으로 이미 바인딩되는지, 아니면 여전히 `ragTopK` 를 바인딩하는지가 draft 에서 명확히 확정되지 않는다.
- **상세(계속)**: draft (W5) 보조 섹션에서 "graph 의 SQL `LIMIT` 는 회수 폭으로 그대로 유지 — D1 은 graph 의 회수를 바꾸지 않는다" 라고 하므로 `$5` 바인딩이 이미 `vectorSeedTopK + expandedChunkLimit` 일 경우 주석만 명확화하면 된다. 그러나 만약 `$5` 가 코드에서 `ragTopK(5)` 를 바인딩하고 있다면, 코드 변경 없이 주석만 바꾸면 spec-impl 불일치가 발생한다.
- **제안**: draft §E 교체 지시에 "graph SQL `$5` 바인딩이 실제로 `vectorSeedTopK + expandedChunkLimit` 인지 코드(`rag-search.service.ts`) 에서 확인 후 주석 교체" 조건을 추가. 만약 코드가 `ragTopK` 를 바인딩한다면 developer 단계에서 코드도 변경 필요.

---

### **[WARNING]** `9-rag-search.md` §3.3.1 `off` 행 "byte-identical" 폐기 — KnowledgeBase.rerank_mode 데이터 모델에는 반영 없음

- **target 위치**: draft §A8 — "왜 완전 선택적(off 기본)인가" Rationale 갱신, `byte-identical` 문구 제거
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` §3.3.1 `off` 행: "현행과 byte-identical (하위호환)" 및 Rationale "왜 완전 선택적(off 기본)인가": "하위호환 byte-identical"
- **상세**: draft 는 `off` 모드의 "byte-identical" 약속이 D1 도입으로 사라짐을 §A8 Rationale 에서 명시적으로 폐기하고, §A3 §3.3.1 off 행 서술도 교체한다. 이 변경 자체는 내적으로 일관되나, `spec/5-system/9-rag-search.md` 파일의 기존 **Rationale 절**(§305 근처: "왜 완전 선택적(off 기본)인가: (a) 하위호환 byte-identical")이 draft 의 갱신 지시 §A8 에 포함되어 있는지 확인 필요하다. draft 는 `spec/5-system/9-rag-search.md`가 아니라 `spec/5-system/9-rag-search.md` 에 추가할 Rationale 내용을 기술하는 형태이므로, 기존 Rationale의 "왜 완전 선택적인가" 항목 자체가 어디까지 삭제/교체되는지 경계가 명확하지 않다.
- **제안**: draft §A8 에 "기존 `9-rag-search.md § Rationale` 의 '왜 완전 선택적(off 기본)인가' 항목 전체를 교체(위치·경계 명시)" 지시 추가.

---

### **[INFO]** `9-rag-search.md` §2.1 KB tool 정의 — `top_k` description "Default: `<ragTopK>`" 갱신 미지시

- **target 위치**: draft §(W4/I2) 보조 섹션 — "라인 80 `\"Default: <ragTopK>\"` → 신규 텍스트" 갱신 언급
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` 라인 80: `"top_k": { "type": "integer", "description": "Default: <ragTopK>" }`
- **상세**: draft 보조 섹션(W4/I2)에 `9-rag-search.md` §2.1 의 `top_k` description 변경이 언급되나, 이것이 본 draft 의 어느 파트(§A 계열)에서 공식 편집 지시로 통합되는지 불명확하다. §A 섹션에는 명시적인 §2.1 편집 지시가 없다.
- **제안**: draft §A 파트에 "§2.1 KB tool 정의의 `top_k` description을 W4/I2 에서 정의한 신규 텍스트로 교체" 항목을 정식 편집 지시로 추가.

---

### **[INFO]** `9-rag-search.md` §3.3.1 `cross_encoder_llm` 행 — "항상 grading" vs "conditional escalate" 기존 v1 결정 연속성

- **target 위치**: draft §A3, §A4, §A8 (D2 conditional escalate)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` §3.3.2 v1 결정: "`cross_encoder_llm` 은 항상 LLM grading 을 수행한다"; §3.3.1 `cross_encoder_llm` 행: "**항상** listwise LLM grading 1콜 추가"
- **상세**: draft 는 §A3·§A4 에서 이 두 곳을 명시적으로 교체 지시하고 있으므로 충돌이 해소될 예정이다. 다만 draft §A8 "왜 D2 conditional escalate 를 지금 도입하나" Rationale에서 v1 결정 출처를 `plan/complete/spec-draft-rag-reranking.md §4.2` 로 인용하도록 했는데, 해당 완료 파일 내의 v1 결정이 "항상 grading" 으로 박혀 있어 독자가 두 문서를 교차 참조할 때 혼란이 없도록 `spec-draft-rag-reranking.md` 에 "(rag-dynamic-cut PR 에서 conditional escalate 로 번경됨)" 주석을 달거나 plan complete 문서에도 추기가 필요한지 검토 필요.
- **제안**: draft §A8 의 Rationale 인용 지시에 "plan/complete/spec-draft-rag-reranking.md 에 '이 결정은 rag-dynamic-cut PR 에서 conditional escalate 로 변경됨' 추기" 를 별도 §F 갱신 항목으로 추가 여부 검토.

---

### **[INFO]** `1-data-model.md` §2.11 `KnowledgeBase` — `rerank_candidate_k` 필드 설명 갱신 미지시

- **target 위치**: draft 전체 (§A5 §A2)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/1-data-model.md` §2.11: `| rerank_candidate_k | Integer | 리랭크에 투입할 1차 회수 후보 수 (default 50, 허용 범위 1~200). \`rerank_mode = 'off'\` 시 무시 |`
- **상세**: draft §A2 에서 off 경로의 SQL LIMIT 가 `RAG_RECALL_K(50)` 로 바뀐다. `data-model.md §2.11` 의 `rerank_candidate_k` 설명은 "rerank_mode='off' 시 무시" 라고 명시되어 있다. D1 이후에도 `rerank_mode='off'` 인 경우 `RAG_RECALL_K`(내부 상수) 를 쓰고 `rerank_candidate_k` 는 무시된다는 기존 서술은 여전히 정확하다. 그러나 두 경로(off/≠off) 모두 50개 회수라는 수치가 같아진다는 점과, `rerank_candidate_k` 가 off 경로와 완전히 무관한 독립 상수임을 강조하는 주석이 `data-model.md` 에도 있으면 좋다. 충돌은 아니나 동기화 권장.
- **제안**: draft §F 또는 §A 에 "1-data-model.md §2.11 `rerank_candidate_k` 설명에 '`off` 경로는 내부 상수 RAG_RECALL_K(50) 을 사용하며 본 필드와 독립' 한 줄 추가" 고려.

---

### **[INFO]** `9-rag-search.md` §4.2 `ragDiagnostics` — `cutoffApplied` 의미 확장 기존 스키마 정의와 정합

- **target 위치**: draft §A6 — `cutoffApplied` = rerank 점수 컷 / token-budget 컷 / inject-cap 컷 중 하나라도 적용 시 true (의미 확장)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` §4.2 `rerank` 서브객체: `"cutoffApplied": true` 필드 — 기존 정의는 rerank 점수 컷(rerank_score_threshold) 적용 여부를 나타냄
- **상세**: draft §A6(I11)에서 `cutoffApplied` 가 "token-budget 컷 / inject-cap 컷" 도 포함하도록 의미를 확장한다. 이는 기존 `rerank` 서브객체 안의 필드인데, token-budget/inject-cap 컷은 off 경로(cosine만 사용)에서도 적용된다. `rerank` 서브객체는 `rerank_mode ≠ off` 호출 시에만 출력된다고 §4.2 에서 명시되어 있어, off 경로에서 token-budget/inject-cap 이 적용됐을 때 `cutoffApplied` 를 담을 곳이 없다. draft §A6 는 "v1 미신설" 로 `dynamicCutApplied` 필드를 별도 신설하지 않기로 했으나, off 경로 동적 컷 적용 여부를 표현하는 진단 필드 부재가 `rerank` 서브객체 밖에서도 누락임을 명시적으로 허용하는 설계 선택인지 확인 필요.
- **제안**: draft §A6 에 "off 경로에서 token-budget/inject-cap 컷이 적용돼도 `rerank` 서브객체가 없어 `cutoffApplied` 가 노출되지 않음 — 이는 v1 의도적 생략(진단 schema 증식 회피)임을 명기" 한 줄 추가.

---

## 요약

target draft 는 RAG 동적 컷(D1)·conditional escalate(D2) 도입을 위해 5개 spec 파일을 갱신하는 일관된 설계 변경이다. Cross-spec 관점에서 직접 모순(CRITICAL)은 없다. 주요 WARNING 은 편집 세부 지시의 불완전성에서 발생한다: `ragTopK` 기본값 제거 지시가 config 표·예시 JSON 두 곳 모두를 명시하지 않은 점(B), graph SQL `$5` 바인딩의 현행 구현 확인 없이 주석만 교체하도록 지시한 점(E), `off` 행 "byte-identical" 폐기 Rationale 의 교체 경계가 불명확한 점(A8)이 편집 시 누락 위험을 낳는다. INFO 수준에서는 `9-rag-search.md §2.1` top_k description 갱신이 비공식 보조 섹션에만 언급됐고, `1-data-model.md` 의 동기화 주석이 미지시 상태다. 이 항목들을 draft 에서 명시적 편집 지시로 승격시키면 실제 spec 편집 시 일관성이 보장된다.

---

## 위험도

MEDIUM
