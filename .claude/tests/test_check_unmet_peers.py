"""`scripts/check-unmet-peers.py` — 미충족 peer 관측 스크립트(NERV Task `CLE-T-DDA7V4`).

재해소를 저장소 밖 사본에서 돌리는 이유와 경위는 스크립트의 `resolve_fresh` docstring 에 있다.
여기서 고정하는 것:

  1. **저장소 밖 실행** — pnpm 의 cwd 가 저장소가 아니고, 실행 중에도 저장소 lockfile 이 그대로
     있으며, 실행 뒤 저장소의 어떤 파일도 바뀌지 않는다.
  2. **사본 구성** — 루트 `package.json` · `pnpm-workspace.yaml` · `.npmrc` 와 워크스페이스 글로브에
     걸리는 매니페스트만 옮긴다. lockfile · `node_modules` · 글로브 밖 매니페스트는 없다. 실제
     저장소의 `pnpm-workspace.yaml` 로도 확인한다.
  3. **판정** — 수용 항목만 나오면 통과(0), 새 항목 · 사라진 수용 항목이면 실패(1).
  4. **fail-closed** — 측정하지 못하면 exit 2 다. 워크스페이스 목록 이상 · 사본에 옮기지 않는 해소
     입력 · 글로브 0건 · 저장소 밖 경로는 pnpm 을 부르기 전에 멈추고, pnpm 부재와 "비영 종료인데
     파싱 0건" 도 2 다.

판정 테스트는 운영 등재부(`ACCEPTED`)에 기대지 않는다. 스크립트 사본의 등재부를 테스트 전용
값으로 바꿔 둔다 — 운영 항목을 정상적으로 지울 때 이 테스트가 깨지면 안 된다.

실제 레지스트리를 두드리지 않게 PATH 앞에 가짜 `pnpm` 을 둔다. 가짜가 실제로 실행됐는지
보고 파일로 확인한다(`test_override_floors.py` 의 `StubNotUsed` 와 같은 이유).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

from _harness import REPO_ROOT, load_module_by_path

SCRIPT = REPO_ROOT / "scripts" / "check-unmet-peers.py"
WORKFLOW = REPO_ROOT / ".github" / "workflows" / "deps-peer-observe.yml"

# 가짜 pnpm. 자기가 본 것(cwd, 그 아래 파일 목록, 실행 중 저장소 lockfile)을 JSON 으로 남기고
# 진짜 pnpm 처럼 cwd 에 lockfile 을 쓴 뒤 정해 둔 출력과 종료 코드로 끝난다.
_PNPM_STUB = r"""#!/usr/bin/env python3
import json, os, sys
cwd = os.getcwd()
files = []
for root, dirs, names in os.walk(cwd):
    for name in names:
        files.append(os.path.relpath(os.path.join(root, name), cwd))
repo_lock = os.environ["STUB_REPO_LOCKFILE"]
with open(os.environ["STUB_REPORT"], "w", encoding="utf-8") as fh:
    json.dump({
        "argv": sys.argv[1:],
        "cwd": os.path.realpath(cwd),
        "files": sorted(files),
        "repo_lock_text": open(repo_lock, encoding="utf-8").read() if os.path.exists(repo_lock) else None,
    }, fh)
with open(os.path.join(cwd, "pnpm-lock.yaml"), "w", encoding="utf-8") as fh:
    fh.write("lockfileVersion: '9.0'")
sys.stdout.write(open(os.environ["STUB_OUTPUT"], encoding="utf-8").read())
sys.exit(int(os.environ.get("STUB_EXIT", "0")))
"""

_WORKSPACE = """\
packages:
  - "codebase/backend"
  - "codebase/packages/*"
  - "!codebase/packages/excluded"
overrides:
  qs: ^6.16.0
"""

_LOCKFILE = "lockfileVersion: '9.0'\n# repo lockfile\n"

# 스크립트 사본의 등재부를 이 값으로 바꾼다(운영 등재부와 분리).
_TEST_ACCEPTED = 'ACCEPTED: dict[tuple[str, str], str] = {("typeorm", "ioredis"): "테스트 전용 등재"}\n'
_ACCEPTED_BLOCK = re.compile(r"^ACCEPTED: dict\[tuple\[str, str\], str\] = \{\n.*?^\}\n", re.S | re.M)

# pnpm 10 출력에서 딴 형태 — 부모 줄 아래에 미충족 줄이 온다.
_ACCEPTED_ONLY = """\
codebase/backend
└─┬ typeorm 1.1.1
  └── ✕ unmet peer ioredis@^5.0.4: found 6.0.0
"""

_WITH_NEW = _ACCEPTED_ONLY + """\
codebase/frontend
└─┬ some-lib 2.0.0
  └── ✕ unmet peer react@^18: found 19.2.0
"""


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _script_copy_text() -> str:
    source = SCRIPT.read_text(encoding="utf-8")
    replaced, count = _ACCEPTED_BLOCK.subn(_TEST_ACCEPTED, source)
    assert count == 1, "스크립트의 ACCEPTED 블록을 찾지 못했다 — 테스트 픽스처를 갱신하라"
    return replaced


def _make_repo(root: Path, workspace: str = _WORKSPACE) -> None:
    """가짜 저장소 — 스크립트 사본, 재해소에 쓰이는 파일, 쓰이면 안 되는 파일을 함께 둔다."""
    _write(root / "scripts" / "check-unmet-peers.py", _script_copy_text())
    _write(root / "package.json", json.dumps({"name": "root", "private": True}))
    _write(root / "pnpm-workspace.yaml", workspace)
    _write(root / ".npmrc", "node-linker=isolated\n")
    _write(root / "pnpm-lock.yaml", _LOCKFILE)
    _write(root / "codebase" / "backend" / "package.json", json.dumps({"name": "backend"}))
    _write(root / "codebase" / "backend" / "src" / "main.ts", "export {};\n")
    _write(root / "codebase" / "packages" / "sdk" / "package.json", json.dumps({"name": "sdk"}))
    _write(root / "codebase" / "packages" / "excluded" / "package.json", json.dumps({"name": "excluded"}))
    _write(root / "codebase" / "packages" / "sdk" / "node_modules" / "dep" / "package.json", "{}")
    # 워크스페이스 글로브 밖의 매니페스트 — 별도 npm 도구(.claude/tools/mermaid-lint 같은 것)
    _write(root / "tools" / "standalone" / "package.json", json.dumps({"name": "standalone"}))


def _snapshot(root: Path) -> dict[str, str]:
    """디렉터리 안 모든 파일의 경로 → 내용 해시."""
    return {
        str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.rglob("*")) if path.is_file()
    }


class _StubbedRun(unittest.TestCase):
    """가짜 저장소와 가짜 pnpm 으로 스크립트를 서브프로세스로 돌린다."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix="unmet-peers-test-")
        self.base = Path(self._tmp.name).resolve()
        self.repo = self.base / "repo"
        self.bin = self.base / "bin"
        self.report = self.base / "report.json"
        self.output = self.base / "output.txt"
        self.bin.mkdir()
        # 원자적으로 놓는다 — 실행 불가 상태가 잠깐 보이면 execvp 가 다음 PATH 의 진짜 pnpm 을 고른다.
        staging = self.bin / ".pnpm.tmp"
        staging.write_text(_PNPM_STUB, encoding="utf-8")
        staging.chmod(0o755)
        staging.rename(self.bin / "pnpm")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _invoke(self, output: str = _ACCEPTED_ONLY, *, exit_code: int = 0,
                path: str | None = None) -> tuple[subprocess.CompletedProcess, dict | None]:
        """이미 만든 저장소에서 스크립트를 돌린다. 가짜 pnpm 이 돌았으면 그 보고를 함께 돌려준다."""
        self.output.write_text(output, encoding="utf-8")
        env = dict(os.environ)
        env.update({
            "PATH": path if path is not None else f"{self.bin}{os.pathsep}{env.get('PATH', '')}",
            "STUB_REPORT": str(self.report),
            "STUB_OUTPUT": str(self.output),
            "STUB_EXIT": str(exit_code),
            "STUB_REPO_LOCKFILE": str(self.repo / "pnpm-lock.yaml"),
        })
        proc = subprocess.run(
            [sys.executable, str(self.repo / "scripts" / "check-unmet-peers.py")],
            cwd=self.repo, env=env, capture_output=True, text=True, timeout=60,
        )
        report = json.loads(self.report.read_text(encoding="utf-8")) if self.report.exists() else None
        return proc, report

    def _run(self, output: str = _ACCEPTED_ONLY, *, exit_code: int = 0,
             workspace: str = _WORKSPACE) -> tuple[subprocess.CompletedProcess, dict]:
        """저장소를 만들고 돌린다. 가짜 pnpm 이 돌지 않았으면 실패한다."""
        _make_repo(self.repo, workspace)
        proc, report = self._invoke(output, exit_code=exit_code)
        self.assertIsNotNone(report, f"가짜 pnpm 이 실행되지 않았다\n{proc.stdout}\n{proc.stderr}")
        return proc, report


class OutsideRepoTest(_StubbedRun):
    """축 1 — 재해소는 저장소 밖에서 돌고 저장소를 건드리지 않는다."""

    def test_resolution_runs_outside_the_repo(self) -> None:
        _, report = self._run()
        cwd = Path(report["cwd"])
        self.assertFalse(cwd.is_relative_to(self.repo), f"재해소가 저장소 안({cwd})에서 돌았다")
        self.assertEqual(report["argv"], ["install", "--lockfile-only", "--strict-peer-dependencies"])

    def test_repo_lockfile_stays_during_resolution(self) -> None:
        _, report = self._run()
        self.assertEqual(report["repo_lock_text"], _LOCKFILE, "재해소 중에 저장소 lockfile 이 바뀌거나 사라졌다")

    def test_repo_is_untouched(self) -> None:
        for label, output, exit_code in (("통과", _ACCEPTED_ONLY, 0), ("새 항목", _WITH_NEW, 1)):
            with self.subTest(label):
                _make_repo(self.repo)
                before = _snapshot(self.repo)
                self.report.unlink(missing_ok=True)
                proc, report = self._invoke(output, exit_code=exit_code)
                self.assertIsNotNone(report)
                self.assertEqual(_snapshot(self.repo), before, proc.stderr)


class StagingTest(_StubbedRun):
    """축 2 — 사본에는 해소 입력만 있다."""

    def test_copy_holds_only_resolution_inputs(self) -> None:
        _, report = self._run()
        # 가짜 pnpm 이 lockfile 을 쓰기 전에 본 목록이다. 제외 글로브 대상(excluded)도 옮기고
        # 제외는 복사한 pnpm-workspace.yaml 로 pnpm 이 적용한다.
        self.assertEqual(report["files"], sorted([
            ".npmrc",
            "codebase/backend/package.json",
            "codebase/packages/excluded/package.json",
            "codebase/packages/sdk/package.json",
            "package.json",
            "pnpm-workspace.yaml",
        ]))

    def _stage(self, repo: Path) -> tuple[list[str], Path]:
        module = load_module_by_path("check_unmet_peers_under_test", SCRIPT)
        dest = self.base / "stage"
        dest.mkdir()
        return module.stage_manifests(repo, dest), dest

    def test_exclusion_globs_reach_pnpm_unchanged(self) -> None:
        _make_repo(self.repo)
        _, dest = self._stage(self.repo)
        self.assertEqual((dest / "pnpm-workspace.yaml").read_text(encoding="utf-8"), _WORKSPACE)

    def test_node_modules_manifests_are_not_copied(self) -> None:
        _make_repo(self.repo, _WORKSPACE.replace('"codebase/packages/*"', '"codebase/packages/**"'))
        copied, _ = self._stage(self.repo)
        self.assertNotIn("codebase/packages/sdk/node_modules/dep/package.json", copied)
        self.assertIn("codebase/packages/sdk/package.json", copied)

    def test_real_workspace_is_staged(self) -> None:
        copied, dest = self._stage(REPO_ROOT)
        for must in ("package.json", "pnpm-workspace.yaml", ".npmrc",
                     "codebase/backend/package.json", "codebase/frontend/package.json",
                     "codebase/channel-web-chat/package.json",
                     "codebase/packages/web-chat-sdk/package.json"):
            self.assertIn(must, copied)
        self.assertNotIn("pnpm-lock.yaml", copied)
        self.assertNotIn(".claude/tools/mermaid-lint/package.json", copied)
        self.assertFalse(any("node_modules" in rel for rel in copied))
        self.assertEqual(sorted(str(p.relative_to(dest)) for p in dest.rglob("*") if p.is_file()), copied)


class VerdictTest(_StubbedRun):
    """축 3 — 판정과 종료 코드."""

    def test_accepted_only_passes(self) -> None:
        proc, _ = self._run(_ACCEPTED_ONLY, exit_code=1)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("[수용됨] typeorm → ioredis", proc.stdout)

    def test_new_unmet_peer_fails(self) -> None:
        proc, _ = self._run(_WITH_NEW, exit_code=1)
        self.assertEqual(proc.returncode, 1)
        self.assertIn("some-lib → react", proc.stderr)

    def test_vanished_accepted_entry_fails(self) -> None:
        proc, _ = self._run("", exit_code=0)
        self.assertEqual(proc.returncode, 1)
        self.assertIn("typeorm → ioredis", proc.stderr)


class FailClosedTest(_StubbedRun):
    """축 4 — 측정하지 못하면 exit 2. 설정 문제는 pnpm 을 부르기 전에 멈춘다."""

    def _assert_undecidable_before_pnpm(self, workspace: str, *, setup=None) -> subprocess.CompletedProcess:
        _make_repo(self.repo, workspace)
        if setup:
            setup()
        proc, report = self._invoke()
        self.assertIsNone(report, "측정할 수 없는 설정인데 재해소를 시작했다")
        self.assertEqual(proc.returncode, 2, proc.stderr)
        self.assertIn("ERROR:", proc.stderr)
        return proc

    def test_unusable_packages_list(self) -> None:
        cases = {
            "키 없음": "overrides:\n  qs: ^6.16.0\n",
            "빈 목록": "packages: []\n",
            "문자열": 'packages: "codebase/backend"\n',
            "비문자열 항목": "packages:\n  - 1\n",
            "매핑 아님": "- codebase/backend\n",
            "깨진 YAML": "packages: [\n",
        }
        for label, workspace in cases.items():
            with self.subTest(label):
                self.report.unlink(missing_ok=True)
                self._assert_undecidable_before_pnpm(workspace)

    def test_globs_matching_no_manifest(self) -> None:
        self._assert_undecidable_before_pnpm('packages:\n  - "nowhere/*"\n')

    def test_path_outside_the_repo(self) -> None:
        def make_sibling() -> None:
            _write(self.base / "outside" / "pkg" / "package.json", "{}")
        proc = self._assert_undecidable_before_pnpm('packages:\n  - "../outside/*"\n', setup=make_sibling)
        self.assertIn("저장소 밖", proc.stderr)

    def test_resolution_inputs_the_copy_does_not_carry(self) -> None:
        with self.subTest(".pnpmfile.cjs"):
            self._assert_undecidable_before_pnpm(
                _WORKSPACE, setup=lambda: _write(self.repo / ".pnpmfile.cjs", "module.exports = {};\n"))
        with self.subTest("patchedDependencies"):
            self.report.unlink(missing_ok=True)
            self._assert_undecidable_before_pnpm(_WORKSPACE + "patchedDependencies:\n  qs: patches/qs.patch\n")

    def test_missing_pnpm(self) -> None:
        _make_repo(self.repo)
        empty = self.base / "empty-bin"
        empty.mkdir()
        proc, report = self._invoke(path=str(empty))
        self.assertIsNone(report)
        self.assertEqual(proc.returncode, 2, proc.stderr)
        self.assertIn("pnpm 을 찾을 수 없다", proc.stderr)

    def test_nonzero_exit_with_nothing_parsed(self) -> None:
        proc, _ = self._run("ERR_PNPM_SOMETHING registry unreachable\n", exit_code=1)
        self.assertEqual(proc.returncode, 2, proc.stderr)


class WorkflowTest(unittest.TestCase):
    """주간 잡이 스크립트보다 먼저 PyYAML 을 설치한다. 빠지면 잡이 ImportError 로 exit 2 가 된다."""

    def test_pyyaml_installed_before_the_check(self) -> None:
        steps = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))["jobs"]["unmet-peers"]["steps"]
        runs = [str(step.get("run", "")) for step in steps]
        check = next(i for i, run in enumerate(runs) if "scripts/check-unmet-peers.py" in run)
        install = [i for i, run in enumerate(runs) if "pip install" in run and "pyyaml" in run.lower()]
        self.assertTrue(install and install[0] < check, "check-unmet-peers 앞에 PyYAML 설치 단계가 없다")


if __name__ == "__main__":
    unittest.main()
