# 요구사항(Requirement) 리뷰 — round 12 (git config 오염 사고 복구 + 픽스처 경화)

## 스코프 확인

`git diff origin/main...HEAD --stat` (213 files, +21618/-233) 로 브랜치 전체 diff 를 확인했고,
round 12 자체의 diff(`git show HEAD`)는 4개 파일(`test_plan_guard.py` · `test_review_gate_ci.py` ·
`test_review_guard_hardening.py` · `plan/in-progress/harness-review-gate-ci-backstop.md`)로 좁다 —
공유 `.git/config` 오염 사고 복구와 픽스처 3개 경화가 이번 라운드의 실제 변경분이다. 이 리뷰는
그 변경분의 요구사항 충족 여부(= "손댄 픽스처가 실제로 임시 트리 밖에서 죽는가", "전수 조사가
전수인가")를 실측으로 검증했다.

작업 원칙 준수: 저장소 밖 `mktemp -d` 를 쓰지 않고 **읽기 전용**으로만 검증했다(코드 실행은
harness 자체 스위트를 그대로 돌린 것뿐). `TMPDIR=/var/folders/.../T/` 로 저장소 트리 밖임을
사전 확인한 뒤 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 를 실행 — **854
tests OK** (commit 메시지의 주장과 일치), 이후 `git remote -v` / `git status --short` 로 원격·
워킹트리 오염 없음을 재확인했다.

## 발견사항

- **[WARNING]** 사고 재발 방지의 "전수 조사"가 전수가 아니다 — 하드닝한 바로 그 파일 안에서도
  같은 취약 패턴이 3곳 더 남아 있다
  - 위치: `.claude/tests/test_review_guard_hardening.py` — `RebaseAuthorDateTest._git`
    (L275, subprocess 호출 L286-288) · `NotesReachThePublicEntryPointTest._git` (L588,
    subprocess 호출 L594) · `UnstagedModificationKeepsItsPathTest._git` (L677, subprocess 호출
    L683). 추가로 `.claude/tests/test_consistency_context_budget.py:284`.
    plan 문서의 잔여 목록: `plan/in-progress/harness-review-gate-ci-backstop.md:199-203`
    (§신규 후속 13번 항목).
  - 상세: 이번 커밋(`9c270100f`)은 "11R 에서 `actions/checkout` 위상을 재현하려 만든 픽스처의
    `git remote add origin` 이 워크트리 쪽에서 실행돼 **공유** `.git/config` 를 오염시켰다(워크트리
    5개가 그 파일을 공유해 다른 세션의 fetch/push 까지 깨졌다)"는 실제 사고를 복구하고,
    "이 브랜치가 손댄 픽스처 3개의 `_git` 헬퍼가 임시 트리 밖에서는 즉시 죽는다"고 커밋 메시지에
    명시하며, `realpath` 로 임시 루트 하위인지 단언(`assert`) + `git -C` + `GIT_CEILING_DIRECTORIES`
    세 가지를 방어선으로 세웠다고 서술한다. 실제로 고쳐진 것은 `ActionsCheckoutTopologyTest._git`
    (L851, 실제 사고가 난 픽스처) 하나뿐이고, 여기에만 `assert resolved == root or
    resolved.startswith(root + os.sep)` 가 있다. `test_plan_guard.py`·`test_review_gate_ci.py`
    (×2)의 `_git` 은 `-C`+`GIT_CEILING_DIRECTORIES` 만 받았다(assert 없음 — 다만 이 셋은 `_git(self,
    *args)` 로 `self.root` 를 setUp 에서 한 번만 `os.path.realpath(tempfile.mkdtemp())` 로 고정해
    재대입되지 않으므로, "계산된 cwd 가 드리프트"할 표면 자체가 없어 assert 부재는 상대적으로
    저위험이다). 문제는 그 다음이다 — **`test_review_guard_hardening.py` 안에 있는 나머지 3개의
    `_git` 헬퍼(`RebaseAuthorDateTest`·`NotesReachThePublicEntryPointTest`·
    `UnstagedModificationKeepsItsPathTest`)는 여전히 원래의 취약 패턴
    (`subprocess.run(["git", *args], cwd=self.root, ...)`) 그대로다** — `-C` 도
    `GIT_CEILING_DIRECTORIES` 도 없다. 이 셋도 `self.root` 를 `tempfile.mkdtemp()` 로 한 번만
    설정하는 동일한 저위험 형태이므로 위험도는 낮지만, 위험도가 낮다는 것과 "이 라운드가 손댄 파일
    안의 sibling 헬퍼를 놓쳤다"는 것은 별개다. `plan/in-progress/harness-review-gate-ci-backstop.md`
    의 §신규 후속 13번("잔여: 같은 노출이 pre-existing 4곳에 있다 — `test_consistency_bundle_priority.py`
    `test_consistency_impl_done.py` · `test_line_anchors.py` ·
    `test_push_guard_worktree_scope.py`")은 이 저장소 전체를 검색한 결과라고 주장하는데, 실측
    (`grep -rn 'subprocess.run(\["git"' .claude/tests/*.py | grep -v '"-C"'`)하면 그 4곳 외에도
    `test_review_guard_hardening.py` 자체의 3곳과 `test_consistency_context_budget.py:284` 가
    나온다 — 총 8곳 중 4곳이 "전수 조사"에서 빠졌고, 그중 3곳은 **바로 이 라운드가 편집한 파일**
    안에 있다. 이 저장소가 반복해서 기록해 온 실패 클래스와 정확히 같다(§M `report_paths`/
    `retry_state` 손-동기 drift, 10R git-probe 통합에서 6번째 `_current_branch` 를 손으로 쓴 목록이
    빠뜨린 것과 동형) — **열거는 도출을 대신할 수 없고, "픽스처 3개"·"pre-existing 4곳"이라는
    사람이 손으로 센 숫자는 실제 개수(4개 처리·4개 잔존)와 어긋난다.**
  - 제안: (a) 커밋 메시지/plan §13 의 "픽스처 3개가 전부 assert 로 죽는다"는 서술을 실제 상태와
    맞게 정정 — assert 는 `ActionsCheckoutTopologyTest` 하나뿐이고 나머지 둘은 `-C`+ceiling 만
    받았다는 사실을 반영. (b) `test_review_guard_hardening.py` 의 나머지 3개 `_git` 헬퍼와
    `test_consistency_context_budget.py:284` 를 §13 잔여 목록에 추가하거나, 이번에 함께
    `-C`+`GIT_CEILING_DIRECTORIES` 로 경화. (c) 근본적으로는 plan 이 이미 제안한 대로
    `_harness.py` 에 `make_temp_git_repo()` 공용 헬퍼를 두고 이 방어선을 한 곳에만 넣는 것 —
    "몇 곳에 있는지 손으로 세는" 이 클래스의 반복을 구조적으로 없앤다. (d) 손으로 목록을 다시
    셀 필요가 없도록, `test_workflow_yaml_structure.py`/`GitProbesAreNotReDuplicatedTest` 가 이미
    쓰는 "도출" 패턴을 흉내내 `.claude/tests/*.py` 전체를 스캔해 `-C` 없이 `cwd=` 로 git 을 부르는
    호출을 실패시키는 가드 테스트를 추가하는 것도 고려할 만하다(이번 사고 클래스가 네 번째로
    재발하는 것을 막는 방향).

- **[INFO]** spec 본문 부재 — 이번 변경 영역은 `spec/` 문서로 정의돼 있지 않다
  - 위치: N/A (해당 영역 자체가 `spec/` 밖)
  - 상세: `spec/` 전체를 `review-gate|check-review-gate|review_guard|CI 백스톱` 으로 grep 했으나
    일치하는 문서가 없다. 이 기능은 `.claude/` harness/CI 계층(개발 도구)이라 제품 `spec/` 의
    대상이 아니며, 유일한 문서는 `plan/in-progress/harness-review-gate-ci-backstop.md` 다 —
    프로젝트 관례상 정상(harness 변경은 `spec/` 승인 대상이 아님).

## 요약

round 12 diff(공유 `.git/config` 오염 사고 복구 + 픽스처 3개 경화) 는 **실제로 작동한다** — 실측으로
확인: 원격 URL 정상, 워킹트리 오염 없음, harness 스위트 854 tests 전부 통과, 사고가 난
`ActionsCheckoutTopologyTest` 는 `assert`+`git -C`+`GIT_CEILING_DIRECTORIES` 세 겹으로 제대로
경화됐다. 다만 이 라운드가 스스로 내세운 "전수 조사"·"픽스처 3개가 전부 assert 로 즉시 죽는다"는
서술은 실제 코드와 어긋난다 — 같은 파일 안에 동일 취약 패턴을 가진 `_git` 헬퍼가 3개 더 있고
(`RebaseAuthorDateTest`·`NotesReachThePublicEntryPointTest`·`UnstagedModificationKeepsItsPathTest`),
plan 문서의 "pre-existing 4곳" 잔여 목록에도 이 3곳과 `test_consistency_context_budget.py` 가
빠져 있다. 위험도 자체는 낮다(이 4곳 모두 `self.root` 를 setUp 에서 한 번만 고정해 재사용하므로
"계산된 cwd 가 실수로 밖으로 샌다"는 실제 사고의 경로와는 다르다) — 그러나 이 저장소가 이미 여러
차례("git probe 손 복제 3벌", "6번째 `_current_branch` 누락") 겪은 "손으로 센 목록은 빠뜨린다"는
패턴이 사고 대응 문서 자체에서 다시 나타났다는 점에서, 문서/커밋 메시지의 완전성 주장을 정정하고
잔여 목록을 갱신할 필요가 있다. 판정 로직(`review_guard.py`/`plan_guard.py`/`branch_guard.py`/
`git_probe.py`/`check-review-gate.py`/`review-gate.yml`) 자체에는 이번 라운드의 새 결함이 없다 —
round 11 까지 누적된 방어선(`refs/remotes/origin/<name>` 우선 탐색, env 등재제, YAML 정확 일치,
`push_blocks`/`blocked` 계약)이 이 diff 로 훼손되지 않았음을 코드 정독과 854-test 실행으로 확인했다.

## 위험도

LOW
