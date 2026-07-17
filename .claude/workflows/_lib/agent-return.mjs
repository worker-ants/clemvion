// Canonical report-return contract for the fan-out workflows
// (`ai-review.js` · `consistency-check.js` · `merge-coordinate.js`).
//
// ## This module is NOT imported by the workflows — it cannot be
//
// The workflow sandbox rejects both forms of module loading (measured 2026-07-17):
//   static  `import {x} from '...'`  → SyntaxError: import call expects one or two arguments
//   dynamic `await import('...')`    → Error: import() is not available in workflow scripts.
//
// So the three workflows must each carry their own copy. This file exists to make that
// duplication safe rather than pretend it away:
//   1. it is the **canonical text** — the copies are mirrors of the marked block below;
//   2. it is **unit-testable** (`node --test .claude/tests/test_agent_return.mjs`), which
//      the workflows are not (top-level `return` makes them unloadable outside the VM);
//   3. `.claude/tests/test_workflow_shared_block.py` fails the build if any copy drifts.
//
// Editing rule: change this file, then paste the marked block verbatim into all three
// workflows. The guard test tells you if you miss one. (The defect this whole contract
// fixes was itself born of a duplicated comment that drifted out of sync with reality —
// so the duplication gets a mechanical check, not a promise.)
//
// ## Why sub-agents must return their report, not just write it
//
// The harness refuses sub-agent Writes to a small set of report-like basenames. Measured
// 2026-07-17 in an `EnterWorktree`-isolated interactive session (probe workflows
// `wf_61290a15-aec` / `wf_45d76e40-507`):
//
//   BLOCKED : SUMMARY.md · summary.md · REPORT.md · findings.md
//   ALLOWED : RESOLUTION.md · cross_spec.md · notes.md · SUMMARY.txt · my-SUMMARY.md
//
// The rule is **exact basename**, independent of terminal position (a non-terminal agent
// writing SUMMARY.md is blocked; the terminal agent writing cross_spec.md succeeds).
// Refusal text: "Subagents should return findings as text, not write report files.
// Include this content in your final response instead."
//
// ⚠ Two guards exist — do not conflate them. A **bgIsolation** guard blocks *all*
// sub-agent writes when a background session's parent never isolated via the
// `EnterWorktree` tool; measuring under it hides the basename rule entirely (that
// confound produced the 2026-05-30 "filename is irrelevant" conclusion). See
// `.claude/docs/subagent-call-contract.md §7` and `orchestrator-workflow-migration.md`.
//
// Consequence: per-agent files ARE writable, but the sub-agent system prompt also tells
// agents to return findings as text — so they often skip the Write and return prose
// instead (measured: 4 of 5 checkers in one run called Write zero times). Treating the
// return as authoritative is what stops a skipped Write from silently deleting an
// agent's [CRITICAL] from the verdict.

// >>> SHARED-BLOCK: agent-return (mirrored verbatim into the 3 workflows — guard: .claude/tests/test_workflow_shared_block.py)
const DELIM = '===REPORT_MARKDOWN_BELOW==='

// Appended to every fan-out agent prompt. Overrides `prompt_file`'s "STATUS 한 줄만
// 반환" instruction, which predates the harness's return-findings-as-text behaviour.
const REPORT_RETURN_CONTRACT = [
  '',
  '출력 규약 (prompt_file 의 지시보다 **이 규약이 우선**):',
  '1) 결과를 output_file 에 Write 하세요 (best-effort — 실패해도 아래 2·3 은 반드시 수행).',
  '2) 첫 줄에 `STATUS=<success|fatal> ...` 헤더.',
  `3) 둘째 줄에 정확히 \`${DELIM}\` 한 줄, 그 다음부터 보고서 **마크다운 전문**.`,
  '   (Write 성공 여부와 무관하게 항상 포함 — 전문이 없으면 통합 SUMMARY 가 이 agent 의',
  '    Critical 을 누락해 판정이 거짓 음성이 됩니다.)',
].join('\n')

// `STATUS=x` and `STATUS: x` are both accepted — sub-agent definitions use both spellings,
// and a parser that only knew `=` fell through to the default without anyone noticing.
// No STATUS at all ⇒ the agent answered in prose instead of honouring the contract, so
// `output_file` is probably absent: that is `no_status`, NOT success. The old
// `: 'success'` default is what produced runs reporting "5/5 success" with four files
// missing — and SUMMARYs that dropped those findings from the BLOCK decision (measured
// 2026-07-10: `BLOCK: NO` while a [CRITICAL] sat unread, 3× in one task). Prose without
// the delimiter is still salvaged as the body.
function parseAgentReturn(text) {
  const raw = text || ''
  const i = raw.indexOf(DELIM)
  const header = (i >= 0 ? raw.slice(0, i) : raw).trim()
  const m = /STATUS\s*[=:]\s*([A-Za-z_]+)/.exec(header)
  const status = m ? m[1].toLowerCase() : 'no_status'
  const body = i >= 0 ? raw.slice(i + DELIM.length).replace(/^\n/, '').trim() : ''
  const markdown = body || (m ? '' : raw.trim())
  return { status, markdown }
}

// True when we hold this agent's findings — it reported success (file on disk) or handed
// us the body. Only an agent we have NOTHING from can hide a Critical.
const usable = r => r.status === 'success' || !!r.markdown

// Findings travel to the summary agent INLINE, never by path alone: a workflow script has
// no filesystem access, so handing over only paths makes an agent that skipped its Write
// invisible to the summary — precisely how a gate reports clean while a [CRITICAL] goes
// unread. Per-agent files ARE writable, so the summary persists any that are missing.
const inlineReports = rs => rs
  .filter(r => r.markdown)
  .map(r => [`----- BEGIN ${r.name} (${r.output_file}) -----`, r.markdown, `----- END ${r.name} -----`].join('\n'))
  .join('\n\n')
const needPersistList = rs => rs.filter(r => r.markdown).map(r => `${r.name}\t${r.output_file}`).join('\n')
const needReadList = rs => rs.filter(r => !r.markdown && r.status === 'success').map(r => r.output_file)
// <<< SHARED-BLOCK: agent-return

// Test-only surface. The workflows do not (and cannot) import this file; they mirror the
// block above. Exporting here is what lets `node --test` exercise the real logic.
export {
  DELIM,
  REPORT_RETURN_CONTRACT,
  parseAgentReturn,
  usable,
  inlineReports,
  needPersistList,
  needReadList,
}
