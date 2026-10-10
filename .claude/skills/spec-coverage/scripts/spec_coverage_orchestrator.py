#!/usr/bin/env python3
"""Spec coverage standing audit — minimal orchestrator.

Single sub-agent (spec-impl-coverage-auditor) — no retry / no multi-agent
sequencing. This script's sole job is to prepare a session directory with
the sub-agent input payload, then print the directory absolute path. The
caller (main Claude) invokes the sub-agent and reads SUMMARY.md back.

Usage:
  python3 .claude/skills/spec-coverage/scripts/spec_coverage_orchestrator.py [--mode forward|reverse|both]

  forward (default) — spec→impl: spec body promises with no implementation (H1·2·3)
  reverse  (Gate D) — impl→spec: controller routes / events / env with no spec
                       reference (H4·5·6). Advisory.
  both              — all six heuristics.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# 세션 디렉터리 이름은 다른 오케스트레이터와 같은 하네스 공용 모듈이 정한다.
# 세 오케스트레이터와 같은 import 로 읽으려고 `.claude/` 를 sys.path 에 넣는다. 이 스크립트는 lib/ 를 쓰지 않아서
# skill 경로는 넣지 않는다. `not in` 검사가 있어서 테스트가 이 모듈을 다시 읽어도 경로가 쌓이지 않는다.
_CLAUDE_DIR = str(Path(__file__).resolve().parents[3])  # .claude/
if _CLAUDE_DIR not in sys.path:
    sys.path.insert(0, _CLAUDE_DIR)

from _shared import session  # noqa: E402

VALID_MODES = ("forward", "reverse", "both")

# 적용 대상의 정본(`CLE-ENG-SPECEVIDENCE` 「적용 대상」)과 그 목록. 포함 목록과 제외 항목은 정본과
# 같아야 한다. `.claude/tests/test_spec_coverage_prompt.py` 가 미러 본문과 대조한다. 감사 대상은 NERV
# 미러 가운데 `## 구현 위치` 절이 있는 문서다(전환 단계 5 에서 옛 트리를 지우며 옮겼다).
SOT_DOC = "spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md"
INCLUDE_PATTERNS = (
    "spec/<KEY>.md",
    "spec/<영역 키>/<KEY>.md",
)
IMPL_SECTION = "## 구현 위치"
# 구현 위치로 읽는 코드 스팬의 루트. 빌드 가드(`impl-locations.ts` 의 `IMPL_LOCATION_ROOTS`)와 같다.
IMPL_ROOTS = ("codebase/", ".claude/", ".github/", "scripts/")
# 미러 안내 파일. 스펙 문서가 아니다.
EXCLUDE_PATHS = ("spec/README.md",)
# 미러에 넣지 않는 카탈로그 영역. `.claude/tools/nerv-mirror/pull.py` 의 `EXCLUDED_AREAS` 와 같다.
EXCLUDED_AREAS = ("CLE-C24", "CLE-MKS")


def repo_root() -> Path:
    p = Path(__file__).resolve()
    while p != p.parent:
        if (p / ".git").exists() or (p / "CLAUDE.md").exists():
            return p
        p = p.parent
    return Path.cwd()


def session_dir(root: Path) -> Path:
    """세션 디렉터리 `.review/spec-coverage/<Y>/<m>/<d>/<H_M_S>[_<n>]` 를 만든다.

    이름은 다른 오케스트레이터와 같은 `create_session_dir` 가 정한다. 같은 초에 또 돌면 `_2` · `_3` 을 받는다.
    이름의 시각은 로컬 시각이다. `meta.json` 의 `created_utc` 는 UTC 다."""
    return Path(session.create_session_dir(str(root / ".review" / "spec-coverage")))


def env_summary() -> dict:
    return {
        "SPEC_COVERAGE_CONFIDENCE_FLOOR": os.environ.get("SPEC_COVERAGE_CONFIDENCE_FLOOR", "low"),
        "SPEC_COVERAGE_MAX_FINDINGS": os.environ.get("SPEC_COVERAGE_MAX_FINDINGS", "200"),
    }


PROMPT_TEMPLATE = """# spec-impl-coverage-auditor invocation

You are running for the `/spec-coverage` slash command. Walk every applicable
spec (per {sot} 「적용 대상」 — see below) and apply
the heuristics for the selected MODE per your agent prompt
(`.claude/agents/spec-impl-coverage-auditor.md` §모드).

## Direction

- MODE={direction_mode}
  - `forward` → Heuristic 1·2·3 (spec→impl gaps)
  - `reverse` → Heuristic 4·5·6 (impl→spec: spec-less controller routes / events / env — Gate D)
  - `both`    → all six

## Environment

- SPEC_COVERAGE_CONFIDENCE_FLOOR={confidence_floor}
- SPEC_COVERAGE_MAX_FINDINGS={max_findings}

## Applicable specs

Per {sot} 「적용 대상」 (NERV `CLE-ENG-SPECEVIDENCE`):
- INCLUDE: {include}
- SECTION: only documents whose body has the exact H2 `{section}`
- EXCLUDE: {exclude}
- EXCLUDED AREAS: {areas} (catalog areas, not mirrored)

Implementation locations are the repository paths written as code spans in that
section (starting with {roots}), the
same reading as the build guard `spec-impl-locations`. Mirror documents carry no
frontmatter `code:`.

## Output

Write SUMMARY.md to `output_file`. Format per your agent prompt §출력 형식.

After writing, print one STATUS line to stdout:

```
STATUS=success ISSUES=<total candidate count> PATH=<output_file absolute path>
```
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="spec-coverage standing audit orchestrator")
    parser.add_argument("--mode", choices=VALID_MODES, default="forward",
                        help="forward (spec→impl, default) | reverse (impl→spec, Gate D) | both")
    args = parser.parse_args()

    root = repo_root()
    sess = session_dir(root)

    env = env_summary()
    prompt_text = PROMPT_TEMPLATE.format(
        sot=f"`{SOT_DOC}`",
        include=", ".join(f"`{g}`" for g in INCLUDE_PATTERNS),
        section=IMPL_SECTION,
        exclude=", ".join(f"`{x}`" for x in EXCLUDE_PATHS),
        areas=", ".join(f"`{a}`" for a in EXCLUDED_AREAS),
        roots=" · ".join(f"`{r}`" for r in IMPL_ROOTS),
        direction_mode=args.mode,
        confidence_floor=env["SPEC_COVERAGE_CONFIDENCE_FLOOR"],
        max_findings=env["SPEC_COVERAGE_MAX_FINDINGS"],
    )

    prompt_path = sess / "_prompt.md"
    prompt_path.write_text(prompt_text, encoding="utf-8")

    meta = {
        "mode": "spec-coverage-standing-audit",
        "direction": args.mode,
        "session_dir": str(sess),
        "summary_subagent_type": "spec-impl-coverage-auditor",
        "prompt_file": str(prompt_path),
        "summary_output_file": str(sess / "SUMMARY.md"),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "env": env,
    }
    (sess / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Mode: spec-coverage standing audit (direction={args.mode})")
    print(f"Sub-agent: spec-impl-coverage-auditor")
    print(f"Confidence floor: {env['SPEC_COVERAGE_CONFIDENCE_FLOOR']}  Max findings: {env['SPEC_COVERAGE_MAX_FINDINGS']}")
    print(str(sess))
    return 0


if __name__ == "__main__":
    sys.exit(main())
