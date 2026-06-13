---
worktree: spec-sync-s-batch-b85f17
started: 2026-06-10
owner: resolution-applier
spec_impact:
  - spec/1-data-model.md
  - spec/5-system/8-embedding-pipeline.md
---
# Spec Update Draft — PR2 Embedding 1급화 SPEC-DRIFT

> **완료 (2026-06-13, spec-sync-s-batch) — 후속 머지(PR4b / Unified Model Management, V088~V094)에 흡수됨**:
> - **INFO-1**: `spec/1-data-model.md §2.11` 에 `embedding_model_config_id`(V091)가 이미 1급 필드로 등재됨.
>   본 plan 이 제안한 legacy 컬럼 `[LEGACY — V092 제거 예정]` 태깅은 **부적용** — 해당 두 컬럼(`embedding_llm_config_id`·
>   `embedding_model`)은 PR4b 의 V093 repoint + V094 DROP 으로 **이미 비가역 제거**됐다(§2.11·§537 note 반영). plan 의 stale 한
>   3-step 폴백 텍스트를 적용했으면 퇴행이었을 것 → 적용 안 함.
> - **INFO-2**: `spec/5-system/8-embedding-pipeline.md §5.5 "임베딩 설정 해석 폴백 체인 (resolveEmbedding)"` 이 이미 존재
>   (PR4b 이후 2-step 체인으로 — plan 의 3-step 보다 발전된 현행). 추가 작업 불요.
> - **INFO-3**: 동 문서 frontmatter `code:` 에 `model-config.service.ts`·`rag-search.service.ts` 이미 등재됨.
>
> 결론: 본 plan 의 모든 항목이 후속 작업에서 충족(또는 의도적으로 supersede)됨. spec 추가 편집 없이 종결.

## 분류

SPEC-DRIFT (코드 개선을 spec 에 반영) — PR2 구현이 spec 보다 앞서 있으므로 코드 revert 없이 spec 을 갱신한다.

---

## 원본 발견사항

### INFO-1 (SPEC-DRIFT)
SUMMARY#INFO-1: `spec/1-data-model.md §2.11` KnowledgeBase 필드 표에 `embedding_model_config_id` (V091) 미반영, legacy 컬럼도 누락.

### INFO-2 (SPEC-DRIFT)
SUMMARY#INFO-2: `spec/5-system/8-embedding-pipeline.md §5.2` 가 단일 문자열 경로만 명시 — PR2 3단계 폴백 체인 미반영.

### INFO-3 (SPEC-DRIFT)
SUMMARY#INFO-3: `spec/5-system/8-embedding-pipeline.md` frontmatter `code:` 에 `model-config.service.ts`, `rag-search.service.ts` 미포함.

---

## 제안 변경

### 1. `spec/1-data-model.md §2.11` KnowledgeBase 필드 표

**Before (발췌):**
```
| embedding_llm_config_id | UUID? | FK → LlmConfig(id) |
| embedding_model         | text  | DB default 'text-embedding-3-small' |
```

**After:**
```
| embedding_model_config_id | UUID? | FK → ModelConfig (kind=embedding), ON DELETE SET NULL. V091 추가. NULL 이면 폴백 체인(§ 폴백) 사용 |
| embedding_llm_config_id   | UUID? | FK → ModelConfig(id). [LEGACY — V092 제거 예정] legacy piggyback config |
| embedding_model           | text  | DB default 'text-embedding-3-small'. [LEGACY — V092 제거 예정] legacy 모델 문자열 |
```

### 2. `spec/5-system/8-embedding-pipeline.md §5.2` 폴백 체인 명문화

현재 §5.2 는 단일 `embedding_model` 문자열 경로만 명시한다.
아래 내용을 §5.2 또는 별도 §5.5 "임베딩 설정 해석 (resolveEmbedding)" 으로 추가:

```markdown
## §5.5 임베딩 설정 해석 폴백 체인 (PR2, model-config.service.ts)

KB 임베딩에 사용할 `(ModelConfig, model)` 은 아래 3단계 폴백 체인으로 해석한다:

1. **1급 경로**: `knowledge_base.embedding_model_config_id != NULL`
   → `ModelConfig(kind=embedding)` 직접 조회 + `config.defaultModel` 사용.
2. **워크스페이스 default**: `embedding_model_config_id` 미지정
   → 워크스페이스 default `kind=embedding` ModelConfig + `defaultModel` 사용.
3. **legacy 폴백**: 1·2 모두 없을 때
   → `embedding_llm_config_id` 있으면 해당 ModelConfig, 없으면 ws default chat config.
   → 모델 문자열은 `knowledge_base.embedding_model` (legacy 컬럼) 사용.
   → 모든 폴백 경로 실패 시 `NotFoundException(MODEL_CONFIG_NOT_FOUND)`.

> 이 체인은 `model-config.service.ts::resolveEmbedding()` 이 구현하며,
> `embedding.service.ts` 와 `rag-search.service.ts` 가 호출한다.
```

### 3. `spec/5-system/8-embedding-pipeline.md` frontmatter `code:` 갱신

**Before:**
```yaml
code:
  - codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts
```

**After (추가):**
```yaml
code:
  - codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts
  - codebase/backend/src/modules/model-config/model-config.service.ts
  - codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts
```

---

## 작업자 노트

- `project-planner` 가 `/consistency-check --spec` 통과 후 실제 spec 파일에 반영.
- 코드는 이미 PR2 에서 구현 완료. spec 만 추종.
- INFO-3 frontmatter 변경은 단순 추가이므로 consistency-check 차단 가능성 낮음.
- INFO-1 의 legacy 태그는 V092 PR4 에서 해당 컬럼 실제 제거 시 spec 에서도 삭제.
