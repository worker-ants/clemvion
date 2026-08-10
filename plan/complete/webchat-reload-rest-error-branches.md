---
worktree: (unstarted)
started: 2026-08-10
owner: project-planner
---

# 웹채팅 새로고침 복원 — 잔여 REST 오류 분기(`404`·복구불가 `401`·낙관적 refresh)

**상태**: **완료**(2026-08-10, `claude/webchat-reload-rest-branches`). `3-auth-session.md` 의
`pending_plans` 에서 제거하고 `status` 를 `implemented` 로 승격했다 — 아래 §착수 시 함께 볼 것이
"의무" 라고 적어 둔 그 승격이다.

> 출처: `review/consistency/2026/08/10/12_56_30` — `convention_compliance` **CRITICAL** +
> `plan_coherence` **WARNING**. 두 checker 가 서로 다른 각도에서 같은 결함에 수렴했다:
> 전자는 "frontmatter 가 규약을 위반한다", 후자는 "그 잔여를 소유한 plan 이 없다".
> `webchat-usewidget-extraction` 티켓의 `--spec` 라운드에 딸려 나온 **기존 결함**(2026-07-05
> `6b25ccc3e` 이후 존속)이다. 유실 방지를 위해 본 문서를 만든다.
>
> **왜 그 PR 안에서 고쳤나 — 최초 서술이 "그 PR 범위 밖" 이라고 적었다가 정정했다.**
> 그렇게 쓰고는 정작 같은 PR 에서 고쳤으니 문서가 자기모순이었다(`13_21_24` scope WARNING).
> 실제 이유는 셋이다: (a) CRITICAL 대상 파일이 그 PR 이 **편집 중인 바로 그 파일**
> (`3-auth-session.md`)이라 분리하면 두 PR 이 같은 파일에서 충돌한다, (b) `--spec` 게이트는
> Critical 을 차단하므로 남겨 두면 그 PR 이 살아 있는 CRITICAL 위에서 머지된다,
> (c) 실제 코드 변경은 frontmatter 한 줄 + Rationale 캐비엇이고 **세 분기의 구현은 본
> 문서로 온전히 이연**됐다. 범위를 넓힌 것이 아니라 **게이트가 요구한 최소치**였다.

## 왜 등재하는가 — 한 달 넘게 아무도 소유하지 않았다

`spec/7-channel-web-chat/3-auth-session.md` §3.1 배너는 스스로 **"⚠ v1 구현 현황(부분)"** 이라
적고, 그 안에서 이렇게 자인한다:

> **`404`·복구불가 `401` REST 분기와 `401 → 낙관적 refresh 1회` 는 여전히 미구현(Planned)** —
> 그 외 status·오류는 `catch` soft-fail 후 SSE 로 진행한다. 이 잔여 REST 오류 분기·낙관적
> refresh 완전 구현은 후속 결정으로 남긴다.

그런데 frontmatter 는 `status: implemented` 였다 — `spec/conventions/spec-impl-evidence.md §3`
의 `implemented` 정의("**모든** 약속 구현 완료")를 정면으로 위반한다. `6b25ccc3e`(2026-07-05)
이후 한 달 넘게 그 상태였다.

**코드로 확인** (`use-widget.ts` `seedWaitingFromStatus` 의 `catch`): `getStatus` 실패는
상태코드 구분 없이 전부 soft-fail 로 뭉개져 SSE 로 진행한다. spec 서술이 정직했고, 틀린 것은
frontmatter 뿐이었다.

**이 클래스의 재발이다.** `eia-context-schema-followups.md` 의 "§R17 잔여" 항목이 정확히 같은
형태로 2026-07-10 에 등재됐다 — spec 이 잔여를 명시하는데 소유 plan 이 없어
`spec-impl-evidence` R-5(빈 약속 영구 누락) 리스크를 지는 상태. 자동 가드는 **본문 텍스트를
안 보므로** 이 드리프트를 구조적으로 못 잡는다(가드가 보는 것은 `code:` 경로 실존과
`pending_plans:` 실존뿐).

## 미구현 항목 (developer 트랙 — 동작은 이미 결정돼 있다)

> **최초 작성(2026-08-10)에서 이 절을 "결정이 필요한 항목" 이라 적었다가 같은 날 정정했다.**
> 재판정 라운드(`13_12_16`) `plan_coherence` WARNING 이 잡았고, 지적이 옳다.
>
> §3.1 의 "후속 결정으로 남긴다" 를 **동작 설계가 미정** 이라는 뜻으로 읽었는데, 실제로는
> 세 분기의 동작이 target 문서에 **이미 확정 서술로 적혀 있다** — §3.1 step 2 가 `404` 와
> `401` 의 귀결을, §R4 가 낙관적 refresh 의 근거까지. CLAUDE.md 규약상 `## Rationale` 은
> "결정의 배경·근거" 를 담는 자리이므로 §R4 는 **내려진 결정**이다. 유예된 것은 동작이
> 아니라 **언제 만들 것인가** 다.
>
> 내 자신의 커밋 `43423f830` 이 §R4 머리에 "**결정은 내려졌으나 구현은 없다**" 를 달아
> 놓고, 같은 턴에 만든 이 plan 은 그것을 "결정 필요" 로 되돌리고 있었다 — **한 턴 안의
> 자기모순**이다. 미결로 되돌리면 게이트가 영구 정체되거나, 열릴 때 기존 결정과 충돌한다.
>
> **귀결: 이 항목은 사용자 결정을 기다리지 않는다.** 명세대로 구현하면 되는 developer 트랙
> 작업이다.

- [x] **`404 EXECUTION_NOT_FOUND` 분기** — §3.1 step 2: storage 정리 후 `[ended]`.
      현행은 존재하지 않는 execution 에 SSE 를 여는 셈이다.
- [x] **`401` → 낙관적 `refresh-token` 1회** — §R4: 성공 시 SSE 재연결로 복원.
      전제는 EIA-AU-04/AU-05 상 클라이언트가 "만료 vs blacklist" 를 사전 판별할 수 없다는 것.
- [x] **복구불가 `401`(재차 실패) → 종료 확정** — §R4·§3.1 step 3: storage 항목 즉시 제거.
      구현 중 `410`(`EXECUTION_TERMINATED`)도 `/refresh-token` 이 실제로 내는 분기임이
      드러나 같은 갈래로 함께 닫았다.
- [x] **(명세에 없던 네 번째 갈래) 재차 실패가 `401`/`410` 이 아닐 때** — 종료로 보면
      일시적 장애가 대화를 끝내고, 진행하면 죽은 토큰으로 SSE 를 연다. 세션 유지 + 스트림
      유예 + 주기 갱신 성공 시 재개로 닫고 §R4 에 명문화했다. 이 갈래는 **리뷰 6라운드에
      걸쳐 세 번 형태가 바뀌었고**(`continue` → `stale` → `refresh_deferred`) 마지막엔
      "유예" 가 약속한 복구 배선 자체가 비어 있다는 CRITICAL 까지 나왔다 — 전말은
      `webchat-auth-session-status-reconcile.md`.

착수 시 원 서술과 어긋나는 점이 발견되면 그때는 planner 턴으로 되돌린다. 다만 **지금
아는 범위에서는 명세가 충분하다.**

> **형제 plan 과 같은 목록을 건드린다** —
> [`webchat-command-failure-is-not-termination.md`](./webchat-command-failure-is-not-termination.md)
> 는 §3.1-3 의 storage 정리 조건 열거에 "그 외 명령 실패" 를 **추가할지 결정**하는 제품
> 트랙이고, 본 plan 은 그 목록에 **이미 있는** 항목(`404`·복구불가 `401`)을 구현한다.
> 축이 다르지만 편집 대상 문단이 겹치므로, 나중 착수 쪽이 앞선 결과 위에서 재판정할 것.
> (`13_38_47` plan_coherence INFO — 두 plan 이 상호 링크 없이 같은 목록을 다루고 있었다.)

## 착수 시 함께 볼 것

- 세 분기 모두 `seedWaitingFromStatus` 한 함수의 `catch` 에 모인다 —
  `webchat-usewidget-extraction.md` 의 "남은 slice" 가 바로 그 함수를 훅으로 추출하는
  작업이라 **순서가 문제된다**. 추출이 먼저면 분기는 새 훅 안에 들어간다.
- 구현이 끝나 본 plan 이 `complete/` 로 이동하면 `3-auth-session.md` 는 `partial` →
  `implemented` 승격이 **의무**다(`spec-impl-evidence.md §3` 가드). → **이행함**(2026-08-10).
- 추출 순서 문제는 실제로는 발생하지 않았다 — 세 분기를 `seedWaitingFromStatus` 안에 그대로
  넣되 `401` 복구만 `recoverFromExpiredToken` 헬퍼로 분리했다. `webchat-usewidget-extraction`
  의 "남은 slice" 는 그 위에서 진행하면 된다.

## 본 PR 에서 한 것 (2026-08-10)

- [x] `3-auth-session.md` frontmatter `status: implemented` → `partial` + `pending_plans:` 에
      본 문서 등재. 규약이 결정적이라(본문이 미구현을 자인 ⇒ `implemented` 불가) 이 정정
      자체는 사용자 결정을 요하지 않는다. **위 3개 항목의 구현은 하지 않았다.**
- [x] §R4 머리에 "결정은 내려졌으나 구현은 없다(Planned)" 고지 + 본 문서 링크
      (`43423f830`) — Rationale 만 읽으면 현재 동작으로 읽히던 것.
- [x] 본 문서 §미구현 항목의 최초 "결정 필요" 프레이밍 정정 (재판정 `plan_coherence` WARNING).
