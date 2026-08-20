STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 24개) + `PROJECT.md` 본문을 SoT 로 사용.

## 변경 changeset 개요
이 changeset 은 `Execution.inputData` egress 마스킹 카브아웃을 폐지하는 보안 변경(#1181 이전 라운드
`14_08_45` 의 CRITICAL 2 + WARNING 7 을 처분한 fix 커밋 `b0d841923` 포함)이다. backend 3개 표면
(`executions.service.ts`, `background-runs.service.ts`, 두 DTO)과 frontend 3개 소비처(폼 프리필
`dynamic-form-ui.tsx`, Re-run 모달 `rerun-modal.tsx`, 에디터 히스토리 로드
`editor-toolbar.tsx`)에 마커 가드가 걸렸고, 공용 유틸 `lib/utils/masked-markers.ts` 로 판별 로직이
승격됐다. spec 7개 문서(`1-data-model.md`, `3-execution.md`, `12-background.md`, `12-webhook.md`,
`13-replay-rerun.md`, `14-external-interaction-api.md`, `6-websocket-protocol.md`)도 같은 changeset
안에서 함께 갱신됐다.

## 매칭된 trigger 및 검증 결과

### 1. `new-ui-string` (신규 UI 문자열, TSX) — 충족
- 신규 키 `editor.runWithInputMasked` — `codebase/frontend/src/lib/i18n/dict/ko/editor.ts:62-63` +
  `codebase/frontend/src/lib/i18n/dict/en/editor.ts:64-65` 양쪽 동일 changeset 등록.
- 신규 키 `history.rerun.maskedInputBlocked` — `dict/ko/history.ts:12-13` +
  `dict/en/history.ts:14-15` 양쪽 등록.
- 실사용처 확인(`grep`): `editor-toolbar.tsx:118` → `t("editor.runWithInputMasked")`,
  `rerun-modal.tsx:506` → `t("history.rerun.maskedInputBlocked")` — 두 키 경로 모두 dict 구조와
  정확히 일치(오타 없음). CRITICAL 없음.

### 2. `backend-api-change` (DTO 변경) — 충족
- `background-run-response.dto.ts:51`, `execution-response.dto.ts:49-62,174-183` 의 swagger
  `@ApiPropertyOptional` description / JSDoc 이 같은 changeset 에서 새 정책("응답·emit 시 마스킹")으로
  갱신됨.
- "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" 요건도 아래 3번 항목으로 충족.

### 3. `run-debug-flow-change` (semantic — 실행·디버깅 흐름 변경) — 충족 (이전 라운드 WARNING 해소 확인)
- 타깃: `codebase/frontend/src/content/docs/05-run-and-debug/`.
- 직전 리뷰 라운드(`review/code/2026/08/20/14_08_45/user_guide_sync.md`)가 정확히 이 gap 을
  WARNING/MEDIUM 으로 지적했고(`running-a-workflow.mdx`/`.en.mdx`, `run-results.mdx`/`.en.mdx` 4파일
  미반영), 같은 라운드 RESOLUTION.md WARNING #6 으로 "유저 가이드 4파일 반영" 처분됨.
- 이번 changeset 에서 실제로 4파일 전부 갱신 확인:
  - `running-a-workflow.mdx:32` / `.en.mdx:21` — `Load from History` 스텝에 마스킹 마커 잔존 시 Run
    비활성 설명 추가.
  - `run-results.mdx:134` / `.en.mdx:124` — Re-run 스텝에 자격증명 프리필 스킵 + "원본 입력 그대로
    사용" 토글 안내 추가.
- spec SoT 미러(`spec/3-workflow-editor/3-execution.md:91`, `spec/5-system/13-replay-rerun.md`
  §10.2)와 서술 방향이 일치 — spec→user-guide 전파 완결.

### 4. `spec-major-change` (spec 대규모 변경) — 정황상 문제 없음
- `spec/1-data-model.md`, `3-execution.md`, `12-background.md`, `12-webhook.md`,
  `13-replay-rerun.md`, `14-external-interaction-api.md`, `6-websocket-protocol.md` 전부 기존
  구현 섹션의 prose 정정(카브아웃 폐지 반영)이며 `status:`/`code:` 전환을 요하는 신규 섹션이 아님.
  `13-replay-rerun.md` frontmatter `code:` 목록에 `rerun-modal.tsx` 를 같은 diff 에서 추가 —
  code: 글로브 정합 유지.

## 매칭되지 않은 trigger (해당 없음 확인)
- `new-node` / `node-schema-change`: `codebase/backend/src/nodes/**` 신규·필드 변경 없음.
- `integration-provider-change`: 신규/변경 provider 없음.
- `new-userguide-section-dir`: `content/docs/<NN>-<name>/` 신규 디렉토리 없음 — `locale.ts` 갱신 불요.
- `new-warning-code` / `new-error-code`: `warningRules`/`error-codes.ts` 변경 없음 — `backend-labels.ts`
  `WARNING_KO`/`ERROR_KO` 매핑 갱신 대상 없음.
- `auth-session-flow-change`: `codebase/backend/src/modules/auth/**` 무변경.
- `expression-language-change`: `codebase/packages/expression-engine/**` 무변경.
- `new-bullmq-queue`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`,
  `new-handler-output-field`, `auth-config-type-enum-change`, `env-runtime-change`,
  `userguide-gui-flow-section`: 전부 무관.

## 요약
매트릭스 24개 행 중 `new-ui-string`·`backend-api-change`·`run-debug-flow-change`(semantic) 3개 행이
이번 changeset 에 매칭됐고, 셋 다 동일 changeset 안에서 충족 확인됨(누락 0). 특히
`run-debug-flow-change` 는 직전 리뷰 라운드(`14_08_45`)가 지적한 WARNING(05-run-and-debug/ 4파일
미반영)이었으나, 그 라운드의 RESOLUTION 처분으로 이번 changeset 에 정확히 반영돼 있음을 실제 파일
diff 로 재확인했다. i18n parity(ko/en 양쪽 신규 키 2건)·swagger jsdoc·spec 미러 모두 정상. 발견된
누락 없음.

## 위험도
NONE
