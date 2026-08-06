# 변경 범위(Scope) Review — round 10

## 조사 방법

프롬프트가 잘려 전달되지 않은 파일(`review_guard.py`, `tests/README.md`,
`test_block_integrity.py`, `test_review_gate_ci.py`, `test_stop_guard_failopen.py` 일부)은
`Read` 로 직접 열어 확인했다. 프롬프트에 나열된 15개 파일 전부에 대해 `git diff origin/main`
으로 이 브랜치 전체의 실제 diff를 뽑고, 그중 이번 라운드(최신 커밋 `e834d0f4e`, 메시지상
"9R")가 무엇을 건드렸는지는 `git show e834d0f4e --stat` 로 별도 분리해 대조했다:

```
git diff origin/main --stat -- <15개 파일>   # 브랜치 전체 누적 diff
git show e834d0f4e --stat                    # 이번 라운드만
```

이번 라운드가 실제로 건드린 파일은 8개다: `.claude/_shared/git_probe.py`(신규),
`.claude/hooks/_lib/{branch_guard,plan_guard,review_guard}.py`,
`.claude/tests/README.md`, `.claude/tests/test_plan_guard.py`,
`.claude/tests/test_review_gate_ci.py`, `.claude/tests/test_review_guard_hardening.py`
(+ 이전 라운드 리뷰 산출물 `review/code/2026/08/06/13_33_32/**`, 코드 아님).
나머지 7개 페이로드 파일(`test_block_integrity.py`, `test_stop_guard_failopen.py`,
`test_workflow_yaml_structure.py`, `harness-checks.yml`, `review-gate.yml`,
`plan/in-progress/harness-review-gate-ci-backstop.md`, `scripts/check-review-gate.py`)은
이전 라운드(1R~8R)에서 이미 커밋된 것으로, 페이로드가 "전체 컨텍스트"를 실어 함께
포함시킨 것이지 이번 라운드의 변경이 아니다. 둘 다 확인했다.

## 발견사항

이번 라운드(및 브랜치 전체)에서 의도된 범위(리뷰 게이트의 훅-독립 CI 백스톱 구현 및
그 배선/판정 로직 경화) 밖으로 나간 변경을 찾지 못했다.

- **[INFO]** 변경 범위 자체는 커밋 메시지가 선언한 항목([C1] risk-parsing `break` 결함,
  [C3] git 프로브 3중 손-복제 → `_shared/git_probe.py` 위임, [C2·W3] `_SCANNED` env 스캔
  사각, [W1] import-time `sys.path` 오염, [W2/W4/W5] 죽은 try/except·미사용 import·mojibake
  정정, [W6] README 동기화)와 정확히 일치한다. 초과분을 찾지 못했다.
  - 근거: `git show e834d0f4e` 전체 diff를 라인 단위로 대조. `_run_git`/`_repo_root`/
    `_default_branch`/`_merge_base`/`_porcelain_path` 5개 함수는 세 훅에서 완전히
    제거되고 `.claude/_shared/git_probe.py`(신규, 155줄)로 옮겨져 `_run_git =
    _git_probe._run_git` 형태로만 재바인딩됐다 — 로직 추가·변경 없는 순수 이동.

- **[INFO]** `import subprocess` 는 세 훅(`branch_guard.py`/`plan_guard.py`/
  `review_guard.py`) 모두에서 제거됐고, 다른 곳에 잔존 사용이 없다.
  - 검증: `grep -n "^import subprocess" .claude/hooks/_lib/{branch_guard,plan_guard,review_guard}.py`
    → 매치 없음. `from branch_guard import _origin_default_branch` 형태의 옛 손-복제
    import 도 3개 파일 어디에도 남아있지 않다(`grep -rn "from branch_guard import"
    .claude/hooks/_lib/` → 매치 없음).

- **[INFO]** `.claude/_shared/git_probe.py`의 `_origin_default_branch`(파일 1, 34~59행)는
  W1이 지적한 "import 시점 `sys.path` 오염"을 호출 시점 지연 해석(`importlib.util` 로
  `branch_guard.py`를 CALL 시점에 로드)으로 고쳤을 뿐, 새 공개 표면이나 새 기능을
  추가하지 않았다 — 순수한 버그 수정.
  - 검증: `grep -n "sys.path" .claude/_shared/git_probe.py` → 모듈 스코프에 `sys.path`
    변경 코드가 없고, 함수 34~59행 내부(`_origin_default_branch`)에만 지역 import로
    존재.

- **[INFO]** 재복제 방지 테스트(`GitProbesAreNotReDuplicatedTest`, `test_plan_guard.py`)와
  `RiskHeadingDecoyTest`(`test_review_guard_hardening.py`)는 커밋 메시지가 명시한 [C1]/[C3]
  각각의 회귀 캔버스이고, 임의로 커버리지를 넓힌 흔적(관계없는 헬퍼·엣지케이스 추가)이
  없다. 두 테스트 클래스만 직접 실행해 통과를 재확인했다:
  `python3 -m unittest test_review_guard_hardening.RiskHeadingDecoyTest
  test_plan_guard.GitProbesAreNotReDuplicatedTest -v` → `Ran 5 tests … OK`.

- **[INFO]** `.github/workflows/{harness-checks,review-gate}.yml` 변경(이번 라운드 밖,
  이전 라운드 누적분)은 전부 "이 배선이 조용히 꺼지지 않게" 트리거 glob·주석을 갱신한
  것으로, 신규 로직이나 무관한 워크플로 변경이 섞여 있지 않다. `check-review-gate.py`
  신규 추가(130줄)도 계획 문서(`plan/in-progress/harness-review-gate-ci-backstop.md`)가
  명시한 "관측 모드 백스톱" 하나만 구현한다 — 그 이상의 CLI 옵션·부가 기능 없음.

- **[INFO]** 프로젝트 관행상 리뷰 세션 산출물(`review/code/**`)이 코드 PR과 함께 커밋되는
  것은 이 저장소의 정상 워크플로(메모리: "review/ 는 gitignored 아님")이며, 이번 커밋에
  포함된 `review/code/2026/08/06/13_33_32/**`(이전 라운드 리뷰 리포트)도 그 관행에
  해당한다. 스코프 이탈 아님.

- **[INFO]** 문서/주석 분량이 각 함수마다 수~수십 줄에 이르지만(예: `_run_git`의
  `core.quotePath=false` 근거 주석, `git_probe.py` 모듈 헤더의 라운드별 이력), 이는
  이 코드베이스 전반(변경 전 `review_guard.py`/`plan_guard.py` 원본에도 동일 분량의
  주석이 이미 있었다)에 이미 확립된 컨벤션이고, 이번 라운드가 새로 도입한 스타일이
  아니다. 불필요한 주석 변경으로 분류하지 않았다.

## 요약

이번 라운드(커밋 `e834d0f4e`, "9R")의 실제 diff는 커밋 메시지가 선언한 CRITICAL 3건 /
WARNING 6건(중복 항목 제외)과 1:1로 대응하며, 그 외의 리팩터·기능 추가·무관한 파일 수정·
포맷팅 전용 변경·불필요한 주석/임포트 변경·의도치 않은 설정 변경을 찾지 못했다. 페이로드에
포함된 나머지 7개 파일은 이전 라운드에서 이미 커밋된 상태를 "전체 컨텍스트"로 함께 실은
것으로, 이번 라운드의 diff가 아니며 확인 결과 그쪽에서도 CI 백스톱 기능(워크플로 트리거·
게이트 스크립트·배선 가드 테스트·plan 문서) 범위를 벗어나는 항목은 없다. 라운드 지침이
경고한 "리뷰 중 워크트리 선제 편집" 문제는 현재 작업 트리가 클린한 상태(`git status`
확인)로 재발하지 않았다.

## 위험도

NONE
