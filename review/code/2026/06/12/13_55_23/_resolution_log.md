2026-06-12T14:30:00Z item=C1 type=false-positive action=none note=hostB64Encode/Decode typeof guard confirmed on disk L160-180
2026-06-12T14:32:00Z item=W1 type=code action=fix file=code.handler.ts note=overrideMessage for EXECUTION_MEMORY_EXCEEDED added
2026-06-12T14:33:00Z item=W2 type=code action=fix file=code.handler.ts note=parseInt replaced with Number()+isInteger strict check
2026-06-12T14:33:30Z item=W2 type=code action=test file=code.handler.spec.ts note=invalid array extended with '64abc' and '256.9'
2026-06-12T14:33:30Z item=W1 type=code action=test file=code.handler.spec.ts note=memory-limit integration test extended with message assertion
2026-06-12T14:40:00Z lint attempt=1 status=pass duration=41s
2026-06-12T14:41:00Z unit attempt=1 status=pass tests=40 duration=45s
2026-06-12T14:42:00Z commit sha=0c6413e7 message="fix(code-node): SUMMARY#W1/W2 — pin memory-exceeded message + strict int parsing"
2026-06-12T14:44:00Z e2e attempt=1 status=pass tests=188 duration=88s
