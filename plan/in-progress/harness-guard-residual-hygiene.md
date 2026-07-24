---
title: 하네스 가드 잔여 위생 — 중복 헬퍼·CI 설정 (§A 잔여 · §F W6)
worktree: (unstarted)
started: 2026-07-24
owner: developer
status: in-progress
priority: P4
---

## Overview

`harness-guard-followups.md` 의 §A 잔여 + §F W6 에서 이관. 개별로는 몇 줄짜리라 각각
티켓을 만들 가치가 없고, **한 PR 로 묶어 처리**하는 것이 효율적이다. 전부 비차단이고
서로 독립적이라 부분 처리해도 된다.

## 체크리스트

### 중복 제거 (동작 무관, 순수 위생)

- [ ] **W1 — "main 체크아웃 루트" 해석이 3곳 중복** (`bootstrap-session.sh` ·
      `.githooks/pre-commit` · PostToolUse 훅) **+ bootstrap 실패 경로 무신호.**
      공유 스니펫 추출 **또는** 3구현 pin 테스트 + bootstrap 실패 경로에 stderr 진단.
      선재(§A PR 이 도입한 것 아님). I4 계열 — reaper 에도 반복 등장하는 git-common-dir 중복.
- [ ] **W3(10_55_35) — bash mtime/cooldown 헬퍼가 `reap-merged-worktrees.sh` 와 중복**
      (`_file_mtime` vs `file_mtime`). python 은 `_lib/mermaid_lint_ready.py` 로 SoT 통합했는데
      bash 는 안 됐다. `.claude/tools/_lib/*.sh` 공유 또는 **최소한 네이밍 통일**.
- [ ] **W3(02_06_42) — 테스트 헬퍼 `_node_calls`/`_run` 도입부가 `test_mermaid_lint_ready.py`
      내부에서 중복.** 파일 안에서만 중복이므로 영향 최소.

### CI·의존성 설정

- [ ] **W8 — `harness-checks.yml` 만 node 22 / setup-python 사용** (다른 워크플로는 node 24).
      선재 CI 설정, 어느 diff 에도 안 들어 있다. 통일하거나 왜 다른지 주석으로 고정.
- [ ] **§F W6 — `mermaid-lint/package.json` 의 `jsdom`·`mermaid` 가 `"*"` range.**
      Dependabot 활성화로 **major bump 도 lockfile-only diff 로** 와서 리뷰어가 patch/major
      구분 신호를 잃는다. PROJECT.md "기본 caret" 정책과도 어긋남. resolved major 에 맞춰
      `^` 로 좁히기. 선재(`"*"` 는 PR #410~).

### 추적 전용 (독립 착수 대상 아님)

- [ ] **I1 — hung `npm install`(타임아웃 없음)의 blast radius** 가 락 제거로 세션 1개 →
      동시 콜드스타트 전체로 확대됐다. 기존 W2(00_59_56) 한계의 **도달성 변화**.
      `fcntl.flock`(→ [`harness-mermaid-install-concurrency.md`](harness-mermaid-install-concurrency.md))
      또는 timeout 래핑 시 함께 해소된다. 여기서는 track 목적으로만 유지.

## 관련

- `.claude/tools/bootstrap-session.sh`, `.claude/tools/reap-merged-worktrees.sh`
- `.githooks/pre-commit`, `.claude/hooks/lint_mermaid_posttooluse.py`
- `.github/workflows/harness-checks.yml`
- `.claude/tools/mermaid-lint/package.json`
- `.claude/tests/test_mermaid_lint_ready.py`
- 부모: [`harness-guard-followups.md`](harness-guard-followups.md) §A 잔여 · §F W6

## Rationale

**왜 묶었나.** 여섯 항목 모두 몇 줄짜리고 서로 독립이다. 개별 티켓 6개는 추적 비용이
작업량을 넘고, 부모 plan 에서도 이미 한 묶음으로 관리되고 있었다.

**왜 우선순위가 낮나.** 전부 비차단이며 대부분 **선재** 항목이다 — 어느 것도 지금
잘못 동작하고 있지 않다. W1 의 "bootstrap 실패 경로 무신호" 만 관측 가능성 측면에서
값이 있고, 나머지는 중복·설정 정합이다.
