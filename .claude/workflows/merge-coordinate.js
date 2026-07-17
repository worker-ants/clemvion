// merge-coordinate Phase 1 (analyze → summary), migrated to the native Workflow
// tool. This covers ONLY the fan-out + aggregate-return portion:
//   Analyze (4 analyzers in parallel) → Summary (returns the report markdown).
//
// Everything interactive / side-effecting stays bespoke (main-driven), because a
// background Workflow cannot pause for the user or own git side effects:
//   - Phase 0 input normalization + confirm,
//   - Phase 2 plan confirm (AskUserQuestion on BLOCK / integration order),
//   - Phase 3 execute (git merge/rebase in an isolated worktree, the
//     merge-conflict-resolver per-conflict loop, patch-apply confirm),
//   - Phase 4 auto chain + post-merge rollback.
// See .claude/docs/orchestrator-workflow-migration.md.
//
// What stays in Python: `merge_coordinator_orchestrator.py --prepare` resolves
// PRs/branches, decides the base, builds each analyzer's `_prompts/<name>.md`,
// and writes `_retry_state.json` (a model-free manifest). This workflow replaces
// the manual fan-out → STATUS/--update → summary dance of Phase 1 only.
//
// Billing: every agent() runs through the plan-metered harness sub-agent path
// (NOT `claude -p`), satisfying CLAUDE.md §외부 LLM 호출 정책.
//
// args (main Claude reads the small _retry_state.json and passes these; prompt
// BODIES stay on disk, read by each analyzer itself):
//   {
//     invocations: [{ name, subagent_type, prompt_file, output_file }],  // 4 analyzers
//     branches:    [{ name, ... }],   // for the summary's integration-order context
//     base:        "<base branch>",
//     summary:     { subagent_type, output_file }
//   }

export const meta = {
  name: 'merge-coordinate',
  description: 'merge-coordinate Phase 1: run the 4 integration analyzers in parallel, then aggregate to a BLOCK decision — replaces the bespoke orchestrator fan-out/STATUS/retry loop. Phases 2-4 (confirm, execute, chain) stay bespoke/main-driven.',
  phases: [
    { title: 'Analyze', detail: 'one sub-agent per integration analyzer, in parallel' },
    { title: 'Summary', detail: 'integration-risk-summary returns the report markdown with BLOCK: YES/NO' },
  ],
}

// Tolerate args delivered as a JSON string (some harness paths stringify it).
let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (_e) { A = null } }

const invocations = (A && A.invocations) || []
const branches = (A && A.branches) || []
const base = (A && A.base) || ''
const summary = (A && A.summary) || null

if (!invocations.length || !summary) {
  log('merge-coordinate: missing args.invocations / args.summary — nothing to run')
  return { error: 'missing invocations or summary in args', analyzers: [] }
}

// Report-return contract — MIRROR of `.claude/workflows/_lib/agent-return.mjs`.
// The workflow sandbox cannot import (static `import` → SyntaxError; dynamic
// `import()` → "not available in workflow scripts"), so each workflow carries its own
// copy. Edit the _lib file, then paste the block verbatim here.
// `.claude/tests/test_workflow_shared_block.py` fails the build if these drift apart;
// `.claude/tests/test_agent_return.mjs` unit-tests the canonical logic.
// The measurements and rationale behind this contract live in the _lib header.

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

// ---- Analyze -------------------------------------------------------------
phase('Analyze')
const results = await parallel(invocations.map(inv => () =>
  agent(
    `prompt_file=${inv.prompt_file}\noutput_file=${inv.output_file}${REPORT_RETURN_CONTRACT}`,
    { label: inv.name, phase: 'Analyze', agentType: inv.subagent_type },
  )
    .then(text => ({ name: inv.name, output_file: inv.output_file, ...parseAgentReturn(text) }))
    .catch(() => ({ name: inv.name, output_file: inv.output_file, status: 'fatal', markdown: '' }))
))

const analyzers = results.filter(Boolean)
const recovered = analyzers.filter(a => a.status !== 'success' && a.markdown)
const unfinished = analyzers.filter(a => !usable(a))
log(`analyzers: ${analyzers.filter(usable).length}/${analyzers.length} usable` +
  (recovered.length ? ` (${recovered.length} recovered from text: ${recovered.map(a => a.name).join(', ')})` : '') +
  (unfinished.length ? ` — unfinished: ${unfinished.map(a => a.name).join(', ')}` : ''))

// ---- Summary -------------------------------------------------------------
// SUMMARY.md cannot be written by any sub-agent (the harness refuses that basename — see
// the _lib header), and this script has no FS access, so the caller does an idempotent
// Write of summary_markdown to summary_output (merge-coordinator SKILL). Per-analyzer
// files ARE writable, so the summary persists any their own analyzer skipped.
phase('Summary')
const manifest = analyzers
  .map(a => `${a.name}\t${a.status}\t${a.output_file}`)
  .join('\n')
const branchList = branches
  .map(b => (typeof b === 'string' ? b : b && b.name) || '')
  .filter(Boolean)
  .join(', ')

const SUMMARY_DELIM = '===SUMMARY_MARKDOWN_BELOW==='
const summaryReturn = await agent(
  [
    'mode=workflow', // not session_dir mode — authoritative inputs are below
    `summary_output_file=${summary.output_file}`,
    `base: ${base || '(unknown)'}`,
    `branches: ${branchList || '(unknown)'}`,
    '',
    'results (name<TAB>status<TAB>output_file):',
    manifest,
    '',
    needReadList(analyzers).length
      ? `아래 인라인에 없는 analyzer 는 output_file 을 Read 해 보완하세요:\n${needReadList(analyzers).join('\n')}`
      : '모든 analyzer 결과가 아래 인라인으로 제공됩니다 — 디스크 Read 불요.',
    '',
    '## 각 analyzer 보고서 전문 (authoritative)',
    inlineReports(analyzers) || '(없음)',
    '',
    '## 작업',
    '1) **누락 파일 영속화**: 아래 각 analyzer 의 output_file 이 없으면, 위 인라인 전문을 그대로',
    '   그 경로에 Write 하세요. (analyzer 파일 Write 는 허용됩니다 — 하네스가 막는 것은',
    '   `SUMMARY.md` basename 뿐입니다.)',
    needPersistList(analyzers) || '   (해당 없음)',
    '2) 위 전문을 통합. status 가 success 가 아니어도 **전문이 있으면 정상 반영**하고,',
    '   전문도 없는 analyzer 만 "재시도 필요" 로 표기하세요. Critical 1건이라도 있으면 상단',
    '   BLOCK: YES, 없으면 BLOCK: NO. 통합 순서 표·예상 conflict 표·사용자 confirm 필요 지점 포함.',
    '',
    '출력 규약 (반드시 이 순서, 정확히 이 형식):',
    '3) 완성된 SUMMARY.md 를 summary_output_file 에 Write 시도하세요 (best-effort — 차단이 정상).',
    '4) 첫 줄에 status 헤더 — `STATUS=<written|write_blocked> BLOCK=<YES|NO> PATH=<summary_output_file>`',
    '   (Write 성공이면 written, 차단/실패면 write_blocked).',
    `5) 둘째 줄에 정확히 \`${SUMMARY_DELIM}\` 한 줄.`,
    '6) 그 다음부터 SUMMARY.md 마크다운 전문 (Write 성공 여부와 무관하게 항상 포함).',
  ].join('\n'),
  { label: 'summary', phase: 'Summary', agentType: summary.subagent_type },
)

const raw = summaryReturn || ''
const delimIdx = raw.indexOf(SUMMARY_DELIM)
const header = (delimIdx >= 0 ? raw.slice(0, delimIdx) : raw).trim()
const body = delimIdx >= 0 ? raw.slice(delimIdx + SUMMARY_DELIM.length).replace(/^\n/, '') : raw
const statusLine = header.split('\n')[0] || ''
const summaryWritten = /STATUS=written/i.test(statusLine)
const blockMatch = /BLOCK[=:]\s*(YES|NO)/i.exec(statusLine)
return {
  summary_output: summary.output_file,
  summary_written: summaryWritten,
  // ALWAYS the full report markdown — caller persists it to summary_output (idempotent)
  summary_markdown: body || null,
  summary_status: statusLine,
  block: blockMatch ? blockMatch[1].toUpperCase() : null,
  // `has_report` = we hold this analyzer's findings. Only `unfinished` (nothing at all)
  // can hide a Critical from the integration BLOCK decision.
  analyzers: analyzers.map(a => ({ name: a.name, status: a.status, has_report: usable(a) })),
  // Contract-breaking agents whose body we salvaged; the summary was asked to persist
  // their output_file. Caller: `ls` to confirm.
  recovered: recovered.map(a => a.name),
  unfinished: unfinished.map(a => a.name),
}
