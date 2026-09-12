# 요구사항(Requirement) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강

## 점검 방법

`chat-channel-input-rules.{ts,spec.ts}` · `chat-channel-rejection-messages.const.ts` ·
`dto/chat-channel-config.dto.ts` · `dto/chat-channel-rotate-bot-token.dto.ts`(신규) ·
`dto/trigger-dto-validation.spec.ts` · `triggers.controller.ts` · `plan/in-progress/chat-channel-rules-cleanup.md`
를 리뷰 대상으로 직접 `Read` 하고, `spec/5-system/15-chat-channel.md`(§5.4·§5.4.1·§5.4.1.1·§5.4.1.2·§7·R-CC-21·R-CC-22)를
대조했다. 순수 리팩터(동작 무변경) 주장을 검증하기 위해 관련 테스트를 실행했다:

```
npx jest src/modules/triggers/chat-channel-input-rules.spec.ts src/modules/triggers/dto/trigger-dto-validation.spec.ts
  → 2 suites, 106 tests, all pass
npx jest src/modules/triggers/triggers.service.spec.ts src/modules/triggers/triggers.controller.spec.ts
  → 2 suites, 136 passed + 1 skipped
npx tsc -p tsconfig.build.json --noEmit  → 무출력 (에러 없음)
```

저장소 파일은 전혀 수정하지 않았다(Read/Bash 조회 및 로컬 jest/tsc 실행만). `git status --short` 는
`plan/in-progress/*.md` 2개 수정 + 미커밋 `review/code/2026/09/12/16_17_57/` 를 보였는데, 둘 다 본
리뷰 시작 전부터 워킹트리에 있던 상태이며 이 리뷰가 만든 변경이 아니다(원복 불필요).

## 발견사항

- **[INFO]** `tsc -p tsconfig.json --noEmit`(테스트 포함 풀 모드)에서
  `telegram-message.renderer.spec.ts(10,3): 'botToken' does not exist in type 'ChatChannelConfig'` 1건이
  나오지만, `git diff origin/main -- .../telegram-message.renderer.spec.ts .../chat-channel/types.ts` 가
  무출력 — 이 PR 의 diff 와 무관한 **기존 baseline 결함**이다(`run-test.sh` 는 `tsconfig.build.json`
  만 돌려 테스트 경로는 애초에 타입체크 ratchet 대상이 아니다). 이번 변경이 만들거나 악화시킨 것이
  아니므로 이 PR 의 스코프 밖으로 판단.
  - 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.spec.ts:10` (본 PR 비대상 파일)
  - 제안: 별도 트래커 항목으로 등재할 사안이며 이 PR 의 병합을 막을 사유는 아니다.

- **[INFO][SPEC-DRIFT 아님 — 이미 추적됨]** `spec/5-system/15-chat-channel.md` §7 파일 트리의
  `chat-channel-input-rules.ts # 입력 검증·변환 순수 함수` 서술이, 이 파일이 실제로 담고 있는
  출력측 함수(`translateSetupChannelError`)를 여전히 언급하지 않는다.
  - 위치: `spec/5-system/15-chat-channel.md:544` (§7 파일 트리)
  - 상세: 이 파일은 이번 PR 이전부터 `translateSetupChannelError` 를 갖고 있었으므로 이 PR 이 만든
    새 drift 가 아니다. `chat-channel-input-rules.ts` 헤더 주석(34~39행)이 "입력만 있는 파일이
    아니다" 라고 명시적으로 인정하면서도, §7 문서 자체는 developer 권한 밖(파일 트리 결정은
    planner 축)이라 의도적으로 건드리지 않았다 — `plan/in-progress/chat-channel-rules-cleanup.md`
    설계 판단 (2)와 같은 세션의 `--impl-prep` `plan_coherence.md` 발견사항 2번이 이미 이 사실을
    기록하고 짝 트래커 항목(`spec-draft-nullable-notation-followups.md` L2964)으로 넘겨 두었다.
    코드가 틀린 것도 아니고 이미 등재된 사안이라 이 리뷰에서 새 조치를 요구하지 않는다.
  - 제안: 조치 불요 — 다음 planner 턴이 §7 문구를 갱신할 때 반영.

## 교차 확인 — 일치·정상 확인한 항목 (요약)

- **동작 보존**: `throwInvalidField`/`hasField`/`rejectBlockedField` 3개 헬퍼로의 치환이 기존
  11개 `throw` 지점·2개 이중 캐스팅과 `details.field`/`details.code`/`message` 까지 글자 단위로
  동일함을 대조 확인. 필드 검사 순서(`botTokenRef`→`inboundSigningRef`→`inboundSigning`→
  `mode==='update'` 분기)도 보존됨.
- **DTO 응답 계약**: 신설 `ChatChannelRotateBotTokenDto`(`rotatedAt: string`, `triggerId: string`,
  `chatChannelHealth: TriggerChatChannelHealth`, `botIdentity: ChatChannelBotIdentityDto | null`)가
  `TriggersService.rotateBotToken()` 의 실제 반환 타입(`triggers.service.ts` 985행 부근 inline
  타입)과 필드명·타입이 정확히 일치. `TriggerChatChannelHealth = 'unknown'|'healthy'|'degraded'`
  와 `@ApiProperty({enum:[...]})` 도 일치.
- **`code:` glob 회귀 회피 확인**: `spec/5-system/15-chat-channel.md` frontmatter 의
  `codebase/backend/src/modules/triggers/dto/chat-channel-*.dto.ts` glob 에 신규 파일
  `dto/chat-channel-rotate-bot-token.dto.ts` 가 정확히 매칭됨을 직접 대조. 같은 세션의
  `rationale_continuity.md` 가 사전에 낸 WARNING(신규 DTO 가 `chat-channel-` 접두를 놓치면
  R-CC-22 가 세 번 실측으로 막으려던 결함이 4번째로 재발한다)을, 실제 구현이 파일명을
  `chat-channel-` 접두로 정확히 맞춰 예방했다 — 별도 조치 불요.
- **§5.4.1.2 provider 불변성/존재성 응답 계약**: `assertChatChannelAlreadySetUp` 의
  `details.field='chatChannel'`/`details.field='provider'` 가 spec 표(§5.4.1.2)와 정확히 일치.
- **`incoming.provider &&` falsy-guard 도달 불가 주장**: `ChatChannelUpdateConfigDto` 가
  `OmitType(ChatChannelConfigDto, ['botToken','inboundSigningPlaintext'])` 임을 직접 확인 —
  `provider` 의 `@IsString() @IsIn(CHAT_CHANNEL_PROVIDERS)` 가 상속되어 PATCH 에서도 필수라는
  주장이 타당. 신규 테스트(`trigger-dto-validation.spec.ts` "provider 가 %s 면 DTO 층에서
  거부된다")가 `CustomValidationPipe` 실제 파이프를 태워 이를 고정 — vacuous 아님, 실행 확인.
- **`CREDENTIAL_REJECTED_CODE`**: `'BOT_TOKEN_INVALID'` 로 정의돼 있어
  `translateSetupChannelError` 의 400 분기 서술과 일치.
- **`rotateBotToken` 컨트롤러 404/200 swagger 추가**: `TriggersService.findById` 가
  `NotFoundException({code:'RESOURCE_NOT_FOUND', ...})` 를 던지는 실제 경로가 있어
  `@ApiNotFoundResponse` 추가가 정당함을 확인.
- TODO/FIXME/HACK/XXX 주석 없음.

## 요약

리뷰 대상은 `chat-channel-input-rules.ts`/`.spec.ts` 의 순수 구조 정리(에러 봉투 헬퍼·이중 캐스팅
제거)와 테스트 보강, 그리고 `rotateBotToken` 응답의 신규 swagger DTO 추가다. 실측(전체 관련 jest
스위트 통과, `tsc --noEmit` 무오류)과 spec 대조(§5.4.1/§5.4.1.2/R-CC-21/R-CC-22) 결과 함수
시그니처·에러 코드·`details.field`·기본값·검증 순서·상태 전이 어디에도 line-level 불일치를 찾지
못했다. 특히 신규 DTO 파일이 R-CC-22 가 정한 `code:` glob 을 정확히 맞춰, 같은 세션 consistency
check 가 사전에 경고한 "4번째 재발" 위험을 실제로 피했다. 유일하게 남는 것은 이 PR 이전부터 있던
§7 파일 트리 wording drift(코드가 아니라 문서 쪽 문제이며, 이미 사람이 짝 트래커 항목으로 등재해
둔 상태)와 이 PR 과 무관한 baseline 타입체크 결함(INFO) 두 건뿐이며, 둘 다 이 PR 을 막을 사유가
아니다.

## 위험도

NONE
