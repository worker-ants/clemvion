# 보안(Security) 코드 리뷰 — chatChannel PATCH 비밀 차단 (D-1/D-2/D-3)

## 컨텍스트

이 diff 는 두 개의 선행 CRITICAL 을 닫는다 — ① `chatChannel` PATCH 가 `botToken` 을 공유 DTO 로
필수 요구해 R-CC-10 single-path(rotate 전용 경로: 24h grace 백업 · 전용 audit action ·
`chatChannelRotatedAt` 갱신)를 비교 없는 `secrets.rotate()` 로 우회하던 문제, ② 그 수정 도중
동일 세션의 이전 라운드(`review/code/2026/09/10/23_21_57/security.md`)가 발견한 **신규 CRITICAL**
— PATCH 가 `inboundSigningRef` 게이팅을 대칭 없이 걸어 slack/discord 카드 편집 PATCH 한 번으로
인바운드 웹훅 서명 검증이 fail-open 되던 문제. 이번 코드(commit `771801fca`)에서 실제로 닫혔는지
소스를 직접 열어 독립 검증했다.

## 발견사항

- **[INFO]** (사전 존재, 이번 diff 무관) `ChatChannelConfigDto.botToken` 은 Swagger 문서에
  `minLength: 1` 을 명시하지만 실제 `@MinLength(1)` validator 가 없어 **생성(POST) 경로에서 빈
  문자열 bot token 이 통과**한다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:174-187`
    (`botToken: string;` 앞의 `@IsString() @MaxLength(256)` — `@MinLength` 없음). 이 필드
    선언 자체는 이번 diff 의 변경 범위(파일 상단 import 1줄 + 하단 `ChatChannelUpdateConfigDto`
    신설)에 포함되지 않는다.
  - 상세: `@IsString()` 은 타입만 검사하므로 `botToken: ''` 도 통과한다. 생성 경로에서
    `setupChatChannel({ storeUserSuppliedSecrets: true }, …)` 이 `chatChannelCfg.botToken ?? ''`
    을 그대로 `secrets.rotate()` 에 넘기므로(`triggers.service.ts:1110-1116`), secret store 에
    빈 문자열이 "정상 저장된 토큰"인 것처럼 기록될 수 있다. plan 문서 자신이 *"`SecretResolver.rotate`
    에 빈 값 가드가 없다"* 고 이미 실측했고(`plan/in-progress/impl-chat-channel-patch-token.md`
    착수 전 실측 표 #2), 이 PR 은 그 결함을 **PATCH 경로에서만** 게이팅으로 막았다(D-2) —
    **생성(POST) 경로는 이번 수정의 대상이 아니었고 여전히 열려 있다.** 권한 우회는 아니지만
    (같은 워크스페이스 editor 가 자기 트리거를 스스로 무력화하는 것뿐), 조용히 무효한 비밀이
    저장되는 입력 검증 공백이다.
  - 제안: 이번 PR 스코프는 아니므로 별도 후속으로 `@MinLength(1)` (또는 provider 별 형식 정규식,
    telegram 은 `\d+:[A-Za-z0-9_-]+`)을 추가할 것을 권고. 블로킹 사유 아님.

- **[INFO]** `assertChatChannelInputSafe` 최상단 JSDoc 이 신설된 `mode` 분기를 반영하지 못해
  "slack/discord 는 `inboundSigningPlaintext` 필수" 로만 읽힌다 (PATCH 에서는 정반대로 **금지**)
  — 이미 `review/code/2026/09/10/23_21_57/documentation.md` 가 WARNING 으로 잡아 두었고
  동작 결함은 아니라서(런타임 검증은 `mode==='update'` 분기가 정확히 처리) 별도 보안 조치는
  불요. 보안 관점에서 이 항목을 다시 올리는 이유는, provider 별 강제/금지가 **정반대로 뒤집히는
  민감한 보안 검증 함수**의 JSDoc drift 이기 때문에 문서화 리뷰의 처방(1줄 보강)을 다시 한 번
  확인해 두는 것.

## 확인된 것 — 이전 라운드 CRITICAL/WARNING 이 실제로 닫혔음을 소스에서 직접 검증

- **CRITICAL (fail-open 인증 우회) — 닫힘.** `setupChatChannel`(`triggers.service.ts:1063-1250`)의
  `inboundSigningRefSurvives = providerIssuedStored || Boolean(preservedInboundSigningRef)`
  (`:1162-1163`)가 `internalCfg`(`:1165-1169`)·`mergedChannel`(`:1193-1202`)·실패 catch 블록의
  `fallbackConfig`(`:1232-1238`, `internalCfg` 재사용) 세 자리 모두에 대칭 적용됨을 확인했다.
  `update()`(`:526-528`)가 `mergeExternalConfig` 로 `config.chatChannel` 을 통째로 교체하기
  **전에** `previousInboundSigningRef` 를 읽어 `setupChatChannel` 에 인자로 넘기므로(`:587-591`),
  slack/discord PATCH 가 비밀 없이 편집돼도 기존 `inboundSigningRef` 가 보존된다.
  `triggers.service.spec.ts` 의 `it.each(['slack','discord'])('%s — 카드 편집 PATCH 후에도
  inboundSigningRef 가 살아남는다 (fail-open 회귀)', …)` 가 `secrets.rotate` 호출 여부가 아니라
  **`triggerRepo.update` 에 실제로 저장되는 `config.chatChannel.inboundSigningRef` 값**을
  단언한다 — 이전 라운드가 지적한 "테스트가 호출 여부만 보고 persisted 값을 안 본다" 그 갭이
  정확히 메워졌다.
- **WARNING (provider 전환 미차단) — 닫힘.** `assertChatChannelAlreadySetUp`
  (`triggers.service.ts:710-735`)이 `incoming.provider && incoming.provider !== current.provider`
  일 때 400(`details.field='provider'`)을 던진다 — 다른 provider 의 `botTokenRef`/평문을
  넘기게 되는 경로가 막혔다. 회귀 테스트: `triggers.service.spec.ts`
  `'PATCH 로 provider 를 바꾸면 400 (다른 provider 의 토큰을 넘기게 된다)'`.
- **R-CC-10 single-path 우회 — 닫힘.** `ChatChannelUpdateConfigDto`
  (`chat-channel-config.dto.ts:372-404`)가 `OmitType(ChatChannelConfigDto, ['botToken',
  'inboundSigningPlaintext'])` + `@IsEmpty()` 재선언으로 두 필드를 **금지**하고,
  `assertPatchCarriesNoSecrets`(`triggers.service.ts:683-701`)가 서비스 층에서 `typeof x !==
  'undefined'` 로 `null`/`''` 를 포함해 이중 방어한다 — `@IsEmpty()` 가 통과시키는 `null`/`''`
  변형까지 서비스 단언이 400 으로 잡는 것을 `triggers.service.spec.ts` 의 `it.each([['null',
  null], ['빈 문자열', '']])` 케이스로 확인했다.
- **최초 setup 의 조용한 실패 — 닫힘.** `assertChatChannelAlreadySetUp` 이 setup 안 된 트리거에
  PATCH 로 `chatChannel` 을 처음 붙이려는 요청을 명시적 400 으로 거부해, 종전 CCH-SE-01
  best-effort catch 가 삼켜 `degraded` 로 조용히 앉던 실패-은폐 경로를 없앴다.
- 인가(`@Roles('editor')`)·인증(`@ApiBearerAuth`) 데코레이터는 컨트롤러 diff(`update-trigger.dto.ts`
  임포트 교체, `@ApiBadRequestResponse` 문구 보강)만 있고 변경되지 않았다 — 권한 검증 우회
  없음.
- 응답 sanitize(`sanitizeForResponse`, `hasBotToken` derived flag) 는 이번 diff 대상이 아니고
  비밀 ref/plaintext 를 계속 strip 한다 — 회귀 없음.
- 테스트 파일의 시크릿류 값(`'111:TestToken'`, `SLACK_SIGNING_SECRET = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'`,
  `DISCORD_PUBLIC_KEY`)은 전부 fixture 상수이며 실제 자격증명 패턴이 아니다. e2e 캐너리
  (`trigger-workflow-ref.e2e-spec.ts`)는 오히려 종전에 실려 있던 `botToken: '111:e2eWfRefBotToken'`
  를 이번 diff 로 **제거**해 R-CC-10 우회 재현 바디를 폐기했다.

## 요약

이번 diff 는 실재했던 두 CRITICAL(비교 없는 rotate 로 인한 R-CC-10 single-path 우회, 그리고 그
수정 과정에서 스스로 만들었다가 같은 세션 리뷰가 잡아낸 inboundSigningRef fail-open 인증 우회)을
모두 닫는다. 소스를 직접 열어 두 수정 모두 대칭·이중 방어 구조로 구현됐고, 각각에 대해 호출
여부가 아니라 **persisted 값**을 단언하는 회귀 테스트가 존재함을 확인했다. 인가 데코레이터·응답
sanitize 등 기존 보안 통제는 이번 diff 로 변경되지 않았다. 남은 항목은 이번 diff 스코프 밖의
사전 존재 입력 검증 공백(`botToken` minLength 미enforce, 생성 경로 한정)과 이미 별도 리뷰어가
잡아 둔 JSDoc drift 뿐이며 둘 다 이 PR 을 막을 사유가 아니다.

## 위험도

LOW
