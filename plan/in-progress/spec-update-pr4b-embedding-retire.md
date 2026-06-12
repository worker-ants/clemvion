---
worktree: pr4b-kb-embedding-retire
started: 2026-06-12
owner: resolution-applier
---
# Spec Update Draft — PR4b KB 임베딩 legacy 컬럼 은퇴 + 에러코드 통일

## 분류
SPEC-DRIFT (코드가 spec 을 의도적으로 개선·확장 — spec 이 따라와야 함)
+ spec 결함 (에러코드 테이블 누락·모순)

## 원본 발견사항

- **SUMMARY Critical #1** (API 계약 / 문서화): 에러코드 rename(`LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID`, `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING`) — `spec/conventions/error-codes.md §3 historical-artifact` 등재 미완료. CHANGELOG/릴리즈 노트 미기록.
- **SUMMARY Warning #8** (SPEC-DRIFT): `spec/5-system/8-embedding-pipeline.md §5.5` — legacy step-3 서술 및 "V092 에서 제거 예정" 문구 잔존. V093/V094(PR4b)에서 실제 제거 완료.
- **SUMMARY Warning #9** (SPEC-DRIFT): `spec/5-system/3-error-handling.md §1.3` — `MODEL_CONFIG_DEFAULT_MISSING` 미등재, `MODEL_CONFIG_NOT_FOUND` 설명의 "default 해석 실패" 문구 잔존.
- **SUMMARY Warning #10** (API 계약): `CreateKnowledgeBaseDto`/`UpdateKnowledgeBaseDto` 에서 `embeddingModel`·`embeddingLlmConfigId` 필드 완전 제거 — silent breaking change. CHANGELOG/릴리즈 노트 미기록.

## 제안 변경

### 1. `spec/5-system/8-embedding-pipeline.md §5.5` (SPEC-DRIFT)

**변경 목적**: V093/V094(PR4b)에서 legacy step-3(chat piggyback 폴백) 제거 완료. spec 의 "V092 에서 제거 예정" 문구와 3-step 서술을 실제 구현(2-step)으로 갱신.

**Before (현재)**:
```
§5.5 resolveEmbedding 폴백 체인 (3-step):
  step-1: embeddingModelConfigId → kind=embedding config
  step-2: ws default kind=embedding config
  step-3 (legacy, V092 이후 제거 예정): embeddingLlmConfigId + kb.embeddingModel 문자열
```

**After (제안)**:
```
§5.5 resolveEmbedding 폴백 체인 (2-step, PR4b/V093-V094 이후):
  step-1: embeddingModelConfigId → kind=embedding config + config.defaultModel
  step-2: ws default kind=embedding config + config.defaultModel
  — legacy step-3(chat piggyback 폴백, embeddingLlmConfigId/embedding_model)은
    V093 repoint + V094 DROP(PR4b)에서 제거됨.
    기존 KB 는 V093 에서 1급 kind=embedding config 로 repoint 됨.
```

`spec/1-data-model.md §2.11` knowledge_base 테이블 행:
- `embedding_llm_config_id` 행: "[LEGACY — PR4b 제거 예정]" → "[LEGACY — PR4b(V093/V094) 에서 제거됨]" 또는 행 삭제.
- `embedding_model` 행: 동일 처리.

### 2. `spec/5-system/3-error-handling.md §1.3` (spec 결함 + SPEC-DRIFT)

**변경 목적**: PR4b 신규 에러코드 `MODEL_CONFIG_DEFAULT_MISSING(400)` 등재, `MODEL_CONFIG_NOT_FOUND` 설명 정정.

**Before**:
| 에러코드 | HTTP | 설명 |
|---|---|---|
| MODEL_CONFIG_NOT_FOUND | 404 | model config id 부재 또는 default 해석 실패 |

**After**:
| 에러코드 | HTTP | 설명 |
|---|---|---|
| MODEL_CONFIG_NOT_FOUND | 404 | model config id 부재(id 지정 경로) + resolveEmbedding ws-default 부재(임베딩 config = 리소스 부재). cross-kind access 도 동일 코드로 처리(노출 방지). |
| MODEL_CONFIG_DEFAULT_MISSING | 400 | id 미지정 시 워크스페이스 default config 없음(setup 안내용). resolveConfig(chat/LLM) ws default 경로 **전용**. |

> **superseded note (2026-06-12)**: 적용 완료(commit 77f9641f). 위 §2 의 초기 draft 는 `MODEL_CONFIG_DEFAULT_MISSING` 발행 경로에 `resolveEmbedding` 을 포함했으나, 사용자 결정 #2 에 따라 `resolveEmbedding` ws-default 부재는 `MODEL_CONFIG_NOT_FOUND`(404) 로 분리됐다. 최종 정의는 `spec-fix-error-code-routing.md` 및 `spec/5-system/3-error-handling.md §1.3` 참조.

### 3. `spec/conventions/error-codes.md §3 historical-artifact` (spec 결함)

**변경 목적**: 구 코드 `LLM_CONFIG_NOT_FOUND`, `LLM_CONFIG_INVALID` 를 retired/historical-artifact 로 등재해 외부 소비자가 rename 배경을 확인할 수 있게 함.

**제안 추가**:
```markdown
## §3 Historical Artifacts (Retired Codes)

| 구 코드 | 대체 코드 | PR | 비고 |
|---|---|---|---|
| LLM_CONFIG_NOT_FOUND | MODEL_CONFIG_DEFAULT_MISSING (400) | PR4b (#) | default 미설정 경로 → 신규 코드. id 부재(404)는 MODEL_CONFIG_NOT_FOUND 유지. |
| LLM_CONFIG_INVALID | MODEL_CONFIG_INVALID (400) | PR4b (#) | 접두어 통일(MODEL_CONFIG_*). 의미·status 변경 없음. |
```

### 4. `spec/5-system/7-llm-client.md §5.5, §6` (SPEC-DRIFT)

구 코드명(`LLM_CONFIG_NOT_FOUND`, `LLM_CONFIG_INVALID`) 참조가 잔존하면 신 코드명으로 갱신.
- `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` (default 미설정 경로)
- `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID`

### 5. `spec/data-flow/6-knowledge-base.md §2` (SPEC-DRIFT)

knowledge_base 테이블 컬럼 목록에서 `embedding_model`, `embedding_llm_config_id` 행 제거(V094 DROP 완료).

### 6. `spec/2-navigation/5-knowledge-base.md`, `6-config.md` (SPEC-DRIFT)

legacy 임베딩 서술(embeddingLlmConfigId, embedding_model, 3-step 폴백 언급) 제거.
- KB 설정 UI 에서 `embedding_llm_config_id` 필드 제거 내용 반영.
- `embeddingModelConfigId` 기반 1급 config 선택 UI 서술로 대체.

### 7. 외부 API 소비자 / CHANGELOG (Critical #1, Warning #10)

**사용자 결정 (2026-06-12): 자사 전용 — 문서화로 충분.**
- 외부 API 소비자 없음 전제. Sunset 헤더·deprecation 윈도우·구코드 이중발행 **불요**.
- 해소: (a) `spec/conventions/error-codes.md §3 historical-artifact` 에 구 코드 등재(§3 본 draft),
  (b) CHANGELOG 에 breaking change 기록:
  - `embeddingModel`, `embeddingLlmConfigId` DTO 필드 제거 (KB create/update body 에서 무시됨 → silent breaking)
  - 에러코드 rename (`LLM_CONFIG_NOT_FOUND`→`MODEL_CONFIG_DEFAULT_MISSING`, `LLM_CONFIG_INVALID`→`MODEL_CONFIG_INVALID`)
  - 프론트엔드는 이미 신코드 처리 + embeddingModelConfigId 전송 → 자사 무중단.

## 적용 위치 요약

| 파일 | 변경 종류 |
|---|---|
| `spec/5-system/8-embedding-pipeline.md §5.5` | §5.5 2-step 으로 교체, "V092 제거 예정" 제거 |
| `spec/1-data-model.md §2.11` | legacy 컬럼 행 제거 또는 "PR4b 제거됨" 갱신 |
| `spec/5-system/3-error-handling.md §1.3` | MODEL_CONFIG_DEFAULT_MISSING 행 추가, MODEL_CONFIG_NOT_FOUND 설명 정정 |
| `spec/conventions/error-codes.md §3` | LLM_CONFIG_* retired historical-artifact 등재 |
| `spec/5-system/7-llm-client.md §5.5, §6` | 구 코드명 → 신 코드명 |
| `spec/data-flow/6-knowledge-base.md §2` | embedding_model, embedding_llm_config_id 컬럼 제거 |
| `spec/2-navigation/5-knowledge-base.md` | legacy 임베딩 서술 제거 |
| `spec/2-navigation/6-config.md` | legacy 임베딩 서술 제거 |
| `spec/data-flow/7-llm-usage.md` | `embeddingLlmConfigId` 참조 제거 (PR4b V094 DROP 반영) |
| CHANGELOG (또는 릴리즈 노트) | breaking change 기록 (외부 소비자 여부에 따라 수준 결정) |
