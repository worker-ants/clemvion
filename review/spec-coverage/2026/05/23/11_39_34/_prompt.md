# spec-impl-coverage-auditor invocation

You are running for the `/spec-coverage` slash command. Walk every applicable
spec (per `spec/conventions/spec-impl-evidence.md §1` — see below) and apply
the 3 heuristics defined in your agent prompt (`.claude/agents/spec-impl-coverage-auditor.md`).

## Environment

- SPEC_COVERAGE_CONFIDENCE_FLOOR=low
- SPEC_COVERAGE_MAX_FINDINGS=200

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
