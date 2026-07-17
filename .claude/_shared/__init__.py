"""Logic shared across harness layers that must not disagree.

Neither `.claude/hooks/**` nor `.claude/skills/**` may own this: both are *consumers*.
A rule that lives in one of them and is copied to the other is a rule that drifts — and
did (see `report_paths`).

Deliberately a third top-level package rather than a third `_lib`: `.claude/hooks/_lib`
and `.claude/skills/_lib` already shadow each other in any interpreter that imports both
(only the test process does; production hooks and orchestrators are separate processes).
Adding a third `_lib` would deepen that ambiguity. Tests load this via
`_harness.load_module_by_path`, which sidesteps package naming entirely.
"""
