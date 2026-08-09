"""Guard: every `.github/workflows/*.yml` is structurally valid.

Why this exists — 2026-08-01. A PR added a `pip install` step to the
`harness-checks` unittest job and landed it **between the `name:` and `run:` of
the step below it**. YAML's answer to a duplicate key is not an error: the later
value silently wins. So the mapping parsed as

    {"name": "Run harness unit tests"}                  # no run/uses at all
    {"name": "Install PyYAML", "run": "python3 -m unittest ..."}   # pip install GONE

The install command vanished, and the step above became schema-invalid (a step
must have exactly one of `run`/`uses`). Nothing local catches this: the file is
never executed on a developer machine, `yaml.safe_load` accepts it, and the
whole suite stayed green. It surfaces only on GitHub Actions — after merge.

The invariants below (their number grows — do not count them here), both cheap:

  1. **no duplicate keys** in any mapping. `yaml.safe_load` will not tell you,
     so this walks the parse tree with a loader that records collisions instead
     of dropping them.
  2. **every step has exactly one of `run`/`uses`**. Zero means the step was
     structurally absorbed into a neighbour (the failure above); two means the
     opposite mistake.

`DetectorTest` feeds the 2026-08-01 text itself to both checks. Without it,
a detector that silently stopped detecting would leave every other test in this
file passing — the exact shape of failure it is here to prevent.
"""

from __future__ import annotations

import unittest
from pathlib import Path

import yaml

from _harness import REPO_ROOT

WORKFLOW_DIR = REPO_ROOT / ".github" / "workflows"

# The step as it was actually committed on 2026-08-01, before the fix.
BROKEN_SAMPLE = """\
jobs:
  unittest:
    steps:
      - name: Run harness unit tests
      - name: Install PyYAML
        run: pip install "pyyaml>=6,<7"
        run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'
"""


def _duplicate_keys(text: str) -> list[str]:
    """Every mapping key that appears more than once, as `line N: key`.

    `yaml.safe_load` keeps the last value and reports nothing, so the collision
    has to be observed during construction rather than after it.
    """
    found: list[str] = []

    class _Loader(yaml.SafeLoader):
        pass

    def _mapping(loader, node, deep=False):
        seen = set()
        for key_node, _ in node.value:
            key = loader.construct_object(key_node, deep=deep)
            if key in seen:
                found.append(f"line {key_node.start_mark.line + 1}: {key!r}")
            seen.add(key)
        return yaml.SafeLoader.construct_mapping(loader, node, deep=deep)

    _Loader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _mapping)
    yaml.load(text, Loader=_Loader)
    return found


def _steps(doc: dict):
    """`(job_name, index, step)` for every step in the document."""
    for job_name, job in (doc.get("jobs") or {}).items():
        for i, step in enumerate(job.get("steps") or []):
            yield job_name, i, step


def _workflow_files() -> list[Path]:
    return sorted(
        p for p in WORKFLOW_DIR.glob("*.y*ml") if p.suffix in (".yml", ".yaml")
    )


class WorkflowStructureTest(unittest.TestCase):
    def setUp(self):
        self.files = _workflow_files()
        # A glob that quietly matches nothing would make every assertion below
        # vacuous — the suite would stay green with the directory deleted.
        self.assertTrue(self.files, f"no workflow files found under {WORKFLOW_DIR}")

    def test_no_duplicate_keys(self):
        for path in self.files:
            with self.subTest(workflow=path.name):
                dupes = _duplicate_keys(path.read_text(encoding="utf-8"))
                self.assertEqual(
                    dupes, [],
                    f"{path.name} has duplicate mapping keys. YAML keeps the LAST "
                    "value and drops the earlier one silently, so whatever the "
                    "first one said never runs. Usually this means a step was "
                    "inserted between a neighbour's `name:` and `run:`.",
                )

    def test_every_step_has_exactly_one_of_run_or_uses(self):
        for path in self.files:
            doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            for job, i, step in _steps(doc):
                with self.subTest(workflow=path.name, job=job, step=i):
                    present = [k for k in ("run", "uses") if k in step]
                    self.assertEqual(
                        len(present), 1,
                        f"{path.name} job `{job}` step #{i} "
                        f"({step.get('name', '<unnamed>')!r}) has {present or 'neither'} "
                        "— a step needs exactly one of `run`/`uses`. Zero usually "
                        "means an adjacent step swallowed its body.",
                    )


    # 실패를 삼켜서 "초록인데 아무것도 막지 않는" 상태를 만드는 키. 지키는 워크플로에서는
    # 어느 job/step 에도 있어서는 안 된다.
    _SWALLOWS_FAILURE = "continue-on-error"

    # 예외는 **(워크플로, step 이름) 단위**로만. 파일 단위 예외를 두면 그 파일의 게이트 step
    # 까지 함께 열린다. job 레벨은 예외가 없다 — job 하나가 실패를 삼키면 그 안의 모든 step 이
    # 무해해지고, 그것이 정당한 경우는 없다.
    #
    # 등재된 것은 **리포팅** step 이다: flaky 를 표면화하는 것 자체가 빌드를 깨서는 안 되고,
    # 그 step 이 실패해도 e2e 판정은 앞선 step 들이 이미 냈다.
    _MAY_SWALLOW = {
        ("e2e.yml", "Surface flaky (retry-passed) tests"),
    }

    def test_no_guard_workflow_swallows_its_own_failure(self):
        """`continue-on-error: true` 는 워크플로를 조용히 무해하게 만든다.

        `review-gate.yml` 에서 이 클래스의 결함을 두 번 겪었다 — 4R 에서 step 레벨을 막았는데
        job 레벨로 우회됐고(리뷰어 9명 실증), 그 직전 라운드는 잔여물 한 줄로 발견됐다. 그런데
        그 방어는 `review-gate.yml` **하나에만** 걸려 있었다: `harness-checks.yml` 에 같은 키를
        넣으면 **모든 harness 테스트가 조언으로 격하**되고 아무 가드도 알아채지 못한다 —
        `test_review_gate_ci.py` 가 지키려는 것을 포함해 전부다. 실측으로 확인했다.

        같은 결함을 세 번째로 만나기 전에, 파일 하나가 아니라 **모든 워크플로**에 건다.
        """
        seen_exceptions = set()
        for path in self.files:
            doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            for job_name, job in (doc.get("jobs") or {}).items():
                if not isinstance(job, dict):
                    continue
                with self.subTest(workflow=path.name, job=job_name):
                    self.assertNotIn(
                        self._SWALLOWS_FAILURE, job,
                        f"{path.name} job `{job_name}` 이 자기 실패를 삼킨다 — "
                        "체크는 초록으로 뜨고 아무것도 막지 않는다",
                    )
                for i, step in enumerate(job.get("steps") or []):
                    if not isinstance(step, dict):
                        continue
                    key = (path.name, step.get("name"))
                    if key in self._MAY_SWALLOW:
                        seen_exceptions.add(key)
                        continue
                    with self.subTest(workflow=path.name, job=job_name, step=i):
                        self.assertNotIn(
                            self._SWALLOWS_FAILURE, step,
                            f"{path.name} job `{job_name}` step #{i} "
                            f"({step.get('name', '<unnamed>')!r}) 이 실패를 삼킨다 — "
                            "정당하면 `_MAY_SWALLOW` 에 이유와 함께 등재하라",
                        )

        # 죽은 예외는 지운다. 등재해 둔 step 이 사라지거나 이름이 바뀌면 그 예외는 다음 사람에게
        # "여기는 열려 있다" 는 거짓 신호가 된다.
        self.assertEqual(
            self._MAY_SWALLOW - seen_exceptions, set(),
            "`_MAY_SWALLOW` 에 더 이상 존재하지 않는 step 이 남아 있다",
        )


    # job 레벨 `if:` 는 조건부 실행이라 정당한 쓰임이 있다(봇 면제). 그래서 금지가 아니라
    # **등재제**로 둔다 — 여기 없는 조건이 나타나면 실패하고, 등재하는 순간이 "이게 게이트를
    # 끄는 조건인가" 를 사람이 판단할 자리다. `if: false` 한 줄로 job 이 통째로 skip 되는데
    # 아무 가드도 없던 것이 5R CRITICAL 이었다.
    _JOB_CONDITIONS = {
        ("review-gate.yml", "gate"): "github.actor != 'dependabot[bot]'",
        # skip-job 패턴: `changes` 잡이 실패/오류여도 하위 잡은 돈다. `needs` 실패로
        # 하위 잡이 `skipped` 되면 "skipped 가 required check 를 만족하는가" 라는 —
        # 이 패턴이 정확히 피하려는 — 모호함이 다른 경로로 재발하기 때문이다.
        # `always()` 가 아니라 `!cancelled()` 인 이유: 워크플로가 취소됐을 때까지
        # 러너를 잡아둘 이유는 없다.
        ("deps-security-checks.yml", "config-guard"): "${{ !cancelled() }}",
        ("deps-security-checks.yml", "audit"): "${{ !cancelled() }}",
        ("deps-security-checks.yml", "override-floors"): "${{ !cancelled() }}",
        ("frontend-checks.yml", "test-and-build"): "${{ !cancelled() }}",
        ("backend-checks.yml", "lint"): "${{ !cancelled() }}",
        ("backend-checks.yml", "unit"): "${{ !cancelled() }}",
        ("backend-checks.yml", "typecheck-ratchet"): "${{ !cancelled() }}",
        ("harness-checks.yml", "unittest"): "${{ !cancelled() }}",
        ("migration-check.yml", "guard"): "${{ !cancelled() }}",
        ("packages-checks.yml", "packages"): "${{ !cancelled() }}",
        ("spec-link-checks.yml", "spec-link-integrity"): "${{ !cancelled() }}",
        ("web-chat-checks.yml", "sdk"): "${{ !cancelled() }}",
        ("web-chat-checks.yml", "sdk-client"): "${{ !cancelled() }}",
        ("web-chat-checks.yml", "widget"): "${{ !cancelled() }}",
    }

    # step 레벨 `if:` 도 같은 자리다. job 은 등재제로 막고 step 은 안 막은 것이 6R CRITICAL
    # 이었다 — step 이 skip 돼도 job 은 success 로 보고되므로 로그는 초록이다. 3명이 독립 실증.
    # 전부 e2e 의 진단 수집 step 이다 — 실패했을 때만(또는 항상) 로그·아티팩트를 모은다.
    # 게이트 성격 step 에는 조건이 없어야 하고, 있으면 여기서 마주친다.
    # skip-job 패턴(required check 데드락 해소)이 쓰는 두 조건. 스텝 단위로 게이팅하되
    # **잡은 항상 돌려** success 를 보고하게 하는 것이 핵심이라, 조건 문자열이 이 두 형태에서
    # 벗어나면 등재가 깨지도록 고정한다. 계약 전문·왜 잡을 skip 하지 않는지는
    # `.claude/tests/test_required_check_skip_jobs.py` 와 `scripts/ci-paths-changed.sh`.
    _SKIP_JOB_RUN = "needs.changes.outputs.relevant != 'false'"
    _SKIP_JOB_NOOP = "needs.changes.outputs.relevant == 'false'"

    _STEP_CONDITIONS = {
        ("e2e.yml", "Collect docker logs on failure"): "failure()",
        ("e2e.yml", "Upload artifacts"): "failure()",
        ("e2e.yml", "Surface flaky (retry-passed) tests"): "always()",
        ("e2e.yml", "Upload playwright report on failure"): "failure()",
    }

    # 위 두 상수를 쓰는 skip-job 스텝은 워크플로마다 수가 많아 개별 등재 대신 규칙으로 받는다.
    # (개별 등재하면 스텝 하나 추가할 때마다 등록부를 고쳐야 해 실질 가치 없이 마찰만 는다.)
    _SKIP_JOB_WORKFLOWS = {
        "backend-checks.yml",
        "deps-security-checks.yml",
        "frontend-checks.yml",
        "harness-checks.yml",
        "migration-check.yml",
        "packages-checks.yml",
        "spec-link-checks.yml",
        "web-chat-checks.yml",
    }

    def test_job_conditions_are_registered(self):
        seen = set()
        for path in self.files:
            doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            for job_name, job in (doc.get("jobs") or {}).items():
                if not isinstance(job, dict) or "if" not in job:
                    continue
                key = (path.name, job_name)
                seen.add(key)
                with self.subTest(workflow=path.name, job=job_name):
                    self.assertIn(
                        key, self._JOB_CONDITIONS,
                        f"{path.name} job `{job_name}` 에 등재되지 않은 `if:` 가 있다 "
                        f"({job['if']!r}) — job 을 통째로 끌 수 있는 자리다",
                    )
                    self.assertEqual(job["if"], self._JOB_CONDITIONS[key])
        self.assertEqual(self._JOB_CONDITIONS.keys() - seen, set(),
                         "`_JOB_CONDITIONS` 에 더 이상 존재하지 않는 항목이 남아 있다")

    def test_step_conditions_are_registered(self):
        seen = set()
        for path in self.files:
            doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            for job_name, job in (doc.get("jobs") or {}).items():
                if not isinstance(job, dict):
                    continue
                for i, step in enumerate(job.get("steps") or []):
                    if not isinstance(step, dict) or "if" not in step:
                        continue
                    # skip-job 패턴 워크플로의 두 표준 조건은 규칙으로 받는다.
                    # 다만 **그 두 문자열과 정확히 일치할 때만** — 오탈자나 변형이면
                    # 아래 개별 등재 경로로 떨어져 실패한다(조용한 통과 방지).
                    if path.name in self._SKIP_JOB_WORKFLOWS and step["if"] in (
                        self._SKIP_JOB_RUN,
                        self._SKIP_JOB_NOOP,
                    ):
                        continue
                    key = (path.name, step.get("name"))
                    seen.add(key)
                    with self.subTest(workflow=path.name, job=job_name, step=i):
                        self.assertIn(
                            key, self._STEP_CONDITIONS,
                            f"{path.name} step {step.get('name')!r} 에 등재되지 않은 `if:` "
                            f"가 있다 ({step['if']!r}) — step 이 skip 돼도 job 은 성공이다",
                        )
                        self.assertEqual(step["if"], self._STEP_CONDITIONS[key])
        self.assertEqual(self._STEP_CONDITIONS.keys() - seen, set(),
                         "`_STEP_CONDITIONS` 에 더 이상 존재하지 않는 항목이 남아 있다")

    # C1: `on.pull_request` 의 형제 키. `types`/`branches` 한 줄이면 워크플로가 영구히 안 돌고
    # Actions 탭에 기록조차 안 남는다. review-gate 만 닫혀 있었고 harness-checks 는 열려 있었다.
    #
    # **빈 집합(= bare `pull_request:`)은 required status check 등록을 위한 의도된 형태다.**
    # `paths:` 가 있으면 무관한 PR 에서 워크플로가 안 돌아 체크가 영원히 대기하고 머지가
    # 막힌다. 위 주석이 경고하는 "always-green" 위험은 그대로 유효하므로, 그 보상 통제로
    # `.claude/tests/test_required_check_skip_jobs.py` 가 **모든 스텝의 `if:` 게이팅과
    # `needs: changes`** 를 강제한다 — 둘 중 하나라도 빠지면 거기서 RED 다.
    # 새 워크플로를 이 형태로 바꿀 때는 그 가드의 `CONVERTED` 목록에도 반드시 추가한다.
    _PULL_REQUEST_KEYS = {
        "backend-checks.yml": set(),
        "deps-security-checks.yml": set(),
        "e2e.yml": {"paths-ignore"},
        "frontend-checks.yml": set(),
        "harness-checks.yml": set(),
        "migration-check.yml": set(),
        "packages-checks.yml": set(),
        "review-gate.yml": {"paths"},
        "spec-link-checks.yml": set(),
        "web-chat-checks.yml": set(),
    }

    def test_pull_request_trigger_shape_is_registered(self):
        seen = set()
        for path in self.files:
            doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            on = doc.get("on", doc.get(True)) or {}
            if not isinstance(on, dict) or "pull_request" not in on:
                continue
            pr = on["pull_request"]
            # 필터 없는 bare `pull_request:` 는 **가장 위험한** 형태인데(모든 PR 에서 도는
            # always-green 워크플로를 만들 수 있다) 초판은 dict 가 아니라는 이유로 건너뛰었다.
            # 빈 키 집합으로 취급해 등재를 요구한다.
            keys = set(pr) if isinstance(pr, dict) else set()
            seen.add(path.name)
            with self.subTest(workflow=path.name):
                self.assertIn(
                    path.name, self._PULL_REQUEST_KEYS,
                    f"{path.name} 의 pull_request 트리거가 등재돼 있지 않다",
                )
                self.assertEqual(
                    keys, self._PULL_REQUEST_KEYS[path.name],
                    f"{path.name} 의 pull_request 키 집합이 다르다 — "
                    "`types`/`branches` 한 줄이면 이 워크플로는 영영 트리거되지 않는다",
                )
        self.assertEqual(self._PULL_REQUEST_KEYS.keys() - seen, set(),
                         "`_PULL_REQUEST_KEYS` 에 더 이상 존재하지 않는 항목이 남아 있다")

    def test_workflow_and_job_identities_are_unique(self):
        """같은 `name:` 과 job id 를 참칭하는 "always green" 워크플로를 새로 추가하는 우회.

        GitHub 의 required-status-check 은 파일이 아니라 **체크 이름 문자열**로 매칭되므로,
        두 워크플로가 같은 identity 로 상태를 보고하면 경쟁이 성립한다. 어떤 가드도 파일 간
        유일성을 보지 않았다 — `WorkflowWiringTest` 는 `review-gate.yml` 한 파일만 로드한다.
        """
        import collections
        names, pairs = collections.Counter(), collections.Counter()
        for path in self.files:
            doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            name = doc.get("name")
            names[name] += 1
            for job_id, job in (doc.get("jobs") or {}).items():
                # GitHub 이 체크 이름으로 노출하는 것은 `jobs.<id>.name` 이 있으면 그 값이고
                # 없으면 job id 다. dict key 만 비교하면 `name:` override 로 다른 job 을
                # 참칭할 수 있다 — 7R 리뷰어가 그 형태로 `review-gate / gate` 를 참칭하는
                # always-green 워크플로를 심는 것을 실증했다.
                label = job.get("name", job_id) if isinstance(job, dict) else job_id
                pairs[(name, label)] += 1
        self.assertEqual([n for n, c in names.items() if c > 1], [],
                         "같은 `name:` 을 쓰는 워크플로가 둘 이상이다")
        self.assertEqual([k for k, c in pairs.items() if c > 1], [],
                         "같은 (워크플로 name, job id) 조합이 둘 이상이다")

    # 하네스 스위트를 CI 에서 **실제로 부르는** 명령. 패턴을 한 글자만 좁혀도
    # (`test_[!r]*.py`) 가드 파일 11개가 CI 에서 영원히 안 도는데, 파일 자체는 전부 GREEN 이라
    # 아무도 모른다 — "파일이 옳다" 와 "CI 가 그 파일을 부른다" 는 다른 사실이다.
    _SUITE_COMMAND = "python3 -m unittest discover -s .claude/tests -p 'test_*.py'"

    def test_the_harness_suite_is_invoked_over_every_test_file(self):
        doc = yaml.safe_load(
            (WORKFLOW_DIR / "harness-checks.yml").read_text(encoding="utf-8"))
        runs = [st["run"].strip()
                for job in doc["jobs"].values()
                for st in (job.get("steps") or []) if "run" in st]
        self.assertIn(self._SUITE_COMMAND, runs,
                      f"하네스 스위트를 부르는 명령이 정확히 그것이 아니다: {runs}")

        # 그 패턴이 실제 파일 전부를 덮는지도 본다 — 명령이 그대로여도 `-s` 가 다른 곳을
        # 가리키면 같은 결과가 된다.
        import fnmatch
        tests = sorted(p.name for p in (REPO_ROOT / ".claude" / "tests").glob("test_*.py"))
        covered = [n for n in tests if fnmatch.fnmatch(n, "test_*.py")]
        self.assertEqual(covered, tests)
        self.assertGreater(len(tests), 30, "테스트 파일을 못 찾았다 — 이 가드가 stale 하다")


class DetectorTest(unittest.TestCase):
    """The checks above are only worth their green if they can go red."""

    def test_duplicate_key_detector_catches_the_2026_08_01_shape(self):
        dupes = _duplicate_keys(BROKEN_SAMPLE)
        self.assertTrue(dupes, "duplicate `run:` went unnoticed")
        self.assertIn("run", dupes[0])

    def test_safe_load_alone_would_have_missed_it(self):
        """Pins WHY the custom loader exists, not just that it works."""
        doc = yaml.safe_load(BROKEN_SAMPLE)
        step = doc["jobs"]["unittest"]["steps"][1]
        self.assertNotIn("pip install", step["run"])  # the later value won

    def test_run_or_uses_check_catches_the_2026_08_01_shape(self):
        doc = yaml.safe_load(BROKEN_SAMPLE)
        offenders = [
            (i, step) for _, i, step in _steps(doc)
            if len([k for k in ("run", "uses") if k in step]) != 1
        ]
        self.assertEqual([i for i, _ in offenders], [0])

    def test_clean_workflow_passes_both_checks(self):
        """A false positive here would red-light the repo permanently."""
        clean = (
            "jobs:\n  j:\n    steps:\n"
            "      - uses: actions/checkout@v7\n"
            "      - name: x\n        run: echo hi\n"
        )
        self.assertEqual(_duplicate_keys(clean), [])
        doc = yaml.safe_load(clean)
        for _, _, step in _steps(doc):
            self.assertEqual(len([k for k in ("run", "uses") if k in step]), 1)


if __name__ == "__main__":
    unittest.main()
