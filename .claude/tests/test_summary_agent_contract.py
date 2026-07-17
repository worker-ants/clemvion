"""The summary agent definitions must match what the workflows actually send them.

These three definitions are **system prompts read at runtime**, not commentary. When they
drift from `.claude/workflows/*.js`, the agent is actively taught the wrong model:

  - Until 2026-07-17 all three said the harness blocks their write "because you are the
    workflow's *terminal* sub-agent (parallel reviewers' non-terminal writes pass)".
    Probes refuted that — the block is an exact-basename rule and terminal position is
    irrelevant (`subagent-call-contract.md §7`). The refuted mechanism had already been
    copy-pasted into 7 files.
  - Worse, PR #962 started asking these same agents to **persist missing per-agent
    files**, while their own definition told them terminal writes get refused — a direct
    contradiction that invites them to skip the persist step.

So the contract is pinned here rather than trusted to stay in sync.
"""

from __future__ import annotations

import unittest

from _harness import REPO_ROOT

CLAUDE = REPO_ROOT / ".claude"
AGENTS = CLAUDE / "agents"
WORKFLOWS = CLAUDE / "workflows"

PAIRS = [
    ("code-review-summary.md", "ai-review.js", "reviewer"),
    ("consistency-summary.md", "consistency-check.js", "checker"),
    ("integration-risk-summary.md", "merge-coordinate.js", "analyzer"),
]

# Every file the refuted explanation was copy-pasted into. The mechanism was wrong in all
# of them; pinning only the three summary definitions would leave the other five free to
# re-introduce it (and `.claude/commands/**` had to be added to harness-checks.yml paths
# for a lone edit there to even trigger this suite).
NO_TERMINAL_MISATTRIBUTION = [
    CLAUDE / "agents" / "code-review-summary.md",
    CLAUDE / "agents" / "consistency-summary.md",
    CLAUDE / "agents" / "integration-risk-summary.md",
    CLAUDE / "agents" / "review-router.md",
    CLAUDE / "commands" / "ai-review.md",
    CLAUDE / "commands" / "consistency-check.md",
    CLAUDE / "commands" / "merge-coordinate.md",
    CLAUDE / "skills" / "merge-coordinator" / "SKILL.md",
]


class SummaryAgentContractTest(unittest.TestCase):
    def _agent(self, name: str) -> str:
        return (AGENTS / name).read_text(encoding="utf-8")

    def test_no_file_still_blames_terminal_position(self):
        # The refuted mechanism. Its shape: "terminal 이라서 (non-terminal 은 통과)".
        for path in NO_TERMINAL_MISATTRIBUTION:
            with self.subTest(file=path.name):
                text = path.read_text(encoding="utf-8")
                self.assertNotIn(
                    "non-terminal",
                    text,
                    f"{path} still explains the write block by terminal position — refuted "
                    f"2026-07-17 (the rule is exact basename; see subagent-call-contract.md §7)",
                )
                self.assertNotIn(
                    "terminal summary write",
                    text,
                    f"{path} still carries the refuted 'terminal summary write is refused' claim",
                )

    def test_every_definition_states_the_basename_rule(self):
        # An agent that only knows "writes may be blocked" cannot tell which of its own
        # writes are safe — and these definitions now ask for per-agent file writes.
        for agent, _wf, _kind in PAIRS:
            with self.subTest(agent=agent):
                text = self._agent(agent)
                self.assertIn("basename", text, f"{agent} must name the actual rule")

    def test_every_definition_tells_the_agent_to_persist_missing_files(self):
        # The workflows hand these agents inline report bodies and ask them to write any
        # file its own producer skipped. A definition that omits this (or worse, implies
        # its writes are blocked) makes the agent drop the audit trail.
        for agent, _wf, _kind in PAIRS:
            with self.subTest(agent=agent):
                text = self._agent(agent)
                self.assertIn(
                    "누락 파일 영속화", text, f"{agent} lost the persist-missing-reports step"
                )
                self.assertIn(
                    "인라인", text, f"{agent} must treat the inlined report bodies as authoritative"
                )

    def test_every_definition_flags_unobtained_findings_as_a_false_negative(self):
        # The safety line that keeps a summary from reading "clean" when a reviewer's
        # findings were never obtained — the same false-negative class the forced-coverage
        # gate closes, but at the summary layer. Unpinned, it is one edit from vanishing.
        for agent, _wf, _kind in PAIRS:
            with self.subTest(agent=agent):
                text = self._agent(agent)
                self.assertIn(
                    "거짓 음성",
                    text,
                    f"{agent} lost the instruction to surface unobtained findings rather than "
                    f"report clean",
                )

    def test_workflows_actually_send_what_the_definitions_expect(self):
        # Pin the direction that matters: if a workflow stops inlining bodies or stops
        # asking for persistence, these definitions become the stale side.
        for _agent, wf, _kind in PAIRS:
            with self.subTest(workflow=wf):
                src = (WORKFLOWS / wf).read_text(encoding="utf-8")
                self.assertIn(
                    "누락 파일 영속화", src, f"{wf} no longer asks the summary agent to persist"
                )
                self.assertIn(
                    "inlineReports", src, f"{wf} no longer inlines report bodies to the summary"
                )


if __name__ == "__main__":
    unittest.main()
