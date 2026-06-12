# 부작용(Side Effect) 리뷰 결과

리뷰 대상: PR4b KB 임베딩 legacy 컬럼 은퇴 + 에러코드 통일 — spec 변경 및 consistency 검토 산출물

---

## 발견사항

### 공개 API 인터페이스 변경

- **[WARNING]** `MODEL_CONFIG_DEFAULT_MISSING` 신규 에러코드 — 코드베이스 미존재 상태에서 spec 에 등재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/5-system/3-error-handling.md` line 50 신규 행, `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/conventions/error-codes.md §4`
  - 상세: `error-codes.md §4` Retire 이력에 `LLM_CONFIG_NOT_FOUND → MODEL_CONFIG_DEFAULT_MISSING` 를 "구 코드는 더 이상 발행되지 않으며(코드베이스에서 완전 제거)"라고 선언했으나, `llm.service.ts` line 356 에서 `LLM_CONFIG_NOT_FOUND` 가 여전히 발행 중이고 `MODEL_CONFIG_DEFAULT_MISSING` 는 `error-codes.ts` 에 미존재 상태다. spec 이 클라이언트와의 공개 API 계약으로 기능하므로, 실제로 발행되지 않는 코드를 "발행됨"으로 등재하면 클라이언트가 해당 코드를 처리하는 로직을 작성하거나 기존 `LLM_CONFIG_NOT_FOUND` 처리를 제거하는 부작용이 생긴다.
  - 제안: `error-codes.ts` 에 `MODEL_CONFIG_DEFAULT_MISSING` 를 실제 추가하고 `llm.service.ts`·`model-config.service.ts` throw 경로를 전환 완료한 후 spec 등재. 또는 spec 에 "(구현 pending)" 주석을 명시해 클라이언트에게 아직 발행 전임을 알린다.

- **[WARNING]** `LLM_CONFIG_INVALID` spec 에서 retired 처리 — `llm-preview.service.ts` 에서 live 발행 중
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/conventions/error-codes.md §4`, `codebase/backend/src/modules/llm/llm-preview.service.ts` line 39/48/69
  - 상세: `error-codes.md §4` 가 `LLM_CONFIG_INVALID` 를 "코드베이스에서 완전 제거"된 retired 코드로 선언했으나, 동 코드는 `llm-preview.service.ts` 에서 여전히 400 응답으로 발행된다. 클라이언트가 spec §4 를 보고 `LLM_CONFIG_INVALID` 처리 코드를 제거할 경우 운영 중인 preview SSRF 차단·팩토리 오류 응답을 놓치는 직접적 부작용이 발생한다.
  - 제안: `llm-preview.service.ts` 에서 `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 교체를 이번 PR4b 에 포함하거나, 완료 전까지 §4 에서 해당 항목 제거.

- **[WARNING]** `POST /api/knowledge-bases` request body shape 변경 — `embedding_model` 필드 제거
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/data-flow/6-knowledge-base.md` line 44
  - 상세: spec diff 에서 `POST /api/knowledge-bases` payload 에서 `embedding_model` 필드가 제거됐다. 이 API 를 사용하는 기존 클라이언트(프론트엔드, 통합 테스트, e2e)가 `embedding_model` 을 포함해 요청하면 unknown field 무시 또는 validation 오류가 발생할 수 있다. spec 변경이 실제 컨트롤러 validation schema 변경과 동기화됐는지, 프론트엔드 KB 생성 폼도 해당 필드를 제거했는지 확인이 필요하다.
  - 제안: `knowledge-base.controller.ts` / DTO(`create-knowledge-base.dto.ts`)에서 `embedding_model` 필드가 실제 제거됐는지 확인. 프론트엔드 KB 생성 폼에서도 해당 필드 제거 여부 확인.

### 시그니처/인터페이스 변경의 호출자 영향

- **[WARNING]** `resolveEmbedding` 내부 폴백 체인 3-step → 2-step 축소 — legacy `embedding_llm_config_id`/`embedding_model` 의존 KB 는 V093 repoint 이전에 `MODEL_CONFIG_NOT_FOUND`(404) 를 받게 됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/5-system/8-embedding-pipeline.md` §5.5
  - 상세: spec 이 `resolveEmbedding` 폴백 체인을 step-3(legacy 폴백) 포함 3단계에서 2단계로 변경했다. step-3 제거는 V093 repoint 가 모든 KB 를 1급 config 로 migration 한 이후에야 안전하다. 만약 V093 마이그레이션 없이 2-step spec/코드가 배포되면 `embedding_llm_config_id` 만 설정된 KB 의 임베딩/검색 호출이 `MODEL_CONFIG_NOT_FOUND`(404) 를 반환하는 운영 장애가 발생한다. spec 이 V094 이후 상태를 기술한다면 V093 마이그레이션이 반드시 선행돼야 함을 deployment sequencing 규약으로 명시해야 한다.
  - 제안: `8-embedding-pipeline.md §5.5` 에 "V093 repoint 완료 이전에는 기존 3-step 코드가 유지돼야 한다(배포 순서 의존)" 를 명시하거나, V093 적용 후 spec 변경 PR 을 분리한다.

- **[WARNING]** vector KB 검색 그룹 키 변경 — `(embedding_model, embedding_dimension, embedding_model_config_id)` → `(embedding_model_config_id, embedding_dimension)` 으로 축소
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/data-flow/6-knowledge-base.md` line 130
  - 상세: RAG 검색의 `groupVectorKbs` 가 사용하는 그룹 키에서 `embedding_model` 이 제거됐다. 기존에 `embedding_model` 이 그룹 분기에 사용되던 legacy KB(V093 repoint 전)가 있다면 그룹화 로직이 달라져 같은 모델을 가리키는 config 끼리 묶이지 않거나, 서로 다른 config 가 같은 그룹으로 처리되는 동작 변화가 발생할 수 있다. V093 이후 `embedding_llm_config_id`/`embedding_model` 이 DROP 됐다면 문제없으나, 코드·스펙·마이그레이션 적용 타이밍이 일치해야 한다.
  - 제안: `groupVectorKbs` 구현이 이미 1급 config id 기반으로 업데이트됐는지, V093 전후 동작이 안전한지 확인.

### 전역/공유 상태 변경

- **[INFO]** `embedding_dimension` NULL reset 경로 변경 — ② 조건 변경
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/data-flow/6-knowledge-base.md` line 251
  - 상세: NULL reset 경로 ② 가 "`PATCH /:id` 로 `embedding_model` 실제 변경 시" 에서 "`embedding_model_config_id` 실제 변경 시"로 변경됐다. 이전에는 bare model 문자열(`embedding_model`)이 변경될 때 dimension 을 reset 했으나, 이제는 `embedding_model_config_id` FK 변경 시에만 reset 한다. `embedding_model_config_id` 는 동일하게 유지하면서 해당 config 의 `default_model` 만 변경되는 경우 dimension reset 이 더 이상 트리거되지 않을 수 있다 — 이는 이전과 다른 공유 상태 변경 시맨틱이다. dimension 불일치로 인한 벡터 검색 오류 가능성은 낮지만 케이스 확인이 필요하다.
  - 제안: `PATCH /:id` 에서 config 교체 시 config 의 `default_model` 이 바뀌는 경우에도 dimension reset 이 필요한지 검토.

### 문서 파생 부작용 (review/ 산출물)

- **[INFO]** `review/consistency/2026/06/12/09_01_10/_retry_state.json` — `agents_pending` 이 모두 채워진 상태로 커밋됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/review/consistency/2026/06/12/09_01_10/_retry_state.json`
  - 상세: `agents_success: []`, `agents_pending: [cross_spec, rationale_continuity, ...]` 인 초기 상태가 커밋됐다. 이 파일은 orchestrator 의 런타임 상태 파일로, 커밋 내용에 `SUMMARY.md` 와 개별 checker 결과가 모두 포함되어 있으므로 실제 완료 상태와 다른 미완료 상태 파일이 남아있는 것은 혼선 가능성이 있다. 직접적인 부작용은 없으나 후속 재실행 시 예상치 못한 동작을 유발할 수 있다.
  - 제안: 완료 시점의 상태(`agents_success` 가 채워진 상태)로 갱신하거나, 이 파일을 gitignore 처리한다.

---

## 요약

이번 PR4b 변경의 핵심 부작용 위험은 두 가지다. 첫째, `error-codes.md §4` 와 `3-error-handling.md` 가 `MODEL_CONFIG_DEFAULT_MISSING`(`LLM_CONFIG_NOT_FOUND` 의 대체)와 `LLM_CONFIG_INVALID` 의 retirement 를 완료 사실로 선언하고 있으나, 실제 코드베이스(`llm.service.ts`, `llm-preview.service.ts`)에서는 구 코드들이 여전히 발행 중이다 — spec 이 클라이언트 계약 문서이므로 이 불일치는 클라이언트가 구 코드 처리를 제거하거나 없는 코드를 처리하는 직접적인 인터페이스 부작용을 일으킨다. 둘째, `resolveEmbedding` 3-step → 2-step 축소는 V093 마이그레이션이 선행되지 않은 상태에서 코드가 배포되면 legacy-only KB 의 임베딩·검색이 전면 장애로 이어진다 — V093 완료 이전 배포 시 예상치 못한 `MODEL_CONFIG_NOT_FOUND` 오류가 공유 상태(KB 검색 가용성)에 부정적 영향을 미친다. `POST /api/knowledge-bases` 의 `embedding_model` 필드 제거와 그룹 키 변경도 실제 코드와의 타이밍 동기화를 별도로 확인해야 한다. spec-only 변경임을 고려하면 직접적인 코드 사이드 이펙트는 구현 PR 에서 발생하지만, 이번 spec draft 가 미완성 구현을 완료 사실로 기술하는 점이 가장 큰 위험이다.

---

## 위험도

MEDIUM
