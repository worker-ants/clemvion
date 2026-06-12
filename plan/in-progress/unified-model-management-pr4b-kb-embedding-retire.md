---
worktree: pr4b-kb-embedding-retire
started: 2026-06-12
owner: developer
parent_plan: plan/in-progress/unified-model-management.md
related_spec:
  - spec/1-data-model.md
  - spec/2-navigation/5-knowledge-base.md
  - spec/2-navigation/6-config.md
  - spec/5-system/8-embedding-pipeline.md
  - spec/5-system/3-error-handling.md
related_plan:
  - plan/in-progress/unified-model-management.md
  - plan/complete/kb-model-change-reembed-followup.md
spec_impact:
  - spec/1-data-model.md
  - spec/2-navigation/5-knowledge-base.md
  - spec/5-system/3-error-handling.md
  - spec/5-system/7-llm-client.md
  - spec/5-system/8-embedding-pipeline.md
  - spec/conventions/error-codes.md
  - spec/data-flow/6-knowledge-base.md
  - spec/data-flow/7-llm-usage.md
---

# PR4b — KB 임베딩 legacy 컬럼 은퇴 + 에러코드 통일

Unified Model Management 의 마지막 단계. PR4a(#545, V092 `DROP rerank_config`) 머지 후
origin/main(`a1ad25f6`) base. 마이그레이션 max = V092 → 본 작업 V093~.

비가역 데이터 마이그레이션 — 신중. repoint → 검증 → DROP 단계화.

## 사용자 확정 결정 (2026-06-12)

- **Repoint 범위**: `embedding_model_config_id IS NULL` 인 **모든 KB** (task 문구대로).
  `embedding_model` 문자열을 한 글자도 바꾸지 않고 보존하며 `kind='embedding'` ModelConfig 로 pin.
- **에러코드 — '기본 LLM 미설정' 경로**: `LLM_CONFIG_NOT_FOUND`(현 400, llm.service.ts:354-364
  default 미설정) → **신규 `MODEL_CONFIG_DEFAULT_MISSING` (400)** 로 통일.
  - 이 경로는 'id 부재'(=MODEL_CONFIG_NOT_FOUND 404)와 의미가 달라(=default 미설정/셋업 안내) 별도 코드.
  - HTTP **400 유지**(클라이언트 무영향) + MODEL_CONFIG_NOT_FOUND(404) 이중 status 충돌 회피.
- **에러코드 — preview SSRF/factory 경로**: `LLM_CONFIG_INVALID`(llm-preview.service.ts:39/48/69)
  → 기존 **`MODEL_CONFIG_INVALID` (400)**.
- **RERANK_CONFIG_INVALID**: 변경 없음(현행 유지) — rerank 실행 레이어 진단필드(HTTP 200), throw 아님.

## consistency-check --impl-prep 결과 (review/consistency/2026/06/12/00_23_39, BLOCK: YES → 해소 진행)

- **Critical 1** (에러코드 status 이중정의) → 위 결정으로 해소 (신규 400 코드).
- **Critical 2** (spec drift: 8-embedding-pipeline §5.5·1-data-model §2.11 의 "V092 제거" stale)
  → project-planner 위임 spec 갱신으로 해소.
- **Critical 3** (LLM_CONFIG_* rename breaking?) → 프론트(loader-error-messages.ts)는 양쪽 코드
  동일 UI 메시지 매핑 → 우리 클라이언트 무영향. 외부 소비자는 /ai-review api-contract-reviewer 점검.
  rename 근거 `error-codes.md §3 historical-artifact` 등재(위임).

## Repoint creds/model 출처 (fidelity 최우선 — 저장 벡터 재현)

NULL KB 마다, **현재 resolveEmbedding 이 실제로 resolve 하는 대상**(=저장 벡터가 만들어진 경로)을
정확히 재현. 우선순위는 resolveEmbedding step 순서를 그대로 미러링한다 (step-2 가 step-3 보다 우선):
1. ws default kind=embedding 존재 → 그 config 로 **직접 pin** (step-2; model=그 config.defaultModel, 새 row 없음).
   - embedding_llm_config_id 가 set 돼 있어도 ws default embedding 이 있으면 런타임은 step-2 로 가므로 이게 우선.
2. else `embedding_llm_config_id` NOT NULL → 그 config creds + `embedding_model` 로 새 embedding config (step-3a).
3. else ws default kind=chat 존재 → 그 config creds + `embedding_model` 로 새 embedding config (step-3b).
4. else → **fail-loud RAISE** (creds 출처 전무 = runtime 에서도 throw 하던 KB = 수동 처리 대상, id 목록 출력).

- **dimension SoT** = `KB.embedding_dimension` (NULL이면 미임베딩 → 첫 임베딩 시 auto-detect).
- step-3a/3b 새 config dedup 자연키 `(workspace_id, provider, api_key, base_url, default_model, dimension)`.
- "ws default chat" creds 사용은 chat piggyback 의 *재도입이 아님* — 1회성 역사적 복원(legacy step-3 가
  실제로 그 경로를 썼으므로 벡터 fidelity상 필수). 런타임 폴백엔 chat 경로 없음(2-step 유지).

### fail-loud RAISE 근거 (Rationale)
repoint 부분 성공 후 DROP 하면 매칭 못한 KB 는 영구 임베딩 불가(검색 깨짐) + 비가역. 따라서
1건이라도 매칭 실패 시 V093 전체를 RAISE 로 롤백해, 수동 처리 후 재시도하도록 강제한다.

## 범위 1 — KB 임베딩 legacy 컬럼 은퇴

### 현 상태 (origin/main)
- `model-config.service.ts:136-174` `resolveEmbedding` 3-step 폴백:
  (1) `embeddingModelConfigId` → kind=embedding config + defaultModel
  (2) ws default kind=embedding + defaultModel
  (3) legacy: `embeddingLlmConfigId`(없으면 ws default chat) + `kb.embeddingModel` 문자열
- 저장 벡터 결정 요인: `embed(llmConfig, texts, model)` → config 의 provider/api_key/base_url + model 문자열.
- KB 엔티티 legacy 컬럼: `embedding_model`(text, default 'text-embedding-3-small'),
  `embedding_llm_config_id`(uuid, FK `fk_kb_embedding_llm_config` → model_config).

### 작업
- [x] **V093 repoint (가역, 비파괴)**: NULL KB 마다 creds 출처 우선순위
      `(1) ws default kind=embedding → (2) embedding_llm_config_id → (3) ws default chat → (4) fail-loud` 로
      legacy config 를 찾아 그 provider/api_key/base_url 복사 + `default_model=embedding_model` +
      `dimension=embedding_dimension` 로 `kind='embedding'` config find-or-create 후 KB 에 pin.
      자연키 dedup `(workspace_id, src_config_id, embedding_model, embedding_dimension)`.
      말미 `RAISE EXCEPTION` fail-loud: UPDATE 후에도 NULL 남은 KB 1건↑ → 전체 롤백 + id 목록 출력. (V093__kb_embedding_repoint.sql)
- [x] **V094 DROP (비가역)**: `fk_kb_embedding_llm_config` + `embedding_llm_config_id` + `embedding_model` DROP.
      헤더에 rationale + `-- DOWN:` irreversible 명시. V093 commit(검증 통과) 후에만 진행. (V094__kb_drop_legacy_embedding_columns.sql, lock_timeout 3s)
- [x] `resolveEmbedding` step-3 제거 → 2-step + 미해결 시 `notFound()`. JSDoc 갱신.
- [x] KB 엔티티 `embeddingModel`·`embeddingLlmConfigId` 필드 제거.
- [x] DTO 정리: create/update-knowledge-base, embedding-probe(probe 요청 파라미터는 보존), knowledge-base-response(embeddingModel derive).
- [x] embedding.service `resolveEmbedding` 호출 인자(`embeddingLlmConfigId`/`legacyModel`) 제거.
- [x] spec 갱신 (project-planner 위임): 2-navigation/5-knowledge-base.md,
      5-system/8-embedding-pipeline.md 의 legacy step-3 서술 제거. (6-config.md: "모델 불러오기" 는 ModelConfig 생성 화면 UX 로 KB legacy piggyback 과 무관 → 변경 불요 확인.)

### 회귀 주의
- KB 생성/임베딩/검색 e2e 가 repoint 후 통과해야 함.
- probe / EmbeddingTestButton 경로 (PR-A 때 1회 깨졌던 곳).
- 임베딩 차원 mismatch = 검색 깨짐 → repoint 가 provider+model+dimension 정확 재현해야 함.

## 범위 2 — 에러코드 통일 (LLM_CONFIG_* → MODEL_CONFIG_*)

| 구 코드 | 발행처 | 현 status | 신 코드 | status |
| --- | --- | --- | --- | --- |
| `LLM_CONFIG_NOT_FOUND` | llm.service.ts:354-364 (default 미설정) | 400 | **`MODEL_CONFIG_DEFAULT_MISSING` (신규)** | **400 유지** |
| `LLM_CONFIG_INVALID` | llm-preview.service.ts:39/48/69 | 400 | `MODEL_CONFIG_INVALID` | 400 |
| `RERANK_CONFIG_INVALID` | rerank.service.ts:107 (진단필드, 200) | 200 | **변경 없음(현행 유지)** | 200 |

### 작업
- [x] 백엔드 emit 사이트 신코드 전환 (status 결정 반영). (llm.service:356 MODEL_CONFIG_DEFAULT_MISSING, model-config.service, llm-preview 3곳 MODEL_CONFIG_INVALID)
- [x] 프론트 `loader-error-messages.ts` legacy 키 정리 (이미 양쪽 매핑 — UI 무영향).
- [x] spec `5-system/3-error-handling.md` 표 갱신 (project-planner 위임). + §1.3 resolveEmbedding(404)/resolveConfig(400) 라우팅 명시(후속 ai-review W-1/I-4).
- [x] 관련 test (llm.service.spec, llm-preview.service.spec, error-codes.spec,
      sanitize-loader-error.test) assert 갱신.
- [x] 외부 소비자 Sunset/deprecation 정책 검토 (api-contract-reviewer) — **결정: 불요**(에러코드/DTO breaking = 자사 전용, error-codes.md §4 + CHANGELOG 문서화로 충분; 사용자 결정 #3).

## 워크플로 체크
- [x] consistency-check --impl-prep (2026/06/12 00_23_39, BLOCK:YES → Critical 1 신코드 결정·2/3 spec위임으로 해소)
- [x] 구현 (마이그레이션 V093/V094 + resolveEmbedding/엔티티/DTO/rag-search/error code + 응답 derive)
- [x] TEST WORKFLOW: lint✓ / unit✓(backend 6611 pass, frontend 200 files) / build✓(docker) / e2e✓(188)
  - 비고: e2e는 빈 DB라 repoint **로직**은 미실행(선행 V090/V091 동일). repoint는 SQL 검증쿼리 주석 + fail-loud RAISE + /ai-review database-reviewer로 보증.
- [x] /ai-review → resolution-applier (1차 07_34_38: W1~W17 반영; 최종 10_11_22 `--branch main`: Critical 4 전부 false positive 검증, W-10/11/12 fix(2ba5d0d2), W-1/I-4 spec 반영(44850c4a))
- [x] project-planner 위임 (spec 본문: 8-embedding-pipeline §5.5, 1-data-model §2.11, 3-error-handling §1.3 신코드, error-codes §4 retired-codes, 7-llm-client §5.5/§6, data-flow/6-knowledge-base §2, 2-navigation/5 legacy 서술 제거) — 커밋 77f9641f. 후속 error-code-routing 보완 44850c4a (consistency 10_37_05 BLOCK:NO).
- [x] 최종 TEST: unit✓(backend/frontend/web-chat-sdk/channel-web-chat 전체 PASS, 2026/06/12 10:50). e2e 는 이전 full run 188✓ 후 codebase 변경이 error-codes.spec.ts(단위 회귀 가드)뿐이라 재수행 생략.
- [x] --impl-done
