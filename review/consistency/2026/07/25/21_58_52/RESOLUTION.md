# RESOLUTION — impl-done BLOCK 해소

**BLOCK: YES → 해소.** Critical 1건이 이 PR 의 핵심 계약이 **엔드투엔드로 성립하지 않음**을
잡았다.

## Critical — 배선이 엔진까지 닿지 않았다

client 에서 `AbortError` 를 재throw 하도록 고쳤지만, **handler 의 catch 가 다시 삼켰다**.
`mapClientErrorToOutput` 에 AbortError 분기가 없어 `{code:'*_TRANSPORT_FAILED', port:'error'}`
를 **정상 반환**했고, throw 가 아니므로 엔진 `executeNode` 의 `isAbortError` catch 가 영영
도달하지 못했다 — 노드는 `failed` 로 기록되고 `execution.node.cancelled` 도 나지 않는다.

**무수정 프로브로 실증**: handler 가 `MAKESHOP_TRANSPORT_FAILED` 를 반환. 즉 직전 커밋의 client
수정은 그 자체로는 **무의미**했다.

조치: 양 handler 의 inner/outer catch 에 `database-query.handler.ts` 와 동형인 재throw 가드.
수정 후 프로브 재실행 → `handler threw = AbortError`.

### 왜 내 테스트가 이걸 못 봤나

앞서 넣은 "abortSignal forwarding" 테스트는 **signal 이 전달되는지만** 봤다. client 가
`AbortError` 로 reject 했을 때 handler 가 어떻게 반응하는지는 보지 않았다 — 그리고 그 축은
client 스위트에서도 보이지 않는다(client 는 자기 몫을 정확히 한다). 두 계층 사이의 계약이라
양쪽 어느 스위트에도 안 잡히는 자리였다.

신설: propagate 테스트 + **경계**(일반 transport 실패는 여전히 error 포트로 매핑).
mut: 가드 제거 → **2 failed**.

## WARNING / INFO

| # | 조치 |
|---|---|
| W1 | plan frontmatter `worktree: (unstarted)` → `node-cancel-signal-b4d1` |
| INFO1 | §6 표 승격 시 **handler propagate 까지 확인**하도록 위임 문서에 조건 명시 — 그 확인 없이 `✓` 를 달면 미충족 계약을 "구현됨" 으로 기록하는 새 SPEC-DRIFT 가 된다 |
| INFO2 | cafe24 fixture path 잔존 — 재확인 결과 이미 0건(직전 통일 작업에 포함돼 있었다) |
| 권고6 | 기존 `✓` 행(`http-request`·`text-classifier`)도 §5.1 propagate 이 검증된 적 없다 → planner 위임에 추가 |

## TEST 결과

- lint: **PASS** / unit: **PASS**(14) / integration 노드 **345 passed**
- build: **PASS** / e2e: **통과**(259)
