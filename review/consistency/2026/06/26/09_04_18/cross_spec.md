# Cross-Spec 일관성 검토 결과

**대상**: `spec/2-navigation/6-config.md`
**검토 모드**: `--impl-prep` (구현 착수 전)
**검토 일시**: 2026-06-26

---

## 발견사항

### [INFO] NAV-CL-* 요구사항 ID 가 Chat 전용 범위로 남아 있음

- **target 위치**: `spec/2-navigation/6-config.md §B.5 Embedding 탭`, `§B.6 Rerank 탭`
- **충돌 대상**: `spec/2-navigation/_product-overview.md §3.7 Config — Models`
- **상세**: PRD `§3.7` 의 요구사항 ID (NAV-CL-01 ~ NAV-CL-06) 는 모두 "AI 노드에서 사용할 LLM 프로바이더 설정" 등 Chat 모델 관리에 한정된 서술이다. `6-config.md` 가 Chat / Embedding / Rerank 세 탭을 단일 Models 화면으로 통합(R-3 번복)했음에도, Embedding 모델 관리(`kind=embedding` ModelConfig)와 Rerank 모델 관리(`kind=rerank` ModelConfig)에 대응하는 공식 NAV-* 요구사항 ID 가 PRD 에 존재하지 않는다. 직접 모순은 아니나 PRD 요구사항 ID 커버리지가 통합 이전 스코프에 멈춰 있다.
- **제안**: `_product-overview.md §3.7` 을 `spec/2-navigation/6-config.md` 변경과 함께 갱신하거나, 현행 상태를 "구현 완료 후 PRD 소급 갱신" 으로 명시하면 충분하다. 구현 차단 사안 아님.

---

### [INFO] `_product-overview.md §3.6` 주석과 `6-config.md` 스펙 범위의 조직 방식 차이

- **target 위치**: `spec/2-navigation/6-config.md` 문서 제목·Overview ("인증, Models 화면 묶음")
- **충돌 대상**: `spec/2-navigation/_product-overview.md §3.6` 주석 ("Authentication은 Config 서브메뉴가 아닌 최상위 메뉴로 노출된다 (경로: `/authentication`)")
- **상세**: PRD 주석은 Authentication 이 `/authentication`, Models 가 `/models` 로 별개 라우트임을 명시한다. `6-config.md` 는 두 영역을 하나의 spec 파일에 묶어 "설정 (인증, Models) 화면" 으로 서술한다. `code:` frontmatter 에는 두 경로가 모두 나열(`/authentication/**`, `/models/page.tsx`)되어 있어 실제 라우트 분리는 명확하다. 충돌이 아닌 편집상 묶음이나, 신규 기여자가 두 경로를 단일 URL 로 오해할 수 있다.
- **제안**: `6-config.md` Overview 에 두 라우트(`/authentication`, `/models`)가 별개 URL 임을 한 줄 명시하면 혼란을 예방한다. 구현 차단 아님.

---

## 요약

`spec/2-navigation/6-config.md` 는 기존 spec 과 전체적으로 정합적이다. 데이터 모델(`spec/1-data-model.md §2.16 ModelConfig`, `§2.17 AuthConfig`)의 필드 정의·제약·참조 관계와 일치하고, API 엔드포인트(`/api/model-configs`, `/api/auth-configs` 전 경로)는 `spec/5-system/7-llm-client.md`, `spec/data-flow/7-llm-usage.md`, `spec/conventions/audit-actions.md` 가 교차 참조하는 내용과 모순이 없다. RBAC(ModelConfig = Editor+, AuthConfig = Admin+)는 `spec/5-system/1-auth.md §3.2` 매트릭스와 일치한다. 프로바이더 집합(Chat 5종, Embedding 4종 Anthropic 제외, Rerank tei/cohere)은 `7-llm-client.md §2` 와 정확히 대응하며, 임베딩 차원 SoT 체인(`ModelConfig.dimension` → `KnowledgeBase.embedding_dimension` 파생 캐시)은 `8-embedding-pipeline.md` 와 `9-rag-search.md` 가 동일하게 기술한다. `max_tokens` 기본값 4096 은 `spec/4-nodes/3-ai/1-ai-agent.md` (줄 129, 674)와 일치한다. 발견된 두 항목은 모두 INFO 수준의 PRD 커버리지 갭·편집 명확성 개선 권고이며, 구현 차단 또는 설계 모순에 해당하는 CRITICAL/WARNING 항목은 없다.

## 위험도

LOW

STATUS: OK
