---
worktree: spec-small-followups
started: 2026-08-10
owner: project-planner
---

# `3-auth-session.md` frontmatter 재판정 — 두 PR 이 같은 자리를 반대 방향으로 만진다

> **이 문서는 완료 조건이 독립인 두 항목을 담는다** — 하나가 끝나도 다른 하나 때문에
> `in-progress` 에 남는다. 헷갈리지 않게 명시해 둔다(`16_26_09` scope INFO):
>
> | 항목 | 완료 조건 |
> |---|---|
> | §frontmatter 재판정 | 두 PR 중 **나중 것이 머지될 때** 그 PR 안에서 처리 |
> | §`start()` 경로 401 갭 | **도달 가능성 실측** 후 — 가능하면 회귀 추가, 불가면 주석 고정 |
> | §refresh 동시 발화 경합 | 실측으로 발생 가능성 확인 후 — 필요하면 in-flight 단일화 |
> | §catch 분기 세대 재검사 미검증 | 그 분기를 실제로 갈라내는 인터리빙을 찾은 뒤 회귀 추가 |
> | §비-terminal refresh 실패 후 **스트림 부재** | **실측 완료 — 결함 확정.** 아래 §미해결 참조 |
>
> 둘 다 닫히면 `complete/` 로 옮긴다. 하나만 닫혔을 때 이 문서가 열려 있는 것은 정상이다.

**나중에 머지되는 쪽이 반드시 처리해야 한다.** 자동 가드는 이 상황을 알아채지 못한다.

## 무엇이 겹치는가

| PR | `3-auth-session.md` 에 하는 일 |
|---|---|
| [#1130](https://github.com/worker-ants/clemvion/pull/1130) | frontmatter 를 `implemented` → **`partial`** + `pending_plans: [webchat-reload-rest-error-branches]` 로 정정(본문이 미구현을 자인하는데 status 가 `implemented` 였던 CRITICAL) |
| `claude/webchat-reload-rest-branches` | **그 잔여를 실제로 구현.** 본문의 "미구현(Planned)" 서술만 현행으로 고치고 frontmatter 는 충돌 회피로 미변경 |

즉 한쪽은 "아직 미구현이다" 를 기록하고, 다른 쪽은 "이제 구현됐다" 를 만든다. **둘 다
그 시점에는 참**이었다.

## 왜 자동으로 안 잡히는가

`spec-impl-evidence.md §3` 의 `partial → implemented` 승격 가드는 **`pending_plans` 가
`complete/` 로 이동하는 커밋 안**에서만 발동한다. #1130 이 먼저 머지되면:

- frontmatter 는 `partial` + `pending_plans: [webchat-reload-rest-error-branches]`
- 그런데 그 plan 이 가리키는 잔여는 **이미 구현돼 있다**(다른 PR 이 했으므로)
- 그 plan 파일은 `in-progress/` 에 그대로 있으므로 **승격 가드가 발동할 트리거가 없다**

`pending_plans` 실존 가드도 통과한다(파일은 있으니까). 어떤 가드도 "그 plan 이 가리키는
작업이 이미 끝났다" 는 물음을 던지지 않는다.

## 처리 (나중 머지 쪽)

- [x] **판정: `webchat-reload-rest-branches` 가 나중이었다.** #1130 이 먼저 머지돼
      `origin/main` 이 `partial` + `pending_plans:` 상태였고, 이 브랜치가 `origin/main` 을
      머지하면서 재판정을 이행했다(2026-08-10).
- [x] `webchat-reload-rest-error-branches.md` 를 `plan/complete/` 로 이동 + 항목 체크.
- [x] frontmatter `partial` → `implemented`, `pending_plans:` 제거(§3 승격 의무).
- [x] §R4 상단의 "결정은 내려졌으나 구현은 없다(Planned)" 고지 제거 — 이제 거짓이다.
- [x] §3.1 배너 제목 `⚠ v1 구현 현황(부분)` → `v1 구현 현황`, "그 외 오류 soft-fail" 이
      **미구현이 아니라 의도된 경계**임을 명시(안 고치면 다음 독자가 같은 CRITICAL 을 다시 연다).
- [x] `spec/0-overview.md` 의 "6문서 중 5문서가 implemented, 3-auth-session 은 partial"
      서술 동반 갱신 — **이 미러가 이번 재판정에서 가장 놓치기 쉬웠다**(체크리스트에 없었다).
- [x] 이동한 plan 을 가리키던 링크 4곳 경로 정정(`in-progress/` → `complete/`).

**교훈**: 이 문서가 "나중 머지 쪽이 처리" 를 3줄로 적어 뒀는데, 실제 이행 항목은 7개였다.
frontmatter 두 줄만 보고 있었고 배너 제목·§R4 고지·overview 미러·역링크 4곳은 목록에
없었다. **재판정 체크리스트는 "무엇을 바꾸나" 가 아니라 "그 사실을 어디어디가 복제하고
있나" 로 써야 한다.**

## 왜 커밋 메시지로 부족했나 (scope WARNING, 2026-08-10)

처음엔 이 의존을 커밋 메시지에만 적었다. reviewer 가 짚었고 옳다:

- PR 설명으로 승계된다는 보장이 없다(다중 커밋·squash·웹 UI 생성 시 유실).
- **`3-auth-session.md` 자체에는 아무 단서가 없다** — 그 파일을 여는 사람·에이전트
  (`project-planner`·`consistency-checker`·차후 아무 세션)는 이 의존을 알 방법이 없다.
- 이 저장소 관례상 "진행 중 조율이 필요한 사실" 은 `plan/` 또는 spec `## Rationale` 에
  남기는 것이 단일 진실 원칙에 부합한다.

`review/` 는 SoT 가 아니므로 리뷰 산출물에만 남기면 사라진다 — 이 세션에서 반복 확인한 것이다.

## 함께 남은 미확인 갭 — `start()` 경로의 401 (2026-08-10)

§R4 의 401 낙관적 refresh 는 `seedWaitingFromStatus` 안에 있고, 그 함수는 **두 호출부**가
쓴다 — `applyConfig`(복원)와 `start()`(신규 대화).

CRITICAL 수정(“호출부가 갱신 전 지역 변수로 `openStream` 을 부른다”)은 **두 곳 다** 고쳤지만,
**회귀는 복원 경로만 덮는다.** 실측: `applyConfig` 만 되돌린 뮤턴트는 RED, `start()` 만
되돌린 뮤턴트는 **초록**이었다.

`start()` 판 테스트를 쓰려다 SSE 가 아예 안 열려 실패했다. 통과할 때까지 구부리는 대신
남긴다 — **신규 대화 직후 `getStatus` 가 `401` 을 주는 경로가 실제로 도달 가능한지부터
확인이 필요하다.** 방금 발급된 토큰이라 도달 불가일 수도 있고, 그렇다면 그 분기는 방어
코드이고 테스트가 아니라 주석이 답이다.

- [ ] `start()` 경로에서 seed 가 `401` 을 받을 수 있는지 실측 (도달 가능성부터)
- [ ] 도달 가능하면 회귀 추가, 불가하면 그 사실을 코드 주석으로 고정(뮤턴트 생존이 정상임을 명시)

## refresh 동시 발화 경합 (2026-08-10, 두 라운드 연속 지적)

`refreshToken` 을 부르는 경로가 둘이고 **서로를 모른다**:

1. `use-token-refresh` 의 주기 타이머(만료 lead 기준 사전 예약)
2. `seedWaitingFromStatus` 의 `401` 낙관적 복구

평소엔 겹치지 않는다 — 후자는 `getStatus` 가 `401` 을 줘야 하고 그건 토큰이 이미 죽었다는
뜻이라, 정상 흐름에선 전자가 먼저 갱신해 그 상황을 만들지 않는다.

**문제는 `execution.replay_unavailable` 폴백이다**(`use-widget.ts` 의 SSE 핸들러).
그 경로는 **스트림이 열린 채** `seedWaitingFromStatus` 를 `void` 로 부른다(fire-and-forget).
즉 주기 타이머가 살아 있는 상태에서 401 복구가 동시에 돌 수 있고, 둘 다 `refreshToken` 을
낸다. 서버가 한쪽을 거부하면 **정상 세션이 `finalizeEnded("execution.token_revoked")` 로
오종료**될 수 있다.

### 왜 지금 안 고치는가

- **실측하지 않았다.** 이 경합이 실제로 발생하려면 (a) 버퍼 만료 폴백이 발화하고 (b) 그
  시점에 토큰이 이미 `401` 이며 (c) 주기 타이머가 같은 창에 발화해야 한다. 셋이 겹치는지
  재현해 보지 않았고, **재현 없이 고치면 무엇을 고쳤는지 모른다** — 이 저장소가 반복해 배운 것이다.
- 처방이 **설계 선택**이다: refresh in-flight 를 ref 로 단일화할지, 401 복구가 주기 타이머를
  먼저 취소할지, 아니면 `finalizeEnded` 를 "재차 `401`/`410` 이면서 in-flight 없음" 으로 좁힐지.
  셋이 실패 모드가 다르다.

### 처리

- [ ] 세 조건이 겹치는 창을 재현(폴백 발화 + 401 + 타이머 동시)
- [ ] 재현되면 in-flight 단일화 — 재현 안 되면 그 사실과 근거를 코드 주석으로 고정

> **두 라운드 연속 지적됐고, 첫 라운드에선 내가 채택도 보류도 하지 않고 흘렸다**
> (`16_09_40` RESOLUTION 에 다른 두 항목은 근거와 함께 명시 보류했는데 이것만 빠졌다).
> 그래서 두 번째 라운드가 "추적이 끊겼다" 고 짚었다 — 정확하다. 흘린 항목은 사라진다.

## `catch` 분기 세대 재검사가 회귀로 안 묶여 있다 (2026-08-10)

`recoverFromExpiredToken` 의 **성공** 분기 `isStale(gen)` 은 뮤테이션 RED 로 고정돼 있는데,
**실패(catch) 분기의 같은 검사는 제거해도 초록**이다(실측).

내가 RESOLUTION 에 "세대 재검사 2곳 뮤테이션 RED" 라고 적었으나 **절반만 참이었다** —
`16_26_09` testing 이 반증했다. 검증했다고 쓴 것과 실제로 검증한 것이 달랐다.

### 재현 시도와 그 결과

`newChat()` 으로 세대를 올린 뒤 붙잡아 둔 refresh 실패를 착지시켰는데 `ended` 로 갔다.
즉 그 인터리빙에서는 가드가 갈리지 않는다.

**재현 실패를 "결함 없음" 으로 읽지 않는다** — 인터리빙 지점이 가설의 일부이고, 편한
지점에서 끊으면 진짜 결함도 초록이다(이 저장소가 명시적으로 배운 것). 가드는 남기고
미검증 사실을 코드 주석에 못박았다.

### 처리

- [ ] 그 분기를 실제로 갈라내는 인터리빙 탐색 — `finalizeEnded` 가 world-scope 로 설계됐다는
      점(“종료는 세계의 사실이지 시도의 소유물이 아니다”)이 단서다. 세대만 올리는 것으로는
      부족할 수 있다.
- [ ] 갈리면 회귀 추가, 못 갈리면 **가드가 도달 불가한 이유**를 주석으로 확정(뮤턴트 생존이
      정상임을 명시 — 이 저장소의 동등 뮤턴트 처리 관례)

## 비-terminal refresh 실패 뒤 만료 토큰 재연결 (2026-08-10, security INFO)

종료 조건을 `401`/`410` 로 좁히면서 생긴 **인접 질문**이다. refresh 가 네트워크 오류로
실패하면 (2026-08-10 최종) `"refresh_deferred"` 를 돌려준다 — **토큰은 교체되지 않았으므로**
스트림은 열지 않고 `scheduleRefresh` 만 건다. 종전엔 호출부가 그 옛(만료된)
토큰으로 `openStream` 했고 `EventSource` 는 자동 재연결하므로 서버가 계속 401 로 거부하는
동안 재연결이 반복될 수 있다.

**이번 변경이 만든 것은 아니다** — 좁히기 전에도 `getStatus` 의 `401` 은 soft-fail 로 같은
토큰에 SSE 를 열었다. 다만 이제 그 경로가 **더 자주 도달 가능**해졌으므로 등재한다.

### 왜 지금 안 고치는가

- **실측하지 않았다.** `EventSource` 재연결 백오프가 있는지, 서버가 401 에 대해 스트림을
  어떻게 닫는지, 그 조합이 실제로 루프가 되는지 재보지 않았다.
- 처방이 갈린다: (a) 비-terminal 실패도 SSE 를 안 열고 다음 주기 갱신에 맡긴다,
  (b) `EventSource` 재연결 횟수를 제한한다, (c) 서버 401 응답에서 스트림을 닫고 위젯이
  종료 판정을 다시 한다. 셋의 실패 모드가 다르다.

### 처리

- [ ] 만료 토큰으로 SSE 를 열었을 때 실제 재연결 동작 실측(백오프·횟수·종료 조건)
- [ ] 루프가 확인되면 위 (a)~(c) 중 선택 — 아니면 그 사실을 주석으로 고정

### 정정 (2026-08-10, 같은 날)

이 절의 원 서술은 반환값이 `"continue"` 이던 시절 기준이다. 그 뒤 두 번 바뀌었다:

| 시점 | 반환값 | 왜 바뀌었나 |
|---|---|---|
| 최초 | `"continue"` | **거부된 토큰으로 SSE 오픈**(`16_42_07` CRITICAL) |
| 중간 | `"stale"` | **`scheduleRefresh` 소실 → 영구 고착**(`16_56_39` CRITICAL, 3명 독립 확인) |
| 최종 | `"refresh_deferred"` | 스트림만 건너뛰고 갱신은 예약 — 두 부작용이 반대 방향이라 전용 갈래가 필요했다 |

**따라서 이 절이 다루던 "만료 토큰 재연결" 위험은 최종 판에서 구조적으로 닫혔다.** 남는
질문은 좁다 — `refresh_deferred` 뒤 주기 갱신이 실제로 복구까지 이어지는지(백오프·횟수).

## 미해결 — `refresh_deferred` 는 고착의 절반만 닫는다 (2026-08-10 실측)

`"refresh_deferred"` 는 `scheduleRefresh` 소실(고착 원인 A)은 닫았지만 **스트림 부재(원인 B)는
그대로다.** side_effect reviewer 가 찾았고 직접 확인했다:

```
openStream( 호출부 전수 (widget/*.ts, 테스트 제외)
  use-widget.ts:732   → if (outcome !== "refresh_deferred") …
  use-widget.ts:1089  → if (!deferStream) …
```

**두 곳뿐이고 둘 다 `refresh_deferred` 에서 건너뛴다.** `use-token-refresh` 는 `openStream` 을
아예 부르지 않는다(grep 0건). `sessionRef` 는 `useRef` 라 갱신돼도 어떤 effect 도 재실행되지
않는다.

따라서 주기 갱신이 **몇 번을 성공하든 스트림은 영영 안 열린다.** `phase` 는 `streaming` 에
멈춰 `panel` 이 Composer 를 비활성화하므로, "다음 입력에서 401 → `sendCommand` 가 에러 처리"
라는 백스톱에 사용자가 **도달할 수 없다**.

부수: 그 지연 갱신이 나중에 진짜 `401`/`410` 을 받아도 storage 정리가 없어
spec §3.1-3("stale 토큰 잔존 금지") 불변식도 이 경로에서 깨진다.

### 왜 이 PR 에서 안 고치는가

처방이 **설계 선택**이고 셋 다 표면이 다르다:

- (a) `useTokenRefresh` 성공 시 스트림이 없으면 열게 한다 → 그 훅에 `openStream` 의존을
  주입해야 하고, 지금은 토큰만 다루는 단일 책임이다.
- (b) `refresh_deferred` 를 phase 전이로 바꿔(예: 복구 대기 표면) 사용자가 재시도할 수 있게 한다
  → `widget-state` 와 `panel` 까지 번진다.
- (c) 그 경로를 아예 종료로 되돌린다 → `webchat-boot-single-flight` 사고(살아있는 대화 유실)의
  재발이라 반대 방향으로 틀린다.

**이 PR 이 닫은 것과 안 닫은 것을 정확히 적는다** — `404`·복구불가 `401`/`410` 처리(원 목적)와
고착 원인 A 는 닫혔고, 원인 B 는 남는다. 종전 대비 **악화는 아니다**(종전에도 그 경로는
죽은 토큰으로 SSE 를 열어 같은 스피너에 머물렀고, 지금은 최소한 죽은 토큰을 안 쓴다).

- [ ] (a)/(b) 중 선택 — `useTokenRefresh` 의 단일 책임 대 상태기계 확장의 트레이드오프
- [ ] 선택 후 회귀: refresh 성공 뒤 스트림이 열리는지 / Composer 가 풀리는지
