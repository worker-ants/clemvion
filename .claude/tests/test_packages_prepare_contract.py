"""Every `codebase/packages/*` builds its `dist` the same way, and that way is correct.

The internal packages resolve through `main: dist/index.js`, so a consumer that
builds before `dist` exists cannot resolve them at all. `prepare` is what makes
`dist` appear — pnpm runs it during `pnpm install` for workspace packages.

Until 2026-08-06 it read `[ -d dist ] || tsc`, which checks only that the
DIRECTORY exists. Measured: touching a source file and re-running install left
`dist/index.js` byte-identical. A PR editing `codebase/packages/**` could
therefore be built and tested against the OLD package code and pass — which is
precisely the coverage `frontend-checks`'s `codebase/packages/**` trigger is
there to provide. CI is safe today only because every runner starts from a fresh
checkout with no `dist` at all; local development reproduces the stale case now.

The existence check was not arbitrary. It arrived in 2026-04-29 as a workaround:
back then packages were npm `file:` deps, and npm re-ran `prepare` while
resolving them — after `npm prune --omit=dev` had removed typescript, so a plain
`tsc` failed. The workspace has since moved to pnpm (`workspace:*`), but the
backend Dockerfile still produces a pruned production tree, so "prepare may be
re-run without typescript" is still a real state to survive.

So the contract names all three states instead of collapsing two of them:

    typescript resolvable          → run tsc ALWAYS (stale dist is rebuilt;
                                     a compile error propagates)
    not resolvable, dist present   → no-op (the pruned-tree re-run survives)
    not resolvable, dist missing   → throw (never silently "succeed" with no output)

The old form conflated the first two: with `dist` present it skipped tsc even
where typescript was right there.

`node -e` rather than shell is deliberate — review #231 moved `sdk` to that form
for Windows compatibility, and unifying toward the shell form would undo it.

These tests derive the package list from the directory, so a new package cannot
join with a different `prepare` unnoticed, and they exercise the script's branches
for real instead of only comparing strings — including the failure direction, since
a script that swallows a compile error would satisfy every success-path assertion.

Why the script is duplicated verbatim in seven manifests rather than extracted to
one shared file: `prepare` runs with the package directory as cwd, and the third
branch exists precisely for re-runs inside a pruned/injected production tree, where
the package has been COPIED out of the workspace (pnpm `deploy --prod` with
`injectWorkspacePackages`). A relative path like `../../scripts/prepare.cjs` does
not exist there, so extracting the logic would break it in exactly the situation it
is written to survive. The duplication is deliberate and
`test_every_package_that_builds_uses_the_same_prepare` is what keeps the copies
from drifting — the `_file_mtime` pair, duplicated on the same reasoning, had no
such guard and drifted into a live bug.

Not addressed here, measured rather than assumed: `tsc` now runs on every install,
non-incrementally. Measured cost for the five frontend-closure packages is 2.5s of
a `pnpm install --filter "frontend..."`. `incremental` + `tsBuildInfoFile` would
cut it, but that changes build outputs and belongs in its own change.
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

import _harness  # noqa: F401  — side effect: harness path setup
from _harness import REPO_ROOT

PACKAGES_DIR = REPO_ROOT / "codebase" / "packages"


def _manifests() -> list[tuple[str, dict]]:
    out = []
    for d in sorted(PACKAGES_DIR.iterdir()):
        f = d / "package.json"
        if f.is_file():
            out.append((d.name, json.loads(f.read_text(encoding="utf-8"))))
    return out


class PrepareIsUniformTest(unittest.TestCase):
    def test_the_directory_is_not_empty(self):
        # 도출 기반 테스트의 바닥 — 목록이 비면 아래 단언들이 전부 vacuous 하게 통과한다.
        self.assertGreaterEqual(len(_manifests()), 5, "패키지를 하나도 못 찾았다")

    def test_every_package_that_builds_uses_the_same_prepare(self):
        prepares = {
            name: (m.get("scripts") or {}).get("prepare")
            for name, m in _manifests()
            if (m.get("scripts") or {}).get("prepare")
        }
        self.assertGreaterEqual(len(prepares), 5, "prepare 를 가진 패키지가 너무 적다")
        distinct = sorted(set(prepares.values()))
        self.assertEqual(
            len(distinct), 1,
            "모든 패키지의 prepare 는 byte-identical 이어야 한다. 서로 다른 형태:\n"
            + "\n".join(f"  {n}: {p}" for n, p in sorted(prepares.items())),
        )

    def test_every_package_with_a_dist_entrypoint_has_a_prepare(self):
        # `main: dist/...` 인데 prepare 가 없으면 아무도 dist 를 만들지 않는다.
        missing = [
            name for name, m in _manifests()
            if str(m.get("main", "")).startswith("dist/")
            and not (m.get("scripts") or {}).get("prepare")
        ]
        self.assertEqual(missing, [], "dist 진입점을 쓰면서 prepare 가 없다")

    def test_the_stale_dist_shortcut_is_gone(self):
        # 회귀 앵커: 존재만 보는 옛 형태로 되돌아가면 여기서 죽는다.
        for name, m in _manifests():
            p = (m.get("scripts") or {}).get("prepare") or ""
            self.assertNotIn(
                "[ -d dist ]", p,
                f"{name}: `[ -d dist ]` 는 디렉터리 존재만 본다 — stale dist 가 재빌드되지 않는다",
            )


class PrepareBranchBehaviourTest(unittest.TestCase):
    """문자열 비교가 아니라 세 갈래를 실제로 실행해 본다."""

    @classmethod
    def setUpClass(cls):
        # 여기서는 스크립트 하나만 골라 행위를 본다. 그 하나가 **전부**를 대표한다는 것은
        # `PrepareIsUniformTest.test_every_package_that_builds_uses_the_same_prepare` 가
        # 별도로 보장한다 — 그쪽이 깨지면 이 클래스의 결론은 나머지 패키지로 일반화되지 않는다.
        prepares = {
            (m.get("scripts") or {}).get("prepare")
            for _, m in _manifests()
            if (m.get("scripts") or {}).get("prepare")
        }
        assert prepares, "prepare 를 가진 패키지가 없다 — 아래 행위 테스트가 전부 무의미해진다"
        cls.prepare = sorted(prepares)[0]

    def _run(self, *, typescript: bool, dist: bool, tsc_fails: bool = False):
        """`prepare` 를 격리된 임시 패키지에서 돌린다. (returncode, tsc 호출 여부)"""
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "package.json").write_text('{"name":"probe"}', encoding="utf-8")
            if dist:
                (root / "dist").mkdir()

            binp = root / "bin"
            binp.mkdir()
            called = root / "tsc-called"
            (binp / "tsc").write_text(
                f"#!/bin/sh\necho x >> {called}\n"
                + ("echo 'error TS1005' >&2\nexit 2\n" if tsc_fails else "exit 0\n"),
                encoding="utf-8",
            )
            os.chmod(binp / "tsc", 0o755)

            if typescript:
                ts = root / "node_modules" / "typescript"
                ts.mkdir(parents=True)
                (ts / "package.json").write_text(
                    '{"name":"typescript","version":"5.0.0","main":"index.js"}',
                    encoding="utf-8",
                )
                (ts / "index.js").write_text("", encoding="utf-8")

            env = dict(os.environ)
            env["PATH"] = str(binp) + os.pathsep + env["PATH"]
            p = subprocess.run(
                ["sh", "-c", self.prepare], cwd=root, env=env,
                capture_output=True, text=True, timeout=60,
            )
            return p, called.exists()

    def test_typescript_present_always_compiles_even_when_dist_exists(self):
        # 이것이 이 변경의 핵심 — 옛 형태는 dist 가 있으면 tsc 를 건너뛰었다.
        p, compiled = self._run(typescript=True, dist=True)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertTrue(compiled, "dist 가 있어도 typescript 가 있으면 다시 컴파일해야 한다")

    def test_typescript_present_compiles_when_dist_is_missing(self):
        p, compiled = self._run(typescript=True, dist=False)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertTrue(compiled)

    def test_a_compile_error_propagates(self):
        """컴파일 실패가 삼켜지면 이 변경 전체가 무의미하다.

        옛 형태(`[ -d dist ] || tsc`)의 진짜 위험은 건너뛰기만이 아니었다 — `||` 로 엮인
        형태는 한 글자만 잘못 놓여도 실패를 성공으로 바꾼다. 새 형태는 `execSync` 가
        던지도록 두는데, 그 속성을 단언하지 않으면 나중에 누가 `try{}catch{}` 나 `|| true`
        를 덧대도 아무 테스트가 반응하지 않는다. 다른 세 갈래 테스트는 스텁 tsc 가 항상
        exit 0 이라 이 방향을 관측하지 못한다.
        """
        p, compiled = self._run(typescript=True, dist=True, tsc_fails=True)
        self.assertTrue(compiled, "tsc 는 호출됐어야 한다")
        self.assertNotEqual(p.returncode, 0,
                            "tsc 가 실패하면 prepare 도 실패해야 한다 (조용히 통과 금지)")

    def test_a_compile_error_propagates_without_a_prior_dist(self):
        # dist 유무가 실패 전파를 좌우하면 안 된다 — 옛 형태가 바로 그 결합이었다.
        p, compiled = self._run(typescript=True, dist=False, tsc_fails=True)
        self.assertTrue(compiled)
        self.assertNotEqual(p.returncode, 0)

    def test_pruned_tree_with_dist_is_a_noop(self):
        # devDeps 가 prune 된 프로덕션 트리에서 prepare 가 재실행돼도 살아야 한다.
        p, compiled = self._run(typescript=False, dist=True)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertFalse(compiled, "typescript 가 없으면 tsc 를 부르면 안 된다")

    def test_pruned_tree_without_dist_fails_loudly(self):
        # 산출물도 없고 만들 수단도 없으면 조용히 통과하지 않는다.
        p, compiled = self._run(typescript=False, dist=False)
        self.assertNotEqual(p.returncode, 0, "산출물 없이 성공을 보고하면 안 된다")
        self.assertFalse(compiled)
        self.assertIn("dist/ is missing", p.stderr + p.stdout)


if __name__ == "__main__":
    unittest.main()
