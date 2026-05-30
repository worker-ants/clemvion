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

// The summary sub-agent (1) Writes SUMMARY.md to summary_output_file (best-effort)
// and (2) ALWAYS returns the full merged markdown so this workflow can hand the
// caller BOTH the on-disk path AND the content. The summary is the LAST agent() call,
// so its own report-file Write can be blocked by the harness terminal-write guard
// (parallel checkers — non-terminal — write fine, the terminal summary write is
// refused), and a workflow SCRIPT has no filesystem access, so the reliable on-disk
// guarantee is the CALLER doing an idempotent Write of summary_markdown to
// summary_output (see consistency-checker SKILL §3). summary_markdown is therefore
// ALWAYS populated — removing the old failure mode where it was null on the
// write-success path and a skipped caller-write left SUMMARY.md absent.
const SUMMARY_DELIM = '===SUMMARY_MARKDOWN_BELOW==='
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
    '출력 규약 (반드시 이 순서, 정확히 이 형식):',
    '1) 완성된 SUMMARY.md 를 summary_output_file 에 Write 시도하세요 (best-effort).',
    '2) 첫 줄에 status 헤더 — `STATUS=<written|write_blocked> BLOCK=<YES|NO> PATH=<summary_output_file>`',
    '   (Write 성공이면 written, 차단/실패면 write_blocked).',
    `3) 둘째 줄에 정확히 \`${SUMMARY_DELIM}\` 한 줄.`,
    '4) 그 다음부터 SUMMARY.md 마크다운 전문 (Write 성공 여부와 무관하게 항상 포함).',
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
  checkers: checkers.map(c => ({ name: c.name, status: c.status })),
  unfinished: unfinished.map(c => c.name),
}
