#!/usr/bin/env python3
"""`nerv-recorder` 가 NERV 에 남긴 기록을 다시 읽어 입력 문서와 대조한다. 읽기 전용이다.

기록 서브에이전트 `nerv-recorder` 는 main 이 도구로 만든 문서를 MCP 로 NERV 에 옮긴다. 첫 실사용에서 반환의
건수와 실제 기록이 어긋났다(NERV Task `CLE-T-CD9131`). 제출 9묶음을 내고 `DONE=8/8` 로 보고했고, 처분 16건을
모두 기록하고 `DONE=15/15` 로 보고했다. 4.5KB 한국어 본문을 옮겨 적다 "뮤턴트" 를 "뷰턴트" 로 바꿔 보내기도 했다.
그래서 main 은 반환의 수를 믿지 않고 이 도구로 NERV 의 기록과 문서를 대조한다.

    python3 .claude/tools/nerv_record_verify.py submit  <nerv_review_payload.py --out 문서>
    python3 .claude/tools/nerv_record_verify.py resolve <nerv_review_handoff.py pending --out 문서>

입력 문서 형식의 정본은 두 도구의 docstring 이다. 이 도구는 그중 다음 값만 쓴다.
  - submit: `version` · `ok` · `submit{kind, branch, head_sha}` · `submissions[{reviewer{role}, findings[{severity,
    title, body, suggestion, file, line, category}]}]`
  - resolve: `version` · `ok` · `branch` · `dispositions[{finding_id, resolution, rationale, commit_sha}]`

`submit` 이 보는 것:
  - 역할. N1(`GET /api/v1/projects/<p>/gates/reviews/check?branch=&kind=&head_sha=`)에 문서의 branch · kind ·
    head 를 물어 그 head 의 라운드를 받는다. 문서의 역할이 모두 그 항목의 `roles.reported` 에 있어야 한다.
    `head_sha` 를 넘기므로 같은 브랜치에 그 뒤 라운드가 생겼어도 문서의 head 라운드를 본다. 응답에 그 kind 의
    항목이나 `roles.reported` 가 없으면 역할 대조는 `unverified` 로 두고 막지 않는다.
  - 발견. 브랜치의 발견을 상태 네 가지(open · fixed · dismissed · wont_fix)로 따로 읽는다(`GET /api/v1/projects/
    <p>/findings?branch=&status=`, 커서를 따라간다). 이 REST 는 `status` 를 하나만 받는다. `all` 은 400 이었고
    `status` 를 빼면 처분된 발견이 나오지 않았다(2026-10-09). 문서의 발견마다 같은 `title` 의 기록을 찾는다.
    여럿이면 `head_sha` 가 문서의 head 와 같은 것, 그다음 모든 필드가 같은 것, 그다음 `category` 가 같은 것을
    고른다. 찾으면 severity · body(기록의 `detail_md`) · suggestion(`suggestion_md`) · file(`file_path`) ·
    line(`line_start`) · category 를 비교한다. 제목으로 찾지 못하면 `missing` 이다.
`resolve` 가 보는 것: 같은 발견 목록에서 처분의 `finding_id` 기록을 찾아 resolution(기록의 `resolution_kind`) ·
rationale(`resolution_rationale`) · commit_sha(`resolution_commit`)를 비교한다. 기록이 없거나 처분이 붙지 않았으면
(`resolution_kind` 가 비었으면) `missing` 이다.

값은 양끝 공백만 무시하고 비교한다(빈 값과 null 은 같다). 그 밖의 정규화(줄바꿈 형식 등)는 하지 않는다.
응답의 기록에 비교할 필드의 키가 아예 없으면 그 필드는 비교하지 않고 `unverified` 에 남긴다.

출력은 stdout 에 JSON 한 줄이다.

    {"ok": bool, "mode": "submit|resolve", "checked": n, "missing": [...], "altered": [...],
     "unverified": [...], "errors": [...]}

  - `checked` 는 submit 이면 역할 수와 발견 수의 합, resolve 면 처분 수다. 대조하지 못하면 0 이다.
  - 항목은 짧은 문자열이다. 본문 전문은 싣지 않는다(main 컨텍스트를 아끼려는 도구다).
      missing     `role:<역할>` · `<역할> "<제목 앞 40자>"` · `<발견 ID 끝 8자>`
      altered     `<발견 ID 끝 8자> [<역할>] <필드> "<문서 발췌>" != "<기록 발췌>"`. 발췌는 처음 달라지는 위치 앞뒤
                  20자다. 발견 ID 는 끝 8자를 쓴다(앞 8자는 UUIDv7 이라 같은 분의 발견끼리 겹친다).
      unverified  `roles: <사유>` · `<필드>: 응답에 <키> 가 없다`
  - `ok` 는 missing · altered · errors 가 모두 비었을 때만 true 다. unverified 는 `ok` 를 바꾸지 않는다.

종료 코드: 0 모두 일치(unverified 만 있어도 0), 1 불일치(missing 또는 altered), 2 인자 오류(모드 · 없는 파일),
3 대조하지 못함(NERV 설정 누락 · 읽기 실패 · 문서가 JSON 이 아니거나 `version` 이 1 이 아니거나 `ok` 가 true 가
아니거나 필수 값이 없음). 3 이면 `errors` 에 사유가 있다. 오류 문장에 토큰을 싣지 않는다.

한계(실제 동작 그대로):
  - 발견은 제목으로 짝을 찾는다. 제목이 바뀌어 기록되면 altered 가 아니라 missing 으로 나온다.
  - 같은 브랜치의 앞 라운드에 같은 제목의 기록이 있으면 이번 제출이 빠져도 그 기록과 짝이 지어진다. head 가 같은
    기록이 없으면 앞 라운드 기록과 비교하므로 missing 이 아니라 altered 가 되거나, 내용까지 같으면 일치로 나온다.
  - NERV 가 같은 지문으로 이미 있던 발견에 합친 제출은 그 기록이 옛 본문 · 옛 head 일 수 있다. 그러면 기록 서브에이전트가
    옮겨 적은 값이 맞아도 altered 로 나온다. 합쳐진 기록이 이 브랜치의 목록에 없으면 missing 으로 나온다.
  - 역할 대조는 N1 이 그 head 의 라운드로 돌려주는 `roles.reported` 다. N1 은 같은 head 의 라운드들에서 낸 역할을 합쳐
    센다. 그래서 같은 head 에 앞서 낸 제출이 있으면 이번에 빠진 역할이 가려진다.
  - 역할 요약(`summary`) · 위험도 · 태그와 처분의 `escalate_reason` 은 비교하지 않는다. 앞의 둘과 `escalate_reason` 은
    발견 목록 응답에 없다.
  - 사람이 NERV 에서 처분을 바꿨으면 resolve 대조에서 altered 로 나온다. 이 도구는 누가 바꿨는지 가리지 않는다.

NERV 는 읽기만 한다(`_shared/nerv_read.py`. `NERV_SERVER` · `NERV_TOKEN`, 선택 `NERV_PROJECT`). 발견 목록의 경로와
필드 이름은 `nerv_review_handoff.py` 의 `open_findings` · `_normalize` 와, N1 경로는 `hooks/_lib/review_guard.py`
의 `N1_PATH` 와 같다.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse

_CLAUDE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _CLAUDE_DIR not in sys.path:
    sys.path.insert(0, _CLAUDE_DIR)
from _shared import nerv_read, out_doc  # noqa: E402

FINDINGS_PATH = "/api/v1/projects/{project}/findings"
N1_PATH = "/api/v1/projects/{project}/gates/reviews/check"
# REST `status` 가 받는 값 전부(2026-10-09 400 응답의 `allowed`). escalated 처분은 open 에 남는다.
STATUSES = ("open", "fixed", "dismissed", "wont_fix")
PAGE_LIMIT = 100
MAX_PAGES = 50  # 상태 하나에 5,000건. 커서가 돌면 여기서 끊는다
CONTEXT = 20  # 발췌의 앞뒤 글자 수
TITLE_SHOWN = 40

# (문서 필드, 기록 필드). 출력의 필드 이름은 문서 쪽이다.
SUBMIT_FIELDS = (
    ("severity", "severity"),
    ("body", "detail_md"),
    ("suggestion", "suggestion_md"),
    ("file", "file_path"),
    ("line", "line_start"),
    ("category", "category"),
)
RESOLVE_FIELDS = (
    ("resolution", "resolution_kind"),
    ("rationale", "resolution_rationale"),
    ("commit_sha", "resolution_commit"),
)

EXIT_OK, EXIT_MISMATCH, EXIT_UNVERIFIABLE = 0, 1, 3


class VerifyError(Exception):
    """대조하지 못했다(exit 3)."""


class Report:
    def __init__(self, mode: str):
        self.mode = mode
        self.checked = 0
        self.missing: list[str] = []
        self.altered: list[str] = []
        self.unverified: list[str] = []
        self.errors: list[str] = []

    def unverify(self, note: str) -> None:
        if note not in self.unverified:
            self.unverified.append(note)

    def as_dict(self) -> dict:
        ok = not (self.missing or self.altered or self.errors)
        return {"ok": ok, "mode": self.mode, "checked": self.checked, "missing": self.missing,
                "altered": self.altered, "unverified": self.unverified, "errors": self.errors}

    def exit_code(self) -> int:
        if self.errors:
            return EXIT_UNVERIFIABLE
        return EXIT_MISMATCH if self.missing or self.altered else EXIT_OK


# -- 값 비교 ---------------------------------------------------------------------------

def _text(value) -> str:
    """비교용 문자열. null 은 빈 값이고 양끝 공백은 무시한다. 숫자(line)는 문자열로 본다."""
    return "" if value is None else str(value).strip()


def _quote(text: str) -> str:
    return json.dumps(text, ensure_ascii=False)


def excerpt(a: str, b: str) -> tuple[str, str]:
    """두 값이 처음 달라지는 위치 앞뒤 `CONTEXT` 자씩. 잘린 쪽에는 `...` 을 붙인다."""
    i, n = 0, min(len(a), len(b))
    while i < n and a[i] == b[i]:
        i += 1
    lo = max(0, i - CONTEXT)

    def cut(s: str) -> str:
        hi = min(len(s), i + CONTEXT)
        return ("..." if lo > 0 else "") + s[lo:hi] + ("..." if hi < len(s) else "")

    return cut(a), cut(b)


def _short_id(fid) -> str:
    return str(fid or "?")[-8:]


def diff_fields(doc: dict, record: dict, fields, report: Report | None = None) -> list[tuple[str, str, str]]:
    """다른 필드의 `(필드, 문서 값, 기록 값)`. 기록에 키가 아예 없는 필드는 비교하지 않고 `report` 에 남긴다."""
    out = []
    for doc_key, rec_key in fields:
        if rec_key not in record:
            if report is not None:
                report.unverify(f"{doc_key}: 응답에 {rec_key} 가 없다")
            continue
        a, b = _text(doc.get(doc_key)), _text(record.get(rec_key))
        if a != b:
            out.append((doc_key, a, b))
    return out


def _altered_line(fid, role: str | None, field: str, a: str, b: str) -> str:
    ea, eb = excerpt(a, b)
    who = f"{_short_id(fid)} {role} " if role else f"{_short_id(fid)} "
    return f"{who}{field} {_quote(ea)} != {_quote(eb)}"


# -- NERV 읽기 --------------------------------------------------------------------------

def _get_json(client, path: str, what: str):
    try:
        status, body = client.get(path)
    except Exception as exc:  # noqa: BLE001 — 전송 실패(curl 없음 · 시간 초과 등)
        raise VerifyError(f"NERV {what}을 읽지 못했다 — {type(exc).__name__}: {exc}") from exc
    if status != 200:
        raise VerifyError(f"NERV {what} 응답 {status}")
    try:
        return json.loads(body)
    except ValueError as exc:
        raise VerifyError(f"NERV {what} 응답이 JSON 이 아니다") from exc


def branch_findings(client, branch: str) -> list[dict]:
    """이 브랜치의 발견 전부(상태 네 가지, 커서를 따라간다)."""
    items: list[dict] = []
    for status in STATUSES:
        cursor = None
        for _ in range(MAX_PAGES):
            query = {"branch": branch, "status": status, "limit": str(PAGE_LIMIT)}
            if cursor:
                query["cursor"] = cursor
            path = FINDINGS_PATH.format(project=client.project) + "?" + urllib.parse.urlencode(query)
            doc = _get_json(client, path, "발견 목록")
            page = doc.get("items") if isinstance(doc, dict) else None
            if not isinstance(page, list):
                raise VerifyError("NERV 발견 목록 응답에 items 가 없다")
            items.extend(x for x in page if isinstance(x, dict))
            cursor = doc.get("next_cursor")
            if not cursor:
                break
        else:
            raise VerifyError(f"NERV 발견 목록({status})이 {MAX_PAGES} 쪽을 넘는다 — 끊는다")
    return items


def round_roles(client, branch: str, kind: str, head: str):
    """N1 이 이 head 의 라운드로 돌려주는 `roles.reported`. 알 수 없으면 `(None, 사유)`."""
    query = urllib.parse.urlencode({"branch": branch, "kind": kind, "head_sha": head})
    doc = _get_json(client, N1_PATH.format(project=client.project) + "?" + query, "리뷰 판정")
    items = doc.get("items") if isinstance(doc, dict) else None
    matching = [i for i in items if isinstance(i, dict) and i.get("kind") == kind] if isinstance(items, list) else []
    item = matching[0] if matching else None
    if item is None:
        return None, f"N1 응답에 kind={kind} 항목이 없다"
    roles = item.get("roles")
    reported = roles.get("reported") if isinstance(roles, dict) else None
    if not isinstance(reported, list):
        return None, f"N1 응답에 roles.reported 가 없다(state={item.get('state')})"
    return {str(r) for r in reported}, None


# -- 문서 -------------------------------------------------------------------------------

def load_document(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
    except OSError as exc:
        raise VerifyError(f"문서를 읽지 못했다 — {exc.strerror}") from exc
    except ValueError as exc:
        raise VerifyError("문서가 JSON 이 아니다") from exc
    if not isinstance(doc, dict) or doc.get("version") != out_doc.VERSION:
        raise VerifyError(f"문서의 version 이 {out_doc.VERSION} 이 아니다")
    if doc.get("ok") is not True:
        raise VerifyError("문서의 ok 가 true 가 아니다 — 기록할 것이 없는 문서다")
    return doc


def _need_text(value, where: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise VerifyError(f"문서 형식 — {where} 가 없다")
    return value


def _need_list(value, where: str) -> list:
    if not isinstance(value, list):
        raise VerifyError(f"문서 형식 — {where} 가 목록이 아니다")
    return value


def _submit_bundles(doc: dict) -> tuple[dict, list[tuple[str, list[dict]]]]:
    submit = doc.get("submit")
    if not isinstance(submit, dict):
        raise VerifyError("문서 형식 — submit 이 없다")
    for key in ("kind", "branch", "head_sha"):
        _need_text(submit.get(key), f"submit.{key}")
    bundles = []
    for n, s in enumerate(_need_list(doc.get("submissions"), "submissions")):
        reviewer = s.get("reviewer") if isinstance(s, dict) else None
        role = _need_text(reviewer.get("role") if isinstance(reviewer, dict) else None,
                          f"submissions[{n}].reviewer.role")
        findings = _need_list(s.get("findings", []), f"submissions[{n}].findings")
        for m, f in enumerate(findings):
            _need_text(f.get("title") if isinstance(f, dict) else None, f"submissions[{n}].findings[{m}].title")
        bundles.append((role, findings))
    return submit, bundles


def _dispositions(doc: dict) -> tuple[str, list[dict]]:
    branch = _need_text(doc.get("branch"), "branch")
    rows = _need_list(doc.get("dispositions"), "dispositions")
    for n, d in enumerate(rows):
        _need_text(d.get("finding_id") if isinstance(d, dict) else None, f"dispositions[{n}].finding_id")
    return branch, rows


# -- 대조 -------------------------------------------------------------------------------

def _pick(candidates: list[dict], finding: dict, head: str) -> dict:
    """같은 제목의 기록 중 하나. head 가 같은 것 → 모든 필드가 같은 것 → category 가 같은 것 순. 같으면 앞의 것."""
    def rank(r: dict):
        return (_text(r.get("head_sha")) == head,
                not diff_fields(finding, r, SUBMIT_FIELDS),
                _text(r.get("category")) == _text(finding.get("category")))
    return max(candidates, key=rank)


def verify_submit(doc: dict, client) -> Report:
    report = Report("submit")
    submit, bundles = _submit_bundles(doc)
    branch, kind, head = submit["branch"], submit["kind"], _text(submit["head_sha"])

    reported, why = round_roles(client, branch, kind, head)
    if reported is None:
        report.unverify(f"roles: {why}")
    by_title: dict[str, list[dict]] = {}
    for r in branch_findings(client, branch):
        by_title.setdefault(_text(r.get("title")), []).append(r)

    for role, findings in bundles:
        report.checked += 1
        if reported is not None and role not in reported:
            report.missing.append(f"role:{role}")
        for f in findings:
            report.checked += 1
            title = _text(f.get("title"))
            candidates = by_title.get(title)
            if not candidates:
                shown = title if len(title) <= TITLE_SHOWN else title[:TITLE_SHOWN] + "..."
                report.missing.append(f"{role} {_quote(shown)}")
                continue
            record = _pick(candidates, f, head)
            for field, a, b in diff_fields(f, record, SUBMIT_FIELDS, report):
                report.altered.append(_altered_line(record.get("id"), role, field, a, b))
    return report


def verify_resolve(doc: dict, client) -> Report:
    report = Report("resolve")
    branch, rows = _dispositions(doc)
    by_id = {_text(r.get("id")).lower(): r for r in branch_findings(client, branch)}
    for d in rows:
        report.checked += 1
        fid = _text(d.get("finding_id")).lower()
        record = by_id.get(fid)
        if record is None or not _text(record.get("resolution_kind")):
            report.missing.append(_short_id(fid))
            continue
        for field, a, b in diff_fields(d, record, RESOLVE_FIELDS, report):
            report.altered.append(_altered_line(fid, None, field, a, b))
    return report


MODES = {"submit": (_submit_bundles, verify_submit), "resolve": (_dispositions, verify_resolve)}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0], allow_abbrev=False)
    ap.add_argument("mode", choices=tuple(MODES))
    ap.add_argument("doc", help="nerv_review_payload.py --out 문서(submit) 또는 nerv_review_handoff.py pending --out 문서(resolve)")
    args = ap.parse_args(argv)
    if not os.path.isfile(args.doc):
        ap.error(f"문서가 없다 — {args.doc}")
    parse, verify = MODES[args.mode]
    try:
        doc = load_document(args.doc)
        parse(doc)  # 문서 형식 문제를 NERV 설정 문제보다 먼저 알린다
        report = verify(doc, nerv_read.client_from_env())
    except (VerifyError, nerv_read.NervReadError) as exc:
        report = Report(args.mode)
        report.errors.append(str(exc))
    json.dump(report.as_dict(), sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return report.exit_code()


if __name__ == "__main__":
    sys.exit(main())
