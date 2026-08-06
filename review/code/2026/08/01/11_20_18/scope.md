# Scope Review — `harness-review-gate-ci-backstop` (round 2)

## 방법

`origin/main...HEAD` 전 구간과, 최근 2개 커밋(`f2896147b` feat, `fb463845d` fix 1R반영) 각각의
diff stat 을 떠서 프롬프트 번들(6개 파일)이 실제 변경분과 1:1로 일치하는지 확인했다. 추가로
"가드가 거짓일 때도 통과하는가"를 직접 실행해 검증했다(요청된 measurement-over-inspection).

```
git diff origin/main...HEAD --stat
 .claude/tests/README.md                              |   1 +
 .claude/tests/test_review_gate_ci.py                 | 378 ++++++++++++
 .github/workflows/harness-checks.yml                 |   3 +
 .github/workflows/review-gate.yml                    |  74 +++
 plan/in-progress/harness-review-gate-ci-backstop.md  |  48 +-
 review/code/2026/08/01/10_29_42/*  (1R 리뷰 산출물, 커밋된 채로 존재)
 scripts/check-review-gate.py                         | 120 ++++
```

`.claude/tests/README.md` / `.github/workflows/harness-checks.yml` 는 각각 **딱 1줄 추가**
(카탈로그 행, `paths:` 항목)로, 프롬프트에 담긴 "PyYAML 예외" 서술·`check-override-floors.py`
관련 내용은 **이 브랜치가 만든 것이 아니라** 이미 `origin/main`(`06c2651c9`)에 있던 것임을
`git log origin/main` 로 확인했다 — 번들이 전체 파일 컨텍스트를 보여주므로 신구 내용이 섞여
보이지만, 실제 diff 는 리뷰 게이트 CI 백스톱 한 줄뿐이다.

## 발견사항

- **[INFO]** 작업 트리에 미커밋 로컬 수정 1건
  - 위치: `.claude/tests/test_review_gate_ci.py` — `test_the_default_root_resolves_to_this_repository` 독스트링(약 148행 부근)과 `test_a_gate_that_raises_does_not_fail_ci`(약 176행 부근)
  - 상세: `git diff HEAD`로 확인. (1) 독스트링의 "13개 테스트가…" 를 "형제 테스트가…" 로 일반화(테스트 개수가 바뀌어도 stale 문구가 안 남게), (2) `.claude/hooks/_lib/review_guard.py` 절대경로를 직접 다시 쓰던 곳을 `self.gate_module` 재사용으로 교체 — 파일 자신의 `_run` 독스트링이 "세 곳에서 되풀이하던 경로… 리터럴이 흩어져 있으면 실패가 쉽다"고 적은 그 교훈을 스스로 한 곳 더 적용한 것. 둘 다 이번 라운드 스코프(이 테스트 파일의 정확성) 안이고 무관한 리팩토링이 아니다.
  - 제안: push 전에 커밋해 반영할 것(현재 working-tree 상태로만 존재).

- **[INFO]** 리뷰 도중 공유 워크트리에서 관측된 외부 변형(scope 판단에는 포함하지 않음)
  - 위치: `.github/workflows/review-gate.yml` (`run:` 스텝), `scripts/check-review-gate.py` (`_load_gate` 근방)
  - 상세: 리뷰 중 `git status`/`git diff` 를 반복 실행하며 실제로 (a) `run: python3 scripts/check-review-gate.py` → `run: true $GATE_FLAG`(env 경유), (b) `from os import walk as _w` 삽입, (c) `decision.blocked` 판정을 `os.path.getmtime` 기반 "제2 판정자"로 대체하는 변형이 **커밋되지 않은 실시간 상태**로 나타났다 사라졌다 했다 — 같은 워크트리에서 병행 중인 다른 테스트/리뷰 프로세스(뮤테이션 검증)로 보인다. 이 변경들은 diff·git log 어디에도 없고 review 대상 changeset 이 아니므로 이 changeset 의 스코프 위반으로 세지 않았다. 다만 이를 **측정 기회로 이용**했다: 실행한 실제 결과는 아래 "가드 실측" 참고.
  - 제안: 없음(정보 제공용). 최종 push 전 `git status`가 clean 한지만 재확인.

- **[INFO]** plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md`) 변경은 상태기록·실측치·defer 후속 목록뿐
  - 위치: 파일 전체(프런트매터 `worktree:` 필드, 상단 진행 요약 블록, `## 후보`/`## 결정이 필요한 지점` 섹션)
  - 상세: `worktree: harness-block-backstop-b56163` → `harness-review-ci-backstop-91f379` 정정(1R 리뷰 [W5], 삭제된 워크트리를 가리키던 결함), 체크박스 `[ ]`→`[x]` 전환 + 실측 표(435건 중 80건 미커버 등) 추가, 신규 발견 12건은 전부 **defer 로 남기고 코드에 손대지 않음**(예: `--branch`가 `--files`를 조용히 덮어쓰는 6R 발견은 다른 후속 PR에서 별도 처리됨이 커밋 메시지로 확인됨). 코드 스코프를 침범하는 즉흥 수정이 이 plan 갱신에 섞여 있지 않다.
  - 제안: 없음. 규약대로 진행 중 plan 갱신이며 스코프 이탈 아님.

## 가드 실측 (요청된 "거짓인데 통과하는가" 검증)

1. **`WorkflowWiringTest.test_a_step_actually_runs_the_script`** — 워크트리에 병행 프로세스가 실제로 만든 `run: true $GATE_FLAG` 변형에 대해 `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'` 를 그 순간 실행 → **FAIL**(정확히 잡음: `어느 step 도 스크립트를 실행하지 않는다`). 1R 우회 (b) 가 닫혀 있음을 라이브 상태로 확인.
2. **`OneJudgeTest.test_the_script_performs_no_judgement_operations_of_its_own`** — 같은 병행 프로세스가 삽입한 `from os import walk as _w` 에 대해 단독 실행 → **FAIL**(`'os.walk' unexpectedly found in {...}`). 1R 우회 (a)(pathlib.rglob 계열)의 자매 우회가 여전히 잡힘.
3. **`test_the_job_condition_exempts_dependabot` 우회 (a) 직접 검증** — 실제 파일을 건드리지 않기 위해 스크래치패드에 `if:` 를 지우고 같은 문자열을 `env.NOTE` 로 옮긴 변형 YAML을 만들어 동일 로직(`job.get('if','')` 후 `'dependabot[bot]' in cond`)을 재현 실행 → **AssertionError로 정확히 잡음**(`cond=''`). substring-grep 이었다면 통과했을 자리다.

세 우회 모두 라운드1이 실측으로 지적한 것과 동일 클래스이고, 지금 버전(`fb463845d`)에서 전부 잡힌다 — 코드 스코프 관점에서 "1R 지적 → 이번 라운드가 그 지적만 정확히 고쳤다"는 주장이 인용이 아니라 실행으로 확인됨을 의미한다(스코프 준수의 근거).

## 요약

`origin/main` 대비 diff 는 6개 파일(+ 1R 리뷰 산출물 디렉터리)로 정확히 좁혀져 있고, 각 변경은 "로컬 훅과 같은 `evaluate_review()`를 훅-독립 트리거(GitHub PR 이벤트)로 재실행하는 관측 모드 CI 백스톱"이라는 선언된 목적에 1:1 대응한다. README/harness-checks.yml 은 새 테스트 파일 하나를 등재하는 1줄짜리 변경뿐이며, 프롬프트 번들에 섞여 보이는 PyYAML/override-floors 서술은 이 브랜치가 만든 것이 아니라 이미 `origin/main`에 있던 이전 작업임을 `git log`로 확인했다. plan 문서 갱신은 실측치·상태기록·defer 목록으로 코드 스코프를 침범하지 않았고, 발견된 부가 결함(6R `--branch`/`--files` 우선순위, `_rank_plan_text` 이중 read 등)은 모두 이번 커밋에서 고치지 않고 명시적으로 후속 항목으로 분리돼 있다 — 이는 "지금 손대는 범위"와 "발견했지만 미룬 범위"를 정확히 가르는 좋은 관행이다. 요청된 가드 무력화 시도는 실제로(라이브 상태 관측 + 직접 재현) 실행했고 셋 다 잡힌다. 스코프 관점에서 지적할 결함이 없다.

## 위험도

NONE
