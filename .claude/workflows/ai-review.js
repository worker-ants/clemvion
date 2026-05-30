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
// The summary sub-agent (1) Writes SUMMARY.md to summary_output_file as a best
// effort, and (2) ALWAYS returns the full merged markdown so this workflow can
// hand the caller BOTH the on-disk path AND the content.
//
// Why the caller still persists: the summary agent is the LAST agent() call, so
// its own report-file Write can be blocked by the harness terminal-write guard
// (observed: parallel reviewers — non-terminal — write their output_file fine,
// while the terminal summary write is refused). A workflow SCRIPT has no
// filesystem access, so it cannot write the file itself either. Therefore the
// reliable on-disk guarantee is the CALLER doing an idempotent Write of the
// returned summary_markdown to summary_output (see code-review-agents SKILL §3).
// This return shape removes the old failure mode where the caller skipped the
// write because summary_markdown was null on the (rarely-reached) write-success
// path: summary_markdown is now ALWAYS populated.
//
// Return contract:
//   summary_output   — absolute path the SUMMARY belongs at (caller writes here)
//   summary_markdown  — full report markdown, ALWAYS present (caller persists it)
//   summary_written   — true iff the summary agent's own in-workflow Write succeeded
//                       (caller's idempotent Write is harmless either way)
phase('Summary')
const SUMMARY_DELIM = '===SUMMARY_MARKDOWN_BELOW==='
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
    '출력 규약 (반드시 이 순서, 정확히 이 형식):',
    '1) 완성된 SUMMARY.md 를 summary_output_file 에 Write 시도하세요 (best-effort).',
    '2) 그런 다음 첫 줄에 status 헤더 한 줄을 출력 —',
    '   `STATUS=<written|write_blocked> RISK=<NONE|LOW|MEDIUM|HIGH|CRITICAL> CRITICAL=<n> WARNING=<n> PATH=<summary_output_file>`',
    '   (Write 가 성공하면 written, 차단/실패면 write_blocked)',
    `3) 둘째 줄에 정확히 \`${SUMMARY_DELIM}\` 한 줄.`,
    '4) 그 다음부터 SUMMARY.md 마크다운 전문을 그대로 출력하세요 (Write 성공 여부와 무관하게 항상 전문 포함).',
    '   — 호출자가 이 전문을 디스크에 멱등 기록하고 위험도 판정에 사용합니다.',
  ].join('\n'),
  { label: 'summary', phase: 'Summary', agentType: summary.subagent_type },
)

const raw = summaryReturn || ''
const delimIdx = raw.indexOf(SUMMARY_DELIM)
const header = (delimIdx >= 0 ? raw.slice(0, delimIdx) : raw).trim()
const body = delimIdx >= 0 ? raw.slice(delimIdx + SUMMARY_DELIM.length).replace(/^\n/, '') : raw
const statusLine = header.split('\n')[0] || ''
const summaryWritten = /STATUS=written/i.test(statusLine)
const riskMatch = /RISK=([A-Z]+)/.exec(statusLine)
const criticalMatch = /CRITICAL=(\d+)/.exec(statusLine)
const warningMatch = /WARNING=(\d+)/.exec(statusLine)
return {
  summary_output: summary.output_file,
  summary_written: summaryWritten,
  // ALWAYS the full report markdown — caller persists it to summary_output (idempotent)
  summary_markdown: body || null,
  summary_status: statusLine,
  risk: riskMatch ? riskMatch[1] : null,
  critical_count: criticalMatch ? Number(criticalMatch[1]) : null,
  warning_count: warningMatch ? Number(warningMatch[1]) : null,
  reviewers: reviewers.map(r => ({ name: r.name, status: r.status })),
  skipped,
  unfinished,
  routing: routingNote,
  router_decisions: routerDecisions,
}
