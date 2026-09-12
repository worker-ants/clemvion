# 요구사항(Requirement) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강 (라운드 5, `17_39_51`)

## 점검 방법

이 라운드는 이전 4라운드(`16_17_57` CRITICAL 1·WARNING 3 → `16_39_18` WARNING 3 → `17_02_19`
WARNING 1 → `17_23_34` WARNING 1)가 낸 지적을 전부 조치한 뒤의 누적 상태를 검증한다. 프롬프트
번들이 예산 초과로 여러 파일(특히 파일 2 `chat-channel-input-rules.ts`)의 diff를 잘랐으므로,
저장소의 실제 파일을 `Read`로 전문 열람하고 `git log`/`git show`로 커밋 이력을 대조했다.

- `chat-channel-input-rules.ts` 전체(349줄)를 직접 열어 5개 헬퍼(`throwInvalidField`·
  `hasField`·`rejectBlockedField`)와 4개 공개 함수(`assertChatChannelInputSafe`·
  `assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`·
  `assertInboundSigningPlaintextByProvider`·`translateSetupChannelError`)를 읽었다.
- `spec/5-system/15-chat-channel.md`의 R-CC-21·R-CC-23·§5.4·§5.4.1·§5.4.1.2를 직접 Read해
  구현과 line-level로 대조: 응답 필드(`rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity`,
  예시 `{ botId: 123, username: 'mybot' }`)·에러 코드(404 `RESOURCE_NOT_FOUND`, 400
  `INVALID_BOT_TOKEN`/`BOT_TOKEN_INVALID`, 502 `CHAT_CHANNEL_SETUP_FAILED`)가 정확히 일치.
- `chat-channel-config.dto.ts`를 열어 `ChatChannelConfigDto.provider`가 `@IsString() @IsIn(...)`
  이고 `@IsOptional()`이 없음을 확인 — `ChatChannelUpdateConfigDto`가 `OmitType(...,
  ['botToken','inboundSigningPlaintext'])`이므로 `provider`가 상속돼 PATCH에서도 필수라는
  주석·plan §설계판단(3)·신규 테스트(`trigger-dto-validation.spec.ts` "provider가 %s면 DTO
  층에서 거부된다")의 주장이 실제로 성립함을 확인했다.
- `chat-channel/types.ts`의 `ChatChannelConfig['botIdentity']`(`botId`·`username`·`teamId?`·
  `publicKey?`)와 신규 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`의
  `ChatChannelRotateBotIdentityDto` 필드를 1:1 대조 — 완전히 일치.
- `triggers.service.ts`의 `rotateBotToken()`(975~1123행) 전체를 읽어 6단계(기존 토큰 resolve →
  v2 백업 → 신규 토큰 저장 → setupChannel 재호출 → inboundSigning 저장 → 컬럼 갱신 + 감사 로그)
  순서·에러 변환(`translateSetupChannelError`)·반환 객체가 컨트롤러 데코레이터·DTO와 일치함을
  확인.
- `npx jest src/modules/triggers/chat-channel-input-rules.spec.ts
  src/modules/triggers/dto/trigger-dto-validation.spec.ts`(110 passed) ·
  `npx jest src/repo-guards/__tests__/dto-class-name-collision.spec.ts`(4 passed) ·
  `npx jest src/repo-guards/__tests__/dto-jsdoc-citation`(5 passed) 를 직접 실행해 GREEN 확인.
- 대상 8개 애플리케이션 파일 + 신규 repo-guard 2파일에서 `TODO|FIXME|HACK|XXX` grep — 0건.
- `plan/in-progress/chat-channel-rules-cleanup.md`의 bare 인용(`16_17_57`, 128행)을
  `review-citations.md §3`과 대조 — `plan/**` 문서는 규약 적용 대상이 아니므로(같은 세션 맥락)
  위반 아님. 이전 라운드가 고친 것은 **codebase 주석**의 bare 인용 5곳뿐이며 그 스코프는
  정확했다.
- `spec/2-navigation/2-trigger-list.md`의 `code: dto/**`가 신규 `dto/responses/*.ts`를 덮고,
  `15-chat-channel.md`의 좁은 glob(`dto/chat-channel-*.dto.ts`)은 `/`를 넘지 못해 이 파일을
  놓친다는 점을 실측 확인 — 단, 이미 이전 라운드(`RESOLUTION.md` 16_39_18/17_02_19)가 이 사실을
  실측하고 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 후속 항목으로
  등재해 뒀다(spec-link 판정 자체는 `2-trigger-list.md`로 성립).

저장소 파일은 조회·테스트 실행만 했고(`Read`/`git log`/`git show`/`npx jest`) 아무것도
수정하지 않았다 — `git status --short` 결과 본 리뷰 산출물 디렉터리 외 변경 없음.

## 발견사항

없음. CRITICAL/WARNING 급 결함을 찾지 못했다.

- **[INFO]** `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`가 `15-chat-channel.md`
  frontmatter의 좁은 `code:` glob(`codebase/backend/src/modules/triggers/dto/chat-channel-*.dto.ts`)
  에 안 잡힌다 — `*`가 `/`를 넘지 않기 때문이다.
  - 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` 목록 (7번째 항목)
  - 상세: 이미 이전 두 라운드(`review/code/2026/09/12/16_39_18/RESOLUTION.md` W1,
    `17_02_19` 이월 목록)가 같은 사실을 실측하고 planner 후속 항목으로 등재했다. `2-trigger-list.md`의
    `dto/**`가 같은 파일을 덮으므로 spec-link 판정(`--impl-done`) 자체는 성립하고, 남은 것은
    "chat-channel spec이 자기 파일을 보는가" 한 축뿐이다 — 코드 결함이 아니라 이미 트래킹된
    glob-폭 문제.
  - 제안: 조치 불요(이번 라운드 신규 아님, planner 항목으로 이미 등재됨). `15-chat-channel.md`의
    glob을 `dto/**/chat-channel-*.dto.ts`로 넓히는 것은 `project-planner` 턴의 몫.

## 요약

`chat-channel-input-rules.{ts,spec.ts}`·`triggers.{controller,service}.ts`·관련 DTO·신규
`dto-class-name-collision` repo-guard로 구성된 이 변경 집합을 spec 본문(R-CC-21, R-CC-23,
§5.4, §5.4.1, §5.4.1.2)과 line-level로 대조한 결과 함수 시그니처·필드명·에러 코드·기본값·검증
규칙·상태 전이가 모두 일치한다. `hasField`/`rejectBlockedField`/`throwInvalidField` 헬퍼
추출은 5개 차단 필드의 존재 검사·에러 봉투 형태·검사 순서를 보존하는 순수 리팩터이고, `null`/`''`
두-층 등가성(DTO `@IsEmpty()` 통과 → 서비스 가드 거부)은 신규 `it.each` 테스트로 실제
판별 가능하게 고정됐다(뮤테이션 6종 중 6번 `hasField` truthy-판별 뮤턴트가 실제 RED임을 이번
라운드에서도 재확인 가능한 상태). `rotateBotToken` 신규 응답 DTO(`ChatChannelRotateBotTokenDto`/
`ChatChannelRotateBotIdentityDto`)는 서비스의 실제 반환 타입(`NonNullable<ChatChannelConfig
['botIdentity']> | null`)과 SoT 타입 참조로 필드 단위 일치가 보장되며, 이전 라운드의 CRITICAL
(동명 클래스 스키마 충돌)은 개명 + 신규 AST 기반 repo-guard(`dto-class-name-collision`, 4/4
테스트 GREEN 직접 확인)로 재발 방지까지 마쳤다. TODO/FIXME/HACK/XXX 잔존 없음, 모든 함수가
정상/에러 양쪽 경로에서 적절한 값을 반환한다(`never` 반환 헬퍼 포함). 유일한 관찰 사항(신규
응답 DTO가 `15-chat-channel.md`의 좁은 glob에 안 잡히는 것)은 이번 PR이 새로 만든 결함이 아니고
이미 이전 라운드가 실측·등재해 둔 planner 축 후속 항목이라 이번 판정에 영향을 주지 않는다.

## 위험도

NONE
