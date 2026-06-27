# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 착수 전 (--impl-prep)
**대상 문서**: `spec/2-navigation/6-config.md`
**검토 일시**: 2026-06-27

---

## 발견사항

### [INFO] NAV-CL-06 요구사항과 rerank 연결 테스트 미제공의 명시 차이
- **target 위치**: `spec/2-navigation/6-config.md §B.3` — "Test Connection 버튼 (chat·embedding 탭. rerank 미제공 — §B.6.2)"
- **충돌 대상**: `spec/2-navigation/_product-overview.md §3.7` — `NAV-CL-06 연결 테스트 기능 | 필수 | ✅`
- **상세**: PRD 요구사항 NAV-CL-06 은 "연결 테스트 기능" 을 단일 항목으로 ✅ 처리하나, 어느 kind(chat/embedding/rerank)에 적용되는지 명시하지 않는다. 구현 spec(`6-config.md §B.3·§B.6.2`) 은 rerank 는 표준 model-list API 부재로 연결 테스트를 미제공한다고 명시하며 별도 Rationale 을 제공한다. LLM Client spec(`spec/5-system/7-llm-client.md §2.1`) 도 rerank 연결 테스트 미제공을 동일하게 기술해 3-way 일관성은 있으나, PRD 수준의 NAV-CL-06 은 이 제한을 반영하지 않아 "✅ 완전 구현" 처럼 읽힌다.
- **제안**: `spec/2-navigation/_product-overview.md §3.7` 의 NAV-CL-06 설명을 "chat·embedding 연결 테스트 기능 (rerank 미제공)" 으로 구체화해 PRD 수준 요구사항과 구현 spec 의 결정을 동기화. 단, 현재 이 차이는 구현·동작에 영향이 없으므로 긴급도 낮음.

---

### [INFO] Model Config API 내 POST 작업 두 종의 권한 명시 누락
- **target 위치**: `spec/2-navigation/6-config.md §3 Model Config API` — "mutation (POST / PATCH / DELETE) 은 Editor+"
- **충돌 대상**: `spec/5-system/7-llm-client.md §5.5` — "preview-models 권한: editor 이상" 은 명시적이나, `POST /api/model-configs/:id/test` 의 개별 권한은 LLM Client spec 에서 미명시
- **상세**: target 문서의 "mutation = Editor+" 포괄 규칙은 `POST /:id/test`(연결 테스트)와 `POST /preview-models`(모델 목록 미리보기) 에도 적용된다. LLM Client spec 은 `preview-models` 의 `editor+` 권한만 개별 명시하고 `/:id/test` 는 포괄 규칙에 의존한다. 의미상 연결 테스트는 읽기 행위에 가깝지만 embedding probe 는 `ModelConfig.dimension` 자동 PATCH 저장을 수반하므로, POST 로 설계되고 Editor+ 가드를 받는 것은 합리적이다. 두 spec 사이에 실질적 모순은 없고, LLM Client spec 이 `/:id/test` 의 권한을 포괄 규칙에 위임하는 암묵적 패턴이 일관성 리스크다.
- **제안**: `spec/5-system/7-llm-client.md §8.3 testConnection` 항목에 "권한: editor 이상 (`POST /api/model-configs/:id/test`)" 한 줄을 추가해 preview-models 와 대칭적으로 명시. 구현 착수 전 필수 변경은 아님.

---

## 확인된 일관성 (주요 교차 검증 항목)

다음 항목들은 교차 검토 결과 충돌 없음을 확인했다.

| 검토 항목 | 참조 spec | 결과 |
|-----------|-----------|------|
| RBAC 매트릭스 — Auth Config Admin+ | `spec/5-system/1-auth.md §3.2` | 일치 |
| RBAC 매트릭스 — Model Config Editor+ | `spec/5-system/1-auth.md §3.2` | 일치 |
| ModelConfig.kind (chat/embedding/rerank) | `spec/1-data-model.md §2.16` | 일치 |
| Provider 허용 목록 (chat/embedding/rerank 각각) | `spec/1-data-model.md §2.16` · `spec/5-system/7-llm-client.md §2.1` | 일치 |
| ModelConfig.dimension = SoT, KnowledgeBase.embedding_dimension = 파생 캐시 | `spec/1-data-model.md §2.11·§2.16` · `spec/5-system/9-rag-search.md §5` | 일치 |
| `POST /api/model-configs/:id/test` 응답 shape | `spec/5-system/7-llm-client.md §8.3` | 일치 |
| `POST /api/model-configs/preview-models` body·권한 | `spec/5-system/7-llm-client.md §5.5` | 일치 |
| max_tokens 기본값 4096 (R-5 정정) | `spec/4-nodes/3-ai/1-ai-agent.md` (예시값 4096) | 일치 |
| AuthConfig 마스킹 정책 (`***<last4>`) SoT = 데이터 모델 §2.17.2 | `spec/1-data-model.md §2.17.2` | 일치 (target 이 SoT 를 포인터 참조) |
| Webhook ↔ AuthConfig wiring (`trigger.auth_config_id`) | `spec/5-system/12-webhook.md §3.2` | 일치 |
| `llm-model-config.controller.ts` forwardRef 해소 반영 | `spec/5-system/7-llm-client.md §8.3 Rationale` | frontmatter code 참조와 일치 |
| Audit log 액션 `auth_config.*` (구현됨) | `spec/5-system/1-auth.md §4.1` · `spec/data-flow/1-audit.md` | 일치 |
| Audit log 액션 `model_config.*` (Planned) | `spec/5-system/1-auth.md §4.1` | 일치 (target 이 언급 않음, 미구현 미래 항목이므로 무관) |
| set-default PATCH — kind 범위 단일 is_default | `spec/1-data-model.md §2.16` (`(workspace_id, kind)` partial unique) | 일치 |
| Navigation 구조 (Authentication 최상위, Models 별도 탭) | `spec/2-navigation/_product-overview.md §2·§3.6·§3.7` | 일치 (6-config.md 는 문서 조직상 합산이며 경로·메뉴는 각자 독립) |

---

## 요약

`spec/2-navigation/6-config.md` 는 데이터 모델(§2.16 ModelConfig, §2.17 AuthConfig), RBAC 매트릭스(Auth Config Admin+, Model Config Editor+), LLM Client API 계약(testConnection 응답 shape, preview-models 권한·보안), Webhook-AuthConfig wiring, max_tokens 기본값, 마스킹 정책 SoT 포인터 등 모든 주요 교차 참조 영역에서 다른 spec 과 일관된다. CRITICAL·WARNING 수준의 모순은 발견되지 않았다. INFO 항목 두 건은 각각 PRD 요구사항 설명의 세분화 누락(NAV-CL-06)과 LLM Client spec 내 testConnection 권한 개별 명시 누락으로, 구현 동작에 영향을 주지 않는 문서 동기화 권장 수준이다.

---

## 위험도

LOW

STATUS: OK
