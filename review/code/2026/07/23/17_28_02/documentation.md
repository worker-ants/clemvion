# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 모듈 최상단 docstring 이 새 cross-worktree 평가 동작을 요약하지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py` 1-24행 (module docstring, "Contract" / gate 개요 문단)
  - 상세: 파일 최상단 docstring 은 여전히 "REVIEW gate / PLAN gate 가 각각 하나의 override 를 갖는다" 수준으로만 계약을 서술하고, 314-346행에 새로 추가된 "Which worktree(s) does this push publish?" 코멘트 블록(이번 변경의 핵심 — cwd 뿐 아니라 명령이 언급하는 checked-out branch 의 worktree 까지 평가)은 전혀 언급하지 않는다. 파일을 처음 훑는 사람은 상단 docstring 만 보고 "훅은 여전히 자기 cwd 만 본다"고 오해할 수 있다 — 정작 314행부터의 블록은 그 반대(과거엔 cwd 만 봤고 그게 false-ALLOW 버그였다는 것)를 매우 상세히 설명한다.
  - 제안: 상단 docstring 의 "Only `git push` commands are inspected…" 문단 뒤에 한두 줄로 "각 게이트는 cwd 뿐 아니라 push 명령이 이름을 언급한 다른 checked-out worktree 도 평가한다(자세한 설계는 `_push_targets` 위 코멘트 참고)" 정도를 추가해 at-a-glance 계약과 상세 설계 블록 사이 간극을 메우면 좋음. Critical 은 아님 — 상세 설명 자체는 정확하고 매우 충실함.

- **[INFO]** `guard_review_before_stop.py` 가 이번 fix 대상에서 제외된 이유가 어디에도 명시돼 있지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py` 314-346행 코멘트 블록 (신설) / `.claude/hooks/guard_review_before_stop.py` (미변경, 245행·262행에서 여전히 `evaluate_review()`/`evaluate_plan()` 무인자 호출)
  - 상세: 같은 `review_guard`/`plan_guard` 를 소비하는 `guard_review_before_stop.py` 는 이번 diff 에서 손대지 않아 여전히 cwd 단일 worktree 만 평가한다. Stop 훅은 "지금 이 턴이 끝나는 worktree" 자체를 판정하는 것이라 다른 branch 를 지목할 대상이 없어 구조적으로 스코프 밖이라는 설명은 타당해 보이지만, 그 판단이 코드·plan 어디에도 문장으로 남아있지 않다. 나중에 "왜 push 훅만 고쳤고 Stop 훅은 그대로인가"를 다시 조사하게 만들 소지가 있다.
  - 제안: 314행 블록 또는 plan 문서에 "Stop 게이트는 대상 branch 개념이 없어(자기 turn 종료 판정) 이 스코프 밖" 한 줄만 추가하면 향후 재조사 비용을 없앨 수 있음. 선택적.

## 검증한 항목 (문제 없음)

- `_worktree_branches` / `_mentions_branch` / `_accepts_cwd` / `_push_targets` 4개 신규 함수 모두 공개 계약·실패 모드(fail-open 방향, 2026-07-23 회귀 사례)를 구체적으로 docstring 에 남김. `_accepts_cwd` 는 "왜 TypeError 를 catch 하면 안 되는가"까지 실제 사고(초안이 9개 blocking 테스트를 전부 exit 0 으로 만든 사례)를 인용해 근거를 남겨 매우 우수함.
- `.claude/tests/README.md` 카탈로그에 `test_push_guard_worktree_scope.py` 행이 정확히 추가됐고, 서술 내용(false-ALLOW 회귀 pin, `_mentions_branch` 경계 매칭, cwd 상시평가, blanket-block 아님, BYPASS 여전히 적용)이 실제 테스트 파일의 6+3개 테스트 케이스와 1:1 대응함을 직접 대조 확인.
- `plan/in-progress/push-guard-worktree-scope.md` 는 문제·설계·Rationale·mutation 실측(M1-M4, 실제 테스트 파일의 assert 대상과 일치)·체크리스트를 모두 갖췄고, "harness 전체 476 passed" 주장은 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 재실행으로 실측 일치 확인(476 tests, OK).
- `_lib/review_guard.py::evaluate_review` / `_lib/plan_guard.py::evaluate_plan` 은 이미 `cwd: str | None = None` 시그니처였음(이번 diff 대상 아님) — `_accepts_cwd` 의 probe-and-degrade 설계가 실제로 필요했던 이유(스텁 테스트만 무인자)와 정확히 부합.
- `_REVIEW_MSG`/`_PLAN_MSG` 에 추가된 `worktree:` 라인은 두 포맷 모두 `.format(..., worktree=...)` 호출부와 정합하며, plan 문서의 "부수 개선" 서술과도 일치.
- CHANGELOG.md 는 이 저장소에서 제품(코드베이스) 사용자 기능 변경만 기록하는 문서로, 하네스 훅 변경은 관례상 대상 밖 — 갱신 누락 아님.
- README API 문서·환경변수 문서화 대상 신규 항목 없음(`BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 는 기존 변수, 이번 변경으로 신설되지 않음).

## 요약

이번 변경은 문서화 관점에서 전반적으로 매우 높은 수준이다 — 신설 함수 4개 전부에 실패 사례·근거 날짜까지 인용한 docstring이 있고, 테스트 카탈로그와 plan 문서(Rationale, mutation 실측 포함)가 실제 코드·테스트와 정확히 대응함을 직접 검증했다. 유일한 개선 여지는 모듈 최상단 docstring이 이번 PR의 핵심인 cross-worktree 평가 동작을 요약하지 않고 있다는 점과, 자매 훅인 `guard_review_before_stop.py`가 왜 스코프 밖인지가 문장으로 남아있지 않다는 점으로, 둘 다 INFO 수준이며 병합을 막을 사안은 아니다.

## 위험도

LOW
