# RESOLUTION — 08_28_32

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-1       | 코드  | a6106e2f    | use-execution-events.test.ts 에 receivedAt="" + optimisticPending reconcile 통합 테스트 1건 추가 |
| W-2       | 코드  | 9d7d2f96    | plan/in-progress/spec-draft-conversation-reconcile-doc.md → plan/complete/archive/from-followup-conversation-reconcile/ 이동 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 passed)
- build : -
- e2e   : 통과 (143/143)

## 보류·후속 항목

- INFO 항목 I-1: plan/complete/fix-duplicate-user-bubble.md frontmatter status in-progress → complete. commit a6106e2f 에 포함.
- INFO 항목 I-6: execution-store.test.ts findReconcilableOptimisticIdx 테스트 팩토리 `const u` → `const makeUserItem` 변경. commit a6106e2f 에 포함.
- INFO 항목 I-4/I-5/I-9 (보안 open item): raw payload 미마스킹 / content·reason UI 노출. 기존 open item, spec/5-system/6-websocket-protocol.md §4.4 에 open item 으로 기록 완료. 본 PR 신규 취약점 아님 — 코드 수정 불필요.
