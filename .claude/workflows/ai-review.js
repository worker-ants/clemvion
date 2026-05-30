// ai-review review-portion, migrated to the native Workflow tool.
//
// Scope: this covers ROUTE → REVIEW → SUMMARY only. The §6 auto follow-up
// (resolution-applier: edits code, commits, runs e2e) and the /loop cross-turn
// rate-limit recovery stay bespoke — they are side-effecting / interactive and
// do not fit Workflow's "agents return text in the background" model.
// See .claude/docs/orchestrator-workflow-migration.md.
//
// What stays in Python: `code_review_orchestrator.py --prepare` gathers the diff
// corpus and writes per-reviewer `_prompts/<name>.md`, the router prompt, and
// `_retry_state.json` (a model-free manifest). This workflow replaces the manual
// router-call → apply-routing → fan-out → STATUS/--update → summary dance.
//
// Billing: every agent() runs through the plan-metered harness sub-agent path
// (NOT `claude -p`), satisfying CLAUDE.md §외부 LLM 호출 정책.
//
// args (main Claude reads the small _retry_state.json and passes these; prompt
// BODIES stay on disk, read by each sub-agent itself):
//   {
//     invocations:    [{ name, subagent_type, prompt_file, output_file }],  // all candidates
//     router:         { subagent_type, prompt_file, output_file } | null,
//     routing_status: "pending" | "skipped",
//     agents_forced:  [name, ...],          // router cannot drop these
//     summary:        { subagent_type, output_file }
//   }

export const meta = {
  name: 'ai-review',
  description: 'Route → review (parallel reviewers) → summary, via native Workflow. Replaces the manual router/fan-out/STATUS/retry orchestration. resolution-applier follow-up and /loop stay bespoke.',
  phases: [
    { title: 'Route', detail: 'review-router selects a reviewer subset (skipped on --route=all / explicit agents)' },
    { title: 'Review', detail: 'one sub-agent per selected reviewer, in parallel' },
    { title: 'Summary', detail: 'code-review-summary returns the merged report markdown' },
  ],
}

// Tolerate args delivered as a JSON string (some harness paths stringify it).
let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (_e) { A = null } }

const invocations = (A && A.invocations) || []
const router = (A && A.router) || null
const routingStatus = (A && A.routing_status) || 'skipped'
const agentsForced = (A && A.agents_forced) || []
const summary = (A && A.summary) || null

if (!invocations.length || !summary) {
  log('ai-review: missing args.invocations / args.summary — nothing to run')
  return { error: 'missing invocations or summary in args', reviewers: [] }
}

const ROUTING_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['decisions'],
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['name', 'selected'],
        properties: {
          name: { type: 'string' },
          selected: { type: 'boolean' },
          reason: { type: 'string' },
        },
      },
    },
  },
}

function parseStatus(text) {
  const m = /STATUS=([a-z_]+)/.exec(text || '')
  return m ? m[1] : 'success'
}

// ---- Route ---------------------------------------------------------------
phase('Route')
let selected
let routerDecisions = null
let routingNote
if (routingStatus === 'pending' && router && router.prompt_file) {
  const decision = await agent(
    `prompt_file=${router.prompt_file}\nmode=workflow — 파일을 Write 하지 말고 결정을 structured output 으로 반환하세요.`,
    { label: 'router', phase: 'Route', agentType: router.subagent_type, schema: ROUTING_SCHEMA },
  ).catch(() => null)
  if (decision && Array.isArray(decision.decisions)) {
    routerDecisions = decision.decisions
    const picked = decision.decisions.filter(d => d.selected).map(d => d.name)
    selected = new Set([...agentsForced, ...picked])
    routingNote = 'done'
  } else {
    // Router failed → fall back to all reviewers (router_safety fail-open).
    selected = new Set(invocations.map(i => i.name))
    routingNote = 'fallback-all'
    log('router failed — falling back to all reviewers')
  }
} else {
  selected = new Set(invocations.map(i => i.name))
  routingNote = routingStatus === 'skipped' ? 'skipped' : 'all'
}

const toRun = invocations.filter(i => selected.has(i.name))
const skipped = invocations.filter(i => !selected.has(i.name)).map(i => i.name)

if (!toRun.length) {
  return { error: 'no applicable reviewer for this change', skipped, reviewers: [], routing: routingNote }
}
log(`routing=${routingNote}: ${toRun.length} reviewers run, ${skipped.length} skipped`)

// ---- Review --------------------------------------------------------------
phase('Review')
const results = await parallel(toRun.map(inv => () =>
  agent(
    `prompt_file=${inv.prompt_file}\noutput_file=${inv.output_file}`,
    { label: inv.name, phase: 'Review', agentType: inv.subagent_type },
  )
    .then(text => ({ name: inv.name, output_file: inv.output_file, status: parseStatus(text) }))
    .catch(() => ({ name: inv.name, output_file: inv.output_file, status: 'fatal' }))
))
const reviewers = results.filter(Boolean)
const unfinished = reviewers.filter(r => r.status !== 'success').map(r => r.name)

// ---- Summary -------------------------------------------------------------
// The summary writes SUMMARY.md itself — exactly like the legacy session_dir path
// and like the reviewers' own output_file writes. Every sub-agent write here is
// subject to the SAME harness write guard (`worktree.bgIsolation`, which blocks
// shared-checkout writes when the parent bg session hasn't isolated), so if the
// reviewers wrote their output_file, the summary can write too. Returning only a
// short status line keeps the full merged report OFF the caller's context (no
// double-loading). If the write IS blocked (e.g. parent bg session not isolated via
// EnterWorktree), the summary falls back to returning the full markdown prefixed
// with WRITE_BLOCKED and the caller persists it — never worse than the old behavior.
phase('Summary')
const ranManifest = reviewers.map(r => `${r.name}\t${r.status}\t${r.output_file}`).join('\n')
const summaryReturn = await agent(
  [
    'mode=workflow',
    `summary_output_file=${summary.output_file}`,
    'ran (name<TAB>status<TAB>output_file):',
    ranManifest,
    '',
    `skipped (router 제외): ${skipped.join(', ') || '(none)'}`,
    `forced (router_safety): ${agentsForced.join(', ') || '(none)'}`,
    `routing: ${routingNote}`,
    '',
    'success/fatal 인 각 reviewer 의 output_file 을 Read 해 통합하세요. success 아닌',
    'reviewer 는 "재시도 필요". 끝에 "라우터 결정" 섹션 포함(실행/제외/강제).',
    '',
    '완성된 SUMMARY.md 를 summary_output_file 에 Write 하세요.',
    '- Write 성공 시: 보고서 전문을 반환하지 말고 한 줄만 반환 —',
    '  STATUS=success RISK=<NONE|LOW|MEDIUM|HIGH|CRITICAL> CRITICAL=<n> WARNING=<n> PATH=<summary_output_file>',
    '- Write 차단/실패 시: 첫 줄에 WRITE_BLOCKED 만 출력하고, 이어서 SUMMARY.md',
    '  마크다운 전문을 반환하세요 (호출자가 대신 기록).',
  ].join('\n'),
  { label: 'summary', phase: 'Summary', agentType: summary.subagent_type },
)

const summaryWritten = !/WRITE_BLOCKED/.test(summaryReturn || '')
const riskMatch = /RISK=([A-Z]+)/.exec(summaryReturn || '')
const criticalMatch = /CRITICAL=(\d+)/.exec(summaryReturn || '')
const warningMatch = /WARNING=(\d+)/.exec(summaryReturn || '')
return {
  summary_output: summary.output_file,
  summary_written: summaryWritten,
  // full markdown is returned only as a fallback (write blocked) for the caller to persist
  summary_markdown: summaryWritten ? null : (summaryReturn || '').replace(/^[\s\S]*?WRITE_BLOCKED[^\n]*\n?/, ''),
  summary_status: (summaryReturn || '').split('\n')[0],
  risk: riskMatch ? riskMatch[1] : null,
  critical_count: criticalMatch ? Number(criticalMatch[1]) : null,
  warning_count: warningMatch ? Number(warningMatch[1]) : null,
  reviewers: reviewers.map(r => ({ name: r.name, status: r.status })),
  skipped,
  unfinished,
  routing: routingNote,
  router_decisions: routerDecisions,
}
