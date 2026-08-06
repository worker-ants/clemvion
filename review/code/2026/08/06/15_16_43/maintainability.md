# 유지보수성(Maintainability) Review — Round 12

리뷰 대상은 라운드 11 리뷰(`review/code/2026/08/06/14_38_16`) 이후 실제로 바뀐 부분이다.
`git diff 9a7b28764..HEAD`(직전 리뷰가 본 커밋 → 현재 HEAD, 두 커밋: `4c221beca` 11R +
`9c270100f` .git/config 오염 사고 복구)로 diff 를 직접 재확인했다:

```
$ git diff 9a7b28764..HEAD --stat -- .claude .github scripts plan | grep -v '^ review/'
 .claude/_shared/git_probe.py                       |  40 ++++--
 .claude/hooks/_lib/plan_guard.py                   |   2 +-
 .claude/tests/test_plan_guard.py                   |   7 +-
 .claude/tests/test_review_gate_ci.py               |  14 ++-
 .claude/tests/test_review_guard_hardening.py       | 139 +++++++++++++++++++++
 .../in-progress/harness-review-gate-ci-backstop.md |  15 ++-
 6 files changed, 200 insertions(+), 17 deletions(-)
```

`.claude/hooks/_lib/branch_guard.py` · `.github/workflows/*.yml` ·
`.claude/tests/test_workflow_yaml_structure.py` · `.claude/tests/test_stop_guard_failopen.py` 는
이번 라운드에서 무변경이므로(위 diff에 없음) 재평가하지 않았다.

## 발견사항

- **[WARNING]** 이번 커밋이 막 고친 것과 똑같은 미보호 git 픽스처 사본이 **같은 파일 안에** 세 개
  더 남아 있다 — "사본 하나만 고치고 형제 사본은 놓친다"는 이 저장소가 7R~10R에 걸쳐 반복
  기록해 온 결함 클래스 그 자체가, 그 결함을 막 문서화한 커밋(`9c270100f`) 안에서 재현됐다.
  - 위치: `.claude/tests/test_review_guard_hardening.py:275`(`RebaseAuthorDateTest._git`, 클래스
    시작 257행), `.claude/tests/test_review_guard_hardening.py:588`
    (`NotesReachThePublicEntryPointTest._git`, 클래스 시작 567행),
    `.claude/tests/test_review_guard_hardening.py:677`
    (`UnstagedModificationKeepsItsPathTest._git`, 클래스 시작 652행)
  - 상세: 이번 라운드는 `.git/config` 오염 사고(§plan 13번, 2026-08-06)를 계기로
    `test_plan_guard.py:292-304`·`test_review_gate_ci.py:58-70`·`test_review_gate_ci.py:697-709`
    세 곳과, 새로 추가된 `ActionsCheckoutTopologyTest._git`(`test_review_guard_hardening.py:851`,
    `resolved == root or resolved.startswith(root + os.sep)` 단언까지 포함해 가장 강하게 보강됨)
    에 `-C <root>` + `GIT_CEILING_DIRECTORIES=<root>` 보강을 넣었다. 그런데 **같은 파일**
    (`test_review_guard_hardening.py`) 안에 이미 있던 세 개의 자매 `_git` 헬퍼
    (275/588/677행)는 여전히 `subprocess.run(["git", *args], cwd=self.root, ...)` 그대로다 —
    `-C` 도, `GIT_CEILING_DIRECTORIES` 도 없다. 넷 다 `tempfile.mkdtemp()` 로 만든 임시
    디렉터리에 실제 git 저장소를 `init` 하고 다양한 git 명령을 구동하는, 형태가 사실상 동일한
    보일러플레이트다(중복 코드 관점 #6). 정확히 이 클래스의 헬퍼(같은 파일의
    `ActionsCheckoutTopologyTest`)가 "임시 트리 밖에서 실행돼 공유 `.git/config` 를
    오염시킨" 실제 사고의 장본인이었다는 점을 고려하면, 형제 헬퍼들이 같은 처방 없이 남아
    있는 것은 재발 표면을 그대로 열어둔 것이다.
  - 이 갭은 plan 문서의 자체 회계에도 빠져 있다: `plan/in-progress/harness-review-gate-ci-backstop.md`
    §13(`13. 테스트 픽스처가 공유 .git/config 를 오염시킬 수 있다`)의 "잔여" 목록은
    `test_consistency_bundle_priority.py`·`test_consistency_impl_done.py`·`test_line_anchors.py`·
    `test_push_guard_worktree_scope.py` **네 개의 다른 파일**만 등재하고, "이 브랜치가 손댄 3개
    픽스처는 즉시 경화했다"고 적는다 — 그런데 이 브랜치가 **새로 만든** 파일 내 형제 헬퍼
    3개는 "손댄 픽스처"에도, "잔여" 목록에도 없다. 추적 문서 자체가 이 파일 안의 갭을 놓쳤다.
  - 제안: `.claude/tests/_harness.py` 에 `make_temp_git_repo()` 공용 헬퍼(plan 문서가 이미
    처방으로 적어 둔 것)를 두고 네 파일의 `_git` 전부(단일-root 형태와
    `ActionsCheckoutTopologyTest` 의 다중-저장소 형태 둘 다)를 그것으로 교체할 것. 최소한
    지금 라운드에서는 275/588/677행에도 `-C`/`GIT_CEILING_DIRECTORIES` 두 줄을 즉시 추가하고,
    plan 문서 §13 잔여 목록에 "같은 파일 내 3곳"을 추가해 다음 라운드가 다시 놓치지 않게
    할 것.

- **[INFO]** `git_probe.py` 모듈 최상단 docstring 이 라운드 7~10 의 발견을 순서대로 기록하는
  관례를 세워 뒀는데(`Round 7 found...` / `Round 8 found...` / `Round 9 moved...` /
  `Round 10 found...`), 이번 라운드(11R)에서 고친 `_default_branch` 의 `actions/checkout`
  위상 결함 — 스스로 "백스톱이 정작 그것을 위해 쓰인 환경에서 무력했다"고 부를 만큼 무거운
  결함 — 은 그 연대기에 없다.
  - 위치: `.claude/_shared/git_probe.py:1-30`(모듈 docstring, 10R에서 멈춤) vs
    `.claude/_shared/git_probe.py:139-168`(`_default_branch`, 11R 서사가 함수 내부 주석에만 있음)
  - 상세: 다른 파일을 참조하지 않고 이 모듈만 읽는 리더는 "5R까지의 사본 drift" 이야기만 보고
    "actions/checkout 위상에서 유일한 로컬 판정 경로가 존재하지 않았다"는, 이 파일에서 가장
    실전에 가까운 결함을 놓친다. 코드 자체는 정확하고 함수 단위 주석도 상세하지만, 이 모듈이
    스스로 세운 "라운드별 이력을 모듈 docstring 에 남긴다"는 컨벤션과 어긋난다(일관성 관점 #8).
  - 제안: 모듈 docstring 에 "Round 11 found `_default_branch`'s only reachable path under
    `actions/checkout` topology was a network call…" 한 문단을 추가해 연대기를 이어갈 것.
    코드 변경은 필요 없다.

## 요약

이번 라운드의 실제 diff(6개 파일, +200/-17)는 작다. 핵심 결함 수정(`git_probe._default_branch`
가 `actions/checkout` 위상에서 `refs/remotes/origin/<name>` 을 먼저 보도록 한 것)은 정확하고,
`if True:` 데드 조건 제거를 포함해 가독성도 개선됐다. 새로 추가된
`ActionsCheckoutTopologyTest`(139줄)는 문서화가 촘촘하고 순서 불변식까지 행위로 고정하는 등
이 저장소의 테스트 컨벤션을 잘 따른다. 다만 같은 커밋이 고치려던 바로 그 결함 클래스(사본 하나만
고치고 형제 사본을 놓친다)가, 그 결함을 고치는 과정에서 **같은 파일 안에** 다시 재현됐다 —
`-C`/`GIT_CEILING_DIRECTORIES` 보강이 4곳 중 1곳(새로 작성한 클래스)에만 가장 강하게, 다른
2개 파일에는 약하게(단언 없이) 적용됐고, 같은 파일의 나머지 3개 자매 헬퍼는 전혀 손대지
않은 채 plan 문서의 잔여 추적에도 빠졌다. 프로덕션 판정 경로(`git_probe.py`/`plan_guard.py`
본체)에는 이번 라운드에서 새로 도입된 결함이 없다.

## 위험도

LOW
