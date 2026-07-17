2026-07-18T01:05:00Z item=SUMMARY#W1 type=code action=fix file=.claude/tools/bootstrap-session.sh note="_lock_is_dead seconds-based age, mirroring _install_throttled"
2026-07-18T01:06:00Z item=SUMMARY#W1 type=test action=add file=.claude/tests/test_bootstrap_mermaid_install.py note="2 sub-minute-grace tests (age=5s not stolen, age=40s stolen)"
2026-07-18T01:10:00Z item=SUMMARY#W1 type=vacuity-check action=revert-and-rerun result=FAIL note="age=5s test fails against pre-fix find -mmin code (AssertionError 1 != 0)"
2026-07-18T01:11:00Z item=SUMMARY#W1 type=vacuity-check action=restore-and-rerun result=PASS
2026-07-18T01:13:00Z item=SUMMARY#W10 type=code action=fix file=.claude/tools/bootstrap-session.sh note="'rmdir's' -> 'removes' comment, cross-referenced to the rm -rf note below"
2026-07-18T01:15:00Z item=SUMMARY#W7 type=code action=fix file=.claude/hooks/lint_mermaid_posttooluse.py note="wrap is_ready import in try/except, fall back to is_ready=None, guard usage in main()"
2026-07-18T01:20:00Z item=SUMMARY#W3 type=code action=fix file=.github/workflows/harness-checks.yml note="add .githooks/** to paths:"
2026-07-18T01:25:00Z item=SUMMARY#W2 type=doc action=known-limitation file=.claude/tools/bootstrap-session.sh,plan/in-progress/harness-guard-followups.md note="hung npm install, no timeout — documented not fixed"
2026-07-18T01:27:00Z item=SUMMARY#W12 type=doc action=known-limitation file=.claude/tools/bootstrap-session.sh,plan/in-progress/harness-guard-followups.md note="liveness PID reuse ABA — documented not fixed"
2026-07-18T01:35:00Z item=SUMMARY#W9 type=test action=strengthen file=.claude/tests/test_bootstrap_mermaid_install.py note="assertLessEqual(1) -> assertEqual(1) + marker existence"
2026-07-18T01:37:00Z item=SUMMARY#W11 type=doc action=fix file=.claude/tests/test_bootstrap_mermaid_install.py note="module docstring: add liveness/throttle axes summary"
2026-07-18T01:45:00Z item=SUMMARY#W13 type=test action=replace file=.claude/tests/test_mermaid_lint_ready.py note="mock os.path.isdir to exercise the isdir branch independently of the marker file"
2026-07-18T01:55:00Z item=SUMMARY#W8 type=test action=add file=.claude/tests/test_mermaid_lint_ready.py note="4 execution-based subprocess tests: PostToolUseExecutionTest x2, PreCommitExecutionTest x2"
2026-07-18T02:00:00Z item=SUMMARY#W8 type=vacuity-check action=mutate-posttooluse result=FAIL note="if is_ready is None or is_ready(tool_dir) mutant: both new tests fail, old assertIn test still passes"
2026-07-18T02:02:00Z item=SUMMARY#W8 type=vacuity-check action=mutate-precommit result=FAIL note="added ! before python3 ready-check: both new tests fail, old assertIn test still passes"
2026-07-18T02:04:00Z item=SUMMARY#W8 type=vacuity-check action=restore-both result=PASS note="git diff .githooks/pre-commit empty; lint_mermaid_posttooluse.py matches intended fix"
2026-07-18T02:08:00Z item=SUMMARY#W9 type=vacuity-check action=mutate-mkdir result=FAIL note="if false && mkdir ...: new assertEqual(1) fails (0 != 1); old assertLessEqual(1) passes vacuously on same mutant"
2026-07-18T02:10:00Z item=SUMMARY#W9 type=vacuity-check action=restore result=PASS
2026-07-18T02:15:00Z commit sha=441820b89 summary_ids=W1,W9,W10,W11,W2,W12 scope=harness-bootstrap-lock-guard
2026-07-18T02:17:00Z commit sha=e8a056fec summary_ids=W7,W8,W13 scope=harness-consumer-wiring
2026-07-18T02:19:00Z commit sha=8308515c4 summary_ids=W3 scope=harness-ci-paths
2026-07-18T02:25:00Z unittest attempt=1 status=pass total=310 baseline=304(commit d31f99a11) duration=~28s
2026-07-18T02:26:00Z vitest plan-frontmatter attempt=1 status=pass total=93
2026-07-18T02:28:00Z e2e status=skipped reason="all 6 changed files under .claude/**, .github/**, plan/** whitelist"
2026-07-18T02:30:00Z item=SUMMARY#W6 type=none action=flagged note="not present in caller's must-fix/doc-only/do-not-touch groups — left untouched, surfaced in RESOLUTION.md for next-session disposition"
