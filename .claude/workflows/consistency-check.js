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

// Workflow sub-agents are expected to RETURN text, not write report files — a
// terminal sub-agent's file Write is guard-blocked ("return findings as text").
// So the summary RETURNS the SUMMARY.md markdown; the caller (main Claude, which
// has Write) persists it. Per-checker detail files are written by the checkers
// themselves (that write path is permitted and verified).
const summaryMarkdown = await agent(
  [
    'mode=workflow', // not session_dir mode — authoritative inputs are below
    'results (name<TAB>status<TAB>output_file):',
    manifest,
    '',
    'success/fatal 인 각 checker 의 output_file 을 Read 해 통합하세요. status 가 success',
    '아닌 checker 는 "재시도 필요" 로 표기. Critical 1건이라도 있으면 상단 BLOCK: YES,',
    '없으면 BLOCK: NO.',
    '',
    '중요: 파일을 Write 하지 말고, 완성된 SUMMARY.md 마크다운 전문을 최종 응답 텍스트로',
    '그대로 반환하세요 (Workflow 가 호출자에게 전달, 호출자가 파일에 기록).',
  ].join('\n'),
  { label: 'summary', phase: 'Summary', agentType: summary.subagent_type },
)

return {
  summary_output: summary.output_file, // caller writes summaryMarkdown here
  summary_markdown: summaryMarkdown,
  checkers: checkers.map(c => ({ name: c.name, status: c.status })),
  unfinished: unfinished.map(c => c.name),
}
