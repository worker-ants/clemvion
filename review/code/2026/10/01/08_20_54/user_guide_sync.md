# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

해당 없음. 이 변경 set 은 `.claude/config/doc-sync-matrix.json` 의 어떤 trigger 에도 매칭되지 않는다.

### 발견사항

없음.

검토한 근거는 다음과 같다.

- 매트릭스 SSOT `.claude/config/doc-sync-matrix.json` 의 `rows[]` 19개를 적재했다. 변경 파일은 `git diff --name-only origin/main...HEAD` 와 payload 의 파일 목록 16개로 확인했다. 작업 트리(`git diff --name-only HEAD`)에는 추적 파일의 미커밋 변경이 없다.
- `codebase/**` 변경은 `codebase/frontend/src/lib/docs/__tests__/` 아래 테스트 5개 파일뿐이다(`spec-area-index.test.ts`, `spec-link-integrity.test.ts`, `spec-links.ts`, `stray-tool-tags.test.ts`, `tree-walk.test.ts`). 내용은 NERV 미러(`spec/README.md`, `spec/CLE-*`)를 링크 · 목차 수집기에서 빼는 가드 조정이다.
  - `new-node`, `node-schema-change` 의 glob `codebase/backend/src/nodes/**` 는 변경이 없다.
  - `new-ui-string` 의 glob `codebase/frontend/src/**/*.tsx` 는 `.tsx` 변경이 없다. 사용자에게 보이는 문자열도 늘지 않았다.
  - `new-userguide-section-dir` 의 glob `codebase/frontend/src/content/docs/*/` 는 `content/docs/` 아래 변경이 없다. 섹션 디렉토리 신설도 없어 `locale.ts` 등록 대상이 아니다.
  - `userguide-gui-flow-section` 은 `02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` 변경이 없다.
  - `expression-language-change`, `auth-session-flow-change`, `new-error-code`, `new-bullmq-queue`, `backend-api-change` 의 glob 대상(`packages/expression-engine/**`, `modules/auth/**`, `nodes/core/error-codes.ts`, `system-status.constants.ts`, controller · dto)은 변경이 없다.
- `spec-major-change` 의 glob(`spec/2-*/**`, `spec/3-*/**`, `spec/4-*/**`, `spec/5-*/**`, `spec/conventions/**`)에 걸리는 변경은 없다. 바뀐 spec 파일은 NERV 미러(`spec/CLE-*`, `spec/README.md`)이고 옛 영역 트리와 `spec/conventions/` 는 동결 상태다. 삭제된 파일도 없다.
- semantic 행(`integration-provider-change`, `new-warning-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field`, `auth-config-type-enum-change`, `run-debug-flow-change`, `env-runtime-change`, `spec-defect-found`)의 의미 조건에 해당하는 변경도 없다. 이 set 은 harness(hook · 미러 도구 · 테스트 · CI 워크플로)와 링크 가드 조정이다.
- `PROJECT.md` 는 §검증 가드 목록과 §NERV 스펙 미러 설명만 바뀌었고 §변경 유형 → 갱신 위치 매핑 표는 그대로다. `.claude/config/doc-sync-matrix.json` 도 변경이 없어 JSON 과 표의 1:1 대응이 깨질 일이 없다.

### 요약

매트릭스 trigger 19행 중 매칭된 행은 0개이고 동반 갱신 누락은 0건이다. 변경은 NERV 스펙 미러 도입에 따른 harness 와 링크 · 목차 가드 조정이며, 유저 가이드 MDX · i18n dict · `backend-labels.ts` · `locale.ts` 동반 갱신 대상이 없다.

### 위험도

NONE
