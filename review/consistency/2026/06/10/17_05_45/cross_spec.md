# Cross-Spec 일관성 검토 결과

**대상 draft**: `plan/in-progress/spec-draft-unified-model-management.md`
**검토 일시**: 2026-06-10

---

## 발견사항

### 1. 데이터 모델 충돌

- **[WARNING]** `spec/1-data-model.md §2.11 KnowledgeBase` — `rerank_llm_config_id`·`extraction_llm_config_id` FK relabel 누락
  - target 위치: 변경 6-A 표 (§2.20·llm_usage_log relabel 명시)
  - 충돌 대상: `spec/1-data-model.md §2.11` (line 1009, 1020)
  - 상세: 변경 6-A 표는 `spec/1-data-model.md §2.11`의 `rerank_llm_config_id`·`extraction_llm_config_id` 행의 FK 텍스트(`FK → LLMConfig`)를 `FK → ModelConfig (kind=chat)`으로 relabel하는 내용이 포함되지 않았다. §2.20 AssistantSession.llm_config_id와 llm_usage_log만 명시돼 있다. 테이블 rename 후 spec 텍스트가 거짓이 되는 것을 방지하려는 변경 6-A의 목적과 일치하지 않는다.
  - 제안: 변경 6-A 표에 `spec/1-data-model.md §2.11` `rerank_llm_config_id`·`extraction_llm_config_id` 행의 FK relabel 항목 추가.

- **[INFO]** `spec/1-data-model.md §1` ASCII ERD — `LLMConfig`/`RerankConfig` 두 노드 잔존
  - target 위치: 변경 6-A "§1 ASCII ERD LLMConfig/RerankConfig 2행 → ModelConfig (1:N) 단일 행" 갱신 명시
  - 충돌 대상: `spec/1-data-model.md §1` (line 711-713)
  - 상세: draft가 이미 ERD 갱신을 명시하고 있어 의도 충돌은 없다. spec 반영 시 누락 없이 적용 필요.
  - 제안: 해당 갱신은 이미 draft에 명시됨. 실제 spec 작성 시 주의만 필요.

---

### 2. API 계약 충돌

- **[WARNING]** `spec/2-navigation/_layout.md §2.2` 메뉴 항목 7 — 레이블 "LLM Config" 갱신 미명시
  - target 위치: 변경 6-D `_layout.md` 항목 7 URL `/llm-configs` → `/models` 갱신 명시
  - 충돌 대상: `spec/2-navigation/_layout.md §2.2` (line 66)
  - 상세: 현재 항목 7 레이블이 "LLM Config"이다. URL을 `/models`로 변경하면 레이블도 "Models"(또는 동등 표현)로 갱신되어야 일관성이 유지된다. 변경 6-D는 URL만 명시하고 레이블 변경은 언급하지 않는다.
  - 제안: 변경 6-D에 `_layout.md §2.2` 항목 7 레이블 "LLM Config" → "Models" 갱신을 명시 추가.

- **[WARNING]** 구 엔드포인트 deprecation 제거 시점 이중 정의
  - target 위치: 변경 2 §3 "후속 PR에서 제거" vs 변경 6-D "제거 시점 = 본 plan PR4"
  - 충돌 대상: 동일 draft 내부
  - 상세: 변경 2와 변경 6-D가 구 엔드포인트(`/api/llm-configs`, `/api/rerank-configs`) 제거 시점을 각각 다르게 표현하고 있다. 변경 2는 "후속 PR에서 제거"(추상적), 변경 6-D는 "PR4"(구체적). spec 반영 시 단일 진실 원칙상 한 곳에만 명시해야 한다.
  - 제안: 변경 2의 표현을 "PR4에서 제거(변경 6-D 참조)"로 통일하거나, 변경 6-D를 SoT로 두고 변경 2는 단순히 "deprecation alias 유지"로만 기술.

- **[INFO]** `spec/5-system/7-llm-client.md §5.5` — `preview-models` 경로 갱신 후 frontend 코드 동기화
  - target 위치: 변경 3 "7-llm-client §5.5 경로 갱신 + frontend URL 구현 대상 명시"
  - 충돌 대상: `codebase/frontend/src/lib/api/llm-configs.ts:114`
  - 상세: spec 변경만으로는 불충분하며 구현 착수 시 함께 갱신이 필요하다. draft에 이미 "구현 대상"으로 명시됨.
  - 제안: 현재 draft 처리 방식 유지(구현 phase에서 해소).

---

### 3. 요구사항 ID 충돌

- **[INFO]** 새 요구사항 ID 미부여 — 충돌 없음
  - 본 draft는 spec 내 요구사항 ID(NAV-*, ED-*, ND-* 등)를 새로 부여하지 않는다. 기존 엔티티 정의 갱신·Rationale 추가가 주 변경이므로 ID 충돌 발견 없음.

---

### 4. 상태 전이 충돌

- **[WARNING]** `spec/2-navigation/5-knowledge-base.md §2.2` — "Reranker" select 소스와 `Part C` 링크 갱신 미완
  - target 위치: 변경 3 표 "5-knowledge-base §2.2 임베딩/리랭커 select 소스를 ModelConfig(kind별) 목록으로 갱신"
  - 충돌 대상: `spec/2-navigation/5-knowledge-base.md §2.2` (line 64, 68)
  - 상세: 현재 §2.2는 "리랭커 provider 설정(RerankConfig)은 워크스페이스 설정 화면에서 관리", "KB 폼의 Reranker select는 워크스페이스 RerankConfig 목록에서 선택", "[설정 화면 Part C](./6-config.md#part-c-rerank-리랭커-설정)" 링크를 포함한다. 변경 3은 select 소스를 ModelConfig(kind=rerank)로 갱신한다고 명시하나, `Part C` 링크가 통합 후 유효하지 않아지는 처리(Part C 섹션이 Models 탭으로 흡수됨)가 명시되지 않았다.
  - 제안: 변경 3의 5-knowledge-base §2.2 갱신 범위에 `Part C` 링크 → `Config > Models > Rerank 탭` 참조로 교체를 명시적으로 추가.

- **[INFO]** `spec/2-navigation/6-config.md Part C` — 통합 후 섹션 처리 방향 미명시
  - target 위치: 변경 2 (Part B+C → "Models" 통합 화면)
  - 충돌 대상: `spec/2-navigation/6-config.md Part C` (C.1~C.2 섹션)
  - 상세: draft 변경 2는 "Part B+C → Models 통합 화면"을 선언하나, 6-config.md 내 기존 Part C 섹션 본문(C.1 화면구조·C.2 필드 등)의 처리(삭제/흡수/대체)가 명확히 명시되지 않았다.
  - 제안: draft에 "기존 Part C 섹션은 Part B 개정(Models 통합 화면)으로 흡수·대체, Part C 헤딩 삭제" 처리 방향 명시.

---

### 5. 권한·RBAC 모델 충돌

- **[WARNING]** `spec/5-system/1-auth.md §3.2` RBAC 매트릭스 — `LLM Config` 행 갱신 미포함
  - target 위치: 변경 3 표 "1-auth §3.2 `rerank_config` 행 → `model_config`(kind=rerank) 갱신"
  - 충돌 대상: `spec/5-system/1-auth.md §3.2` RBAC 표 (line 312-313)
  - 상세: 현재 RBAC 매트릭스에 `LLM Config`와 `Rerank Config` 두 행이 존재한다. draft 변경 3은 `Rerank Config` 행만 갱신한다고 명시하고 `LLM Config` 행 처리는 언급이 없다. 통합 후 두 행을 `Model Config` 단일 행으로 통합하거나 kind별로 분리 유지할지 결정하지 않으면 RBAC 표가 불완전하게 된다.
  - 제안: 변경 3에서 auth §3.2 갱신 범위를 "Rerank Config 행 제거 + LLM Config 행 → Model Config로 rename(CRUD/CRUD/R/R 동일)" 로 명확히 확장.

- **[WARNING]** `spec/5-system/1-auth.md §4.1` 감사 로그 — 구 액션명 보존 정책 spec 미기술
  - target 위치: 변경 6-C `1-auth §4.1` `llm_config.*`/`rerank_config.*` → `model_config.*` 갱신 + "과거 기록은 append-only 보존" 명시
  - 충돌 대상: `spec/5-system/1-auth.md §4.1/§4.2`
  - 상세: §4.2에는 "최근 90일 보관"만 기술되어 있고, 구 액션명(`llm_config.*`, `rerank_config.*`) 레코드의 보존 방침이 spec 텍스트에 명시되어 있지 않다. 변경 6-C에서 "과거 기록은 append-only 보존"이라고 draft 내 명시는 됐으나 실제 spec에 반영될 내용으로도 명시되어야 한다.
  - 제안: §4.1 갱신 시 "기존 `llm_config.*`/`rerank_config.*` 기록은 append-only로 보존(rename하지 않음), 신규 이벤트만 `model_config.*` 사용"을 인라인 주석으로 spec에 추가.

---

### 6. 계층 책임 충돌

- **[INFO]** `spec/5-system/7-llm-client.md §2.1` 헤딩 "리랭크 프로바이더 (Planned)" 갱신
  - target 위치: 변경 3 "7-llm-client §2.1 헤딩 갱신"
  - 충돌 대상: `spec/5-system/7-llm-client.md §2.1` (line 42)
  - 상세: 현재 §2.1 헤딩이 "(Planned)"이나 TEI/Cohere는 구현 완료 상태. 이미 draft가 갱신을 명시하고 있어 충돌 없음.
  - 제안: 헤딩 갱신과 함께 표의 1차 구현 항목을 "(구현 완료)" 표기로 일관성 있게 갱신.

- **[INFO]** `spec/5-system/8-embedding-pipeline.md §5.3` 차원 표 — ModelConfig.dimension SoT 이원화 해소 필요
  - target 위치: 변경 3 표 + 변경 6-G "model_config.dimension(SoT) vs knowledge_base.embedding_dimension(파생 캐시) 관계를 §5.2에 명시"
  - 충돌 대상: `spec/5-system/8-embedding-pipeline.md §5.3` (line 129-137)
  - 상세: §5.3에 모델별 차원이 정적 표로 기술되어 있다. ModelConfig.dimension이 SoT가 된 이후 이 정적 표가 "참고 예시" 이상으로 해석될 경우 이원화가 발생한다.
  - 제안: §5.3 차원 표에 "ModelConfig.dimension이 SoT — 본 표는 참고 예시" 주석 추가.

- **[INFO]** `spec/data-flow/6-knowledge-base.md §2.1 Postgres 표` — `embedding_llm_config_id? (V029)` 표기 갱신 필요
  - target 위치: 변경 3 표 "data-flow/6-knowledge-base §1.1/§1.2/§2 (4곳) 갱신"
  - 충돌 대상: `spec/data-flow/6-knowledge-base.md §2.1` (line 163)
  - 상세: Schema 매핑 표의 `knowledge_base` 핵심 컬럼 목록에 `embedding_llm_config_id? (V029)` 표기가 있다. 이를 `embedding_model_config_id? (V091)`로 갱신해야 하며, 이는 변경 3에서 명시한 4곳 범위에 포함된다. 이미 인지된 범위이므로 INFO 수준.
  - 제안: spec 반영 시 해당 위치도 함께 갱신.

---

## 요약

Draft는 2차 consistency-check 이후 WARNING/INFO를 변경 6으로 전수 흡수하여 전반적 정합성이 높아졌다. 3차 검토에서 새 CRITICAL은 발견되지 않았다. 잔여 WARNING은 5건이다. 가장 주의가 필요한 항목은 다음 셋이다. (1) `spec/5-system/1-auth.md §3.2` RBAC 표의 `LLM Config` 행 처리가 변경 3에 누락되어 통합이 불완전하다. (2) `spec/2-navigation/_layout.md §2.2` 항목 7 레이블 갱신이 변경 6-D에 누락되어 URL과 레이블이 불일치할 수 있다. (3) `spec/2-navigation/5-knowledge-base.md §2.2`의 `Part C` 링크 갱신이 변경 3에 명시되지 않아 통합 후 dead link가 발생한다. 이 세 항목은 spec 반영 전 해소를 권장하며, 나머지 WARNING/INFO는 spec 작성 시 주의사항 수준이다.

---

## 위험도

LOW

(Critical 0 / Warning 5 / Info 6. 기존 기능을 작동 불가로 만드는 직접 모순은 없으며, 모두 spec 텍스트 갱신 범위 누락·레이블 불일치 수준이다.)
