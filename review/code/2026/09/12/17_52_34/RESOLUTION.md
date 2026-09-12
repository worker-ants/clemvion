# RESOLUTION — 17_52_34 (라운드 6) · **수렴**

**CRITICAL 0 · WARNING 1 — 조치했고, 여기서 닫는다.**

## 조치

| # | 분류 | 조치 |
|---|---|---|
| W1 | 테스트 (형제 분기 누락) | `assertInboundSigningPlaintextByProvider` 의 **형식 불일치** 분기에 provider label 단언 추가 (비-hex · 교차 길이 두 자리) |

## 내가 한 칸 좁게 고쳤다 — 그 증거

라운드 1 에서 **"부재(필수 위반)" 분기**에 label 단언을 넣고 *"label 스왑 뮤턴트가 2건 RED"*
라고 적었다. 참이었다 — **그 분기에 한해서.** 바로 아래 **형식 불일치 분기**는 여전히
`details` 만 봤고, 두 provider 의 `details` 는 **동일**하므로 메시지를 맞바꿔도 통과했다.
reviewer 가 실측으로 **30/30 GREEN** 을 보여 줬다.

*"인접 변형을 못 열거하면 한 칸씩 닫는 중"* 이라는 이 저장소의 규율이 그대로 맞았다.

**reviewer 의 실험을 그대로 재현했다**: 두 메시지를 맞바꾸면 이제 **2건 RED**(조치 전 0건).

## 왜 라운드 7 을 돌지 않는가 — 규칙대로다

`plan/in-progress/chat-channel-rules-cleanup.md` §정지 규칙 **보정**(라운드 6 결과를 보기 **전에**
기록)이 *"CRITICAL 0 이고 WARNING 이 새 결함 클래스가 아니면 수렴"* 이라 정했다. 이번 WARNING 은
**라운드 1 에서 이미 닫은 클래스(label 스왑)의 형제 분기**이고, 그 클래스가 지금 닫혔다는 증거는
**reviewer 가 쓴 바로 그 실험을 내가 재현해 RED 를 받은 것**이다 — 라운드 7 이 확인할 것과 같다.

6라운드 궤적: **C1·W3 → C0·W3 → C0·W1 → C0·W1 → C0·W1 → C0·W1**. 라운드 3~5 는 이월 INFO 의
승격이었고, 이번만 새 실측(스왑 30/30 GREEN)이 붙었다. 그 실측이 조치와 검증으로 소진됐다.

## 이월 (INFO — 전부 트래커)

`15-chat-channel.md` glob 확장(planner) · `response-contract` 배선 · `ParseUUIDPipe` ·
`throwInvalidField` 넓은 타이핑(5라운드 이월) · 신규 가드의 비재귀 순회 · dto 주석의 호출 체인
한 단어 · **frontend 가 `botIdentity.teamId`/`publicKey` 를 아직 안 읽는다**(신규 등재) ·
유저 가이드 MDX 의 `TRIGGER_NOT_FOUND` 오기(선재).

## TEST

- 스왑 뮤테이션 **RED 2건** (조치 전 0건) · 원복 assert
- `chat-channel-input-rules.spec.ts` 30 passed
- 직전 전체 4단계 `ALL PASS` (lint · unit · build · e2e 305) — 이후 변경은 이 테스트 파일뿐
