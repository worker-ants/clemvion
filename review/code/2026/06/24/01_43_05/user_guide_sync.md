# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

해당 없음.

매트릭스 18개 trigger 전수 검토 결과, 이번 변경 set 에 매칭되는 동반 갱신 누락이 없습니다.

### 상세 매칭 결과

**`backend-api-change` (약한 매칭)** — `codebase/backend/src/modules/triggers/triggers.controller.ts` 가 `*.controller.ts` glob 에 매칭됩니다. 그러나 이 변경은 `rotateBotToken` 핸들러를 `ChatChannelController` 에서 `TriggersController` 로 **verbatim 이전**한 것이며, 사용자 노출 route `POST /api/triggers/:id/chat-channel/rotate-bot-token` 은 경로·메서드·응답 스키마 전부 무변입니다. `@ApiOperation` swagger jsdoc 도 신규 위치에 동반 이전됐습니다. 매트릭스 target "(b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" 는 **새 사용자 가시 노출**이 있을 때 적용되므로 본 내부 구조 리팩터에서는 갱신 의무 없음.

**매칭 안 된 trigger 목록:**
- `new-node` / `node-schema-change` — `codebase/backend/src/nodes/**` 변경 없음
- `new-ui-string` — TSX 파일 변경 없음
- `integration-provider-change` — 신규/변경 provider 없음 (Telegram/Slack/Discord 어댑터 인터페이스 무변)
- `new-userguide-section-dir` — `docs/<NN>-<name>/` 신규 디렉토리 없음
- `auth-session-flow-change` — `auth/**` 변경 없음
- `expression-language-change` — `packages/expression-engine/**` 변경 없음
- `run-debug-flow-change` — 실행 엔진·디버그 로깅 변경 없음
- `new-warning-code` / `new-error-code` — `warningRules`·`error-codes.ts` 변경 없음
- `new-backend-ui-zod-value` — `ui.label`/`hint`/`group`/`itemLabel` 신규 값 없음
- `new-handler-output-field` — handler output field 변경 없음
- `spec-major-change` — `spec/5-system/15-chat-channel.md`, `spec/conventions/user-guide-evidence.md`, `spec/data-flow/0-overview.md`, `spec/data-flow/14-chat-channel.md` 가 `spec/5-*/**` + `spec/conventions/**` glob 에 매칭되나, 모두 "코드 이동 기계적 sync, 결정 무변" — ImplAnchor 경로 갱신만이며 frontmatter `code:`/`status:`/`pending_plans:` 정합 갱신이 이미 동반됨(commit message 명시). 사용자 가이드 MDX 추가 갱신 불필요.

## 요약

매트릭스 18개 trigger 전수 검토. 1개(`backend-api-change`)가 약하게 매칭됐으나 route·동작 무변의 내부 모듈 이전(verbatim move)이므로 사용자 가이드·i18n dict·backend-labels 동반 갱신 의무 없음. 누락 0건.

## 위험도

NONE
