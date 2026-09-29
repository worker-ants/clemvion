"""Tests for `.claude/tools/local_config.py` and its two callers.

NERV 연동 설정 세 자리(`.mcp.json` · `.claude/settings.local.json` · `.nerv/`)는 gitignore
대상이라 `git worktree add` 가 옮기지 않는다. 그래서 워크트리에서 띄운 세션에는 NERV MCP 도
`NERV_*` env 도 없었고, 플러그인의 `nerv-init --check` 는 흔적이 없으면 조용히 지나가도록 짜여
있어 그 상태를 알리지도 않았다.

고정하는 것:

- `ensure-worktree.sh` 가 만든 워크트리에 세 자리가 **링크로** 걸린다. 이미 있는 것은 덮지
  않는다. 이미 워크트리 안에서 부르면 빠진 링크만 채운다.
- **링크가 git 에 잡히지 않는다.** 실측(2026-09-29): `.gitignore` 의 `.nerv/`(끝 슬래시)는
  디렉터리에만 맞아 `.nerv` **심볼릭 링크를 놓친다.** `.claude/settings.local.json` 은 저장소
  `.gitignore` 에 없고 사용자 전역 ignore 에만 있었다. 둘 다 잡히지 않으면 `git add -A` 가
  링크를 커밋하고, reaper 는 `status --porcelain` 이 비지 않아 그 워크트리를 영영 치우지
  않는다. 그래서 **실제 저장소 `.gitignore`** 를 복사해 판정하고, 사용자 전역 ignore 는
  `core.excludesFile=/dev/null` 로 끈다(그것 덕에 초록이 되면 다른 사람 머신에서 깨진다).
- 원문 자격 증명이 든 `.mcp.json` 은 링크하지 않는다. **어떤 출력에도 토큰 값이 나오지 않는다.**
- `bootstrap-session.sh` 가 빠진 자리와 원문 토큰을 경고한다. 헬퍼나 python3 이 없어도 세션을
  막지 않는다(bootstrap 은 늘 exit 0).
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

import _harness

TOOLS_DIR = _harness.REPO_ROOT / ".claude" / "tools"
HELPER_SRC = TOOLS_DIR / "local_config.py"
ENSURE_SRC = TOOLS_DIR / "ensure-worktree.sh"
BOOTSTRAP_SRC = TOOLS_DIR / "bootstrap-session.sh"
GITIGNORE_SRC = _harness.REPO_ROOT / ".gitignore"

local_config = _harness.load_module_by_path("local_config_under_test", HELPER_SRC)

# 출력에 나오면 안 되는 값. 어느 출력에서든 이 문자열을 찾으면 실패다.
SECRET = "nerv_pat_TESTSECRET_0123456789abcdef"

ENV_REF_MCP = {
    "mcpServers": {
        "nerv": {
            "type": "http",
            "url": "${NERV_SERVER:-https://nerv.example.invalid}/mcp",
            "headers": {
                "Authorization": "Bearer ${NERV_TOKEN}",
                "X-NERV-Project": "clemvion",
            },
        }
    }
}
RAW_TOKEN_MCP = {
    "mcpServers": {
        "nerv": {
            "type": "http",
            "url": "https://nerv.example.invalid/mcp",
            "headers": {"Authorization": f"Bearer {SECRET}", "X-NERV-Project": "clemvion"},
        }
    }
}


def _mcp(headers=None, env=None):
    server = {"type": "http", "url": "https://x.invalid/mcp"}
    if headers is not None:
        server["headers"] = headers
    if env is not None:
        server["env"] = env
    return {"mcpServers": {"s": server}}


class LiteralCredentialsTest(unittest.TestCase):
    """원문 판정의 경계. 값이 아니라 위치를 돌려준다."""

    def _creds(self, doc):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / ".mcp.json"
            path.write_text(doc if isinstance(doc, str) else json.dumps(doc), encoding="utf-8")
            return local_config.literal_credentials(path)

    def test_env_reference_is_not_literal(self):
        self.assertEqual(self._creds(ENV_REF_MCP), [])

    def test_raw_bearer_token_is_reported_by_location_not_value(self):
        found = self._creds(RAW_TOKEN_MCP)
        self.assertEqual(found, ["mcpServers.nerv.headers.Authorization"])
        self.assertNotIn(SECRET, " ".join(found))

    def test_default_value_inside_reference_is_literal(self):
        # `${VAR:-기본값}` 의 기본값은 원문이다 — 참조가 있다고 통과시키면 안 된다.
        self.assertEqual(
            self._creds(_mcp(headers={"Authorization": "Bearer ${NERV_TOKEN:-abc123}"})),
            ["mcpServers.s.headers.Authorization"],
        )

    def test_non_secret_header_is_ignored(self):
        self.assertEqual(self._creds(_mcp(headers={"X-NERV-Project": "clemvion"})), [])

    def test_secret_like_env_of_stdio_server_is_reported(self):
        self.assertEqual(
            self._creds(_mcp(env={"GITHUB_TOKEN": "ghp_x", "LOG_LEVEL": "debug"})),
            ["mcpServers.s.env.GITHUB_TOKEN"],
        )

    def test_api_key_header_is_reported(self):
        self.assertEqual(
            self._creds(_mcp(headers={"X-Api-Key": "k-1"})), ["mcpServers.s.headers.X-Api-Key"]
        )

    def test_scheme_word_alone_is_not_a_credential(self):
        self.assertEqual(self._creds(_mcp(headers={"Authorization": "Bearer "})), [])

    def test_unreadable_json_is_none_not_empty(self):
        # 읽지 못한 파일을 "원문 없음" 으로 세면 확인하지 않은 파일을 링크한다.
        self.assertIsNone(self._creds("{not json"))

    def test_missing_file_is_none(self):
        self.assertIsNone(local_config.literal_credentials(Path("/nonexistent/.mcp.json")))


class _RepoFixture(unittest.TestCase):
    """main checkout 하나 + 실제 스크립트 사본 + 실제 `.gitignore`."""

    def setUp(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        self.main = Path(os.path.realpath(tmp)) / "repo"
        _harness.make_temp_git_repo(self.main)
        tools = self.main / ".claude" / "tools"
        tools.mkdir(parents=True)
        for src in (HELPER_SRC, ENSURE_SRC, BOOTSTRAP_SRC):
            shutil.copy(src, tools / src.name)
        shutil.copy(GITIGNORE_SRC, self.main / ".gitignore")
        # 워크트리가 스크립트를 갖도록 커밋한다(워크트리는 커밋된 트리만 받는다).
        self._git(self.main, "add", ".gitignore", ".claude/tools")
        self._git(self.main, "commit", "-qm", "harness")

    def _git(self, repo, *args):
        return _harness.git_in(repo, *args)

    def _status(self, repo):
        # 사용자 전역 ignore 를 끈다 — 그것 덕분에 통과하면 다른 머신에서 깨진다.
        return self._git(repo, "-c", "core.excludesFile=/dev/null",
                         "status", "--porcelain", "--untracked-files=all").stdout

    def _write_local_config(self, mcp=ENV_REF_MCP):
        (self.main / ".mcp.json").write_text(json.dumps(mcp), encoding="utf-8")
        settings = self.main / ".claude" / "settings.local.json"
        settings.write_text(json.dumps({"env": {"NERV_TOKEN": SECRET}}), encoding="utf-8")
        (self.main / ".nerv" / "outbox").mkdir(parents=True)

    def _run(self, *args, cwd):
        env = dict(os.environ)
        env["GIT_CEILING_DIRECTORIES"] = str(self.main.parent)
        env["REAP_MIN_INTERVAL"] = "999999"   # bootstrap 의 reaper 는 이 테스트 밖이다
        env["REAP_GH_BIN"] = "/nonexistent-gh"
        result = subprocess.run(list(args), cwd=cwd, env=env, capture_output=True, text=True)
        self.assertNotIn(SECRET, result.stdout + result.stderr, "토큰 값이 출력에 나왔다")
        return result

    def _ensure(self, name="task", slug="abc123", cwd=None):
        return self._run("bash", str(self.main / ".claude/tools/ensure-worktree.sh"),
                         name, slug, cwd=cwd or self.main)


class EnsureWorktreeLinksTest(_RepoFixture):
    def test_new_worktree_gets_all_three_links(self):
        self._write_local_config()
        result = self._ensure()
        self.assertEqual(result.returncode, 0, result.stderr)
        wt = self.main / ".claude/worktrees/task-abc123"
        for rel in local_config.LOCAL_CONFIG_PATHS:
            with self.subTest(rel=rel):
                self.assertTrue((wt / rel).is_symlink(), f"{rel} 가 링크가 아니다")
                self.assertEqual(os.readlink(wt / rel), str(self.main / rel))
        # 마지막 줄은 여전히 cd 명령이다(호출자가 그 줄을 복사한다).
        self.assertTrue(result.stdout.rstrip().splitlines()[-1].strip().startswith("cd "))

    def test_links_are_ignored_by_the_repo_gitignore(self):
        self._write_local_config()
        self._ensure()
        wt = self.main / ".claude/worktrees/task-abc123"
        self.assertEqual(self._status(wt), "",
                         "링크가 git 에 잡힌다 — git add -A 가 커밋하고 reaper 가 dirty 로 건너뛴다")

    def test_raw_token_mcp_json_is_not_linked_and_others_are(self):
        self._write_local_config(mcp=RAW_TOKEN_MCP)
        result = self._ensure()
        wt = self.main / ".claude/worktrees/task-abc123"
        self.assertFalse((wt / ".mcp.json").is_symlink())
        self.assertFalse((wt / ".mcp.json").exists())
        self.assertTrue((wt / ".claude/settings.local.json").is_symlink())
        self.assertTrue((wt / ".nerv").is_symlink())
        self.assertIn("mcpServers.nerv.headers.Authorization", result.stdout)

    def test_missing_source_is_skipped_quietly(self):
        (self.main / ".nerv").mkdir()
        result = self._ensure()
        self.assertEqual(result.returncode, 0, result.stderr)
        wt = self.main / ".claude/worktrees/task-abc123"
        self.assertTrue((wt / ".nerv").is_symlink())
        self.assertFalse(_present(wt / ".mcp.json"))
        self.assertFalse(_present(wt / ".claude/settings.local.json"))

    def test_inside_a_worktree_it_fills_only_missing_links(self):
        self._write_local_config()
        wt = self.main / ".claude/worktrees/manual"
        self._git(self.main, "worktree", "add", "-q", str(wt), "-b", "claude/manual")
        # 사람이 일부러 둔 파일은 덮지 않는다.
        (wt / ".nerv").mkdir()
        result = self._ensure(cwd=wt)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Already inside a worktree", result.stdout)
        self.assertTrue((wt / ".mcp.json").is_symlink())
        self.assertTrue((wt / ".claude/settings.local.json").is_symlink())
        self.assertFalse((wt / ".nerv").is_symlink(), "이미 있던 .nerv 를 덮었다")
        self.assertFalse((self.main / ".claude/worktrees/task-abc123").exists())

    def test_link_does_nothing_for_the_main_checkout_itself(self):
        self._write_local_config()
        self.assertEqual(local_config.link(self.main, self.main), [])

    def test_broken_link_in_the_worktree_is_left_alone(self):
        # 끊긴 링크도 "있다" 로 센다. exists() 만 보면 os.symlink 가 FileExistsError 로 죽는다.
        self._write_local_config()
        wt = self.main / ".claude/worktrees/manual"
        self._git(self.main, "worktree", "add", "-q", str(wt), "-b", "claude/manual")
        os.symlink("/nonexistent/target", wt / ".nerv")
        lines = local_config.link(wt, self.main)
        self.assertEqual(os.readlink(wt / ".nerv"), "/nonexistent/target")
        self.assertTrue(any(line.startswith("그대로") and ".nerv" in line for line in lines))

    def test_unreadable_mcp_json_is_not_linked(self):
        self._write_local_config()
        (self.main / ".mcp.json").write_text("{broken", encoding="utf-8")
        result = self._ensure()
        wt = self.main / ".claude/worktrees/task-abc123"
        self.assertFalse(_present(wt / ".mcp.json"))
        self.assertIn("읽지 못해", result.stdout)


class BootstrapCheckTest(_RepoFixture):
    def _bootstrap(self, root):
        return self._run("bash", str(root / ".claude/tools/bootstrap-session.sh"), cwd=root)

    def _worktree(self, name="bare"):
        wt = self.main / ".claude/worktrees" / name
        self._git(self.main, "worktree", "add", "-q", str(wt), "-b", f"claude/{name}")
        return wt

    def test_worktree_session_is_told_what_is_missing(self):
        self._write_local_config()
        wt = self._worktree()          # ensure-worktree 를 거치지 않은 워크트리
        result = self._bootstrap(wt)
        self.assertEqual(result.returncode, 0)
        self.assertIn(".mcp.json", result.stdout)
        self.assertIn(".claude/settings.local.json", result.stdout)
        self.assertIn(".nerv", result.stdout)
        self.assertIn("local_config.py link", result.stdout)

    def test_linked_worktree_session_is_quiet(self):
        self._write_local_config()
        self._ensure()
        result = self._bootstrap(self.main / ".claude/worktrees/task-abc123")
        self.assertNotIn("로컬 설정", result.stdout)

    def test_raw_token_is_warned_in_the_main_session_without_the_value(self):
        self._write_local_config(mcp=RAW_TOKEN_MCP)
        result = self._bootstrap(self.main)
        self.assertEqual(result.returncode, 0)
        self.assertIn("자격 증명 원문", result.stdout)
        self.assertIn("mcpServers.nerv.headers.Authorization", result.stdout)

    def test_repo_without_nerv_config_is_quiet(self):
        result = self._bootstrap(self._worktree())
        self.assertNotIn("로컬 설정", result.stdout)
        self.assertNotIn("자격 증명", result.stdout)

    def test_broken_link_is_reported(self):
        self._write_local_config()
        self._ensure()
        shutil.rmtree(self.main / ".nerv")
        result = self._bootstrap(self.main / ".claude/worktrees/task-abc123")
        self.assertIn("링크가 끊겼다", result.stdout)

    def test_missing_helper_never_blocks_the_session(self):
        self._write_local_config()
        wt = self._worktree()
        (wt / ".claude/tools/local_config.py").unlink()
        result = self._bootstrap(wt)
        self.assertEqual(result.returncode, 0)
        self.assertNotIn("Traceback", result.stderr)


class GitignoreTest(unittest.TestCase):
    """링크가 잡히지 않으려면 끝 슬래시 없는 패턴이어야 한다 — 문자열로 먼저 고정한다."""

    def test_patterns_match_symlinks_too(self):
        lines = {ln.strip() for ln in GITIGNORE_SRC.read_text(encoding="utf-8").splitlines()}
        for pattern in (".nerv", ".mcp.json", ".claude/settings.local.json"):
            with self.subTest(pattern=pattern):
                self.assertIn(pattern, lines)
        self.assertNotIn(".nerv/", lines, "`.nerv/` 는 디렉터리에만 맞아 `.nerv` 링크를 놓친다")


def _present(path: Path) -> bool:
    return path.exists() or path.is_symlink()


if __name__ == "__main__":
    unittest.main()
