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

function parseStatus(text) {
  const m = /STATUS=([a-z_]+)/.exec(text || '')
  return m ? m[1] : 'success' // wrote its file but omitted STATUS → treat as success
}

// ---- Analyze -------------------------------------------------------------
phase('Analyze')
const results = await parallel(invocations.map(inv => () =>
  agent(
    `prompt_file=${inv.prompt_file}\noutput_file=${inv.output_file}`,
    { label: inv.name, phase: 'Analyze', agentType: inv.subagent_type },
  )
    .then(text => ({ name: inv.name, output_file: inv.output_file, status: parseStatus(text) }))
    .catch(() => ({ name: inv.name, output_file: inv.output_file, status: 'fatal' }))
))

const analyzers = results.filter(Boolean)
const succeeded = analyzers.filter(a => a.status === 'success')
const unfinished = analyzers.filter(a => a.status !== 'success')
log(`analyzers: ${succeeded.length} success, ${unfinished.length} unfinished/fatal`)

// ---- Summary -------------------------------------------------------------
// Workflow sub-agents RETURN text rather than writing report files (a terminal
// sub-agent's file Write is guard-blocked). So the summary RETURNS the SUMMARY.md
// markdown and the caller (main Claude, which has Write) persists it. Per-analyzer
// detail files are written by the analyzers themselves (that write is permitted).
phase('Summary')
const manifest = analyzers
  .map(a => `${a.name}\t${a.status}\t${a.output_file}`)
  .join('\n')
const branchList = branches
  .map(b => (typeof b === 'string' ? b : b && b.name) || '')
  .filter(Boolean)
  .join(', ')

const summaryMarkdown = await agent(
  [
    'mode=workflow', // not session_dir mode — authoritative inputs are below
    `base: ${base || '(unknown)'}`,
    `branches: ${branchList || '(unknown)'}`,
    '',
    'results (name<TAB>status<TAB>output_file):',
    manifest,
    '',
    'success/fatal 인 각 analyzer 의 output_file 을 Read 해 통합하세요. status 가 success',
    '아닌 analyzer 는 "재시도 필요" 로 표기. Critical 1건이라도 있으면 상단 BLOCK: YES,',
    '없으면 BLOCK: NO. 통합 순서 표·예상 conflict 표·사용자 confirm 필요 지점을 포함하세요.',
    '',
    '중요: 파일을 Write 하지 말고, 완성된 SUMMARY.md 마크다운 전문을 최종 응답 텍스트로',
    '그대로 반환하세요 (Workflow 가 호출자에게 전달, 호출자가 파일에 기록).',
  ].join('\n'),
  { label: 'summary', phase: 'Summary', agentType: summary.subagent_type },
)

return {
  summary_output: summary.output_file, // caller writes summaryMarkdown here
  summary_markdown: summaryMarkdown,
  analyzers: analyzers.map(a => ({ name: a.name, status: a.status })),
  unfinished: unfinished.map(a => a.name),
}
