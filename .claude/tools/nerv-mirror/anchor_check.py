#!/usr/bin/env python3
"""스펙 미러 문서 사이 `#앵커` 링크 래칫 검사(NERV Task `CLE-T-9X3K5D`).

스펙 제목은 링크 앵커가 된다. 제목 문구를 바꾸면 그 앵커로 들어오던 다른 문서의 링크가 끊긴다
(규약 CLE-ENG-SPECHEADING 규칙 3). `pull.py --check` 는 문서 이동만 보고 프런트 docs 가드
(`spec-link-integrity`)는 코드 · 가이드에서 스펙으로 가는 링크만 본다. 이 도구는 `spec/` 미러의
본문 링크 가운데 `#앵커` 가 붙은 것을 모두 모아 대상 문서 제목의 slug 와 맞는지 본다. 네트워크와 토큰
없이 돌고 표준 라이브러리만 쓴다.

검사하는 링크:
- 다른 미러 문서로 가는 링크 `](../CLE-X/CLE-KEY.md#앵커)` 와 같은 문서 안 링크 `](#앵커)`.
- `pull.py` 가 미러 경로로 바꾸지 못한 키 링크 `](CLE-KEY#앵커)`. 대상이 미러에 없다는 뜻이라
  「대상 문서 없음」으로 센다. 미러에 넣지 않는 카탈로그 사본(`pull.is_excluded`)은 보지 않는다.
- 코드 블록(``` · ~~~ 울타리)과 인라인 코드 안의 링크 꼴은 링크가 아니라서 보지 않는다.

slug 규칙: 프런트 docs 가드(`codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의
`headingSlugs`)와 같은 github-slugger 2.0.0 규칙이다. 제목 문구를 마크다운 텍스트로 풀고(인라인 코드는
내용, 링크는 글자, `_강조_` · `**강조**` 표시는 지운다) 소문자로 바꾼 뒤 github-slugger 가 지우는 글자
(`slug_ranges.py`, 문장 부호 · 기호 · 제어 문자 등)를 지우고 공백을 `-` 로 바꾼다. 한글 · `_` · `-` 는
남는다. 같은 slug 가 다시 나오면 문서 순서대로 `-1` · `-2` 를 붙인다. 제목은 ATX(`#` 줄)만 센다(스펙 문서는 ATX 제목만 쓴다. `_lib/spec_heading.py`).
앵커의 `%XX` 는 풀어서 비교한다.

판정(링크 단위 래칫):
- 끊긴 링크를 (링크가 있는 문서, `대상키#앵커`) 쌍으로 세어 기준선(`anchor_baseline.json`)과 비교한다.
  기준선보다 많은 쌍은 실패다(새로 끊긴 링크). 줄 번호는 기준선에 넣지 않는다. 본문을 고칠 때마다
  기준선이 흔들리지 않게 하려는 것이다.
- 기준선에 있지만 이제 이어진 링크는 알리기만 한다. `--update-baseline` 이 그 항목을 지운다(늘리지는
  않는다). 기준선은 줄어들기만 한다.

기준선은 2026-11-28 도입 시점의 main(`ab1328eea`)에서 끊겨 있던 링크다. 24차 3 · 9~12번 묶음의 미러
PR 이 고친 만큼 `--update-baseline` 으로 낮춘다.

usage: anchor_check.py [--root ROOT] [--update-baseline] [--report]
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from collections import Counter
from collections.abc import Iterator
from pathlib import Path
from typing import NamedTuple
from urllib.parse import unquote

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import pull  # noqa: E402  (같은 폴더의 미러 도구)
from slug_ranges import removed  # noqa: E402  (github-slugger 가 지우는 글자 표)

BASELINE = HERE / "anchor_baseline.json"

# 문서 키 → (`대상키#앵커` → 끊긴 링크 개수). 기준선 파일과 같은 꼴이다.
Baseline = dict[str, dict[str, int]]


class Broken(NamedTuple):
    """끊긴 링크 한 건."""
    src: str  # 링크가 있는 문서 키
    line: int  # 미러 파일 줄 번호
    ref: str  # `대상키#앵커`
    why: str

_HEADING = re.compile(r"^ {0,3}#{1,6}(?:[ \t]+(?P<text>.*?))?(?:[ \t]+#+)?[ \t]*$")
_FENCE = re.compile(r"^ {0,3}(?P<fence>`{3,}|~{3,})")
# 링크 대상: `](대상)` 의 대상. 공백 · 괄호 없는 꼴만 쓴다(`pull.LINK_RE` · `MIRROR_LINK_RE` 와 같다).
_LINK = re.compile(r"\]\((?P<target>[^()\s]*#[^()\s]*)\)")
_MIRROR_TARGET = re.compile(r"^(?:[^#]*/)?(?P<key>CLE-[A-Z0-9-]+)\.md$")
_KEY_TARGET = re.compile(r"^(?P<key>CLE-[A-Z0-9-]+)$")
_CODE_SPAN = re.compile(r"(?<!`)(?P<ticks>`+)(?!`)(?P<code>.+?)(?<!`)(?P=ticks)(?!`)")
_IMAGE = re.compile(r"!\[(?P<text>[^\]]*)\]\([^)]*\)")
_INLINE_LINK = re.compile(r"\[(?P<text>[^\]]*)\]\([^)]*\)")
_AUTOLINK = re.compile(r"<(?P<url>[A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\s]*)>")
_ESCAPE = re.compile(r"\\(?P<ch>[!-/:-@\[-`{-~])")
# `_강조_` · `__강조__`: 앞이 글자 · 숫자가 아니고 뒤가 글자 · 숫자가 아닌 밑줄 쌍만 강조다(CommonMark 의
# 밑줄 규칙을 좁혀 옮겼다). `render_*` 처럼 낱말 안의 밑줄은 글자로 남는다.
_UNDERSCORE_EMPH = re.compile(r"(?<![^\W_])(?P<d>__?)(?=[^\s_])(?P<text>.*?[^\s_])(?P=d)(?![^\W_])")
_STAR_EMPH = re.compile(r"(?P<d>\*\*?)(?=\S)(?P<text>.*?\S)(?P=d)")


def heading_text(raw: str) -> str:
    """제목 줄 문구(마크다운)를 렌더한 텍스트로 푼다. mdast `toString` 과 같은 결과를 노린다."""
    out: list[str] = []
    pos = 0
    for m in _CODE_SPAN.finditer(raw):
        out.append(_inline_text(raw[pos:m.start()]))
        code = m.group("code")
        # CommonMark: 앞뒤가 모두 공백이고 공백만은 아니면 한 칸씩 뗀다.
        if len(code) >= 2 and code[0] == " " and code[-1] == " " and code.strip():
            code = code[1:-1]
        out.append(code)
        pos = m.end()
    out.append(_inline_text(raw[pos:]))
    return "".join(out)


def _inline_text(s: str) -> str:
    s = _IMAGE.sub(lambda m: m.group("text"), s)
    s = _INLINE_LINK.sub(lambda m: m.group("text"), s)
    s = _AUTOLINK.sub(lambda m: m.group("url"), s)
    for pat in (_STAR_EMPH, _UNDERSCORE_EMPH):
        prev = None
        while prev != s:
            prev, s = s, pat.sub(lambda m: m.group("text"), s)
    s = _ESCAPE.sub(lambda m: m.group("ch"), s)
    return html.unescape(s)


def slug(text: str) -> str:
    """github-slugger 의 `slug()`(중복 번호 없이). 지우는 글자는 `slug_ranges` 표를 따른다."""
    return "".join(ch for ch in text.lower() if not removed(ch)).replace(" ", "-")


def _outside_code(body: str) -> Iterator[tuple[int, str]]:
    """(본문 줄 번호, 줄) — 코드 블록 울타리와 그 안의 줄은 뺀다.

    울타리 판정은 `_lib/spec_heading.py` 와 같다(CommonMark: 닫는 울타리는 같은 문자로 여는 것 이상 길이이고
    뒤에 공백만 온다. 백틱 울타리 뒤 info 문자열에 백틱이 있으면 울타리가 아니다). 닫히지 않은 울타리는
    CommonMark 대로 문서 끝까지 코드 블록이다. 렌더러가 그 뒤를 제목으로 만들지 않기 때문이다.
    """
    fence: str | None = None
    for no, line in enumerate(body.splitlines(), 1):
        m = _FENCE.match(line)
        if fence is not None:
            if m and m.group("fence")[0] == fence[0] and len(m.group("fence")) >= len(fence) \
                    and not line.strip()[len(m.group("fence")):].strip():
                fence = None
            continue
        if m and not (m.group("fence")[0] == "`" and "`" in line[m.end():]):
            fence = m.group("fence")
            continue
        yield no, line


def headings(body: str) -> list[str]:
    """본문의 ATX 제목 문구를 나온 순서대로. 코드 블록 안의 `#` 줄은 뺀다."""
    return [(h.group("text") or "") for _, line in _outside_code(body) if (h := _HEADING.match(line))]


def heading_slugs(body: str) -> set[str]:
    """본문 제목 slug 집합. 같은 slug 가 다시 나오면 `-1` · `-2` 를 붙인다(github-slugger 의 클래스)."""
    seen: dict[str, int] = {}
    out: set[str] = set()
    for raw in headings(body):
        base = slug(heading_text(raw))
        result = base
        while result in seen:
            seen[base] += 1
            result = f"{base}-{seen[base]}"
        seen[result] = 0
        if result:
            out.add(result)
    return out


def anchor_links(body: str) -> list[tuple[int, str]]:
    """(줄 번호, 링크 대상) — `#` 이 붙은 링크만. 코드 블록 · 인라인 코드 안은 뺀다."""
    found: list[tuple[int, str]] = []
    for no, line in _outside_code(body):
        plain = _CODE_SPAN.sub(lambda c: " " * len(c.group(0)), line)
        for lm in _LINK.finditer(plain):
            found.append((no, lm.group("target")))
    return found


def broken_links(spec_root: Path) -> list[Broken]:
    """(링크가 있는 문서 키, 미러 파일 줄 번호, `대상키#앵커`, 이유) — 끊긴 링크를 문서 · 줄 순서로."""
    bodies: dict[str, str] = {}
    offsets: dict[str, int] = {}  # 파일 줄 번호 = 본문 줄 번호 + frontmatter 줄 수
    for p in pull.mirror_files(spec_root):
        try:
            text = p.read_text(encoding="utf-8")
            body = pull.split_frontmatter(text)[1]
        except (OSError, ValueError):
            continue  # 읽지 못하는 미러 파일은 같은 잡의 `pull.py --check` 가 알린다.
        bodies[p.stem] = body
        offsets[p.stem] = text[:len(text) - len(body)].count("\n")
    slugs: dict[str, set[str]] = {}

    def slugs_of(key: str) -> set[str]:
        if key not in slugs:
            slugs[key] = heading_slugs(bodies[key])
        return slugs[key]

    out: list[Broken] = []
    for src in sorted(bodies):
        for body_no, target in anchor_links(bodies[src]):
            no = body_no + offsets[src]
            path, _, anchor = target.partition("#")
            if not path:
                key = src
            elif (m := _MIRROR_TARGET.match(path)) or (m := _KEY_TARGET.match(path)):
                key = m.group("key")
            else:
                continue  # 스펙 문서가 아닌 대상(코드 경로 · 외부 URL)은 이 도구가 보지 않는다.
            if pull.is_excluded(key, None):
                continue
            ref = f"{key}#{anchor}"
            if key not in bodies:
                out.append(Broken(src, no, ref, "대상 문서가 미러에 없다"))
            elif unquote(anchor) not in slugs_of(key):
                out.append(Broken(src, no, ref, "대상 문서에 그 제목이 없다"))
    return out


def count(broken: list[Broken]) -> Baseline:
    out: dict[str, Counter] = {}
    for src, _, ref, _ in broken:
        out.setdefault(src, Counter())[ref] += 1
    return {src: dict(c) for src, c in out.items()}


def load_baseline(path: Path = BASELINE) -> Baseline:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {src: {ref: int(n) for ref, n in refs.items()} for src, refs in data["links"].items()}


def judge(broken: list[Broken], baseline: Baseline
          ) -> tuple[list[str], list[str]]:
    """(실패 줄, 알림 줄)."""
    now = count(broken)
    fails, notes = [], []
    over: dict[tuple[str, str], int] = {}
    for src, refs in now.items():
        for ref, n in refs.items():
            extra = n - baseline.get(src, {}).get(ref, 0)
            if extra > 0:
                over[(src, ref)] = extra
    for src, no, ref, why in broken:
        if over.get((src, ref), 0) > 0:
            fails.append(f"{src}:{no}: `{ref}` — {why}")
    for src, refs in sorted(baseline.items()):
        for ref, base in sorted(refs.items()):
            n = now.get(src, {}).get(ref, 0)
            if n < base:
                notes.append(f"{src}: `{ref}` 가 기준선 {base}개에서 {n}개로 줄었다 — "
                             "기준선을 낮출 수 있다(--update-baseline)")
    return fails, notes


def updated(broken: list[Broken], baseline: Baseline
            ) -> Baseline:
    """줄어든 값만 반영한 기준선. 새 항목을 더하지 않고 값을 늘리지 않는다."""
    now = count(broken)
    out: Baseline = {}
    for src, refs in baseline.items():
        for ref, base in refs.items():
            n = min(base, now.get(src, {}).get(ref, 0))
            if n > 0:
                out.setdefault(src, {})[ref] = n
    return out


def write_baseline(links: Baseline, path: Path = BASELINE) -> None:
    data = {"links": {src: dict(sorted(refs.items())) for src, refs in sorted(links.items())}}
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None, baseline_path: Path | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--root", type=Path, default=HERE.parents[2], help="저장소 루트")
    ap.add_argument("--update-baseline", action="store_true", help="줄어든 항목만 기준선에 반영")
    ap.add_argument("--report", action="store_true", help="끊긴 링크를 모두 보인다(기준선에 있는 것 포함)")
    args = ap.parse_args(argv)
    broken = broken_links(args.root / "spec")
    path = baseline_path or BASELINE
    baseline = load_baseline(path)
    if args.report:
        for src, no, ref, why in broken:
            print(f"{src}:{no}: `{ref}` — {why}")
    if args.update_baseline:
        write_baseline(updated(broken, baseline), path)
        baseline = load_baseline(path)
    fails, notes = judge(broken, baseline)
    for line in notes:
        print(f"note: {line}")
    for line in fails:
        print(f"FAIL: {line}", file=sys.stderr)
    if fails:
        print("스펙 문서 사이 앵커 링크가 새로 끊겼다. 제목을 고친 쪽이 같은 변경에서 들어오는 링크를 "
              "고친다(CLE-ENG-SPECHEADING 규칙 3). 미러는 손으로 고치지 않는다 — NERV 초안으로 고친 뒤 "
              "pull 한다.", file=sys.stderr)
        return 1
    total = sum(sum(refs.values()) for refs in baseline.values())
    print(f"ok: 앵커 링크 검사 — 끊긴 링크 {len(broken)}개, 기준선 {total}개")
    return 0


if __name__ == "__main__":
    sys.exit(main())
