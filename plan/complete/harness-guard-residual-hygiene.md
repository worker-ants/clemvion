---
title: 하네스 가드 잔여 위생 — 중복 헬퍼·CI 설정 (§A 잔여 · §F W6)
worktree: harness-backlog-drain-2f36a2
started: 2026-07-24
owner: developer
status: complete
priority: P4
# `.claude/tools/**` · `.claude/tests/**` · `.github/workflows/**` 계열 — spec code glob 미매칭.
spec_impact: none
---

> **종결 (2026-07-24)**: 실착수 항목(W1·W3×2·W8·§F W6)은 #1009 로 전부 완료됐다. 남은 I1 은
> 추적 전용 항목인데 그 해소 경로(§G `fcntl.flock`)가 won't-do 로 마감돼, **수용된 잔여**로
> 정리하고 본 티켓을 종결한다(아래 §I1 처분). "main-root 3중복" 은 사유와 함께 미조치 유지.

## Overview

`harness-guard-followups.md` 의 §A 잔여 + §F W6 에서 이관. 개별로는 몇 줄짜리라 각각
티켓을 만들 가치가 없고, **한 PR 로 묶어 처리**하는 것이 효율적이다. 전부 비차단이고
서로 독립적이라 부분 처리해도 된다.

## 체크리스트

### 중복 제거 (동작 무관, 순수 위생)

- [x] **W1 — bootstrap 실패 경로 무신호.** `git rev-parse --git-common-dir` 실패 시 조용히
      `exit 0` 이라 "훅이 활성화된 적 없다" 와 "할 일이 없다고 판단했다" 가 밖에서 같아 보였다.
      → stderr 진단 1줄 추가. **"main 체크아웃 루트" 3중복 자체는 미조치** — 아래 §미조치 참고.
- [x] **W3(10_55_35) — bash mtime 헬퍼 네이밍 통일.** `file_mtime` → `_file_mtime`
      (reaper). 두 사본이 `grep -rn _file_mtime .claude/tools` 로 함께 잡힌다.
      공유 `_lib/*.sh` 는 **의도적으로 하지 않음** — `stat` 폴백 한 줄이 sourced 의존성을
      정당화하지 않고, 두 스크립트는 체크아웃이 반쯤 준비된 상태(=bootstrap 이 도는 그 순간)
      에서도 동작해야 한다. 그 판단을 양쪽 주석에 고정.
- [x] **W3(02_06_42) — 테스트 헬퍼 중복.** `_NodeStubDriverMixin` 으로 `_node_calls` +
      스텁 env 구성 추출. `_run` 은 구동 대상이 실제로 달라 각 클래스에 남긴다.

### CI·의존성 설정

- [x] **W8 — `harness-checks.yml` node 22 → 24** (다른 워크플로와 통일). 근거가 기록된 적
      없어 읽는 쪽이 "다른 데는 이유가 있겠지" 로 가정해야 했다. `node --test` 도 워크플로
      스크립트의 ESM 도 두 버전 모두 지원. `setup-python` 은 유지(이미 사유 주석 있음).
- [x] **§F W6 — `mermaid-lint/package.json` `"*"` → caret.**
      `jsdom ^29.1.1` · `mermaid ^11.16.0` (resolved major 기준), lockfile 동반 갱신.

### 미조치로 남긴 것 — 사유

- **"main 체크아웃 루트" 해석 3중복** (`bootstrap-session.sh:23` · `.githooks/pre-commit:27` ·
  `lint_mermaid_posttooluse.py:91`). W1 의 관측 가능성 쪽만 처리하고 중복은 남겼다.
  세 사본은 **호출 문맥이 다르다** — 셸 2개(하나는 git 이 실행), python 1개(하위 프로세스로
  git 호출) — 그래서 공유 스니펫이 되려면 셸/파이썬 양쪽 어댑터가 필요하고, 그 어댑터가
  원본보다 길다. pin 테스트 쪽도 세 사본이 **같은 한 줄**이라 drift 관측 가치가 낮다.
  W3 bash 헬퍼와 같은 판단이며, 재발견 시 이 문단을 근거로 오탐 처리할 것.

### I1 처분 — 수용된 잔여 (2026-07-24)

**I1 — hung `npm install`(타임아웃 없음)의 blast radius** 가 락 제거로 세션 1개 → 동시
콜드스타트 전체로 확대됐다(기존 W2 00_59_56 한계의 **도달성 변화**). 해소 경로는 둘이었다:

- `fcntl.flock` (→ [`harness-mermaid-install-concurrency.md`](harness-mermaid-install-concurrency.md) §G) —
  **won't-do 로 마감**(착수 조건 미충족).
- `timeout` 래핑 — **저렴해 보이나 아니다**: bootstrap 은 macOS(dev)·Linux(CI) 양쪽에서 돌고
  `timeout(1)` 은 macOS 기본 미탑재(`gtimeout` 필요)라 portable 래핑이 non-trivial. dev 툴
  린터 설치에 그 복잡도를 들일 근거가 없다.

→ **수용된 잔여로 종결.** 실제 hang 이 관측되면 그때 별건으로 재등록(portable timeout 또는
§G 재개). 지금은 마커-only 로 부분 설치가 영속하지 않는다는 실질 목표가 이미 달성돼 있다.

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
