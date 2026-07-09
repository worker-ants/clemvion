# RESOLUTION — #501 resume 턴 usage-log attribution 회귀 수정

ai-review 결과 **위험도 LOW, Critical 0 / Warning 0** (전 발견사항 INFO). 따라서 차단
사유는 없으며, INFO 중 fix 를 protect·문서화하는 항목만 선택적으로 조치했다. 조치 항목은
모두 test / 주석 / 문서(CHANGELOG) 성격으로 **production 로직 델타 0** (핵심 fix 는 선행
커밋 `fbad181e2` 에서 이미 리뷰됨).

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | 반영 |
|---|---|---|---|
| #2 | Requirement | 호출부 wiring 회귀 가드 — `retry-turn.service.spec.ts` 에 `applyRetryLastTurn` 이 `buildRetryReentryState` 에 `nodeExecutionId=spawnedRow.id` 를 넘기는지, `execution-engine.service.spec.ts` 에 `handleAiResumeTurn` 이 `nodeExecutionId=nodeExec.id` 를 넘기는지 assertion 각 1건 추가 | 이번 REVIEW 커밋 |
| #10 | Documentation | `ReentryStateDriver.buildRetryReentryState` 인터페이스 JSDoc 에 `@param opts.nodeExecutionId` 목적(§4.6 attribution·persist 미대상) 설명 추가 | 이번 REVIEW 커밋 |
| #9 | Documentation | `CHANGELOG.md` 에 회귀 수정 항목 추가 (#868 유사 관측 회귀 수정과 일관성) | 이번 REVIEW 커밋 |
| #3 | Requirement | (diff 범위 밖) `information-extractor.handler.ts` 의 유사 attribution 갭(`nodeExecutionId=state.nodeId`·`workflowId` 누락)은 별도 follow-up 으로 이관 (아래 §보류·후속) | 이관 |
| #1, #4, #5, #6, #7, #8, #11 | Security/Scope/SideEffect/Maintainability/Documentation | 조치 불필요 — 정보성·이미 정합·의도된 동작·문서화된 선행결함 수정. 상세는 SUMMARY.md INFO 표 참조 | no-op |

**부수 조치(ISSUE FIX 정책)**: 핵심 fix 커밋(`fbad181e2`)에서 선행 PR(#868) 유입 사전결함
(`execution-engine.service.spec.ts` `reentryWorkflowInput` 헬퍼의 out-of-scope `service`
참조 → `ReferenceError`, HEAD 에서도 2건 실패)을 로컬 `svcMetrics` 인스턴스로 정정.

## TEST 결과

핵심 fix 커밋 직후 1회 + REVIEW 조치(test/주석/문서) 후 1회, 총 2회 전 stage 통과.

- **lint**: 통과 (`stage=lint status=PASS`)
- **unit**: 통과 — 백엔드 398 suites / 7876+ tests, 프런트 268 files, web-chat 48. 신규 회귀 테스트 3건(buildRetryReentryState 재주입 1 + wiring assertion 2) 포함 전량 green
- **build**: 통과 (`stage=build status=PASS`)
- **e2e**: 통과 — `stage=e2e status=PASS tests=247 passed` (docker compose 실 Postgres·Redis·MinIO·BullMQ, park-resume 경로 포함). REVIEW 조치는 production 로직 무변경(test/주석/문서)이나 화이트리스트 밖 `.spec.ts` 포함이라 재수행

## 보류·후속 항목

- **IE resume LLM-usage attribution 갭** (SUMMARY #3) — `information-extractor.handler.ts` 의 멀티턴 resume `llmContext` 가 `nodeExecutionId` 에 `state.nodeId`(노드 정의 id, row PK 아님)를 쓰고 `workflowId` 를 누락. 본 fix 로 `state.nodeExecutionId`/`state.workflowId` 가 이제 채워지므로 그대로 소비하도록 고치면 됨. 별도 background task 로 추적(`task_1543860b`). 본 PR 스코프 확장 불필요(reviewer 동의).
