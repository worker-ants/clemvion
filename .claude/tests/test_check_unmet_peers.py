"""`scripts/check-unmet-peers.py` — 미충족 peer 관측 스크립트.

이 스크립트는 lockfile 없이 매니페스트만으로 재해소해 미충족 peer 를 센다. 예전에는 **저장소의**
`pnpm-lock.yaml` 을 임시 위치로 치우고 그 자리에서 재해소한 뒤 되돌렸다. 실행 중에는 작업 트리의
lockfile 이 없거나 새로 해소된 판이었다. 2026-10-04 리뷰어 넷이 같은 worktree 에서 이 스크립트를
동시에 돌리는 동안 같은 worktree 의 TEST WORKFLOW(Docker 이미지가 lockfile 을 COPY)가 돌았고,
리뷰어들은 lockfile 부재 오류와 ` D pnpm-lock.yaml` 을 관측했다(NERV Task `CLE-T-DDA7V4`).

여기서 고정하는 것:

  1. **재해소는 저장소 밖 사본에서 돈다** — pnpm 의 cwd 가 저장소가 아니고, 실행 중에도 저장소의
     lockfile 이 그대로 있으며, 실행 뒤 저장소의 어떤 파일도 바뀌지 않는다.
  2. **사본에는 해소에 필요한 것만 있다** — 루트 `package.json` · `pnpm-workspace.yaml` · `.npmrc`
     와 워크스페이스 글로브에 걸리는 매니페스트. lockfile 과 `node_modules` 는 없다.
  3. **판정은 그대로다** — 수용 항목만 나오면 통과, 새 항목이 나오면 실패.
  4. **fail-closed** — 워크스페이스 목록을 읽지 못하면 "문제 없음" 이 아니라 실패다.

실제 레지스트리를 두드리지 않게 PATH 앞에 가짜 `pnpm` 을 둔다. 가짜가 실제로 실행됐는지
마커로 확인한다(`test_override_floors.py` 의 `StubNotUsed` 와 같은 이유).
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from _harness import REPO_ROOT

SCRIPT = REPO_ROOT / "scripts" / "check-unmet-peers.py"

# 가짜 pnpm. 자기가 본 것(cwd, 그 아래 파일 목록, 실행 중 저장소 lockfile 존재)을 JSON 으로 남기고
# 진짜 pnpm 처럼 cwd 에 lockfile 을 쓴 뒤 정해 둔 출력과 종료 코드로 끝난다.
_PNPM_STUB = """\
#!/usr/bin/env python3
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
        "repo_lock_present": os.path.exists(repo_lock),
        "repo_lock_text": open(repo_lock, encoding="utf-8").read() if os.path.exists(repo_lock) else None,
    }, fh)
# 진짜 pnpm 은 --lockfile-only 로 cwd 에 새 lockfile 을 쓴다.
with open(os.path.join(cwd, "pnpm-lock.yaml"), "w", encoding="utf-8") as fh:
    fh.write("lockfileVersion: '9.0'\\n# stub\\n")
sys.stdout.write(open(os.environ["STUB_OUTPUT"], encoding="utf-8").read())
sys.exit(int(os.environ.get("STUB_EXIT", "0")))
"""

_WORKSPACE = """\
packages:
  - "codebase/backend"
  - "codebase/packages/*"
overrides:
  qs: ^6.16.0
"""

_LOCKFILE = "lockfileVersion: '9.0'\n# repo lockfile\n"

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


def _make_repo(root: Path, workspace: str = _WORKSPACE) -> None:
    """가짜 저장소 — 스크립트 사본과 재해소에 쓰이는 파일, 쓰이면 안 되는 파일을 함께 둔다."""
    _write(root / "scripts" / "check-unmet-peers.py", SCRIPT.read_text(encoding="utf-8"))
    _write(root / "package.json", json.dumps({"name": "root", "private": True}))
    _write(root / "pnpm-workspace.yaml", workspace)
    _write(root / ".npmrc", "node-linker=isolated\n")
    _write(root / "pnpm-lock.yaml", _LOCKFILE)
    _write(root / "codebase" / "backend" / "package.json", json.dumps({"name": "backend"}))
    _write(root / "codebase" / "backend" / "src" / "main.ts", "export {};\n")
    _write(root / "codebase" / "packages" / "sdk" / "package.json", json.dumps({"name": "sdk"}))
    _write(root / "codebase" / "packages" / "sdk" / "node_modules" / "dep" / "package.json", "{}")
    # 워크스페이스 글로브 밖의 매니페스트 — 별도 npm 도구(.claude/tools/mermaid-lint 같은 것)
    _write(root / "tools" / "standalone" / "package.json", json.dumps({"name": "standalone"}))


def _snapshot(root: Path) -> dict[str, str]:
    """저장소 안 모든 파일의 경로 → 내용 해시."""
    out = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            out[str(path.relative_to(root))] = hashlib.sha256(path.read_bytes()).hexdigest()
    return out


class UnmetPeersOutsideRepoTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix="unmet-peers-test-")
        base = Path(self._tmp.name).resolve()
        self.repo = base / "repo"
        self.bin = base / "bin"
        self.report = base / "report.json"
        self.output = base / "output.txt"
        self.bin.mkdir()
        # 원자적으로 놓는다 — 실행 불가 상태가 잠깐 보이면 execvp 가 다음 PATH 의 진짜 pnpm 을 고른다.
        staging = self.bin / ".pnpm.tmp"
        staging.write_text(_PNPM_STUB, encoding="utf-8")
        staging.chmod(0o755)
        staging.rename(self.bin / "pnpm")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _run(self, output: str, *, exit_code: int = 0, workspace: str = _WORKSPACE,
             expect_stub_ran: bool = True) -> tuple[subprocess.CompletedProcess, dict | None]:
        _make_repo(self.repo, workspace)
        self.output.write_text(output, encoding="utf-8")
        env = dict(os.environ)
        env.update({
            "PATH": f"{self.bin}{os.pathsep}{env.get('PATH', '')}",
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
        if expect_stub_ran:
            self.assertIsNotNone(report, f"가짜 pnpm 이 실행되지 않았다\n{proc.stdout}\n{proc.stderr}")
        return proc, report

    # 축 1 ─────────────────────────────────────────────────────────────────────
    def test_resolution_runs_outside_the_repo(self) -> None:
        _, report = self._run(_ACCEPTED_ONLY)
        cwd = Path(report["cwd"])
        self.assertNotEqual(cwd, self.repo)
        self.assertFalse(cwd.is_relative_to(self.repo), f"재해소가 저장소 안({cwd})에서 돌았다")
        self.assertEqual(report["argv"], ["install", "--lockfile-only", "--strict-peer-dependencies"])

    def test_repo_lockfile_stays_during_resolution(self) -> None:
        _, report = self._run(_ACCEPTED_ONLY)
        self.assertTrue(report["repo_lock_present"], "재해소 중에 저장소 lockfile 이 사라졌다")
        self.assertEqual(report["repo_lock_text"], _LOCKFILE)

    def test_repo_is_untouched_after_resolution(self) -> None:
        _make_repo(self.repo)
        before = _snapshot(self.repo)
        # _run 이 같은 내용으로 다시 쓰므로 스냅숏은 같은 기준이다.
        proc, _ = self._run(_ACCEPTED_ONLY)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(_snapshot(self.repo), before)

    def test_repo_is_untouched_when_resolution_reports_new_peers(self) -> None:
        _make_repo(self.repo)
        before = _snapshot(self.repo)
        proc, _ = self._run(_WITH_NEW, exit_code=1)
        self.assertEqual(proc.returncode, 1)
        self.assertEqual(_snapshot(self.repo), before)

    # 축 2 ─────────────────────────────────────────────────────────────────────
    def test_copy_holds_only_resolution_inputs(self) -> None:
        _, report = self._run(_ACCEPTED_ONLY)
        # 가짜 pnpm 이 lockfile 을 쓰기 전에 본 목록이다.
        self.assertEqual(report["files"], sorted([
            ".npmrc",
            "codebase/backend/package.json",
            "codebase/packages/sdk/package.json",
            "package.json",
            "pnpm-workspace.yaml",
        ]))

    # 축 3 ─────────────────────────────────────────────────────────────────────
    def test_accepted_only_passes(self) -> None:
        proc, _ = self._run(_ACCEPTED_ONLY, exit_code=1)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("[수용됨] typeorm → ioredis", proc.stdout)

    def test_new_unmet_peer_fails(self) -> None:
        proc, _ = self._run(_WITH_NEW, exit_code=1)
        self.assertEqual(proc.returncode, 1)
        self.assertIn("some-lib → react", proc.stderr)

    # 축 4 ─────────────────────────────────────────────────────────────────────
    def test_missing_workspace_packages_fails_closed(self) -> None:
        proc, report = self._run(_ACCEPTED_ONLY, workspace="overrides:\n  qs: ^6.16.0\n",
                                 expect_stub_ran=False)
        self.assertIsNone(report, "워크스페이스 목록 없이 재해소를 시작했다")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("packages", proc.stderr)


if __name__ == "__main__":
    unittest.main()
