# 요구사항(Requirement) 리뷰 결과

## 발견사항

### **[WARNING]** `plan/in-progress` §범위 1 작업 체크리스트의 repoint 우선순위가 실제 구현과 불일치
- 위치: `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md` §범위 1 "작업" 체크박스 line 76–80
- 상세: 작업 체크리스트의 `(1) embedding_llm_config_id → (2) ws default chat → (3) ws default embedding` 순서는 구현된 SQL (V093) 및 동일 plan 내 "Repoint creds/model 출처" 섹션(line 48–53)이 기술하는 `(1) ws default embedding → (2) embedding_llm_config_id → (3) ws default chat` 순서와 정반대다. SQL 구현은 "Repoint creds/model 출처" 섹션의 우선순위를 따라 정확하게 작성됐으며, resolveEmbedding step-2 가 step-3 보다 우선이라는 의도도 올바르다. plan 작업 체크박스의 우선순위 서술만 오기된 것이다.
- 제안: 코드(V093 SQL)는 올바르므로 수정 불필요. plan 체크박스의 우선순위 서술을 `(1) ws default kind=embedding → (2) embedding_llm_config_id → (3) ws default chat` 로 수정. (developer 역할로 plan 수정 가능)

---

### **[SPEC-DRIFT] [WARNING]** `spec/5-system/8-embedding-pipeline.md §5.5` — legacy step-3 서술 및 "V092 에서 제거 예정" 문구 잔존
- 위치: `spec/5-system/8-embedding-pipeline.md` line 169–177 (§5.5 3단계 폴백 체인 서술)
- 상세: spec §5.5 본문은 아직 3-step 폴백 체인(step-3 legacy: `embedding_llm_config_id` + `embedding_model`)을 정식 서술로 기록하고, "V092 에서 제거 예정" 으로 표기하고 있다. 그러나 V092 는 이미 PR4a 에서 `rerank_config` DROP 으로 점유됐고, 본 PR4b 에서 V093/V094 로 실제 제거가 완료됐다. 코드는 step-3 를 올바르게 제거했다. spec 이 낡음.
- 제안: 코드 유지. spec 갱신은 `project-planner` 위임. 대상: `spec/5-system/8-embedding-pipeline.md §5.5` 전체를 2-step 기술로 교체, "V092 에서 제거 예정" → "V093/V094(PR4b) 에서 제거됨" 으로 갱신. `spec/1-data-model.md §2.11` 의 `embedding_llm_config_id`·`embedding_model` 행 "[LEGACY — PR4b 제거 예정]" 표기도 "PR4b(V093/V094) 에서 제거됨" 또는 해당 행 삭제로 갱신.

---

### **[SPEC-DRIFT] [WARNING]** `spec/5-system/3-error-handling.md §1.3` — `MODEL_CONFIG_DEFAULT_MISSING` 미등재, `MODEL_CONFIG_NOT_FOUND` 서술 갱신 필요
- 위치: `spec/5-system/3-error-handling.md §1.3` line 50
- 상세: 코드는 `MODEL_CONFIG_DEFAULT_MISSING` (HTTP 400) 를 신규 도입해 llm.service.ts 및 model-config.service.ts `resolveConfig` default 미설정 경로에서 발행한다. 그러나 spec §1.3 표에 본 코드가 등재되지 않았다. 또한 `MODEL_CONFIG_NOT_FOUND` 의 설명이 "default 해석 실패" 를 포함하고 있어(line 50), 본 PR4b 에서 그 의미를 `MODEL_CONFIG_DEFAULT_MISSING` 로 분리한 사실이 spec 에 반영되지 않았다. 코드 변경은 의도적이고 합리적(HTTP 400/404 이중 status 충돌 해소).
- 제안: 코드 유지. spec 갱신은 `project-planner` 위임. 대상: `spec/5-system/3-error-handling.md §1.3` 표에 `MODEL_CONFIG_DEFAULT_MISSING | default kind=X ModelConfig 미설정 (resolveConfig·llm.service.ts default 경로) | 400` 행 추가. `MODEL_CONFIG_NOT_FOUND` 설명에서 "default 해석 실패" 문구 제거.

---

### **[INFO]** V093 SQL — `embedding_model IS NULL` 인 KB 처리 동작 미명시
- 위치: `codebase/backend/migrations/V093__kb_embedding_repoint.sql` line 41, 73–74
- 상세: legacy_kb CTE 에서 `kb.embedding_model AS embedding_model` 을 참조하며, 이 값이 NULL 인 KB 에 대해 `INSERT INTO model_config ... default_model=embedding_model (NULL)` 이 발생할 수 있다. schema 상 `embedding_model` 컬럼은 `default 'text-embedding-3-small'` 이 있으므로 DB에 NULL 로 저장된 행은 없을 가능성이 높으나(V021 에서 NOT NULL default 확인 필요), 방어 코드 없이 NULL 전파가 가능하다. 미임베딩 KB(`embedding_model IS NULL`)가 있다면 생성된 config 의 `default_model` 이 NULL 이 된다.
- 제안: 현실적 위험이 낮으나, `COALESCE(kb.embedding_model, 'text-embedding-3-small')` 로 방어 처리 또는 기존 스키마 DEFAULT 보증이 있음을 주석으로 명시 권장.

---

### **[INFO]** `KnowledgeBaseResponseDto.embeddingModel` — `@Column` 데코레이터 없는 transient 필드가 응답 직렬화에 의존
- 위치: `codebase/backend/src/modules/knowledge-base/entities/knowledge-base.entity.ts` line 66; `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts` line 22
- 상세: `embeddingModel?: string` 이 엔티티에 transient 필드로 선언됐다. `attachEffectiveEmbeddingModel` 이 항상 호출되는지 여부가 응답 DTO 의 `embeddingModel` 값을 결정한다. `findAll`·`findOne`·`create`·`update` 경로는 모두 `attachEffectiveEmbeddingModel` 를 호출하고 있어 정상이다. 단, `reExtractAll`·`reEmbedAll` 등 내부 반환이 없는 경로에서는 호출되지 않으나, 이 경로들은 KB 를 직접 응답으로 반환하지 않으므로 문제 없다.
- 제안: 현재 구현은 기능상 완전. 단, 향후 KB 를 직접 반환하는 경로가 추가될 때 `attachEffectiveEmbeddingModel` 호출을 잊기 쉬우므로 엔티티 주석 또는 서비스 메서드 헤더에 "KB 반환 시 반드시 attachEffectiveEmbeddingModel 호출 필요" 경고 추가 권장.

---

### **[INFO]** `attachEffectiveEmbeddingModel` — `embeddingModelConfigId` 가 있으나 워크스페이스에 없는(삭제된) config 일 때 빈 문자열 반환
- 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` line 134–139
- 상세: `findManyByIds` 는 존재하지 않는 id 는 결과에서 빠진다. 따라서 config 가 삭제된 KB 는 `modelByConfigId.get(...)` 이 `undefined` 를 반환해 `embeddingModel = ''` 이 된다. 이는 메서드 JSDoc 에 "둘 다 없으면 빈 문자열. throw 하지 않는다(표시용 soft resolve)" 라고 명시됐으므로 의도한 동작이다. 기능 완전성 관점에서 정상.
- 제안: 없음 (명시된 soft resolve 동작).

---

## 요약

본 PR4b 의 핵심 요구사항(KB legacy 임베딩 컬럼 은퇴 + 에러코드 통일)은 코드 레벨에서 완전하게 구현됐다. V093 repoint SQL 은 resolveEmbedding step 순서(ws default embedding → embedding_llm_config_id → ws default chat)를 정확히 반영하고, fail-loud RAISE 로 V094 DROP 전 안전 게이트를 보증한다. V094 DROP 은 V093 에 직렬 의존하며 비가역성도 명시됐다. `resolveEmbedding` 에서 legacy step-3 가 제거되고 2-step 체인만 남았으며, 엔티티·DTO·서비스·프론트엔드에서 `embeddingLlmConfigId`·`embeddingModel`(컬럼) 참조가 일관되게 제거됐다. `MODEL_CONFIG_DEFAULT_MISSING` 에러코드 도입과 `MODEL_CONFIG_INVALID` rename 도 백엔드·프론트엔드 양측에서 동기화됐다. 주요 위험은 코드 버그가 아니라 spec 갱신 누락(8-embedding-pipeline §5.5 의 legacy step-3 서술·"V092" 오기, 3-error-handling §1.3 의 신규 코드 미등재, 1-data-model §2.11 의 legacy 컬럼 서술 잔존)이며, plan 작업 체크박스 1건의 우선순위 오기가 단일 코드-문서 불일치다.

## 위험도

LOW
