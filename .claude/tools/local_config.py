#!/usr/bin/env python3
"""main checkout 의 로컬 설정을 워크트리에 링크하고, 빠진 것을 세션 시작 때 알린다.

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

**원문 자격 증명이 든 `.mcp.json` 은 링크하지 않는다.** 토큰 원문을 워크트리로 퍼뜨리면
노출면이 넓어진다(NERV 정본 전환안 §12). `${NERV_TOKEN}` 참조로 바꾼 뒤에야 링크한다. 이
판정은 값이 아니라 **위치**만 돌려준다 — 이 스크립트는 어떤 경로로도 자격 증명 값을 출력하지
않는다.

판정 범위(좁히지도 넓히지도 않은 경계를 적어 둔다): `mcpServers.<이름>.headers` 와
`mcpServers.<이름>.env` 에서 이름이 자격 증명처럼 보이는 키(``_SECRET_HINTS``)의 값만 본다.
`url` 쿼리나 `args` 에 박힌 토큰은 보지 않는다 — 이 저장소의 `.mcp.json` 에는 그런 자리가 없다.

표준 라이브러리만 쓴다(훅과 같은 규약, `.claude/tests/README.md`).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

# main checkout 에만 있고 git 이 옮겨 주지 않는 자리. 순서는 출력 순서다.
LOCAL_CONFIG_PATHS = (".mcp.json", ".claude/settings.local.json", ".nerv")
MCP_JSON = ".mcp.json"

# 이름에 이 조각이 들어간 헤더 · env 키는 자격 증명으로 본다(대소문자 무시). `auth` 는
# Authorization · Proxy-Authorization · X-Auth-* 를, `key` 는 X-Api-Key · *_API_KEY 를 잡는다.
# 잘못 잡으면 `.mcp.json` 을 링크하지 않고 이유를 말한다 — 새는 쪽이 아니라 막는 쪽으로 틀린다.
_SECRET_HINTS = ("auth", "token", "secret", "password", "key", "cookie", "credential")

# Claude Code 가 `.mcp.json` 에서 펴는 참조: `${VAR}` 와 `${VAR:-기본값}`. 기본값은 원문이다.
_ENV_REF = re.compile(r"\$\{[A-Za-z_][A-Za-z0-9_]*(?::-([^}]*))?\}")
# 참조 앞에 붙는 인증 방식 이름. 값이 아니다.
_AUTH_SCHEME = re.compile(r"\b(?:bearer|basic|token)\b", re.IGNORECASE)


def _looks_secret(name: str) -> bool:
    lowered = name.lower()
    return any(hint in lowered for hint in _SECRET_HINTS)


def _literal_part(value: str) -> str:
    """참조를 걷어 내고 남은 원문. 비어 있으면 원문 자격 증명이 없다."""
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
                if _literal_part(value):
                    found.append(f"mcpServers.{name}.{field}.{key}")
    return found


def _present(path: Path) -> bool:
    # 끊긴 심볼릭 링크도 "있다" 로 센다 — 그 자리를 덮어쓰지 않기 위해서다.
    return path.exists() or path.is_symlink()


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
        if rel == MCP_JSON:
            creds = literal_credentials(src)
            if creds is None:
                lines.append(f"건너뜀  {rel} — JSON 으로 읽지 못해 원문 토큰이 없는지 확인할 수 없다")
                continue
            if creds:
                lines.append(
                    f"건너뜀  {rel} — 원문 자격 증명이 있다({', '.join(creds)}). "
                    "`${NERV_TOKEN}` 같은 참조로 바꾼 뒤 다시 링크한다"
                )
                continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        os.symlink(src, dst)
        lines.append(f"링크    {rel} -> {src}")
    return lines


def check(session_root: Path, main_root: Path) -> list[str]:
    """세션 루트에 빠진 설정과 원문 토큰을 경고 줄로 돌려준다. 문제가 없으면 빈 목록."""
    session_root = Path(session_root)
    main_root = Path(main_root)
    warnings: list[str] = []

    main_mcp = main_root / MCP_JSON
    if main_mcp.is_file():
        creds = literal_credentials(main_mcp)
        if creds is None:
            warnings.append(
                f"{main_mcp} 를 JSON 으로 읽지 못한다 — 새 워크트리에 링크하지 않는다."
            )
        elif creds:
            warnings.append(
                f"{main_mcp} 에 자격 증명 원문이 있다({', '.join(creds)}). "
                "`Bearer ${NERV_TOKEN}` 같은 참조로 바꾸고 값은 `.claude/settings.local.json` 의 "
                "`env` 에 둔다. gitignore 대상 로컬 설정이라 사람이 승인하고 바꾼다. "
                "그전까지 새 워크트리에는 이 파일을 링크하지 않는다."
            )

    if os.path.realpath(session_root) != os.path.realpath(main_root):
        missing = [
            rel for rel in LOCAL_CONFIG_PATHS
            if _present(main_root / rel) and not _present(session_root / rel)
        ]
        broken = [
            rel for rel in LOCAL_CONFIG_PATHS
            if (session_root / rel).is_symlink() and not (session_root / rel).exists()
        ]
        if missing:
            warnings.append(
                "이 워크트리에 main checkout 의 로컬 설정이 없다: " + ", ".join(missing)
                + ". 이 세션에는 NERV MCP 나 NERV_* env 가 없을 수 있다. 워크트리 안에서 "
                "`python3 .claude/tools/local_config.py link` 로 링크를 걸고 Claude Code 를 "
                "다시 띄운다."
            )
        if broken:
            warnings.append(
                "이 워크트리의 로컬 설정 링크가 끊겼다: " + ", ".join(broken)
                + ". main checkout 에서 원본이 사라졌다."
            )
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
        print("local_config: git 저장소가 아니다 — 건너뛴다", file=sys.stderr)
        return 0 if args.command == "check" else 2

    if args.command == "link":
        for line in link(root, main_root):
            print(line)
        return 0
    for line in check(root, main_root):
        print(f"bootstrap: {line}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
