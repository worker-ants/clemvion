"""`scripts/ci-paths-changed.sh` 의 판정을 **실제 git 저장소 + subprocess** 로 고정한다.

## 왜 실행 검증인가

이 스크립트가 required status check 의 판정자다. under-match(관련 변경인데 `false`)면
체크는 초록인데 검사는 하나도 안 돈다 — `test_required_check_skip_jobs.py` 가 막으려는
것과 **정확히 같은 클래스**의 실패이고, 그 파일의 정적 YAML 검사로는 잡히지 않는다.
초판은 이 스크립트를 손으로만 확인하고 자동 테스트를 두지 않았다(ai-review W1).

## fail-safe 방향

불확실하면 **항상 `true`**(= 실제 검사를 돌린다). 조용히 건너뛰는 쪽이 아니라 불필요하게
도는 쪽으로 기운다. 아래 `FailSafeBranchTest` 가 네 분기를 각각 고정한다 — 하나라도
`false` 로 뒤집히면 게이트가 조용히 사라진다.
"""

from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

from _harness import REPO_ROOT

SCRIPT = REPO_ROOT / "scripts" / "ci-paths-changed.sh"


def git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True, text=True, check=True,
        # 공유 `.git/config` 오염 방지 + 상위 탐색 차단 (이 저장소의 실사고 이후 관례).
        env={"GIT_CEILING_DIRECTORIES": str(repo.parent), "PATH": "/usr/bin:/bin:/usr/local/bin",
             "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t",
             "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"},
    ).stdout.strip()


def run_script(repo: Path, *pathspecs: str, **env_over: str) -> tuple[int, str]:
    """스크립트를 repo 안에서 실행하고 (returncode, stdout) 을 준다."""
    out_file = repo / "_gh_output"
    out_file.write_text("")
    env = {
        "PATH": "/usr/bin:/bin:/usr/local/bin",
        "GITHUB_OUTPUT": str(out_file),
        "GITHUB_EVENT_NAME": "pull_request",
        "GIT_CEILING_DIRECTORIES": str(repo.parent),
    }
    env.update(env_over)
    proc = subprocess.run(
        ["bash", str(SCRIPT), *pathspecs],
        cwd=repo, capture_output=True, text=True, env=env,
    )
    return proc.returncode, proc.stdout + proc.stderr


def verdict(text: str) -> str | None:
    for line in text.splitlines():
        if line.startswith("relevant="):
            return line.split("=", 1)[1].strip()
    return None


class _RepoFixture(unittest.TestCase):
    """base 커밋 하나 + head 커밋 하나를 가진 임시 저장소."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self._tmp.name) / "r"
        self.repo.mkdir()
        git(self.repo, "init", "-q", "-b", "main")
        (self.repo / "seed.txt").write_text("seed\n")
        git(self.repo, "add", "seed.txt")
        git(self.repo, "commit", "-qm", "base")
        self.base = git(self.repo, "rev-parse", "HEAD")

    def tearDown(self):
        self._tmp.cleanup()

    def commit(self, rel: str, body: str = "x\n") -> str:
        p = self.repo / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(body)
        git(self.repo, "add", rel)
        git(self.repo, "commit", "-qm", f"change {rel}")
        return git(self.repo, "rev-parse", "HEAD")


class VerdictTest(_RepoFixture):
    def test_matching_change_is_relevant(self):
        head = self.commit("codebase/frontend/app.ts")
        rc, out = run_script(
            self.repo, "codebase/frontend/**",
            PR_BASE_SHA=self.base, PR_HEAD_SHA=head,
        )
        self.assertEqual(rc, 0, out)
        self.assertEqual(verdict(out), "true", out)

    def test_unrelated_change_is_not_relevant(self):
        head = self.commit("docs/readme.md")
        rc, out = run_script(
            self.repo, "codebase/frontend/**",
            PR_BASE_SHA=self.base, PR_HEAD_SHA=head,
        )
        self.assertEqual(rc, 0, out)
        self.assertEqual(verdict(out), "false", out)

    def test_nested_path_matches_the_glob(self):
        """`**` 가 `/` 를 넘는지 — git pathspec 과 GitHub `paths:` 의 의미가 갈리면
        워크플로가 돌던 조건과 이 판정이 어긋난다."""
        head = self.commit("codebase/frontend/a/b/c/deep.ts")
        rc, out = run_script(
            self.repo, "codebase/frontend/**",
            PR_BASE_SHA=self.base, PR_HEAD_SHA=head,
        )
        self.assertEqual(verdict(out), "true", out)

    def test_the_real_manifest_pathspecs_match_every_depth(self):
        """실사용 pathspec 을 **문자열 그대로** 놓고 깊이 0/1/2 를 각각 단언한다.

        위 테스트들은 끝이 `**` 인 형태(`codebase/frontend/**`)만 봤는데, 워크플로가 실제로
        넘기는 것은 **중간**이 `**` 인 `codebase/**/package.json` 이다. 이 형태는 중간
        디렉터리가 1개 이상일 때만 맞아서 `codebase/package.json`(깊이 0)을 놓친다(실측) —
        그래서 워크플로가 깊이 0 을 별도 pathspec 으로 함께 넘긴다. 그 짝을 여기서 고정한다.

        놓치면 나타나는 증상이 `relevant=false`, 즉 **초록인데 검사가 안 도는** 상태다 —
        이 스위트가 존재하는 이유인 바로 그 클래스라 형태별로 단언한다(ai-review W3).
        """
        MANIFEST_SPECS = ("codebase/**/package.json", "codebase/package.json")
        for rel in (
            "codebase/package.json",            # 깊이 0 — `**` 형태가 못 잡는 것
            "codebase/frontend/package.json",   # 깊이 1
            "codebase/packages/sdk/package.json",  # 깊이 2
        ):
            with self.subTest(path=rel):
                head = self.commit(rel)
                rc, out = run_script(
                    self.repo, *MANIFEST_SPECS,
                    PR_BASE_SHA=self.base, PR_HEAD_SHA=head,
                )
                self.assertEqual(rc, 0, out)
                self.assertEqual(verdict(out), "true", out)

    def test_middle_double_star_alone_misses_depth_zero(self):
        """위 짝이 **왜 두 개인지** 를 고정한다 — 하나를 지우면 이 테스트가 RED.

        `codebase/**/package.json` 단독으로도 통과한다면 워크플로의 깊이 0 pathspec 은
        "있어도 그만" 인 장식이 되고, 다음 사람이 중복으로 보고 지운다. 이 단언이 그
        삭제를 막는다.
        """
        head = self.commit("codebase/package.json")
        rc, out = run_script(
            self.repo, "codebase/**/package.json",
            PR_BASE_SHA=self.base, PR_HEAD_SHA=head,
        )
        self.assertEqual(rc, 0, out)
        self.assertEqual(
            verdict(out), "false",
            "중간 `**` 가 깊이 0 을 잡게 됐다면 워크플로의 깊이 0 pathspec 은 불필요해진 "
            "것이므로 여기와 워크플로를 함께 정리할 것:\n" + out,
        )

    def test_any_one_of_several_pathspecs_is_enough(self):
        head = self.commit("pnpm-lock.yaml")
        rc, out = run_script(
            self.repo, "codebase/frontend/**", "pnpm-lock.yaml",
            PR_BASE_SHA=self.base, PR_HEAD_SHA=head,
        )
        self.assertEqual(verdict(out), "true", out)

    def test_verdict_is_written_to_github_output(self):
        """워크플로는 stdout 이 아니라 `$GITHUB_OUTPUT` 을 읽는다 — 거기 안 쓰이면
        `needs.changes.outputs.relevant` 가 빈 값이 되고 전 스텝이 no-op 된다."""
        head = self.commit("codebase/frontend/app.ts")
        out_file = self.repo / "_gh_output"
        run_script(
            self.repo, "codebase/frontend/**",
            PR_BASE_SHA=self.base, PR_HEAD_SHA=head,
        )
        self.assertIn("relevant=true", out_file.read_text())


class PushEventTest(_RepoFixture):
    """push 도 실제 diff 로 판정한다.

    종전엔 `pull_request` 가 아니면 무조건 fail-safe `true` 였다 — 그 결과 main 으로의
    모든 push(문서·plan 머지 포함)가 전체 잡을 돌렸다. required check 데드락은 PR 에만
    해당하므로 그 광역화는 목적 범위를 넘어선다 (ai-review W4).
    """

    def test_push_with_unrelated_change_is_not_relevant(self):
        head = self.commit("docs/readme.md")
        rc, out = run_script(
            self.repo, "codebase/frontend/**",
            GITHUB_EVENT_NAME="push",
            PUSH_BEFORE_SHA=self.base, PUSH_AFTER_SHA=head,
        )
        self.assertEqual(verdict(out), "false", out)

    def test_push_with_matching_change_is_relevant(self):
        head = self.commit("codebase/frontend/app.ts")
        rc, out = run_script(
            self.repo, "codebase/frontend/**",
            GITHUB_EVENT_NAME="push",
            PUSH_BEFORE_SHA=self.base, PUSH_AFTER_SHA=head,
        )
        self.assertEqual(verdict(out), "true", out)

    def test_push_of_a_new_branch_runs_the_checks(self):
        """`before` 가 all-zero 면 부모가 없어 비교 기준이 없다 → fail-safe."""
        head = self.commit("docs/readme.md")
        rc, out = run_script(
            self.repo, "codebase/frontend/**",
            GITHUB_EVENT_NAME="push",
            PUSH_BEFORE_SHA="0" * 40, PUSH_AFTER_SHA=head,
        )
        self.assertEqual(verdict(out), "true", out)

    def test_push_without_shas_runs_the_checks(self):
        self.commit("docs/readme.md")
        rc, out = run_script(
            self.repo, "codebase/frontend/**",
            GITHUB_EVENT_NAME="push",
            PUSH_BEFORE_SHA="", PUSH_AFTER_SHA="",
        )
        self.assertEqual(verdict(out), "true", out)


class FailSafeBranchTest(_RepoFixture):
    """네 분기 각각이 `true` 로 떨어지는지. 하나라도 뒤집히면 게이트가 조용히 사라진다."""

    def test_non_pull_request_event_runs_the_checks(self):
        head = self.commit("docs/readme.md")  # 무관한 변경이어도
        rc, out = run_script(
            self.repo, "codebase/frontend/**",
            GITHUB_EVENT_NAME="schedule",
            PR_BASE_SHA=self.base, PR_HEAD_SHA=head,
        )
        self.assertEqual(verdict(out), "true", out)

    def test_missing_base_sha_runs_the_checks(self):
        self.commit("docs/readme.md")
        rc, out = run_script(self.repo, "codebase/frontend/**",
                             PR_BASE_SHA="", PR_HEAD_SHA="")
        self.assertEqual(verdict(out), "true", out)

    def test_unknown_sha_runs_the_checks(self):
        head = self.commit("docs/readme.md")
        rc, out = run_script(
            self.repo, "codebase/frontend/**",
            PR_BASE_SHA="dead" * 10, PR_HEAD_SHA=head,
        )
        self.assertEqual(verdict(out), "true", out)

    def test_unrelated_history_runs_the_checks(self):
        """force-push·재작성으로 base 가 조상이 아닐 때 merge-base 가 없다."""
        head = self.commit("docs/readme.md")
        git(self.repo, "checkout", "-q", "--orphan", "other")
        (self.repo / "z.txt").write_text("z\n")
        git(self.repo, "add", "z.txt")
        git(self.repo, "commit", "-qm", "orphan")
        orphan = git(self.repo, "rev-parse", "HEAD")
        rc, out = run_script(
            self.repo, "codebase/frontend/**",
            PR_BASE_SHA=orphan, PR_HEAD_SHA=head,
        )
        self.assertEqual(verdict(out), "true", out)

    def test_no_pathspec_is_a_usage_error_not_a_silent_pass(self):
        """인자 없이 부르면 조용히 통과하지 말고 실패해야 한다 —
        `false` 를 내면 그 워크플로의 모든 검사가 영구히 no-op 이 된다."""
        rc, out = run_script(self.repo, PR_BASE_SHA=self.base, PR_HEAD_SHA=self.base)
        self.assertNotEqual(rc, 0, out)
        self.assertNotEqual(verdict(out), "false", out)


class ScriptShapeTest(unittest.TestCase):
    def test_script_exists_and_is_executable(self):
        self.assertTrue(SCRIPT.is_file(), f"{SCRIPT} 부재")
        self.assertTrue(SCRIPT.stat().st_mode & 0o111, "실행 권한 없음")

    def test_script_uses_strict_bash(self):
        """`set -euo pipefail` 이 빠지면 git 실패가 조용히 빈 출력으로 흘러
        `false` 판정이 된다 — fail-safe 방향이 뒤집힌다."""
        self.assertIn("set -euo pipefail", SCRIPT.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
