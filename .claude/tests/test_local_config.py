"""Tests for `.claude/tools/local_config.py` and its two callers.

NERV 연동 설정 세 자리(`.mcp.json` · `.claude/settings.local.json` · `.nerv/`)는 gitignore
대상이라 `git worktree add` 가 옮기지 않는다. 그래서 워크트리에서 띄운 세션에는 NERV MCP 도
`NERV_*` env 도 없었고, 플러그인의 `nerv-init --check` 는 흔적이 없으면 조용히 지나가도록 짜여
있어 그 상태를 알리지도 않았다.

고정하는 것:

- `ensure-worktree.sh` 가 만든 워크트리에 세 자리가 **링크로** 걸린다. 이미 있는 것은 덮지
  않는다. 이미 워크트리 안에서 부르면 빠진 링크만 채운다. 헬퍼가 죽어도 워크트리는 만든다.
- **링크가 git 에 잡히지 않는다.** 실측(2026-09-29): `.gitignore` 의 `.nerv/`(끝 슬래시)는
  디렉터리에만 맞아 `.nerv` **심볼릭 링크를 놓친다.** `.claude/settings.local.json` 은 저장소
  `.gitignore` 에 없고 사용자 전역 ignore 에만 있었다. 둘 다 잡히지 않으면 `git add -A` 가
  링크를 커밋하고, reaper 는 `status --porcelain` 이 비지 않아 그 워크트리를 영영 치우지
  않는다. 그래서 **실제 저장소 `.gitignore`** 를 복사해 판정하고, 사용자 전역 git 설정은
  모든 하위 프로세스에서 끈다(그것 덕에 초록이 되면 다른 사람 머신에서 깨진다).
- 원문 자격 증명이 든 `.mcp.json` 은 링크하지 않고, `check` 도 그것을 "링크하라" 고
  안내하지 않는다(두 명령이 판정을 공유한다). **어떤 출력에도 토큰 값이 나오지 않는다.**
- `bootstrap-session.sh` 가 세션 앵커 기준으로 빠진 자리 · 끊긴 링크 · 원문 토큰을
  경고한다. 헬퍼가 없어도 세션을 막지 않는다(bootstrap 은 늘 exit 0).
- 링크된 워크트리를 `cleanup-worktree.sh --force` 로 지워도 main 원본은 남는다.
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
CLEANUP_SRC = TOOLS_DIR / "cleanup-worktree.sh"
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


def _present(path: Path) -> bool:
    return path.exists() or path.is_symlink()


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

    def test_password_and_jwt_shaped_names_are_reported(self):
        found = self._creds(_mcp(
            headers={"X-Nerv-Jwt": "j"},
            env={"DB_PASSWD": "p", "DB_PWD": "q", "DB_PASSWORD": "r"},
        ))
        self.assertEqual(sorted(found), [
            "mcpServers.s.env.DB_PASSWD", "mcpServers.s.env.DB_PASSWORD",
            "mcpServers.s.env.DB_PWD", "mcpServers.s.headers.X-Nerv-Jwt",
        ])

    def test_api_key_header_is_reported(self):
        self.assertEqual(
            self._creds(_mcp(headers={"X-Api-Key": "k-1"})), ["mcpServers.s.headers.X-Api-Key"]
        )

    def test_scheme_word_alone_is_not_a_credential(self):
        self.assertEqual(self._creds(_mcp(headers={"Authorization": "Bearer "})), [])

    def test_non_string_value_is_skipped(self):
        self.assertEqual(self._creds(_mcp(headers={"Authorization": 42})), [])

    def test_documented_boundary_url_and_args_are_not_scanned(self):
        # 모듈 docstring 의 "판정 범위" 를 그대로 고정한다. 넓히려면 이 테스트와 문서를 함께 바꾼다.
        doc = {"mcpServers": {"s": {"url": "https://x.invalid/mcp?token=abc",
                                    "args": ["--api-key", "sk-1"]}}}
        self.assertEqual(self._creds(doc), [])

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
        self.tmp = Path(os.path.realpath(tmp))
        self.main = self.tmp / "repo"
        _harness.make_temp_git_repo(self.main)
        tools = self.main / ".claude" / "tools"
        tools.mkdir(parents=True)
        for src in (HELPER_SRC, ENSURE_SRC, BOOTSTRAP_SRC, CLEANUP_SRC):
            shutil.copy(src, tools / src.name)
        shutil.copy(GITIGNORE_SRC, self.main / ".gitignore")
        # 워크트리가 스크립트를 갖도록 커밋한다(워크트리는 커밋된 트리만 받는다).
        self._git(self.main, "add", ".gitignore", ".claude/tools")
        self._git(self.main, "commit", "-qm", "harness")
        # 하위 프로세스의 git 이 사용자 설정을 읽지 않게 한다. 전역 excludesFile 의 기본
        # 자리는 `$XDG_CONFIG_HOME/git/ignore` 라 GIT_CONFIG_GLOBAL 만으로는 막히지 않는다.
        self.env = dict(os.environ)
        self.env.update({
            "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_SYSTEM": os.devnull,
            "XDG_CONFIG_HOME": str(self.tmp / "xdg"),
            "GIT_CEILING_DIRECTORIES": str(self.tmp),
            "REAP_MIN_INTERVAL": "999999",       # bootstrap 의 reaper 는 이 테스트 밖이다
            "REAP_GH_BIN": "/nonexistent-gh",
        })

    def _git(self, repo, *args):
        return _harness.git_in(repo, *args)

    def _status(self, repo):
        return self._git(repo, "-c", "core.excludesFile=/dev/null",
                         "status", "--porcelain", "--untracked-files=all").stdout

    def _write_local_config(self, mcp=ENV_REF_MCP):
        (self.main / local_config.MCP_JSON).write_text(json.dumps(mcp), encoding="utf-8")
        (self.main / local_config.SETTINGS_LOCAL).write_text(
            json.dumps({"env": {"NERV_TOKEN": SECRET}}), encoding="utf-8")
        (self.main / local_config.NERV_DIR / "outbox").mkdir(parents=True)
        # 자리를 하나 더 늘리면 이 fixture 도 늘려야 한다 — 늘리지 않으면 여기서 멈춘다.
        created = {local_config.MCP_JSON, local_config.SETTINGS_LOCAL, local_config.NERV_DIR}
        self.assertEqual(created, set(local_config.LOCAL_CONFIG_PATHS))

    def _run(self, *args, cwd):
        """하위 프로세스를 돌린다. **부수 단언**: 어느 출력에도 fixture 토큰이 없어야 한다."""
        result = subprocess.run(list(args), cwd=cwd, env=self.env, capture_output=True, text=True)
        self.assertNotIn(SECRET, result.stdout + result.stderr, "토큰 값이 출력에 나왔다")
        return result

    def _ensure(self, name="task", slug="abc123", cwd=None):
        return self._run("bash", str(self.main / ".claude/tools/ensure-worktree.sh"),
                         name, slug, cwd=cwd or self.main)

    def _worktree(self, name="bare"):
        """ensure-worktree 를 거치지 않은 워크트리(링크 없음)."""
        wt = self.main / ".claude/worktrees" / name
        self._git(self.main, "worktree", "add", "-q", str(wt), "-b", f"claude/{name}")
        return wt

    @property
    def wt(self):
        return self.main / ".claude/worktrees/task-abc123"


class EnsureWorktreeLinksTest(_RepoFixture):
    def test_new_worktree_gets_every_local_config_link(self):
        self._write_local_config()
        result = self._ensure()
        self.assertEqual(result.returncode, 0, result.stderr)
        for rel in local_config.LOCAL_CONFIG_PATHS:
            with self.subTest(rel=rel):
                self.assertTrue((self.wt / rel).is_symlink(), f"{rel} 가 링크가 아니다")
                self.assertEqual(os.readlink(self.wt / rel), str(self.main / rel))
        # 마지막 줄은 여전히 cd 명령이다(호출자가 그 줄을 복사한다).
        self.assertTrue(result.stdout.rstrip().splitlines()[-1].strip().startswith("cd "))

    def test_links_are_ignored_by_the_repo_gitignore(self):
        self._write_local_config()
        result = self._ensure()
        self.assertEqual(result.returncode, 0, result.stderr)
        # 링크가 없으면 아래 단언은 공허하다 — 먼저 링크가 실제로 있는지 본다.
        for rel in local_config.LOCAL_CONFIG_PATHS:
            self.assertTrue((self.wt / rel).is_symlink(), f"{rel} 링크가 만들어지지 않았다")
        self.assertEqual(self._status(self.wt), "",
                         "링크가 git 에 잡힌다 — git add -A 가 커밋하고 reaper 가 dirty 로 건너뛴다")

    def test_raw_token_mcp_json_is_not_linked_and_others_are(self):
        self._write_local_config(mcp=RAW_TOKEN_MCP)
        result = self._ensure()
        self.assertFalse(_present(self.wt / local_config.MCP_JSON))
        self.assertTrue((self.wt / local_config.SETTINGS_LOCAL).is_symlink())
        self.assertTrue((self.wt / local_config.NERV_DIR).is_symlink())
        self.assertIn("mcpServers.nerv.headers.Authorization", result.stdout)

    def test_missing_source_is_skipped_quietly(self):
        (self.main / local_config.NERV_DIR).mkdir()
        result = self._ensure()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.wt / local_config.NERV_DIR).is_symlink())
        self.assertFalse(_present(self.wt / local_config.MCP_JSON))
        self.assertFalse(_present(self.wt / local_config.SETTINGS_LOCAL))

    def test_inside_a_worktree_it_fills_only_missing_links(self):
        self._write_local_config()
        wt = self._worktree("manual")
        # 사람이 일부러 둔 파일은 덮지 않는다.
        (wt / local_config.NERV_DIR).mkdir()
        result = self._ensure(cwd=wt)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Already inside a worktree", result.stdout)
        self.assertTrue((wt / local_config.MCP_JSON).is_symlink())
        self.assertTrue((wt / local_config.SETTINGS_LOCAL).is_symlink())
        self.assertFalse((wt / local_config.NERV_DIR).is_symlink(), "이미 있던 .nerv 를 덮었다")
        self.assertFalse(self.wt.exists())

    def test_crashing_helper_still_creates_the_worktree(self):
        # `set -euo pipefail` 스크립트다. 헬퍼 실패를 삼키지 않으면 cd 안내 줄 전에 죽는다.
        self._write_local_config()
        helper = self.main / ".claude/tools/local_config.py"
        helper.write_text("raise SystemExit(3)\n", encoding="utf-8")
        result = self._ensure()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(self.wt.is_dir())
        self.assertTrue(result.stdout.rstrip().splitlines()[-1].strip().startswith("cd "))

    def test_link_does_nothing_for_the_main_checkout_itself(self):
        self._write_local_config()
        self.assertEqual(local_config.link(self.main, self.main), [])

    def test_broken_link_in_the_worktree_is_left_alone(self):
        # 끊긴 링크도 "있다" 로 센다. exists() 만 보면 os.symlink 가 FileExistsError 로 죽는다.
        self._write_local_config()
        wt = self._worktree("manual")
        os.symlink("/nonexistent/target", wt / local_config.NERV_DIR)
        lines = local_config.link(wt, self.main)
        self.assertEqual(os.readlink(wt / local_config.NERV_DIR), "/nonexistent/target")
        self.assertTrue(any(line.startswith("그대로") and local_config.NERV_DIR in line
                            for line in lines))

    def test_one_failing_item_does_not_stop_the_others(self):
        self._write_local_config()
        wt = self._worktree("manual")
        # `.claude` 자리에 파일을 두면 settings.local.json 링크의 mkdir 이 실패한다.
        shutil.rmtree(wt / ".claude")
        (wt / ".claude").write_text("", encoding="utf-8")
        lines = local_config.link(wt, self.main)
        self.assertTrue(any(line.startswith("실패") and local_config.SETTINGS_LOCAL in line
                            for line in lines), lines)
        self.assertTrue((wt / local_config.MCP_JSON).is_symlink())
        self.assertTrue((wt / local_config.NERV_DIR).is_symlink())

    def test_unreadable_mcp_json_is_not_linked(self):
        self._write_local_config()
        (self.main / local_config.MCP_JSON).write_text("{broken", encoding="utf-8")
        result = self._ensure()
        self.assertFalse(_present(self.wt / local_config.MCP_JSON))
        self.assertIn("읽지 못해", result.stdout)

    def test_cleanup_force_keeps_the_main_originals(self):
        # reaper 는 `cleanup-worktree.sh --force` 로 지운다. 링크를 따라가 원본을 지우면 안 된다.
        self._write_local_config()
        self._ensure()
        result = self._run("bash", str(self.main / ".claude/tools/cleanup-worktree.sh"),
                           "task-abc123", "--force", cwd=self.main)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.wt.exists())
        self.assertTrue((self.main / local_config.MCP_JSON).is_file())
        self.assertTrue((self.main / local_config.SETTINGS_LOCAL).is_file())
        self.assertTrue((self.main / local_config.NERV_DIR / "outbox").is_dir())


class BootstrapCheckTest(_RepoFixture):
    def _bootstrap(self, root, cwd=None):
        return self._run("bash", str(root / ".claude/tools/bootstrap-session.sh"), cwd=cwd or root)

    @staticmethod
    def _bootstrap_lines(result):
        return [ln for ln in result.stdout.splitlines() if ln.startswith("bootstrap:")]

    def test_worktree_session_is_told_what_is_missing(self):
        self._write_local_config()
        wt = self._worktree()
        result = self._bootstrap(wt)
        self.assertEqual(result.returncode, 0)
        for rel in local_config.LOCAL_CONFIG_PATHS:
            self.assertIn(rel, result.stdout)
        self.assertIn("local_config.py link", result.stdout)

    def test_uses_the_anchor_not_the_cwd(self):
        # 세션 앵커(스크립트가 놓인 워크트리) 기준이다. cwd 가 main 이어도 워크트리를 본다.
        self._write_local_config()
        wt = self._worktree()
        result = self._bootstrap(wt, cwd=self.main)
        self.assertIn("로컬 설정이 없다", result.stdout)

    def test_raw_token_worktree_is_not_told_to_link_the_mcp_json(self):
        # `link` 가 거부할 항목을 "링크하라" 고 안내하지 않는다(두 명령이 판정을 공유한다).
        self._write_local_config(mcp=RAW_TOKEN_MCP)
        wt = self._worktree()
        warnings = local_config.check(wt, self.main)
        advice = [w for w in warnings if "local_config.py link` 로 링크를 걸고" in w]
        self.assertEqual(len(advice), 1, warnings)
        self.assertNotIn(local_config.MCP_JSON, advice[0])
        self.assertIn(local_config.SETTINGS_LOCAL, advice[0])
        self.assertTrue(any("mcpServers.nerv.headers.Authorization" in w for w in warnings))
        # 보류한 자리는 빠졌다고 말하되 링크 대신 원문 경고를 가리킨다.
        self.assertTrue(any(w.startswith(f"이 워크트리에 {local_config.MCP_JSON} 도 없다")
                            for w in warnings), warnings)
        # 안내대로 하면 실제로 그 둘이 링크된다.
        local_config.link(wt, self.main)
        self.assertTrue((wt / local_config.SETTINGS_LOCAL).is_symlink())
        self.assertFalse(_present(wt / local_config.MCP_JSON))

    def test_linked_worktree_session_is_quiet(self):
        self._write_local_config()
        self._ensure()
        self.assertEqual(local_config.check(self.wt, self.main), [])
        self.assertEqual(self._bootstrap_lines(self._bootstrap(self.wt)), [])

    def test_raw_token_is_warned_in_the_main_session_without_the_value(self):
        self._write_local_config(mcp=RAW_TOKEN_MCP)
        result = self._bootstrap(self.main)
        self.assertEqual(result.returncode, 0)
        self.assertIn("원문 자격 증명", result.stdout)
        self.assertIn("mcpServers.nerv.headers.Authorization", result.stdout)

    def test_unreadable_main_mcp_json_is_warned(self):
        self._write_local_config()
        (self.main / local_config.MCP_JSON).write_text("{broken", encoding="utf-8")
        self.assertIn("읽지 못해", self._bootstrap(self.main).stdout)

    def test_worktree_own_mcp_json_with_raw_token_is_warned(self):
        self._write_local_config()
        wt = self._worktree()
        (wt / local_config.MCP_JSON).write_text(json.dumps(RAW_TOKEN_MCP), encoding="utf-8")
        warnings = local_config.check(wt, self.main)
        self.assertTrue(any(str(wt / local_config.MCP_JSON) in w and "원문 자격 증명" in w
                            for w in warnings), warnings)

    def test_repo_without_nerv_config_is_quiet(self):
        wt = self._worktree()
        self.assertEqual(local_config.check(wt, self.main), [])
        self.assertEqual(self._bootstrap_lines(self._bootstrap(wt)), [])

    def test_broken_link_is_reported(self):
        self._write_local_config()
        self._ensure()
        shutil.rmtree(self.main / local_config.NERV_DIR)
        self.assertIn("링크가 끊겼다", self._bootstrap(self.wt).stdout)

    def test_main_session_skips_the_link_checks(self):
        # main checkout 은 링크 대상이 아니다. main 의 끊긴 `.nerv` 를 "끊긴 링크" 로 부르지 않는다.
        self._write_local_config()
        shutil.rmtree(self.main / local_config.NERV_DIR)
        os.symlink("/nonexistent/target", self.main / local_config.NERV_DIR)
        self.assertEqual(local_config.check(self.main, self.main), [])

    def test_missing_helper_never_blocks_the_session(self):
        self._write_local_config()
        wt = self._worktree()
        (wt / ".claude/tools/local_config.py").unlink()
        result = self._bootstrap(wt)
        self.assertEqual(result.returncode, 0)
        self.assertNotIn("Traceback", result.stderr)

    def test_crashing_check_is_reported_on_stderr(self):
        self._write_local_config()
        wt = self._worktree()
        (wt / ".claude/tools/local_config.py").write_text("raise SystemExit(3)\n",
                                                          encoding="utf-8")
        result = self._bootstrap(wt)
        self.assertEqual(result.returncode, 0)
        self.assertIn("local config check failed", result.stderr)


class CliTest(_RepoFixture):
    def _cli(self, *args, cwd):
        return self._run("python3", str(self.main / ".claude/tools/local_config.py"), *args, cwd=cwd)

    def test_link_without_flags_uses_the_current_worktree(self):
        self._write_local_config()
        wt = self._worktree()
        result = self._cli("link", cwd=wt)
        self.assertEqual(result.returncode, 0, result.stderr)
        for rel in local_config.LOCAL_CONFIG_PATHS:
            self.assertTrue((wt / rel).is_symlink(), rel)

    def test_outside_git_check_exits_zero_and_link_exits_two(self):
        outside = self.tmp / "not-a-repo"
        outside.mkdir()
        check = self._cli("check", cwd=outside)
        link = self._cli("link", cwd=outside)
        self.assertEqual((check.returncode, link.returncode), (0, 2))
        self.assertIn("git 정보를 얻지 못했다", check.stderr)


class GitignoreTest(unittest.TestCase):
    """링크가 잡히려면 끝 슬래시 없는 패턴이 있어야 한다 — 문자열로도 고정한다."""

    def test_every_local_config_path_has_a_slashless_pattern(self):
        lines = {ln.strip() for ln in GITIGNORE_SRC.read_text(encoding="utf-8").splitlines()}
        for rel in local_config.LOCAL_CONFIG_PATHS:
            with self.subTest(rel=rel):
                self.assertIn(rel, lines, "`.nerv/` 같은 끝 슬래시 패턴은 링크를 놓친다")


if __name__ == "__main__":
    unittest.main()
