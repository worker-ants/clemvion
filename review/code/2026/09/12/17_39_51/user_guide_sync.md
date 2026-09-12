# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]` 20개, id 단위) + `PROJECT.md` §변경 유형 → 갱신 위치
매핑 본문을 SoT 로 적재했다.

## 변경 파일 분류

리뷰 대상 13개 codebase 파일(+ plan 2건, 나머지는 이전 리뷰 라운드 산출물/consistency 산출물이라
매트릭스 target 이 아님):

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (테스트 보강만 — `it.each` 추가)
- `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (주석 귀속 문구 정정)
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (JSDoc 문구 정정)
- `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts` (신규 응답 DTO)
- `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` (테스트 보강만)
- `codebase/backend/src/modules/triggers/triggers.controller.ts` (swagger 데코레이터 추가, 반환 타입 DTO 화)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (반환 타입 애노테이션 정밀화 — 로직 무변경)
- `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts` (신규 — 순수 로직, `src/repo-guards/**`)
- `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision.spec.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/fixtures/dto-class-collision/{alpha,beta,decoy}.dto.ts` (신규 — 테스트 fixture 3개, 프로덕션 코드 아님)

`codebase/frontend/**` diff 0줄. `codebase/backend/src/nodes/**` diff 0줄. `codebase/backend/src/modules/auth/**`
diff 0줄. `codebase/packages/expression-engine/**` diff 0줄. `spec/**` diff 0줄. `content/docs/**` diff 0줄.

## 매칭 결과

- **`new-node` / `node-schema-change`** (glob `codebase/backend/src/nodes/**`) — 매칭 없음. 변경 위치는
  `src/modules/triggers/`·`src/repo-guards/`이지 `src/nodes/`가 아니다.
- **`new-ui-string` / `new-widget-chrome-string`** (glob `*.tsx`) — 매칭 없음. frontend·channel-web-chat 파일
  변경 0건.
- **`integration-provider-change`** (semantic) — 매칭 없음. Telegram/Slack/Discord provider 검증 로직·라벨
  문구(`Slack signing secret`·`Discord application public key` 등)는 이 라운드에서도 무변경 — 이번 diff 의
  실질 변화는 (1) 신규 응답 DTO 추가(`ChatChannelRotateBotIdentityDto`/`ChatChannelRotateBotTokenDto`), (2)
  swagger 데코레이터 보강, (3) 테스트 보강(`it.each` 케이스 추가), (4) 신규 repo-guard(DTO 클래스명 충돌
  검출) 이며 provider 별 요구사항·에러 메시지 자체는 손대지 않았다.
- **`backend-api-change`** (semantic, glob `*.controller.ts` + `dto/**`) — **매칭**. `triggers.controller.ts`
  (`@ApiUnauthorizedResponse`/`@ApiNotFoundResponse`/`@ApiOkWrappedResponse` 추가, 반환 타입을 `ChatChannelRotateBotTokenDto`
  로 명시) + 신규 응답 DTO + `chat-channel-config.dto.ts` JSDoc 정정이 이 trigger 에 해당한다.
  - target (a) "controller·DTO 의 swagger jsdoc" — 이번 diff 자체가 그 작업이며 필드 전부(`botId`·`username`·
    `teamId`·`publicKey`·`rotatedAt`·`triggerId`·`chatChannelHealth`·`botIdentity`)에 `@ApiProperty`/JSDoc 이
    붙어 있다. 누락 아님.
  - target (b) "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" — `rotateBotToken` 엔드포인트는
    신규가 아니고, `triggers.service.ts` 의 실제 반환 로직도 이번 diff 로 바뀌지 않았다(타입 애노테이션만
    `NonNullable<ChatChannelConfig['botIdentity']> | null` 로 정밀화). 사용자 가이드는 이미 이 엔드포인트를
    문서화하고 있다 — `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx:129`(및
    `.en.mdx`), `02-nodes/triggers.mdx:427-439`(및 `.en.mdx`)가 `POST /api/triggers/:id/chat-channel/rotate-bot-token`
    과 응답 형태 `{ data: { triggerId, rotatedAt, chatChannelHealth, botIdentity } }` 를 이미 서술한다. 신규
    필드 `publicKey`/`teamId`는 이전 라운드부터 지적된 기존 Discord/Slack adapter 반환값을 swagger 에 뒤늦게
    반영한 것뿐이고, 유저 가이드 MDX 는 애초에 `botIdentity` 하위 필드를 나열하지 않는 추상화 수준이라
    stale 상태로 전환되지 않는다. **동반 갱신 누락으로 보지 않는다.**
  - 이 결론은 동일 PR 의 이전 세 독립 라운드(`16_17_57`, `17_02_19`, `17_23_34`)와도 일치한다 — 그 사이
    변경분(응답 DTO 위치 이동, `publicKey` 필드 보강, 401 응답 추가, 이번 라운드의 테스트 보강 + repo-guard
    신설)은 전부 이 판단을 바꾸지 않는 순수 백엔드 정합화·테스트 추가다.
- **`new-warning-code` / `new-error-code`** — 매칭 없음. `error-codes.ts`, warningRules 파일 무변경.
- **`auth-session-flow-change`** — 매칭 없음(`modules/auth/**` 무변경).
- **`expression-language-change` / `run-debug-flow-change`** — 매칭 없음(무관 모듈).
- **`new-userguide-section-dir`** — 매칭 없음(신규 `content/docs/<NN>-*/` 디렉토리 없음).
- **`userguide-gui-flow-section`** (glob `02-nodes/**.mdx` + `06-integrations-and-config/**.mdx`) — 매칭 없음
  (mdx 파일 변경 0건). 참고로 `02-nodes/triggers.mdx` 의 `<ImplAnchor>` 3개는 모두 frontend
  (`triggers/page.tsx` 의 `createMutation`, `auth-config-select.tsx`)만 가리키며 이번 backend 리팩터
  (`assertChatChannelInputSafe` 등을 `TriggersService`→`chat-channel-input-rules.ts` 모듈 함수로 이동)와
  겹치는 symbol/file 참조가 없음을 grep 으로 확인했다 — anchor 파손 없음.

## 발견사항 (참고용, 이 diff 의 누락은 아님)

- **[INFO]** `telegram.mdx`/`telegram.en.mdx`/`02-nodes/triggers.mdx`/`.en.mdx` 가 rotate-bot-token 404 를
  `TRIGGER_NOT_FOUND` 로 서술하지만 실제 코드(`triggers.service.ts` `findById`, L342-354)는 `RESOURCE_NOT_FOUND`
  를 던진다. 이번 diff 가 처음으로 `@ApiNotFoundResponse({ description: 'RESOURCE_NOT_FOUND — ...' })` 를
  추가하면서 (기존 리뷰 라운드 `16_17_57/documentation.md` 가 이미 "swagger 설명이 실제 코드와 일치"라고
  확인한 대로) swagger 쪽은 정확해졌는데, 별도 파일인 user-guide MDX 쪽 라벨은 여전히 옛 이름이다.
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx:130`,
    `telegram.en.mdx:117`, `02-nodes/triggers.mdx:463`, `02-nodes/triggers.en.mdx:450`
  - `git log -S"TRIGGER_NOT_FOUND"` 로 origin 을 추적하면 2026-05-23 커밋(`docs(user-guide): telegram —
    spec PR #281 ... (#282)`)에서 들어간 표현이다 — **이번 `chat-channel-rules-cleanup` 작업이 만든 staleness
    가 아니라 그보다 4개월 앞선 선재 결함**이며, 이번 diff 는 그 파일들을 건드리지도 않았다. 따라서
    "동반 갱신 누락"으로 분류하지 않는다(이 diff 의 trigger 가 요구하는 co-update 대상이 아님).
  - 제안(후속 참고용, 이번 PR 의 액션 아이템은 아님): 별도 plan/PR 에서 4개 MDX 파일의
    `TRIGGER_NOT_FOUND` → `RESOURCE_NOT_FOUND` 일괄 정정.

## 요약

매트릭스 20개 행 중 파일 경로/의미로 매칭된 것은 `backend-api-change` 1건(controller + dto 변경)뿐이며,
그 target 은 (a) 같은 diff 안에서 이미 충족(swagger jsdoc), (b) 사용자 가이드가 이미 다루는 기존 동작이라
갱신 대상이 아님(신규 필드·신규 캡션·신규 동작 없음) — 4라운드 연속 동일 결론. 이번 라운드에서 새로 추가된
파일(`repo-guards/__tests__/dto-class-name-collision*`, fixtures 3개)은 순수 테스트 하네스이며 어떤 trigger 에도
해당하지 않는다. `<ImplAnchor>` 파손도 없음(grep 확인). 나머지 19개 행(신규 노드·UI 문자열·통합 provider·
신규 섹션·auth·표현식·실행 흐름·warning/error code 등)은 비매칭. 참고로 사용자 안내 문서의 `TRIGGER_NOT_FOUND`
표기는 실제로 stale 하지만 2026-05 커밋에서 유입된 선재 결함이라 이번 diff 의 동반 갱신 의무 범위 밖으로
INFO 로만 기록한다.

## 위험도

NONE
