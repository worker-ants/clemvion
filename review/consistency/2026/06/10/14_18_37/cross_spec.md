# Cross-Spec 일관성 검토 결과

target: `plan/in-progress/spec-draft-unified-model-management.md`
검토일: 2026-06-10

---

## 발견사항

### 데이터 모델 충돌

- **[WARNING]** `spec/1-data-model.md §2.11 KnowledgeBase` — chat kind FK 컬럼 설명 텍스트 미갱신
  - target 위치: 변경 1 §2.16.1 삭제 절 + "영향 없음(확인)" 절
  - 충돌 대상: `/spec/1-data-model.md` §2.11 KnowledgeBase 표 (`rerank_llm_config_id UUID? FK → LLMConfig`, `extraction_llm_config_id UUID? FK → LLMConfig`)
  - 상세: target 은 UUID 보존이므로 `rerank_llm_config_id` / `extraction_llm_config_id` 의 데이터가 무변경이라 "영향 없음" 으로 처리한다. 그러나 테이블명이 `llm_config → model_config` 로 rename 되면 이 두 컬럼의 FK 타깃 기술(`FK → LLMConfig`)이 거짓이 된다. Spec 텍스트가 틀린 상태로 남으면 독자가 FK 대상 테이블을 잘못 이해한다.
  - 제안: 변경 3 표에 `spec/1-data-model.md §2.11 rerank_llm_config_id / extraction_llm_config_id` 행 추가 — FK 타깃 설명을 `FK → ModelConfig (kind=chat)` 으로 텍스트 갱신 (데이터 변경 없음, 설명 동기화만).

- **[WARNING]** `spec/1-data-model.md §2.20 AssistantSession / §2.16 LLMUsageLog` — `llm_config_id FK → LLMConfig` 설명 텍스트 잔존
  - target 위치: "영향 없음(확인)" 절 — "UUID 보존으로 무변경"
  - 충돌 대상: `/spec/1-data-model.md` §2.20 AssistantSession (`llm_config_id UUID? FK → LLMConfig`) + `llm_usage_log.llm_config_id` 참조 기술
  - 상세: 위와 동일 패턴. UUID 는 보존되나 FK 타깃 텍스트가 rename 후 거짓이 된다.
  - 제안: 변경 3 갱신 대상 목록에 §2.20 및 llm_usage_log FK 설명 갱신(`FK → ModelConfig kind=chat`)을 추가.

- **[INFO]** `spec/1-data-model.md §1 엔티티 관계 개요` — ERD 트리에 `LLMConfig`, `RerankConfig` 잔존
  - target 위치: 변경 1 (§2.16 통합 선언)
  - 충돌 대상: `/spec/1-data-model.md` §1 ASCII ERD — `├── LLMConfig (1:N)`, `├── RerankConfig (1:N)` 두 행
  - 상세: 변경 1 적용 후 ERD 는 `ModelConfig (1:N)` 단일 행이어야 한다. 기존 ERD 는 변경 미반영.
  - 제안: `spec/1-data-model.md §1` ERD 를 `ModelConfig (1:N)` 한 행으로 통합.

- **[INFO]** `spec/data-flow/6-knowledge-base.md §2.1 Schema 매핑` — 마이그레이션 버전 참조 갱신 필요
  - target 위치: 변경 3 표 "spec/data-flow/6-knowledge-base.md §1.1/§1.2/§2 (4곳)"
  - 충돌 대상: `/spec/data-flow/6-knowledge-base.md` §2.1 표 행 `embedding_llm_config_id? (V029)`
  - 상세: target 이 4곳 갱신을 명시해 의도는 충돌 아님. 다만 §2.1 표의 V029 마이그레이션 참조를 V091 로 함께 정리해야 한다.
  - 제안: 변경 3 적용 시 §2.1 표 해당 행의 마이그레이션 버전 참조를 V091 로 갱신.

---

### API 계약 충돌

- **[WARNING]** `spec/2-navigation/6-config.md §3` — deprecation alias 범위·제거 시점 미정의
  - target 위치: 변경 2 §3 API — "구 엔드포인트 `/api/llm-configs`·`/api/rerank-configs` 는 deprecation alias 로 한시 유지, 후속 PR에서 제거"
  - 충돌 대상: `/spec/2-navigation/6-config.md` §3 LLM Config API / Rerank Config API (lines 241-266)
  - 상세: 기존 spec 은 `/api/llm-configs` / `/api/rerank-configs` 를 정식 API 로 기술한다. target 이 alias 를 선언하나 어떤 엔드포인트(서브경로 포함)가 alias 범위에 들어가는지 완전 목록이 없고, 제거 PR 번호·시점도 "후속 PR" 로만 언급된다. 특히 `POST /api/llm-configs/preview-models` 가 alias 범위인지 별도 신규 경로인지 미명시.
  - 제안: 변경 2 §3 에 alias 완전 목록(서브경로 포함)과 "후속 PR" 을 특정 plan/in-progress 파일 참조로 연결. 기존 `spec/2-navigation/6-config.md §3` 은 `/api/model-configs` 를 SoT 정식 경로로 갱신하고 구 경로를 alias 주석으로 처리.

- **[INFO]** `spec/5-system/7-llm-client.md §5.5` — preview-models 경로 변경의 보안 계약 동일성 미확인
  - target 위치: 변경 3 — "7-llm-client §5.5 경로 갱신"
  - 충돌 대상: `/spec/5-system/7-llm-client.md` §5.5 (SSRF 가드·Throttle·apiKey 로깅 금지 계약)
  - 상세: target 이 경로 갱신을 명시하나, 기존 §5.5 의 SSRF 가드·Rate limit·apiKey 로깅 금지 계약이 `/api/model-configs/preview-models` 에서도 동일하게 유지됨을 명시하지 않았다.
  - 제안: 변경 3 의 §5.5 갱신 내용에 "보안 계약(SSRF 가드·Throttle·apiKey 미로깅) 동일 유지" 한 문장 추가.

- **[INFO]** `spec/2-navigation/6-config.md Part C §C 연결 테스트 엔드포인트` — rerank kind 제외 명시 누락
  - target 위치: 변경 2 §3 API 표 — `POST /api/model-configs/:id/test` "연결 테스트(chat/embedding)"
  - 충돌 대상: `/spec/2-navigation/6-config.md §3 Rerank Config API` (연결 테스트 행 없음, R-3 "모델 연결 테스트 미제공" 주석 있음)
  - 상세: 신규 API 표에서 `test` 엔드포인트가 "chat/embedding" 만 지원한다고 괄호로 표시했으나 이것이 기존 Rerank "연결 테스트 미제공" 결정과 일치함을 Rationale 에 연결하지 않았다. 독자가 rerank 가 누락인지 의도인지 불분명하다.
  - 제안: 변경 2 §3 API 표 비고 또는 Rationale 에 "rerank kind 연결 테스트 미제공 — 기존 R-3 정책 유지 (provider 가 표준 model-list API 비노출)" 주석 추가.

---

### 계층 책임 충돌

- **[WARNING]** `spec/5-system/7-llm-client.md §4` — kind 기반 팩토리 dispatch 흐름 미기술
  - target 위치: 변경 3 — "7-llm-client §4: 팩토리 선택을 ModelConfig.kind 기반으로 명시"
  - 충돌 대상: `/spec/5-system/7-llm-client.md` §4 `LLMClientFactory` (현재 provider switch 만 기술, kind dispatch 없음)
  - 상세: 현재 §4 는 `LLMClientFactory.create(options)` 가 `provider` 스위치만으로 클라이언트를 생성한다고 기술한다. 통합 후 `ModelConfig.kind` 에 따라 어느 팩토리가 dispatch 되는지(서비스 레이어에서 `kind='chat'|'embedding'` → `LLMClientFactory`, `kind='rerank'` → `RerankClientFactory`) 가 spec 에 없다. target draft 는 "§4 에 명시"한다고 선언하나 실제 draft 본문에 구체 흐름이 없다.
  - 제안: 변경 3 적용 시 `spec/5-system/7-llm-client.md §4` 에 서비스 계층 kind→팩토리 dispatch 다이어그램 또는 서술 추가.

- **[INFO]** `spec/5-system/7-llm-client.md §3.5 ModelInfo.type` — embedding kind listModels 필터 흐름 확인
  - target 위치: 변경 3 (embedding-pipeline §5.2/§5.3 갱신)
  - 충돌 대상: `/spec/5-system/7-llm-client.md` §3.5 `ModelInfo.type: 'chat' | 'embedding'`
  - 상세: `kind='embedding'` ModelConfig 의 `listModels` 반환 `ModelInfo[]` 에서 `type='embedding'` 으로 필터해야 KB 생성 폼에 임베딩 모델 목록이 노출된다. 기존 `ModelInfo` interface 는 이미 `type='embedding'` 을 지원하므로 충돌은 아니나, embedding pipeline §5.2 에서 "LLMConfig 의 embedding 모델 목록" 조회 경로가 `kind='embedding'` ModelConfig 를 통하도록 변경됨이 명시 필요하다.
  - 제안: 변경 3 에 "embedding-pipeline §5.2 에서 임베딩 모델 조회 소스가 `KB.embedding_model` 문자열 → `kind='embedding' ModelConfig.listModels()` 로 전환" 한 문장 추가.

---

### 권한·RBAC 모델 충돌

- **[WARNING]** `spec/5-system/1-auth.md §3.2 및 §4.1` — RBAC 행 rename 외 감사 로그 액션명 미기술
  - target 위치: 변경 3 — "spec/5-system/1-auth.md §3.2: rerank_config 행 → model_config(kind=rerank) 갱신"
  - 충돌 대상: `/spec/5-system/1-auth.md` §3.2 (line 313: `Rerank Config` 행 + `LLM Config` 행) + §4.1 감사 로그 (`llm_config.* / rerank_config.*` 액션)
  - 상세: target 이 §3.2 의 `Rerank Config` → `model_config(kind=rerank)` 갱신을 명시하나, §4.1 의 `llm_config.create / llm_config.update` 등 기존 감사 로그 액션명과의 전환 정책이 없다. `model_config.create?kind=chat` 처럼 kind 를 포함할지, 아니면 `model_config.*` 로 통합할지 결정이 빠져 있다.
  - 제안: 변경 3 갱신 목록에 `spec/5-system/1-auth.md §4.1` 감사 로그 행 추가 — "llm_config.* → model_config.*(create/update/delete/set-default), rerank_config.* → 동일 model_config.* 흡수" 정책 명시.

---

### 요구사항 ID 충돌

발견 없음. target draft 는 새로운 요구사항 ID(`NAV-*`, `ND-*` 등)를 신설하지 않으며 기존 ID(`R-1`, `R-3`)를 번복하는 방식으로 기술한다.

---

## 요약

target draft 는 1차 consistency-check(14_05_46) BLOCK:YES Critical 5 + Warning 11 을 대부분 흡수한 2차 검토본으로, 직접 모순(채택 불가 수준)은 발견되지 않는다. 가장 중요한 미해결 사항은 두 가지다. 첫째, `spec/1-data-model.md §2.11` 의 `rerank_llm_config_id` / `extraction_llm_config_id` FK 타깃 설명 텍스트와 §2.20 `AssistantSession.llm_config_id` 설명이 테이블 rename 후에도 `FK → LLMConfig` 로 잔존해 spec 텍스트가 사실과 달라진다(데이터는 정합하나 spec 이 거짓). 둘째, deprecation alias 의 완전 목록·제거 시점 미정의와 감사 로그 액션명 전환 정책 누락이 구현자 혼동을 유발할 수 있다. 나머지 발견사항은 INFO 급 텍스트 동기화 누락으로 채택 자체를 차단하지 않는다.

## 위험도

MEDIUM
