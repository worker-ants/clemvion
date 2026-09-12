# 요구사항(Requirement) 리뷰 — chat-channel-input-rules 구조 정리 + 라운드 2 (16_39_18)

## 점검 방법

`Read`로 실제 소스를 직접 열어 확인(프롬프트가 `chat-channel-input-rules.ts` diff를 60/262줄에서
절단했고, 전체 파일 컨텍스트가 프롬프트에 실리지 않았기 때문). 대상: `chat-channel-input-rules.{ts,spec.ts}`,
`chat-channel-rejection-messages.const.ts`, `dto/chat-channel-config.dto.ts`,
`dto/chat-channel-rotate-bot-token.dto.ts`(신규), `dto/trigger-dto-validation.spec.ts`,
`triggers.controller.ts`, `triggers.service.ts`, `plan/in-progress/chat-channel-rules-cleanup.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md`, 이전 라운드 산출물
(`review/code/2026/09/12/16_17_57/**`, `review/consistency/2026/09/12/15_53_35/**`).

`spec/5-system/15-chat-channel.md`(§5.4·§5.4.1·§5.4.1.1·§5.4.1.2·§7·R-CC-21·R-CC-22·R-CC-23)와
`spec/conventions/swagger.md`(§2-4·§5-1)를 대조했다. 실측:

```
npx jest src/modules/triggers/chat-channel-input-rules.spec.ts src/modules/triggers/dto/trigger-dto-validation.spec.ts
  → 2 suites, 110 tests, all pass
npx jest src/modules/triggers  → 9 suites, 273 passed + 1 skipped
npx tsc -p tsconfig.build.json --noEmit  → 무출력(에러 없음)
```

이번 라운드는 직전 라운드(`16_17_57`)가 낸 CRITICAL 1 · WARNING 3 에 대한 `RESOLUTION.md`의 조치를
diff에 포함하므로, 그 조치가 실제로 spec/코드에 정합하게 반영됐는지를 핵심으로 검증했다.

## 발견사항

- **[INFO]** 직전 라운드 CRITICAL 1(신규 `ChatChannelBotIdentityDto`가 기존 동명 클래스와 이름 충돌 —
  OpenAPI 스키마 오염)이 올바르게 해소됐다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts:30`
    (`export class ChatChannelRotateBotIdentityDto`) vs
    `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:149`
    (`export class ChatChannelBotIdentityDto`) — 이름이 갈렸다.
  - 상세: `grep -rhoE '^export class [A-Za-z0-9_]+' --include=*.dto.ts src | sort | uniq -d` 로
    backend 전체 `*.dto.ts`의 `export class` 를 재실측 — 중복 0건. 두 DTO는 필드도 다르게 유지된다
    (config 쪽은 옵셔널 입력 검증용, rotate 쪽은 실제 응답 형태에 맞춘 필수 `botId`/`username` +
    Discord `publicKey`).
  - 상태: 조치 확인됨, 재발 없음.

- **[INFO]** 직전 라운드 WARNING 1(문서화된 응답이 실제 Discord 응답보다 좁음 — `publicKey` 누락)이
  근본 원인까지 해소됐다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:997`
    (`botIdentity: NonNullable<ChatChannelConfig['botIdentity']> | null`) +
    `dto/chat-channel-rotate-bot-token.dto.ts:55-56` (`publicKey?: string`)
  - 상세: 손으로 다시 적은 타입 대신 `ChatChannelConfig['botIdentity']`
    (`codebase/backend/src/modules/chat-channel/types.ts:55-61`: `botId: number; username: string;
    teamId?: string; publicKey?: string;`)를 그대로 참조하게 바꿔, DTO 필드 4종이 실제 반환 타입과
    구조적으로 100% 일치한다 — "형태를 두 번 적어서 한쪽이 stale해지는" 근본 패턴 자체를 제거했다.
  - 상태: 조치 확인됨(구조적으로 재발 불가능한 형태로 수정).

- **[INFO]** 직전 라운드 WARNING 2(`@ApiUnauthorizedResponse` 누락)·WARNING 3(두-층 등가성의 서비스
  측 미검증)도 확인됨.
  - 위치: `triggers.controller.ts` (`rotateBotToken` 데코레이터 블록에 `@ApiUnauthorizedResponse`
    추가), `chat-channel-input-rules.spec.ts:99-130`(`null`/`''` × `botToken`/`inboundSigningPlaintext`
    4개 `it.each` 케이스 추가).
  - 상세: `hasField`의 `typeof … !== 'undefined'` 판별을 falsy(`!value`)로 바꾸는 뮤턴트를 논리적으로
    추적하면, 새 케이스(`assertPatchCarriesNoSecrets(cfg({ botToken: null }))` 등)가 정확히 그 축을
    RED로 잡는 위치에 있다(`typeof null !== 'undefined'` → true(정상 차단) vs `!!null` → false
    (뮤턴트 시 차단 실패) — 테스트가 직접 그 결과를 단언).
  - 상태: 조치 확인됨.

- **[WARNING]** 신규 `chat-channel-rotate-bot-token.dto.ts`가 `spec/conventions/swagger.md §5-1`
  "응답 DTO 위치" 규약(`dto/responses/*-response.dto.ts`)을 위반한다 — 같은 모듈 안에
  그 규약을 정확히 따르는 선례(`dto/responses/trigger-response.dto.ts`)가 이미 있어 위반이 뚜렷하다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts:1`
    (경로 자체 — `dto/` 평평한 자리, 파일명도 `-response` 접미 없음) vs
    `spec/conventions/swagger.md:387` (`dto/responses/*-response.dto.ts`) vs 실재 선례
    `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`.
  - 상세: 이 위반은 **의도적**이고 **문서화**돼 있다 — 파일 헤더 주석(`:5-10`)이
    "`15-chat-channel.md`의 `code:` glob이 `dto/chat-channel-*.dto.ts`이고 `*`는 `/`를 넘지 않아
    `dto/responses/` 하위를 못 잡는다"는 것을 근거로 평평한 자리를 선택했다고 밝히고,
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(diff 파일 10, gate 3057-3066)에
    planner 항목 "응답 DTO의 `responses/` 관례가 `code:` glob과 충돌한다"로 이미 등재해 두었다.
    즉 두 spec 규약(R-CC-22 glob vs swagger §5-1 위치)이 **실제로 충돌**하고, developer 권한으로는
    어느 쪽도 고칠 수 없어(spec 편집은 planner 축) 한쪽을 의도적으로 어기고 사후 처리를 예약한
    상태다 — "코드가 틀림"도 "SPEC-DRIFT(spec이 낡음)"도 아니라 **두 규약이 서로 배치되는
    회색지대**에 가깝지만, 최종 산출물이 `swagger.md §5-1`을 위반하는 것 자체는 사실이라 WARNING으로
    남긴다.
  - 제안: 코드를 되돌리지 말 것(R-CC-22 위반이 더 크다 — 세 번 연속 실측된 결함 클래스). 이미 등재된
    planner 트래커 항목을 통해 (a) `code:` glob을 `dto/**/chat-channel-*.dto.ts`로 넓히거나 (b)
    chat-channel 응답 DTO는 평평한 자리를 공식 예외로 명문화 — 둘 중 하나로 `swagger.md §5-1`을
    갱신할 것.

- **[INFO]** `plan/in-progress/chat-channel-rules-cleanup.md`의 체크리스트(`## 체크리스트`)가 전부
  미체크(`[ ]`) 상태인데, 실측상 작업 1~6·뮤테이션 3종·`run-test-all` 4단계 상당 부분이 이미
  완료돼 있다(코드 반영 확인 + jest/tsc 그린 확인, 위 §점검 방법).
  - 위치: `plan/in-progress/chat-channel-rules-cleanup.md:92-100`
  - 상세: 프로젝트 관례상("체크박스 = 실제 상태") 완료된 항목은 그 즉시 체크해야 다음 세션이
    상태를 오판하지 않는다. 다만 지금은 `/ai-review` 라운드가 진행 중인 시점이라 마지막 몇 항목
    (`/ai-review` + `--impl-done`, 트래커 종결, `plan/complete/` 이동)은 아직 열려 있는 것이
    정상이다 — 완료된 1~6/뮤테이션/run-test-all 항목까지 미체크로 남아 있는 것만 지적한다.
  - 제안: 이번 라운드가 수렴하기 전에 완료된 항목부터 체크. 차단 사유는 아니다.

- **[INFO]** `chat-channel-input-rules.ts` 헤더 주석(§7 파일 트리가 이 파일을 "입력 검증·변환 순수
  함수"로만 서술하나 실제로는 `translateSetupChannelError`(출력측)도 포함)이 여전히 `spec/5-system/
  15-chat-channel.md:544`와 어긋난다 — 이는 이 PR이 새로 만든 drift가 아니라 §설계 판단 (2)에서
  "이번 턴에는 주석만 넓히고 파일 분리는 planner 축"으로 명시적으로 유보한 것이고, 직전 라운드
  `documentation.md` INFO#6·`consistency-check` `plan_coherence` INFO#3이 동일하게 이미 추적 중이다.
  - 위치: `spec/5-system/15-chat-channel.md:544` vs `chat-channel-input-rules.ts:34-39`(헤더),
    `:329`(`translateSetupChannelError`)
  - 상태: 조치 불요(이미 planner 항목으로 등재, `spec-draft-nullable-notation-followups.md` L2964
    상당).

## 확인했으나 문제 없음

- `assertChatChannelInputSafe`의 오버로드 2종 + 구현 시그니처가 `mode`와 DTO 타입을 컴파일 타임에
  묶는 설계를 그대로 유지 — `as never` 제거 후에도 오버로드 해석이 정상 동작함을 `tsc --noEmit`
  무오류로 확인.
- `triggers.controller.ts`의 신규 `@ApiBadRequestResponse`/`@ApiBadGatewayResponse`/
  `@ApiNotFoundResponse`/`@ApiOkWrappedResponse` 설명 문구가 `spec/5-system/15-chat-channel.md:355-365`
  의 실패 응답 표(`RESOURCE_NOT_FOUND`·`INVALID_BOT_TOKEN`·`CHAT_CHANNEL_NOT_CONFIGURED`·
  `CHAT_CHANNEL_PROVIDER_UNKNOWN`·`CHAT_CHANNEL_ENDPOINT_REQUIRED`·`BOT_TOKEN_INVALID`·
  `CHAT_CHANNEL_SETUP_FAILED`) 및 `triggers.service.ts`의 실제 `throw` 코드와 문자 그대로 일치.
- `ChatChannelRotateBotTokenDto`의 필드 4종(`rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity`)
  이 `spec/5-system/15-chat-channel.md:342-349`의 성공 응답 예시·`TriggerChatChannelHealth`
  (`'unknown'|'healthy'|'degraded'`) enum과 정확히 일치.
- `OmitType(ChatChannelConfigDto, ['botToken','inboundSigningPlaintext'])`이 `provider`의
  `@IsString() @IsIn(...)`을 상속함을 실제 코드로 확인 — §설계 판단 (3)의 "PATCH에서도 provider
  필수, 따라서 `incoming.provider &&` falsy-guard는 HTTP 경로에서 도달 불가"라는 주장이 근거를
  갖는다. `trigger-dto-validation.spec.ts:814-822`(신규)가 그 도달 불가 주장을 실제로 테스트로
  고정하고 있어 vacuous하지 않다.
- `chat-channel-rejection-messages.const.ts:8-10`, `dto/chat-channel-config.dto.ts:36-37,283-284`의
  stale `TriggersService` 귀속 주석 정정 — `triggers.service.ts`에서 실제로 module-level 함수
  (`chat-channel-input-rules.ts`)를 import해 호출만 하는 현재 구조와 부합.
  `assertInboundSigningPlaintextByProvider`도 `dto/chat-channel-config.dto.ts:36-37`이 새로 가리키는
  이름 그대로 존재.
- `spec/5-system/15-chat-channel.md` frontmatter `code:`의 `dto/chat-channel-*.dto.ts` glob이 신규
  파일명(`chat-channel-rotate-bot-token.dto.ts`)과 실제로 매칭됨(R-CC-22 준수 — glob 접두 조건은
  지켰다. 단, 디렉터리 위치 자체는 위 WARNING 참조).
- TODO/FIXME/HACK/XXX 계열 미완성 표식 — `git diff origin/main...HEAD`의 `triggers/` 트리 추가분에
  0건.
- `run-test-all` 상당(unit: jest, build: tsc)이 diff 반영 후에도 그린 — 순수 리팩터(응답 형태
  무변경) 주장이 실측으로 뒷받침됨.

## 요약

직전 라운드(`16_17_57`)의 CRITICAL 1건(DTO 클래스명 충돌)·WARNING 3건(응답-문서 간극, 401 문서
누락, 두-층 등가성 서비스측 미검증)이 모두 근본 원인 수준까지 해소됐음을 코드 열람과 jest/tsc
실행으로 직접 확인했다. `rotateBotToken`의 신규 swagger 응답(DTO 필드·에러 코드·200 봉투)이
`spec/5-system/15-chat-channel.md §5.4`와 필드 하나까지 일치하고, PATCH의 `provider` 불변성
falsy-guard의 "도달 불가" 주장도 신규 DTO 테스트로 뒷받침돼 vacuous하지 않다. 유일한 신규 지적은
`chat-channel-rotate-bot-token.dto.ts`의 파일 위치가 `swagger.md §5-1`(`dto/responses/*-response.dto.ts`)
을 어기는 것인데, 이는 R-CC-22 glob과의 실제 충돌을 developer가 이미 문서화하고 planner 트래커에
등재해 둔 상태라 차단 사유는 아니다. plan 체크리스트가 완료된 작업 대비 미체크 상태인 점은 절차상
사소한 지적(INFO)이다.

## 위험도
LOW
