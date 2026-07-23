# RESOLUTION — §B reaper gh N+1 배치화

리뷰: `review/code/2026/07/23/13_02_53/SUMMARY.md` — RISK=LOW, Critical 0, **Warning 4**.
forced(router_safety) 7명 포함 9명 전원 결과 확보(`forced_missing: []`).

## Warning (4) — 전부 반영

| # | 카테고리 | 조치 |
|---|----------|------|
| 1 | Documentation / Requirement | plan 하단 `## 체크리스트` 의 `- [ ] B` 가 본문 §B 완료 표기와 모순 → `- [x] B — reaper gh N+1 배치화 (별건 PR)` 로 동기화(A·F 표기 패턴과 통일). |
| 2 | Documentation / Requirement | `.claude/docs/worktree-policy.md` 가 reap 의 조회 방식을 여전히 "`gh pr view <branch>` 단건" 으로 서술 → **stale**. "정리 대상·조건" 절에 **PR 상태 조회** 문단 신설: 배치(`gh pr list --state all --limit`) 우선, `--limit` 밖/실패 시에만 `gh pr view` 폴백, `claude/*` 0개면 배치 skip. throttle 항목에도 `REAP_GH_PR_LIMIT` 를 연결. 개별 bullet 의 "`gh pr view` 가 MERGED" 표현도 "PR 상태가 MERGED" 로 중립화. |
| 3 | Testing | `_GH_STUB` 의 `GH_CALL_LOG` 가 앞 3개 인자만 기록해(`pr list --state`) `--limit "$GH_PR_LIMIT"` 가 로그에 남지 않았다 → **`REAP_GH_PR_LIMIT` 가 실제로 gh 에 전달되는지 구조적으로 검증 불가**. 로그를 `"$*"`(전체 argv)로 확장하고, `test_pr_limit_override_reaches_gh` 추가(`pr_limit="7"` → 배치 호출에 `--limit 7` 단언). |
| 4 | Testing | 신규 `GH_PR_LIMIT` bad-value 가드(빈 값/비정수/`0` → 200)에 실행 기반 테스트 전무 → `test_bad_pr_limit_falls_back_to_the_default` 추가. `abc`/``/`0`/`-5` 4종을 subTest 로 돌려 배치 호출에 `--limit 200` 이 나타남을 단언. |

## 비-vacuity (스크래치 복사본 뮤테이션)

신규 2건이 실제로 회귀를 잡는지 확인 — 베이스라인 통과, 두 뮤턴트 모두 실패:

| 뮤턴트 | 결과 |
|--------|------|
| 배치 호출에서 `--limit "$GH_PR_LIMIT"` 제거 | 5 failures → 포착 |
| `case "$GH_PR_LIMIT" in ''\|*[!0-9]*\|0)` 가드 제거 | 3 failures → 포착 |

(첫 시도의 인라인 이스케이프가 치환에 실패했는데도 테스트가 붉게 나와 신호를 신뢰할 수 없었다.
치환 스크립트를 파일로 분리하고 `bash -n` 문법 검사 + 변이 지점 grep 으로 **뮤턴트가 의도대로
만들어졌음을 먼저 확인한 뒤** 재측정했다.)

## INFO 중 미반영(사유)

- INFO #1 (`awk` 첫-매치가 `gh pr list` 정렬에 암묵 의존): 동일 브랜치명으로 PR 이 여러 개일 때
  대표 PR 선택이 `gh pr view` 와 달라질 **이론적** 가능성. 최악 결과가 fail-safe 방향(reap 미실행)
  이고 빈도가 낮아 미조치.
- INFO #2 (`--limit` 밖 오래된 PR 은 폴백으로 N+1 재발 가능): **의도된 정확성 우선 트레이드오프**.
  배치가 판정 범위를 좁히지 않게 하려면 폴백이 필수다. 코드 주석·plan §B 에 명시됨.
- INFO #3 (`0` 을 배제하는 이유 주석): `--limit 0` 은 배치를 항상 빈 결과로 만들어 무의미해지므로
  기본값 복귀. 문구는 신규 테스트 docstring 이 설명하고 있어 중복 주석은 생략.
- INFO #4/#5 (배치가 OPEN/CLOSED 를 직접 반환하는 경로, hit+miss 혼재 케이스): 로직상 상태값에
  무관하게 동작하며 리뷰어도 "위험 낮음" 판정. Critical·Warning 0 수렴 원칙상 추가 churn 생략.
- INFO #6 (모듈 docstring·`.claude/tests/README.md` 한 줄 요약 갱신): README 카탈로그는 **선재
  drift**(다수 파일 미등재)라 별건. 모듈 docstring 은 신규 테스트 각각의 docstring 이 배치/폴백을
  충분히 설명한다고 판단.
- INFO #7/#8 (정수 가드 2회 중복, `awk` 선형 스캔): 리뷰어 스스로 "추출 임계값 미만"·"조치 불필요"
  로 판정.
- INFO #9 (`spec/` 무관): 내부 하네스 도구라 정상.

## 검증

- `python3 -m unittest test_reap_merged_worktrees` → **25 tests OK**(기존 18 + 배치 5 + limit 2).
- 실 `gh` dry-run 통합: exit 0, MERGED/OPEN 정확 판정, 미등재 브랜치는 폴백 경로.
