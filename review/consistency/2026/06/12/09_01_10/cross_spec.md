# Cross-Spec 일관성 검토 결과

target: `plan/in-progress/spec-update-pr4b-embedding-retire.md`

---

## 발견사항

### 발견사항 1

- **[WARNING]** `spec/5-system/7-llm-client.md` — `LLM_CONFIG_INVALID` 참조 4곳 미갱신
  - target 위치: draft §4 `spec/5-system/7-llm-client.md §5.5, §6` — "구 코드명 → 신 코드명" 갱신 대상
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/5-system/7-llm-client.md` — 4곳에 `LLM_CONFIG_INVALID` 잔존
    - line 235: `azure/local baseUrl 누락은 Error throw — 호출 측(§5.5 preview)이 이를 LLM_CONFIG_INVALID 로 래핑한다.`
    - line 257: `기존 LLM_CONFIG_INVALID 계열로 래핑한다`
    - line 327: SSRF 가드 차단 시 `LLM_CONFIG_INVALID` 로 차단
    - line 341: 에러 처리 표 `LLM_CONFIG_INVALID — 팩토리 생성 실패 또는 preview SSRF 차단`
  - 상세: target draft 의 §제안4 는 `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 갱신을 명시했으나, 현재 `7-llm-client.md` 의 위 4개 참조는 여전히 구 코드명을 사용 중이다. draft 가 채택되면 이 파일은 `3-error-handling.md §1.3` 에 등재된 신 코드명(`MODEL_CONFIG_INVALID`)과 모순된다.
  - 제안: draft §4 갱신 범위에 위 4개 위치를 명시적으로 포함하거나, 해당 라인을 `MODEL_CONFIG_INVALID` 로 교체하는 편집을 draft 에 추가한다.

---

### 발견사항 2

- **[WARNING]** `spec/5-system/3-error-handling.md §1.3` — `MODEL_CONFIG_NOT_FOUND` 설명에 "default 해석 실패" 문구 잔존
  - target 위치: draft §2 — `MODEL_CONFIG_NOT_FOUND` 를 "id 부재(id 지정 경로 전용). cross-kind access 도 동일 코드로 처리(노출 방지)." 로 정정 제안
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/5-system/3-error-handling.md` line 50 — `MODEL_CONFIG_NOT_FOUND | 지정 id 의 ModelConfig 부재 또는 cross-kind 접근 차단(존재 누설 방지), default 해석 실패`
  - 상세: 현재 `3-error-handling.md` 의 `MODEL_CONFIG_NOT_FOUND` 설명에 "default 해석 실패"가 포함되어 있다. draft 는 이 경로를 신규 코드 `MODEL_CONFIG_DEFAULT_MISSING(400)` 으로 분리하면서 `MODEL_CONFIG_NOT_FOUND` 설명을 "id 지정 경로 전용"으로 좁히자고 제안한다. draft 가 채택되면 현재 spec 의 `MODEL_CONFIG_NOT_FOUND` 설명("default 해석 실패")은 모순이 되고, `MODEL_CONFIG_DEFAULT_MISSING` 이 미등재 상태이므로 에러 카탈로그에 빈칸이 생긴다.
  - 제안: draft §2 의 변경을 `3-error-handling.md §1.3` 에 실제로 반영하기 전 별도 패치로 적용 확인 필요. 신규 코드 `MODEL_CONFIG_DEFAULT_MISSING(400)` 행 추가 + `MODEL_CONFIG_NOT_FOUND` 설명 수정을 동시에 수행해야 일관성이 유지된다.

---

### 발견사항 3

- **[WARNING]** `spec/conventions/error-codes.md §3` — `LLM_CONFIG_INVALID` / `LLM_CONFIG_NOT_FOUND` historical-artifact 미등재
  - target 위치: draft §3 — `§3 Historical Artifacts (Retired Codes)` 에 두 코드 등재 제안
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/conventions/error-codes.md §3` — 현재 §3 Historical-artifact 레지스트리에 해당 코드 없음
  - 상세: `error-codes.md §2` (안정성/rename 정책)는 에러 코드 rename 이 breaking change 임을 명시하고, §3 은 "원칙을 따르지 않는 기존 코드를 명시적으로 등록"하는 레지스트리다. `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID`, `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` rename 이 이미 코드에 적용됐으나 §3 에 등재되지 않아 이 파일의 own 정책(§2)과 내부 불일치 상태다. draft 의 제안은 이 불일치를 해소하는 올바른 방향이다.
  - 제안: draft §3 제안을 `error-codes.md §3` 에 그대로 적용한다. 단, PR 번호 표시 컬럼의 `PR4b (#)` 를 실제 PR 번호로 채워야 한다.

---

### 발견사항 4

- **[WARNING]** `spec/5-system/8-embedding-pipeline.md §5.5` — "V092 에서 제거 예정" 문구 및 3-step 폴백 서술 잔존
  - target 위치: draft §1 — §5.5 2-step 으로 교체, "V092 제거 예정" 제거 제안
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/5-system/8-embedding-pipeline.md` line 169~177 — 3-step 폴백(legacy step-3 포함) 서술과 `V092 에서 제거 예정` 주석 잔존
  - 상세: 현재 `8-embedding-pipeline.md §5.5` 의 `resolveEmbedding` 폴백 체인은 step-3(legacy `embedding_llm_config_id` + `kb.embedding_model` 문자열)를 포함하는 3-step 으로 기술돼 있으며, 주석이 "V092 에서 제거 예정"으로 돼 있다. PR4b(V093/V094)에서 step-3 이 실제 제거됐으므로 spec 이 SPEC-DRIFT 상태다. `spec/1-data-model.md §2.11` KnowledgeBase 테이블의 `embedding_llm_config_id`, `embedding_model` 행도 "[LEGACY — PR4b 제거 예정]" 문구를 "[PR4b(V093/V094)에서 제거됨]" 으로 갱신하거나 행을 삭제해야 한다.
  - 제안: draft §1 제안을 `8-embedding-pipeline.md §5.5` 및 `1-data-model.md §2.11` 에 실제 반영한다.

---

### 발견사항 5

- **[WARNING]** `spec/data-flow/6-knowledge-base.md §2.1` — `knowledge_base` schema 매핑 테이블에 legacy 컬럼(`embedding_model`) 잔존
  - target 위치: draft §5 — `spec/data-flow/6-knowledge-base.md §2` 에서 `embedding_model`, `embedding_llm_config_id` 컬럼 제거 제안
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/data-flow/6-knowledge-base.md` line 250 — `knowledge_base` 생성 컬럼 목록에 `embedding_model` 포함. line 251 — `embedding_dimension` NULL reset 경로 설명에 `PATCH /:id 로 embedding_model 실제 변경 시` 언급
  - 상세: data-flow/6 §2.1 의 `knowledge_base` sink 테이블 컬럼 목록은 V094 DROP 이후에도 `embedding_model` 을 포함하며, NULL reset 경로 2번도 삭제된 컬럼을 기준으로 기술돼 있다. `spec/1-data-model.md §2.11` 및 `8-embedding-pipeline.md §5.5` 와의 연쇄 불일치가 발생한다. draft §5 의 제안이 채택되면 이 파일도 동기화가 필요하다.
  - 제안: draft §5 적용 시 `data-flow/6-knowledge-base.md §2.1` 의 `knowledge_base` 행에서 `embedding_model` 컬럼 언급 제거 및 NULL reset 경로 2번 설명 수정을 병행한다.

---

### 발견사항 6

- **[INFO]** `spec/data-flow/6-knowledge-base.md §1.6 embedding-probe` — legacy `llmConfigId` 파라미터 잔존
  - target 위치: draft §5 (data-flow 6 §2 컬럼 제거)
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/data-flow/6-knowledge-base.md` line 231 — `POST /api/knowledge-bases/embedding-probe { embeddingModelConfigId?, llmConfigId?, embeddingModel }` — legacy `llmConfigId`·`embeddingModel` 파라미터가 API shape 에 여전히 포함
  - 상세: draft 의 primary 목표는 legacy 컬럼 제거지만, embedding-probe 엔드포인트의 request body 에도 legacy `llmConfigId`(구 LLM config 기반 폴백)가 명시돼 있다. PR4b 가 legacy step-3 를 제거했다면 이 파라미터도 더 이상 유효하지 않을 수 있다. draft 에서 명시적으로 다루지 않아 scope 밖일 수 있으나, 코드 변경 여부와 spec 기술이 일치하는지 확인 권장.
  - 제안: embedding-probe API 에서 `llmConfigId`·`embeddingModel` 파라미터가 실제 제거됐다면 draft scope 에 `data-flow/6 §1.6` 도 추가한다. 코드 변경 미수반이면 INFO 수준 동기화 작업으로 남긴다.

---

### 발견사항 7

- **[INFO]** `spec/5-system/7-llm-client.md §5.5` — SSRF 가드 경로의 `tei` 예외 설명에 코드명 이슈
  - target 위치: draft §4 `spec/5-system/7-llm-client.md §5.5`
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/5-system/7-llm-client.md` line 327 — SSRF 가드 설명에 `LLM_CONFIG_INVALID` 코드명 사용
  - 상세: SSRF 가드 차단 시 발행하는 코드명이 `LLM_CONFIG_INVALID` 로 기술돼 있다. `3-error-handling.md §1.3` 의 `MODEL_CONFIG_INVALID` 와 코드명이 일치하지 않는다. 발견사항 1 에서도 언급됐으나 SSRF 특화 경로는 별도 주목이 필요하다 — SSRF 차단 코드가 `MODEL_CONFIG_INVALID` 로 이미 rename 됐는지 코드 확인 권장.
  - 제안: `7-llm-client.md §5.5` 의 SSRF 가드 코드명을 `MODEL_CONFIG_INVALID` 로 갱신하거나, 발견사항 1 의 일괄 갱신에 포함한다.

---

## 요약

target draft 는 PR4b 에서 실제 적용된 코드 변경(legacy KB 임베딩 컬럼 제거, 에러코드 rename)을 spec 에 소급하는 올바른 방향의 변경이다. Cross-spec 충돌은 없으며, 주요 우려는 draft 가 갱신을 명시했으나 아직 현재 spec 과 불일치가 남아 있는 관련 파일들의 동기화 완료 여부다. 특히 `spec/5-system/7-llm-client.md` 에 `LLM_CONFIG_INVALID` 코드명이 4곳 잔존해 draft 채택 후에도 해당 파일을 별도로 갱신하지 않으면 에러코드 카탈로그(`3-error-handling.md §1.3`)와 모순이 발생한다. `spec/data-flow/6-knowledge-base.md §2.1` 의 legacy 컬럼 참조도 draft §5 범위와 연동해 정리가 필요하다. `spec/conventions/error-codes.md §3` historical-artifact 등재는 draft 그대로 적용하면 되며, `MODEL_CONFIG_DEFAULT_MISSING` 신규 등재는 `3-error-handling.md §1.3` 과 동시 갱신이 필수다.

---

## 위험도

MEDIUM
