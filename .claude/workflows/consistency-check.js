// Consistency-check fan-out, migrated from the manual Agent-tool orchestration
// (orchestrator --summary-state → N× Agent → --update per STATUS → ScheduleWakeup
// loop → summary agent) to the native Workflow tool.
//
// What stays in Python: `consistency_orchestrator.py --prepare` still gathers the
// spec/plan/convention corpus and writes per-checker `_prompts/<checker>.md` +
// `_retry_state.json` (a model-free manifest). This workflow only replaces the
// fan-out + status bookkeeping + convergence that main Claude used to do by hand.
//
// Billing: every agent() here runs through the plan-metered harness sub-agent
// path (NOT `claude -p`), so it satisfies CLAUDE.md §외부 LLM 호출 정책.
//
// args (main Claude reads the small _retry_state.json and passes these — prompt
// BODIES stay on disk and are read by each checker itself, so neither main ctx
// nor this sandbox ever loads them):
//   {
//     invocations: [{ name, subagent_type, prompt_file, output_file }],
//     summary:     { subagent_type, output_file }
//   }

export const meta = {
  name: 'consistency-check',
  description: 'Run consistency checkers in parallel and converge to a BLOCK decision — replaces the bespoke orchestrator fan-out/STATUS/retry loop with native Workflow orchestration',
  phases: [
    { title: 'Checkers', detail: 'one sub-agent per enabled checker, in parallel' },
    { title: 'Summary', detail: 'aggregate to SUMMARY.md with BLOCK: YES/NO' },
  ],
}

// args is normally a JS object, but some callers/harness paths deliver it as a
// JSON string — tolerate both so the workflow doesn't silently no-op.
let A = args
if (typeof A === 'string') {
  try { A = JSON.parse(A) } catch (_e) { A = null }
}
const invocations = (A && A.invocations) || []
const summary = (A && A.summary) || null

if (!invocations.length || !summary) {
  log('consistency-check: missing args.invocations / args.summary — nothing to run')
  return { error: 'missing invocations or summary in args', checkers: [] }
}

function parseStatus(text) {
  const m = /STATUS=([a-z_]+)/.exec(text || '')
  return m ? m[1] : 'success' // a checker that wrote its file but omitted STATUS counts as success
}

phase('Checkers')
const results = await parallel(invocations.map(inv => () =>
  agent(
    `prompt_file=${inv.prompt_file}\noutput_file=${inv.output_file}`,
    { label: inv.name, phase: 'Checkers', agentType: inv.subagent_type },
  )
    .then(text => ({ name: inv.name, output_file: inv.output_file, status: parseStatus(text) }))
    .catch(() => ({ name: inv.name, output_file: inv.output_file, status: 'fatal' }))
))

// No cross-turn rate-limit auto-retry here (the bespoke ScheduleWakeup loop did
// that). For a pre-write gate run interactively this is acceptable; a checker
// left non-success is surfaced to the summary as "재시도 필요".
const checkers = results.filter(Boolean)
const succeeded = checkers.filter(c => c.status === 'success')
const unfinished = checkers.filter(c => c.status !== 'success')
log(`checkers: ${succeeded.length} success, ${unfinished.length} unfinished/fatal`)

phase('Summary')
const manifest = checkers
  .map(c => `${c.name}\t${c.status}\t${c.output_file}`)
  .join('\n')

// The summary writes SUMMARY.md itself — exactly like the legacy session_dir path
// and like the checkers' own output_file writes. All sub-agent writes here are
// subject to the SAME harness write guard (the `worktree.bgIsolation` guard, which
// blocks shared-checkout writes when the parent bg session hasn't isolated), so if
// the checkers were able to write their output_file, the summary can write too.
// Returning only a short status line keeps the full report OFF the caller's context
// (no double-loading). If the write IS blocked (e.g. parent bg session not isolated
// via EnterWorktree), the summary falls back to returning the full markdown prefixed
// with WRITE_BLOCKED, and the caller persists it — never worse than the old behavior.
const summaryReturn = await agent(
  [
    'mode=workflow', // not session_dir mode — authoritative inputs are below
    `summary_output_file=${summary.output_file}`,
    'results (name<TAB>status<TAB>output_file):',
    manifest,
    '',
    'success/fatal 인 각 checker 의 output_file 을 Read 해 통합하세요. status 가 success',
    '아닌 checker 는 "재시도 필요" 로 표기. Critical 1건이라도 있으면 상단 BLOCK: YES,',
    '없으면 BLOCK: NO.',
    '',
    '완성된 SUMMARY.md 를 summary_output_file 에 Write 하세요.',
    '- Write 성공 시: 보고서 전문을 반환하지 말고 한 줄만 반환 —',
    '  STATUS=success BLOCK=<YES|NO> PATH=<summary_output_file>',
    '- Write 차단/실패 시: 첫 줄에 WRITE_BLOCKED 만 출력하고, 이어서 SUMMARY.md',
    '  마크다운 전문을 반환하세요 (호출자가 대신 기록).',
  ].join('\n'),
  { label: 'summary', phase: 'Summary', agentType: summary.subagent_type },
)

const summaryWritten = !/WRITE_BLOCKED/.test(summaryReturn || '')
const blockMatch = /BLOCK[=:]\s*(YES|NO)/i.exec(summaryReturn || '')
return {
  summary_output: summary.output_file,
  summary_written: summaryWritten,
  // full markdown is returned only as a fallback (write blocked) for the caller to persist
  summary_markdown: summaryWritten ? null : (summaryReturn || '').replace(/^[\s\S]*?WRITE_BLOCKED[^\n]*\n?/, ''),
  summary_status: (summaryReturn || '').split('\n')[0],
  block: blockMatch ? blockMatch[1].toUpperCase() : null,
  checkers: checkers.map(c => ({ name: c.name, status: c.status })),
  unfinished: unfinished.map(c => c.name),
}
