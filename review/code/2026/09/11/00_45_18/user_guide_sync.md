# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — `impl-chat-channel-patch-token` (`00_45_18`)

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` `rows[]`(23행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 Read.
변경 set 은 `git diff --name-only origin/main...HEAD` 기준 코드/문서 핵심 파일 15개(backend TS 6·e2e 1·
frontend MDX 8) + plan 2개 + `review/**` 산출물(이전 라운드들의 커밋된 결과물, 매트릭스 trigger 대상 아님).

이 라운드는 직전 라운드(`review/code/2026/09/11/00_21_55/user_guide_sync.md`)가 지적한 WARNING —
"slack/discord 문서에 `inboundSigningPlaintext`(Signing Secret/Public Key) PATCH 차단 안내가
없다" — 이 그 이후 커밋(`5976587c7`)으로 실제로 닫혔는지 소스 대조로 재검증하고, 동시에 같은 diff 가
새로 여는 API 표면(`assertChatChannelAlreadySetUp`)에 대해 동일한 검증을 처음부터 수행했다.

## 발견사항

- **[WARNING]** `backend-api-change` 매트릭스 행의 target (b) "API 노출 변경이 사용자 안내에 영향 →
  관련 user-guide 페이지" — PATCH 신규 400 사유 중 **"chatChannel 최초 설정 시도"** 와
  **"provider 전환 시도"** 두 가지가 user-guide 어디에도 없다.
  - 변경 파일 (trigger): `codebase/backend/src/modules/triggers/triggers.controller.ts` (117~131행,
    `@ApiBadRequestResponse` 가 세 가지 400 사유를 명시 — "(1) 비밀 필드", "(2) chatChannel 이 없는
    트리거에 처음 붙이려는 경우: details.field="chatChannel"", "(3) provider 를 바꾸려는 경우:
    details.field="provider""), `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
    (`ChatChannelUpdateConfigDto`) — 둘 다 `doc-sync-matrix.json` `backend-api-change` 행의
    `trigger.globs`(`**/*.controller.ts`, `**/dto/**`)에 매칭. 실제 enforcement 는
    `codebase/backend/src/modules/triggers/triggers.service.ts` 의 신규 `private
    assertChatChannelAlreadySetUp()`(722~747행, 이번 diff 전체가 신규 추가 — `git diff
    origin/main...HEAD` 로 `+` 라인만으로 구성됨을 확인)이며, `update()` 520~522행에서
    `if (chatChannel) { this.assertChatChannelAlreadySetUp(trigger, chatChannel); }` 로 호출된다.
  - 매트릭스 항목: `backend-api-change` — `targets[1]`: `"API 노출 변경이 사용자 안내에 영향 → 관련
    user-guide 페이지"`.
  - **이미 고쳐진 부분 (재확인, 정상 — 직전 라운드 WARNING 닫힘)**: 직전 라운드가 지적한 slack/discord
    signing-secret/public-key PATCH 차단 안내는 커밋 `5976587c7` 로 정정됐다 —
    `codebase/frontend/src/content/docs/06-integrations-and-config/discord.mdx:109-122` (`## 6.5
    Bot Token · Public Key 변경`), `discord.en.mdx:109-122`, `slack.mdx:134-147` (`## 5.5 Bot Token
    · Signing Secret 변경`), `slack.en.mdx:134-147` 모두 `botToken`/`inboundSigningPlaintext` 양쪽의
    PATCH 차단과 `details.field` 값을 정확히(테스트 `trigger-dto-validation.spec.ts` 의 실측 —
    `chatChannel.botToken` / `chatChannel.inboundSigningPlaintext`, 비어있지 않은 값 갈래) 반영한다.
    telegram 은 server-issued 서명이라 해당 절이 없는 것이 R-CC-21 carve-out 과 일치해 정상이다.
  - **여전히 누락된 부분 (신규 지적)**: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`
    (및 `.en.mdx`) 의 "Chat Channel 연결" 절(339~465행) 어디에도 (a) *"chatChannel 은 트리거 생성
    시에만 붙일 수 있고, 나중에 PATCH 로 새로 추가할 수 없다"*, (b) *"provider 는 PATCH 로 바꿀 수
    없다 — 다른 provider 로 옮기려면 트리거를 삭제·재생성해야 한다"* 는 안내가 없다.
    `grep -n "provider.*변경\|provider.*바꾸\|삭제.*재생성\|최초 설정"` 을 `02-nodes/triggers.{mdx,en.mdx}`
    와 `06-integrations-and-config/*.{mdx,en.mdx}` 전체에 돌려 0건임을 확인했다 — "Bot Token 회전"
    절(427~437행)과 slack/discord 의 신규 6.5/5.5 절은 오직 `botToken`/`inboundSigningPlaintext` 만
    다루고 `chatChannel` 필드 자체의 최초-설정-불가·provider-불변 규칙은 다루지 않는다.
  - 상세: 이 두 가드는 이번 diff 가 **신규로 enforcement 하는** 동작이다(직전 세션의
    `review/code/2026/09/10/23_21_57/RESOLUTION.md` 항목 #2 — "`assertChatChannelAlreadySetUp` 이
    provider 전환을 안 막는다 → 수정"). 즉 이 PR **이전**에는 PATCH 로 provider 를 바꾸거나
    `chatChannel` 이 없던 트리거에 처음 붙이는 시도가 (비밀 필드가 없으면) 조용히 통과하거나 다른
    실패 형태로 이어질 수 있었는데, 이제는 명시적 400 이 난다 — 정확히 "API 노출 변경" 이다.
    product 규칙 자체는 `spec/2-navigation/2-trigger-list.md` R-12(333~339행, "변경하려면 트리거
    삭제·재생성")에 이미 있었지만 그건 내부 navigation spec 이지 사용자가 읽는
    `docs/02-nodes/triggers.mdx` 가 아니다 — R-12 사전 존재가 user-guide 갱신 의무를 면제하지 않는다.
  - 참고(심각도 조정 근거, CRITICAL 아닌 WARNING인 이유): `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx`
    281~282행 주석 — "edit 모드: uiMapping / rateLimitPerMinute / languageHints 만 편집
    (provider/botToken 은 별 경로)" 및 347행에서 `provider` 를 PATCH 바디에 **아예 싣지 않음**을
    확인했다. 즉 일반 UI 사용자는 이 두 400 을 절대 마주치지 않고, 영향은 API 를 직접 호출하는
    통합 담당자로 한정된다 — 직전 라운드가 slack/discord 시크릿 갭에 적용한 것과 동일한 등급
    판단 기준(UI 도달 불가 → WARNING, UI 깨짐이면 CRITICAL)이다.
  - 제안: `02-nodes/triggers.mdx`/`.en.mdx` 의 "Chat Channel 연결" 절이나 "### Bot Token 회전
    (single-path)" 절 인근에, "`chatChannel` 은 생성 시에만 설정 가능 — PATCH 로 새로 붙이거나
    provider 를 바꾸면 400 `VALIDATION_ERROR` (`details.field='chatChannel'` 또는 `'provider'`).
    provider 를 바꾸려면 트리거를 삭제 후 다시 만들어야 한다" 는 문장을 추가한다. 이번에 조치하지
    못하더라도 최소 `plan/in-progress/spec-draft-nullable-notation-followups.md` 같은 중앙 트래커에
    명시 등재해, 직전 라운드에서 발생했던 "슬랙/디스코드 항목이 등재 없이 조용히 빠졌던" 패턴이
    반복되지 않게 할 것.

## 확인한 것 — 매트릭스 위반 아님

- `codebase/backend/src/nodes/**` 변경 없음 → `new-node`/`node-schema-change` 행 미해당.
- `codebase/frontend/src/**/*.tsx` 변경 없음(이번 diff 는 MDX/backend TS 뿐) → `new-ui-string`
  (i18n dict parity) 행 미해당.
- `codebase/backend/src/modules/auth/**` 변경 없음 → `auth-session-flow-change` 행 미해당.
- `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음, 신규 `ErrorCode`/`warningRules` 값
  발행 없음(이번 diff 의 400 은 전부 기존 `VALIDATION_ERROR` 코드 재사용, `details.field` 만 다름)
  → `new-warning-code`/`new-error-code` 행 미해당, `backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO`
  매핑 갱신 불필요.
- `codebase/packages/expression-engine/**` 변경 없음 → `expression-language-change` 행 미해당.
- `codebase/frontend/src/content/docs/*/`(신규 섹션 디렉토리) 신설 없음(`02-nodes/`,
  `06-integrations-and-config/` 모두 기존 디렉토리) → `new-userguide-section-dir` 행 미해당,
  `locale.ts` 갱신 불필요.
- provider 신규 추가 없음 — telegram/slack/discord 세 provider 모두 기존, `integration-provider-change`
  행의 문서 갱신은 이미 이번 diff(파일 10~15)로 충족.
- `userguide-gui-flow-section` 행(`02-nodes/**.mdx`, `06-integrations-and-config/**.mdx`) —
  신규 절(discord `## 6.5`, slack `## 5.5`)의 heading·본문 bold 어디에도 bareword `GUI` 가 없어
  `findGuiFlowSections()` 두 신호(heading `GUI`/bold `**…GUI…**`) 모두 불충족 → `<ImplAnchor
  kind="ui-entry">` 신설 의무 미발생(이 판단은 직전 라운드와 동일).
- controller/DTO 의 swagger jsdoc 자체(target (a))는 이번 diff 안에서 이미 갱신됐다
  (`triggers.controller.ts:122-130`, `chat-channel-config.dto.ts:376-382,390-396`).
- `plan/in-progress/impl-chat-channel-patch-token.md` · `spec-draft-nullable-notation-followups.md`
  는 spec 정정 항목(§5.4.1 flat→nested, `store()`→`rotate()`)을 planner 후속으로 올바르게 등재—
  단 위 WARNING 대상(첫 설정/provider 전환 문서화)은 이 두 트래커 어디에도 없음을 grep 으로 확인(0건).
- `review/**` 다수 파일(이전 라운드 산출물)은 프로세스 산출물이며 매트릭스 trigger 대상이 아니다.

## 요약

매트릭스 23행 중 `backend-api-change` 1건이 매칭됐다. 직전 라운드(`00_21_55`)가 지적한 slack/discord
signing-secret/public-key PATCH 차단 안내 누락은 이번 diff(커밋 `5976587c7`)로 **완전히 닫혔다**
(ko/en 4파일, 정확한 필드명·`details.field` 값 반영, 소스로 재확인). 다만 같은 매트릭스 target 아래
**같은 diff 가 새로 여는 두 가지 400 사유**— chatChannel 최초 설정은 생성 전용, provider 는 PATCH 로
불변 — 는 `02-nodes/triggers.mdx`/`.en.mdx` 어디에도 아직 반영되지 않아 WARNING 1건을 유지한다.
UI 편집 폼이 애초에 `provider`/신규-attach 를 PATCH 바디에 싣지 않아 영향은 API 직접 통합 담당자로
한정되므로 CRITICAL 은 아니다. 그 외 매칭 22건은 신규 노드·UI 문자열·표현식 언어·인증 흐름·신규 섹션
디렉토리·warning/error code 등과 무관해 미매칭이며, i18n parity(양쪽 로케일 동시 갱신) 는 이번 diff
전체에서 지켜졌다.

## 위험도

WARNING
