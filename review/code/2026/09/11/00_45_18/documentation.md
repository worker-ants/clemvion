# 문서화(Documentation) 코드 리뷰 — `impl-chat-channel-patch-token`

## 검토 방법

`_prompts/documentation.md` 가 제시한 diff(코드 6 + e2e 1 + 사용자 가이드 mdx 8 + plan 2 + 커밋된
`review/**` 산출물 다수)를 게이트 라인 대조 + 실제 저장소 파일(`Read`/`git blame`/`git log -S`)로
교차 확인했다. 저장소 트리는 변경하지 않았다(`git status --short` 최종 확인 — clean, 세션 산출물
`review/code/2026/09/11/00_45_18/`·`review/consistency/2026/09/11/00_45_19/` untracked 만 존재,
본 리뷰가 만든 것이 아니라 워크플로 자체의 세션 디렉터리).

핵심 코드(`chat-channel-config.dto.ts`·`update-trigger.dto.ts`·`triggers.controller.ts`·
`triggers.service.ts`)는 예외적으로 문서화 수준이 높다 — 새 `ChatChannelUpdateConfigDto` 클래스,
`assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp`/
`setupChatChannel` 전부 "왜 이렇게 짰는가"·"기각한 대안"·회귀 캐너리 이름까지 명시한 JSDoc 을
갖췄고, 컨트롤러의 `@ApiBadRequestResponse` 는 신규 400 사유 3가지와 `details.field` 형식이
값의 형태(빈 값 vs 비어있지 않은 값)에 따라 갈리는 것까지 정확히 반영했다. `doc-sync-matrix.json`
의 `backend-api-change` 타겟 둘(swagger jsdoc · user-guide) 모두 동일 PR 에서 갱신됐다
(discord/slack `.mdx`+`.en.mdx` 신규 §5.5/§6.5, telegram/triggers `.mdx`+`.en.mdx` 기존 문구
정정 — `botTokenRef`→`botToken`, flat→nested `details.field`). 그 바탕 위에서 남은 두 가지
실질 결함을 찾았다.

## 발견사항

- **[WARNING]** 테스트를 두 갈래로 쪼개면서 JSDoc 이 엉뚱한 테스트 위에 남았다(orphaned JSDoc)
  - 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:816`~`846`
    (실제 파일 줄 번호, `Read`/`git blame` 로 확인 — 이 파일은 프롬프트에서 diff 가 생략돼
    게이트가 없다)
  - 상세: `816`~`828` 줄의 JSDoc(`**details.field 실측 — 다섯 필드 전부.**` … `이 단언이 그
    실측의 정본이다 — 후속 planner 턴이 §5.4.1·§5.4.1.1 의 표기를 고칠 때 여기 값을 근거로
    쓴다`)는 내용상 `846` 줄의 `it('[실측] 차단 5필드의 details.field 는 **비어있지 않은 값일
    때** 중첩 경로다', …)` 를 설명한다. 그런데 `git blame` 확인 결과, 커밋 `cf4ba26e9`(1라운드)
    시점에는 이 JSDoc 이 바로 그 테스트 하나 위에 있었다. 2라운드 커밋 `83d5f3f94`
    (RESOLUTION #3 — "테스트를 두 갈래로 분리")가 **원 JSDoc 과 원 테스트 사이에** 새 JSDoc
    (`829`~`834`, `null`/`''` 케이스를 설명)과 새 테스트(`835`~`844`)를 끼워 넣으면서, 원
    JSDoc 은 새로 삽입된 두 블록 위에 "떠 있는" 채로 남고 원 테스트만 아래로 밀려났다. 그 결과
    지금은 `816`~`828`(5필드 측정 결론) 바로 아래에 `829`~`834`(null/빈 문자열 설명)이 이어지고
    또 그 아래에 `835` 테스트(null/빈 문자열)가 온다 — **5필드 결론 JSDoc 이 null/빈 문자열
    테스트를 설명하는 것처럼 읽힌다.** 정작 그 JSDoc 이 가리키는 `846` 의 진짜 5필드 테스트에는
    바로 위에 아무 설명도 없다. 이 세션의 메모(`feedback_my_own_fix_is_the_next_defect.md`)가
    이미 "orphan JSDoc" 을 반복 결함 클래스로 지목한 바로 그 형태다.
  - 제안: `816`~`828` JSDoc 블록을 `835` 테스트 앞이 아니라 `846` 테스트(`[실측] 차단 5필드...`)
    바로 위로 옮긴다. `829`~`834` JSDoc 은 지금 위치(`835` 테스트 바로 위)가 맞으므로 그대로 둔다.

- **[WARNING]** DTO 소스 주석이 이 PR 이 스스로 반증한 `details.field` 형식(flat)을 그대로
  들고 있다 — 같은 PR 이 같은 파일·같은 클래스형제 필드에 대해 이미 고친 것과 대조된다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:190`~`193`
    (실제 파일 줄 번호. 이 블록은 이번 diff 의 변경 대상이 아니라 게이트가 없다 — `git blame`
    확인 결과 `2026-05-23` `b7f1c34e5b` 부터 존재하는 pre-existing 주석)
  - 상세: `botTokenRef` 필드 JSDoc 이 "PATCH body 또는 POST body 에 본 필드가 포함되면 400
    VALIDATION_ERROR (`details.field='botTokenRef'`)" 라고 적는다(flat, 접두어 없음). 그런데
    이번 PR 이 직접 추가한 실측 테스트
    (`trigger-dto-validation.spec.ts:846` `[실측] 차단 5필드의 details.field 는 **비어있지 않은
    값일 때** 중첩 경로다`)는 `botTokenRef: ['chatChannel.botTokenRef']` 를 단언한다 — 즉
    비어있지 않은 값이 실리면 전역 `CustomValidationPipe`(`common/pipes/validation.pipe.ts`)의
    `flattenErrors` 가 **중첩 경로**를 만든다. 이 PR 은 정확히 이 발견을 근거로
    `triggers.controller.ts` 의 `@ApiBadRequestResponse`(flat/nested 갈림을 명시)와 4개
    사용자 가이드 mdx(`botTokenRef`→`botToken`, `details.field='botTokenRef'`→
    `details.field='chatChannel.botToken'`)를 고쳤다. 그런데 **같은 파일, 같은 발견이 만들어낸
    같은 클래스의 오기**인 이 DTO 내부 주석은 손대지 않았다 — 사용자에게 노출되는 Swagger
    설명(`@ApiPropertyOptional`)이 아니라 소스 JSDoc 이라 영향은 작지만, 다음 개발자가 이 파일을
    열어 "botTokenRef 위반은 `details.field='botTokenRef'` 로 온다"고 그대로 믿을 수 있다.
    (참고: `inboundSigningRef`(`210`~`213`)·`inboundSigning`(`227`~`231`) 형제 필드의 JSDoc 은
    애초에 `details.field` 형식을 명시하지 않아 이 문제가 없다 — `botTokenRef` 필드 하나만
    해당.)
  - 제안: `details.field='botTokenRef'` → `details.field='chatChannel.botTokenRef'`(비어있지
    않은 값 갈래 한정이라는 caveat 도 함께) 로 정정. 한 단어 수준의 수정이라 이 PR 범위 안에서
    바로 처리 가능하다.

- **[INFO]** 신규 사용자 가이드 섹션(Discord/Slack "Changing the bot token or public key /
  signing secret")이 `details.field` 형식의 "비어있지 않은 값" 갈래만 설명한다
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/discord.en.mdx:109`~`122`,
    `slack.en.mdx:134`~`147` (및 대응 ko 버전)
  - 상세: 이번 PR 자신의 `[실측]` 테스트(`trigger-dto-validation.spec.ts:835`)가 확인했듯
    `botToken`/`inboundSigningPlaintext` 에 `null`이나 빈 문자열을 보내면 DTO 검증은 통과하고
    서비스 계층이 **flat** `details.field='botToken'` 로 거부한다 — 새 가이드 문구는 "값을
    실으면 400, `details.field='chatChannel.botToken'`" 만 서술해 이 갈래를 다루지 않는다.
    실사용자가 폼에 값을 입력해 보내는 흔한 경로(비어있지 않은 값)만 문서화한 것은 합리적인
    단순화이고, 이 자체가 사용자 가이드의 결함은 아니다 — 다만 자동화된 API 클라이언트를 만드는
    통합 개발자가 `null` 전송 시 다른 `details.field` 표현을 만나면 문서와 어긋난다고 느낄 수
    있다.
  - 제안: 우선순위는 낮음. 필요하면 각주 한 줄("빈 값을 명시적으로 보내도 거부되며, 이 경우
    `details.field` 는 접두어 없는 `botToken` 형태로 옵니다") 추가를 고려.

## 확인된 것 — 문제 없음

- `ChatChannelUpdateConfigDto` 신규 클래스(`chat-channel-config.dto.ts:347`~`404`)의 JSDoc —
  `OmitType` 채택 이유·`Patch` 대신 `Update` 명명 이유·optional+`@IsEmpty` 조합 이유를 전부
  근거와 함께 기술. 신규 필드 `@ApiPropertyOptional` 설명도 400 사유·엔드포인트·회전 정책까지
  정확히 반영.
- `triggers.controller.ts` 의 `@ApiBadRequestResponse` 갱신 — 신규 400 사유 3가지와
  `details.field` 형식이 값의 형태(빈/비어있지 않음)에 따라 갈리는 것을 정확히 구분해 서술.
  서비스 코드(`assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`)의 실제
  `details: { field: ... }` 값과 대조해 일치 확인.
  `common/pipes/validation.pipe.ts` 의 `flattenErrors`(중첩 경로 생성)와도 대조 확인.
- `triggers.service.ts` 의 `setupChatChannel`/`assertChatChannelInputSafe` JSDoc 이 인용하는
  회귀 캐너리 이름(`"slack/discord — 카드 편집 PATCH 후에도 inboundSigningRef 가 살아남는다"`,
  `"setupChannel 이 실패해도(degraded) inboundSigningRef 를 잃지 않는다"`)이
  `triggers.service.spec.ts:3186`·`3216` 의 실제 테스트 제목과 정확히 일치.
- `trigger-workflow-ref.e2e-spec.ts` 의 docstring 재작성 — "판정된 결함을 재현한다" 경고를
  "2026-09-10 해소됨" 기록으로 교체한 것이 코드 변경(바디에서 `botToken` 제거)과 1:1 대응.
  `review/code/2026/09/10/14_34_18` 인용도 실제 존재하는 경로.
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 CRITICAL 체크박스가
  `[x]` 로 바뀌고 해소 근거(커밋·리뷰 경로)가 함께 기록됨 — 인용된 산출물(`review/code/2026/09/10/23_55_23`)
  실제 존재 확인.
- `doc-sync-matrix.json` `backend-api-change` 타겟 두 개(controller/DTO swagger jsdoc,
  user-guide) 모두 이 PR 안에서 갱신 확인 — README/CHANGELOG 는 이 저장소 관례상(과거
  #1288~#1292 등 유사 보안 수정 커밋 다수가 `CHANGELOG.md` 미접촉) 개별 기능 PR 단위로
  갱신하지 않는 패턴이라 누락으로 보지 않음.
- `spec/` 파일은 diff 에 전혀 없음 — developer 가 read-only 경계를 지켰고, 발견한 spec 문면
  갭(§5.4.1/§5.4.1.1 의 flat `botTokenRef` 표기, `SecretResolver.store()` vs `rotate()` 불일치)은
  전부 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 인계 항목으로만
  등재됨 — 자기-반증형 소정정 조건 미충족 판단과 일치.

## 요약

핵심 코드·컨트롤러·신규 사용자 가이드는 이례적으로 꼼꼼하게 문서화됐고, `details.field` 형식이
값의 형태에 따라 갈리는 미묘한 사실까지 정확히 반영했다. 다만 그 정확성 작업 중 두 가지가
새어나갔다 — (1) 리뷰 2라운드에서 테스트를 둘로 쪼개며 JSDoc 하나가 원래 설명 대상이 아닌 테스트
위에 남는 orphaned-comment 결함이 새로 생겼고, (2) 같은 PR 이 같은 파일에서 이미 고친 것과 같은
클래스의 stale 주석(`details.field='botTokenRef'` flat 표기)이 `botTokenRef` 필드 JSDoc 에
그대로 남아 있다. 둘 다 국소적이고 수정 비용이 낮으며 사용자 대상 API 문서(Swagger 설명·가이드
mdx)에는 영향이 없다 — 소스 내부 주석/테스트 파일에 한정된다. README/CHANGELOG/API 문서
동기화는 프로젝트 관례(`doc-sync-matrix.json`)를 충실히 따랐다.

## 위험도

LOW
