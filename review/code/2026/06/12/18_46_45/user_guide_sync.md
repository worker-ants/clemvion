# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

해당 없음. 매트릭스 전체 trigger 를 순회했으나 동반 갱신 누락이 없다.

### 분석 근거

변경 set 에 포함된 유저 가이드 관련 파일:

- `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` (KO)
- `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` (EN)
- `codebase/frontend/src/lib/i18n/backend-labels.ts`
- `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts`

**매트릭스 trigger 매칭 결과:**

1. **`new-error-code` (id: new-error-code, glob: `codebase/backend/src/nodes/core/error-codes.ts`)** — 해당 파일은 본 change set 에 없다. 단, 선행 commit 에서 이미 추가된 `BOT_TOKEN_INVALID` / `CHAT_CHANNEL_SETUP_FAILED` 외 6종 에러 코드에 대한 `backend-labels.ts` `ERROR_KO` 등록 (target) 이 본 change set 에 완전히 포함되어 있다. 누락 없음.

2. **`new-warning-code` (semantic)** — backend warningRules 변경 없음. 해당 없음.

3. **`node-schema-change` / `new-node` (glob: `codebase/backend/src/nodes/**`)** — 해당 glob 에 매칭되는 파일 변경 없음. 해당 없음.

4. **`new-ui-string` (semantic, tsx 신규 한국어 리터럴)** — TSX 파일 변경 없음. 해당 없음.

5. **`userguide-gui-flow-section` (glob: `codebase/frontend/src/content/docs/02-nodes/**.mdx`)** — `triggers.mdx` / `triggers.en.mdx` 가 매칭된다. 그러나 본 변경은 기존 Callout 텍스트의 에러 코드 목록 보완·문구 정정이며 신규 GUI 흐름 절 추가가 아니다. target인 `<ImplAnchor kind="ui-entry">` 동반 작성 의무는 신규/변경 GUI 흐름 절에만 적용되므로 해당 없음.

6. **KO/EN parity** — `triggers.mdx`(KO) 와 `triggers.en.mdx`(EN) 가 동일 change set 에서 같은 에러 코드 목록으로 동시 갱신되어 i18n parity 유지됨. 이전 리뷰(review/code/2026/06/12/18_01_52/SUMMARY.md Warning#3) 에서 지적된 EN 동반 갱신 누락이 본 change set 에서 해소됨.

7. **`backend-labels.ts` `ERROR_KO` 신규 항목** — `INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`, `WORKSPACE_ID_REQUIRED` 8종 모두 ko 매핑 등록 완료. 영문 SoT 각 throw-site 명시. 사용자에게 영문 그대로 노출되는 코드 없음.

8. 나머지 trigger (`integration-provider-change`, `new-userguide-section-dir`, `auth-session-flow-change`, `expression-language-change`, `run-debug-flow-change`, `new-backend-ui-zod-value`, `new-cross-cutting-enum`, `new-handler-output-field`, `env-runtime-change`, `spec-major-change`) — 해당 파일 패턴 변경 없거나 의미 매칭 없음.

## 요약

매트릭스 전체 17개 trigger 를 점검했으며, 이번 change set 에서 의미 있는 매칭은 `new-error-code`(semantic) 1개와 `userguide-gui-flow-section`(mdx glob) 1개다. `new-error-code` trigger 의 target(`backend-labels.ts ERROR_KO` 매핑)은 8종 모두 등록 완료, KO·EN MDX docs parity 도 `triggers.mdx` + `triggers.en.mdx` 동시 갱신으로 충족됐다. 매칭 trigger 2개, 누락 0개.

## 위험도

NONE

STATUS=success ISSUES=0
