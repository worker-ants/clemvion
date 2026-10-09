"""NERV REST 읽기 클라이언트 — `pull.py` 의 `load_env` 를 불러 쓴다.

소비자:
  - `.claude/hooks/_lib/review_guard.py` (push 훅 · CI 게이트의 N1 판정 읽기)
  - `.claude/tools/nerv_review_handoff.py` (리뷰 발견 목록 읽기)

클라이언트는 `.claude/tools/nerv-mirror/pull.py` 의 `Nerv` 다(curl, `-K -` 로 토큰 전달, loopback
밖의 http 거부). 환경 값 해석도 `pull.load_env` 하나에 둔다(두 곳에 두면 빈 `NERV_PROJECT` 같은
값에 서로 다르게 반응한다). 이 모듈은 pull.py 를 불러와 오류를 나눠 주기만 한다. **읽기만 한다.** NERV 쓰기는
MCP 호출로만 한다(main 세션과 기록 서브에이전트 `nerv-recorder`, `CLAUDE.md`). 토큰 값은 오류 메시지에 싣지 않는다.
"""

from __future__ import annotations

import importlib.util
import os
import sys

_CLAUDE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PULL_PY = os.path.join(_CLAUDE_DIR, "tools", "nerv-mirror", "pull.py")


class NervReadError(Exception):
    """클라이언트를 만들지 못했다(불러오기 실패)."""


class NervConfigError(NervReadError):
    """설정 문제다(`NERV_SERVER` · `NERV_TOKEN` 없음, 주소 형식). 고칠 때까지 계속 실패한다."""


def load_pull():
    """`pull.py` 를 모듈로 불러온다. 이름이 흔해서 `nerv_mirror_pull` 로 등록한다."""
    name = "nerv_mirror_pull"
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, PULL_PY)
    if spec is None or spec.loader is None:
        raise NervReadError(f"NERV 클라이언트를 찾지 못했다 — {PULL_PY}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    try:
        spec.loader.exec_module(module)
    except Exception as exc:  # noqa: BLE001 — 불러오기 실패는 읽기 불가다
        sys.modules.pop(name, None)
        raise NervReadError(f"NERV 클라이언트를 불러오지 못했다 — {type(exc).__name__}: {exc}") from exc
    return module


def client_from_env(*, max_time: str | None = None):
    """환경 값으로 읽기 클라이언트를 만든다(`pull.load_env`). 설정 문제는 `NervConfigError` 다.

    로컬은 `.claude/settings.local.json` 의 `env`, CI 는 워크플로 `env`(secret)가 채운다."""
    pull = load_pull()
    try:
        return pull.load_env(max_time=max_time) if max_time else pull.load_env()
    except pull.PullError as exc:
        raise NervConfigError(f"NERV 클라이언트 설정 문제 — {exc}") from exc
