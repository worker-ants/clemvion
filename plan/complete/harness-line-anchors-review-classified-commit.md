---
title: line_anchors 가드가 머지 커밋을 fixture 로 골라 오실패 (원 제목: "Review 분류" — 반증됨)
worktree: resumable-handler-generic-typing-3918dd
started: 2026-07-24
owner: developer
status: complete
priority: P2
---

## Overview

`test_line_anchors.py::PromptPayloadIntegrationTest` 가 **branch 의 커밋 모양에 따라**
오실패한다. PR [#1005](https://github.com/worker-ants/clemvion/pull/1005) 작업 중 발견했고,
그 PR 의 코드 결함이 아님을 실측으로 분리한 뒤 별건으로 넘긴 항목이다.

가드 자체가 신뢰할 수 없으면 **gutter 배선 회귀를 놓친다** — 그게 이 테스트의 존재 이유다.
반대로 특정 커밋 모양에서 상시 red 면 "원래 하나 빨간 건 정상" 이 되어 같은 결과다.

## 원인 — 규명 완료 (2026-07-24). 원 티켓의 가설 2개는 **반증**

### 진짜 원인: fixture 선별과 소비자가 **다른 git 뷰**를 본다

`_pick_commit_fixture` 는 `git show --numstat` 로 "변경 줄 수 ≥80" 커밋을 고르고,
orchestrator 의 `--commit` 경로는 `git show --no-renames --name-only --pretty=format:` 로
파일 목록을 만든다. **머지 커밋에서 이 둘이 갈린다**:

| 뷰 | 머지 커밋에서 |
| --- | --- |
| `git show --numstat` | **first parent 대비** diff (본 저장소 실측 `4a8cadf97`: 19파일 / 1,390줄) |
| `git show --name-only` | **combined diff** — 모든 파일이 한쪽 부모와 일치하면 **0행** |

→ 선별기는 통과시키고, `--prepare` 는 "No reviewable files found" 로 exit 0 + 프롬프트 0건
→ `assertTrue(prompts, "prepare wrote no prompts")` 실패.

`main` 은 squash-merge 라 최근 40커밋 전수 무해(실측: 문제 HEAD 0/40)지만,
**`origin/main` 을 브랜치에 머지해 들이는 순간** 발화한다 — 브랜치를 갱신하는 일상 방식이다.

### 반증 1 — `change_type: Review` 는 무관하다

`change_type` 은 경로 기반 분류가 **아니라** CLI 경로 전 파일에 붙는 하드코딩 상수다
(`code_review_orchestrator.py:959`). 리뷰 산출물의 meta.json 이 전부 `'Review'` 인 것은
같은 이유이지 분류 규칙이 아니다. gutter 생략과 아무 관계가 없다.

### 반증 2 — "gutter 주석이 전혀 없다" 는 **측정 오류**

원 티켓의 `grep -c '^\s*[0-9]\+│'` 는 `│`(U+2502 BOX DRAWINGS LIGHT VERTICAL)를 쓴다.
실제 구분자는 **ASCII `|`** (`line_anchors.GUTTER_SEP`). 같은 종류의 커밋을 무수정으로
다시 덤프하니 gutter 는 정상이었다(`602|`, `603|` …). 프롬프트에 `git show` 헤더(commit/
Author/Date)가 그대로 들어가는 것도 결함이 아니다 — 빈 gutter 셀(`   |`)이 붙어 있고,
`annotate_unified_diff` 는 hunk 헤더부터 번호를 매긴다.

> 원 티켓이 "추측 말고 양쪽 프롬프트를 덤프해 대조할 것" 이라 적어둔 그대로 했고,
> 그 결과 티켓 자신의 가설 두 개가 다 틀렸다.

## 조치

- [x] §미해결 규명 — 위 표. `origin/main` + docs-only 커밋이 통과한 이유는 #1001 이
      이미 `_pick_commit_fixture` 를 도입해 **작은 커밋을 건너뛰기** 때문. 원 티켓이 관측한
      두 대조(통과/실패)는 **다른 원인**이었고, 실패 쪽만 남아 있었다.
- [x] `change_type` 판정 기준 확인 → 상수. 수정 대상 아님.
- [x] 수정 방향 결정 → (b) 계열이되 "skip" 이 아니라 **선별 술어를 소비자와 일치**시킨다.
      파일 목록을 orchestrator 와 **같은 명령**으로 뽑고, 변경 줄 수를 그 파일들에 대해서만
      합산한다. 무조건 skip 이 아니므로 가드가 약해지지 않는다.
- [x] 회귀 고정 — `CommitFixtureSelectionTest`. 본 저장소가 아니라 **목적 저장소를 생성**해
      고정한다(main 은 squash-merge 라 그 형태가 최근 이력에 없어 vacuous 해진다).
      비-vacuity 테스트로 "그 저장소가 실제로 비대칭을 갖는지" 를 먼저 단언한다.
- [x] mutation 실측 — numstat-only 선별로 되돌리면 신규 2건 red, 원복 시 green.

## 참고

- 발견 맥락: `review/code/2026/07/24/01_25_15/RESOLUTION.md` · PR #1005 본문 §"알려진 실패".
- 원 티켓의 "#1003 이 `test_line_anchors.py` 를 편집" 도 부정확 — 실제 마지막 편집은
  #1001(`442ccc325`)이다. #1003 은 `lib/line_anchors.py` 쪽만 건드렸다.
