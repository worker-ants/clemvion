# RESOLUTION — 16_17_57 (라운드 1)

**CRITICAL 1 · WARNING 3 — 전부 조치했다.** 네 건 모두 `codebase/**` 를 바꾸므로 §정지 규칙에
따라 **라운드 2 를 돈다**(그 규칙은 결과를 보기 전에 `plan/in-progress/chat-channel-rules-cleanup.md`
에 선언했다).

## 조치 항목

| # | 분류 | 조치 | 비고 |
|---|---|---|---|
| **C1** | 코드 (OpenAPI 스키마 오염) | 신규 클래스를 `ChatChannelBotIdentityDto` → **`ChatChannelRotateBotIdentityDto`** 로 개명 | `@nestjs/swagger` 는 스키마를 **클래스 `.name`** 으로 등록해 동명 둘이 서로를 덮어쓴다. **이 PR 이 만든 결함**이고, 하필 이 PR 이 닫으려던 항목(*"swagger 응답 문서화 잔여"*)의 자리다 |
| W1 | 코드 (문서가 실제보다 좁다) | `publicKey?: string` 추가 + **서비스 반환 타입을 `NonNullable<ChatChannelConfig['botIdentity']>` 로** | 근본 원인은 **형태를 두 번 적은 것**이다 — 손으로 적은 쪽에서 Discord 의 `publicKey` 가 빠졌다. 이제 한 곳만 본다 |
| W2 | 코드 (swagger 일관성) | `@ApiUnauthorizedResponse` 추가 | 같은 컨트롤러의 다른 8개 메서드가 전부 갖고 있었다 |
| W3 | 테스트 (설계 근거 미고정) | `assertPatchCarriesNoSecrets` 의 **`null`/`''`** 케이스 4건 | 아래 §뮤테이션 |

## 왜 C1 을 "합치기" 가 아니라 "개명" 으로 풀었나

두 자리는 **같은 값을 다른 계약으로** 본다 — config 쪽은 `@IsOptional`·`@IsInt` 가 붙은 **입력
검증** DTO(클라이언트가 보낼 수 있고 어댑터가 덮어쓴다)이고, 이쪽은 `rotateBotToken` 이 실제로
돌려주는 **응답** DTO(필수 `botId`·`username` + Slack `teamId` + Discord `publicKey`)다. 합치면
한쪽이 반드시 거짓말을 한다. 같은 판단의 **선례가 이 저장소에 있다** —
`TriggerWorkflowRefDto` vs `ScheduleTriggerWorkflowRefDto`(*"의도적으로 다르다 … 한쪽을 다른
쪽으로 갈아 끼우지 말 것"*).

**잔여 0 을 실측했다**: `codebase/backend/**/*.dto.ts` 의 `export class` **256개**를 전수
스캔해 동명 중복 **0건** 확인(스크립트로 셌다 — "고쳤다" 를 grep 없이 쓰지 않는다).

## 뮤테이션 — W3 이 막은 것

`hasField` 의 `typeof … !== 'undefined'` 를 **truthy 판별(`!!value`)로** 바꾸면:

- **조치 전**: 아무 테스트도 안 깨졌다 → `null`/`''` 로 보낸 비밀이 **두 층 모두 통과**한다.
  (`@IsEmpty()` 가 그 둘을 유효로 보기 때문에 DTO 층도 막지 않는다 — 그것이
  `chat-channel-rejection-messages.const.ts` 가 선언한 두-층 등가성 설계다.)
- **조치 후**: **14건 RED**.

## 이 라운드가 남긴 것 — 내 게이트의 사각지대

`--impl-prep` 의 naming_collision 은 **plan 이 예고한 이름만**(`throwInvalidField`·`hasField`)
grep 했다. C1 의 클래스명은 **구현 중에 태어나서** 그 검사의 대상이 아니었다. 사전 게이트는
"예고한 것" 만 보고, 사후 리뷰가 "실제로 태어난 것" 을 본다 — 그 비대칭을 트래커에 적는다.

## 이월 (INFO — 조치 불요)

- `rotateBotToken` 의 `:id` 에 `ParseUUIDPipe` 부재 (이 PR 이전부터, 스코프 밖 → 트래커)
- `response-contract` 런타임 배선 부재 (저장소 전역 갭 60중 4 배선, 이 PR 신규 결함 아님)
- `telegram-message.renderer.spec.ts` 의 baseline 타입 오류 1건 (ratchet 대상 밖, 무관)
- §7 파일 트리 서술 drift — 이미 트래커의 planner 항목

## TEST

- `run-test-all: ALL PASS` (lint · unit · build · e2e 305) — **조치 후** 재실행
- triggers 모듈 273 passed (조치 전 264 → 신규 9)
