## 발견사항

---

### [CRITICAL] spec/5-system/8-embedding-pipeline.md §5.5 가 legacy 컬럼을 "V092 에서 제거 예정" 이라고 기술하나 실제 DROP 대상은 V093/V094

- **target 위치**: `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md` — V093 repoint + V094 DROP 계획
- **충돌 대상**: `spec/5-system/8-embedding-pipeline.md` §5.5 마지막 주석:
  > "legacy 컬럼(embedding_llm_config_id·embedding_model)은 V092 에서 제거 예정 ([데이터 모델 §2.11](../1-data-model.md#211-knowledgebase))"
- **상세**: V091 SQL 파일 헤더도 "구 컬럼(embedding_llm_config_id, embedding_model)은 legacy 폴백용으로 V092까지 존치" 라고 명시. 그러나 실제 V092 는 `rerank_config` 테이블 DROP 이었고(`spec/1-data-model.md §2.16` 구현 상태 기술 참조), KB legacy 컬럼 DROP 은 PR4b 의 V094 로 이월됐다. 두 spec 파일(`8-embedding-pipeline.md`, `1-data-model.md §2.11` 본문의 "[LEGACY — PR4b 제거 예정]" 태그는 올바름)이 서로 상충한다. `8-embedding-pipeline.md §5.5` 의 "V092 에서 제거 예정" 은 구버전 계획이 남아있는 stale 서술이다.
- **제안**: PR4b 구현 착수 전 `spec/5-system/8-embedding-pipeline.md §5.5` 의 "V092 에서 제거 예정" 을 "V093/V094(PR4b)에서 제거" 로 갱신. `spec/1-data-model.md §2.11` 은 "[LEGACY — PR4b 제거 예정]" 이 이미 정확해 갱신 불요.

---

### [WARNING] spec/5-system/7-llm-client.md §5.5·§6 이 `LLM_CONFIG_INVALID`·`LLM_CONFIG_NOT_FOUND` 를 여전히 사용

- **target 위치**: PR4b 에러코드 범위 2 — `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID`, `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_NOT_FOUND` 전환
- **충돌 대상**: `spec/5-system/7-llm-client.md` §5.5 (SSRF 가드 — "…`LLM_CONFIG_INVALID` 로 차단한다"), §6 에러 처리 표 ("`LLM_CONFIG_INVALID` — 팩토리 생성 실패 또는 preview SSRF 차단"), §5.5 팩토리 주석 두 곳; `spec/2-navigation/6-config.md` §B.6.2/Rationale ("400 `RERANK_CONFIG_INVALID`; … [LLM Client §5.5] 가드 재사용" — 여기는 rerank 전용 코드라 별개)
- **상세**: `spec/5-system/3-error-handling.md §1.3` 에는 이미 `MODEL_CONFIG_INVALID`(400)·`MODEL_CONFIG_NOT_FOUND`(404) 가 정식 등재되어 있다. 반면 `spec/5-system/7-llm-client.md` 는 구 이름 `LLM_CONFIG_INVALID`·`LLM_CONFIG_NOT_FOUND` 를 SSRF 가드, 에러 처리 표, 팩토리 설명 등 최소 5곳에서 계속 사용한다. PR4b 에서 백엔드 emit 을 신코드로 전환하면 spec 과 구현이 일치하지만, 7-llm-client.md 문서는 여전히 구 코드를 기술해 혼용이 발생한다.
- **제안**: PR4b 구현 착수 전 또는 spec 갱신 위임(project-planner) 시 `spec/5-system/7-llm-client.md` §5.5 및 §6 에서 `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID`, `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_NOT_FOUND` 로 일괄 갱신. `spec/conventions/error-codes.md §3 Historical-artifact` 예외 레지스트리에 등재 여부도 검토(rename = breaking 인지, 내부 모듈 전용인지).

---

### [WARNING] V091 SQL 헤더와 spec/1-data-model.md §2.16 구현 상태 주석이 "V092까지 legacy 존치" 를 주장 — V093 repoint 전제와의 정합성 검토 필요

- **target 위치**: PR4b V093 repoint 마이그레이션 설계 (`embedding_model_config_id IS NULL` 인 KB 대상 find-or-create + pin)
- **충돌 대상**: `codebase/backend/migrations/V091__kb_embedding_model_config.sql` 헤더 ("구 컬럼은 legacy 폴백용으로 V092까지 존치"); `spec/1-data-model.md §2.16` ("KB legacy embedding 컬럼 정리는 데이터 마이그레이션이 선행돼야 해 PR4b 로 이월")
- **상세**: V091 repoint 시 대상을 "embedding_model_config_id IS NULL 인 모든 KB" 로 한정하고, creds 출처 우선순위를 `(1) embedding_llm_config_id → (2) ws default chat → (3) ws default embedding` 으로 결정했다. 이 우선순위가 spec/8-embedding-pipeline.md §5.5 resolveEmbedding step-3 와 완전히 일치하는지 확인이 필요하다. 특히 step-3 의 "없으면 ws default chat config" → "모델 문자열은 `kb.embedding_model`(legacy 컬럼) 사용" 이라는 semantics 가 V093 의 find-or-create 로직에서 `default_model=embedding_model`·`dimension=embedding_dimension` 복사로 정확하게 재현되어야 한다. spec 과 plan 이 같은 우선순위를 기술하고 있으나, (2) 항목 구체화("ws default chat" 사용 시 kind=chat config 로 kind=embedding find-or-create 를 만드는 것이 의도인지)는 spec 에 명시되어 있지 않아 구현 오해 위험이 있다.
- **제안**: V093 SQL 작성 전 `spec/5-system/8-embedding-pipeline.md §5.5` step-3 semantics 와 plan §범위 1 → V093 우선순위 (2)·(3) 항의 정확한 매핑을 spec 또는 SQL 주석에 명시. 특히 "ws default chat 을 사용할 때 kind='embedding' config 를 새로 만들어 pin" 하는 의도를 문서화.

---

### [WARNING] spec/data-flow/6-knowledge-base.md §2 지식 저장소 테이블 기술이 `embedding_model` 컬럼을 DROP 후에도 남을 수 있는 서술 포함

- **target 위치**: PR4b V094 DROP (`embedding_llm_config_id`·`embedding_model` 컬럼)
- **충돌 대상**: `spec/data-flow/6-knowledge-base.md` line 250 — `knowledge_base` 생성 스키마에 `embedding_model` 이 정상 컬럼처럼 열거됨 (`workspace_id, name, embedding_model, embedding_dimension?, chunk_size, ...`)
- **상세**: V094 이후 `embedding_model`·`embedding_llm_config_id` 는 DB 에 존재하지 않는다. data-flow 문서는 생성 시점 INSERT 스키마를 기술하므로, DROP 후에도 이 필드를 열거하면 구현자 혼동 또는 테스트 데이터 오류를 유발한다. `spec/1-data-model.md §2.11` 의 "[LEGACY — PR4b 제거 예정]" 태그는 준비돼 있으나 data-flow 문서에는 동기화가 없다.
- **제안**: PR4b spec 갱신 위임(project-planner) 시 `spec/data-flow/6-knowledge-base.md` §2 표에서 `embedding_model` 컬럼 제거. `embedding_llm_config_id` 도 동일.

---

### [INFO] `LLM_CONFIG_NOT_FOUND` 의 HTTP status 결정: plan 은 "400 유지" 지만 spec/3-error-handling.md §1.3 은 `MODEL_CONFIG_NOT_FOUND` 를 404 로 등재

- **target 위치**: PR4b 에러코드 범위 2 표 — `LLM_CONFIG_NOT_FOUND`(현 400) → `MODEL_CONFIG_NOT_FOUND` "**400 유지**"
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.3`:
  > `MODEL_CONFIG_NOT_FOUND` | 지정 id 의 ModelConfig 부재 또는 cross-kind 접근 차단(존재 누설 방지), default 해석 실패 … | **404**
- **상세**: plan 은 `llm.service.ts:356` 의 resolve 경로에서 "status 변경 breaking 회피" 를 이유로 400 을 유지하기로 결정했다. 그러나 `spec/5-system/3-error-handling.md §1.3` 의 `MODEL_CONFIG_NOT_FOUND` 정의는 404 다. 즉 동일 에러 코드가 한 경로에서는 400, spec 정의에서는 404 로 두 가지 HTTP status 를 가진다. 클라이언트가 에러 코드로 분기할 경우 HTTP status 로 추가 분기하면 오작동한다.
- **제안**: `spec/5-system/7-llm-client.md §6` 에 `MODEL_CONFIG_NOT_FOUND` 를 400 으로 발행하는 특수 경로(legacy resolve 경로)를 별도 주석으로 명시하거나, 해당 발행처에서 더 적합한 코드(`VALIDATION_ERROR` 또는 `RESOURCE_NOT_FOUND`)를 사용하도록 재검토. 최소한 `spec/5-system/3-error-handling.md §1.3` 에 "특정 발행처에서 400 으로 나올 수 있음" 을 주석으로 추가해 혼동을 방지.

---

### [INFO] spec/5-system/8-embedding-pipeline.md §5.5 resolveEmbedding step-3 서술이 PR4b 제거 대상이나 spec 본문에 여전히 정식 서술로 남아있음

- **target 위치**: PR4b 범위 1 — resolveEmbedding step-3 legacy 폴백 제거
- **충돌 대상**: `spec/5-system/8-embedding-pipeline.md §5.5 (임베딩 설정 해석 폴백 체인)` — step-3 legacy 폴백이 아직 정식 스펙으로 기술됨
- **상세**: PR4b 구현 완료 후 step-3 는 코드에서 제거된다. spec 갱신이 구현 후 project-planner 위임으로 예정되어 있으나(plan 체크리스트 "spec 갱신 → project-planner 위임"), 구현 착수 단계에서 이미 spec 이 목표 상태와 다름을 인지하고 있어야 한다. 구현자가 spec §5.5 를 그대로 따르면 step-3 를 지우지 않을 위험이 있다.
- **제안**: plan 체크리스트의 "spec 갱신 → project-planner 위임" 항목이 V094 DROP 이후 즉시 수행되도록 순서를 명시. spec 갱신 전 구현 PR 에는 `// TODO: spec §5.5 step-3 제거 예정 — PR4b 완료 후 project-planner 갱신` 주석을 추가해 drift 를 명시.

---

## 요약

PR4b 의 핵심 작업 영역(V093/V094 마이그레이션, resolveEmbedding step-3 제거, 에러코드 전환)은 기존 spec 구조와 논리적으로 일관된다. 주요 CRITICAL 발견은 `spec/5-system/8-embedding-pipeline.md §5.5` 가 "V092에서 legacy 컬럼 제거 예정"이라고 기술하지만 실제 DROP은 V094(PR4b)로 이월된 stale 서술이라는 점으로, 구현자가 마이그레이션 번호 체계를 오해하거나 spec이 이미 적용됐다고 혼동할 수 있다. WARNING 3건은 V093 repoint 의미론 명확화, `spec/5-system/7-llm-client.md`의 구 에러코드 잔류, 그리고 `spec/data-flow/6-knowledge-base.md` 의 DROP 후 컬럼 서술 동기화 미완에 관한 것이다. INFO 2건은 `MODEL_CONFIG_NOT_FOUND` HTTP status 결정의 spec/plan 불일치와 resolveEmbedding spec 서술 drift 로, 구현 완료 후 project-planner 위임 시 함께 해소하면 된다. 에러코드 rename 이 breaking change 규칙(`spec/conventions/error-codes.md §2`)에 해당하는지 여부는 `LLM_CONFIG_*` 가 외부 API 소비자에게 노출되는 공개 코드인지 확인이 필요하다 — 내부 도메인 전용이라면 rename 이 허용되나, 프런트엔드(`loader-error-messages.ts`) 가 이미 두 코드 모두 매핑하므로 실질적 영향은 최소화된 상태다.

## 위험도

MEDIUM
