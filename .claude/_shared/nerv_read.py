"""NERV REST 읽기 클라이언트 — `pull.py` 의 `load_env` 를 불러 쓴다.

소비자:
  - `.claude/hooks/_lib/review_guard.py` (push 훅 · CI 게이트의 N1 판정 읽기. 경로 · kind 상수를 가져다 쓴다)
  - `.claude/tools/nerv_review_handoff.py` (열린 발견 목록 읽기)
  - `.claude/tools/nerv_record_verify.py` (기록 대조를 위한 발견 목록 · N1 라운드 읽기)

REST 경로 상수(`FINDINGS_PATH` · `N1_PATH` · `N1_KINDS`)와 목록을 끝까지 읽는 순회(`paged_items`)의 정의는 이 모듈
하나다. 소비자는 오류를 자기 계약에 맞게 옮긴다(인계 도구는 `HandoffError`, 훅은 `GateUnavailable`).

클라이언트는 `.claude/tools/nerv-mirror/pull.py` 의 `Nerv` 다(curl, `-K -` 로 토큰 전달, loopback
밖의 http 거부). 환경 값 해석도 `pull.load_env` 하나에 둔다(두 곳에 두면 빈 `NERV_PROJECT` 같은
값에 서로 다르게 반응한다). 이 모듈은 pull.py 를 불러와 오류를 나눠 주기만 한다. **읽기만 한다.** NERV 쓰기는
MCP 호출로만 한다(main 세션과 기록 서브에이전트 `nerv-recorder`, `CLAUDE.md`). 토큰 값은 오류 메시지에 싣지 않는다.
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import urllib.parse

_CLAUDE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PULL_PY = os.path.join(_CLAUDE_DIR, "tools", "nerv-mirror", "pull.py")

FINDINGS_PATH = "/api/v1/projects/{project}/findings"
N1_PATH = "/api/v1/projects/{project}/gates/reviews/check"
# N1 이 답하는 kind. 이 저장소에서 N1 을 부르는 곳은 이 둘만 묻는다(`merge` · `spec_coverage` 는 물은 적이 없다).
N1_KINDS = ("code", "consistency")
PAGE_LIMIT = 100
MAX_PAGES = 50  # 5,000건. 커서가 돌면 여기서 끊는다


class NervReadError(Exception):
    """클라이언트를 만들지 못했다(불러오기 실패)."""


class NervConfigError(NervReadError):
    """설정 문제다(`NERV_SERVER` · `NERV_TOKEN` 없음, 주소 형식). 고칠 때까지 계속 실패한다."""


class NervRequestError(NervReadError):
    """읽기 요청이 실패했다(전송 실패 · 200 이 아닌 상태 · JSON 이 아니거나 모양이 다른 응답). 메시지에 토큰을 싣지 않는다."""


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


def get_json(client, path: str, what: str):
    """`path` 를 GET 해 JSON 본문을 돌려준다. 200 이 아니거나 JSON 이 아니면 `NervRequestError`. `what` 은 오류 문장에 쓰는 이름이다."""
    try:
        status, body = client.get(path)
    except Exception as exc:  # noqa: BLE001 — 전송 실패(curl 없음 · 시간 초과 등)
        raise NervRequestError(f"NERV {what} 읽기 실패 — {type(exc).__name__}: {exc}") from exc
    if status != 200:
        raise NervRequestError(f"NERV {what} 응답 {status}")
    try:
        return json.loads(body)
    except ValueError as exc:
        raise NervRequestError(f"NERV {what} 응답이 JSON 이 아니다") from exc


def paged_items(client, path_template: str, query: dict, what: str) -> list[dict]:
    """`items` · `next_cursor` 모양의 목록 응답을 끝까지 읽는다(커서를 따라간다). 객체가 아닌 항목은 버린다.

    `path_template` 은 `{project}` 자리가 있는 경로이고 `query` 에는 `limit` 과 `cursor` 를 넣지 않는다. 응답에 `items`
    목록이 없거나 `MAX_PAGES` 쪽을 넘도록 커서가 끝나지 않으면 `NervRequestError` 다."""
    items: list[dict] = []
    cursor = None
    for _ in range(MAX_PAGES):
        page_query = {**query, "limit": str(PAGE_LIMIT)}
        if cursor:
            page_query["cursor"] = cursor
        path = path_template.format(project=client.project) + "?" + urllib.parse.urlencode(page_query)
        doc = get_json(client, path, what)
        page = doc.get("items") if isinstance(doc, dict) else None
        if not isinstance(page, list):
            raise NervRequestError(f"NERV {what} 응답에 items 가 없다")
        items.extend(x for x in page if isinstance(x, dict))
        cursor = doc.get("next_cursor")
        if not cursor:
            return items
    raise NervRequestError(f"NERV {what} 응답이 {MAX_PAGES} 쪽을 넘는다 — 끊는다")


def branch_findings(client, branch: str, status: str) -> list[dict]:
    """이 브랜치에서 `status`(REST 가 받는 값 하나)인 발견 전부."""
    return paged_items(client, FINDINGS_PATH, {"branch": branch, "status": status}, "발견 목록")
