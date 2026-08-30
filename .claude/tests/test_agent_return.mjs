// Unit tests for the canonical report-return contract.
//   node --test .claude/tests/test_agent_return.mjs
//
// The workflows mirror this logic verbatim (they cannot import — see the _lib header);
// `test_workflow_scripts.py` guards the copies against drift, and this file proves the
// logic itself. Together they give the parsing that decides BLOCK/RISK actual coverage,
// which it had none of when it was first written.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DELIM,
  REPORT_RETURN_CONTRACT,
  parseAgentReturn,
  usable,
  inlineReports,
  needPersistList,
  needReadList,
} from '../workflows/_lib/agent-return.mjs'

test('contract-honouring return: STATUS header + delimiter + body', () => {
  const r = parseAgentReturn(`STATUS=success ISSUES=2 PATH=/x/security.md\n${DELIM}\n# Report\n- finding`)
  assert.equal(r.status, 'success')
  assert.equal(r.markdown, '# Report\n- finding')
})

test('`STATUS: x` colon spelling is accepted — sub-agent definitions use both', () => {
  // A parser that only knew `STATUS=` fell through to the default and mislabelled these.
  const r = parseAgentReturn(`STATUS: success — output_file 작성 완료\n${DELIM}\n# Report`)
  assert.equal(r.status, 'success')
  assert.equal(r.markdown, '# Report')
})

test('prose with no STATUS is no_status, NOT success — and the body is salvaged', () => {
  // The regression this contract exists for: the agent answered in prose (its file is
  // probably absent). Calling that `success` is what produced "5/5 success" with four
  // files missing.
  const prose = '### 발견사항\n- **[CRITICAL]** something real'
  const r = parseAgentReturn(prose)
  assert.equal(r.status, 'no_status')
  assert.equal(r.markdown, prose, 'findings must be salvaged, not discarded')
})

test('STATUS present but no delimiter: file was written, no body to salvage', () => {
  const r = parseAgentReturn('STATUS=success ISSUES=0 PATH=/x/scope.md RESET_HINT=')
  assert.equal(r.status, 'success')
  assert.equal(r.markdown, '', 'no delimiter ⇒ nothing to persist; the file is the source')
})

test('fatal is preserved', () => {
  const r = parseAgentReturn(`STATUS=fatal prompt_file missing\n${DELIM}\n(none)`)
  assert.equal(r.status, 'fatal')
})

test('empty / null return degrades to no_status with no body', () => {
  for (const v of ['', null, undefined]) {
    const r = parseAgentReturn(v)
    assert.equal(r.status, 'no_status')
    assert.equal(r.markdown, '')
  }
})

test('status is case-insensitive', () => {
  assert.equal(parseAgentReturn('STATUS=SUCCESS').status, 'success')
})

test('usable: success OR a salvaged body — only a total blank hides findings', () => {
  assert.equal(usable({ status: 'success', markdown: '' }), true, 'wrote its file')
  assert.equal(usable({ status: 'no_status', markdown: '# body' }), true, 'body recovered')
  assert.equal(usable({ status: 'fatal', markdown: '' }), false, 'nothing at all')
  assert.equal(usable({ status: 'no_status', markdown: '' }), false)
})

test('inlineReports carries every body with attributable delimiters', () => {
  const out = inlineReports([
    { name: 'security', output_file: '/x/security.md', markdown: '# sec' },
    { name: 'scope', output_file: '/x/scope.md', markdown: '' }, // wrote its file
  ])
  assert.match(out, /BEGIN security \(\/x\/security\.md\)/)
  assert.match(out, /# sec/)
  assert.doesNotMatch(out, /scope/, 'no body ⇒ nothing to inline')
})

test('needPersistList / needReadList partition the two recovery paths', () => {
  const rs = [
    { name: 'a', output_file: '/x/a.md', markdown: '# a', status: 'no_status' }, // body → persist
    { name: 'b', output_file: '/x/b.md', markdown: '', status: 'success' },      // file → read
    { name: 'c', output_file: '/x/c.md', markdown: '', status: 'fatal' },        // neither
  ]
  assert.equal(needPersistList(rs), 'a\t/x/a.md')
  assert.deepEqual(needReadList(rs), ['/x/b.md'])
})

test('the prompt contract names the delimiter it will be parsed by', () => {
  // If these ever disagree, every agent returns a body the parser cannot find.
  assert.ok(REPORT_RETURN_CONTRACT.includes(DELIM))
})

// The contract governs **two different sinks** and used to say so only for one. Step 1
// said "결과를 output_file 에 Write" and steps 2·3 named a STATUS header + delimiter
// without saying which sink they belonged to — so agents wrote what they returned, and
// 536 artefacts under `review/**` begin with `STATUS=…` instead of their own `#` title
// (271 of them carry the delimiter too; the rest predate it). Measured 2026-08-31.
//
// These two assertions are what a mutation revealed to be missing: reverting the wording
// left all 11 prior tests green. They pin the distinction, not the prose — the wording may
// be rephrased as long as the file/return split survives.
test('step 1 tells the agent the FILE gets markdown only — no header, no delimiter', () => {
  const step1 = REPORT_RETURN_CONTRACT.split('\n').find(l => l.trim().startsWith('1)'))
  assert.ok(step1, 'contract lost its step 1')
  // The line that assigns output_file must scope it to the report body.
  const fileClause = REPORT_RETURN_CONTRACT.slice(REPORT_RETURN_CONTRACT.indexOf(step1))
  const upToStep2 = fileClause.slice(0, fileClause.indexOf('2)'))
  assert.match(
    upToStep2,
    /output_file[\s\S]*마크다운 본문만/,
    'step 1 must say the file gets the markdown body ONLY — otherwise agents mirror the return into it',
  )
  assert.match(
    upToStep2,
    /넣지 마세요/,
    'step 1 must explicitly forbid the header/delimiter in the file',
  )
})

test('steps 2 and 3 are scoped to the RETURN message, not the file', () => {
  const lines = REPORT_RETURN_CONTRACT.split('\n')
  for (const n of ['2)', '3)']) {
    const step = lines.find(l => l.trim().startsWith(n))
    assert.ok(step, `contract lost its step ${n}`)
    assert.match(
      step,
      /반환 메시지/,
      `step ${n} must name the return message as its sink — an unscoped step is what leaked the header into ${'`output_file`'}`,
    )
  }
})
