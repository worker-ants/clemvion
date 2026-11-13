#!/usr/bin/env python3
"""스펙 미러 문서의 본문 글자수 한도(20,000자) 래칫 검사.

한도의 근거와 나누는 방법은 `project-planner` SKILL 「문서 크기 한도」가 정본이다. 이 도구는 저장소
`spec/` 미러를 읽어 문서마다 본문 글자수를 센다. 네트워크와 토큰 없이 돌고 표준 라이브러리만 쓴다.

세는 법: frontmatter 를 뺀 본문을 Python `len(str)`(코드 포인트 수)로 센다. 미러는 본문 링크를
`../CLE-X/CLE-KEY.md` 꼴로 고쳐 쓰므로 NERV 원래 꼴(`CLE-KEY`)로 되돌린 뒤 센다. `pull.py` 가
본문 끝에 개행을 하나 붙일 수 있어 NERV 본문과 1자까지 다를 수 있다.

판정:
- 한도를 넘는 문서가 기준선(`size_baseline.json`)에 없으면 실패한다(새로 넘은 문서).
- 기준선에 있는 문서가 기준선 값보다 커지면 실패한다(넘은 채로 더 커졌다).
- 기준선에 있지만 이제 한도 안에 들거나 미러에서 사라진 문서는 알리기만 한다.
  `--update-baseline` 이 그런 항목을 지우고 줄어든 값을 낮춘다(늘리지는 않는다).

기준선은 2026-11-13 도입 시점에 한도를 넘던 문서다(NERV Task `CLE-T-H8JK7M`). 그 문서들은 NERV 에서
나눈 초안이 승인되고 구현 세션이 `pull.py` 로 받으면 한도 안에 들어온다. 기준선은 줄어들기만 한다.

카탈로그 사본(`CLE-C24-*` · `CLE-MKS-*`)은 미러에 없으므로(`pull.py` 의 `is_excluded`) 보지 않는다.

usage: size_check.py [--root ROOT] [--update-baseline] [--report]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import pull  # noqa: E402  (같은 폴더의 미러 도구)

sys.path.insert(0, str(HERE.parents[1] / "hooks"))
from _lib.spec_size import LIMIT  # noqa: E402  (훅과 공유하는 한도)

BASELINE = HERE / "size_baseline.json"
_MIRROR_LINK = re.compile(r"\]\((?:[^()\s#]*/)?(CLE-[A-Z0-9-]+)\.md(#[^)\s]*)?\)")


def body_chars(text: str) -> int:
    """미러 파일 텍스트의 본문 글자수(NERV 링크 꼴로 되돌려서)."""
    _, body = pull.split_frontmatter(text)
    body = _MIRROR_LINK.sub(lambda m: f"]({m.group(1)}{m.group(2) or ''})", body)
    return len(body)


def measure(spec_root: Path) -> dict[str, int]:
    out = {}
    for path in pull.mirror_files(spec_root):
        out[path.stem] = body_chars(path.read_text(encoding="utf-8"))
    return out


def load_baseline(path: Path = BASELINE) -> dict[str, int]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("limit") != LIMIT:
        raise ValueError(f"기준선 limit({data.get('limit')})이 LIMIT({LIMIT})과 다르다")
    return {k: int(v) for k, v in data["docs"].items()}


def judge(sizes: dict[str, int], baseline: dict[str, int]) -> tuple[list[str], list[str]]:
    """(실패 줄, 알림 줄)."""
    fails, notes = [], []
    for key, n in sorted(sizes.items()):
        if n <= LIMIT:
            continue
        base = baseline.get(key)
        if base is None:
            fails.append(f"{key}: 본문 {n:,}자 — 한도 {LIMIT:,}자를 넘는 새 문서다")
        elif n > base:
            fails.append(f"{key}: 본문 {n:,}자 — 한도를 넘은 채 기준선 {base:,}자보다 커졌다")
    for key, base in sorted(baseline.items()):
        n = sizes.get(key)
        if n is None:
            notes.append(f"{key}: 미러에 없다 — 기준선에서 지울 수 있다(--update-baseline)")
        elif n <= LIMIT:
            notes.append(f"{key}: 본문 {n:,}자로 한도 안에 들었다 — 기준선에서 지울 수 있다(--update-baseline)")
    return fails, notes


def updated(sizes: dict[str, int], baseline: dict[str, int]) -> dict[str, int]:
    """줄어든 값만 반영한 기준선. 새 항목을 더하지 않고 값을 늘리지 않는다."""
    out = {}
    for key, base in baseline.items():
        n = sizes.get(key)
        if n is None or n <= LIMIT:
            continue
        out[key] = min(base, n)
    return out


def write_baseline(docs: dict[str, int], path: Path = BASELINE) -> None:
    data = {"limit": LIMIT, "docs": dict(sorted(docs.items()))}
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None, baseline_path: Path | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--root", type=Path, default=HERE.parents[2], help="저장소 루트")
    ap.add_argument("--update-baseline", action="store_true", help="줄어든 항목만 기준선에 반영")
    ap.add_argument("--report", action="store_true", help="한도를 넘는 문서를 큰 순서로 보인다")
    args = ap.parse_args(argv)
    sizes = measure(args.root / "spec")
    path = baseline_path or BASELINE
    baseline = load_baseline(path)
    if args.report:
        for key, n in sorted(sizes.items(), key=lambda kv: -kv[1]):
            if n > LIMIT:
                print(f"{n:>8,}  {key}")
    if args.update_baseline:
        write_baseline(updated(sizes, baseline), path)
        baseline = load_baseline(path)
    fails, notes = judge(sizes, baseline)
    for line in notes:
        print(f"note: {line}")
    for line in fails:
        print(f"FAIL: {line}", file=sys.stderr)
    if fails:
        print("스펙 문서 본문 한도를 넘었다. 방법은 `.claude/skills/project-planner/SKILL.md` "
              "「문서 크기 한도」. 미러는 손으로 고치지 않는다 — NERV 에서 나눈 뒤 pull 한다.",
              file=sys.stderr)
        return 1
    print(f"ok: 미러 {len(sizes)}편, 한도 초과 기준선 {len(baseline)}편")
    return 0


if __name__ == "__main__":
    sys.exit(main())
