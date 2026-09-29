#!/usr/bin/env python3
"""main checkout 의 NERV 로컬 설정을 워크트리에 링크하고, 빠진 것을 세션 시작 때 알린다.

NERV 연동 전용이다(NERV Task `CLE-T-0EZEYF`, 정책은 `.claude/docs/worktree-policy.md` §8).

**왜 필요한가.** NERV 연동 설정 세 자리(`.mcp.json` · `.claude/settings.local.json` ·
`.nerv/`)는 gitignore 대상이라 `git worktree add` 가 새 워크트리에 옮겨 주지 않는다. 그래서
워크트리에서 띄운 세션에는 NERV MCP 도 플러그인 훅이 읽는 `NERV_*` env 도 오프라인 큐도 없다.
플러그인의 `nerv-init --check` 는 **흔적이 전혀 없으면 조용히 지나가도록** 짜여 있어(NERV 와
무관한 저장소에서 재촉하지 않으려고) 이 상태를 알리지 않는다. 워크트리 세션은 흔적이 하나도
없는 쪽으로 보이기 때문이다.

두 가지를 한다.

- ``link`` — 워크트리에 main checkout 의 세 자리를 심볼릭 링크로 건다. 이미 있는 것은
  건드리지 않는다. `ensure-worktree.sh` 가 워크트리를 만든 직후 부른다.
- ``check`` — 세션 루트에 빠진 것을 경고한다. `bootstrap-session.sh` 가 부른다.
  두 명령은 "무엇을 링크할 수 있는가" 를 ``_link_blocker`` 하나로 판정한다. 따로 판정하면
  `check` 가 `link` 가 거부할 항목에 "링크하라" 고 안내하게 된다.

**원문 자격 증명이 든 `.mcp.json` 은 링크하지 않는다.** 토큰 원문을 워크트리마다 늘리지 않고
`.mcp.json` 에는 토큰을 두지 않으려는 것이다. 토큰 값의 정해진 자리는
`.claude/settings.local.json` 의 `env` 라서 그 파일은 원문이 있어도 링크한다. 판정은 값이
아니라 **위치**만 돌려준다. 이 스크립트는 어떤 경로로도 자격 증명 값을 출력하지 않는다.

**권장 형태는 `headersHelper` 다.** 연결할 때 명령이 `settings.local.json` 의 토큰을 읽어
헤더 JSON 을 출력한다. `"Authorization": "Bearer ${NERV_TOKEN}"` 참조는 원문이 아니라서
이 판정을 통과하지만 **붙지 않는다.** 실측(2026-09-29, Claude Code 2.1.284, `claude mcp get
nerv`, 셸 env 에서 `NERV_*` 제거): 참조형은 연결 실패, `headersHelper` 는 연결 성공, 틀린
토큰을 내는 헬퍼는 401 로 실패했다. `settings.local.json` 의 `env` 가 `.mcp.json` 확장에
쓰이지 않는다(NERV 플러그인 `nerv-init` 템플릿은 참조형이다).

판정 범위(좁히지도 넓히지도 않은 경계를 적어 둔다): `mcpServers.<이름>.headers` 와
`mcpServers.<이름>.env` 에서 이름이 자격 증명처럼 보이는 키(``_SECRET_HINTS``)의 값만 본다.
`url` 쿼리나 `args` 에 박힌 토큰은 보지 않는다. 이 저장소의 `.mcp.json` 에는 그런 자리가 없다.

**링크의 공유 동작.** 링크라서 세 자리는 모든 워크트리가 main 의 원본 하나를 쓴다.
`.claude/settings.local.json` 에 링크를 통해 쓰면 권한 허용 · env 변경이 모든 워크트리에
퍼진다. 쓰는 쪽이 임시 파일 뒤 rename 으로 쓰면 그 워크트리의 링크는 일반 파일로 바뀐다.
`.nerv/outbox` 도 공유되며 중복 전송은 큐 파일의 `idempotency_key` 로 막는다.

표준 라이브러리만 쓴다(훅과 같은 규약, `.claude/tests/README.md`).

종료 코드: ``check`` 는 늘 0 이다(세션 시작을 막지 않는다). ``link`` 는 git 정보를 얻지
못하면 2, 그 밖에는 0 이다. 항목별 링크 실패는 종료 코드가 아니라 결과 줄로 알린다.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

MCP_JSON = ".mcp.json"
SETTINGS_LOCAL = ".claude/settings.local.json"
NERV_DIR = ".nerv"
# main checkout 에만 있고 git 이 옮겨 주지 않는 자리. 순서는 출력 순서다.
LOCAL_CONFIG_PATHS = (MCP_JSON, SETTINGS_LOCAL, NERV_DIR)

# 이름에 이 조각이 들어간 헤더 · env 키는 자격 증명으로 본다(대소문자 무시). `auth` 는
# Authorization · Proxy-Authorization · X-Auth-* 를, `key` 는 X-Api-Key · *_API_KEY 를,
# `passw` · `pwd` 는 *_PASSWORD · *_PASSWD · *_PWD 를 잡는다.
# 잘못 잡으면 `.mcp.json` 을 링크하지 않고 이유를 말한다 — 새는 쪽이 아니라 막는 쪽으로 틀린다.
_SECRET_HINTS = ("auth", "token", "secret", "passw", "pwd", "key", "jwt", "cookie", "credential")

# Claude Code 가 `.mcp.json` 에서 펴는 참조: `${VAR}` 와 `${VAR:-기본값}`. 기본값은 원문이다.
_ENV_REF = re.compile(r"\$\{[A-Za-z_][A-Za-z0-9_]*(?::-([^}]*))?\}")
# 참조 앞에 붙는 인증 방식 이름. 값이 아니다.
_AUTH_SCHEME = re.compile(r"\b(?:bearer|basic|token)\b", re.IGNORECASE)

# 원문 자격 증명을 발견했을 때의 조치. `link` · `check` 가 같은 문장을 쓴다.
_REMEDIATION = (
    "헤더 대신 `headersHelper` 로 `.claude/settings.local.json` 의 `env.NERV_TOKEN` 을 읽어 "
    "헤더를 내게 한다(`${NERV_TOKEN}` 참조형은 붙지 않는다 — 모듈 docstring). "
    "gitignore 대상 로컬 설정이라 사람이 승인하고 바꾼다"
)


def _looks_secret(name: str) -> bool:
    lowered = name.lower()
    return any(hint in lowered for hint in _SECRET_HINTS)


def _literal_remainder(value: str) -> str:
    """참조와 인증 방식 이름을 걷어 내고 남은 원문. 비어 있으면 원문 자격 증명이 없다.

    예: ``"Bearer ${NERV_TOKEN}"`` → ``""`` · ``"Bearer abc"`` → ``"abc"`` ·
    ``"${NERV_TOKEN:-abc}"`` → ``"abc"``(기본값은 원문이다).
    """
    defaults: list[str] = []

    def _drop(match: re.Match[str]) -> str:
        if match.group(1):
            defaults.append(match.group(1))
        return " "

    rest = _ENV_REF.sub(_drop, value)
    rest = " ".join([*defaults, rest])
    return _AUTH_SCHEME.sub(" ", rest).strip()


def literal_credentials(mcp_path: Path) -> list[str] | None:
    """`.mcp.json` 에 원문으로 박힌 자격 증명의 **위치** 목록. 읽지 못하면 None.

    None 과 빈 목록은 다르다. 읽지 못한 파일을 "원문 없음" 으로 세면 확인하지 않은 파일을
    링크하게 된다.
    """
    try:
        doc = json.loads(Path(mcp_path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    servers = doc.get("mcpServers") if isinstance(doc, dict) else None
    if not isinstance(servers, dict):
        return []
    found: list[str] = []
    for name, server in servers.items():
        if not isinstance(server, dict):
            continue
        for field in ("headers", "env"):
            block = server.get(field)
            if not isinstance(block, dict):
                continue
            for key, value in block.items():
                if not isinstance(value, str) or not _looks_secret(str(key)):
                    continue
                if _literal_remainder(value):
                    found.append(f"mcpServers.{name}.{field}.{key}")
    return found


def _present(path: Path) -> bool:
    # 끊긴 심볼릭 링크도 "있다" 로 센다 — 그 자리를 덮어쓰지 않기 위해서다.
    return path.exists() or path.is_symlink()


def _is_broken_symlink(path: Path) -> bool:
    return path.is_symlink() and not path.exists()


def _link_blocker(rel: str, src: Path) -> str | None:
    """``src`` 를 링크하면 안 되는 이유. 링크해도 되면 None."""
    if rel != MCP_JSON:
        return None
    creds = literal_credentials(src)
    if creds is None:
        return "JSON 으로 읽지 못해 원문 토큰이 없는지 확인할 수 없다"
    if creds:
        return f"원문 자격 증명이 있다({', '.join(creds)})"
    return None


def link(dest_root: Path, main_root: Path) -> list[str]:
    """``dest_root`` 에 main checkout 의 로컬 설정을 링크하고 한 줄씩 결과를 돌려준다."""
    dest_root = Path(dest_root)
    main_root = Path(main_root)
    if os.path.realpath(dest_root) == os.path.realpath(main_root):
        return []
    lines: list[str] = []
    for rel in LOCAL_CONFIG_PATHS:
        src = main_root / rel
        dst = dest_root / rel
        if not _present(src):
            continue
        if _present(dst):
            lines.append(f"그대로  {rel} — 이미 있다")
            continue
        blocker = _link_blocker(rel, src)
        if blocker:
            lines.append(f"건너뜀  {rel} — {blocker}. {_REMEDIATION}")
            continue
        # 확인과 생성 사이에 다른 세션이 같은 자리를 만들 수 있다. 한 항목의 실패가
        # 나머지 항목과 이미 모은 결과 줄을 없애지 않도록 항목마다 잡는다.
        try:
            dst.parent.mkdir(parents=True, exist_ok=True)
            os.symlink(src, dst)
        except OSError as exc:
            lines.append(f"실패    {rel} — {exc.strerror or exc.__class__.__name__}")
            continue
        lines.append(f"링크    {rel} -> {src}")
    return lines


def _credential_warnings(session_root: Path, main_root: Path) -> list[str]:
    warnings: list[str] = []
    main_mcp = main_root / MCP_JSON
    if main_mcp.is_file():
        blocker = _link_blocker(MCP_JSON, main_mcp)
        if blocker:
            warnings.append(
                f"{main_mcp}: {blocker}. {_REMEDIATION}. 그전까지 새 워크트리에는 이 파일을 "
                "링크하지 않는다."
            )
    # 워크트리가 링크가 아닌 자기 사본을 갖고 있으면 그 파일도 본다.
    own_mcp = session_root / MCP_JSON
    if own_mcp.is_file() and not own_mcp.is_symlink():
        creds = literal_credentials(own_mcp)
        if creds:
            warnings.append(f"{own_mcp}: 원문 자격 증명이 있다({', '.join(creds)}). {_REMEDIATION}.")
    return warnings


def _link_warnings(session_root: Path, main_root: Path) -> list[str]:
    warnings: list[str] = []
    missing = [
        rel for rel in LOCAL_CONFIG_PATHS
        if _present(main_root / rel) and not _present(session_root / rel)
    ]
    # 링크할 수 없는 자리에 "링크하라" 고 안내하지 않는다. 그 이유는 원문 경고가 이미 말한다.
    linkable = [rel for rel in missing if _link_blocker(rel, main_root / rel) is None]
    blocked = [rel for rel in missing if rel not in linkable]
    if linkable:
        warnings.append(
            "이 워크트리에 main checkout 의 로컬 설정이 없다: " + ", ".join(linkable)
            + ". 이 세션에는 NERV MCP 나 NERV_* env 가 없을 수 있다. 워크트리 안에서 "
            "`python3 .claude/tools/local_config.py link` 로 링크를 걸고 Claude Code 를 "
            "다시 띄운다."
        )
    if blocked:
        warnings.append(
            "이 워크트리에 " + ", ".join(blocked) + " 도 없다. 위 원문 자격 증명 경고를 "
            "해결하면 `local_config.py link` 로 링크된다."
        )
    broken = [rel for rel in LOCAL_CONFIG_PATHS if _is_broken_symlink(session_root / rel)]
    if broken:
        warnings.append(
            "이 워크트리의 로컬 설정 링크가 끊겼다: " + ", ".join(broken)
            + ". main checkout 에서 원본이 사라졌다."
        )
    return warnings


def check(session_root: Path, main_root: Path) -> list[str]:
    """세션 루트에 빠진 설정과 원문 토큰을 경고 줄로 돌려준다. 문제가 없으면 빈 목록."""
    session_root = Path(session_root)
    main_root = Path(main_root)
    warnings = _credential_warnings(session_root, main_root)
    # main checkout 세션은 링크 대상이 아니다. main 의 자리가 비었거나 끊긴 것은
    # 플러그인의 `nerv-init --check` 가 말한다.
    if os.path.realpath(session_root) != os.path.realpath(main_root):
        warnings.extend(_link_warnings(session_root, main_root))
    return warnings


def _git(cwd: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(cwd), *args], check=True, capture_output=True, text=True
    ).stdout.strip()


def _main_root(cwd: Path) -> Path:
    common = _git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir")
    return Path(common).parent


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("link", "check"):
        cmd = sub.add_parser(name)
        cmd.add_argument("--root", type=Path, default=None,
                         help="대상 워크트리(기본: 현재 디렉터리의 git 최상위)")
        cmd.add_argument("--main", type=Path, default=None,
                         help="main checkout(기본: git common dir 의 부모)")
    args = parser.parse_args(argv)

    cwd = Path.cwd()
    try:
        root = args.root or Path(_git(cwd, "rev-parse", "--show-toplevel"))
        main_root = args.main or _main_root(root)
    except (OSError, subprocess.CalledProcessError):
        # 저장소 밖이거나 `--path-format` 을 모르는 옛 git(2.31 미만)이다.
        print("local_config: git 정보를 얻지 못했다 — 건너뛴다", file=sys.stderr)
        # check 는 세션 시작을 막지 않는다. link 는 호출자가 실패를 알 수 있게 2 로 끝낸다.
        return 0 if args.command == "check" else 2

    lines = link(root, main_root) if args.command == "link" else check(root, main_root)
    for line in lines:
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
