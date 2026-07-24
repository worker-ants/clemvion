---
title: line_anchors 가드가 "Review 분류" 커밋에서 오실패 (checked == 0)
worktree: (unstarted)
started: 2026-07-24
owner: developer
status: in-progress
priority: P2
---

## Overview

`test_line_anchors.py::PromptPayloadIntegrationTest::test_diff_blocks_are_annotated_and_correct`
가 **branch 의 마지막 커밋 내용에 따라** 오실패한다. PR [#1005](https://github.com/worker-ants/clemvion/pull/1005)
작업 중 발견했고, 그 PR 의 코드 결함이 아님을 실측으로 분리한 뒤 별건으로 넘긴 항목이다.

가드 자체가 신뢰할 수 없으면 **gutter 배선 회귀를 놓친다** — 그게 이 테스트의 존재 이유다.
반대로 지금처럼 특정 커밋 모양에서 상시 red 면 "원래 하나 빨간 건 정상" 이 되어 같은 결과다.

## 재현 (2026-07-24 실측)

branch `claude/push-guard-worktree-scope-20044c` 기준:

| HEAD 커밋 | 결과 |
|---|---|
| `3dc3a160a` (코드 3파일) | **PASS** — harness 전체 540 green |
| 그 뒤 머지 커밋(2-parent) | **FAIL** — `0 not greater than 20` |
| `c567b524e` (`plan/*.md` 1파일) | **FAIL** — 동일 |

`origin/main` 에서는 34 passed 이고, `plan/in-progress/harness-guard-followups.md` 에 1줄 추가한
**docs-only 커밋을 얹어도 여전히 34 passed** 였다 — 이 대조가 아직 설명되지 않는다(§미해결).

## 원인 (부분 규명)

테스트는 `_prepare_commit()` 으로 `--commit HEAD` 리뷰 프롬프트를 만든 뒤 `diff` 블록의 gutter
라인 수가 20을 넘는지 본다. 실패 케이스의 프롬프트를 덤프하면:

```
### 파일 1: plan/in-progress/push-guard-worktree-scope.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드 (unified diff)
```
   |commit c567b524e07b1f73093600eb24592d1106572284
```

- `변경 유형: Review` 로 분류되고
- diff 블록에 **gutter(줄번호) 주석이 전혀 없다**(`grep -c '^\s*[0-9]\+│'` → 0). 대신 `git show`
  원문(commit 헤더 포함)이 그대로 들어간다.

→ `checked == 0` → `assertGreater(checked, 20)` 실패. 프롬프트 25KB 라 **예산 소진이 아니다**
(잘림 표시도 없음).

## 체크리스트

- [ ] **§미해결 규명 우선** — `origin/main` + docs-only 커밋이 왜 통과했는지. 같은
      `plan/in-progress/*.md` 인데 결과가 갈린다. 파일 크기? 변경 줄 수? `change_type` 판정 기준?
      **추측 말고 양쪽 프롬프트를 덤프해 대조할 것** — 이 건에서 가설 두 개(머지 커밋 / 예산
      소진)가 연달아 틀렸다.
- [ ] orchestrator 가 `change_type` 을 `Review` 로 매기는 기준 확인(경로 기반? `plan/`·`review/`
      전부?). `review/code/2026/07/24/01_02_21/meta.json` 은 리뷰 산출물이 전부
      `'change_type': 'Review'` 다.
- [ ] 그 분류에서 gutter 주석을 생략하는 것이 의도인지 판정. 의도라면 **가드 쪽**을 고쳐야 한다.
- [ ] 수정 방향 결정:
      - (a) `Review` 분류에도 gutter 를 붙인다, 또는
      - (b) 가드가 "annotate 가능한 소스 diff 가 없는 커밋" 을 **좁게 정의해** skip 한다.
      **무조건 skip 은 가드 무력화**이므로 조건을 좁게 잡을 것.
- [ ] mutation 실측 — gutter 배선을 일부러 끊었을 때 여전히 red 인지 확인. 수정이 가드를
      약화시키지 않았음을 이것으로만 주장할 수 있다.

## 참고

- 발견 맥락: `review/code/2026/07/24/01_25_15/RESOLUTION.md` · PR #1005 본문 §"알려진 실패".
- #1003 이 `test_line_anchors.py` 를 편집해 실패 라인 번호가 **406 → 452** 로 이동했으나 증상
  (`checked == 0`)은 동일하다.
