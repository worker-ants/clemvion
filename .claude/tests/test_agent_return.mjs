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
