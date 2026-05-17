#!/usr/bin/env python3
"""
PRD/Spec 문서 및 frontend MDX frontmatter 의 내부 링크 정합성 검사.

검사 대상:
- prd/, spec/ 의 모든 .md 파일에서 markdown 링크 [text](target)
  - 외부 URL (http:, https:, mailto:) 은 제외
  - 파일 경로가 실제 존재하는지 확인
  - anchor (#section) 가 대상 파일 헤딩에서 GitHub-style slug 로 매칭되는지 확인
- codebase/frontend/src/content/docs/**.mdx 의 frontmatter spec: ["..."] 배열에 적힌 모든 경로

종료 코드: 깨진 항목이 있으면 1, 없으면 0.

사용:
    python3 scripts/check-doc-links.py [--root <repo-root>]

repo 루트 자동 감지: 스크립트 파일의 부모 디렉터리 (../) 를 기본으로 사용.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from typing import Iterable


LINK_RE = re.compile(r"\[(?P<text>[^\]]*)\]\((?P<target>[^)]+)\)")
HEAD_RE = re.compile(r"^(?P<hashes>#{1,6})\s+(?P<title>.*?)(?:\s*\{#(?P<id>[^}]+)\})?\s*$")
MDX_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
MDX_SPEC_LIST_RE = re.compile(r"^spec:\s*\[(?P<list>.*)\]\s*$", re.MULTILINE)
MDX_SPEC_ITEM_RE = re.compile(r'"([^"]+)"|\'([^\']+)\'')


def slugify(text: str) -> str:
    """GitHub-style slug 산출.

    1. 좌우 공백 제거 + 소문자화
    2. backtick 코드 마크업 제거 (텍스트만 남김)
    3. markdown 링크 [text](url) → text 만 남김
    4. 알파벳, 숫자, 언더스코어, 공백, 하이픈 외 문자 제거 (한글 등 유니코드 letter 포함)
    5. 공백 → 하이픈
    6. 명시적 anchor id (`{#custom}`) 가 헤딩 끝에 있으면 우선 사용 (호출 측에서 처리)
    """
    s = text.strip().lower()
    s = re.sub(r"`([^`]+)`", r"\1", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    out = []
    for ch in s:
        if ch.isalnum() or ch in (" ", "-", "_"):
            out.append(ch)
    return "".join(out).replace(" ", "-")


def collect_anchors(path: str) -> set[str]:
    """파일의 모든 헤딩 슬러그 (중복 시 -1, -2 접미사) 를 모은다."""
    anchors: set[str] = set()
    if not os.path.isfile(path):
        return anchors
    counts: dict[str, int] = {}
    try:
        with open(path, encoding="utf-8") as fp:
            lines = fp.readlines()
    except OSError:
        return anchors
    for line in lines:
        m = HEAD_RE.match(line)
        if not m:
            continue
        explicit = m.group("id")
        if explicit:
            anchors.add(explicit.strip().lower())
            continue
        base = slugify(m.group("title"))
        if base in counts:
            counts[base] += 1
            anchors.add(f"{base}-{counts[base]}")
        else:
            counts[base] = 0
            anchors.add(base)
    return anchors


def iter_md_files(root: str, subdirs: Iterable[str]) -> Iterable[str]:
    for sub in subdirs:
        base = os.path.join(root, sub)
        if not os.path.isdir(base):
            continue
        for dp, _, fs in os.walk(base):
            for f in fs:
                if f.endswith(".md"):
                    yield os.path.join(dp, f)


def iter_mdx_files(root: str) -> Iterable[str]:
    base = os.path.join(root, "codebase", "frontend", "src", "content", "docs")
    if not os.path.isdir(base):
        return
    for dp, _, fs in os.walk(base):
        for f in fs:
            if f.endswith(".mdx"):
                yield os.path.join(dp, f)


def check_md_links(files: Iterable[str], root: str, anchor_cache: dict[str, set[str]]) -> list[str]:
    """markdown 파일의 내부 링크 + anchor 검증. 깨진 항목 메시지 리스트 반환."""
    broken: list[str] = []
    for path in files:
        try:
            with open(path, encoding="utf-8") as fp:
                lines = fp.readlines()
        except OSError as e:
            broken.append(f"{path}: read error: {e}")
            continue
        rel_src = os.path.relpath(path, root)
        for i, line in enumerate(lines, 1):
            for m in LINK_RE.finditer(line):
                target = m.group("target").strip()
                if target.startswith(("http://", "https://", "mailto:")):
                    continue
                if target.startswith("#"):
                    file_part = ""
                    anchor = target[1:]
                    resolved = path
                else:
                    if "#" in target:
                        file_part, anchor = target.split("#", 1)
                    else:
                        file_part, anchor = target, ""
                    if file_part:
                        resolved = os.path.normpath(os.path.join(os.path.dirname(path), file_part))
                    else:
                        resolved = path
                if file_part and not os.path.exists(resolved):
                    broken.append(f"{rel_src}:{i}  FILE  '{target}' → {os.path.relpath(resolved, root)} (not found)")
                    continue
                if not anchor:
                    continue
                if not os.path.isfile(resolved):
                    continue
                if resolved not in anchor_cache:
                    anchor_cache[resolved] = collect_anchors(resolved)
                if anchor not in anchor_cache[resolved]:
                    broken.append(f"{rel_src}:{i}  ANCH  '{target}' → {os.path.relpath(resolved, root)}#{anchor} (not in headings)")
    return broken


def check_mdx_frontmatter(root: str) -> list[str]:
    """codebase/frontend/src/content/docs/**.mdx 의 frontmatter `spec:` 배열 항목들을 검증."""
    broken: list[str] = []
    for path in iter_mdx_files(root):
        try:
            with open(path, encoding="utf-8") as fp:
                content = fp.read()
        except OSError as e:
            broken.append(f"{path}: read error: {e}")
            continue
        rel_src = os.path.relpath(path, root)
        fm_match = MDX_FRONTMATTER_RE.match(content)
        if not fm_match:
            continue
        fm = fm_match.group(1)
        for list_match in MDX_SPEC_LIST_RE.finditer(fm):
            list_body = list_match.group("list")
            for item in MDX_SPEC_ITEM_RE.finditer(list_body):
                ref = item.group(1) or item.group(2)
                if not ref:
                    continue
                resolved = os.path.normpath(os.path.join(root, ref))
                if not os.path.exists(resolved):
                    broken.append(f"{rel_src}  MDX-SPEC  '{ref}' (not found)")
    return broken


def main() -> int:
    parser = argparse.ArgumentParser(description="Check internal links in PRD/Spec markdown and frontend MDX frontmatter.")
    parser.add_argument("--root", default=None, help="Repository root (defaults to script's parent dir).")
    args = parser.parse_args()

    if args.root:
        root = os.path.abspath(args.root)
    else:
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    anchor_cache: dict[str, set[str]] = {}
    md_files = list(iter_md_files(root, ["prd", "spec"]))
    md_broken = check_md_links(md_files, root, anchor_cache)
    mdx_broken = check_mdx_frontmatter(root)

    all_broken = md_broken + mdx_broken
    if all_broken:
        for msg in all_broken:
            print(msg)
        print(f"\nBROKEN={len(all_broken)} (md={len(md_broken)}, mdx={len(mdx_broken)})", file=sys.stderr)
        return 1
    print(f"OK: 0 broken refs across {len(md_files)} markdown files + frontend MDX frontmatter.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
