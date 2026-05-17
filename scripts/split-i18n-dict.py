#!/usr/bin/env python3
"""
i18n dict 파일 (ko.ts / en.ts) 을 top-level 섹션 단위로 분리한다.

본 스크립트는 plan/in-progress/i18n-dict-split.md 의 refactor 를 한 번에
수행하기 위한 one-time tool. 분리 후에도 보존해 history 와 재실행 가능성을
유지한다 (예: 신규 locale 추가 시 동일 패턴으로 split).

입력:
  codebase/frontend/src/lib/i18n/dict/ko.ts
  codebase/frontend/src/lib/i18n/dict/en.ts

출력:
  codebase/frontend/src/lib/i18n/dict/ko/<section>.ts  (× 22)
  codebase/frontend/src/lib/i18n/dict/ko/index.ts
  codebase/frontend/src/lib/i18n/dict/en/<section>.ts  (× 22)
  codebase/frontend/src/lib/i18n/dict/en/index.ts

분리 규칙:
  - top-level 섹션 header: 줄 시작이 2 공백 + 이름 + ": {"
  - 섹션 종료: 줄 시작이 정확히 "  }," (2 공백 + }, )
  - body 라인은 2 공백 dedent 후 출력
  - ko 측: `export const <section> = { ... } as const;`
  - en 측: `import type { Dict } from "../types"; export const <section>: Dict["<section>"] = { ... };`
  - index.ts: 22 import → composite export
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DICT_DIR = ROOT / "codebase" / "frontend" / "src" / "lib" / "i18n" / "dict"

SECTION_HEADER = re.compile(r"^  ([a-zA-Z_]+): \{$")


def parse_sections(text: str) -> list[tuple[str, list[str]]]:
    """ko.ts 또는 en.ts 의 본문 텍스트를 받아 [(section_name, body_lines), ...] 반환.

    body_lines 는 섹션의 opening `{` 다음 줄부터 closing `},` 직전 줄까지 (모두 dedent 적용 전).
    """
    lines = text.split("\n")
    sections: list[tuple[str, list[str]]] = []
    i = 0
    current_name: str | None = None
    current_body: list[str] = []

    while i < len(lines):
        line = lines[i]

        # 섹션 시작 감지
        m = SECTION_HEADER.match(line)
        if m and current_name is None:
            current_name = m.group(1)
            current_body = []
            i += 1
            continue

        # 섹션 종료 감지 — 정확히 "  }," (2 공백)
        if current_name is not None and line == "  },":
            sections.append((current_name, current_body))
            current_name = None
            current_body = []
            i += 1
            continue

        # 섹션 본문
        if current_name is not None:
            current_body.append(line)
            i += 1
            continue

        i += 1

    if current_name is not None:
        raise RuntimeError(
            f"섹션 '{current_name}' 이 종료되지 않았다 — closing '  }},' 누락."
        )

    return sections


def dedent_body(body_lines: list[str]) -> list[str]:
    """본문 라인의 leading 2 공백을 제거한다.

    공백만 있는 줄은 그대로 두고, 4+ 공백으로 시작하는 줄만 dedent.
    """
    out: list[str] = []
    for line in body_lines:
        if line.startswith("  "):
            out.append(line[2:])
        elif line == "":
            out.append("")
        else:
            # 4 공백 이하인데 비어있지 않은 줄은 예상 밖
            raise RuntimeError(f"예상 못한 들여쓰기: {line!r}")
    return out


def write_ko_section(section: str, body: list[str], target_dir: Path) -> None:
    """ko/<section>.ts 작성. `export const <section> = { ... } as const;`"""
    dedented = dedent_body(body)
    content = (
        f"export const {section} = {{\n"
        + "\n".join(dedented).rstrip("\n")
        + "\n} as const;\n"
    )
    (target_dir / f"{section}.ts").write_text(content, encoding="utf-8")


def write_en_section(section: str, body: list[str], target_dir: Path) -> None:
    """en/<section>.ts 작성. `export const <section>: Dict["<section>"] = { ... };`"""
    dedented = dedent_body(body)
    content = (
        'import type { Dict } from "../types";\n'
        "\n"
        f'export const {section}: Dict["{section}"] = {{\n'
        + "\n".join(dedented).rstrip("\n")
        + "\n};\n"
    )
    (target_dir / f"{section}.ts").write_text(content, encoding="utf-8")


def write_ko_index(sections: list[str], target_dir: Path) -> None:
    """ko/index.ts 작성 — 22 섹션 import + composite export."""
    imports = "\n".join(f'import {{ {s} }} from "./{s}";' for s in sections)
    composite = ",\n  ".join(sections)
    content = (
        f"{imports}\n"
        "\n"
        "export const ko = {\n"
        f"  {composite},\n"
        "} as const;\n"
        "\n"
        'export type { Dict } from "../types";\n'
    )
    (target_dir / "index.ts").write_text(content, encoding="utf-8")


def write_en_index(sections: list[str], target_dir: Path) -> None:
    """en/index.ts 작성 — 22 섹션 import + composite + Dict typing."""
    imports = "\n".join(f'import {{ {s} }} from "./{s}";' for s in sections)
    composite = ",\n  ".join(sections)
    content = (
        "// Structural contract — `Dict` is derived from `ko/index.ts` but exported via `types.ts`\n"
        "// so non-reference locales don't take a direct dependency on the reference file.\n"
        'import type { Dict } from "../types";\n'
        f"{imports}\n"
        "\n"
        "export const en: Dict = {\n"
        f"  {composite},\n"
        "};\n"
    )
    (target_dir / "index.ts").write_text(content, encoding="utf-8")


def split_locale(src_path: Path, dst_dir: Path, locale: str) -> list[str]:
    """단일 locale 파일 분리."""
    text = src_path.read_text(encoding="utf-8")
    sections = parse_sections(text)
    if not sections:
        raise RuntimeError(f"{src_path} 에서 섹션을 찾지 못했다.")

    dst_dir.mkdir(parents=True, exist_ok=True)

    names = [name for name, _ in sections]

    if locale == "ko":
        for name, body in sections:
            write_ko_section(name, body, dst_dir)
        write_ko_index(names, dst_dir)
    elif locale == "en":
        for name, body in sections:
            write_en_section(name, body, dst_dir)
        write_en_index(names, dst_dir)
    else:
        raise ValueError(f"알 수 없는 locale: {locale}")

    return names


def main() -> int:
    ko_src = DICT_DIR / "ko.ts"
    en_src = DICT_DIR / "en.ts"
    ko_dst = DICT_DIR / "ko"
    en_dst = DICT_DIR / "en"

    if not ko_src.is_file() or not en_src.is_file():
        print(f"ERROR: 원본 dict 파일 부재 — {ko_src} / {en_src}", file=sys.stderr)
        return 1

    if ko_dst.exists() or en_dst.exists():
        print(
            f"ERROR: 대상 디렉토리가 이미 존재한다 — {ko_dst} / {en_dst}. "
            "분리 재실행 시 디렉토리를 먼저 제거하라.",
            file=sys.stderr,
        )
        return 1

    print("ko.ts 분리 중...")
    ko_sections = split_locale(ko_src, ko_dst, "ko")
    print(f"  → {len(ko_sections)} 섹션: {', '.join(ko_sections)}")

    print("en.ts 분리 중...")
    en_sections = split_locale(en_src, en_dst, "en")
    print(f"  → {len(en_sections)} 섹션: {', '.join(en_sections)}")

    if ko_sections != en_sections:
        print(
            "WARNING: ko 와 en 의 섹션 목록·순서가 다르다 — parity 가드가 fail 할 수 있다.",
            file=sys.stderr,
        )
        print(f"  ko only: {set(ko_sections) - set(en_sections)}", file=sys.stderr)
        print(f"  en only: {set(en_sections) - set(ko_sections)}", file=sys.stderr)
        return 1

    print("\n분리 완료. 다음 단계:")
    print("  1. cd codebase/frontend && npx tsc --noEmit")
    print("  2. cd codebase/frontend && npm test")
    print("  3. cd codebase/frontend && npm run build")
    print("  4. 통과 시 원본 ko.ts / en.ts 삭제")
    return 0


if __name__ == "__main__":
    sys.exit(main())
