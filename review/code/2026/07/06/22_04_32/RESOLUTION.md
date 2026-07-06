# RESOLUTION — mcp-client mcpDiagnostics 재리뷰(22_04_32) 처리

리뷰: `review/code/2026/07/06/22_04_32/SUMMARY.md` — 전체 위험도 **LOW**, Critical 0, WARNING 2(testing).

## 조치 항목

| SUMMARY # | 등급 | 내용 | 조치 |
|---|---|---|---|
| WARNING 1 | testing | `TimeoutError`/`withTimeout` 전용 단위 테스트 부재 | **해소** — `codebase/backend/src/common/utils/with-timeout.spec.ts` 신설(7 케이스: resolve 전달, 타임아웃 TimeoutError reject, 메시지 포맷, non-Error 래핑, Error 원본 전파, subclass/name). |
| WARNING 2 | testing | multi-turn `mcpDiagnostics` emit 테스트 갭 | **해소** — `ai-turn-executor.spec.ts` `processMultiTurnMessage` 블록에 max_turns 종결 시 구조화 emit(카운터·serverSummaries) + MCP 미구성 omit 2 케이스 추가. |
| INFO 8 | testing | classifyMcpCall `__` 미포함 엣지 미검증 | **해소** — `mcp-diagnostics.spec.ts` 방어 케이스 추가. |
| INFO 9 | testing | 다중-connected serverCount 미검증 | **해소** — connected 2 + skipped 1 케이스 추가. |
| INFO 1 | security | errors[].message redaction | 후속 task_fa96e218 (스코프 유지). |
| INFO 3 | naming(impl-done) | ProviderBuildCtx.mcpDiagnostics vs meta.mcpDiagnostics shape 재사용 | **해소** — spec §6.2 에 두 슬롯 shape 차이 각주 추가(코드 rename 대신, churn 회피). |
| INFO 2/4/5/6/7/10-15 | 기타 | 백로그/의도된 축소/조치 불요 | SUMMARY 처분표 참조. |

> `documentation`/`user_guide_sync` reviewer output 은 harness bgIsolation write 차단으로 미기록. 본 변경은 backend 내부 진단 타입이라 user-guide 동반 갱신 대상 아님(사용자 대면 UI/문서 변경 없음). 위험도 LOW·Critical 0 로 push 차단 사유 아님.

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260706-221940.log`)
- unit: 통과 (`_test_logs/unit-20260706-221538.log`)
- build: 통과 (`_test_logs/build-20260706-221643.log`)
- e2e: 통과 — 236 tests (`_test_logs/e2e-20260706-222025.log`)

(테스트 추가 후 lint·unit·build·e2e 전 단계 재통과. 프로덕션 코드는 불변 — 테스트/spec 문서만 추가.)

## 보류·후속 항목

- `task_fa96e218` — errors[].message secret/URL redaction.
- `task_947e443e` — 11-mcp-client `## Rationale` 섹션 + INVALID_TOOL_ARGUMENTS prefix.
- call-phase errors[] 누적 — `spec-sync-mcp-client-gaps.md` 잔여.
- (백로그) openServer phase-error 분류 헬퍼 추출 / withTimeout 유틸 통합 / McpClientService TimeoutError 소비.
