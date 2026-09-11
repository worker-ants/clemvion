---
title: chat-channel 도메인 규칙을 TriggersService 에서 떼어낸다 — 검증(의존 0) + secret 쓰기(협력자)
status: in-progress
owner: developer
worktree: .claude/worktrees/impl-chat-channel-binder-9d3f1e
started: 2026-09-11
spec_impact: none
---

## 왜 이 턴인가

트래커의 *"chat-channel 도메인 규칙이 제네릭 `TriggersService` 에 계속 쌓인다"* 항목
(`/ai-review` `review/code/2026/09/11/01_52_59` `architecture` W2 — 기존 「함수 비대」의
**모듈 경계 관점**). `#1317` 에서 **의도적으로 갈라 둔** 마지막 항목이다: 그 PR 이 13개 throw
자리를 **고쳤고** 이 PR 은 같은 자리를 **옮긴다** — 한 diff 에 섞으면 리뷰가 동작 델타를 분리할
수 없다.

**그래서 이 PR 의 주장은 하나다 — 동작 보존.** 그것을 증명 가능한 형태로 만드는 것이 설계 제약이다.

## 방향이 실측으로 뒤집혀 있다 (선행 확인)

원 지적은 *"`chat-channel/` 하위에 adapter 계층이 따로 있는데 검증·secret 쓰기·ref 보존 규칙은
triggers 쪽에 남아 경계가 어긋난다"* 였다. 그대로 읽으면 **`chat-channel/` 로 옮기는** 것인데,
**그러면 `#676`(`e827ed2a7`) 이 끊은 순환이 되살아난다**:

- `triggers.module.ts` 주석: *"C-2: chat-channel→triggers 역방향 의존 2곳을 triggers 로 이전해
  제거 → forwardRef → 일반 import, chat-channel↔triggers 순환 해소"*
- 실측: 두 모듈에 잔존 `forwardRef` **0건**.

→ 추출은 **`triggers/` 안의 협력자**여야 한다. (트래커에 이 정정을 각주로 남겨 뒀다.)

## 실측 — 무엇이 옮겨질 수 있는지는 **의존 방향**이 정한다

`TriggersService` **1,881줄** 중 chat-channel 관련이 **744줄**이다. 각 대상이 쓰는 `this.*` 를
전수로 재니 **두 계층으로 깨끗하게 갈린다**:

| 계층 | 메서드 | 외부 `this.*` 의존 |
|---|---|---|
| **T1 — 검증·변환** | `assertChatChannelInputSafe`(+overload 2) · `assertPatchCarriesNoSecrets` · `assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext` · `assertInboundSigningPlaintextByProvider` · `translateSetupChannelError` | **0개** — 입력의 순수 함수다 |
| **T2 — secret 쓰기·ref 보존** | `setupChatChannel` · `teardownChatChannel` | **6개** — `channelAdapterRegistry` · `channelListenerRegistry` · `secrets` · `triggerRepository` · `logger` · `buildCallbackUrl` |

T1 = **342줄**(비주석 213). T2 = 212줄.

**남기는 것**: `rotateBotToken`(143) · `cleanupRotatedChatChannelTokens`(54) ·
`tryRevokeOldBotToken`(21). 이들은 **엔드포인트 오케스트레이션**이다 — repo·audit·BullMQ 큐를
함께 쓰고, 지적 문면(*"검증·secret 쓰기·ref 보존"*)의 대상이 아니다. 옮기면 audit/queue 협력자
까지 끌고 가 diff 가 배가된다.

## 설계 — 계층마다 **증명 방식**이 다르다

### T1 → 순수 함수 모듈 (`chat-channel-input-rules.ts`), **DI 없음**

의존이 0이므로 Nest provider 로 만들 이유가 없다. `export function` 로 빼고
`TriggersService` 가 import 해 호출한다.

> **증명**: 테스트 파일을 **한 줄도 고치지 않는다.** provider 등록이 없으니 3개
> `createTestingModule` 블록도 그대로다. 9,568개가 무편집으로 통과하면 그것이 순수 이동의
> 가장 강한 증거다.

### T2 → Nest provider (`ChatChannelBinderService`), `triggers/` 안

repo·registry 를 실제로 쓰므로 협력자 주입이 맞고, 이 저장소의 idiom 이다(`chat-channel/` 도
provider 로 구성돼 있다).

> **증명**: 테스트의 **단언은 한 줄도 안 바뀐다.** 바뀌는 것은 3개 `createTestingModule` 의
> **provider 등록**뿐이다 — 등록 추가는 단언 변경이 아니다. 그 구분을 커밋 본문에 적는다.

**두 계층을 별 커밋으로 낸다** — T1 은 *"테스트 무편집"*, T2 는 *"단언 무변경"* 이라 **증거의
강도가 다르다.** 한 커밋에 섞으면 약한 쪽으로 뭉개진다.

## 위험 — 이 표면에서 `#1314` 가 CRITICAL 을 맞았다

`setupChatChannel` 은 `#1314` 에서 리뷰어 **3명이 독립으로** CRITICAL 을 찾은 자리다(D-2
게이팅이 `inboundSigningRef` 의 포함 조건을 구조적으로 항상 거짓으로 만들어 인입 웹훅이
**fail-open**). 그 함수의 `// [쓰기 ①/②/③]` 앵커 주석과 `inboundSigningRefSurvives` 판정은
**그 사고의 산물**이다 — 옮길 때 **주석까지 그대로** 옮긴다. 주석을 정리하고 싶은 충동이
정확히 그 사고를 되돌리는 경로다.

## `--impl-prep` 이 설계를 바꿨다 (`review/consistency/2026/09/11/14_59_33`, **BLOCK: NO**)

CRITICAL 0 · WARNING 5. **WARNING 1·2 가 내가 고려하지 않은 제약을 짚었다**: 이동이 spec 의
**귀속 서술**을 stale 하게 만드는데 **developer 는 `spec/` 쓰기 권한이 없다**(자기-반증형 소정정
조건 1 불성립 — 그 문장들은 이전 planner 턴이 썼다).

### 전수 실측 — 귀속이 깨끗하게 갈린다

| 심볼 | spec 귀속 자리 |
|---|---|
| `assertChatChannelInputSafe` · `assertPatchCarriesNoSecrets` · `assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext` · `translateSetupChannelError` · `teardownChatChannel` · `buildCallbackUrl` | **0곳** |
| `assertInboundSigningPlaintextByProvider` | **5곳** (`slack.md:275` · `discord.md:297` · `2-trigger-list.md:155` · `discord.md:76` · `15-chat-channel.md:432`) |
| `setupChatChannel` | **9곳** (`15-chat-channel.md` 2 · `secret-store.md` 3 · `chat-channel-adapter.md:369` · `data-flow/14-chat-channel.md` 3) |

### ~~처방 — 문서화된 진입점 2개는 **얇은 delegator** 로 남긴다~~ **← 철회됨**

> ~~로직은 옮기고, `TriggersService.setupChatChannel` ·
> `TriggersService.assertInboundSigningPlaintextByProvider` 는 **한 줄 위임 메서드로 남긴다.**
> 그 14개 spec 문장은 *"그 진입점이 무엇을 하는가"* 를 서술하므로 **위임 뒤에도 전부 참이다** —
> drift 가 **0** 이다.~~

**구현 중 이 처방이 틀렸음이 드러났다 (2026-09-11).** `assertInboundSigningPlaintextByProvider`
의 **호출부도 함께 옮겨졌다** — 부르던 것이 `assertChatChannelInputSafe` 였고 그것도 이동
대상이었다. 그래서 delegator 를 남기면 **아무도 부르지 않는 메서드**가 되고, 그것은
*"문서를 문자적으로 참으로 만들기 위한 잔재"* 다. 린트도 미사용으로 잡는다.

### 실제 결정 — delegator 를 남기지 않는다. drift 는 **0 이 아니라 2곳**이다

| | 상태 |
|---|---|
| 옮긴 6개 중 **5개** | spec 귀속 **0곳** → drift 없음 |
| `assertInboundSigningPlaintextByProvider` | `slack.md:275` · `discord.md:297` 의 **`TriggersService.X` 표기가 부정확**해진다 (나머지 3곳은 클래스 접두 없이 함수명만 인용 → 여전히 참) |
| `setupChatChannel` (9곳) | 이 PR 이 **안 옮긴다** → 영향 없음 |

**실질은 여전히 참이다** — `TriggersService` 가 그 규칙을 호출하고 생성 시점에 검증한다.
부정확한 것은 **심볼 경로**뿐이다. planner 턴 대상으로 **durable 트래커에 등재했다**
(`spec-draft-nullable-notation-followups.md` — 이 plan 은 `complete/` 로 봉인되므로 여기 적는
것만으로는 유실된다).

> **`spec_impact` 는 `none` 을 유지한다.** 이 PR 은 **spec 을 한 줄도 바꾸지 않는다** — 편집하지
> 않는 파일을 `spec_impact` 에 적으면 그 목록이 거짓이 된다(`#1316` 에서 같은 판단을 했다).
> drift 는 `spec_impact` 가 아니라 **트래커**가 추적할 일이다.

**대안을 기각한 이유**:
- *"옮기고 spec 을 나중에 고친다"* — 머지되는 순간 **14개 SoT 문장이 거짓**이 된다. 내가 그것을
  **알면서** 만드는 것은 「문서가 구현과 어긋난다」를 스스로 심는 것이다.
- *"planner PR 을 먼저 내 귀속을 구현-무관하게 고친다"* — 가능하지만 PR 3개가 되고, 그 문장들은
  **코드 포인터로서 값이 있다**(`code:` frontmatter 와 같은 역할). 없애는 것이 개선이 아니다.

### 나머지 WARNING 처분

- **W3**(신규 에러코드 6종 카탈로그 미등재) · **W4**(`code:` frontmatter gap) — **planner 사안**
  이고 이 리팩터와 무관한 **기존** 갭이다. 트래커에 등재(W4 는 이미 등재돼 있다).
- **W5** — 트래커의 두 열린 항목(동시 PATCH lost-update · `setupChatChannel` 관심사 분해)이
  참조하는 **코드 위치가 이동한다** → 종결 시 그 두 항목의 위치 서술을 갱신한다.
- **INFO 3** — `buildCallbackUrl` 은 잔류하는 `rotateBotToken` 과도 공유된다(실측). 따라서
  **옮기지 않고** T2 협력자에 **주입**한다.
- **INFO 4** — T1 파일 docstring 에 `@workflow/chat-channel-validation`(정규식 SoT)과의 역할
  차이를 적는다.

## 계획

1. `--impl-prep` BLOCK: NO 확인
2. **T1**: 순수 함수 모듈로 이동 → 4단계. **테스트 diff 0줄 확인**
3. **T2**: provider 추출 → 4단계. **단언 diff 0줄 확인**(등록만 변경)
4. 뮤테이션: 옮긴 가드를 하나씩 제거해 **이동 전과 같은 테스트가 RED** 인지 — 이동이 커버리지를
   옮기지 않았음을 본다
5. `/ai-review` + `--impl-done`

## 정지 규칙 (결과를 보기 **전**에 선언)

- 종료 조건은 *"발견 0"* 이 아니라 **`codebase/**` 수정 0 으로 끝나는 라운드**.
- **동작 델타 지적이 오면 그것은 최우선이다** — 이 PR 의 유일한 주장이 동작 보존이므로,
  그 지적 하나가 PR 의 전제를 깬다. 라운드 수를 아끼지 않는다.
- 구조·문서 지적은 `codebase/**` 인 것만 그 라운드에 고치고, 주석 정리류는 후속 등재.
- **최대 3라운드.** 넘기면 사용자에게 보고한다 — 직전 턴에서 한 번 넘겼고 그것을 기본값으로
  만들지 않는다.

## 체크리스트

- [x] `/consistency-check --impl-prep` **BLOCK: NO** (`14_59_33`)
- [x] T1 이동 + **테스트 diff 0줄** 확인 (`git diff --numstat -- '*.spec.ts'` = 0)
- [ ] ~~T2 이동~~ — **이 PR 범위 밖**. 트래커에 이미 별 항목으로 있다
- [x] 뮤테이션 **5/5 RED** — 옮긴 가드 무력화 시 이동 전과 같은 테스트가 RED
- [x] `run-test.sh` 4단계 GREEN (backend 9,568 · e2e 305 + playwright 51 · ratchet 197/52)
- [ ] `/ai-review` + `--impl-done`
- [ ] 트래커 *"chat-channel 도메인 규칙이 …"* 항목 종결 (남긴 3메서드는 사유와 함께 명시)
- [ ] `plan/complete/` 이동
