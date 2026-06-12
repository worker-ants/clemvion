### 발견사항

- **[INFO]** `spec/` 변경 전용 PR — 대상 파일이 모두 마크다운 문서(spec, review 산출물)이며 테스트 대상 코드 파일이 없음
  - 위치: 파일 1~19 전체 (review/consistency/**, spec/*.md, spec/5-system/*.md, spec/data-flow/*.md, spec/conventions/error-codes.md)
  - 상세: 이번 변경은 완전히 spec·review 문서 갱신으로 구성된다. `codebase/` 하위 구현 파일이 직접 변경되지 않으므로 "테스트 추가 필요성"은 구현 코드 관점에서는 없다. 그러나 이 spec 갱신이 전제하는 구현 변경(`resolveEmbedding` 2-step 단순화, `MODEL_CONFIG_DEFAULT_MISSING` 신설, `LLM_CONFIG_INVALID`→`MODEL_CONFIG_INVALID` rename, V093/V094 마이그레이션)이 이미 코드베이스에 반영돼 있고 해당 테스트들이 실제로 존재하는지 교차 검증이 필요하다.
  - 제안: 아래 구체적 발견사항 참조.

- **[INFO]** `resolveEmbedding` 2-step 체인 테스트 존재 확인 — 충분히 커버됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/codebase/backend/src/modules/model-config/model-config.service.spec.ts:445-675`
  - 상세: spec 변경(8-embedding-pipeline.md §5.5 — 3-step → 2-step)과 대응하는 테스트 블록 `describe('resolveEmbedding (1급 폴백 체인 — PR4b: legacy step-3 제거)', ...)` 이 존재하며 (1) embeddingModelConfigId 지정 경로, (2) ws default 폴백 경로, cross-kind 거부, null 명시 전달 등 정상·실패 경로가 모두 커버된다. 특히 `MODEL_CONFIG_NOT_FOUND 404 전용 검증` 섹션에서 `resolveEmbedding: ws default 없음 → 404 NotFoundException (400 아님)` 케이스가 명시적으로 테스트되어 있어 spec §5.5의 "둘 다 없으면 `MODEL_CONFIG_NOT_FOUND`(404)" 계약과 일치한다. legacy step-3 폴백(chat piggyback) 경로에 대한 테스트가 없다는 점은 정상 — 해당 경로 자체가 제거됐기 때문이다.
  - 제안: 없음. 커버리지 충분.

- **[INFO]** `MODEL_CONFIG_DEFAULT_MISSING`(400) 테스트 존재 확인 — 두 위치에서 커버됨
  - 위치: `model-config.service.spec.ts:434-442` (resolveConfig 경로), `llm.service.spec.ts:501-525` (llm.service resolveConfig 경로)
  - 상세: spec 변경(3-error-handling.md §1.3 — `MODEL_CONFIG_DEFAULT_MISSING` 신설)과 대응하는 구현 테스트가 두 경로에서 독립적으로 존재한다. `resolveConfig(undefined, 'ws-1', kind)` → default 없음 → `MODEL_CONFIG_DEFAULT_MISSING`(400) 검증과 workspaceId 별도 포함 여부까지 테스트되어 있다.
  - 제안: 없음. 커버리지 충분.

- **[INFO]** `MODEL_CONFIG_INVALID` 테스트 존재 확인 — spec 갱신(7-llm-client.md)과 구현 테스트 일치
  - 위치: `model-config.service.spec.ts:538-624` (SSRF guard), `llm-preview.service.spec.ts:161,408`
  - 상세: spec 변경(7-llm-client.md — `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 4개소 치환)에 대응하는 구현 테스트에서 이미 `MODEL_CONFIG_INVALID` 코드명을 사용한다. `llm-preview.service.spec.ts`에서도 `MODEL_CONFIG_INVALID` 테스트가 존재하며, `LLM_CONFIG_INVALID` 잔존 참조가 테스트 코드에는 없다.
  - 제안: 없음. 테스트 코드는 이미 신 코드명을 사용하고 있어 spec 갱신과 일치.

- **[INFO]** V093/V094 마이그레이션 파일 존재 확인 — fail-loud 로직 포함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/codebase/backend/migrations/V093__kb_embedding_repoint.sql`, `V094__kb_drop_legacy_embedding_columns.sql`
  - 상세: V093은 step-1(ws default embedding pin) → step-2·3(legacy creds 복사 find-or-create) → fail-loud `DO $$` RAISE 블록(NULL KB 0건 보증)으로 구성돼 있다. `migrations.spec.ts`의 Flyway 명명 컨벤션 가드가 V093/V094 파일을 자동 포함해 정수 prefix·중복 체크를 수행한다. SQL 로직 자체에 대한 단위 테스트는 없으나, 이는 본 프로젝트의 Flyway forward-only 정책(migrations.spec.ts의 범위: 파일명 컨벤션 검증만)과 일치한다.
  - 제안: V093 fail-loud RAISE 로직에 대한 통합 테스트(실제 DB 포함)가 없어도, fail-loud 자체가 운영 배포 시 검증 게이트 역할을 하므로 별도 SQL 단위 테스트는 강제 요구 사항이 아니다. 다만 V093 step-3b (ws default chat 폴백 경유 find-or-create)는 운영 실행 전 staging DB에서 수동 검증을 권장한다.

- **[WARNING]** `error-codes.spec.ts` — `MODEL_CONFIG_DEFAULT_MISSING`·`MODEL_CONFIG_NOT_FOUND`·`MODEL_CONFIG_INVALID` 가 `ErrorCode` enum 에 등재됐는지 검증하는 테스트 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/codebase/backend/src/nodes/core/error-codes.spec.ts`
  - 상세: 기존 `error-codes.spec.ts`는 `ErrorCode` enum의 UPPER_SNAKE_CASE 포맷·카테고리 존재 여부를 검증하지만, 개별 ModelConfig 관련 에러코드가 enum에 등재됐는지는 테스트하지 않는다. 현재 grep 결과에서 `error-codes.ts`에 `MODEL_CONFIG*` 계열 코드명이 없는 것으로 확인됐다. 이는 이 코드들이 `ErrorCode` enum 외부(인라인 문자열 리터럴)로 발행되고 있음을 의미한다. spec 변경(error-codes.md §4 Retire 이력에 `LLM_CONFIG_NOT_FOUND`·`LLM_CONFIG_INVALID` 등재)이 코드 enum 상태와 괴리가 있다면 spec이 "구 코드는 더 이상 발행되지 않으며(코드베이스에서 완전 제거)"라고 단언하는 §4 전제가 테스트로 보증되지 않는 상태다.
  - 제안: `error-codes.spec.ts`에 `LLM_CONFIG_INVALID`·`LLM_CONFIG_NOT_FOUND` 가 `ErrorCode` enum 및 코드베이스 어디에도 발행되지 않음을 확인하는 회귀 테스트를 추가하거나, 적어도 `MODEL_CONFIG_INVALID`가 enum에 없어도 spec §4의 "완전 제거" 단언이 구현상 참임을 CI grep 가드로 보증할 것을 권장한다.

- **[INFO]** `knowledge-base.service.spec.ts` — legacy 컬럼 은퇴 관련 주석 확인됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts:449`
  - 상세: 주석 `// PR4b: embeddingModel·embeddingLlmConfigId 컬럼은 은퇴됐다`가 확인돼 해당 테스트 파일이 PR4b 변경을 인식한 채로 작성됐음을 나타낸다. legacy 컬럼을 파라미터로 전달하는 테스트는 없어 회귀 위험이 없다.
  - 제안: 없음.

---

### 요약

이번 변경은 `spec/`, `review/` 문서만 수정하는 순수 문서 PR이므로 직접적인 "테스트 코드 변경"은 없다. 테스트 관점의 핵심 평가는 이 spec 갱신이 전제하는 구현 변경들이 이미 테스트로 커버됐는지 여부다. `resolveEmbedding` 2-step 체인, `MODEL_CONFIG_DEFAULT_MISSING`(400) 신설, `MODEL_CONFIG_INVALID` rename, V093/V094 마이그레이션 파일은 모두 구현됐고 대응 테스트가 존재한다. 단 `error-codes.spec.ts`에 spec §4("구 코드 완전 제거") 단언을 기계적으로 보증하는 회귀 가드가 없다는 점이 유일한 테스트 갭이다 — `LLM_CONFIG_INVALID`·`LLM_CONFIG_NOT_FOUND`가 코드베이스 어딘가에 여전히 잔존하더라도 CI가 이를 검출하지 못할 수 있다.

### 위험도

LOW
