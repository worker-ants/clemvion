#!/usr/bin/env python3
"""NERV 스펙을 저장소 `spec/` 에 읽기 전용 미러로 내려받는다.

NERV 정본 전환 단계 1(NERV Task `CLE-T-VA4YA1`). 스펙의 정본은 NERV 이고 저장소 `spec/`
의 미러는 이 도구만 쓴다. 사람과 에이전트는 미러를 고치지 않는다 — 고칠 때는 NERV 초안으로
고친다(`/nerv:spec edit <KEY>`). 편집은 `guard_nerv_owned_paths.py` 훅이 막고, 셸 편집은
CI `spec-mirror-integrity`(이 도구의 `--check`)가 잡는다.

모드
- ``--all``   `export.zip?layout=tree` 한 번으로 전체를 받는다(첫 미러 · 수동 동기화).
- ``--task``  클레임한 Task 의 scope 스펙을 작업 기준 버전(`?task=`)으로 받는다. 구현
  세션이 코드와 같은 PR 에 커밋한다(결정 D3).
- ``--check`` 네트워크 없이 미러 파일마다 본문 지문이 frontmatter 의 `mirror_sha256` 과
  같은지, 파일 위치가 `area` · `id` 와 맞는지 본다.

배치(결정 D1): `spec/<영역 키>/<KEY>.md`. 영역이 없는 문서는 `spec/<KEY>.md`. 카탈로그 영역
(`CLE-C24` · `CLE-MKS`)은 codebase 데이터라 미러하지 않는다(결정 D4).

미러 frontmatter 는 NERV 가 준 줄을 그대로 두고 세 줄을 더한다.
- ``source_paths`` — 본문 첫 인용 줄의 `원문:` 에 적힌 옛 `spec/…md` 경로(옛 경로 → 키 역색인).
- ``mirror_sha256`` — 링크를 고친 본문의 sha256. `content_hash` 는 NERV 본문 지문이라 다르다.
- ``etag`` — 받은 md 바이트의 sha256(`"sha256-…"`). NERV md 엔드포인트의 ETag 와 같은 값이다.

링크: NERV 본문의 `](CLE-X)` · `](CLE-X#a)` 를 미러 파일 사이 상대 경로로 바꾼다. 미러에 없는
키(카탈로그 · 모르는 키)는 그대로 둔다.

HTTP 는 curl 로 부른다. Python 기본 User-Agent 는 Cloudflare 가 막는다(1010, 실측).
토큰은 `-K -`(stdin 설정)로 넘겨 argv 에 남기지 않는다. 토큰 값을 출력하지 않는다.

출력은 결정적이다: LF, 끝 줄바꿈, 바뀐 파일만 쓴다. 같은 입력을 두 번 받으면 diff 가 0 이다.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

EXCLUDED_AREAS = ("CLE-C24", "CLE-MKS")
KEY_RE = re.compile(r"^CLE-[A-Z0-9]+(?:-[A-Z0-9]+)*(?:--[A-Z0-9]+(?:-[A-Z0-9]+)*)*$")
# 본문 링크: ](CLE-KEY) · ](CLE-KEY#anchor). 키 안의 `--`(카탈로그 계층)도 받는다.
LINK_RE = re.compile(r"\]\((CLE-[A-Z0-9-]+)(#[^)\s]*)?\)")
SOURCE_LINE_RE = re.compile(r"원문:\s*(.+)")
SOURCE_PATH_RE = re.compile(r"`(spec/[^`]+?\.md)`")
MIRROR_FIELDS = ("source_paths", "mirror_sha256", "etag")
README = "README.md"


@dataclass(frozen=True)
class Doc:
    key: str
    area: str | None
    raw: bytes

    @property
    def relpath(self) -> PurePosixPath:
        return mirror_relpath(self.key, self.area)


def mirror_relpath(key: str, area: str | None) -> PurePosixPath:
    """`spec/` 기준 상대 경로."""
    return PurePosixPath(area, f"{key}.md") if area else PurePosixPath(f"{key}.md")


def is_excluded(key: str, area: str | None) -> bool:
    return (area or key) in EXCLUDED_AREAS or any(
        key == a or key.startswith(a + "-") for a in EXCLUDED_AREAS)


def split_frontmatter(text: str) -> tuple[list[str], str]:
    """(frontmatter 줄 목록, 본문). frontmatter 가 없으면 ValueError."""
    if not text.startswith("---\n"):
        raise ValueError("frontmatter 가 없다")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError("frontmatter 가 닫히지 않았다")
    return text[4:end].split("\n"), text[end + 5:]


def fm_value(lines: list[str], name: str):
    """frontmatter 한 줄의 JSON 값. NERV 는 값을 JSON 인용 표기로 준다."""
    prefix = f"{name}: "
    for line in lines:
        if line.startswith(prefix):
            return json.loads(line[len(prefix):])
    return None


def source_paths(body: str) -> list[str]:
    for line in body.splitlines()[:5]:
        m = SOURCE_LINE_RE.search(line)
        if m:
            return sorted(set(SOURCE_PATH_RE.findall(m.group(1))))
    return []


def rewrite_links(body: str, here: PurePosixPath, paths: dict[str, PurePosixPath]) -> str:
    """본문 키 링크를 미러 상대 경로로 바꾼다. ``here`` 는 이 파일의 `spec/` 기준 경로."""

    def repl(m: re.Match[str]) -> str:
        key, anchor = m.group(1), m.group(2) or ""
        target = paths.get(key)
        if target is None:
            return m.group(0)
        rel = os.path.relpath(str(target), str(here.parent) or ".")
        return f"]({PurePosixPath(rel).as_posix()}{anchor})"

    return LINK_RE.sub(repl, body)


def render(doc: Doc, paths: dict[str, PurePosixPath]) -> str:
    text = doc.raw.decode("utf-8").replace("\r\n", "\n")
    lines, body = split_frontmatter(text)
    lines = [ln for ln in lines if not any(ln.startswith(f + ": ") for f in MIRROR_FIELDS)]
    body = rewrite_links(body, doc.relpath, paths)
    if not body.endswith("\n"):
        body += "\n"
    extra = [
        f"source_paths: {json.dumps(source_paths(body), ensure_ascii=False)}",
        f"mirror_sha256: {json.dumps(sha256_text(body))}",
        f"etag: {json.dumps('sha256-' + hashlib.sha256(doc.raw).hexdigest())}",
    ]
    return "---\n" + "\n".join(lines + extra) + "\n---\n" + body


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# -- 파일 쓰기 ---------------------------------------------------------------

def mirror_files(spec_root: Path) -> list[Path]:
    """이 도구가 소유한 미러 파일(옛 트리 · README 는 뺀다)."""
    out = [p for p in spec_root.glob("CLE-*.md") if KEY_RE.match(p.stem)]
    for d in spec_root.glob("CLE-*"):
        if d.is_dir() and KEY_RE.match(d.name):
            out.extend(p for p in d.glob("CLE-*.md") if KEY_RE.match(p.stem))
    return sorted(out)


def write_if_changed(path: Path, content: str) -> bool:
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(content)
    return True


def apply(spec_root: Path, docs: list[Doc], paths: dict[str, PurePosixPath],
          prune: bool) -> dict[str, list[str]]:
    """문서를 쓰고, 자리를 옮긴 문서의 옛 파일과(``prune`` 이면) 사라진 문서를 지운다."""
    report = {"written": [], "unchanged": [], "removed": []}
    keep = set()
    for doc in sorted(docs, key=lambda d: d.key):
        target = spec_root / doc.relpath
        keep.add(target.resolve())
        changed = write_if_changed(target, render(doc, paths))
        report["written" if changed else "unchanged"].append(doc.relpath.as_posix())
    pulled = {d.key for d in docs}
    for path in mirror_files(spec_root):
        if path.resolve() in keep:
            continue
        if prune or path.stem in pulled:
            path.unlink()
            report["removed"].append(path.relative_to(spec_root).as_posix())
    for d in spec_root.glob("CLE-*"):
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()
    return report


# -- 입력: export.zip ---------------------------------------------------------

def docs_from_zip(data: bytes) -> list[Doc]:
    docs = []
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for name in sorted(zf.namelist()):
            parts = PurePosixPath(name).parts
            if len(parts) < 2 or parts[0] != "specs" or not name.endswith(".md"):
                continue
            area = parts[1] if len(parts) == 3 else None
            key = PurePosixPath(name).stem
            if is_excluded(key, area):
                continue
            docs.append(Doc(key=key, area=area, raw=zf.read(name)))
    return docs


# -- 입력: 트리 + md 엔드포인트 ----------------------------------------------

def area_map(tree: list[dict]) -> dict[str, str | None]:
    """키 → 영역 키. 영역은 가장 가까운 `area` 조상(자신 포함), 폴더는 한 단계다."""
    by_id = {n["id"]: n for n in tree}
    out: dict[str, str | None] = {}
    for node in tree:
        cur, area = node, None
        while cur is not None:
            if cur.get("type") == "area":
                area = cur["key"]
                break
            cur = by_id.get(cur.get("parent_id"))
        out[node["key"]] = area
    return out


def paths_for(areas: dict[str, str | None]) -> dict[str, PurePosixPath]:
    return {k: mirror_relpath(k, a) for k, a in areas.items() if not is_excluded(k, a)}


# -- HTTP (curl) ---------------------------------------------------------------

class Nerv:
    def __init__(self, server: str, project: str, token: str):
        self.server, self.project, self.token = server.rstrip("/"), project, token

    def get(self, path: str, etag: str | None = None) -> tuple[int, bytes, dict[str, str]]:
        cfg = [f'header = "Authorization: Bearer {self.token}"']
        if etag:
            cfg.append(f'header = "If-None-Match: \\"{etag}\\""')
        cmd = ["curl", "-sS", "-K", "-", "-D", "-", "--max-time", "120",
               "-A", "clemvion-nerv-mirror/1", f"{self.server}{path}"]
        r = subprocess.run(cmd, input="\n".join(cfg).encode(), capture_output=True)
        if r.returncode != 0:
            raise RuntimeError(f"curl 실패(exit {r.returncode}): {path}")
        head, _, body = r.stdout.partition(b"\r\n\r\n")
        lines = head.decode("latin-1").split("\r\n")
        status = int(lines[0].split()[1])
        headers = {}
        for ln in lines[1:]:
            k, _, v = ln.partition(":")
            headers[k.strip().lower()] = v.strip()
        return status, body, headers


def load_env() -> Nerv:
    server = os.environ.get("NERV_SERVER", "")
    token = os.environ.get("NERV_TOKEN", "")
    project = os.environ.get("NERV_PROJECT", "clemvion")
    if not server or not token:
        raise SystemExit("pull: NERV_SERVER · NERV_TOKEN 이 필요하다(.claude/settings.local.json env)")
    return Nerv(server, project, token)


# -- --check ---------------------------------------------------------------------

def check(spec_root: Path) -> list[str]:
    """미러 파일의 본문 지문과 위치를 검사한다. 문제 줄 목록(비면 통과)."""
    problems = []
    for path in mirror_files(spec_root):
        rel = path.relative_to(spec_root).as_posix()
        try:
            lines, body = split_frontmatter(path.read_text(encoding="utf-8"))
            recorded = fm_value(lines, "mirror_sha256")
            key, area = fm_value(lines, "id"), fm_value(lines, "area")
            # 영역 문서는 frontmatter `area` 가 부모 영역이지만 폴더는 자기 키다(export 규칙).
            folder = key if fm_value(lines, "type") == "area" else area
        except (ValueError, json.JSONDecodeError) as exc:
            problems.append(f"{rel}: frontmatter 를 읽지 못했다 — {exc}")
            continue
        if recorded != sha256_text(body):
            problems.append(f"{rel}: 본문이 mirror_sha256 과 다르다 — 미러는 손으로 고치지 않는다"
                            " (/nerv:spec edit 로 NERV 에서 고친 뒤 pull)")
        if key and mirror_relpath(key, folder).as_posix() != rel:
            problems.append(f"{rel}: 위치가 id·area 와 맞지 않는다(기대 {mirror_relpath(key, folder)})")
    return problems


# -- 명령 ------------------------------------------------------------------------

def cmd_all(spec_root: Path, basis: str, zip_path: Path | None) -> int:
    if zip_path is not None:
        data = zip_path.read_bytes()
    else:
        nerv = load_env()
        status, data, _ = nerv.get(
            f"/api/projects/{nerv.project}/export.zip?basis={basis}&layout=tree")
        if status != 200:
            raise SystemExit(f"pull: export.zip 응답 {status}")
    docs = docs_from_zip(data)
    paths = {d.key: d.relpath for d in docs}
    report = apply(spec_root, docs, paths, prune=True)
    write_if_changed(spec_root / README, render_readme(docs))
    print_report(report)
    return 0


def cmd_task(spec_root: Path, task: str, keys: list[str]) -> int:
    nerv = load_env()
    status, raw, _ = nerv.get(f"/api/v1/projects/{nerv.project}/specs/tree")
    if status != 200:
        raise SystemExit(f"pull: specs/tree 응답 {status}")
    areas = area_map(json.loads(raw))
    if not keys:
        status, raw, _ = nerv.get(f"/api/v1/projects/{nerv.project}/tasks/{task}")
        if status != 200:
            raise SystemExit(f"pull: task {task} 응답 {status}")
        claims = [c for c in json.loads(raw).get("claims", []) if c.get("status") == "active"]
        keys = sorted({k for c in claims for k in c.get("scope_spec_ids") or []})
    paths = paths_for(areas)
    docs = []
    for key in keys:
        if key not in areas:
            raise SystemExit(f"pull: NERV 에 없는 키 — {key}")
        area = areas[key]
        if is_excluded(key, area):
            print(f"건너뜀  {key} — 카탈로그 영역은 미러하지 않는다")
            continue
        existing = spec_root / mirror_relpath(key, area)
        etag = None
        if existing.exists():
            lines, _ = split_frontmatter(existing.read_text(encoding="utf-8"))
            etag = fm_value(lines, "etag")
        status, raw, _ = nerv.get(
            f"/api/projects/{nerv.project}/specs/{key}.md?task={task}", etag=etag)
        if status == 304:
            print(f"그대로  {key} — ETag 같음")
            continue
        if status != 200:
            raise SystemExit(f"pull: {key}.md 응답 {status}")
        docs.append(Doc(key=key, area=area, raw=raw))
    print_report(apply(spec_root, docs, paths, prune=False))
    return 0


def render_readme(docs: list[Doc]) -> str:
    areas = sorted({d.area for d in docs if d.area})
    roots = sorted(d.key for d in docs if not d.area)
    lines = [
        "# spec/ — NERV 스펙 미러 (읽기 전용)",
        "",
        "이 폴더의 `CLE-*` 파일은 NERV 스펙의 사본이다. **정본은 NERV 다.** 손으로 고치지 않는다.",
        "`.claude/hooks/guard_nerv_owned_paths.py` 가 편집을 막고, CI `spec-mirror-integrity` 가",
        "본문 지문(`mirror_sha256`)이 어긋난 파일을 잡는다.",
        "",
        "- 스펙을 고칠 때: `/nerv:spec edit <KEY>` 로 NERV 초안을 쓰고 사람이 승인한다.",
        "- 미러를 갱신할 때: 구현하는 세션이 클레임한 스펙을 받아 코드와 같은 PR 에 커밋한다.",
        "  `python3 .claude/tools/nerv-mirror/pull.py --task <CLE-T-…>`",
        "- 전체를 다시 받을 때: `python3 .claude/tools/nerv-mirror/pull.py --all`",
        "- 미러는 구현된 스펙의 스냅샷이다. 최신본은 NERV 에서 읽는다.",
        "- 카탈로그(`CLE-C24` · `CLE-MKS`)는 미러하지 않는다. 정본은 codebase 데이터다.",
        "",
        "## 영역",
        "",
    ]
    lines += [f"- [{a}]({a}/{a}.md)" for a in areas]
    if roots:
        lines += ["", "## 영역 밖 문서", ""]
        lines += [f"- [{k}]({k}.md)" for k in roots]
    return "\n".join(lines) + "\n"


def print_report(report: dict[str, list[str]]) -> None:
    for kind, label in (("written", "씀"), ("removed", "지움")):
        for rel in report[kind]:
            print(f"{label}    spec/{rel}")
    print(f"pull: 씀 {len(report['written'])} · 그대로 {len(report['unchanged'])} · "
          f"지움 {len(report['removed'])}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--all", action="store_true", help="export.zip 으로 전체를 받는다")
    mode.add_argument("--task", metavar="KEY", help="Task 의 클레임 scope 스펙을 작업 기준으로 받는다")
    mode.add_argument("--check", action="store_true", help="네트워크 없이 미러 무결성을 본다")
    parser.add_argument("--spec", action="append", default=[], metavar="KEY",
                        help="--task 와 함께: scope 대신 이 키들만 받는다")
    parser.add_argument("--basis", choices=("approved", "latest"), default="approved",
                        help="--all 의 버전 기준(기본 approved — 승인본이 없으면 현재 초안)")
    parser.add_argument("--from-zip", type=Path, default=None, help="--all 입력을 파일에서 읽는다")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[3],
                        help="저장소 루트(기본: 이 파일 기준)")
    args = parser.parse_args(argv)
    spec_root = args.root / "spec"
    if args.check:
        problems = check(spec_root)
        for p in problems:
            print(f"spec-mirror-integrity: {p}")
        print(f"spec-mirror-integrity: 미러 {len(mirror_files(spec_root))}편 · 문제 {len(problems)}")
        return 1 if problems else 0
    if args.all:
        return cmd_all(spec_root, args.basis, args.from_zip)
    return cmd_task(spec_root, args.task, args.spec)


if __name__ == "__main__":
    sys.exit(main())
