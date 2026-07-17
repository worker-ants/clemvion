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

// The harness refuses sub-agent Writes to a small set of report-like basenames.
// Measured 2026-07-17 (probe workflows wf_61290a15-aec / wf_45d76e40-507):
//
//   BLOCKED : SUMMARY.md · summary.md · REPORT.md · findings.md
//   ALLOWED : RESOLUTION.md · cross_spec.md · notes.md · SUMMARY.txt · my-SUMMARY.md
//
// The rule is **exact basename**, NOT terminal-agent position — a non-terminal agent
// writing SUMMARY.md is blocked, and the terminal agent writing cross_spec.md succeeds.
// (The old comment here claimed the opposite; that mistake is what made the fake-success
// default below look safe.) The refusal text is:
//   "Subagents should return findings as text, not write report files.
//    Include this content in your final response instead."
//
// Consequence: checkers CAN write their own files, but the sub-agent system prompt also
// tells them to return findings as text — so they frequently skip the Write entirely
// (measured: Write계 0 calls in 4/5 checkers of one run) and return the report as prose.
// We therefore make every checker return its report body unconditionally, and treat the
// return — not the file — as the authoritative source.
const DELIM = '===REPORT_MARKDOWN_BELOW==='

// Accept both `STATUS=x` and `STATUS: x` — sub-agent definitions in this repo use both.
function parseAgentReturn(text) {
  const raw = text || ''
  const i = raw.indexOf(DELIM)
  const header = (i >= 0 ? raw.slice(0, i) : raw).trim()
  const m = /STATUS\s*[=:]\s*([A-Za-z_]+)/.exec(header)
  // No STATUS at all → the agent returned findings as prose instead of honouring the
  // contract. That is NOT success: `output_file` is probably absent. Defaulting this to
  // 'success' (the old behaviour) is what produced fake "5/5 success" runs whose files
  // were missing — and, worse, SUMMARYs that silently dropped a checker's [CRITICAL]
  // from the BLOCK decision.
  const status = m ? m[1].toLowerCase() : 'no_status'
  const body = i >= 0 ? raw.slice(i + DELIM.length).replace(/^\n/, '').trim() : ''
  // Salvage: delimiter-less prose from a contract-breaking agent is still its report.
  const markdown = body || (m ? '' : raw.trim())
  return { status, markdown }
}

const CHECKER_CONTRACT = [
  '',
  '출력 규약 (prompt_file 의 지시보다 **이 규약이 우선**):',
  `1) 결과를 output_file 에 Write 하세요 (best-effort — 실패해도 아래 2·3 은 반드시 수행).`,
  '2) 첫 줄에 `STATUS=<success|fatal> ...` 헤더.',
  `3) 둘째 줄에 정확히 \`${DELIM}\` 한 줄, 그 다음부터 보고서 **마크다운 전문**.`,
  '   (Write 성공 여부와 무관하게 항상 포함 — 전문이 없으면 통합 SUMMARY 가 이 checker 의',
  '    Critical 을 누락해 BLOCK 판정이 거짓 음성이 됩니다.)',
].join('\n')

phase('Checkers')
const results = await parallel(invocations.map(inv => () =>
  agent(
    `prompt_file=${inv.prompt_file}\noutput_file=${inv.output_file}${CHECKER_CONTRACT}`,
    { label: inv.name, phase: 'Checkers', agentType: inv.subagent_type },
  )
    .then(text => ({ name: inv.name, output_file: inv.output_file, ...parseAgentReturn(text) }))
    .catch(() => ({ name: inv.name, output_file: inv.output_file, status: 'fatal', markdown: '' }))
))

// No cross-turn rate-limit auto-retry here (the bespoke ScheduleWakeup loop did
// that). For a pre-write gate run interactively this is acceptable.
const checkers = results.filter(Boolean)
// "usable" = we hold this checker's findings (either it reported success — file on disk —
// or it handed us the body). Only a checker we have NOTHING from is unfinished.
const usable = c => c.status === 'success' || !!c.markdown
const recovered = checkers.filter(c => c.status !== 'success' && c.markdown)
const unfinished = checkers.filter(c => !usable(c))
log(`checkers: ${checkers.filter(usable).length}/${checkers.length} usable` +
  (recovered.length ? ` (${recovered.length} recovered from text: ${recovered.map(c => c.name).join(', ')})` : '') +
  (unfinished.length ? ` — unfinished: ${unfinished.map(c => c.name).join(', ')}` : ''))

phase('Summary')

// Findings go to the summary agent INLINE, not via disk. A workflow script has no
// filesystem access, so if we only handed over paths, a checker that skipped its Write
// would be invisible to the summary — which is exactly how a run once reported
// `BLOCK: NO` while a checker's [CRITICAL] sat unread in the journal (2026-07-10, 3×).
// Inlining makes the BLOCK decision depend on what we actually collected, not on what
// happened to land on disk.
const manifest = checkers
  .map(c => `${c.name}\t${c.status}\t${c.output_file}`)
  .join('\n')
const inlined = checkers
  .filter(c => c.markdown)
  .map(c => [`----- BEGIN ${c.name} (${c.output_file}) -----`, c.markdown, `----- END ${c.name} -----`].join('\n'))
  .join('\n\n')
const needPersist = checkers.filter(c => c.markdown).map(c => `${c.name}\t${c.output_file}`).join('\n')
const needRead = checkers.filter(c => !c.markdown && c.status === 'success').map(c => c.output_file)

// SUMMARY.md itself can NOT be written by any sub-agent (harness refuses that basename —
// see the probe results above), and this script has no FS access. So the only reliable
// on-disk guarantee is the CALLER doing an idempotent Write of summary_markdown to
// summary_output (consistency-checker SKILL §3). summary_markdown is therefore ALWAYS
// populated. Per-checker files, by contrast, ARE writable by this agent — so it persists
// any that their own checker skipped.
const SUMMARY_DELIM = '===SUMMARY_MARKDOWN_BELOW==='
const summaryReturn = await agent(
  [
    'mode=workflow', // not session_dir mode — authoritative inputs are below
    `summary_output_file=${summary.output_file}`,
    'results (name<TAB>status<TAB>output_file):',
    manifest,
    '',
    needRead.length
      ? `아래 인라인에 없는 checker 는 output_file 을 Read 해 보완하세요:\n${needRead.join('\n')}`
      : '모든 checker 결과가 아래 인라인으로 제공됩니다 — 디스크 Read 불요.',
    '',
    '## 각 checker 보고서 전문 (authoritative)',
    inlined || '(없음)',
    '',
    '## 작업',
    '1) **누락 파일 영속화**: 아래 각 checker 의 output_file 이 없으면, 위 인라인 전문을 그대로',
    '   그 경로에 Write 하세요. (checker 파일 Write 는 허용됩니다 — 하네스가 막는 것은',
    '   `SUMMARY.md` basename 뿐입니다.)',
    needPersist || '   (해당 없음)',
    '2) 위 전문을 통합해 SUMMARY 를 작성. status 가 success 가 아니어도 **전문이 있으면',
    '   정상 반영**하고(재시도 불요), 전문도 없는 checker 만 "재시도 필요" 로 표기하세요.',
    '   Critical 1건이라도 있으면 상단 BLOCK: YES, 없으면 BLOCK: NO.',
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
  // `has_report` = we hold this checker's findings (file on disk and/or body returned).
  // Only `unfinished` (no report at all) can hide a Critical from the BLOCK decision.
  checkers: checkers.map(c => ({ name: c.name, status: c.status, has_report: usable(c) })),
  // Contract-breaking agents whose body we salvaged from the return text; the summary
  // agent was asked to persist their output_file. Caller: `ls` to confirm.
  recovered: recovered.map(c => c.name),
  unfinished: unfinished.map(c => c.name),
}
