---
title: chat-channel-input-rules 구조 정리 + 테스트 보강 — 트래커 잔여 배치
status: complete
owner: developer
worktree: chat-channel-rules-cleanup
started: 2026-09-12
completed: 2026-09-12
spec_impact: none
---

## 왜 이 턴인가

`#1319`(T1 이동) · `#1320`(T2) · `#1324`(§5.4 구현)가 남긴 **developer 축 잔여**를 한 배치로
닫는다. 세 항목이 전부 같은 파일 쌍(`chat-channel-input-rules.{ts,spec.ts}`)에 걸려 있어
따로 열면 리뷰·게이트 비용만 3배가 된다.

트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`):
「`chat-channel-input-rules.ts` 의 구조 정리 6건」 · 「`chat-channel-input-rules.spec.ts` 잔여
보강 5건」(그중 (d) 는 `#1324` 완료) · 「`rotateBotToken` 의 swagger 응답 문서화 잔여」.

## 착수 전 재판정 — **한 항목은 이미 사라졌다**

`origin/main` = `c9bc5dca6` 기준 전수 실측:

| 항목 | 트래커 기록 | 재판정 |
|---|---|---|
| (a) 에러 봉투 반복 | *"7회 이상"* | **11곳** (`throw` 기준. `translateSetupChannelError` 의 2곳은 형태가 달라 비대상) |
| (b) 파일 성격 불일치 | 입력 규칙 파일에 출력 변환 | 유효 |
| **(c) 절단 길이 `256` 매직 넘버 2회** | 유효 | **⛔ 소멸** — `#1324` 가 `details.reason` 을 없애며 같이 사라졌다(`grep "256"` **0건**) |
| (d) 이중 캐스팅 | 2곳 | 2곳 (L100 · L145) |
| (e)(f) stale 주석 | 2곳 | **3곳** — `chat-channel-rejection-messages.const.ts:8` · `dto/chat-channel-config.dto.ts:36` · `:283` |
| spec (a) `as never` | 1곳 | 1곳 |
| spec (c) falsy-guard | 판정 필요 | 아래 §설계 판단 (3) |
| spec (e) label 미단언 | 유효 | 유효 (L254) |
| swagger 404/200 | 유효 | 유효 (`rotateBotToken` 에 `@ApiNotFoundResponse`·`@ApiOkWrappedResponse` 부재) |

> **(c) 가 이 재판정의 값어치다** — 기록만 믿고 착수했으면 존재하지 않는 매직 넘버를 찾느라
> 시간을 썼을 것이다. 종결 처리하고 사유(다른 PR 이 부수적으로 해소)를 남긴다.

## 설계 판단 — 착수 전에 정한다

### (1) 헬퍼는 `throwInvalidField(field, message)` — **세 번째 인자를 두지 않는다**

트래커는 `throwValidationError(field, message, code?)` 를 제안했다. 그런데 **11곳이 전부**
`code: ErrorCode.INVALID_FIELD` 다(실측). 선택 인자를 두면 **한 번도 안 쓰이는 매개변수**가
계약으로 남고, 다음 사람은 "여기 다른 코드도 올 수 있나" 를 묻게 된다. 필요해지는 날 넓히는
쪽이 싸다 — *정의를 한 칸 좁게*.

반환 타입은 `never` 로 둔다. `throw throwInvalidField(...)` 가 아니라 `throwInvalidField(...)`
한 줄로 끝나야 호출부가 실제로 짧아진다.

### (2) (b) 는 **주석을 넓힌다. 파일을 쪼개지 않는다** — 이번 턴에는

분리(`chat-channel-error-translation.ts`)가 더 정직하지만 **spec 편집을 부른다** —
`15-chat-channel.md §7` 파일 트리가 이 모듈의 파일을 열거하고, 트리 추가는 planner 축이다
(같은 사실의 planner 쌍둥이 항목이 이미 등재돼 있다). developer 턴이 그걸 건드리면
`ESCALATE=spec` 을 한 번 더 태워야 하고, 그 비용이 이 정리의 값어치보다 크다.

→ 헤더 주석이 **입력 규칙 + §5.4 출력 계약** 둘 다 이 파일의 책임임을 명시하도록 넓힌다.
분리는 planner 항목이 §7 을 손볼 때 **같이** 결정한다(그 항목 본문에 이 판단을 적어 둔다).

### (3) spec (c) `incoming.provider &&` — **살린다. 다만 도달 불가임을 실측으로 적는다**

`ChatChannelUpdateConfigDto` 는 `OmitType(ChatChannelConfigDto, ['botToken',
'inboundSigningPlaintext'])` 이라 `provider` 의 `@IsString() @IsIn(...)` 을 **그대로 상속**한다
— PATCH 에서도 필수다. 즉 HTTP 파이프를 지나온 입력에서 이 falsy-guard 는 **도달할 수 없다**.

그래도 지우지 않는다: 지우면 DTO 를 우회한 호출자(`provider` 미지정)가
*"provider 는 PATCH 로 바꿀 수 없어요"* 라는 **틀린 메시지**를 받는다. 뮤테이션이 살아남는 것이
정상인 자리이므로 **그 사유를 주석과 plan 에 적고**, DTO 층이 실제로 막는다는 것을 테스트로
고정한다(그래야 "도달 불가" 주장이 vacuous 하지 않다).

## 작업

| # | 파일 | 무엇 |
|---|---|---|
| 1 | `chat-channel-input-rules.ts` | `throwInvalidField` 헬퍼 + 11곳 치환 |
| 2 | `chat-channel-input-rules.ts` | `hasField` 헬퍼 — 이중 캐스팅 2곳 |
| 3 | `chat-channel-input-rules.ts` | 헤더 주석에 출력측 책임 명시 · falsy-guard 사유 |
| 4 | `chat-channel-rejection-messages.const.ts` · `dto/chat-channel-config.dto.ts` | stale `TriggersService` 귀속 3곳 |
| 5 | `chat-channel-input-rules.spec.ts` | `as never` 제거 · `mode:'update'` 조합 · provider label 단언 · DTO 도달 불가 고정 |
| 6 | `triggers.controller.ts` | `@ApiNotFoundResponse` + `@ApiOkWrappedResponse` |

## 증거

- **뮤테이션**: 착수 시점에 셋을 예고했고(`details.code` 누락 · `field` 고정 · label 스왑)
  최종적으로 **아홉** 을 돌렸다 — 설계 판단에서 둘(메시지 고정 · 도달 불가 방어), 리뷰 후속으로
  넷(`hasField` truthy · DTO 이름 충돌 · `botIdentity` 필드 탈락 · 형식 불일치 라벨 스왑)이
  붙었다. **숫자는 아래 §실측 기록 표가 SoT 다** — 이 문장은 표를 가리키기만 한다(같은 수를 세
  자리에 적었다가 라운드 2·7 이 연달아 모순을 잡았다).
- **동작 보존**: 이 배치는 응답 형태를 **한 바이트도** 바꾸지 않는다. 기존 테스트가 무편집으로
  통과하는 것이 그 증거다(#1319 와 같은 기준).

## 체크리스트

- [x] `/consistency-check --impl-prep` — `review/consistency/2026/09/12/15_53_35` BLOCK: NO
- [x] 1~4 (프로덕션) — 헬퍼 3종 + 봉투 11곳 + stale 주석 3곳
- [x] 5 (테스트 보강) — (a)(b)(c)(e) + 두-층 등가성 + provider label 두 분기
- [x] 6 (swagger) — `@ApiNotFoundResponse`·`@ApiOkWrappedResponse`·`@ApiUnauthorizedResponse`
      + 신규 응답 DTO (`dto/responses/`)
- [x] **7. `repo-guards` DTO 클래스명 충돌 가드** — 작업표에 없던 항목. 라운드 1 에서 **내가 낸
      CRITICAL** 의 재발 방지로 라운드 3 리뷰가 요구했다
- [x] 뮤테이션 **9종** (예고 3 + 설계 판단 파생 2 + 리뷰 후속 4 — 표는 §실측 기록)
- [x] `run-test-all.sh` 4단계 — `ALL PASS` (lint · unit · build · e2e 305)
- [x] `/ai-review` **6라운드** + `--impl-done` `review/consistency/2026/09/12/18_08_30` BLOCK: NO
- [x] 트래커 항목 종결 ((c) 는 **소멸**로 종결) + 잔여 등재 — 종결 4 · 신규 6
- [x] `plan/complete/` 이동 — **이동 뒤 문서 게이트 재실행**


## 정지 규칙 — **라운드 1 결과를 보기 전에 선언한다**

| 결과 | 처분 |
|---|---|
| CRITICAL 있음 | 고치고 **라운드 추가** |
| 조치가 `codebase/**` 를 한 줄이라도 바꿈 | 고치고 **라운드 추가** |
| 조치가 `plan/**`·`review/**` 에 국한 | 그 자리에서 고치고 **수렴** — `newest_code` 는 `codebase/**` 만 센다 |
| 발견 0 | 수렴 |

종료 조건은 *"발견 0"* 이 아니라 ***"`codebase/**` 수정 0 으로 끝나는 라운드"*** 다.

## 실측 기록 — 뮤테이션 9종 (예측/실측) — **개수의 SoT 는 이 표다**

| # | 뮤턴트 | 예측 | 실측 |
|---|---|---|---|
| 1 | 봉투에서 `details.code` 제거 | RED | **RED** (26건) |
| 2 | `field` 인자 무시 → 고정 이름 | RED | **RED** (36건) |
| 3 | provider label 스왑 | RED | **RED** (2건 — 이 PR 이 만든 자리) |
| 4 | 차단 필드 메시지 고정 | RED | **RED** (8건) |
| 5 | `incoming.provider &&` 제거 | **GREEN(정상)** | **GREEN** |
| 6 | `hasField` 를 truthy 판별로 (리뷰 후속) | — (조치 전 **GREEN** 이 결함이었다) | **RED** (14건) |
| 7 | DTO 클래스명을 기존 것과 동일하게 (신규 가드) | RED | **RED** |
| 8 | `botIdentity` 를 명시 필드 나열로 (부가 필드 탈락) | RED | **RED** (2건) |
| 9 | 형식 불일치 메시지 Slack↔Discord 스왑 | — (조치 전 **30/30 GREEN**) | **RED** (2건) |

1~5 는 예측과 실측이 **5/5 일치**했고, 5번의 GREEN 이 정답인 사유는 §설계 판단 (3).

**6·9 는 리뷰가 "조치 전 GREEN" 을 실측해서 생긴 자리다** — 내가 예고하지 못한 뮤턴트이고,
그게 리뷰의 값어치다. 특히 **9번은 1번(부재 분기)을 닫고도 형제 분기(형식 불일치)가 열려
있었다**는 뜻이다 — *"인접 변형을 못 열거하면 한 칸씩 닫는 중"*.

## 리뷰 6라운드 궤적

| 라운드 | 결과 | 그 라운드가 잡은 것 |
|---|---|---|
| 1 `16_17_57` | **C1** · W3 | **내가 만든** swagger 스키마 이름 충돌 · publicKey 누락 · 401 · 두-층 등가성 |
| 2 `16_39_18` | C0 · W3 | 응답 DTO 규약 자리 · **내 orphan 주석** · plan 수치 모순 |
| 3 `17_02_19` | C0 · W1 | 재발 방지 가드 부재 → 가드 신설 |
| 4 `17_23_34` | C0 · W1 | **내가 새로 넣은** bare 인용 5곳 |
| 5 `17_39_51` | C0 · W1 | `publicKey` 회귀 테스트 부재 (3회 지적 끝에 내 유예 근거가 틀렸음을 인정) |
| 6 `17_52_34` | C0 · W1 | label 단언의 **형제 분기** 누락 → 수렴 |

라운드 3~5 는 이월 INFO 의 승격이라 §정지 규칙을 **보정**했고, 6라운드는 새 실측(스왑 30/30
GREEN)이 붙어 조치 후 수렴했다.


## 정지 규칙 **보정** — 라운드 6 결과를 보기 전에 선언한다

라운드 1~5 의 실제 패턴을 재니 원 규칙이 끝나지 않는 형태였다:

| 라운드 | 결과 | 그 라운드 지적의 성격 |
|---|---|---|
| 1 | C1 · W3 | **진짜 결함**(내가 만든 스키마 이름 충돌) + 문서/테스트 |
| 2 | C0 · W3 | 규약 자리 · 내 orphan 주석 · plan 수치 |
| 3 | C0 · W1 | **이월 INFO 의 승격** (가드 자동화) |
| 4 | C0 · W1 | **이월 INFO 의 승격** (인용 형식) |
| 5 | C0 · W1 | **이월 INFO 의 승격** (`publicKey` 회귀 테스트) |

라운드 3~5 는 전부 **앞 라운드가 INFO 로 적어 둔 것이 WARNING 으로 올라온 것**이다. 매번
조치하면 `codebase/**` 가 바뀌고, 원 규칙은 그때마다 라운드를 추가한다 — **유예 항목이 남아
있는 한 끝나지 않는다.** 이 저장소가 이미 겪은 "fix→리뷰 stale 7라운드" 와 같은 모양이다.

**그래서 한 칸 좁힌다.** 라운드 6의 종료 조건:

- CRITICAL 0 **이고**
- 그 라운드의 WARNING 이 **새 결함 클래스가 아니라** 이미 등재된 유예 항목의 승격이면 →
  **수렴**하고 그 항목들을 트래커에 남긴 채 닫는다.
- 새 결함 클래스가 나오면 고치고 라운드를 더 돈다.

*"발견 0"* 이 아니라 *"새 결함 0"* 이 기준이다 — 유예는 트래커가 갖고, 리뷰 라운드는 결함을
찾는 도구지 유예를 소진시키는 도구가 아니다.
