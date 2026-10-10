"""리뷰 커버리지 게이트 — 브랜치의 `codebase/**` 변경을 NERV 코드 리뷰 라운드가 덮는지 판정한다.

NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`)부터 리뷰 결과의 정본은 NERV 리뷰 레코드다.
저장소 `review/**` 파일은 더 이상 판정 근거가 아니다. 이 모듈은 NERV 의 판정 API(N1,
`GET /api/v1/projects/<p>/gates/reviews/check`)를 읽기만 하고, 그 위에 git 으로만 볼 수 있는
두 가지(라운드 이후 커밋, 처분 커밋의 소속)를 더해 판정한다. 같은 응답의 kind=consistency 라운드는
라운드 이후 커밋을 설명하는 데만 쓴다(판정 상태는 보지 않는다. 그것은 NERV done 게이트의 몫이다).

소비자:
  - `.claude/hooks/guard_review_before_push.py` (PreToolUse(Bash): `git push` 를 막는다)
  - `scripts/check-review-gate.py` (CI 백스톱, `review-gate.yml`)

범위 — **`codebase/**` 만 리뷰 대상이다.** spec · plan · docs · `.claude` 변경은 이 게이트에 걸리지
않는다. 하네스만 바꾼 PR 은 `python3 -m pytest .claude/tests` 로 검증한다(`CLAUDE.md`).

판정(`evaluate_review`) — 브랜치가 merge-base 이후 커밋한 `codebase/**` 변경이 있을 때:
  1. N1 의 kind=code 최신 라운드가 `passed` 여야 한다. 역할 누락(정책 `review_roles`) ·
     열린 critical · warning 은 서버가 `pending` 으로 판정한다.
  2. 라운드 `head_sha` 가 이 체크아웃에 있고 HEAD 의 조상이어야 한다. rebase · amend 로 라운드
     head 가 사라졌으면 새 HEAD 로 리뷰를 다시 제출해야 한다.
  2b. 라운드가 본 파일이 `router_safety` 규칙으로 강제하는 리뷰어 중 NERV 필수 6역할 밖의 것
     (documentation · dependency · database · api_contract)이 라운드의 역할 리포트(N1
     `roles.reported`)에 있어야 한다. NERV 정책 `review_roles.code` 는 변경 종류에 따라 붙는 역할을
     표현하지 못해 6역할만 센다(전환 단계 2). 옛 게이트는 디스크의 리포트로 강제 목록 전체를 봤다.
     전환 4e 에서 그 축소를 이 검사로 닫았다. 라운드가 본 파일은 브랜치 diff 로 다시 계산한다(라운드
     head 와 base 의 merge-base..라운드 head). NERV 는 라운드의 changeset 을 돌려주지 않는다. 리뷰 뒤
     base 를 merge 해도 base 쪽 파일은 세지 않는다. `.claude.project.json` 에서 끈 리뷰어는 요구하지
     않는다. 그 파일과 규칙 모듈은 판정하는 체크아웃의 것을 읽는다(CI 에서는 PR head 의 트리다).
     세션 환경 변수 `REVIEW_AGENTS` 는 보지 않는다. 응답에 `roles.reported` 가 없으면 막지 않고
     참고로 알린다.
  3. code 라운드에서 `fixed` 로 처분된 발견의 `commit_sha` 는 HEAD 에서 닿는 커밋이어야 한다. NERV 는
     발견을 프로젝트 전체에서 지문으로 합친다. 그래서 다른 브랜치에서 고친 같은 지적도 이 라운드에
     `fixed` 로 보인다. 그 수정이 이 브랜치에 없으면 막는다. consistency 라운드의 그런 처분은 막지 않고
     설명에도 쓰지 않는다(push 판정이 consistency 상태에 기대지 않기 때문이다). 4 가 처분 커밋을
     설명의 근거로 쓰므로 이 검사가 먼저다.
  4. 라운드 head 이후 `codebase/**` 를 바꾼 커밋은 모두 설명돼야 한다. 기준 브랜치에서 들어온
     커밋은 뺀다. merge 커밋은 combined diff(`git diff-tree --cc -U0`)에 `codebase/**` hunk 가 남을
     때만 센다(충돌을 풀며 쓴 코드 · evil merge). 양쪽이 같은 파일의 다른 줄을 고쳐 git 이 합친 merge 는
     대체로 세지 않는다. 깨끗이 합쳐졌는데도 세는 모양이 셋 남는다(`_commits_after` docstring 의 "알려진
     과다 계수"). 설명된 커밋은 둘 중 하나다.
       - code · consistency 라운드에서 `fixed` 로 처분된 발견의 `commit_sha` 다.
       - 커밋 메시지가 그런 발견을 `finding <발견 전체 ID>` 로 인용한다(e2e 실패 뒤 후속 수정처럼
         처분 하나에 커밋이 여럿인 경우).
     리뷰 뒤 fix 커밋만 있으면 새 라운드 없이 통과한다. **fix 커밋은 다시 리뷰되지 않는다.** `fixed`
     처분과 인용은 main 세션의 자기 신고이고, 이 게이트는 커밋이 처분에 묶였는지만 본다. 리뷰 뒤
     변경이 크면 새 라운드를 제출한다(`code-review-agents` SKILL §4). 이 게이트가 막는 것은 누락이지
     의도적 우회가 아니다.
  변경이 없으면 통과한다. 커밋하지 않은 변경은 push 되지 않으므로 보지 않는다.

판정하지 못하면(`GateUnavailable`) 호출자가 fail-open 하고 그 사실을 센다(push 훅의 배너와
연속 횟수, CI 의 경고). 그중 설정 문제(`GateMisconfigured` — 토큰 · 서버 주소 없음, 401 · 403 ·
404, 강제 리뷰어 규칙 `router_safety.py` 를 불러오거나 쓰지 못함)는 일시 장애와 구분한다. CI 는 설정 문제를 `--enforce` 에서 실패로 본다. 비밀이 빠진 백스톱은
초록인 채로 영원히 꺼져 있기 때문이다.

NERV 쓰기는 이 모듈이 하지 않는다. 리뷰 제출과 처분은 MCP 호출로만 한다. 기록 서브에이전트 `nerv-recorder` 가
하고, 그것을 쓸 수 없는 세션은 main 이 한다(`CLAUDE.md`).
읽기는 `.claude/_shared/nerv_read.py` 가 만든 `pull.py` 의 `Nerv` 클라이언트를 쓴다(curl, `-K -` 로
토큰 전달).
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections.abc import Iterable
from dataclasses import dataclass

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_CLAUDE_DIR = os.path.dirname(os.path.dirname(THIS_DIR))  # …/.claude

# git 헬퍼는 형제 가드와 공유한다(`.claude/_shared/git_probe.py`). 복사본을 두면 갈린다 — 이 저장소가
# `_run_git` 의 `.strip()` 으로 두 번 겪었다.
if _CLAUDE_DIR not in sys.path:
    sys.path.insert(0, _CLAUDE_DIR)
from _shared import git_probe as _git_probe  # noqa: E402
from _shared import nerv_read as _nerv_read  # noqa: E402

_run_git = _git_probe._run_git
_repo_root = _git_probe._repo_root
_default_branch = _git_probe._default_branch
_current_branch = _git_probe._current_branch

CODE_PREFIX = "codebase/"
# N1 경로와 kind 의 정의는 `_shared/nerv_read.py` 하나다(`nerv_record_verify.py` 도 같은 값을 쓴다).
# code 는 판정, consistency 는 라운드 이후 커밋의 설명에만 쓴다.
N1_PATH = _nerv_read.N1_PATH
N1_KINDS = _nerv_read.N1_KINDS
# 강제 리뷰어 규칙의 정본(판정 2b). 표준 라이브러리만 쓰는 모듈이라 경로로 불러온다(`_lib` 이름이 훅
# 패키지와 겹치므로 `sys.path` 로 들이지 않는다).
_ROUTER_SAFETY = os.path.join(_CLAUDE_DIR, "skills", "code-review-agents", "lib", "router_safety.py")
_PROJECT_CONFIG = ".claude.project.json"
# 커밋 메시지의 발견 인용. `finding` 뒤 같은 문단에 나오는 전체 ID 를 모두 센다(`finding <ID> · <ID>`
# 처럼 나열해도 된다). NERV 발견 ID 는 UUIDv7 이라 앞 8자는 같은 분 안에서 겹친다(실측 2026-10-01: 한
# 제출의 발견 13건이 모두 `01a0f648-`). 그래서 전체 ID 만 인용으로 본다.
_FINDING_WORD = re.compile(r"\bfindings?\b", re.IGNORECASE)
_FULL_ID = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.IGNORECASE)


def _cited_ids(message: str) -> set[str]:
    """메시지가 `finding` 으로 인용한 발견 전체 ID(소문자). 인용은 `finding` 이 있는 문단 안에서만 센다."""
    ids: set[str] = set()
    for m in _FINDING_WORD.finditer(message):
        paragraph = re.split(r"\n\s*\n", message[m.end():], maxsplit=1)[0]
        ids.update(x.lower() for x in _FULL_ID.findall(paragraph))
    return ids
# 훅은 모든 push 앞에서 동기로 돈다. 서버가 멈추면 이 시간 뒤 fail-open 한다.
N1_MAX_TIME = "15"
# 메시지에 나열할 커밋 · 발견 수 상한.
_LIST_LIMIT = 5

# N1 `reasons` 값 → 사람이 읽을 문장. 모르는 값은 그대로 보여 준다.
_REASON_TEXT = {
    "open_critical": "열린 critical 발견이 있다",
    "open_warning": "열린 warning 발견이 있다",
    "missing_roles": "필수 역할 리포트가 빠졌다",
}


class GateUnavailable(Exception):
    """판정하지 못했다(서버 불통 · 응답 형식 · git 실패). 호출자는 fail-open 하고 센다."""


class GateMisconfigured(GateUnavailable):
    """설정 문제라 고칠 때까지 계속 판정하지 못한다(토큰 · 서버 주소 없음, 401 · 403 · 404, 강제 리뷰어 규칙)."""


@dataclass(frozen=True)
class ReviewDecision:
    blocked: bool
    reason: str  # 사람이 읽는 이유. stderr · CI 로그에 그대로 나간다.
    # 판정을 바꾸지 않는 참고. 필드로 두는 이유: push 훅은 차단(exit 2)이면 stderr 로, 통과(exit 0)면
    # PreToolUse JSON envelope(`_lib/hook_output.py`)로 모델에 보여 준다. 출력 채널은 호출자가 고른다.
    notes: tuple[str, ...] = ()

    @property
    def push_blocks(self) -> bool:
        """push 훅이 게이트 결정에서 읽는 차단 여부."""
        return self.blocked


# -- NERV 읽기 ----------------------------------------------------------------------

def _client_from_env():
    """환경의 `NERV_SERVER` · `NERV_TOKEN` · `NERV_PROJECT` 로 읽기 클라이언트를 만든다(짧은 훅 시간 제한)."""
    try:
        return _nerv_read.client_from_env(max_time=N1_MAX_TIME)
    except _nerv_read.NervConfigError as exc:
        raise GateMisconfigured(str(exc)) from exc
    except _nerv_read.NervReadError as exc:
        # pull.py 를 불러오지 못하면 고칠 때까지 계속 실패한다. 일시 장애가 아니라 설정 문제로 둔다
        # (CI 가 --enforce 에서 실패로 본다).
        raise GateMisconfigured(str(exc)) from exc


def fetch_rounds(client, branch: str) -> dict[str, dict]:
    """N1 에서 이 브랜치의 kind=code · consistency 최신 라운드를 읽는다. `{kind: 항목}`.

    kind=code 항목이 없으면 판정 불가다. consistency 항목은 없어도 된다. `head_sha` 인자는 넘기지
    않는다. 넘기면 서버가 그 커밋의 라운드만 찾는다(실측 2026-10-01: 라운드 head 의 자손 커밋을
    넘기면 `uncovered`). 조상 · 이후 커밋 판정은 이 모듈이 git 으로 한다."""
    import urllib.parse  # noqa: PLC0415 — 이 함수만 쓴다

    query = urllib.parse.urlencode({"branch": branch, "kind": ",".join(N1_KINDS)})
    path = N1_PATH.format(project=client.project) + "?" + query
    try:
        status, body = client.get(path)
    except Exception as exc:  # noqa: BLE001 — 전송 실패(curl 없음 · 시간 초과 등)
        raise GateUnavailable(f"NERV 판정을 읽지 못했다 — {type(exc).__name__}: {exc}") from exc
    if status in (401, 403, 404):
        raise GateMisconfigured(f"NERV 판정 응답 {status} — 토큰 권한이나 프로젝트를 확인한다")
    if status != 200:
        raise GateUnavailable(f"NERV 판정 응답 {status}")
    try:
        doc = json.loads(body)
    except ValueError as exc:
        raise GateUnavailable("NERV 판정 응답이 JSON 이 아니다") from exc
    items = doc.get("items") if isinstance(doc, dict) else None
    if not isinstance(items, list):
        raise GateUnavailable("NERV 판정 응답에 items 가 없다")
    rounds: dict[str, dict] = {}
    for item in items:
        if isinstance(item, dict) and item.get("kind") in N1_KINDS:
            rounds.setdefault(str(item["kind"]), item)
    if "code" not in rounds:
        raise GateUnavailable("NERV 판정 응답에 kind=code 항목이 없다")
    return rounds


# -- git ------------------------------------------------------------------------------

def _git_ok(args: list[str], cwd: str) -> bool:
    rc, _, _ = _run_git(args, cwd)
    return rc == 0


def _git_text(args: list[str], cwd: str) -> str:
    rc, out, err = _run_git(args, cwd)
    if rc != 0:
        raise GateUnavailable(f"git {args[0]} 실패 — {err or f'rc={rc}'}")
    return out


def _git_lines(args: list[str], cwd: str) -> list[str]:
    return [ln for ln in _git_text(args, cwd).splitlines() if ln.strip()]


def _commit_of(ref: str, cwd: str) -> str | None:
    """`ref` 가 가리키는 커밋의 전체 해시. 없으면 None.

    `^{commit}` 을 붙여 넘기므로 옵션 모양 값(`--all`)은 옵션이 아니라 풀리지 않는 리비전이 된다
    (실측 2026-10-01: `--all^{commit}` · `--show-toplevel^{commit}` 모두 rc=1). 브랜치 이름은 `-` 로
    시작할 수 없으니, 여기서 풀린 ref 는 뒤의 git 인자로 넘겨도 옵션으로 읽히지 않는다."""
    if not ref:
        return None
    rc, out, _ = _run_git(["rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}"], cwd)
    return out.strip() if rc == 0 and out.strip() else None


def _resolve_commit(sha: str, cwd: str) -> str | None:
    """NERV 가 준 `sha`(축약 가능)를 전체 해시로. 16진수가 아니거나 이 체크아웃에 없으면 None.

    서버 응답은 그대로 git 인자가 되므로 모양부터 거른다(브랜치 이름 · 옵션이 섞이지 않게)."""
    if not sha or not all(c in "0123456789abcdefABCDEF" for c in sha):
        return None
    return _commit_of(sha, cwd)


def _base_ref(cwd: str, given: str | None) -> str:
    """기준 브랜치 ref. 주면 그것만, 아니면 origin/<기본 브랜치> → <기본 브랜치> 순서로 고른다."""
    if given:
        candidates = [given]
    else:
        default = _default_branch(cwd)
        candidates = [f"origin/{default}", default] if default else []
    for ref in candidates:
        if _commit_of(ref, cwd):
            return ref
    raise GateUnavailable("기준 브랜치를 찾지 못했다 — 이 브랜치의 변경 범위를 정할 수 없다")


@dataclass(frozen=True)
class _Fix:
    finding_id: str  # 소문자. 비어 있을 수 있다
    sha: str  # 처분의 commit_sha 소문자(축약 가능)
    title: str


def _fixed_findings(item: dict | None) -> list[_Fix]:
    """라운드 발견 중 `fixed` 처분이고 `commit_sha` 가 있는 것."""
    out: list[_Fix] = []
    for f in (item or {}).get("findings") or []:
        if not isinstance(f, dict) or f.get("status") != "fixed":
            continue
        res = f.get("resolution") if isinstance(f.get("resolution"), dict) else {}
        sha = str(res.get("commit_sha") or "").strip().lower()
        if sha:
            fid = str(f.get("id") or "").strip().lower()
            out.append(_Fix(fid, sha, str(f.get("title") or fid)))
    return out


def _settle(fixes: list[_Fix], head_sha: str, cwd: str) -> tuple[dict[str, str], list[str]]:
    """처분 커밋을 이 브랜치에서 푼다. (`{처분 sha: 전체 해시}` — HEAD 에서 닿는 것만, 닿지 않는 sha).

    같은 커밋을 여러 발견이 가리키므로 한 번씩만 본다. 축약 해시는 git 이 푼다(모호하거나 없으면
    None → 이 브랜치의 커밋이 아니다)."""
    reachable: dict[str, str] = {}
    foreign: list[str] = []
    for sha in sorted({f.sha for f in fixes}):
        full = _resolve_commit(sha, cwd)
        if full is not None and _git_ok(["merge-base", "--is-ancestor", full, head_sha], cwd):
            reachable[sha] = full
        else:
            foreign.append(sha)
    return reachable, foreign


def _commits_after(round_head: str, head_sha: str, base: str, cwd: str) -> list[str]:
    """라운드 head 이후 이 브랜치가 `codebase/**` 를 바꾼 커밋. 기준 브랜치에서 온 커밋은 뺀다.

    merge 커밋은 combined diff(`--cc`)에 `codebase/**` hunk 가 남을 때만 센다. git 은 어느 한 부모와 같은
    hunk 를 거르고 파일의 hunk 가 모두 걸러지면 그 파일의 머리 줄(`diff --cc <경로>`)을 내지 않는다. 그래서
    양쪽이 같은 파일의 다른 줄을 고쳐 git 이 합친 merge 와 충돌 hunk 를 한쪽 그대로 두고 푼 merge 는 세지
    않는다. 충돌을 풀며 쓴 줄 · 양쪽 줄을 이어 붙인 해소 · merge 에 끼우거나 바꾸거나 지운 줄 · 새 파일 ·
    파일 삭제 · 모드 변경은 센다.

    context 는 0 이다. 기본 3줄이면 몇 줄 떨어진 양쪽 변경이 한 hunk 로 묶여 깨끗한 merge 도 머리 줄이
    나온다. `--name-only` 는 hunk 를 거르지 않고 모든 부모와 다른 파일을 내서 깨끗한 merge 도 셌다(NERV Task
    `CLE-T-QT69YT`).

    알려진 과다 계수 — 깨끗이 합쳐졌는데도 머리 줄이 나와 세는 모양이 셋 남는다. 막는 방향의 오탐이라 게이트가
    열리지는 않는다. 셋 모두 `test_review_guard.py` 가 고정하고, 판정을 정교화하면 그 테스트를 뒤집는다.
      - 한쪽이 줄을 지우고 상대가 두 줄 안쪽을 고쳤다. git 이 삭제된 줄을 다음 결과 줄에 붙여 두 변경이 한
        hunk 로 묶인다. 방향에 따라 갈린다(삭제 10 · 수정 12 는 세고 수정 10 · 삭제 12 는 세지 않는다).
      - 한쪽은 모드만, 다른 쪽은 내용만 바꾼 파일.
      - 한쪽이 파일을 옮기고 다른 쪽이 옛 경로를 고쳐 git 이 새 경로에 합친 파일.
    정교화하려면 `git merge-tree --write-tree <부모1> <부모2>` 가 충돌 없이 끝나고 그 tree 의 `codebase/` 가 merge 의
    tree 와 같으면 세지 않는 방법이 있다. 이 명령은 git 2.38 이상이 필요하고 2026-10-10 에 CI 는 2.55, 로컬은 2.54
    였다. 지금 넣지 않은 이유는 둘이다. 그 명령을 쓰면 읽기만 하던 게이트가 저장소에 객체를 쓴다. 세 모양은 막는 쪽
    오탐이고 로컬 저장소의 merge 커밋 227개 가운데 해당하는 것이 없었다(2026-10-10). 이 모양으로 PR 이 막힌 사례가
    나오면 다시 본다."""
    rng = [f"{round_head}..{head_sha}", "--not", base]
    after = _git_lines(["rev-list", "--no-merges", *rng, "--", CODE_PREFIX], cwd)
    for merge in _git_lines(["rev-list", "--merges", *rng], cwd):
        patch = _git_text(["diff-tree", "--cc", "-U0", "--no-commit-id", "-r", merge, "--", CODE_PREFIX], cwd)
        if any(ln.startswith("diff --cc ") for ln in patch.splitlines()):
            after.append(merge)
    return after


def _citations(commits: list[str], cwd: str) -> dict[str, set[str]]:
    """커밋마다 메시지가 인용한 발견 ID(소문자). `_cited_ids` 규칙을 따른다."""
    if not commits:
        return {}
    out: dict[str, set[str]] = {}
    text = _git_text(["show", "-s", "--format=%H%x1f%B%x1e", *commits], cwd)
    # `str.strip()` 은 \x1e · \x1f 도 공백으로 본다. 레코드 앞의 줄바꿈만 걷는다.
    for record in text.split("\x1e"):
        sha, sep, body = record.lstrip("\n").partition("\x1f")
        if sep:
            out[sha] = _cited_ids(body)
    return out


def _short(sha: str) -> str:
    return sha[:12]


# -- 강제 리뷰어 ----------------------------------------------------------------------

def _load_router_safety():
    """`router_safety.py` 를 경로로 불러온다. 못 불러오면 고칠 때까지 계속 실패하므로 설정 문제다."""
    import importlib.util  # noqa: PLC0415 — 이 함수만 쓴다

    try:
        spec = importlib.util.spec_from_file_location("_review_guard_router_safety", _ROUTER_SAFETY)
        if spec is None or spec.loader is None:
            raise ImportError("spec 을 만들지 못했다")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    except Exception as exc:  # noqa: BLE001 — 문법 오류 · 파일 없음 모두 같은 처리
        raise GateMisconfigured(f"강제 리뷰어 규칙(router_safety)을 불러오지 못했다 — {type(exc).__name__}: {exc}") from exc
    return module


def _enabled_reviewers(repo_root: str, names: Iterable[str]) -> list[str]:
    """`names` 중 `.claude.project.json` 의 `agents.reviewers.<이름>: false` 로 끄지 않은 리뷰어.

    판정 규칙은 `skills/_lib/project_config.is_agent_enabled` 와 같다(명시적 `false` 만 끈다). 그 모듈은
    `_lib` 이름이 훅 패키지와 겹쳐 들일 수 없어 같은 규칙을 여기 둔다. 두 판정이 같은지는
    `test_review_guard.py` 의 `test_the_toggle_rule_matches_project_config` 가 고정한다. 파일이 없거나
    깨졌으면 모두 켠다. 세션 환경 변수 `REVIEW_AGENTS` 는 보지 않는다. 그 값으로 리뷰어를 좁힌
    라운드는 이 검사에 막힌다."""
    try:
        with open(os.path.join(repo_root, _PROJECT_CONFIG), encoding="utf-8") as f:
            cfg = json.load(f)
    except (OSError, ValueError):
        cfg = {}
    agents = cfg.get("agents") if isinstance(cfg, dict) else None
    reviewers = agents.get("reviewers") if isinstance(agents, dict) else None
    if not isinstance(reviewers, dict):
        reviewers = {}
    return [n for n in names if reviewers.get(n, True) is not False]


def _missing_forced_roles(item: dict, base: str, round_head: str, repo_root: str, cwd: str) -> list[str] | None:
    """라운드가 본 파일이 강제하는데 라운드에 리포트가 없는 리뷰어(6역할 밖).

    돌려주는 값은 셋이다. `None` 은 응답에 역할 정보가 없어 판정하지 못했다는 뜻이고, 빈 목록은 빠진
    리뷰어가 없다는 뜻이고, 나머지는 빠진 리뷰어 이름이다.

    라운드가 본 파일은 라운드 head 와 `base` 의 merge-base 에서 라운드 head 까지다. HEAD 기준
    merge-base 를 쓰면 리뷰 뒤 base 를 merge 했을 때 그 merge-base 가 base 의 새 커밋으로 올라가고,
    두 점 diff 가 base 에서 들어온 파일까지 라운드 파일로 센다(merge 최신화가 막힌다)."""
    roles = item.get("roles")
    reported = roles.get("reported") if isinstance(roles, dict) else None
    if not isinstance(reported, list):
        return None
    round_fork = _git_lines(["merge-base", round_head, base], cwd)
    if not round_fork:
        raise GateUnavailable(f"라운드 head 와 `{base}` 의 merge-base 가 없다")
    files = _git_lines(["diff", "--name-only", f"{round_fork[0]}..{round_head}"], cwd)
    rs = _load_router_safety()
    try:
        forced = list(rs.conditional_forced_agents(files, _enabled_reviewers(repo_root, rs.RULE_REVIEWERS)))
    except Exception as exc:  # noqa: BLE001 — 이름이 없거나 호출이 실패해도 설정 문제로 올린다
        # 다른 예외로 새면 CI 가 일시 장애로 보고 통과시키고, (3) · (4) 검사까지 건너뛴다.
        raise GateMisconfigured(f"강제 리뷰어 규칙(router_safety)을 쓰지 못했다 — {type(exc).__name__}: {exc}") from exc
    have = {str(r) for r in reported}
    return [r for r in forced if r not in have]


def _one_line(text: str, limit: int = 60) -> str:
    """서버가 준 문자열을 메시지에 넣기 전에 줄바꿈 · 제어 문자를 접고 자른다."""
    return " ".join(str(text).split())[:limit]


def _shown(labels: list[str], unit: str) -> str:
    """메시지용 목록. `_LIST_LIMIT` 개까지 보이고 나머지는 수로만 적는다."""
    text = ", ".join(labels[:_LIST_LIMIT])
    if len(labels) > _LIST_LIMIT:
        text += f" 외 {len(labels) - _LIST_LIMIT}{unit}"
    return text


def _not_passed_reason(item: dict, branch: str) -> str:
    state = item.get("state")
    if state == "uncovered":
        return (f"브랜치 `{branch}` 에 kind=code 리뷰 라운드가 없다. `/ai-review` 뒤 역할마다 "
                "`nerv_review_submit`(kind=code, branch, head_sha=HEAD, task_id)으로 제출한다.")
    reasons = [_REASON_TEXT.get(r, _one_line(r)) for r in item.get("reasons") or []]
    opened = item.get("open") if isinstance(item.get("open"), dict) else {}
    counts = " · ".join(f"{k} {v}" for k, v in opened.items() if v)
    roles = item.get("roles") if isinstance(item.get("roles"), dict) else {}
    missing = roles.get("missing") or []
    detail = "; ".join(reasons) or "판정이 passed 가 아니다"
    if counts:
        detail += f" (열린 발견 {counts})"
    if missing:
        detail += f" (빠진 역할 {', '.join(_one_line(m, 40) for m in missing)})"
    return (f"kind=code 라운드 {item.get('round_no')} 가 `{state}` 다 — {detail}. "
            "발견을 `nerv_finding_resolve` 로 처분하거나 빠진 역할을 제출한다.")


# -- 판정 ------------------------------------------------------------------------------

def evaluate_review(
    cwd: str | None = None,
    *,
    branch: str | None = None,
    head: str | None = None,
    base_ref: str | None = None,
    client=None,
) -> ReviewDecision:
    """이 체크아웃(`cwd`)의 브랜치를 판정한다.

    `branch` · `head` · `base_ref` 는 CI 가 넘긴다(PR 의 head 브랜치 · head 커밋 · `origin/<base>`).
    로컬 push 훅은 넘기지 않고 체크아웃에서 읽는다. `client` 는 테스트 대역 자리다(`project` 와
    `get(path) -> (status, body)` 만 있으면 된다).

    판정하지 못하면 `GateUnavailable` 을 던진다. 통과로 돌려주지 않는다 — 호출자가 그것을 세야
    fail-open 이 조용히 지나가지 않는다."""
    cwd = cwd or os.getcwd()
    repo_root = _repo_root(cwd)
    if repo_root is None:
        return ReviewDecision(False, "git 저장소가 아니다 — 통과")

    head_sha = _commit_of(head or "HEAD", cwd)
    if not head_sha:
        raise GateUnavailable(f"판정할 커밋을 찾지 못했다 — {head or 'HEAD'}")

    base = _base_ref(cwd, base_ref)
    fork = _git_lines(["merge-base", head_sha, base], cwd)
    if not fork:
        raise GateUnavailable(f"`{base}` 와의 merge-base 가 없다")
    changed = _git_lines(["diff", "--name-only", f"{fork[0]}..{head_sha}", "--", CODE_PREFIX], cwd)
    if not changed:
        return ReviewDecision(False, "이 브랜치에 codebase/ 변경이 없다 — 통과")

    branch = branch or _current_branch(cwd)
    if not branch:
        raise GateUnavailable("브랜치 이름이 없다(detached HEAD) — NERV 라운드를 찾을 수 없다")

    rounds = fetch_rounds(client if client is not None else _client_from_env(), branch)
    item = rounds["code"]
    if item.get("state") != "passed":
        return ReviewDecision(True, f"codebase/ 파일 {len(changed)}개를 바꿨다. " + _not_passed_reason(item, branch))

    round_no = item.get("round_no")
    round_head = _resolve_commit(str(item.get("head_sha") or ""), cwd)
    if round_head is None or not _git_ok(["merge-base", "--is-ancestor", round_head, head_sha], cwd):
        return ReviewDecision(
            True,
            f"kind=code 라운드 {round_no} 의 head `{_short(str(item.get('head_sha') or '?'))}` 가 이 "
            "브랜치의 조상이 아니다(rebase · amend · 다른 브랜치의 라운드). 지금 HEAD 로 리뷰를 다시 "
            "제출한다.",
        )

    # N1 이 발견 목록을 잘라 보냈으면 (3) · (4) 는 받은 목록만 본다. 어느 판정에든 알린다.
    total = item.get("findings_total")
    got = len(item.get("findings") or [])
    notes: tuple[str, ...] = ()
    if isinstance(total, int) and total > got:
        notes = (f"참고: N1 응답이 발견 {total}건 중 {got}건만 담았다. 빠진 발견의 처분 커밋은 보지 못했다.",)

    # (2b) 라운드가 본 파일이 강제하는 리뷰어(6역할 밖)의 리포트가 라운드에 있는가.
    missing_roles = _missing_forced_roles(item, base, round_head, repo_root, cwd)
    if missing_roles is None:
        notes += ("참고: N1 응답에 roles.reported 가 없어 강제 리뷰어(6역할 밖)를 보지 못했다.",)
    elif missing_roles:
        return ReviewDecision(
            True,
            f"kind=code 라운드 {round_no} 에 강제 리뷰어 리포트가 없다: {', '.join(missing_roles)}. 라운드가 본 "
            "파일이 router_safety 규칙으로 이 리뷰어를 강제한다(문서 · 패키지 매니페스트 · 마이그레이션 · OpenAPI 등). "
            "그 리뷰어를 돌려 같은 head 로 `nerv_review_submit`(reviewer.role) 한다.",
            notes,
        )

    # (3) code 라운드의 처분 커밋이 이 브랜치에 있는가.
    code_fixes = _fixed_findings(item)
    code_reach, code_foreign = _settle(code_fixes, head_sha, cwd)
    if code_foreign:
        labels = []
        for sha in code_foreign:
            titles = [f.title for f in code_fixes if f.sha == sha]
            labels.append(f"`{_short(sha)}` ({_one_line(titles[0])}{' 외' if len(titles) > 1 else ''})")
        return ReviewDecision(
            True,
            f"kind=code 라운드 {round_no} 의 fixed 처분 커밋이 이 브랜치에 없다: {_shown(labels, '건')}. 다른 "
            "브랜치에서 고친 같은 지적일 수 있다. 이 브랜치에서 고치고 그 커밋으로 처분하거나 리뷰를 다시 제출한다.",
            notes,
        )

    # (4) 라운드 이후 codebase/ 커밋은 모두 설명돼야 한다. consistency 라운드의 처분은 이 브랜치에서
    # 닿는 것만 쓴다(닿지 않는 것은 막지도 설명하지도 않는다).
    cons_fixes = _fixed_findings(rounds.get("consistency"))
    cons_reach, _ = _settle(cons_fixes, head_sha, cwd)
    reach = {**code_reach, **cons_reach}
    fixed_full = set(reach.values())
    fixed_ids = {f.finding_id for f in code_fixes + cons_fixes if f.finding_id and f.sha in reach}

    after = _commits_after(round_head, head_sha, base, cwd)
    by_sha = [c for c in after if c not in fixed_full]
    cited = _citations(by_sha, cwd)
    unexplained = [c for c in by_sha if not (cited.get(c, set()) & fixed_ids)]
    if unexplained:
        shown = _shown([f"`{_short(c)}`" for c in unexplained], "개")
        return ReviewDecision(
            True,
            f"kind=code 라운드 {round_no} 이후 codebase/ 를 바꾼 커밋 {len(unexplained)}개가 fixed 처분 "
            f"커밋도 아니고 fixed 발견을 인용하지도 않는다: {shown}. 발견을 그 커밋으로 처분"
            "(`nerv_finding_resolve` resolution=fixed, commit_sha)하거나, 같은 발견의 후속 수정이면 커밋 "
            "메시지에 `finding <발견 전체 ID>` 를 적거나, 지금 HEAD 로 리뷰를 다시 제출한다.",
            notes,
        )

    tail = ""
    if after:
        tail = f", 이후 codebase/ 커밋 {len(after)}개는 모두 처분 커밋"
        if by_sha:
            tail += f"(그중 {len(by_sha)}개는 메시지 인용)"
    return ReviewDecision(
        False,
        f"codebase/ 파일 {len(changed)}개를 kind=code 라운드 {round_no}(head `{_short(round_head)}`, passed)가 "
        f"덮는다{tail} — 통과",
        notes,
    )
