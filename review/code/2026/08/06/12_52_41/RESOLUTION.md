# RESOLUTION — 8R (harness-review-ci-backstop)

리뷰어 14/14 (`testing` 은 rate limit 으로 1차 실패 → 재실행). **CRITICAL 2 / WARNING 11.**

**CRITICAL 이 5 → 2 로 줄었고, 성격이 완전히 바뀌었다.** 이번 라운드의 두 CRITICAL 중 어느
것도 "가드가 우회된다" 가 아니다 — 하나는 신뢰 모델(설계 결정), 하나는 **이 저장소 현재
작업 트리에서 재현되는 살아있는 결함**이다.

## C2 — plan_guard 가 7R 결함을 그대로 갖고 있었다 (testing, 실증)

7R 이 `review_guard._run_git` 의 `.strip()` 을 고쳤는데, **자매 훅 `plan_guard.py` 는 같은
코드를 독립 복제해 갖고 있고 거기는 안 고쳐졌다.** 이 저장소 작업 트리에서 그대로 재현된다:

```
$ git status --porcelain -- plan/
 M plan/in-progress/harness-review-gate-ci-backstop.md
→ pg._uncommitted_changes('.', 'plan/')
  ['lan/in-progress/harness-review-gate-ci-backstop.md']    # 'p' 유실
```

**방향이 옆집보다 나쁘다.** `review_guard` 쪽은 fail-open 이었지만 이쪽은 **거짓 차단**이다 —
plan 을 실제로 갱신했는데 "미갱신" 으로 읽혀 push 가 막힌다. 그리고 `plan_guard` 자신의 모듈
docstring 이 *"파싱 실패는 항상 not blocked"* 라고 약속하는데 정확히 그 반대다.
조건도 일상적이다: plan 을 고치고 커밋 전에 push — 이 프로젝트의 기본 흐름이다.

**왜 아무 테스트도 못 잡았나**: `test_plan_guard.py` 가 `_branch_changes` 를 통째로 mock 해서
`_run_git`/`_porcelain_path`/`_uncommitted_changes` 가 **스위트 전체에서 한 번도 실행되지
않았다**. 7R 이 얻은 교훈("헬퍼가 아니라 실제 저장소로 구동하라")이 자매 훅으로 전파되지
않은 것이다 — 코드 drift 와 **테스트 교훈 drift** 가 같이 일어났다.

**처분**: 같은 처방(`rstrip()` + `-c core.quotePath=false`)을 적용하고, 실제 임시 git 저장소로
세 형태를 고정했다(미스테이지 / 스테이지 / 비-ASCII). mutation 2종 RED.

## C1 — 신뢰 모델. 고치지 않고 `--enforce` 선행 조건으로 등재했다

게이트는 "리뷰가 실제로 수행됐는가" 가 아니라 **산출물의 존재와 형태**만 본다. 격리 저장소
실증: `codebase/` 1줄 + 손으로 쓴 3줄 `SUMMARY.md` → `--enforce` 통과, exit 0.

이 브랜치가 만든 결함이 아니다(`origin/main` 판정 로직이고 로컬 push 훅에서 오늘 이미 유효한
우회). 다만 이 브랜치가 그것을 PR-facing 게이트로 승격시키므로 `--enforce` 전 결론이 필요하다.

⚠️ **날짜 검사를 넣지 않았다.** 실측으로 갈렸다 — 미래 날짜 세션은 통과하고 과거는 막힌다.
그래서 "미래 세션 거부" 가 고쳐 보이지만 **공격자는 지금 날짜로 만들면 그만**이라 아무것도
닫지 못한다. 닫히는 것처럼 보이는 반쪽 조치는 넣지 않는다. plan 에 선행 조건으로 등재하고
선택지 셋(서명 트레일러 / CI 봇 check / 위조 가능성 명시적 수용)을 적었다.

## WARNING

| # | 내용 | 처분 |
|---|---|---|
| W2 | C-quoting 이 **committed 경로**에도 영향 — `_newest_commit_time` 이 인용 경로를 `git log -- <path>` 에 넘겨 매칭 실패 → `0.0` → Gate 1 이 **아무 오래된 리뷰로나** 통과 | `_run_git` 에 `-c core.quotePath=false`. 실측: `codebase/**` 2,464개 중 인용 유발 0개라 오늘은 도달 불가이지만 한 줄이라 correctness 로 |
| testing-W | 내 비-ASCII 회귀 테스트가 docstring 이 말한 **절반만** 단언(`_dirty_set` 만, `_newest_commit_time` 은 비어 있었다) | 커밋 후 `_newest_commit_time > 0.0` 단언 추가 |
| W6·W7 | 내가 이번 라운드에 쓴 문서 2건이 **존재하지 않는 함수명**을 인용(`_changed_code_files`, `_default_branch()`) | 각각 `_uncommitted_code_changes`/`_dirty_set`, `_merge_base()` 로 정정 |
| W5 | README 카탈로그 2행이 5R~8R 클래스를 반영 못함 | 두 행 모두 누적 불변식으로 재작성 |
| W3·W4·W8~W11 | `review_guard` god module · 테스트 헬퍼 중복 · `OneJudgeTest` 메서드 분해 · `_lib` 충돌 · Gate 선형 스캔 성능 · in-flight 마커 스코프 | 미처분 — 구조/성능이고 별도 범위 |

## 검증

- harness 스위트 **844 tests OK**.
- mutation 4종 RED: `plan_guard` `.strip()` 회귀 · `plan_guard` quotePath 제거 ·
  `review_guard` quotePath 제거 · (7R 분) `review_guard` `.strip()` 회귀.

## 라운드 성격 변화

|  | 1R~6R | 7R | 8R |
|---|---|---|---|
| CRITICAL | 3~5 | 5 | **2** |
| 성격 | 전부 가드 우회 | 4 우회 + **1 살아있는 결함** | **0 우회** + 1 살아있는 결함 + 1 설계 결정 |

우회는 8R 에서 **0건**이다. 남은 것은 (a) 자매 훅으로 새어 나간 같은 결함 — 처분 완료,
(b) 게이트의 신뢰 모델 — `--enforce` 전 사용자 결정. 가드 경화 경주는 여기서 끝났다고 본다.
