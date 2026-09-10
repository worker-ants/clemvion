# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — `impl-chat-channel-patch-token` (3라운드, `00_21_55`)

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` `rows[]`(23행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을
Read. 변경 set 은 `git diff --stat origin/main...HEAD` 기준 67개 파일(브랜치 전체 누적 diff —
`cf4ba26e9`~`83d5f3f94`) 이며, 코드/문서 핵심 파일은 11개(backend TS 6·e2e 1·frontend MDX 4), 나머지는
plan 2개 + 이전 라운드 review/consistency 산출물(이미 커밋됨) 54개다.

이 라운드는 이전 두 라운드(`23_21_57`, `23_55_23`)의 `user_guide_sync` 산출물을 직접 읽어, **그때
지적된 WARNING 이 이번 diff 로 실제로 얼마나 닫혔는지**를 소스 대조로 재검증하는 데 집중했다.

## 발견사항

- **[WARNING]** `backend-api-change` 매트릭스 행의 target (b) "API 노출 변경이 사용자 안내에 영향 →
  관련 user-guide 페이지" 가 **부분 미충족** — telegram·triggers 문서는 이번 diff 로 정정됐지만,
  같은 gap 의 연장인 slack/discord 문서(ko/en 4파일)는 여전히 손대지 않았다.
  - 변경 파일 (trigger): `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
    (`ChatChannelUpdateConfigDto` 가 `inboundSigningPlaintext` 를 `OmitType`+`@IsEmpty()` 로 PATCH
    전면 차단, 신규 라인 372-404) — `doc-sync-matrix.json` `backend-api-change` 행의
    `trigger.globs`(`**/dto/**`, `**/*.controller.ts`)에 매칭.
  - 매트릭스 항목: `backend-api-change` — `targets[1]`: `"API 노출 변경이 사용자 안내에 영향 → 관련
    user-guide 페이지"`.
  - **이미 고쳐진 부분 (재확인, 정상)**: 이전 라운드 WARNING 이 지적한 4파일이 이번 diff 에 포함돼
    있고 실제로 정정됐다 —
    - `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:429` — `botTokenRef`(오기) →
      `config.chatChannel.botToken` + `details.field='chatChannel.botToken'`(실측값)로 정정.
    - `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx:418` — 동일 정정.
    - `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx:119` — 동일 정정
      + "내부 식별자 `botTokenRef` 도 마찬가지로 받지 않는다" 캐비아트 추가.
    - `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.en.mdx:106` — 동일.
  - **여전히 누락된 부분 (신규 지적)**: `codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx`
    · `slack.en.mdx` · `discord.mdx` · `discord.en.mdx` (4파일, 이번 diff 에 **포함되지 않음**) —
    telegram 문서에는 이제 "Bot Token 회전(single-path)" 절이 있는데, slack/discord 문서에는 대응하는
    "Signing Secret / Public Key 는 PATCH 로 바꿀 수 없다" 절이 **여전히 없다**. 두 문서 모두
    `Bot Token 만료 → 재발급` 트러블슈팅 행만 있고(`slack.mdx:187`, `discord.mdx:186`,
    각 `.en.mdx` 대응 행), `inboundSigningPlaintext`(Signing Secret/Public Key)의 PATCH 동작에 대한
    언급이 전무함을 `grep -n "회전\|rotat\|inboundSigning\|Signing Secret\|Public Key\|PATCH"` 로
    직접 확인했다.
  - 상세: 이번 diff 의 `ChatChannelUpdateConfigDto`(D-1/D-2)는 `botToken` 뿐 아니라
    `inboundSigningPlaintext` 도 PATCH 에서 전면 차단한다 — 그리고 이 필드는 telegram 이 아니라
    **slack/discord 전용**이다(telegram 의 inbound signing 은 server-issued 라 무관, `plan` D-2 표
    "쓰기 ②: slack/discord provider-issued signing"). 신규 테스트가 이를 명시적으로 고정한다 —
    `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:805`
    `it('inboundSigningPlaintext 가 실리면 거부한다 — slack 도 예외가 아니다', …)`. 즉 이 PR **이전**엔
    PATCH 가 `ChatChannelConfigDto`(생성용과 동일 DTO)를 그대로 썼으므로 slack/discord 트리거를
    수정할 때 `inboundSigningPlaintext` 를 실으면 그대로 `secrets.rotate()` 로 덮어썼다(botToken 과
    동일한 R-CC-10 류 우회 클래스). 이 PR 이 **정확히 그 동작을 처음으로 막고** 그 사실을 코드에
    정본으로 남긴 자리인데, telegram/triggers 문서만 그 사실을 반영했고 slack/discord 문서는 반영이
    빠졌다. 직전 라운드(`review/code/2026/09/10/23_55_23/user_guide_sync.md` 50-60행)가 이미
    "부수 발견(같은 gap 의 연장)" 으로 slack.mdx/discord.mdx 신설 절을 명시적으로 요구했고,
    `SUMMARY.md`(15행)에도 같은 항목이 등재됐지만, 그 라운드의 `RESOLUTION.md`(항목 #2)는
    "수정 — ko/en 4파일" 로만 기록해 telegram·triggers 4파일만 고치고 slack/discord 부분은 **조치도,
    명시적 후속 등재도 없이 조용히 빠졌다** — `plan/in-progress/impl-chat-channel-patch-token.md` ·
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 어디에도 slack.mdx/discord.mdx 관련
    후속 항목이 없음을 grep 으로 확인했다(0건).
  - 참고(심각도 완화 요인, 하향 조정 근거): `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx`
    에 `inboundSigning`/`Signing Secret`/`Public Key` 문자열이 0건 — UI 편집 폼 자체가 이 필드를 애초에
    PATCH 바디에 싣지 않으므로(plan "착수 전 실측" #5) **일반 UI 사용자는 이 400 을 마주치지 않는다.**
    영향 범위는 telegram 케이스와 동일하게 **API 를 직접 호출하는 통합 담당자**로 한정된다 — 그래서
    CRITICAL(UI 깨짐)이 아니라 WARNING(문서 stale) 등급이 맞다.
  - 제안: `slack.mdx`/`discord.mdx`(+ 각 `.en.mdx`) 에 telegram 의 "## 6. Rotating the bot token
    (single-path)" 절과 대응하는 절을 신설한다 — 위치는 두 파일 모두 "트러블슈팅" 절 직전이 자연스럽다
    (`slack.mdx`: 현재 `## 7. 트러블슈팅`(180행) 앞, `discord.mdx`: 현재 `## 8. 트러블슈팅`(180행) 앞;
    이후 절 번호는 +1 씩 밀려야 함). 내용: "Signing Secret/Public Key 변경은 PATCH 로 불가 —
    실으면 400 `VALIDATION_ERROR`(`details.field='chatChannel.inboundSigningPlaintext'`), 회전이
    필요하면 트리거를 삭제 후 재생성" (v1 미정의, R-CC-21). 동시에 이번엔 조치 못 하더라도 최소
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 같은 중앙 트래커에 **명시적으로
    등재**해 "이미 다뤘다"는 착시가 재발하지 않게 할 것.

- **[INFO]** `triggers.mdx` 신규 문장에 사소한 오타(중복 공백) — 매트릭스 위반은 아니고 카피에딧 수준
  - 변경 파일: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:429`
  - 상세: `"토큰 변경은 **항상  rotate API 만** 사용해요."` — `항상` 과 `rotate` 사이에 공백이 2개다
    (원본 `triggers.mdx:426`대 `telegram.mdx:118` 문구는 공백 1개). diff 원문(`unified diff` 게이트
    429행)에서 직접 확인. 동일 문구를 쓰는 `triggers.en.mdx`/`telegram.mdx`/`telegram.en.mdx` 세 곳은
    이 중복 공백이 없다 — 이 파일 1건만의 타이핑 실수로 보인다.
  - 제안: 공백 하나 제거. 매트릭스 동반 갱신 항목은 아니라 이 PR 을 막을 사유는 아님.

## 확인한 것 — 매트릭스 위반 아님

- `codebase/backend/src/nodes/**` 변경 없음 → `new-node`/`node-schema-change` 행 미해당.
- `codebase/frontend/src/**/*.tsx` 변경 없음(`chat-channel-card.tsx` 등 UI 컴포넌트는 이번 diff에
  포함되지 않음) → `new-ui-string`(i18n dict parity) 행 미해당.
- `codebase/backend/src/modules/auth/**` 변경 없음 → `auth-session-flow-change` 행 미해당(트리거
  모듈 변경이지 인증/세션 모듈 변경이 아니다).
- `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음, 신규 `ErrorCode`/`warningRules` 값
  발행 없음(이번 diff 의 400 은 기존 `VALIDATION_ERROR` 코드 재사용) → `new-warning-code`/
  `new-error-code` 행 미해당, `backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO` 매핑 대상 아님.
- `codebase/packages/expression-engine/**` 변경 없음 → `expression-language-change` 행 미해당.
- `codebase/frontend/src/content/docs/*/`(신규 섹션 디렉토리) 신설 없음 → `new-userguide-section-dir`
  행 미해당, `locale.ts` 갱신 불필요.
- controller/DTO 의 swagger jsdoc 자체(target (a))는 이번 diff 안에서 이미 갱신됐다
  (`chat-channel-config.dto.ts:376-382,390-396`, `triggers.controller.ts:122-130`) — 별도 지적 불필요.
- `userguide-gui-flow-section` 행(`02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` 변경) —
  이번 diff 는 **기존 섹션의 문구 정정**이지 신규 GUI 흐름 절 추가가 아니라 `<ImplAnchor kind="ui-entry">`
  신설 의무는 발생하지 않는다(단, 위 WARNING 제안대로 slack/discord 에 신규 절을 만들 경우 그 절에도
  기존 telegram 절과 동일하게 `<ImplAnchor>` 를 붙여야 한다는 점은 후속 작업 시 유의).
- `plan/in-progress/impl-chat-channel-patch-token.md` 는 spec 정정 항목(§5.4.1 flat→nested,
  `store()`→`rotate()`)을 planner 후속으로 올바르게 등재했다 — 그 부분은 절차 위반이 아니다(단,
  slack/discord MDX 갭은 이 표에 없다 — 위 WARNING 참고).
- `review/**`·`review/consistency/**` 다수 파일은 프로세스 산출물이며 매트릭스 trigger 대상이 아니다.

## 요약

매트릭스 23행 중 `backend-api-change` 1건이 이번 diff 에 매칭됐다. target (a)(swagger jsdoc)는
diff 안에서 충족, target (b)(user-guide 페이지)는 **직전 라운드가 지적한 4파일(telegram·triggers,
ko/en) 중 4파일 모두 정정됐지만, 같은 라운드가 "부수 발견"으로 명시했던 slack/discord 대응 문서
4파일(ko/en)은 여전히 미착수**다 — PATCH 가 이제 `inboundSigningPlaintext`(slack Signing
Secret / discord Public Key)를 전면 거부하는 신규 동작을 slack.mdx/discord.mdx 어디도 안내하지
않는다. 영향은 UI 사용자가 아니라 API 직접 통합 담당자로 한정돼 CRITICAL 은 아니지만, 이미 두 라운드
전에 지적됐고 트래커에도 등재되지 않은 채 조용히 빠졌다는 점에서 WARNING 으로 유지한다. 그 외
12건(신규 노드·UI 문자열·표현식 언어·인증 흐름·신규 섹션 디렉토리 등)은 이번 변경 set 과 무관해
미매칭이다.

## 위험도

WARNING
