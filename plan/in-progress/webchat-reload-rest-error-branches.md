---
worktree: (unstarted)
started: 2026-08-10
owner: project-planner
---

# 웹채팅 새로고침 복원 — 잔여 REST 오류 분기(`404`·복구불가 `401`·낙관적 refresh)

**상태**: 미착수. `3-auth-session.md` 가 `status: partial` 로 가리키는 **유일한 `pending_plans`** 다.

> 출처: `review/consistency/2026/08/10/12_56_30` — `convention_compliance` **CRITICAL** +
> `plan_coherence` **WARNING**. 두 checker 가 서로 다른 각도에서 같은 결함에 수렴했다:
> 전자는 "frontmatter 가 규약을 위반한다", 후자는 "그 잔여를 소유한 plan 이 없다".
> 무관한 티켓(`webchat-usewidget-extraction`)의 `--spec` 라운드에 딸려 나온 **기존 결함**이라
> 그 PR 범위 밖이고, 유실 방지를 위해 본 문서를 만든다.

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

## 결정이 필요한 항목 (planner 트랙 — 사용자 판단)

spec 본문이 **"후속 결정으로 남긴다"** 라고 명시적으로 유예한 사안이다. 따라서 본 plan 은
구현 착수 전에 아래를 먼저 판정해야 한다.

- [ ] **`404` 분기**: `getStatus` 가 `404` 를 주는 경우(= execution 이 사라짐) 위젯이 세션을
      폐기하고 `[ended]` 로 갈 것인가, 아니면 현행처럼 soft-fail 후 SSE 를 열 것인가.
      현행은 존재하지 않는 execution 에 SSE 를 여는 셈이다.
- [ ] **복구불가 `401` 분기**: refresh 로도 살아나지 않는 `401`(예: jti blacklist — 서버가
      이미 종료 처리) 을 종료로 볼 것인가. §R4 는 "낙관적 refresh 1회 후 종료" 를 설계로
      적고 있으나 구현이 없다.
- [ ] **`401 → 낙관적 refresh 1회`**: §R4 의 설계를 그대로 구현할 것인가. EIA-AU-04/AU-05 상
      "만료 vs blacklist" 를 클라이언트가 구분할 수 없다는 것이 이 설계의 전제다.

## 착수 시 함께 볼 것

- 세 분기 모두 `seedWaitingFromStatus` 한 함수의 `catch` 에 모인다 —
  `webchat-usewidget-extraction.md` 의 "남은 slice" 가 바로 그 함수를 훅으로 추출하는
  작업이라 **순서가 문제된다**. 추출이 먼저면 분기는 새 훅 안에 들어간다.
- 구현이 끝나 본 plan 이 `complete/` 로 이동하면 `3-auth-session.md` 는 `partial` →
  `implemented` 승격이 **의무**다(`spec-impl-evidence.md §3` 가드).

## 본 PR 에서 한 것 (2026-08-10)

- [x] `3-auth-session.md` frontmatter `status: implemented` → `partial` + `pending_plans:` 에
      본 문서 등재. 규약이 결정적이라(본문이 미구현을 자인 ⇒ `implemented` 불가) 이 정정
      자체는 사용자 결정을 요하지 않는다. **위 3개 결정 항목은 손대지 않았다.**
