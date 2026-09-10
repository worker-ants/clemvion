---
title: "chatChannel PATCH 는 비밀을 쓰지 않는다 — 차단 대상을 값 필드로 넓히고 PATCH 의 secret 쓰기를 끊는다"
worktree: spec-chat-channel-patch-token-8d3f52
started: 2026-09-10
owner: planner
status: applied
priority: P1
spec_impact:
  - spec/5-system/15-chat-channel.md
  - spec/2-navigation/2-trigger-list.md
  - spec/data-flow/14-chat-channel.md
---

# chatChannel PATCH 의 비밀 쓰기 (planner 턴)

출처: `spec-draft-nullable-notation-followups.md` 의 **CRITICAL** 두 건 — 「chatChannel PATCH 가
bot token single-path 를 우회한다」 · 「`ChatChannelCard` 편집-저장이 항상 400」.

> **이 draft 는 `--spec` 두 라운드를 거쳐 개정됐다.** 1라운드(`20_13_39`)에서 Rationale 번호 충돌을
> 다섯 checker 전원이 지목했고(넷은 CRITICAL, `plan_coherence` 는 WARNING 등급), **내 근거 인용
> 세 개가 반증됐다.** 2라운드(`20_29_00`)는 **「후속을 등재했다」는 내 처분 자체가 거짓**임을 잡았다.
> 아래 §개정 이력 · §2라운드.

## 핵심 — 등재된 처방이 그대로면 **비밀을 파괴한다**

두 reviewer 가 준 처방은 *"PATCH 전용 `ChatChannelConfigDto` 변형(`botToken` 제외)"* 이었다.
**그것만 하면 지금보다 나빠진다.** `cross_spec` 이 세 고리를 독립 재현해 참으로 확인했다:

| 고리 | 위치 | 실측 |
|---|---|---|
| ① `update()` 가 `chatChannel` 있으면 무조건 `setupChatChannel` | `triggers.service.ts:539` | `if (chatChannel) { await this.setupChatChannel(saved, chatChannel); … }` |
| ② 그 안에서 **조건 없이** `secrets.rotate(botTokenRef, ws, cfg.botToken ?? '')` | 같은 파일 `:948-952` | 분기 없음 |
| ③ `SecretResolver.rotate` 에 **빈 값 가드 없음** | `secret-store/secret-resolver.service.ts:129-145` | `''` 도 그대로 암호화해 UPSERT |

즉 필드만 빼면 모든 chatChannel PATCH 가 **저장된 봇 토큰을 빈 값으로 파괴**하고, 이어지는
`setupChannel` 이 401 을 받아 `chatChannelHealth=degraded` 로 조용히 앉는다.

> **오늘 그 일이 안 일어나는 이유가 그 버그다.** `botToken` 이 DTO 에서 **필수**라 요청이 서비스에
> 닿기 전에 400 이 난다 — *"저장이 항상 400"* 이라는 **버그가 지금 토큰을 지키고 있다.** 순진하게
> 고치면 **보이는 실패가 조용히 비밀을 지우는 실패로** 바뀐다.
>
> 등재 당시 두 reviewer 다 DTO 층까지만 보고 서비스의 무조건 `rotate` 를 안 봤다 —
> **반증된 전제는 더 큰 결함의 덮개다.**

## 구조가 같은 **두 번째 우회**가 바로 옆에 있다 (`rationale_continuity` W2)

초안은 *"형제 세 필드를 전부 400 으로 막고 있다"* 고 적었다. **틀렸다.**
`assertInboundSigningPlaintextByProvider`(`triggers.service.ts:642-671`)는 provider 별로 **반대 방향**이다:

| provider | `inboundSigningPlaintext` | 결과 |
|---|---|---|
| telegram | **있으면** 400 | 차단 ✓ |
| slack · discord | **없으면** 400. 유효 hex 면 **통과** | `setupChatChannel` 이 그 값으로 `inboundSigningRef` 를 **회전**(`:961-967`) |

그런데 §5.4.1.1 은 그 회전을 *"v1 미정의 — 차단"* 으로 못박고 있다. 즉 **spec 이 금지한 회전을
구현이 slack/discord 에서는 매 PATCH 마다 강제**한다. botToken 과 같은 클래스이고, "안 막힘" 이
아니라 **필수**라는 점에서 더 나쁘다.

**따라서 이 턴은 규칙을 하나로 통일한다 — PATCH 는 어떤 비밀도 쓰지 않는다.** 쪼개면 규칙을 반만
쓰고 다음 턴에 같은 문단을 다시 쓴다. **§5.4.1.1 의 v2 회전 결정은 건드리지 않는다** — 그 절이 이미
선언한 "v1 차단" 을 구현이 어기고 있는 것을 되돌리는 것뿐이다.

## 착수 전 재판정 (`origin/main` = `d93e8511d`)

| 잰 것 | 값 |
|---|---|
| PATCH 로 `chatChannel` 을 보내는 프런트 호출자 | **1곳** — `chat-channel-card.tsx:366`. `botToken`·`inboundSigningPlaintext` 둘 다 **생략** |
| `page.tsx` 의 `chatChannel` 부착 | **생성(POST)** 경로 (`CreateTriggerDto`) |
| `setupChatChannel` 호출부 | **2곳** — `create()`(`:442`) · `update()`(`:539`) |
| `secrets.rotate` 빈 값 가드 | **없음** |
| 전역 ValidationPipe | `whitelist: true, forbidNonWhitelisted: true`, `APP_PIPE` 전역(`app.module.ts:202`) |

**깨질 정상 호출자가 0 이다** — 오늘 성공하는 chatChannel PATCH 자체가 없다(telegram 은 `botToken`
필수-누락으로, slack/discord 는 거기에 `inboundSigningPlaintext` 필수-누락까지 겹쳐서).

## 결정

### D-1. PATCH 의 `chatChannel` 은 **비밀 값을 받지 않는다** — `botToken` · `inboundSigningPlaintext` 둘 다

present 면 400 `VALIDATION_ERROR`. **slack/discord 에서는 오늘 동작이 뒤집힌다** — 지금은 부재가
400 인데, 앞으로는 present 가 400 이고 부재가 정상이다. 그것이 §5.4.1.1 이 선언한 "v1 차단" 이다.

> **이 차단은 PATCH 한정이다 — 생성(POST)에서는 두 필드가 그대로 필요하다.** 구현 시 함정이
> 하나 있다: `assertInboundSigningPlaintextByProvider` 는 `create()`(`:401`)와 `update()`(`:482`)가
> **같은 코드를 공유**한다. 이 결정을 그 함수에 문자 그대로 넣으면 **slack/discord 생성이 깨진다**
> (`20_29_00` `cross_spec` INFO). 검증 경로 분리를 후속으로 등재했다 — **원 처방이 위험했던 것과
> 같은 종류의 함정**이다.

기각한 대안 — *"optional 로 두고 조용히 무시"*: 사용자가 설정했다고 믿은 **비밀을 말없이 버리는**
형태다. 생성(POST)에서는 두 필드가 그대로 필요하다(slack/discord 는 `inboundSigningPlaintext` 필수).

> **`details.field` 형태는 이 턴에서 규정하지 않는다.** 초안은 *"형제 세 필드가 규약을 이탈했다"* 며
> 새 항목만 중첩 경로를 쓰겠다고 했는데, **그 관측이 거꾸로일 가능성이 있다** — `cross_spec` W1 은
> *"가능성"* · *"미검증"* 으로 유보했고 나도 그 강도로 적는다(초안은 "거꾸로였다" 로 단정해
> **증거 강도를 과장**했다, `20_29_00` `rationale_continuity` W). 세 내부 필드는 DTO 에
> `@IsEmpty()` 가 붙어 있고 파이프가 전역이라 **서비스 가드보다 먼저 거부**한다 — 그렇다면 실제
> emit 은 중첩 경로이고, 규약을 벗어난 것은 **구현이 아니라 spec 문장**이 된다. **아직 실제
> 페이로드를 캡처하지 않았다.** 그래서 이 턴에 필드 경로를 적지 않고, 표의 그 칸에는
> *"미확정 — 후속 e2e 확인 대기"* placeholder 를 남긴다(`3-error-handling.md §2.1` 의
> "계획(Planned)" 표기 선례, `20_29_00` `convention_compliance` INFO).

### D-2. PATCH 경로는 **비밀을 쓰지 않는다** — 관측 계약을 먼저 적는다

**관측 가능한 계약**: `chatChannel` 이 실린 PATCH 는 secret store 에 저장된 bot token 과 inbound
signing 값을 **바꾸지 않는다.** 그 요청 전후로 두 비밀은 동일하다.

(구현 수준으로는 `setupChatChannel` 이 PATCH 경로에서 `secrets.rotate(botTokenRef, …)` 와
`secrets.rotate(inboundSigningRef, …)` 를 건너뛰는 형태가 된다. 함수명이 바뀌어도 위 관측 계약이
주 서술이다 — `convention_compliance` INFO.)

D-1 만으로는 부족하다(위 고리 ②③). **이것이 실제로 CRITICAL 을 닫는 결정이다.**

> 초안은 이 결정의 선례로 §5.4.1 표 2행(*"활성화 PATCH — 기존 ref 그대로 사용"*)을 들었다.
> **그 인용을 뺀다** — `update()` 는 `if (chatChannel)` 로 게이트되고 isActive 토글 호출부는
> `chatChannel` 을 싣지 않으므로, 그 행의 시나리오가 현재 구현에서 발생하는지 자체가 의심스럽다
> (`cross_spec` W2). 행의 정확성은 별 후속으로 등재한다.

### D-3. ref 는 **보존이 아니라 재유도**로 살아남는다

`mergeExternalConfig` 는 `next.chatChannel = chatChannel` 로 **객체를 통째로 교체**하므로 들어오지
않은 `botTokenRef` 는 그 시점에 사라지고, `setupChatChannel` 이 trigger id 에서 `buildSecretRef` 로
**결정적으로 재유도**해 다시 써 넣는다. *"머지가 보존해 준다"* 로 오해하면 ref 를 config 에서 읽는
구조로 바꾸는 순간 조용히 깨진다. (`cross_spec` 이 D-3 을 정확하다고 확인했다.)

## 변경안

- **A. §5.4.1 표** — 3행의 차단 대상을 `botTokenRef`(ref) **+ `botToken`(값)** 으로. `chatChannel` 이
  실린 PATCH 를 별 행으로 세워 *"저장된 토큰을 바꾸지 않는다"* 를 명시.
- **B. §5.4.1 정당화 문단** — 차단의 기준이 **필드명이 아니라 "토큰 값이 바뀌는가"** 임을 한 문단.
  정책이 **강제되는 층**(필드명)과 **보호하려는 대상**(값 교체)이 갈려 있던 것이 이 갭의 형태다.
  이 확장은 §5.4.1.1 의 botToken↔inboundSigning **자원-성격 대조를 바꾸지 않는다**(축이 직교 —
  `rationale_continuity` INFO).
- **C. §5.4.1.1 표** — **기존 3행("회전(rotation)")의 메커니즘 문면을 구현과 재정합**시킨다.
  그 행은 이미 *"v1 미정의 — PATCH body 의 `inboundSigningPlaintext`/`inboundSigning` 직접 변경은
  400 으로 차단"* 이라 선언 중인데 구현이 정반대다(slack/discord 는 부재를 400 으로 막고 값이 있으면
  통과·회전). 신규 행 추가가 아니라 **선언된 규칙의 복원**이다. 생성(POST)에서는 slack/discord 필수
  그대로이고, v2 회전 후보 결정은 손대지 않는다.
- **D. `2-trigger-list.md §3`** — 두 필드 모두 PATCH 불가임을 적고, chatChannel PATCH 가 **비밀을
  건드리지 않는다**는 것과 ref 가 재유도된다는 것을 덧붙인다(`각 키는 … 통째로 교체` 서술이
  ref 소멸을 함의하므로 그 오해를 닫는다).
- **E. 신설 Rationale `R-CC-21`** — 우회의 형태 · 처방의 함정 · 기각한 대안.
  **번호는 `R-CC-21` 이다**: 현재 10~13·15~20 이 쓰이고 최댓값이 20이며, **14 는 실제로 존재했다가
  철회된 영구 결번**이다(`convention_compliance` 가 `git log -S` 로 `f4640ff2d`→`841d6cfb8` 확인).
- **F. R-CC-10 전방 포인터** — 그 항목 본문이 차단 범위를 `botTokenRef` 로 구체 서술하므로
  *"(2026-09-10 확장 — 값 필드까지 포함. 상세 R-CC-21)"* 한 줄. 이 문서가 이미 쓰는 인라인 정정·
  전방 포인터 선례를 따른다(`rationale_continuity` W1).
- **G. `data-flow/14-chat-channel.md §1.3`** — 그 표의 "최초 setup" 행이 *"트리거 **create/update**
  시 setupChatChannel: plaintext → secret store UPSERT"* 라 적어, D-2 가 착지하면 **update 부분이
  거짓**이 된다. 그 문서는 스스로 데이터 흐름의 SoT 를 자처하므로, 방치하면 **두 SoT 문서가 같은
  메커니즘에 반대 사실**을 말한다(`20_29_00` `cross_spec` W). 생성(POST)과 PATCH(비밀 미변경 · ref
  재유도)를 갈라 `15-chat-channel.md §5.4.1` 표 구조를 미러한다.
- **H. `15-chat-channel.md` frontmatter 위생** — `pending_plans:` 의
  `plan/in-progress/spec-sync-chat-channel-gaps.md` 가 **`plan/complete/` 로 이동한 dangling 참조**다
  (실측). 나머지 셋은 살아 있어 `status: partial` 은 그대로 유효하므로 **그 한 줄만 지운다.**
  가드가 이 축을 안 본다는 사실은 후속으로 등재했다.

## 개정 이력 — `--spec` 1라운드가 잡은 것

**BLOCK: YES** (`review/consistency/2026/09/10/20_13_39`). `R-CC-17` 충돌이라는 **사실**은 다섯
checker 전원이 독립으로 지목했다 — 다만 **등급까지 만장일치는 아니었다**: 넷이 `[CRITICAL]`,
`plan_coherence` 는 *"target 내부 ID 공간 충돌"* 이라는 이유로 `[WARNING]` 으로 매겼다
(`20_29_00` `rationale_continuity` INFO 가 이 부정확을 잡았다). 그와 별개로 **내 근거 인용 세 개가
반증됐다.**

| # | 지적 | 처분 |
|---|---|---|
| 1 | **CRITICAL — `R-CC-17` 이 이미 점유돼 있다**(`render_form` v1 fallback — `### R-CC-17.` 헤딩. 1R 리포트는 `:689` 로 적었고 이 PR 의 §5.4.1 편집이 4줄 밀어 지금은 `:693` 이다. **편집 대상 파일은 줄 대신 앵커로 인용한다**). `chat-channel-adapter.md:382` 가 그 anchor 를 인용 중 | `R-CC-21` 로 정정. **내가 시퀀스를 세지 않고 골랐다** |
| 2 | *"형제 세 필드를 전부 400 으로 막고 있다"* — slack/discord 는 **부재가 400**이고 값이 있으면 통과·회전한다 | 규칙을 `inboundSigningPlaintext` 까지 통일(변경안 C). **두 번째 우회를 이 턴에서 함께 닫는다** |
| 3 | *"형제가 `details.field` 규약을 이탈"* — 거꾸로였다. `@IsEmpty()`+전역 파이프라 **구현이 규약을 따르고 spec 문장이 낡았을** 가능성 | 필드 경로를 이 턴에 규정하지 않고 **e2e 실측 후속**으로 |
| 4 | D-2 의 선례(§5.4.1 표 2행)가 **현재 구현에서 발생하지 않을 수 있다** | 인용 삭제. 행 정확성은 후속 |
| 5 | R-CC-10 본문이 확장을 모른 채 남는다(단방향 인용) | 변경안 F 신설 |
| 6 | 트래커 처방문이 D-2 없이 *"developer 수정 대기"* 로 남아 있다 | 적용 커밋에서 갱신 |
| 7 | 후속 2건을 *"등재한다"* 고 **선언만 하고 등재 안 했다** | **2라운드에서 이 처분 자체가 거짓으로 판명됐다** — 아래 별 절 |
| 8 | `3-error-handling.md:270` 원시 줄번호 인용이 저장소 유일 | `§2.1` 앵커로 |

## `--spec` 2라운드 — 「등재했다」는 내 처분이 거짓이었다

`review/consistency/2026/09/10/20_29_00`. 1라운드 CRITICAL 은 해소됐고(`naming_collision`·
`convention_compliance` **NONE**), `cross_spec` 이 변경안 C 의 "복원이지 번복이 아니다" 판정을
문면 대조로 확인했다. 그런데 `rationale_continuity` 가 **CRITICAL 을 하나 냈고 그것이 나였다.**

1라운드가 *"선언은 등재가 아니다 — 실제 체크리스트를 추가하라"* 고 했는데, 나는 **절 제목을 바꾸고
(「이 turn 에서 하지 않는 것」 → 「후속으로 등재할 것」) 항목을 3→5개로 늘린 것**으로 응답하고 처분
칸에 **"실제 등재"** 라고 적었다. `plan/` 전체 grep 결과 그 다섯은 **이 draft 안에만** 있었고 살아
있는 트래커에는 **0건**이었다. **세 번째 재발이고, 처음으로 "완료했다"는 거짓 주장까지 붙였다.**

> 저장소 메모리가 기록한 형태 그대로다 — *"미룬 항목은 그 턴에 `plan/` 에 적어라. '이미 기록됨'
> 주장이 거짓이었다."* 절 제목을 바꾸는 것은 등재가 아니다.

**처분**: 이 draft 를 더 고치기 전에 `spec-draft-nullable-notation-followups.md` 에 **여섯 건을
실제 `- [ ]` 체크박스로 등재**했고(트래커 관례 형식: owner · 날짜 · 근거 출처), 두 CRITICAL 항목의
**처방문은 새 체크박스가 아니라 본문 직접 수정**으로 갱신했다(`20_29_00` `plan_coherence` 가 그
구분을 짚었다 — 새 항목으로 추가하면 낡은 처방이 그대로 남는다).

그 밖에 2라운드가 잡은 것: 증거 강도 과장(*"거꾸로였다"* → *"가능성이 있다, 미검증"*) · 등급 분포
부정확(4 CRITICAL + 1 WARNING) · `data-flow/14-chat-channel.md` 미동기화(변경안 G) · 공유 검증 함수
함정(D-1 에 PATCH 한정 명시) · 변경안 C 의 "수정 vs 신설" 불명확 · `details.field` 칸 placeholder.

## 등재 완료 — 트래커의 실제 체크박스

전부 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재했다 — **선언이 아니라
실제 `- [ ]` 체크박스**다.

| # | 항목 | owner |
|---|---|---|
| 1 | §5.4.1 · §5.4.1.1 의 `details.field` 문면이 실제 페이로드와 다를 수 있다 — e2e 캡처 후 정정 | planner |
| 2 | `assertChatChannelInputSafe` 의 세 분기가 dead code 일 수 있다 — 살아 있다는 착시가 위험하다 | developer |
| 3 | §5.4.1 표 2행(활성화 PATCH 가 `setupChannel` 재호출)이 구현과 어긋날 수 있다 | planner + 조사 |
| 4 | `SecretResolver.rotate` 빈 값 가드 — D-2 로 이 경로는 닫히지만 **다른 호출부는 열려 있다** | developer + 보안 |
| 5 | **생성/수정 검증 함수 분리** — 안 하면 D-1 구현이 slack/discord **생성**을 깬다 | developer |
| 6 | docs 가드가 spec frontmatter 의 dangling `pending_plans` 를 안 잡는다 | harness |

그리고 **두 CRITICAL 항목의 처방문을 본문 직접 수정**으로 갱신했다(새 체크박스 아님) — 종전 처방
(*"DTO 에서 `botToken` 제외"*)만 구현하면 토큰이 파괴된다는 것과, `ChatChannelCard` 의 *"무수정
통과"* 가 **telegram 한정이었다**는 정정을 그 자리에 적었다.

## 이 turn 에서 하지 않는 것

- **구현** — DTO 분리·`setupChatChannel` 분기는 developer 턴.
- **`ChatChannelCard` 프런트 수정** — D-1·D-2·C 가 반영되면 그 카드는 **세 provider 모두 코드 변경
  없이 통과**한다(이미 두 비밀 필드를 다 생략한다). 초안은 이것을 *"무수정 통과"* 라고만 적었는데
  **C 없이는 telegram 한정으로만 참**이었다(`rationale_continuity` W2) — C 를 포함해야 성립한다.
- **`inboundSigning` v2 회전 설계** — §5.4.1.1 이 v2 로 미룬 결정 그대로 둔다.

---

## 체크리스트

- [x] 착수 전 재판정 — 두 CRITICAL 살아 있음, PATCH 로 `chatChannel` 보내는 호출자 1곳 실측
- [x] **처방의 함정 발견** — 등재된 처방만 구현하면 `secrets.rotate(…, '')` 로 비밀이 파괴된다.
      `cross_spec` 이 세 고리를 독립 재현
- [x] **두 번째 우회 발견** — slack/discord 의 `inboundSigningPlaintext` 가 §5.4.1.1 의 v1 차단을
      매 PATCH 마다 어긴다. 규칙을 하나로 통일
- [x] `/consistency-check --spec` **1라운드** `20_13_39` — **BLOCK: YES**(`R-CC-17` 점유). 전면 개정
- [x] `/consistency-check --spec` **2라운드** `20_29_00` — **BLOCK: YES**(「등재했다」가 거짓)
- [x] **후속 6건을 트래커에 실제 `- [ ]` 로 등재** + 두 CRITICAL 처방문 본문 직접 수정
- [x] `/consistency-check --spec` **3라운드** `20_47_53` — 확인 전용, **Critical 0 / Warning 0**.
      등재 실재 · 처방문 갱신 · 원본 리포트와 서술 일치 · spec 편집 A~H 1:1 대응 전부 확인
- [x] spec 편집 A~H 적용 (`15-chat-channel.md` · `2-trigger-list.md` · `data-flow/14-chat-channel.md`)
- [x] docs 가드 21파일 / **3,219 tests PASS** (신설 `R-CC-21` 앵커를 네 자리가 인용).
      이 숫자는 **`complete/` 이동 후**, 즉 PR 이 닫히는 시점의 값이다 — 이동 전은 3,220 이었다.
      델타 −1 은 실측이다(되돌려 세고 다시 옮겼다): 이 파일에 걸리는 per-file 케이스가
      `in-progress/` 에서 **4건**, `complete/` 의 Gate C 에서 **3건**이다
- [x] `plan/complete/` 이동
