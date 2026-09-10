# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — `impl-chat-channel-patch-token`

## 적재한 SSOT

- `.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) Read 완료
- `PROJECT.md` §변경 유형 → 갱신 위치 매핑 + §자주 누락되는 항목 Read 완료
- 변경 file 목록은 orchestrator prompt(51개 파일, 그중 review/plan 산출물 제외 순수 코드/문서 변경 16개) + `git diff origin/main...HEAD --stat -- 'codebase/**' 'CHANGELOG.md'` 로 교차 확인 — 두 목록 일치 (fork point `c0f2a885c`)

## 매칭된 trigger

이번 변경 set(`ChatChannelUpdateConfigDto` 신설 + `TriggersController`/`TriggersService` 의 chatChannel PATCH 검증·게이팅)은 매트릭스 21행 중 다음 2행에 매칭된다:

1. **`backend-api-change`** (semantic, `codebase/backend/src/**/*.controller.ts` + `dto/**`) — target (a) controller·DTO swagger jsdoc, (b) API 노출 변경의 user-guide 페이지 반영
2. **`integration-provider-change`** (semantic) — target `06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키

나머지 19행(`new-node`, `node-schema-change`, `new-ui-string`, `new-userguide-section-dir`, `auth-session-flow-change`, `new-warning-code`, `new-error-code`, `expression-language-change` 등)은 이번 diff 의 파일 경로·의미와 매칭되지 않는다 — `codebase/backend/src/nodes/**`·`codebase/backend/src/modules/auth/**`·`codebase/packages/expression-engine/**`·신규 `docs/<NN>-<name>/` 디렉토리·`.tsx` 파일 어느 것도 변경 set 에 없다.

## 동반 갱신 검증 — 두 trigger 모두 같은 changeset 안에서 충족됨

### `backend-api-change`
- **(a) swagger jsdoc**: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` 에 `ChatChannelUpdateConfigDto`(`OmitType` 파생) 신설 + `@ApiPropertyOptional` 갱신, `codebase/backend/src/modules/triggers/triggers.controller.ts` 의 `update()` `@ApiBadRequestResponse` description 이 3가지 400 사유(비밀 필드 포함/최초 `chatChannel` 부착/`provider` 변경)를 신설 서술 — 같은 커밋(`464f2ba1a`)에서 완료.
  - `@ApiBadRequestResponse` description 안의 "Spec Chat Channel §5.4.1·§5.4.1.1" 표기가 공개 OpenAPI 로 노출되는 게 아닌가 의심해 `spec/conventions/swagger.md` §3(JSDoc↔`//` 분리 규약)을 대조했다 — 이 규약은 `introspectComments` 플러그인이 **JSDoc**(`/** */`)을 암묵적으로 공개 description 에 싣는 것을 막는 규칙이지, `@ApiXxxResponse({ description })` 명시 문자열엔 적용되지 않는다. `executions.controller.ts`(`spec/5-system/13-replay-rerun.md §8.1` 인용) 등 21개 기존 controller 가 동일 패턴으로 spec 경로를 명시 description 에 인용하고 있어 **이 저장소의 기존 관례**임을 확인했다 — 신규 위반 아님.
- **(b) user-guide 반영**: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` + `.en.mdx` 의 "Bot Token 회전 (single-path)" 절이 옛 `botTokenRef` 서술을 걷어내고 (1) `chatChannel` 은 생성 시에만 설정 가능·`provider` 변경 불가 (2) 실제 필드명 `botToken` 기준 400 사유로 갱신됐다. ko/en 두 파일 모두 같은 커밋(`464f2ba1a`)에서 동시 갱신 — parity 위반 없음.

### `integration-provider-change`
- `discord.{mdx,en.mdx}` / `slack.{mdx,en.mdx}` 에 각각 신규 "6.5 (Discord)/5.5 (Slack) Changing the bot token or public key/signing secret" 절이 ko/en 쌍으로 동시 추가됐다 (`5976587c7`) — 표시 옵션·rate limit 저장은 비밀에 영향 없다는 `<Callout type="info">` 까지 포함.
- `telegram.{mdx,en.mdx}` 는 신규 절 대신 기존 "6. Bot Token 회전 (single-path)" 문구만 갱신됐다 — **이는 갭이 아니라 의도된 비대칭**: telegram 은 `inboundSigningPlaintext` 에 대응하는 사용자 입력 필드가 없다(§CHANGELOG 표 — telegram 의 inbound signing 은 "adapter 가 provider 와 합의해 발급"하는 server-issued 값이라 PATCH 게이팅 대상이 아니다). 따라서 discord/slack 이 받는 "public key/signing secret 은 아직 못 바꾼다" 절이 telegram 에 대응할 내용 자체가 없다.
- `grep -rn botTokenRef codebase/frontend/src/content/docs/` 로 잔존 stale 서술을 전수 확인 — 남은 4곳 전부 "내부 식별자, 입력 필드 아님"으로 정정된 문장이었고 옛 400 형식(`details.field='botTokenRef'`) 잔존 없음.
- 이번 diff 에 신규 TSX/UI 문자열이 없어 `dict/{ko,en}/<section>.ts` 갱신 대상 자체가 없다 (제안하는 "dict 키" target 은 통합 페이지에 새 UI 라벨이 생길 때만 해당 — `ChatChannelCard.tsx` 는 이번 diff 에 없음, CHANGELOG 도 "그 카드는 세 필드 어느 것도 보내지 않아 영향 없다"고 명시).

## 그 외 확인 — 갭 아님으로 판정한 항목

- `codebase/backend/src/nodes/**` 미변경 → `new-node`/`node-schema-change` 미매칭. `02-nodes/triggers.mdx` 는 매트릭스 glob 대상은 아니지만 실질적으로 이미 동반 갱신됨(위 참조) — 이중으로 안전.
- `codebase/backend/src/modules/auth/**` 미변경 → `auth-session-flow-change` 미매칭, `07-workspace-and-team/` 무관.
- `error-codes.ts`/`warningRules` 미변경 → `new-error-code`/`new-warning-code` 미매칭. DTO 의 `@IsEmpty()` 메시지("botToken 은 PATCH 로 바꿀 수 없어요...")는 class-validator 의 HTTP 400 응답 메시지이지 노드 실행 `ErrorCode` enum 이 아니라 `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO` 스코프 밖이다.
- 신규 `docs/<NN>-<name>/` 디렉토리 없음 → `SECTION_LABELS_BY_LOCALE` 무관.
- `<ImplAnchor kind="ui-entry">` 배선: 신규 추가된 discord/slack "6.5/5.5" 절과 triggers.mdx 갱신 절은 모두 curl API 참조이지 "좌측 메뉴 클릭" 류 GUI 흐름 절이 아니라 `userguide-gui-flow-section` trigger 대상이 아니다(기존 "Bot Token 회전" 절도 동일 성격으로 ImplAnchor 미보유 — 일관).

## 그레이존 (INFO, 확정 아님)

- **[INFO]** discord/slack 신규 절이 `details.field='chatChannel.botToken'`(중첩 경로) 형식만 언급하고, 서비스가 `null`/`''` 값에 한해 반환하는 flat `details.field='botToken'` 갈래는 언급하지 않는다.
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/discord.en.mdx` "## 6.5 Changing the bot token or public key" 절, `slack.en.mdx` "## 5.5" 절 (동일 문구 ko 판도 동일)
  - 매트릭스 항목: `integration-provider-change` — target 은 "provider 문서 갱신" 자체이지 필드 형식의 완전성까지 규정하지 않음. 이 갭은 "동반 갱신 누락"이 아니라 이미 갱신된 문서의 **정확도/완전성** 문제라 본 리뷰어 스코프(누락 검출)보다는 `documentation`/`api_contract` 리뷰어 영역에 더 가깝다. 실제로 그 nuance(flat vs nested)는 이미 `triggers.controller.ts` swagger description·`trigger-dto-validation.spec.ts`·RESOLUTION.md(2라운드 #3)에 정확히 기록돼 있어, 사용자 문서 쪽만 단순화된 상태다.
  - 상세: 일반적 API 소비자가 `null`/`''` 를 명시적으로 보내는 경우는 드물어 사용자 영향은 낮다고 판단하나, 완전성 관점에서 언급 여지는 있음.
  - 제안: (선택) 다음 이 절을 손댈 때 한 문장("빈 문자열/`null` 을 보내면 `details.field` 가 `botToken` 로 나옵니다" 류)을 추가 고려. 즉시 차단 사유는 아님.

## 요약

매트릭스 21행 중 이번 diff(`chatChannel` PATCH 비밀 게이팅, fork `c0f2a885c`→HEAD 누적)와 매칭되는 trigger 는 `backend-api-change`·`integration-provider-change` 2건이며, 두 trigger 의 target(swagger jsdoc, `02-nodes/triggers.{mdx,en.mdx}`, `06-integrations-and-config/{discord,slack}.{mdx,en.mdx}`) 모두 같은 changeset 안에서 ko/en parity 를 지키며 이미 갱신돼 있었다(멀티라운드 리뷰가 사전에 문서 오류 2건을 잡아 커밋 `83d5f3f94`/`5976587c7`/`464f2ba1a` 로 수정한 결과). telegram 문서가 discord/slack 과 다른 절 구조를 갖는 것은 서버 발급 signing 값이라는 실제 스키마 비대칭을 반영한 의도된 차이지 누락이 아니다. 확정적 CRITICAL/WARNING 누락은 발견하지 못했다.

## 위험도

NONE
