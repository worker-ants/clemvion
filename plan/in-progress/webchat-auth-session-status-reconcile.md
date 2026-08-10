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

- [ ] **#1130 이 나중이면**: 그 PR 의 frontmatter 변경(`partial` + `pending_plans:`)을
      **철회**한다 — 잔여가 이미 없으므로 `implemented` 가 맞다. 본문 §3.1 배너도 이미
      구현 반영된 상태인지 확인.
- [ ] **`webchat-reload-rest-branches` 가 나중이면**: main 의 frontmatter 가 `partial` +
      `pending_plans:` 이므로, 이 PR 안에서 `plan/in-progress/webchat-reload-rest-error-branches.md`
      를 `complete/` 로 옮기고 frontmatter 를 `implemented` 로 승격한다(§3 승격 의무).
- [ ] 어느 쪽이든 `plan/complete/` 로 간 뒤 이 plan 도 함께 종결.

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
