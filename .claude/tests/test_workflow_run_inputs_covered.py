"""워크플로가 **실행하는 파일**이 그 워크플로 자신의 `changes.pathspecs` 에 덮이는가.

## 왜 필요한가 — 게이트가 자기 자신을 트리거하지 못한다

`_changed-paths.yml` 의 skip-job 구조에서 `changes` 잡이 `relevant=false` 를 내면 뒤따르는
검사 잡들은 **아무것도 실행하지 않고 통과로 보고**한다. 그래서 어떤 잡이 `run:` 으로 부르는
스크립트가 그 워크플로의 `pathspecs` 에 없으면, **그 스크립트만 바뀐 PR 은 검사를 한 번도
안 거친다.**

가장 나쁜 경우가 게이트 자신이다 — 판정 규칙이나 baseline 임계값을 고치는 커밋이 정작 그
게이트를 통과하지 않는다. 2026-09-02 `frontend-checks.yml` 에 `typecheck-ratchet` 을 신설할
때 실제로 그 상태로 커밋됐고(코드 리뷰 1R CRITICAL), **손으로만 고쳤다.**

`harness-checks.yml` 은 `test_harness_checks_paths_coverage.py` 가 지키는데, 정작 **실제 검증을
수행하는** 패키지 워크플로들에는 대응 가드가 없었다. 이 파일이 그 자리를 메운다 — 같은 클래스가
이 저장소에서 반복해 샌 이력이 있어(그 모듈 docstring 이 "여섯 번" 이라 적는다) 인스턴스가
아니라 **클래스**를 닫는다.

## 무엇을 검사하나

각 워크플로의 `run:` 블록에서 **저장소 안의 파일 경로처럼 보이는 토큰**을 뽑아, 그 파일이
git 에 있으면 같은 워크플로의 `changes.pathspecs` 가 덮는지 본다.

`pnpm --filter x build` 같은 패키지 매니저 호출은 경로 토큰이 없으므로 자연히 대상 밖이다 —
그런 잡의 입력은 `codebase/<pkg>/**` 가 이미 덮는다. 즉 이 가드는 **파일을 직접 이름으로
부르는** 스텝만 겨냥한다. 그 형태가 정확히 등재를 빠뜨리기 쉬운 자리다.
"""

from __future__ import annotations

import re
import subprocess
import unittest

import _harness  # noqa: F401  — side effect: harness path setup
import yaml
from _harness import REPO_ROOT
from test_harness_checks_paths_coverage import filter_covers_file

WORKFLOWS = REPO_ROOT / ".github" / "workflows"

# `run:` 안에서 저장소 파일을 가리키는 토큰. 확장자를 요구해 `pnpm`·`echo` 같은 단어와
# 섞이지 않게 한다. 새 확장자가 필요해지면 여기 추가한다 — 넓히는 편집은 이 파일의 목적상
# 안전하다(더 많이 검사하게 된다).
_PATH_TOKEN = re.compile(r"(?<![\w./-])((?:scripts|\.github|codebase|\.claude)/[\w./-]+\.\w+)")


def _tracked_files() -> set[str]:
    out = subprocess.run(
        ["git", "ls-files"], cwd=REPO_ROOT, capture_output=True, text=True, check=True
    ).stdout
    return set(out.splitlines())


class WorkflowRunInputsAreCoveredTest(unittest.TestCase):
    """`changes` 잡을 가진 워크플로 **전부**를 돈다 — 목록을 손으로 들지 않는다.

    이름을 나열하면 새 워크플로가 조용히 빠진다. 이 저장소가 반복해 데인 형태라,
    `changes` 잡의 존재 자체를 판별 기준으로 삼는다.
    """

    @classmethod
    def setUpClass(cls):
        cls.tracked = _tracked_files()

    def _workflows_with_changes_job(self):
        for path in sorted(WORKFLOWS.glob("*.yml")):
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
            jobs = (data or {}).get("jobs") or {}
            changes = jobs.get("changes")
            if not isinstance(changes, dict):
                continue
            raw = ((changes.get("with") or {}).get("pathspecs") or "")
            filters = [
                l.strip()
                for l in raw.splitlines()
                if l.strip() and not l.strip().startswith("#")
            ]
            if filters:
                yield path, jobs, filters

    def test_at_least_one_workflow_is_examined(self):
        """전제 — 추출이 통째로 실패하면 아래 단언이 vacuous 하다."""
        found = list(self._workflows_with_changes_job())
        self.assertGreaterEqual(
            len(found),
            3,
            "`changes` 잡을 가진 워크플로를 거의 못 찾았다 — 추출기가 깨졌을 가능성",
        )

    def test_run_steps_reference_only_covered_files(self):
        for path, jobs, filters in self._workflows_with_changes_job():
            for job_name, job in jobs.items():
                if job_name == "changes" or not isinstance(job, dict):
                    continue
                for step in job.get("steps") or []:
                    run = (step or {}).get("run")
                    if not isinstance(run, str):
                        continue
                    for token in _PATH_TOKEN.findall(run):
                        if token not in self.tracked:
                            continue  # 저장소 파일이 아니면 이 가드의 관심 밖
                        with self.subTest(
                            workflow=path.name, job=job_name, file=token
                        ):
                            self.assertTrue(
                                any(filter_covers_file(f, token) for f in filters),
                                f"{path.name} 의 `{job_name}` 잡이 {token} 을 실행하는데 "
                                "그 워크플로의 `changes.pathspecs` 가 덮지 않는다 — 이 "
                                "파일만 바뀐 PR 은 검사를 **한 번도 안 거치고** 통과한다.",
                            )

    def test_the_guard_would_catch_a_missing_entry(self):
        """가드 자신이 도는지 — 없는 파일을 실행하는 잡을 합성해 판정을 뒤집어 본다.

        "위반 0건" 은 검사가 도는 증거가 아니다. 실제 pathspecs 에 없을 파일 하나를 골라
        `filter_covers_file` 이 정말 거짓을 내는지 확인한다.
        """
        _, _, filters = next(
            (p, j, f)
            for p, j, f in self._workflows_with_changes_job()
            if p.name == "frontend-checks.yml"
        )
        self.assertFalse(
            any(filter_covers_file(f, "scripts/no-such-file.py") for f in filters),
            "존재하지 않는 경로가 덮인 것으로 판정된다 — 매처가 너무 넓다",
        )
        # 대조군: 이번 PR 이 등재한 파일은 덮여야 한다.
        self.assertTrue(
            any(filter_covers_file(f, "scripts/_typecheck_ratchet.py") for f in filters)
        )


if __name__ == "__main__":
    unittest.main()
