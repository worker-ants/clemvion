# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/` (구현 완료 후 검토, diff-base=origin/main)

---

## 발견사항

### [INFO] RBAC 매트릭스에 RerankConfig 미등록
- target 위치: `spec/5-system/9-rag-search.md §3.3` 및 `spec/1-data-model.md §2.16.1`
- 충돌 대상: `spec/5-system/1-auth.md §3.2 리소스별 권한 매트릭스`
- 상세: `1-auth.md` 권한 매트릭스에 `LLM Config` 행은 있으나 신규 `RerankConfig` 리소스 행이 없다. RerankConfig 는 워크스페이스 단위 리소스로 LLMConfig 와 동일 패턴(Admin CRUD, Editor/Viewer R)을 따를 것이 합리적이지만, 현재 매트릭스에 명시되어 있지 않아 RBAC 적용 근거가 불분명하다. 이미 `spec/2-navigation/5-knowledge-base.md` 는 KB 폼에서 RerankConfig 선택을 노출하므로 실 사용자 접근이 발생한다.
- 제안: `spec/5-system/1-auth.md §3.2` 매트릭스에 `| Rerank Config | CRUD | CRUD | R | R |` 행 추가 (LLM Config 와 동일 패턴).

---

### [INFO] 감사 로그 대상 액션에 rerank_config.* 미등록
- target 위치: `spec/5-system/9-rag-search.md §3.3`
- 충돌 대상: `spec/5-system/1-auth.md §4.1 기록 대상 액션`
- 상세: `1-auth.md §4.1` 의 감사 로그 대상 테이블에 `auth_config.*` / `llm_config.*` 는 등재되어 있으나 `rerank_config.*` 는 없다. RerankConfig 가 API Key (비밀 자격증명) 를 저장하는 LLMConfig 와 동일 보안 수준의 리소스임에도 감사 이벤트가 정의되지 않아 보안 가시성 공백이 발생한다.
- 제안: `spec/5-system/1-auth.md §4.1` 설정 카테고리에 `rerank_config.create, rerank_config.update, rerank_config.delete` 추가. LLMConfig 와 동일 취급.

---

### [INFO] data-model §2.16.1 섹션 제목에 "(Planned)" 표기 잔존
- target 위치: `spec/1-data-model.md §2.16.1`
- 충돌 대상: `spec/5-system/7-llm-client.md §3.6` (Planned 표기 제거 완료), `spec/5-system/9-rag-search.md §3.3` (v1 구현됨으로 갱신 완료)
- 상세: `spec/5-system/7-llm-client.md` 에서는 `### 3.6 RerankClient (Planned)` → `### 3.6 RerankClient` 로 제거됐고, `spec/5-system/9-rag-search.md` 에서도 상태 표기가 "v1 구현됨"으로 갱신됐다. 반면 `spec/1-data-model.md §2.16.1` 의 섹션 제목은 여전히 `### 2.16.1 RerankConfig (Planned)` 로 남아 구현 완료 상태와 불일치한다.
- 제안: `spec/1-data-model.md` 의 `### 2.16.1 RerankConfig (Planned)` → `### 2.16.1 RerankConfig` 로 수정. 단, `rerank_llm_config_id` 컬럼 설명의 "(후속)" 표기는 cross_encoder_llm 이 아직 미구현이므로 유지.

---

### [INFO] spec/2-navigation/5-knowledge-base.md 리랭킹 항목에 "(Planned, 선택)" 표기 잔존
- target 위치: `spec/5-system/9-rag-search.md §3.3` (v1 구현됨)
- 충돌 대상: `spec/2-navigation/5-knowledge-base.md §KB 편집 폼 리랭킹 항목`
- 상세: `spec/2-navigation/5-knowledge-base.md` 는 이번 diff 에서 relative path 수정(링크 경로 `../5-system/` → `../../5-system/`)만 이루어졌고 "(Planned, 선택)" 표기는 그대로 남아 있다. RAG 검색 spec 과 LLM Client spec 에서는 v1 구현됨으로 갱신된 것과 명시적으로 불일치한다.
- 제안: `spec/2-navigation/5-knowledge-base.md` 의 리랭킹 행 `(Planned, 선택)` → `(선택, Cross-encoder v1 구현됨; Cross-encoder + LLM 후속)` 으로 동기화.

---

### [INFO] Integration 인덱스 기술 — data-model §3 과 9-rag-search 제외 영역 내 기술 불일치 (범위 외 but 동 diff 내 발견)
- target 위치: `spec/1-data-model.md §3 인덱스 테이블` (Integration mall_id 인덱스 행 2건)
- 충돌 대상: `spec/1-data-model.md §2.10 Integration mall_id 컬럼 설명`
- 상세: 이번 diff 로 data-model §3 의 Integration 인덱스 설명이 "통일 partial UNIQUE (service_type 무관)" → "병렬 partial UNIQUE (cafe24 / makeshop 각각)" 으로 변경되었으나, §2.10 의 `mall_id` 컬럼 설명은 "둘 다 `(workspace_id, mall_id) WHERE service_type=<service>` 병렬 partial UNIQUE 인덱스로"로 갱신된 반면, 이전 문장 일부 ("service_type 무관 — 신규 통합은 인덱스 추가 불필요")는 제거되었다. §3 의 V072 참조도 V046/V071 로 분리됐다. 두 섹션 간 기술이 이제 일관되어 충돌은 없으나, 이 변경이 spec/2-navigation/4-integration.md 의 V072 참조와 동기화됐는지 확인이 권장된다.
- 제안: `spec/2-navigation/4-integration.md` 에 V072 관련 설명이 있다면 V046/V071 분리 인덱스 방식으로 동기화 여부 확인.

---

## 요약

`spec/5-system/` 의 이번 변경(RAG rerank v1 구현 완료 반영)은 기존 spec 과 직접 모순되는 사항이 없다. 주요 관련 문서(`spec/1-data-model.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/9-rag-search.md`, `spec/4-nodes/3-ai/1-ai-agent.md`)가 일관되게 갱신되었다. 다만 신규 `RerankConfig` 리소스가 RBAC 매트릭스(`spec/5-system/1-auth.md §3.2`)와 감사 로그 대상 테이블(`§4.1`)에 등재되지 않은 점이 권한 정책 명확화 측면에서 동기화가 필요한 구멍으로 남아 있다. 추가로 `spec/1-data-model.md §2.16.1` 섹션 제목과 `spec/2-navigation/5-knowledge-base.md` 의 "(Planned)" 표기 잔존도 명확성 향상을 위해 정리가 권장된다. 모두 INFO 등급 — 즉각적 동작 불가 수준의 모순은 발견되지 않았다.

---

## 위험도

LOW
