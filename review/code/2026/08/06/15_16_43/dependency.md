# 의존성(Dependency) 리뷰 — CI 백스톱 3R (round 12)

## 방법

리뷰 대상 15개 파일의 import 문 전체를 실제 소스에서 직접 확인했다 (`grep -n "^import\|^from"` 및
`import(` 패턴, worktree 루트 `/Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379`
기준). 아래는 실행한 명령과 그 결과 요약이다.

```
grep -n "^import\|^from" .claude/hooks/_lib/review_guard.py .claude/hooks/_lib/branch_guard.py \
  .claude/hooks/_lib/plan_guard.py .claude/_shared/git_probe.py .claude/_shared/report_paths.py \
  .claude/_shared/block_integrity.py scripts/check-review-gate.py \
  .claude/tests/test_*.py(관련 8개)
```
→ 전부 stdlib(`os`, `subprocess`, `re`, `sys`, `json`, `time`, `dataclasses`, `datetime`,
`argparse`, `ast`, `unittest`, `tempfile`, `shutil`, `pathlib`) 뿐이며, 예외는
`.claude/tests/test_workflow_yaml_structure.py:35`의 `import yaml` 하나뿐이다.

```
git -C <worktree> diff --stat origin/main...HEAD -- <15개 파일>
```
→ 15 files changed, 2137 insertions(+), 233 deletions(-). `git_probe.py`는 `origin/main`에
아예 없음(`git show origin/main:.claude/_shared/git_probe.py` → 실패) — 신규 파일.
`review-gate.yml`도 전량 신규(74 insertions, 0 deletions).

```
grep -rn "actions/checkout@\|actions/setup-python@\|actions/setup-node@\|actions/cache@\|actions/upload-artifact@" .github/workflows/*.yml
grep -rn "node-version\|python-version" .github/workflows/*.yml
grep -rn "pyyaml\|PyYAML" -i . (node_modules/worktrees 제외)
grep -n "yaml\.\(safe_load\|load\|SafeLoader\)" scripts/check-override-floors.py scripts/check-pnpm-security-config.py .claude/tests/test_workflow_yaml_structure.py .claude/tests/test_review_gate_ci.py
```
→ 아래 발견사항 근거.

---

## 발견사항

- **[INFO]** 이번 라운드가 도입한 코드에는 **신규 외부 의존성이 없다**
  - 위치: `.claude/_shared/git_probe.py` (전체, 신규 파일) / `.claude/hooks/_lib/branch_guard.py:33` / `.claude/hooks/_lib/plan_guard.py:61` / `.claude/hooks/_lib/review_guard.py:142-144` / `scripts/check-review-gate.py:51-53`
  - 상세: 위 5개 파일 전부 stdlib(`os`, `subprocess`, `sys`, `argparse` 등)만 쓴다. `_shared/report_paths.py`·`_shared/block_integrity.py`도 stdlib 뿐(`os`, `re`)이라 `review_guard.evaluate_review()`의 실제 호출 경로 전체가 서드파티 패키지에 의존하지 않는다는 `review-gate.yml:72`의 주석("표준 라이브러리만 쓴다 — 설치 단계 없음")이 코드로 검증됐다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** 유일한 서드파티 패키지(PyYAML)는 신규가 아니라 **재사용된 기존 pin**이며, 드리프트를 막는 회귀 테스트가 함께 들어왔다
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:35` (신규 `import yaml`) / `.claude/tests/test_review_gate_ci.py`의 `PyYamlPinsAgreeTest.test_every_workflow_pins_the_same_version` (약 806~834행) / `.github/workflows/harness-checks.yml:92-93` / `.github/workflows/deps-security-checks.yml:56-58,91-92` (비변경, 대조군)
  - 상세: `pip install "pyyaml>=6,<7"` pin이 `harness-checks.yml`과 `deps-security-checks.yml` 세 곳에 손으로 반복돼 있는데, 이번 라운드가 그 정확한 pin이 파일 간에 갈리지 않았는지 정규식으로 스캔해 단언하는 테스트(`PyYamlPinsAgreeTest`)를 추가했다. 이 저장소가 스스로 기록해 온 "손-동기 사본은 드리프트한다"(`report_paths`, `retry_state`, doc-sync 매트릭스) 클래스를 버전 pin 축에도 선제 적용한 것으로, 의존성 관점에서 정확히 옳은 방향이다. `.claude/tests/README.md:14-31`이 "표준 라이브러리 전용, 예외는 PyYAML 하나"라는 정책을 명문화하고 있고, 실제 코드가 그 경계를 지킨다(위 항목).
  - 제안: 없음 — 긍정적 발견.

- **[INFO]** PyYAML 사용은 전부 `safe_load`/`SafeLoader` 계열이라 알려진 역직렬화 취약점 클래스(비-safe `yaml.load()` 기본 로더의 임의 객체 생성)에 해당하지 않는다
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:61-74` (`class _Loader(yaml.SafeLoader)` 서브클래싱 후 `yaml.load(text, Loader=_Loader)`), `:112,152,207,226,262,295,316,343,348,363` (전부 `yaml.safe_load`), `scripts/check-override-floors.py:129`, `scripts/check-pnpm-security-config.py:92` (둘 다 `yaml.safe_load`)
  - 상세: `grep -n "yaml\.\(safe_load\|load\|SafeLoader\|FullLoader\|UnsafeLoader\)"`로 이 저장소의 모든 YAML 파싱 호출을 확인했다. 인자 없는 `yaml.load()`(레거시 위험 형태)는 한 곳도 없다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** GitHub Actions는 불변 커밋 SHA가 아니라 가변 major-tag(`@v7`)로 고정돼 있다 — 이번 라운드 신규 파일 `review-gate.yml`도 동일 관행을 따른다
  - 위치: `.github/workflows/review-gate.yml:55,59` (`actions/checkout@v7`, `actions/setup-python@v7`)
  - 상세: `grep -rn "actions/checkout@\|actions/setup-python@\|actions/setup-node@\|actions/cache@\|actions/upload-artifact@" .github/workflows/*.yml`로 10개 워크플로 전체를 대조한 결과 `checkout@v7`/`setup-python@v7`/`setup-node@v7`/`cache@v6`/`upload-artifact@v7`가 예외 없이 균일하다 — `review-gate.yml`이 새 파일이지만 기존 관행과 정확히 일치하고 이번 PR이 만든 불일치는 없다. 다만 GitHub 1st-party 액션이라도 major tag는 이동 가능한 참조이므로(SHA pin보다 약한 공급망 보증), 이 프로젝트가 언젠가 공급망 강화를 검토한다면 후보다. 이번 라운드가 새로 만든 리스크는 아니다.
  - 제안: 현 상태 유지로 충분(기존 컨벤션과 일관). 공급망 정책을 강화할 계획이 있다면 별도 티켓으로.

- **[INFO]** `harness-checks.yml`의 액션 버전 정책 주석이 실제 코드와 어긋난 채 방치돼 있다 (이번 라운드가 만든 것은 아님, 사전 존재)
  - 위치: `.github/workflows/harness-checks.yml:83` (주석) — 바로 아래 `:84`의 `actions/setup-python@v7`
  - 상세: `# actions major policy consistent with the other workflows (v5/v6 line)`이라고 적혀 있는데, 실측(`grep -rn "actions/checkout@\|actions/setup-python@\|actions/setup-node@"`) 결과 이 저장소의 모든 워크플로(harness-checks.yml 자신 포함)가 예외 없이 `v7`을 쓴다. `git diff origin/main...HEAD -- .github/workflows/harness-checks.yml`로 확인하면 이 줄은 이번 라운드가 건드린 hunk 밖이라 회귀는 아니지만, 이 저장소가 반복 기록해 온 "손으로 쓴 사실이 옆에서 바뀌면 조용히 stale해진다" 클래스(§report_paths/retry_state/doc-sync 매트릭스, 그리고 이번 세션이 방금 `PyYamlPinsAgreeTest`로 막으려던 것과 동일 클래스)와 정확히 같은 모양이다. 이 파일이 이번 리뷰 대상에 포함돼 있어 지금 잡히는 게 다음 세션이 잡는 것보다 싸다.
  - 제안: 주석을 `v7 line`으로 정정하거나, `PyYamlPinsAgreeTest`처럼 "정책 문구가 실제 pin과 일치하는지"를 도출하는 가드로 대체(주석 대신 `_workflow_files()` 순회로 unused 값이 아니게).

- **[INFO]** 내부 의존성(git 프로브) 삼중 사본이 실제로 하나의 소스로 수렴했음을 소스 레벨에서 직접 확인
  - 위치: `.claude/hooks/_lib/review_guard.py:206-210`, `.claude/hooks/_lib/branch_guard.py:45-46,57-58`, `.claude/hooks/_lib/plan_guard.py:108-115` — 전부 `_x = _git_probe._x` 위임 대입이며 로컬 재정의가 없다.
  - 상세: `review_guard.py`는 자신이 실제로 쓰는 5개(`_run_git`,`_repo_root`,`_default_branch`,`_merge_base`,`_porcelain_path`)만 위임하고 안 쓰는 `_current_branch`/`_origin_default_branch`는 위임하지 않는다(`grep -n "_current_branch\|_origin_default_branch" .claude/hooks/_lib/review_guard.py` → 0건) — `test_plan_guard.py`의 `GitProbesAreNotReDuplicatedTest.test_the_shared_probes_are_the_same_objects_everywhere`가 "그 훅이 안 쓰는 프로브는 위임할 이유가 없다"고 명시한 것과 정확히 일치한다. `git_probe.py` 자신은 `os`/`subprocess` 외 어떤 내부 모듈도 import하지 않아 순환 의존 위험이 없다. 8~10R에서 세 번 갈렸던 손-동기 사본(§CONTEXT)이 이번 스냅샷에서는 실제로 단일 진실원으로 수렴해 있다.
  - 제안: 없음 — 긍정적 확인. (판정 로직 자체의 정확성은 code-quality/logic 리뷰어 영역이므로 여기서는 의존성 그래프만 확인)

- **[INFO]** `scripts/check-review-gate.py`가 `.claude/hooks/_lib`를 `sys.path`에 직접 꽂아 `review_guard`를 이름으로 import하는 방식은 패키지 import가 아니라서 깨지기 쉬운 축이지만, 이유가 문서화돼 있고 이번 라운드가 새로 만든 문제는 아니다
  - 위치: `scripts/check-review-gate.py:55-67`
  - 상세: 주석이 `_lib`이라는 디렉터리명이 `.claude/skills/_lib`과 충돌해 패키지 import를 못 쓴다고 명시한다. `guard_review_before_push.py`(정본 소비자)도 동일하게 `_lib`만 얹는 것으로 실측 확인됐다고 적혀 있다(코드 자체는 이번 리뷰 번들 밖이라 재확인은 architecture/구조 리뷰어 영역).
  - 제안: 없음 — 확인 목적의 기록.

---

## 요약

이번 라운드(round 12, CI 백스톱 3R)가 코드에 도입한 서드파티 패키지는 없다. 리뷰 대상 15개 파일 중 프로덕션 판정 경로(`git_probe.py`, `branch_guard.py`, `plan_guard.py`, `review_guard.py`, `check-review-gate.py`)는 전부 표준 라이브러리(`os`, `subprocess`, `re`, `sys`, `json`, `time`, `argparse`, `dataclasses`, `datetime`)만 쓰며, `review-gate.yml`이 "표준 라이브러리만 쓴다"고 적은 주석은 소스 확인으로 사실이다. 유일한 서드파티 의존성(PyYAML)은 신규가 아니라 사전 확립된 `pyyaml>=6,<7` pin의 재사용이고, 이번 라운드는 오히려 그 pin이 워크플로 세 곳에서 갈리지 않는지 검증하는 회귀 테스트(`PyYamlPinsAgreeTest`)를 추가해 이 저장소가 반복 겪어 온 "손-동기 사본 drift" 클래스를 pin 축에도 선제 방어했다 — 라이선스(MIT)·취약점(전량 `safe_load`/`SafeLoader`, 레거시 비-safe `yaml.load()` 없음) 모두 문제 없다. GitHub Actions 버전(`@v7` 계열)은 10개 워크플로 전체에서 균일하며 신규 `review-gate.yml`도 그 관행을 그대로 따른다. 유일한 흠은 `harness-checks.yml:83`의 "v5/v6 line" 주석이 실제 `v7` 사용과 어긋난 채 방치돼 있다는 것인데, 이번 라운드가 만든 회귀는 아니고(diff hunk 밖, `git diff origin/main...HEAD` 확인) 리뷰 대상 파일 안에 있어 지금 언급해 둔다. 내부 의존성 측면에서는 세 훅(`review_guard`/`plan_guard`/`branch_guard`)이 각자 필요한 git 프로브만 `_shared/git_probe.py`에서 위임받고 로컬 재정의가 없음을 소스에서 직접 확인했다 — 8~10R에서 세 번 갈렸던 손-동기 사본 문제가 이번 스냅샷에서 실제로 해소돼 있다.

## 위험도

NONE
