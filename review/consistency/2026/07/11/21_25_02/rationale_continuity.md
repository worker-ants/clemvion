# Rationale 연속성 검토 결과

## 대상
- target: `plan/in-progress/spec-draft-graph-rag-kb-token-stats-wontdo.md`
- 관련 spec: `spec/5-system/10-graph-rag.md`, `spec/data-flow/7-llm-usage.md`, `spec/1-data-model.md §2.24`

## 발견사항

- **[INFO]** 신설 비목표 항목이 `spec/5-system/10-graph-rag.md` 자체의 기존 "비목표" 이중 목록에는 미반영
  - target 위치: "변경안" §4 (`§Rationale 신규 항목`)
  - 과거 결정 출처: `spec/5-system/10-graph-rag.md` 본문 `## 8. 비-목표`(:578-584, Entity disambiguation·Cross-KB linking·Graph embedding·자동 prompt tuning 나열) 및 `## Rationale` 하위 `#### 비-목표 (범위 밖)`(:619-622, GraphRAG community detection·Apache AGE/Neo4j·룰 기반 추출 나열)
  - 상세: 이 문서는 "비목표"를 기록하는 자리를 이미 두 곳(본문 §8 목록, Rationale 하위 목록)으로 확립해 두고 있다. target 은 KB 단위 토큰 attribution/누적 표시라는 새 비목표를 요구사항 표(⛔ 마킹) + 신규 Rationale 항목으로만 반영할 계획이고, 기존 두 "비목표" 목록에는 대응 bullet 을 추가하지 않는다. 과거 결정을 뒤집거나 원칙을 위반하는 것은 아니지만, 문서 자체가 이미 확립한 비목표 기록 관행과 완전히 정합하지는 않아 향후 §8/Rationale 비목표 목록만 훑는 독자에게는 이 결정이 누락돼 보일 수 있다.
  - 제안: (4) 변경안에 `## 8. 비-목표` 목록(또는 성격상 "별도 제품 결정 시 재검토 가능"이므로 Overview `### 8. 미결 / 후속 검토`, :197-202)에 "KB 단위 토큰 attribution/누적 표시 — LlmUsageLog KB FK 부재 + GraphExtractionService context 의도된 NULL(data-flow §7)로 비목표" 1줄을 추가해 목록 간 정합을 맞출 것을 권장 (필수는 아님, 정합 보완).

## 정합 확인 (충돌 없음)

교차검증 결과 target 이 과거 Rationale 을 뒤집거나 기각된 대안을 재도입하는 지점은 발견되지 않았다.

1. **핵심 근거의 실재성 확인**: target 이 인용한 `spec/data-flow/7-llm-usage.md §Rationale "llm_usage_log 의 nullable context 컬럼들"`(:189-210)은 실제로 "`GraphExtractionService`(...)는 워크플로우 **밖** 호출이라 애초에 노드 컨텍스트가 없는 caller... (a)는 **의도된 누락**"이라고 명시한다. target 의 "KB attribution 은 이 invariant 와 상충" 판단은 이 문구와 정확히 일치하며 지어낸 근거가 아니다.
2. **번복 아닌 최초 정직화**: `spec/5-system/10-graph-rag.md`(:587-623)의 기존 `## Rationale`에는 "Graph RAG 기획 결정"(모드 2종·자동 chained·모드 불변·검색 파라미터·추출 LLM 분리)만 있고, KB 단위 토큰 attribution/누적 표시를 채택하겠다는 과거 Rationale 항목은 존재하지 않는다. KB-GR-EX-07/NF-GR-05 의 ✅ 표기는 근거 있는 Rationale 결정이 아니라 미실증 오기재였던 것으로 보이며(target §실증 이 코드 grep 으로 실증), target 의 변경은 "합의된 결정의 번복"이 아니라 "결정된 적 없는 상태의 정직화"에 해당한다.
3. **`status: implemented` 유지 근거의 저장소 선례 정합**: `spec/2-navigation/14-execution-history.md §Rationale R-6`(EH-DETAIL-06/12)이 "v2 항목은 저장소 선례(Graph RAG·conversation-thread v2)대로 `0-overview.md §6.3` 로드맵에 미러 등재해 추적한다(`partial`+`pending_plans` 전환 불요)"는 패턴을 이미 확립했다. 단, `0-overview.md §6.3`(`#### 6.3 로드맵 / 미구현 (❌)`, :90-95)는 "미구현이나 계획된" 항목(❌) 전용이며 target 의 KB 토큰 통계는 "영구 비목표"(⛔)로 이 절의 성격과는 다르다 — §6.3 미러 등재를 강제할 근거는 아니며, `status: implemented` 유지 자체는 이 선례와 상충하지 않는다.
4. **데이터 모델 무결성 재확인**: `spec/1-data-model.md §2.24 LlmUsageLog`(:826)에 `knowledge_base_id`/`document_id` FK 가 없고 부모가 Workspace 인 것을 재확인 — target §실증 표의 주장과 일치.
5. **WS/타 spec 교차 검증**: `spec/5-system/6-websocket-protocol.md §4.3`(:739) 및 graph-rag `## 6. WebSocket 이벤트`(:539-548)의 `document:graph_progress`/`_completed` payload 에 token 필드 없음을 확인 — target §실증 표와 일치. `NF-GR-05`/`KB-GR-EX-07`/`KB-GR-OB-01` 세 ID 는 `spec/5-system/10-graph-rag.md` 외 어떤 spec 에서도 참조되지 않아(grep 0건) dangling reference 위험도 없다.
6. **새 Rationale 작성 의무 충족**: target 변경안 (4)가 "과거 결정을 뒤집으면서 새 Rationale 를 함께 작성"하는 요건을 충족 — data-flow §7 invariant 를 명시적으로 cross-ref 하며 비목표 근거를 남긴다.

## 요약

target 은 KB 단위 토큰 통계를 "합의된 결정을 뒤집는" 변경이 아니라, `spec/data-flow/7-llm-usage.md §Rationale`에 이미 기록된 "GraphExtractionService context 의도된 NULL" invariant 에 맞춰 잘못 표기된 ✅ 상태를 정직화하는 방향으로 조정한다. 인용한 Rationale 문구는 실제 spec 원문과 정확히 일치하며, 새 비목표 결정에 대한 근거(§Rationale 신규 항목)도 함께 작성하도록 계획돼 있어 "결정의 무근거 번복"에 해당하지 않는다. `status: implemented` 유지 판단도 유사 사례(EH-DETAIL-06/12, `0-overview.md §6.3`)와 상충하지 않는다. 유일한 보완 여지는 graph-rag.md 자체가 이미 갖고 있는 두 "비목표" 목록(본문 §8, Rationale 하위)에 신규 비목표 항목이 함께 등재되지 않는 점으로, 이는 정합 완성도 제안(INFO) 수준이며 CRITICAL/WARNING 급 충돌은 없다.

## 위험도

LOW
