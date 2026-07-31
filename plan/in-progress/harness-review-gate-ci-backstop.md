---
title: 리뷰 게이트의 훅-독립 CI 백스톱 — 정규식이 유일 판정자인 사각지대를 닫을지
worktree: harness-review-gate-fixes-1bd6aa
started: 2026-07-25
owner: developer
priority: P2
---

> **2026-07-31 진행** — 아래 §관측 2건을 처리했다. 한 건은 **전제가 반증**됐고 그 자리에 다른
> 진짜 결함이 있었다. 본 티켓의 **주제(CI 백스톱)는 여전히 미착수**이며 설계 결정이 선행이다.
>
> | 항목 | 결과 |
> |---|---|
> | §관측(1) changeset 증분 산정 | **전제 반증** → 다른 결함으로 대체 수정 (아래) |
> | §관측(2) `SUMMARY pending` push 허용 | **수정 완료** (아래) |
> | §재발 관측 8번째 (번들 누락) | **수정 완료** — `harness-consistency-summary-downgrade-rule.md` 쪽에 기록 |
> | CI 백스톱 본체 | **미착수** — §결정이 필요한 지점 그대로 |

## Overview

[`harness-push-gate-did-not-fire`](../complete/harness-push-gate-did-not-fire.md) §M 에서 분리.
그 티켓은 push 탐지 정규식의 결함(newline separator 누락)을 고쳤다. 이 티켓은 그 근본 수정이
**닫지 못하는** 층을 다룬다.

## 문제 — 사후 탐지가 같은 사각지대를 공유한다

§M 이 고친 결함은 "`_GIT_PUSH` 가 여러 줄 push 를 못 잡아 게이트가 조용히 skip" 이었다.
자연스러운 방어책은 "게이트가 안 돌았음을 사후에 기록/탐지" 인데, **그게 성립하지 않는다**:

- push 가 실제 push 인지 판정하는 게 **바로 그 정규식**이다.
- 정규식이 push 를 놓치면, "게이트를 돌려야 했는데 안 돌았다" 는 사실 자체를 인지할 주체가 없다.
  fail-open 배너조차 `_is_git_push` 가 True 여야 찍힌다("not a push" 는 조기 return).
- 즉 사후 탐지 로직을 훅 안에 두면 **같은 판정자에 의존**해 같은 구멍으로 샌다.

## 후보 — 훅에 의존하지 않는 층

- [ ] **CI 게이트**: PR 에 `codebase/**` diff 가 있는데 그 변경을 커버하는 *해결된* 리뷰
      산출물이 없으면 CI fail. 훅(로컬 PreToolUse)과 **독립**이라 정규식 사각지대를 공유하지 않는다.
      - 리뷰 산출물(`review/code/**`)은 gitignored 라 PR 에 없다 → CI 가 무엇으로 "리뷰됨" 을
        판정할지 설계 필요(커밋 trailer? PR label? 별도 signed marker?).
- [ ] 대안: push 시 게이트 **통과 기록**(상태 파일 타임스탬프)을 남기고, 별도 감사에서
      "codebase 변경 push 인데 기록 없음" 을 탐지. 단 이것도 "codebase 변경 push" 판정에
      정규식이 끼면 부분적으로만 독립.

## 결정이 필요한 지점 (그래서 P2, 사용자/설계 판단)

- CI 가 "리뷰됨" 을 무엇으로 인식하는가 — gitignored 산출물을 CI 에 어떻게 노출하나.
- 로컬 훅과 CI 의 **이중 게이트**가 마찰(느린 CI·false block)을 얼마나 만드나.
- 이 저장소가 이미 `guard_review_before_push` 를 신뢰하는데, 두 번째 층의 비용 대비 이득.

## Rationale

**왜 P2 (즉시 아님).** §M 이 활성 결함(가장 흔한 push 형태 우회)을 이미 닫았다. 이 티켓은
"방어 심화" 이지 활성 구멍이 아니다. 그리고 CI 층은 설계 결정(리뷰됨 판정 메커니즘)이 선행이라
독립 범위다.

**왜 훅 안에서 안 닫나.** 위 §문제 — 자기 판정자에 의존하는 사후 탐지는 사각지대를 공유한다.
이 통찰 자체가 §M 조사의 산물이라 유실되지 않게 티켓으로 고정한다.

## 관측 — 리뷰 게이트를 거짓 통과시킬 수 있는 경로 2건 (2026-07-27, 실측)

`ie-resume-turn-boundary-cancel` PR 진행 중 **둘 다 실제로 발생**했다. 하나는 리뷰 자체를
무의미하게 만들고, 다른 하나는 그 상태로 push 를 허용한다. 위 CI backstop 논의의 직접 근거 사례.

### (1) changeset 산정이 증분이라 직전 fix 가 통째로 리뷰에서 빠진다

5라운드 리뷰의 changeset 이 **`testing.md` 1건**뿐이었다. 그런데 직전 라운드 fix 는
`codebase/backend/src/modules/execution-engine/` 아래 **5개 파일**을 바꿨다(개명 + 헬퍼 추출).
즉 그 코드는 **한 번도 리뷰되지 않은 채** "Critical 0 / LOW" 라는 수렴 신호만 나왔다.

- `--prepare --branch origin/main` 도, `--prepare --range origin/main..HEAD` 도 결과가 같았다
  (둘 다 1건) — **changeset 은 "직전 리뷰 세션 이후 변경분" 증분으로 산정되고 `--branch`/
  `--range` 는 그 산정에 쓰이지 않는 것으로 보인다.**
- 게다가 그 1건조차 동일 원자 커밋(`75967fab3`)에 함께 들어간 16개 형제 파일 중 하나만
  뽑힌 것이었다(리뷰어 scope 도 독립 지적).
- **우회(실측 성공)**: 파일을 positional 인자로 **명시** + `--route=all`
  → changeset 5건, router skip, 전수 14명 실행 확인.

- [x] ~~`--branch`/`--range` 가 changeset 산정에 실제로 반영되도록 수정~~ → **전제 반증**.
      실측하면 완전히 반영된다: raw `git diff --name-only origin/main~5...` 189건 =
      `get_git_branch_diff_files()` 189건 = `collect_change_infos(--branch)` 189건.
      `prepare_session` 도 받은 `change_infos` 를 그대로 쓰고 증분 필터가 없으며,
      `loop_mode` 는 config 에 저장만 되고 어디서도 읽히지 않는다(dead field).
      **진짜 결함은 기본 경로였다** — 인자 없는 `--prepare` 는 staged+unstaged+untracked,
      즉 "아직 커밋 안 된 것" 만 모은다. 리뷰 워크플로는 커밋을 먼저 하므로(push 게이트가
      커밋이 리뷰보다 앞서기를 요구) 그 시점 집합은 비거나 한두 개뿐이고, 리뷰어는 거의 빈
      코퍼스를 받는데 요약은 "Critical 0" 을 낸다. 실측(2026-07-31, 이 브랜치): 기본 **0건**
      vs `--branch origin/main` **6건**. 위 관측의 "1건" 도 이 경로였을 것이다.
      → **[x] 경고 구현**: 기본 경로에서 브랜치 diff 미포함분을 감지해 빠진 파일을 이름으로
      나열하고 `--branch <base>` 를 안내. changeset 자체는 불변(조용히 넓히면 호출자가 요청하지
      않은 파일을 리뷰하게 되고, 명시 모드는 이미 올바르다). git 실패 시 침묵.
      테스트 `test_review_changeset_warning.py` 9건 + mutation 4종 RED.

> 교훈: **"우회(파일 명시 + `--route=all`)가 통했다"는 사실이 원인 진단을 보증하지 않는다.**
> 우회가 통한 이유는 `--branch` 가 고장나서가 아니라 기본 경로가 커밋된 작업을 안 담아서였다.
> 두 설명 모두 같은 우회로 해결되므로 관측만으로는 갈리지 않는다 — 코드를 읽고 실측해야 갈린다.
- [ ] 동일 커밋의 형제 파일이 부분만 뽑히는 원인 확인

### (2) `SUMMARY pending` 세션이 push 를 허용한다

리뷰 Workflow 가 끝났지만 main 이 아직 `SUMMARY.md` 를 디스크에 쓰기 전 상태에서
`evaluate_review()` 가 이렇게 답한다:

```text
blocked: False
reason : a code review session is in flight (started, SUMMARY pending) — allowed
```

`SUMMARY.md` 를 기록한 직후 재판정하면 정확히 차단된다
(`8 codebase/ file(s) changed AFTER the most recent resolved review`).
즉 **세션 디렉토리만 만들어 두면 그 사이 push 가 열린다.** 메모리의 "빈 세션 디렉토리가
게이트를 거짓 통과시킴 — `blocked=False` 여도 reason 을 읽어라" 와 같은 클래스이며,
이번엔 정상 워크플로 진행 중에 자연 발생했다.

- [x] ~~in-flight 허용을 **시간 상한**으로 제한~~ → **시간 상한은 이미 있었다**
      (`_IN_FLIGHT_TTL_SECONDS = 1800`, checkout-immune 세션 디렉토리 타임스탬프 기준,
      `meta.json` 파싱 검증까지 포함). "무기한" 이라는 서술은 부정확했다.
- [x] **진짜 결함은 스코프였다 — 수정 완료.** push 가드(`guard_review_before_push.py:846`)와
      stop 가드(`guard_review_before_stop.py:340`)가 **같은 `evaluate_review()`** 를 부르는데,
      in-flight 억제가 그 함수 안에서 **무조건** 적용됐다. 그 억제의 목적은 Stop nudge 전용
      ("모델이 지금 돌리는 중인 리뷰를 두고 턴 종료를 막지 말 것")인데, 같은 함수를 쓰는
      push 까지 TTL(30분) 동안 열어 준 것이다.
      **자기 불변식이 거짓이었다**: `_IN_FLIGHT_TTL_SECONDS` 주석과 `_code_review_in_flight`
      docstring 이 둘 다 "the push guard still hard-gates" 라고 적어 뒀는데, 억제가 무조건인
      동안 그 문장은 참일 수 없었다.
      → `evaluate_review(cwd=None, *, in_flight_ok=False)` 로 opt-in 화하고 Stop 가드만
      `True` 를 넘긴다. push 호출부 무변경. 주석 2곳은 "opt-in 이라서 참" 이라는 근거를 붙여
      정정. 테스트: 양방향 분리 + Stop→evaluate_review seam 이 실제로 kwarg 를 넘기는지 단언
      (seam 단언이 없으면 kwarg 를 떨어뜨려도 결정 객체가 동일해 전부 통과한다). mutation 3종 RED.

> 부수 교훈: `evaluate_review()` 는 `blocked` 만 보지 말고 **`reason` 을 읽어야** 한다.

### 재발 관측 (2026-07-30 `19_00_25`) — 8번째

`--impl-done spec/5-system/` 에서 실제 target(`4-execution-engine.md`·`6-websocket-protocol.md`)이
5개 checker 프롬프트 **전원**에서 누락되고 무관 파일 3개(`1-auth.md`/`10-graph-rag.md`/
`11-mcp-client.md`)만 실렸다. 사전순 정렬 + 예산초과 조합, 같은 패턴 8번째.

완화 확인: 이번엔 checker **5명 전원**이 워크트리 직접 Read + `git diff` 로 우회해 결론 신뢰성에는
영향이 없었다. 다만 7번째 재발(`17_21_27`) 때는 5명 중 1명만 우회했고 **나머지 3명은 그 영역을
전혀 검토하지 못했다** — 우회는 checker 별로 불균등하므로 완화책으로 신뢰할 수 없다.
