# Cross-Spec 일관성 검토 결과

검토 범위: `spec/5-system/` (구현 완료 후 --impl-done, diff-base=origin/main)
검토일: 2026-06-05

---

## 발견사항

### [WARNING] AI Agent spec 의 `rerank_mode` 동작 "(Planned)" 레이블 미갱신
- **target 위치**: `spec/5-system/9-rag-search.md §3.3`, `spec/1-data-model.md §2.11 rerank_mode`, `spec/1-data-model.md §2.16.1 RerankConfig`
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/spec/4-nodes/3-ai/1-ai-agent.md` §1 설정 표 — `ragTopK` 및 `ragThreshold` 컬럼 설명
- **상세**:
  `spec/5-system/9-rag-search.md §3.3` 과 `spec/1-data-model.md §2.16.1` 은 `cross_encoder` · `cross_encoder_llm` 두 모드가 **구현됨** 으로 명시되어 있다. 반면 `spec/4-nodes/3-ai/1-ai-agent.md` 의 `ragTopK` 행에는 `KB rerank_mode ≠ off (Planned)`, `ragThreshold` 행에도 동일한 `(Planned)` 레이블이 남아 있어 구현 완료 사실과 모순된다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` 표의 `ragTopK` / `ragThreshold` 설명에서 `(Planned)` 를 제거하고 "(구현됨 — 마이그레이션 V082)" 등으로 현행화한다.

---

### [INFO] `spec/0-overview.md §6.1 구현 완료` 에 Rerank 기능 미등재
- **target 위치**: `spec/5-system/9-rag-search.md §3.3`, `spec/1-data-model.md §2.16.1`
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/spec/0-overview.md §6.1 구현 완료`
- **상세**:
  `spec/0-overview.md §6.1` 의 AI 플랫폼 행은 `LLM Config`, `Knowledge Base`, `Graph RAG` 를 명시하지만 **RerankConfig / 리랭킹(cross-encoder) 기능**이 빠져 있다. `spec/1-data-model.md §2.16.1` 과 `spec/5-system/9-rag-search.md §3.3` 이 두 모드 모두 구현 완료로 선언하는 것과 불일치한다.
- **제안**: `spec/0-overview.md §6.1` AI 플랫폼 행에 "**Rerank**(KB 단위 cross-encoder / cross-encoder+LLM 리랭킹 — 상세: `spec/5-system/9-rag-search.md §3.3`)" 를 추가한다.

---

### [INFO] Audit Log 카탈로그에 `rerank_config.reveal` 부재 — `llm_config.*` 와 대칭 불일치
- **target 위치**: `spec/5-system/1-auth.md §4.1 기록 대상 액션` 설정 카테고리 행
- **충돌 대상**: `spec/5-system/1-auth.md §3.2 리소스별 권한 매트릭스` — Rerank Config 행이 `Owner/Admin: CRUD`, `Editor/Viewer: R` 임
- **상세**:
  `spec/5-system/1-auth.md §4.1` 의 설정 카테고리에는 `llm_config.*` (와일드카드) 는 있으나 `rerank_config.*` 는 `create`·`update`·`delete` 세 항목만 등재되고 `regenerate`·`reveal` 이 없다. `rerank_config` 에는 `api_key` (암호화된 필드) 가 있으므로 `reveal` 액션이 향후 도입될 가능성이 있다. 현재 spec 이 `llm_config.*` 처럼 `rerank_config.*` 와일드카드로 통일하지 않고 3개만 명시한 것이 의도인지 불분명하다.
- **제안**: 의도적으로 reveal 미지원이면 Rationale 또는 각주에 명시한다. `llm_config.*` 와 동일하게 `rerank_config.*` 로 통일하는 것도 간단한 동기화 방법이다.

---

## 요약

`spec/5-system/` 의 RAG 리랭킹 관련 신규 spec(RerankConfig 데이터 모델, KB rerank_* 컬럼, RAG 검색 §3.3 후처리 흐름)은 내부적으로 일관되어 있다. 데이터 모델(`spec/1-data-model.md §2.11·§2.16.1`), 검색 엔진(`spec/5-system/9-rag-search.md §3.3`), 설정 화면(`spec/2-navigation/6-config.md Part C`), RBAC 매트릭스·감사 로그(`spec/5-system/1-auth.md §3.2·§4.1`), LLM 클라이언트(`spec/5-system/7-llm-client.md §3.6·§4.1`) 간 교차 참조가 올바르게 걸려 있다. 마이그레이션 버전 번호(V081/V082)도 spec 과 실제 파일이 일치한다. 발견된 문제는 두 가지 INFO 수준의 현행화 누락과, 하나의 WARNING(AI Agent spec 에 남아 있는 `(Planned)` 레이블)이다. 후자는 `spec/4-nodes/3-ai/1-ai-agent.md` 에만 영향을 주는 단순 문서 오류로, 실제 기능 동작이나 API 계약에 모순을 유발하지 않는다.

---

## 위험도

LOW

STATUS: SUCCESS
