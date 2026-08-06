# 유지보수성(Maintainability) Review — CI 백스톱 (round 9)

## 중요 — 리뷰 대상과 작업 트리가 어긋나 있음

`_prompts/maintainability.md` 가 담은 `plan_guard.py`/`review_guard.py` 전체 컨텍스트는
round 8 HEAD(`88ce9994d`)의 내용이다. 그런데 위치 표기 규약이 요구하는 대로 실제 파일을
`Read` 로 직접 열어 대조하는 과정에서, **현재 작업 트리에는 프롬프트에 없는 커밋 전(unstaged)
변경이 이미 올라와 있다**는 것을 발견했다:

```
$ git status
Changes not staged for commit:
	modified:   .claude/hooks/_lib/plan_guard.py
	modified:   .claude/hooks/_lib/review_guard.py
Untracked files:
	.claude/_shared/git_probe.py
```

`.claude/_shared/git_probe.py` (mtime 13:36, 세션 시작 13:33:32 이후·본 리뷰 배포 이후)는
아래 발견사항 1이 지적하려던 바로 그 중복(`_run_git`/`_repo_root`/`_default_branch`/
`_merge_base`/`_porcelain_path` 5개 함수의 손-복제)을 `plan_guard.py`/`review_guard.py`
양쪽 모두 이 신규 모듈에 위임하는 방식으로 이미 제거했다. 즉 **내가 프롬프트만 보고 지적하려던
1순위 결함이 이 리뷰가 도는 동안 다른 프로세스에 의해 이미 손질되는 중**이다. 작업 트리를
직접 수정하지 않는다는 규칙에 따라 그대로 두고, 아래 발견사항은 **현재 작업 트리의 실제 내용**
기준으로 적는다(줄 번호는 `Read` 로 직접 연 실제 파일 기준 — 프롬프트의 게이트 숫자와 다를 수
있음을 각 항목에 명시했다). 이 커밋 전 변경 자체가 아직 미완성 상태이므로, 오케스트레이터는
이 변경을 이번 라운드의 일부로 커밋해 마무리할지, 되돌릴지부터 판단해야 한다.

## 발견사항

- **[WARNING]** (배경, 프롬프트 스냅샷 기준) `plan_guard.py`/`review_guard.py`가 `_run_git`·
  `_repo_root`·`_default_branch`·`_merge_base`·`_porcelain_path` 5개 함수를 **AST 기준
  완전히 동일한 로직**으로 손-복제해 갖고 있었다(docstring/주석만 다름 — 직접 AST 덤프 비교로
  확인). 이 정확한 중복이 이미 두 라운드에 걸쳐 실제 회귀를 냈다: 7R 이 `review_guard.py`의
  `_run_git`에서 `.strip()` → `.rstrip()` 로 고쳤는데 그 수정이 `plan_guard.py`의 동일 함수에는
  전파되지 않았고, 8R 이 그 잔존 결함(선행 공백 손실 → plan 경로 첫 글자 손실 → 이미 갱신한
  plan 이 "미갱신"으로 오판돼 push 가 거짓 차단)을 이 저장소 자신의 작업 트리에서 재현했다.
  `report_paths`/`retry_state`처럼 이 쌍을 하나로 묶는 `AgreementTest` 류 행위 테스트가
  없었다 — 두 스위트 모두 git 헬퍼를 목으로 스텁해 `_run_git`/`_repo_root`/`_merge_base`가
  **어느 쪽 테스트에서도 실행되지 않았다**(`test_plan_guard.py`의
  `PorcelainPathSurvivesOnARealRepoTest`, `test_review_guard_hardening.py`의
  `UnstagedModificationKeepsItsPathTest`가 나중에 실물 구동 커버리지를 추가했지만, 두 사본이
  "같은 로직이어야 한다"를 직접 고정하지는 않는다).
  - 위치: `.claude/hooks/_lib/plan_guard.py` / `.claude/hooks/_lib/review_guard.py`
    (프롬프트에 실린 round-8 스냅샷 기준 — `plan_guard.py` 98~175줄,
    `review_guard.py` 224~314줄 부근의 다섯 함수)
  - 제안: 아래 발견사항 2에서 보듯 이미 `_shared/git_probe.py` 로 추출하는 작업이 진행 중이다.
    그 작업을 완료·커밋하고, `test_report_paths_shared.py::AgreementTest` 와 같은 패턴으로
    "두 모듈이 같은 객체를 참조한다"를 행위로 고정하는 테스트를 추가할 것.

- **[WARNING]** (현재 작업 트리, 커밋 전) 위 중복을 `.claude/_shared/git_probe.py` 로
  추출하는 리팩터가 진행 중이지만 **죽은 코드를 남겼다**:
  1. `import subprocess` 가 `plan_guard.py`(49번째 줄)와 `review_guard.py`(115번째 줄)
     양쪽에서 더 이상 쓰이지 않는다 — `_run_git` 이 `git_probe.py` 로 옮겨가며 `subprocess.*`
     호출도 함께 옮겨갔는데 import 문만 남았다(두 파일 모두 `grep -n "subprocess\."` 결과 0건).
  2. `try: from branch_guard import _origin_default_branch / except: _origin_default_branch
     = None` 블록이 `plan_guard.py` 66~71번째 줄과 `review_guard.py` 124~129번째 줄에
     그대로 남아 있는데, 이제 `_default_branch` 는 `_git_probe._default_branch` 를 그대로
     가리키는 별칭이라(각 파일 116/213번째 줄 부근 `_default_branch = _git_probe._default_branch`)
     이 지역 `_origin_default_branch` 이름을 읽는 코드가 파일 안에 더는 없다(두 파일 모두
     `grep -n "_origin_default_branch"` 결과가 그 try/except 자체 2줄뿐). `branch_guard`
     해석은 이제 `git_probe.py` 내부가 독자적으로 (자기 `sys.path` 조작으로) 수행한다 — 즉 이
     블록은 남아 있어도 아무 것도 하지 않는 채, 다음 사람이 "이게 아직 쓰이는 폴백"이라고
     오해하게 만든다.
  3. `plan_guard.py` 64번째 줄의 `THIS_DIR = os.path.dirname(os.path.abspath(__file__))` 도
     더 이상 어디서도 참조되지 않는다(`_CLAUDE_DIR` 계산은 별도로 3단계 `os.path.dirname` 을
     직접 체이닝해서 한다 — 57~59번째 줄).
  4. 삭제된 함수 자리에 빈 줄이 과도하게 남았다 — `review_guard.py` 217번째 줄(마지막 델리게이션
     대입) 뒤로 7줄 연속 빈 줄(218~224번째 줄), `plan_guard.py` 120번째 줄 뒤로 4줄 연속
     빈 줄(121~124번째 줄).
  - 위치: `.claude/hooks/_lib/plan_guard.py:49,64,66-71,120-124` /
    `.claude/hooks/_lib/review_guard.py:115,124-129,217-224` (현재 작업 트리 실제 줄 번호 —
    프롬프트 스냅샷과 다름, 직접 `Read` 로 확인)
  - 제안: 커밋 전에 정리할 것 — 미사용 import 제거, 이제 죽은 `_origin_default_branch`
    try/except 제거(또는 `git_probe.py` 가 이미 하는 일과 중복이라는 주석과 함께 완전히
    삭제), `THIS_DIR` 제거, 빈 줄을 PEP8 관례(top-level 사이 2줄)로 정리.

- **[INFO]** `.claude/_shared/git_probe.py` 모듈 docstring 5번째 줄에 깨진 문자가 섞여 있다:
  "all five 匹 identical" — `匹`(중국어 문자, "짝/필")가 영문 문장 중간에 이유 없이 끼어
  있다. 인코딩 문제이거나 오타로 보인다.
  - 위치: `.claude/_shared/git_probe.py:5`
  - 제안: 커밋 전에 오타를 바로잡을 것(의도했던 단어를 알 수 없어 정확한 대체어는 원 작성자
    확인 필요 — "all five were identical" 류로 추정).

- **[INFO]** 새로 추출된 `.claude/_shared/git_probe.py` 가 `.claude/tests/README.md` 의
  테이블과 `test_plan_guard.py` 모듈 docstring 어디에도 아직 반영되지 않았다.
  `test_plan_guard.py` 1~11번째 줄은 여전히 "`plan_guard.evaluate_plan()` composes
  git-backed helpers plus two filesystem readers"라고만 적어 그 git 헬퍼들이 이제 `_shared`
  모듈로 옮겨갔다는 사실을 말하지 않고, `README.md` 의 `test_review_guard.py`/
  `test_plan_guard` 행도 "Git/fs helpers are patched (hermetic)"로만 서술해 새 공유 모듈을
  언급하지 않는다. 전용 `test_git_probe.py` 도 없다 — 실물 구동 커버리지는 `pg._run_git`/
  `rg._run_git` 가 같은 객체를 가리키므로 간접적으로는 여전히 성립하지만(`test_plan_guard.py`
  의 `PorcelainPathSurvivesOnARealRepoTest`, `test_review_guard_hardening.py`의
  `UnstagedModificationKeepsItsPathTest`), 이 저장소가 다른 곳에서 강하게 지키는 "문서·테스트가
  모듈과 동기화되어야 한다"는 관행(`.claude/tests/README.md` 의 파일별 행, `doc-sync-matrix.json`)
  과 어긋난다.
  - 위치: `.claude/tests/README.md`(해당 테이블), `.claude/tests/test_plan_guard.py:1-11`
  - 제안: `git_probe.py` 추출을 커밋할 때 README 행과 두 테스트 파일 docstring을 함께 갱신할 것.
    이 저장소가 `_lib` 네임스페이스 충돌 해소를 전제조건으로 미뤄 둔 다른 중복(플랜 문서의
    "기본 브랜치 해석 4곳") 목록에도 `plan_guard._default_branch`가 다섯 번째 사본으로
    빠져 있었다는 점을 함께 반영하면 좋다.

- **[WARNING]** 실 git 저장소를 만들어 구동하는 `_git`/`_write` 헬퍼 쌍(둘 다 `GIT_CONFIG_GLOBAL`
  격리 + author/committer env 세팅 + `subprocess.run(["git", *args], ...)`, 약 12~15줄)이
  최소 3개 파일 6개 테스트 클래스에 근-완전 동일하게 반복된다:
  `test_plan_guard.py::PorcelainPathSurvivesOnARealRepoTest`,
  `test_review_guard_hardening.py::{RebaseAuthorDateTest, NotesReachThePublicEntryPointTest,
  UnstagedModificationKeepsItsPathTest}`,
  `test_review_gate_ci.py::{ReviewGateCliTest, TheRealGateIgnoresTheEnvironmentTest}`.
  `test_review_gate_ci.py` 자신의 `_run()` 메서드 docstring(79~82줄)은 정확히 이 클래스의
  중복 위험을 지적한다 — "`env` 를 받는 이유: 이게 없어서 notes 테스트가 같은 호출을 손으로
  다시 타이핑한 두 번째 `subprocess.run` 을 갖고 있었다" — 그런데 같은 파일이 `_git`/`_write`
  자체는 두 클래스에 그대로 중복해 갖고 있다. plan 문서의 후속 13번 항목("fresh-interpreter
  테스트 보일러플레이트가 4개 파일에 복제")은 다른 헬퍼(`run_in_orchestrator`/`_PREAMBLE`,
  consistency orchestrator 스위트용)를 가리키므로 이 `_git`/`_write` 중복은 별도이고
  아직 등재돼 있지 않다.
  - 위치: `.claude/tests/test_plan_guard.py`(`PorcelainPathSurvivesOnARealRepoTest._git`/
    `._write`), `.claude/tests/test_review_guard_hardening.py`(세 클래스 각각의
    `_git`/`_write`), `.claude/tests/test_review_gate_ci.py`(`ReviewGateCliTest._git`/
    `._write`, `TheRealGateIgnoresTheEnvironmentTest._git`/`._write`)
  - 제안: `_harness.py` 에 `RealGitRepoTestCase` 믹스인(또는 함수 헬퍼)으로 추출해 한 곳만
    고치면 되게 할 것 — 이미 이 저장소가 plan 문서 13번에서 인정한 것과 같은 처방.

## 요약

이번 라운드에서 프롬프트가 담고 있던 `plan_guard.py`/`review_guard.py` 스냅샷은 두 라운드에
걸쳐 실제 회귀(round 7 fix 미전파 → round 8 재발견)를 낸 5개 함수 완전 중복을 그대로 갖고
있었다. 그런데 리뷰 도중 실제 작업 트리를 열어 보니, 그 중복을 `.claude/_shared/git_probe.py`
로 추출하는 수정이 이미 커밋 전 상태로 올라와 있어 구조적 위험 자체는 해소되는 방향이다 —
다만 그 리팩터가 죽은 import·죽은 폴백 블록·과도한 빈 줄을 남긴 미완성 상태이고, 문서(README·
docstring)와 전용 테스트가 아직 따라가지 못했다. 이 저장소가 같은 중복-쌍 실패를 `report_paths`
/`retry_state`에서 이미 두 번 겪고 정식 처방(공유 모듈 추출 + 행위 테스트로 두 소비자의 합의를
고정)을 확립해 둔 것을 감안하면, 이번 추출도 그 패턴을 끝까지(정리 + 문서 갱신 + agreement
test) 마무리해야 다시 갈리지 않는다. 그 외에는 실 git 저장소 구동 테스트 픽스처(`_git`/`_write`)
가 3개 파일에 걸쳐 반복되는 정도이며, 나머지 리뷰 대상 파일(워크플로 YAML, `check-review-gate.py`,
`test_workflow_yaml_structure.py`)은 함수 길이·중첩·네이밍·매직넘버 측면에서 특기할 문제가
없었다 — 방대한 인라인 주석은 8라운드에 걸친 우회 시도 이력을 근거로 정당화되어 있고 코드
자체의 복잡도를 부풀리지 않는다.

## 위험도

MEDIUM — 핵심 구조적 결함(중복이 야기한 실 회귀)은 이미 해소 방향이나 커밋 전 미완성 상태이고,
이 라운드의 리뷰 대상(프롬프트 스냅샷)만 놓고 보면 여전히 유효한 중복이 존재해 프롬프트 기준
리포트로는 WARNING 급 구조 부채가 남아 있다.
