---
title: T2 — chat-channel secret 쓰기·ref 보존을 ChatChannelBinderService 로 뺀다
status: in-progress
owner: developer
worktree: .claude/worktrees/impl-chat-channel-binder-t2-7e9b70
started: 2026-09-11
spec_impact: none
---

## 왜 이 턴인가

트래커 *"chat-channel 도메인 규칙이 제네릭 `TriggersService` 에 계속 쌓인다"* 항목의 **T2**.
`#1319`(T1)가 **의존 0 계층**(순수 검증 함수 6개)만 내고 이 계층을 **명시적으로 이월**했다.
증거의 강도가 달라서 갈랐다 — T1 은 *"테스트 파일 **무편집**"*, T2 는 *"**단언** diff 0줄"* 이다.
한 커밋에 섞으면 약한 쪽으로 뭉개진다.

`spec_impact: none` — spec 을 한 줄도 바꾸지 않는다. 순수 이동이다.

## 착수 전 재판정 — **이월된 처방의 정량 전제 하나가 틀렸다**

`#1319` 가 남긴 처방을 그대로 집행하기 전에 지금 코드로 다시 쟀다
(*"유예 근거는 실측해야 한다"* — 이월 처방도 유예 근거다).

| 처방이 말한 것 | 실측 (`ba634a4b0`) | 판정 |
|---|---|---|
| T2 대상 2메서드 · 212줄 | `setupChatChannel` 191 + `teardownChatChannel` 21 = **212** | ✅ 그대로 |
| 외부 `this.*` **6개** | **6개 맞다 — 그런데 성격이 3갈래다**(아래) | ⚠️ 수 맞음, 설계 함의 누락 |
| 바뀌는 것은 **3개** `createTestingModule` 의 provider 등록 | **14블록 전부** — 등록 줄로는 **10줄** | ❌ **틀렸다** |

### 이 칸을 나도 한 번 틀렸다 — **헬퍼 간접**을 두 번 중 한 번만 봤다

처음엔 *"9블록"* 이라고 쟀다. `createTestingModule` 블록 **본문**에 `TriggersService` 가
문자로 있는 것만 셌기 때문이다. 실제로는:

| 경로 | 블록 수 | 필요한 등록 줄 |
|---|---|---|
| 블록 본문이 직접 나열 | 8 | 8 |
| `createBaseProviders()` **헬퍼** 경유 (`triggers.service.spec.ts`) | 5 | **1** (헬퍼 한 곳) |
| `otherProviders()` 헬퍼 경유 (`triggers.web-chat.spec.ts`) | 1 | 1 |
| **계** | **14** | **10** |

web-chat 의 헬퍼 간접은 알아채고 적었으면서 **같은 파일 안의 `createBaseProviders()` 는 못 봤다.**
*"좁다고 지적받으면 한 칸 넓히지 말고 방법을 바꿔라"* 가 이것이다 — 한 번 걸린 함정을 "그 파일
한정" 으로 처리하고 클래스로 일반화하지 않았다. 옳은 방법은 블록 텍스트 grep 이 아니라
**`.compile()` 로 만들어진 모듈이 `TriggersService` 를 실제로 resolve 하는가**다.

다행히 **14블록 전부 필요한 mock 을 이미 갖고 있어** 결론은 안 바뀐다(`ChannelAdapterRegistry` ·
`ChannelListenerRegistry` · `SecretResolverService` · `ConfigService` ·
`getRepositoryToken(Trigger)`). 즉 **증거 방식은 유지되고 규모만 3배**다.

**실측 결과 — `*.spec.ts` diff 는 `+12 / -0`** 이고 12줄 전부 import 2 + provider 등록 10 이다.
단언이 안 바뀐 정도가 아니라 **삭제가 한 줄도 없다.**

### `this.*` 6개는 세 갈래다 — 처방이 뭉뚱그렸다

| 갈래 | 심볼 | 이동 방식 |
|---|---|---|
| **주입 4** | `triggerRepository` · `channelAdapterRegistry` · `channelListenerRegistry` · `secrets` | 새 provider 생성자로 그대로 주입 |
| **자체 logger 1** | `logger` (`new Logger(TriggersService.name)`) | 새 서비스가 **자기 이름으로** 갖는다 (자매 선례 `chat-channel-token-rotator.service.ts`) |
| **클래스 내부 private 1** | `buildCallbackUrl` | **동반 이동 불가** — 아래 |

## 막힌 지점 — `buildCallbackUrl` 은 이동 대상과 **잔류 대상이 공유**한다

| 호출부 | 줄 | 이번 이동 |
|---|---|---|
| `setupChatChannel` | 862 | **이동** |
| `rotateBotToken` | 1286 | **잔류** |

잔류 판정도 다시 실측해 확인했다 — `rotateBotToken` 은 `this.findById` · `this.recordAudit` 를
쓰는 **엔드포인트 오케스트레이션**이라 옮기면 audit 협력자까지 끌고 간다.

`/api/hooks/` URL 을 조립하는 자리는 backend 전체에서 **`triggers.service.ts:1349` 단 하나**다
(전수 grep — 나머지 매치는 라우트 prefix 상수·CORS·주석·테스트 기대값). 즉 **지금은 SoT 가
하나**이고, 이동이 그것을 둘로 쪼개면 안 된다.

### 결정 — 순수 함수로 뽑는다 (T1 이 세운 idiom)

```
buildTriggerCallbackUrl({ baseUrl, endpointPath }): string
```

> **이 스케치는 착수 시점 판본이 아니다 — 1라운드에서 바꿨다.** 처음엔 위치 인자
> `(baseUrl, endpointPath)` 로 냈는데 `/ai-review` `review/code/2026/09/11/18_04_36` W1 이
> 인자 순서 표면을 지적해 **이름 인자**로 고쳤다. 사유·실측은 그 세션의 `RESOLUTION.md` 에 있다.

- 의존 0 → Nest provider 로 만들 이유가 없다. **T1 과 같은 판정 기준**이다.
- 기본값(`http://localhost:3011`) 도 이 함수 안에 둔다 → 호출부는 각 한 줄
  (`buildTriggerCallbackUrl(this.configService.get('app.url'), path)`), **URL 형태도 fallback 도
  한 자리**.
- 이름이 정직하다 — 이 URL 은 chat-channel 전용이 아니라 **트리거 webhook** 의 것이다.
  (현재 호출부 둘이 모두 chat-channel 이라고 해서 binder 소유로 만들면 이름이 사실보다 좁아진다.)

#### `--impl-prep` 이 잡은 것 — 같은 개념의 기존 단일 표준이 **이미 있다** (W4)

`common/utils/app-base-url.ts` 의 `getAppBaseUrl()` 이 스스로 *"APP_URL 의 **단일 표준**
fallback"* 이라고 선언하고 있다(옛 6곳 중복을 없애며 만들어진 것, W-28). 내 전수 grep 은
`/api/hooks/` **경로 조립**만 찾아서 이걸 못 봤다 — *"넓이가 기준이 아니라 어느 층을
서술하나를 물어라"* 에 다시 걸렸다. **찾은 축(경로)과 놓친 축(base URL fallback)이 다르다.**

**그런데 통합은 이 PR 이 할 일이 아니다 — 소스가 다르다**:

| | 읽는 곳 | 기본값 |
|---|---|---|
| `getAppBaseUrl()` | `process.env.APP_URL` **직접** | `http://localhost:3011` |
| `buildCallbackUrl` | `configService.get('app.url')` | `http://localhost:3011` |

`getAppBaseUrl()` 로 갈아끼우면 **9개 테스트 모듈이 `ConfigService` mock 으로 쥐고 있던
통제권이 사라진다**(예: `triggers.service.spec.ts` 가 `'https://workflow-api.getit.co.kr'` 를
주입해 단언한다). 그것은 순수 이동이 아니라 **DI 변경**이다 → 통합은 후속 등재.

**부수 실측 — 이 PR 이 옮기는 `??` fallback 은 프로덕션에선 이미 죽어 있다.**
`common/config/app.config.ts:57` 이 `process.env.APP_URL || 'http://localhost:3011'` 로
**이미 기본값을 박아** `app.url` 을 만든다. 즉 `configService.get('app.url')` 은 실제 구동에서
`undefined` 가 될 수 없고, `?? 'http://localhost:3011'` 는 **ConfigService 가 mock 일 때만**
발화한다. 그 경로를 고정하는 캐너리가 실재한다(`triggers.service.spec.ts` 의
*"app.url 이 undefined 이면 fallback"*). **그래서 지우지 않고 그대로 옮기고, 이 사실을
docstring 에 싣는다** — 안 적으면 다음 사람이 "죽은 코드" 로 보고 지운 뒤 그 테스트만 깨진다.

**기각한 대안 3가지 — 왜 아닌지를 남긴다**:

| 대안 | 기각 사유 |
|---|---|
| binder 가 `buildCallbackUrl` 을 **public 으로 소유**하고 `rotateBotToken` 이 호출 | 헬퍼 하나 때문에 binder 의 **공개 표면**이 넓어진다 (T1 리뷰 INFO 7 이 이미 캡슐화를 지적했다). 이름도 실제보다 좁아진다 |
| 호출자가 `callbackUrl` 을 **인자로** 넘긴다 | `endpointPath` 부재 가드(`CHAT_CHANNEL_ENDPOINT_REQUIRED`)가 URL 조립 **직전**에 있다. 조립을 호출자로 올리면 그 가드와 사용처가 갈라져 **순서가 동작의 일부가 된다** — 순수 이동이라는 주장이 깨진다 |
| 양쪽이 각자 private 사본을 갖는다 | **SoT 를 둘로 쪼갠다.** 반복 결함 클래스다(한쪽만 고치는 사고) |

## 설계

### 새 파일 2개

1. `modules/triggers/trigger-callback-url.ts` — 순수 함수 1개(**이름 인자**) + 근거 docstring
   + 직접 spec 7케이스.
2. `modules/triggers/chat-channel-binder.service.ts` — `@Injectable() ChatChannelBinderService`.
   - 생성자: `@InjectRepository(Trigger)` · `ChannelAdapterRegistry` · `ChannelListenerRegistry` ·
     `SecretResolverService` · `ConfigService`.
   - 공개 메서드 **2개만**: `setupChatChannel(...)` · `teardownChatChannel(...)`
     (지금의 private 시그니처 그대로 — 호출자 3곳이 `this.chatChannelBinder.X(...)` 로만 바뀐다).

### 로그 문자열은 **건드리지 않는다**

옮기는 본문의 경고 4개가 `` `TriggersService: …` `` 리터럴로 시작한다. logger **컨텍스트**는
새 클래스 이름이 되지만 **메시지 리터럴은 그대로 둔다** — 바꾸면 관측 가능한 출력이 달라져
*"동작 보존"* 주장이 약해진다. 문구 정정은 후속으로 등재한다.
(실측: 이 리터럴을 단언하는 테스트는 **0건**이라 어느 쪽이든 GREEN 이다 — 그래서 더더욱
테스트가 아니라 **주장의 일관성**으로 정한다.)

## 증거 — T2 의 주장은 *"단언 diff 0줄"*

`git diff` 에서 `*.spec.ts` 의 변경이 **provider 등록 9줄뿐**임을 보인다. 단언(`expect`) 줄이
하나도 안 바뀌는 것이 이 PR 의 핵심 증거다. 등록 추가는 단언 변경이 아니다.

추가로 **뮤테이션**: 옮긴 본문의 가드·분기를 무력화하면 이동 **전과 같은** 테스트가 RED 여야
한다. 대상은 최소 3곳 — `storeUserSuppliedSecrets` 게이팅 / `inboundSigningRefSurvives` 술어 /
실패 경로의 `fallbackConfig`. (**GREEN 은 증거가 아니다.**)

## 순서

1. `--impl-prep` BLOCK: NO 확인
2. `trigger-callback-url.ts` 신설 + 두 호출부 교체 → 4단계 (여기까지는 이동 아님)
3. `chat-channel-binder.service.ts` 신설 + 두 메서드 이동 + 호출부 3곳 + `TriggersModule` 등록
   + 테스트 provider 9줄 → 4단계 + **단언 diff 0줄 실측**
4. 뮤테이션 RED 확인
5. `/ai-review` + `--impl-done` → push → PR

## `--impl-prep` 결과 — **BLOCK: NO** (`review/consistency/2026/09/11/17_39_32`)

5 checker 전원 성공 · CRITICAL **0** · WARNING 4 · INFO 4. 위험도 MEDIUM 사유는
*"W1·W2 가 이 diff 자체가 만드는 결과인데 plan 이 아직 인수하지 않았다"* — 인수한다.

| # | 지적 | 이 턴의 처분 |
|---|---|---|
| W1 | 신규 2파일이 `15-chat-channel.md` frontmatter `code:` 에 자동 등재 안 됨 (T1 이 만든 같은 갭의 재발, 3라운드 연속 관측) | `spec/` 쓰기라 **planner 항목**. 기존 트래커 항목의 대상 수를 6 → **8** 로 갱신 + *"glob 전환으로 재발 차단"* 대안 병기 |
| W2 | `secret-store.md:146` · `chat-channel-adapter.md:369` · `data-flow/14-chat-channel.md:29` 가 `setupChatChannel` 을 `TriggersService`/`triggers.service.ts` 소유로 **현재형** 서술 | **내 사전 열거와 정확히 같은 3곳**이다. planner 항목으로 등재 — T1 이 `assertInboundSigningPlaintextByProvider` 에 쓴 절차를 그대로 반복 |
| W3 | `rotate-bot-token` 엔드포인트에 OpenAPI 데코레이터가 **전무**(형제 `revokePerTriggerToken` 은 갖춤) | **사전 존재 갭 · T2 범위 밖.** developer 항목으로 등재 |
| W4 | `getAppBaseUrl()` 과 개념 중복 | 위 §설계에 실측과 함께 반영 — 통합은 후속 등재, docstring 에 포인터 |
| INFO 1 | `15-chat-channel.md §7` 구현 파일 구조에 신규 파일 미반영 | **거짓이 아니라 누락**이다 — `triggers.service.ts` 행은 *"…호출 추가"* 라 이동 후에도 참이다. 이미 T1 의 `chat-channel-input-rules.ts` 부터 빠져 있다 → W1 과 한 항목으로 병기 |
| INFO 3 | lost-update 후속 항목이 `TriggersService` **내부** 호출을 전제 | T2 완료 시 그 항목에 *"호출이 서비스 경계를 건넌다"* 각주 |
| INFO 2·4 | `readOnly` 표기 / 명명 적합 확인 | INFO 4 는 조치 불요(내 grep 0건과 일치). INFO 2 는 기존 항목에 합류 |

## 체크리스트

- [x] `/consistency-check --impl-prep` **BLOCK: NO** (`17_39_32`)
- [ ] `--impl-prep` W1~W4 후속 등재 (planner 3건 · developer 2건)
- [x] `trigger-callback-url.ts` 추출 + 호출부 2곳 — 트리거 단위 **246 passed**, ratchet 일치
- [x] `ChatChannelBinderService` 이동 + 호출부 3곳 + module 등록 + 테스트 provider **10줄**
      (14블록을 덮는다) — 이동 후에도 **246 passed** (이동 전과 같은 수)
- [x] **단언 diff 0줄** 실측 — `*.spec.ts` 는 `+12 / -0`, 전부 import 2 + provider 등록 10
- [x] 뮤테이션 **3/3 RED** — 예측을 먼저 적고 실행했다(게이팅 · `inboundSigningRefSurvives`
      술어 · 실패 경로 `fallbackConfig`)
- [x] `/ai-review` 1라운드 (`18_04_36`, `--route=all` 14/14) **CRITICAL 0** · WARNING 4 →
      W1·W2 해소, W3 부분 해소, W4 는 마무리 단계 확인 항목으로.
      `RESOLUTION.md` 작성. 신규 테스트의 뮤턴트 **5/5 RED**
- [x] `/ai-review` 2라운드 (`18_42_05`) **CRITICAL 0** · WARNING 3 · RISK **LOW**(MEDIUM 에서
      내려왔다). 선언해 둔 정지 규칙에 따라 **3라운드로 간다** — W1·W2 가 `codebase/**` 수정을
      요구했다. W1 은 **직접 재현**해 타입도 테스트도 못 잡는 진짜 갭임을 확인(1라운드 W1 과
      반대). INFO 7·8 도 **내가 이번에 쓴 코드**라 같은 커밋에서 고쳤다
- [ ] `/ai-review` 3라운드 — 정지 규칙은 위와 동일(`codebase/**` 수정 0 으로 끝나면 종결)
- [ ] `run-test.sh` 4단계 GREEN — **통과 수치는 여기 적지 않는다** (`#1319` 에서 3회 낡아
      구조로 없앴다. 수치는 커밋 본문과 `_test_logs/`)
- [ ] 타입체크 ratchet 2종 (backend `*.ts` 를 건드린다)
- [ ] `/ai-review` + `--impl-done`
- [ ] 트래커 항목 종결 (T1·T2 둘 다 끝나므로 **이번엔 닫는다**) + 잔류 3메서드 사유 명시
- [ ] `plan/complete/` 이동
- [ ] **이동 후 `plan/complete/impl-chat-channel-binder-t2.md` 실재 확인** —
      `chat-channel-binder.service.ts` JSDoc 이 그 경로를 인용한다. 이동을 빠뜨리면 **깨진
      링크가 남는다** (`/ai-review` `18_04_36` W4 — *"내가 기억하는 것에 달려 있다"*).
