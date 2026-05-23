#!/usr/bin/env python3
"""Spec coverage standing audit — minimal orchestrator.

Single sub-agent (spec-impl-coverage-auditor) — no retry / no multi-agent
sequencing. This script's sole job is to prepare a session directory with
the sub-agent input payload, then print the directory absolute path. The
caller (main Claude) invokes the sub-agent and reads SUMMARY.md back.

Usage:
  python3 .claude/skills/spec-coverage/scripts/spec_coverage_orchestrator.py
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def repo_root() -> Path:
    p = Path(__file__).resolve()
    while p != p.parent:
        if (p / ".git").exists() or (p / "CLAUDE.md").exists():
            return p
        p = p.parent
    return Path.cwd()


def session_dir(root: Path) -> Path:
    now = datetime.now(timezone.utc)
    base = root / "review" / "spec-coverage" / now.strftime("%Y") / now.strftime("%m") / now.strftime("%d") / now.strftime("%H_%M_%S")
    base.mkdir(parents=True, exist_ok=True)
    return base


def env_summary() -> dict:
    return {
        "SPEC_COVERAGE_CONFIDENCE_FLOOR": os.environ.get("SPEC_COVERAGE_CONFIDENCE_FLOOR", "low"),
        "SPEC_COVERAGE_MAX_FINDINGS": os.environ.get("SPEC_COVERAGE_MAX_FINDINGS", "200"),
    }


PROMPT_TEMPLATE = """# spec-impl-coverage-auditor invocation

You are running for the `/spec-coverage` slash command. Walk every applicable
spec (per `spec/conventions/spec-impl-evidence.md §1` — see below) and apply
the 3 heuristics defined in your agent prompt (`.claude/agents/spec-impl-coverage-auditor.md`).

## Environment

- SPEC_COVERAGE_CONFIDENCE_FLOOR={confidence_floor}
- SPEC_COVERAGE_MAX_FINDINGS={max_findings}

## Applicable specs

Per `spec/conventions/spec-impl-evidence.md §1`:
- INCLUDE: `spec/2-navigation/**.md`, `spec/3-workflow-editor/**.md`, `spec/4-nodes/**.md`, `spec/5-system/**.md`, `spec/conventions/**.md`
- EXCLUDE: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/6-brand.md`, `spec/**/_*.md`

## Output

Write SUMMARY.md to `output_file`. Format per your agent prompt §출력 형식.

After writing, print one STATUS line to stdout:

```
STATUS=success ISSUES=<total candidate count> PATH=<output_file absolute path>
```
"""


def main() -> int:
    root = repo_root()
    sess = session_dir(root)

    env = env_summary()
    prompt_text = PROMPT_TEMPLATE.format(
        confidence_floor=env["SPEC_COVERAGE_CONFIDENCE_FLOOR"],
        max_findings=env["SPEC_COVERAGE_MAX_FINDINGS"],
    )

    prompt_path = sess / "_prompt.md"
    prompt_path.write_text(prompt_text, encoding="utf-8")

    meta = {
        "mode": "spec-coverage-standing-audit",
        "session_dir": str(sess),
        "summary_subagent_type": "spec-impl-coverage-auditor",
        "prompt_file": str(prompt_path),
        "summary_output_file": str(sess / "SUMMARY.md"),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "env": env,
    }
    (sess / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")

    print("Mode: spec-coverage standing audit")
    print(f"Sub-agent: spec-impl-coverage-auditor")
    print(f"Confidence floor: {env['SPEC_COVERAGE_CONFIDENCE_FLOOR']}  Max findings: {env['SPEC_COVERAGE_MAX_FINDINGS']}")
    print(str(sess))
    return 0


if __name__ == "__main__":
    sys.exit(main())
