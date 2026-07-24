---
title: harness-checks paths 미등재 클래스 체계 가드 — 5회 재발 (§I)
worktree: harness-checks-paths-guard-f6b2d9
started: 2026-07-24
owner: developer
status: complete
priority: P2
# `.claude/tests/**` + `.github/workflows/**` 전용 — 어떤 spec 의 `code:` glob 에도 미매칭.
spec_impact: none
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

- [x] 등재 대상/비대상 경계 정의 (판정 규칙 + 예외를 사유와 함께 명시적 목록으로) — §경계 정의
- [x] 모듈 레벨 경로 상수 추출 가드 신설 — `test_harness_checks_paths_coverage.py`. 파서 2개
      (`parse_paths_block` · `harness_target_paths`) 모두 **텍스트 in**, `*BoundaryTest` 가
      주입 소스로 경계를 먼저 고정(`test_e2e_exemption_paths_sync.py` 선례와 동형)
- [x] 비-vacuity: 필터·타겟 floor(`_MIN_FILTERS`·`_MIN_TARGETS`)로 빈 추출 차단
- [x] 과거 5건 + **신발견 6번째**를 회귀 fixture 로 (`KNOWN_COVERAGE_DEPENDENCIES`) —
      각 필터를 빼면 예시 파일이 uncovered 가 됨을 in-process 로 단언
- [x] **실제 갭 1건 발견·수정**: `.claude/config/**` (doc-sync-matrix.json 가드) 미등재 → 등재

## 경계 정의 — "작업의 절반" (2026-07-24)

세 규칙으로 등재 대상 선을 그었다. 각 규칙은 **가드를 무력화할 특정 오탐**을 막는다:

1. **모듈 레벨 `ROOT / "a" / "b"` 상수만.** 메서드 안에서 만드는 체인(`root / "codebase"`
   런타임 스캔, tempdir 조립)은 "지키는 파일" 이 아니라 런타임 연산이라 제외. AST 로
   함수/클래스 본문을 안 내려간다.
2. **디렉토리·팬텀이 아니라 tracked 파일.** CI `paths:` 는 **변경된 tracked 파일**만
   매칭한다. 그래서 중간 루트(`.claude`·`.github`·`scripts`)는 타겟이 아니다 — 그것을
   "커버" 하라고 요구하면 비-하네스 파일까지 끌어오는 과광역 `.github/**`·`scripts/**` 를
   강제하게 되고, **그게 바로 가드를 죽이는 오탐**이다. 루트 아래 실제 잎(`.github/dependabot.yml`
   ·`scripts/*.py`)은 개별 파일로 등재돼 파일로 검사된다. untracked(`.claude/state`)·
   팬텀(`does-not-exist.json`)은 저절로 빠진다.
3. **product 경로 제외.** 테스트가 `codebase/**`·`spec/**` 파일을 harness↔product 바인딩
   확인용으로 부를 수 있다(`test_doc_sync_matrix`). 그것들이 제품 변경마다 이 스위트를
   돌리게 하면 안 되므로 `codebase/ spec/ plan/ review/` 아래는 제외.

**알려진 한계(숨기지 않고 명시)**: 런타임에 디렉토리를 순회하며 어떤 파일도 모듈 레벨 상수로
이름 붙이지 않는 테스트는 이 검사에 안 보인다. 커버리지 단위는 파일이고, bare 디렉토리 참조는
정당하게 특정 파일 필터로 매핑된다(`.github/` 아래는 dependabot.yml 만 지킴, 전체가 아님).
6회 재발은 전부 파일 레벨이었다 — 이 가드가 잡는 클래스다.

## 발견 — 6번째 누락 (첫 실행에서)

`.claude/config/doc-sync-matrix.json`(12KB, tracked)은 `test_doc_sync_matrix.py` 의 모듈 레벨
`MATRIX_JSON = CLAUDE_DIR / "config" / "doc-sync-matrix.json"` 이 지키는데, `.claude/config/**`
가 `paths:` 에 없었다. 그 JSON 만 고친 PR 에서 스위트가 안 돌았다 — 티켓이 예측한 "6번째"
그대로다. 등재로 해소, mutation 으로 end-to-end 확인(등재 제거 시 스위트 RED).

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
