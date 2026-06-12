# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

변경 파일 전체를 매트릭스 18개 트리거에 대조한 결과, 매칭되는 트리거는 아래 1개이며 나머지는 해당 없음이다.

---

### [INFO] `MODEL_CONFIG_DEFAULT_MISSING` 신규 에러코드 — ERROR_KO 미등록 (의도적 스코핑, 설명 참조)

- **변경 파일:**
  - `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/codebase/backend/src/modules/llm/llm.service.ts` — `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` 코드명 변경
  - `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/codebase/backend/src/modules/model-config/model-config.service.ts` — `MODEL_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` (resolveConfig 의 "default 없음" 경로)
- **매트릭스 항목:** `new-error-code` — "신규 errorCode 발행 (ErrorCode enum 추가)"
  - trigger: `codebase/backend/src/nodes/core/error-codes.ts` glob 매칭
  - targets: "backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 노출됨"
- **상세:**
  - 매트릭스 `new-error-code` 트리거는 `codebase/backend/src/nodes/core/error-codes.ts` glob 이다. 이 파일은 이번 PR 에서 변경되지 않았으므로 **트리거 조건 불충족** — glob 미매칭.
  - `MODEL_CONFIG_DEFAULT_MISSING` 는 API 계층(HTTP 400) 에러코드로, 모델 콤보박스 로더 오류 표시에 사용된다. 이 코드의 한국어 매핑은 `codebase/frontend/src/components/llm-config/loader-error-messages.ts` 의 컴포넌트 로컬 맵(`buildLoaderErrorMessages`)에 이미 추가됐다 (변경 set 내 포함).
  - 글로벌 `ERROR_KO` (`backend-labels.ts`) 는 실행-시점(노드 실행 중) 에러코드 전용이라 API 계층 400 코드를 추가할 대상이 아니다. 따라서 이 코드가 `ERROR_KO` 에 없어도 사용자에게 영문 그대로 노출되는 상황은 발생하지 않는다.
  - 단, `MODEL_CONFIG_NOT_FOUND` 는 기존 `ERROR_KO` 에 등록돼 있고 ("해당 모델 설정을 찾을 수 없어요") 이번 PR 에서 일부 `MODEL_CONFIG_NOT_FOUND` 발행 경로가 `MODEL_CONFIG_DEFAULT_MISSING` 로 분리됐다. 따라서 실행-시점에서 `MODEL_CONFIG_DEFAULT_MISSING` 가 발행될 경우 `ERROR_KO` 에 없어 영문 fallback 이 뜰 수 있다. 현재 resolveConfig 는 노드 실행 경로에서도 간접 호출될 수 있으므로 잠재 누락 가능성은 있다.
- **제안:**
  - `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO` 에 `MODEL_CONFIG_DEFAULT_MISSING: "워크스페이스 기본 모델 설정이 지정되어 있지 않아요."` 를 추가하는 것을 권장한다. 기존 `MODEL_CONFIG_NOT_FOUND` 항목 바로 아래에 추가하면 된다. 강제 의무는 아니지만(glob 트리거 불충족), 안전한 추가다.

---

### 해당 없음 — 기타 트리거 미매칭

아래 변경들은 해당 매트릭스 트리거에 매칭되지 않는다:

- **migration V093/V094, entity/DTO/service 변경:** 새 노드(`new-node`) 또는 노드 schema 변경(`node-schema-change`) 트리거는 `codebase/backend/src/nodes/**` 경로에만 적용된다. KB 모듈 파일들은 `codebase/backend/src/modules/knowledge-base/**` 경로이므로 glob 미매칭.
- **DTO 변경 (`create-knowledge-base.dto.ts`, `update-knowledge-base.dto.ts`):** `backend-api-change` 트리거는 "controller·DTO 의 swagger jsdoc" 동반 갱신을 요구한다. 변경된 DTO 내 jsdoc 은 이번 PR 에서 모두 갱신됐다 (`embeddingLlmConfigId` 필드 제거 + `embeddingModelConfigId` description 수정). 사용자 안내에 영향을 주는 API 노출 변경은 KB 문서(`knowledge-base.mdx`, `knowledge-base.en.mdx`)가 이미 1급 config 기반으로 서술돼 있어 stale 없음.
- **`loader-error-messages.ts` 추가 (`MODEL_CONFIG_DEFAULT_MISSING`):** `new-ui-string` 트리거(TSX 신규 한국어 리터럴)는 `.tsx` 파일에 적용된다. `.ts` 파일이고 i18n key 참조(`t("llmConfigs.errorConfigInvalid")`)를 통한 표현이므로 신규 하드코딩 한국어 리터럴 아님 — parity 가드 적용 대상 아님.
- **KB 문서(`knowledge-base.mdx/.en.mdx`):** 변경 set 에 포함되지 않았지만 현재 내용이 1급 config 기반으로 올바르게 서술돼 있어 stale 이슈 없음.

## 요약

매트릭스 18개 트리거 중 적극적으로 매칭되는 트리거는 0개 (글로브 기준 완전 미매칭). `new-error-code` 트리거 관련 인접 상황(`MODEL_CONFIG_DEFAULT_MISSING` 신규 코드) 이 1건 INFO 수준으로 관찰됐으나, 이미 컴포넌트 로컬 맵(`loader-error-messages.ts`)에서 처리됐고 글로벌 `ERROR_KO` 미등록은 API 계층 에러코드의 스코핑 결정이다. 동반 갱신 누락 판정 없음.

## 위험도

NONE

---

STATUS=success ISSUES=0
