# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — `impl-chat-channel-patch-token`

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` `rows[]` (23행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑
본문(147행 표 + §자주 누락)을 함께 Read. 변경 set 은 orchestrator 가 제공한 15개 코드/plan/review
파일(backend TS 6개 · e2e 1개 · plan md 1개 · review 산출물 다수)이며, `git status` 상 이 세션의
staged/unstaged 변경도 동일 set 임을 확인했다.

## 발견사항

- **[WARNING]** 백엔드 API 계약 변경(`backend-api-change` 행)의 target (b) "API 노출 변경이
  사용자 안내에 영향 → 관련 user-guide 페이지" 가 갱신되지 않았다 — 4개 문서(ko/en 각 2쪽)가
  이번 PR 이 실측·확정한 실제 동작과 어긋나는 내용을 그대로 두고 있다.
  - 변경 파일 (trigger): `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
    (`ChatChannelUpdateConfigDto` 신설), `codebase/backend/src/modules/triggers/triggers.controller.ts`,
    `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` — 모두
    `doc-sync-matrix.json` `backend-api-change` 행의 glob(`**/*.controller.ts`, `**/dto/**`)에 매칭.
  - 매트릭스 항목: `backend-api-change` — PROJECT.md 147행 표 원문: "백엔드 API 추가·변경 | (a)
    controller·DTO 의 swagger jsdoc<br>(b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide
    페이지 | swagger 단위 테스트 / 빌드". (a)는 이번 diff 가 실제로 만족한다 — `ApiPropertyOptional`
    description·`ApiBadRequestResponse` 설명 갱신이 diff 안에 있다(`chat-channel-config.dto.ts:376-382,
    390-396`, `triggers.controller.ts:122-127`). **(b)만 누락.**
  - 누락된 동반 갱신 (미변경 상태로 stale 해진 4개 파일):
    - `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx:119`
    - `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.en.mdx:106`
    - `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:429`
    - `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx:418`
  - 상세: 네 파일 모두 동일한 문장을 담고 있다(ko 예시, `telegram.mdx:119`) — *"PATCH 본문으로
    `config.chatChannel.botTokenRef` 를 직접 변경하면 400 `VALIDATION_ERROR` 가 돌아와요
    (`details.field='botTokenRef'`)."* 이 문장은 (1) 필드명이 틀렸고 — 사용자가 실제로 보낼 수
    있는 공개 필드는 `botToken` 이지 내부 secret-ref 이름인 `botTokenRef` 가 아니다(`botTokenRef`
    는 API 입력 필드로 노출된 적이 없다) — (2) `details.field` 형식도 틀렸다 — 이번 PR 이 새로
    추가한 `trigger-dto-validation.spec.ts` 의 `[실측] 차단 5필드의 details.field 는 전부 중첩
    경로다` 테스트(827~849행)가 실제 값을 `chatChannel.botToken` 형태(중첩 경로)로 확정했다,
    flat `botTokenRef` 가 아니다. `git blame telegram.mdx:117-120` 확인 결과 이 문장은
    2026-05-23(`49be696490`) 부터 있던 pre-existing 문장이라 이번 diff 가 새로 써 넣은 오류는
    아니지만, 이번 PR 이 정확히 이 동작(“PATCH 는 bot token 을 거부한다”)을 처음으로 실제
    구현하고 그 `details.field` 실측값까지 코드에 정본으로 남긴 자리이므로, PROJECT.md
    §사후 보정 PR 패턴 금지 — 같은 turn 원칙에 따라 **이 PR 안에서 함께 정정됐어야 한다.**
    developer plan(`plan/in-progress/impl-chat-channel-patch-token.md` "이 턴에 실측해 planner 로
    넘길 것" 표)은 같은 실측을 근거로 `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1 의 flat
    표기 정정만 planner 후속으로 등재했고, 이 4개 frontend user-guide MDX 파일은 그 표에도,
    다른 어떤 리뷰 산출물(`api_contract.md`·`documentation.md`, 둘 다 README/JSDoc/Swagger 만
    확인하고 `content/docs/**` 는 열지 않음)에도 등장하지 않는다. spec 정정(`spec/**`)은
    developer 권한 밖이라 planner 위임이 맞는 처분이지만, 이 4개 MDX 는 `codebase/frontend/**`
    라 developer 가 이번 PR 안에서 직접 고칠 수 있는 영역이며 별도 planner 턴이 필요 없다.
    사용자 관점 영향: API 를 직접 호출하는 통합 담당자가 이 문서를 그대로 믿고
    `details.field === 'botTokenRef'` 로 에러 분기 코드를 짜면 그 조건이 영원히 매칭되지 않는다.
  - 부수 발견(같은 gap 의 연장): `slack.mdx`/`discord.mdx`(및 각 `.en.mdx`)에는 Signing
    Secret/Public Key(=`inboundSigningPlaintext`) 의 PATCH 시 동작이나 회전 방법에 대한 안내가
    **아예 없다** — telegram 의 "## 6. Bot Token 회전" 같은 절이 두 provider 문서 어디에도 없다.
    이번 PR 이 세 provider 모두에서 `inboundSigningPlaintext`/`inboundSigning` PATCH 를 400 으로
    막는 것을 실측·고정했으므로(R-CC-21, `trigger-dto-validation.spec.ts` "slack 도 예외가
    아니다"), "회전이 필요하면 트리거를 삭제 후 재생성하라"는 안내가 두 provider 문서에 없는
    것도 같은 (b) 미충족의 연장선이다.
  - 제안: 4개 파일의 해당 문장을 `chatChannel.botToken`(nested path)로 정정하고, `botTokenRef`
    가 아니라 `botToken` 이 실제 차단 대상 필드임을 명시. `slack.mdx`/`discord.mdx`(+en)에는
    telegram 의 "Bot Token 회전" 절과 대응하는 "Signing Secret/Public Key 는 PATCH 로 바꿀 수
    없다 — 회전이 필요하면 트리거 재생성" 절을 신설.

## 확인한 것 — 매트릭스 위반 아님

- `codebase/backend/src/nodes/**` 변경 없음 → `new-node`/`node-schema-change` 행 미해당.
- `codebase/frontend/src/**/*.tsx` 변경 없음 → `new-ui-string`(i18n dict parity) 행 미해당.
- `codebase/backend/src/modules/auth/**` 변경 없음 → `auth-session-flow-change` 행 미해당(트리거
  모듈 변경이지 인증/세션 모듈 변경이 아니다).
- `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음, 신규 `ErrorCode`/`warningRules` 값
  발행 없음(이번 diff 의 400 은 기존 `VALIDATION_ERROR` 코드 재사용 + 이미 한국어로 작성된
  `@IsEmpty()`/`BadRequestException` 메시지) → `new-warning-code`/`new-error-code` 행 미해당,
  `backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO` 매핑 대상 아님.
- `codebase/packages/expression-engine/**` 변경 없음 → `expression-language-change` 행 미해당.
- `codebase/frontend/src/content/docs/*/`(신규 섹션 디렉토리) 신설 없음 → `new-userguide-section-dir`
  행 미해당, `locale.ts` 갱신 불필요.
- controller/DTO 의 swagger jsdoc 자체(target (a))는 이번 diff 안에서 이미 갱신됐다 — 별도
  지적 불필요.
- `plan/in-progress/impl-chat-channel-patch-token.md` 는 spec 정정 항목(§5.4.1 flat→nested,
  `store()`→`rotate()`)을 planner 후속으로 올바르게 등재했다 — 그 부분은 절차 위반이 아니다.

## 요약

매트릭스 23행 중 `backend-api-change` 1건이 매칭됐다(controller.ts + dto/** 변경). target (a)
swagger jsdoc 은 diff 안에서 충족됐으나 target (b) "관련 user-guide 페이지" 가 미충족 — 이번 PR
이 새로 실측·확정한 `details.field` 실제 값(`chatChannel.botToken`, nested)과 실제 차단 필드명
(`botToken`)이, 4개 기존 user-guide MDX(telegram/triggers, ko+en)에 남아 있는 pre-existing
오기(`botTokenRef`, flat)를 정정하지 않은 채 방치됐다. 다른 12건 trigger(신규 노드·UI 문자열·
표현식 언어·인증 흐름 등)는 이번 변경 set 과 무관해 미매칭. 위반은 1건, 등급은 WARNING(docs MDX
갱신 누락 — i18n parity 나 UI 깨짐 수준의 CRITICAL 은 아니지만 API 계약을 설명하는 사용자 문서가
구현·테스트가 확정한 사실과 반대로 남아 있다).

## 위험도

WARNING
