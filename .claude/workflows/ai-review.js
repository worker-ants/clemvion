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
    `prompt_file=${inv.prompt_file}\noutput_file=${inv.output_file}${REPORT_RETURN_CONTRACT}`,
    { label: inv.name, phase: 'Review', agentType: inv.subagent_type },
  )
    .then(text => ({ name: inv.name, output_file: inv.output_file, ...parseAgentReturn(text) }))
    .catch(() => ({ name: inv.name, output_file: inv.output_file, status: 'fatal', markdown: '' }))
))
const reviewers = results.filter(Boolean)
const recovered = reviewers.filter(r => r.status !== 'success' && r.markdown)
const unfinished = reviewers.filter(r => !usable(r)).map(r => r.name)
// `agents_forced` is a whitelist the router cannot override (code-review-agents SKILL).
// The Route phase already unions it into `selected`, so a miss here means a reviewer was
// selected but produced nothing — surface it rather than let the SUMMARY read "clean".
const forcedMissing = agentsForced.filter(n => !reviewers.some(r => r.name === n && usable(r)))
log(`reviewers: ${reviewers.filter(usable).length}/${reviewers.length} usable` +
  (recovered.length ? ` (${recovered.length} recovered from text: ${recovered.map(r => r.name).join(', ')})` : '') +
  (unfinished.length ? ` — unfinished: ${unfinished.join(', ')}` : '') +
  (forcedMissing.length ? ` — ⚠ FORCED MISSING: ${forcedMissing.join(', ')}` : ''))

// ---- Summary -------------------------------------------------------------
// Findings go to the summary agent INLINE, not via disk. A workflow script has no
// filesystem access, so if we only handed over paths, a reviewer that skipped its Write
// would be invisible to the summary — that is how a run can report a clean risk verdict
// while a reviewer's [CRITICAL] sits unread in the journal.
//
// SUMMARY.md itself can NOT be written by any sub-agent (the harness refuses that
// basename — see the probe results at the top of this file), and this script has no FS
// access either. So the reliable on-disk guarantee is the CALLER doing an idempotent
// Write of summary_markdown to summary_output (code-review-agents SKILL §3).
// Per-reviewer files, by contrast, ARE writable by this agent — so it persists any that
// their own reviewer skipped.
//
// Return contract:
//   summary_output   — absolute path the SUMMARY belongs at (caller writes here)
//   summary_markdown  — full report markdown, ALWAYS present (caller persists it)
//   summary_written   — true iff the summary agent's own in-workflow Write succeeded
//                       (expected false — caller's idempotent Write is the real path)
phase('Summary')
const SUMMARY_DELIM = '===SUMMARY_MARKDOWN_BELOW==='
const ranManifest = reviewers.map(r => `${r.name}\t${r.status}\t${r.output_file}`).join('\n')
const inlined = inlineReports(reviewers)
const needPersist = needPersistList(reviewers)
const needRead = needReadList(reviewers)
const summaryReturn = await agent(
  [
    'mode=workflow',
    `summary_output_file=${summary.output_file}`,
    'ran (name<TAB>status<TAB>output_file):',
    ranManifest,
    '',
    `skipped (router 제외): ${skipped.join(', ') || '(none)'}`,
    `forced (router_safety): ${agentsForced.join(', ') || '(none)'}`,
    forcedMissing.length
      ? `⚠ forced 인데 결과 없음 (SUMMARY 에 반드시 명시): ${forcedMissing.join(', ')}`
      : 'forced 전원 결과 확보됨.',
    `routing: ${routingNote}`,
    '',
    needRead.length
      ? `아래 인라인에 없는 reviewer 는 output_file 을 Read 해 보완하세요:\n${needRead.join('\n')}`
      : '모든 reviewer 결과가 아래 인라인으로 제공됩니다 — 디스크 Read 불요.',
    '',
    '## 각 reviewer 보고서 전문 (authoritative)',
    inlined || '(없음)',
    '',
    '## 작업',
    '1) **누락 파일 영속화**: 아래 각 reviewer 의 output_file 이 없으면, 위 인라인 전문을 그대로',
    '   그 경로에 Write 하세요. (reviewer 파일 Write 는 허용됩니다 — 하네스가 막는 것은',
    '   `SUMMARY.md` basename 뿐입니다.)',
    needPersist || '   (해당 없음)',
    '2) 위 전문을 통합. status 가 success 가 아니어도 **전문이 있으면 정상 반영**하고,',
    '   전문도 없는 reviewer 만 "재시도 필요" 로 표기하세요.',
    '3) 끝에 "라우터 결정" 섹션 포함(실행/제외/강제). forced 인데 결과 없는 항목이 있으면',
    '   그 사실을 SUMMARY 상단 위험도 근처에 명시하세요 — 강제 화이트리스트 미이행은',
    '   "clean" 으로 보이면 안 됩니다.',
    '',
    '출력 규약 (반드시 이 순서, 정확히 이 형식):',
    '4) 완성된 SUMMARY.md 를 summary_output_file 에 Write 시도하세요 (best-effort — 차단이 정상).',
    '5) 그런 다음 첫 줄에 status 헤더 한 줄을 출력 —',
    '   `STATUS=<written|write_blocked> RISK=<NONE|LOW|MEDIUM|HIGH|CRITICAL> CRITICAL=<n> WARNING=<n> PATH=<summary_output_file>`',
    '   (Write 가 성공하면 written, 차단/실패면 write_blocked)',
    `6) 둘째 줄에 정확히 \`${SUMMARY_DELIM}\` 한 줄.`,
    '7) 그 다음부터 SUMMARY.md 마크다운 전문을 그대로 출력하세요 (Write 성공 여부와 무관하게 항상 전문 포함).',
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
  // `has_report` = we hold this reviewer's findings (file on disk and/or body returned).
  // Only `unfinished` (no report at all) can hide a Critical from the risk verdict.
  reviewers: reviewers.map(r => ({ name: r.name, status: r.status, has_report: usable(r) })),
  // Contract-breaking agents whose body we salvaged from the return text; the summary
  // agent was asked to persist their output_file. Caller: `ls` to confirm.
  recovered: recovered.map(r => r.name),
  skipped,
  unfinished,
  // Non-empty ⇒ a router_safety whitelist reviewer produced nothing. The caller MUST NOT
  // treat this run as complete coverage (code-review-agents SKILL §agents_forced).
  forced_missing: forcedMissing,
  routing: routingNote,
  router_decisions: routerDecisions,
}
