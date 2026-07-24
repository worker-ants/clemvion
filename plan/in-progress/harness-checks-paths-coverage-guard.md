---
title: harness-checks paths 미등재 클래스 체계 가드 — 5회 재발 (§I)
worktree: (unstarted)
started: 2026-07-24
owner: developer
status: in-progress
priority: P2
---

## Overview

`harness-guard-followups.md` §I 에서 이관.

> 출처: `review/code/2026/07/23/17_26_20` CRITICAL (documentation·requirement 독립 지적).

## 문제

`.github/workflows/harness-checks.yml` 의 `paths:` 는 "이 테스트 스위트가 지키는 파일" 을
**손으로** 등재한다. 누락되면 그 파일만 고친 PR 에서 **정작 그것을 지키는 테스트가 안 돈다** —
가드가 있는데 발화하지 않는, 없는 것보다 나쁜 상태다(있다고 믿게 되므로).

**같은 방식으로 5번 샜다**, 그때마다 주석으로 사후 기록만 남겼다:

| # | 누락됐던 경로 | 발견 계기 |
| --- | --- | --- |
| 1 | `.githooks/**` | 00_59_56 W3 |
| 2 | `.claude/_shared/**` | report-path SoT 리뷰 |
| 3 | `.claude/workflows/**` | BLOCK/RISK 판정 로직 |
| 4 | `.github/dependabot.yml` | 12_31_29 W5 |
| 5 | `.github/workflows/e2e.yml` | 17_26_20 CRITICAL |

5번째는 **e2e 면제 drift 가드를 새로 만든 그 PR 에서** 났다 — 가드가 자기 보호 대상을
등재하지 않아, 그 파일만 고치는 PR(= 가드가 막으려는 위험 방향의 전형적 diff)에서 안 돌았다.
같은 파일에 "paths 에 없으면 정작 자신을 지키는 테스트가 트리거되지 않았다" 는 문장이 이미
네 번 적혀 있었는데도 반복됐다. 개별 대응으로는 6번째가 온다.

## 선행 조건 — 등재 대상 경계 정의

유력한 형태는 `.claude/tests/*.py` 의 **모듈 레벨** `REPO_ROOT / ...` 상수를 추출해
`paths:` 커버 여부를 대조하는 것이다. 그런데 일부 테스트는 **의도적으로** `codebase/**` ·
`spec/**` 를 참조한다(`test_doc_sync_matrix.py` 가 harness↔product 바인딩을 검사하는 등).
그것들은 등재 대상이 아니다.

**경계를 먼저 정의하지 않으면 오탐으로 무력화된다** — 오탐 나는 가드는 곧 꺼진다.
이 정의가 작업의 절반이다.

## 체크리스트

- [ ] 등재 대상/비대상 경계 정의 (판정 규칙 + 예외를 사유와 함께 명시적 목록으로)
- [ ] 모듈 레벨 경로 상수 추출 가드 신설 — 파서는 **텍스트 주입 가능**하게 짜고 fixture 로
      경계를 먼저 고정(`test_dependabot_npm_coverage.py`·`test_e2e_exemption_paths_sync.py` 선례)
- [ ] 비-vacuity: 추출이 빈 결과면 실패 (가드가 조용히 아무것도 안 지키는 상태 차단)
- [ ] 과거 5건을 회귀 fixture 로 — 각각을 `paths:` 에서 빼면 가드가 잡아야 한다

## 관련

- `.github/workflows/harness-checks.yml`
- `.claude/tests/` (전체 — 대상 판정 입력)
- 선례: `.claude/tests/test_dependabot_npm_coverage.py`,
  `.claude/tests/test_e2e_exemption_paths_sync.py`
- 부모: [`harness-guard-followups.md`](harness-guard-followups.md) §I

## Rationale

**왜 개별 등재로 끝내지 않나.** 5회 재발은 우연이 아니라 구조다 — "테스트를 추가할 때
워크플로 `paths:` 도 갱신" 은 사람이 기억해야 하는 규약이고, 이 저장소가 반복 확인한 대로
그런 규약은 지켜지지 않는다. 같은 클래스를 이미 두 번(문서 미러 drift, e2e 화이트리스트)
테스트로 닫았고 그 방식이 통했다.

**왜 경계 정의가 선행인가.** 이 가드는 "모든 테스트가 참조하는 모든 경로" 를 요구하면 즉시
오탐 폭탄이 된다(`codebase/**` 를 등재하면 제품 코드 변경마다 harness 스위트가 돈다).
경계 없이 만들면 첫 오탐에서 꺼지고, 그러면 5회 재발이 6회가 된다.
