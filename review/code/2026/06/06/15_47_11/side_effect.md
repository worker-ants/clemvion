# 부작용(Side Effect) 리뷰 결과

## 리뷰 대상

`spec/5-system/9-rag-search.md` — RAG 동적 점수 컷(D1) 및 conditional escalate(D2) spec 반영 변경

---

## 발견사항

### **[INFO]** `ragTopK` 기본값 제거 — 호출자 동작 변경 가능성

- 위치: diff §2.1 `top_k` 설명 변경 + Rationale "왜 `ragTopK` 기본값(5)을 제거했나"
- 상세: 기존 spec 은 `top_k` 의 기본값을 5(`ragTopK` 노드 config 기본값)로 명시했으나, 변경 후 `top_k` 는 선택적 상한 override 가 되고 미지정 시 동적 컷(ceiling 12)이 지배한다. 이는 spec 레벨의 공개 인터페이스 의미 변경이다. `ragTopK` 를 설정하지 않은 기존 노드는 종전 5건 주입에서 최대 12건(토큰 예산 내)으로 주입 청크 수가 증가할 수 있다. LLM 컨텍스트 볼륨 변화 → 지연·토큰 비용 증가가 side effect 로 발생할 수 있다.
- 제안: 이 동작 변화는 명시적으로 의도된 것이며 spec 의 Rationale 에서 정당화하고 있으므로 차단 사항은 아니다. 다만 구현 시 기존 `ragTopK=5` 하드코딩 경로가 그대로 남아 있을 경우 spec-impl 불일치가 발생하므로, `ragTopK` 가 null/undefined 일 때 `RAG_MAX_INJECT_COUNT`(12) ceiling 으로 분기하는 구현을 반드시 확인해야 한다.

---

### **[INFO]** `cutoffApplied` 필드 의미 확장 — 기존 소비자 해석 변경

- 위치: diff §4.2 `cutoffApplied` 설명 변경
- 상세: 기존 `cutoffApplied` 는 rerank 점수 컷에 한정된 의미였으나, 변경 후 "rerank 점수 컷 / token-budget 컷 / inject-cap 컷 어느 것이든 적용 시 true" 로 의미가 확장되었다. `cutoffApplied=false` 를 "어떤 컷도 없었다"로 해석하던 클라이언트(예: 모니터링·대시보드·테스트)는 이전과 동일한 의미를 유지하므로 깨지지 않는다. 그러나 `cutoffApplied=true` 를 "rerank 점수 컷이 있었다"라는 협의로 가정하던 코드가 있다면 오판 가능성이 있다.
- 제안: 기존 소비자 코드에서 `cutoffApplied` 를 좁게 해석하는 분기가 없는지 확인 필요. spec 은 의도적 확장임을 명시하고 있으므로 구현·테스트 레벨에서 일치 여부를 점검한다.

---

### **[INFO]** `gradingNoGrounding` 신규 필드 추가 — 기존 API 소비자 영향 없음

- 위치: diff §4.2 `ragDiagnostics.rerank` 스키마에 `gradingNoGrounding: false` 추가
- 상세: 기존 소비자는 이 필드를 모르므로 무시한다. 추가적 이벤트/콜백 부작용 없음. 신규 필드이므로 직렬화(JSON) 상 하위 호환이다.
- 제안: 없음. 안전한 추가.

---

### **[INFO]** off 경로 SQL LIMIT 변경 — DB 쿼리 볼륨 증가

- 위치: diff §3.1 `$4` 파라미터 설명 변경 (5 → `RAG_RECALL_K`=50)
- 상세: `rerank_mode=off` 의 기본 SQL LIMIT 이 5에서 50으로 증가한다. 이는 의도된 "회수 폭 확대"이나, pgvector 스캔 범위 증가로 DB I/O 가 약 10배 늘어나는 부작용이 있다. 동적 컷이 최종 주입 수를 제한하지만 DB 쿼리 자체의 볼륨 증가는 회피되지 않는다.
- 제안: spec 에 이미 근거(CAR 지연 -22%)가 제시되어 있으므로 차단 사항 아님. 구현 시 pgvector 인덱스(IVFFlat/HNSW)의 `ef_search`·`probes` 파라미터가 LIMIT 50에 적절히 설정되었는지 확인하고, 고부하 환경에서 회수 폭 증가가 실제 P99 지연에 미치는 영향을 모니터링 지표로 추적하도록 한다.

---

### **[INFO]** `cross_encoder_llm` 동작 변경 (항상 grading → conditional escalate) — 기존 구현 회귀 가능성

- 위치: diff §3.3.1·§3.3.2 `cross_encoder_llm` 설명 변경
- 상세: 기존 spec 은 "`cross_encoder_llm` 은 항상 LLM grading 수행"이었으나, 변경 후 "조건부 escalate — 상위 점수 평탄/모호할 때만"으로 변경되었다. 이미 "항상 grading" 으로 구현된 코드가 있다면 spec-impl 불일치가 된다. `llmGradingApplied=true` 를 기대하는 테스트도 조건부 false 케이스를 추가로 커버해야 한다.
- 제안: 기존 구현의 `cross_encoder_llm` 경로가 항상 grading 으로 되어 있다면 conditional escalate 분기 추가가 필요하다. spec Rationale 은 이 변경이 "v1 동작의 부분집합(escalate 안 되면 cross-encoder 결과 유지)"이므로 회귀 안전하다고 설명한다.

---

## 요약

이번 변경은 spec 문서 전용 변경으로, 코드 실행 부작용(전역 변수·파일시스템·네트워크 호출·환경 변수)은 발생하지 않는다. 주요 side effect 는 인터페이스 의미 변경 두 가지다: (1) `ragTopK` 기본값 5 제거로 미지정 노드의 최종 주입 청크 수가 최대 12까지 늘어날 수 있어 LLM 컨텍스트 볼륨·비용이 증가하고, (2) `cross_encoder_llm` 이 항상 grading 에서 조건부 escalate 로 변경되어 기존 구현 코드와 테스트에 spec-impl 불일치가 생길 수 있다. `cutoffApplied` 의미 확장과 `gradingNoGrounding` 신규 필드는 하위 호환적이다. off 경로의 SQL LIMIT 5→50 증가는 의도된 회수 폭 확대이나 DB I/O 볼륨 증가를 동반하므로 운영 모니터링이 필요하다. 모두 spec 내에서 Rationale 로 정당화되어 있으며 의도치 않은 부작용은 없다.

---

## 위험도

LOW
