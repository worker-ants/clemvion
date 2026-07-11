### 발견사항

- **[INFO]** 동일 spec 파일(`10-graph-rag.md`)을 대상으로 하는 다른 in-progress plan 미교차 참조
  - target 위치: `plan/in-progress/spec-draft-graph-rag-kb-token-stats-wontdo.md` "변경안" §1~§4 (KB-GR-EX-07/KB-GR-OB-01/NF-GR-05/§Rationale 편집 예고)
  - 관련 plan: `plan/in-progress/rag-dynamic-cut.md` "비차단 후속" 절 — "`10-graph-rag KB-GR-SR-05`(topK→동적 컷 표현)" 항목(체크 안 됨, `spec/5-system/9-rag-search.md` 등과 함께 `10-graph-rag.md` 를 후속 편집 대상으로 남겨둠). `plan/in-progress/rag-quality-improvement.md` 도 `10-graph-rag.md` 를 관련 spec 으로 참조.
  - 상세: 두 plan 모두 `10-graph-rag.md` 를 건드릴 예정이지만 대상 요구사항 ID 가 다르다 (target: EX-07/OB-01/NF-GR-05/Rationale, rag-dynamic-cut: SR-05/§3.4 표현). 실측 결과 `10-graph-rag.md:115` 의 KB-GR-SR-05 는 이미 "동적 점수 컷" 문구를 담고 있어 rag-dynamic-cut 의 해당 후속 항목은 사실상 이미 반영된 것으로 보이나 체크박스가 갱신되지 않은 상태(stale checkbox) — target 의 편집과 실질적으로 겹치는 라인은 없다.
  - 제안: 충돌은 없으므로 target 을 막을 필요는 없음. 다만 target 편집 시 §Rationale 절 신규 삽입 위치가 rag-dynamic-cut 의 (아직 미확정) 후속 편집과 같은 절을 건드릴 수 있으므로, target 커밋 후 `rag-dynamic-cut.md` 의 해당 stale 체크박스를 갱신(또는 이미 반영됐음을 주석)하는 것을 권장. (본 항목은 병렬 세션 충돌이 아니라 동일 파일을 목표로 하는 두 plan 문서 간 참조 누락이라 INFO 로 남김.)

### 요약

`spec-draft-graph-rag-kb-token-stats-wontdo.md` 는 이미 확정된 사용자 결정(2026-07-11, KB 단위 토큰 attribution 비목표)을 `10-graph-rag.md` 에 반영하는 정직화 작업이며, 근거로 인용한 `spec/data-flow/7-llm-usage.md` §Rationale "`llm_usage_log` 의 nullable context 컬럼들" 절(line 206-210, `GraphExtractionService` NULL = "의도된 누락")은 이미 main 에 병합된 별개 PR(#906/#910/#911, llm-usage-doc-alignment 시리즈)이 확정한 내용과 정확히 일치한다 — target 이 이 invariant 를 새로 만드는 것이 아니라 기존에 확정된 결정을 다른 spec 파일에 정합화하는 것이다. `plan/in-progress/**` 전수 검색 결과 KB 단위 토큰 attribution 도입을 전제하거나 이를 요구하는 미해결 결정·선행 조건은 없었고(`GraphExtractionService`/`LlmUsageLog` 를 언급하는 다른 in-progress plan 부재), `error-codes-catalog-sot.md` 가 참조하는 `10-graph-rag.md` 의 `KB_REEXTRACT_IN_PROGRESS` 도 target 의 편집 대상(§3.2/§3.7/§5 NF)과 겹치지 않는다. 유일하게 같은 spec 파일을 후속 대상으로 언급하는 `rag-dynamic-cut.md` 의 미체크 항목(KB-GR-SR-05)도 실측상 이미 반영된 stale checkbox 로 보이며 target 의 편집 라인과 충돌하지 않는다. 종합적으로 plan 정합성 관점에서 target 을 막을 사유가 없다.

### 위험도
NONE
