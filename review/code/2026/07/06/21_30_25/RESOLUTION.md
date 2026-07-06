# RESOLUTION — mcp-client mcpDiagnostics 타입 확장 리뷰 처리

리뷰: `review/code/2026/07/06/21_30_25/SUMMARY.md` — 전체 위험도 **LOW**, Critical 0, 실질 WARNING 1(SPEC-DRIFT).

## 조치 항목

| SUMMARY # | 등급 | 내용 | 조치 |
|---|---|---|---|
| WARNING 1 | SPEC-DRIFT | spec §6.2/§8.2 가 구현 완료 후에도 "미구현(Planned)" 서술 | **해소** — `spec/5-system/11-mcp-client.md` §6.2 구현 현황 노트 재작성, §8.1 표(initialize/tools_list·tools/call 행), §8.2 skipReason vocabulary 문단 + 3개 코드 행(MCP_CONNECT_FAILED/MCP_LIST_FAILED/MCP_TIMEOUT) 갱신, `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 예시에 serverSummaries 추가. 잔여(call-phase errors[]·§3.3 캐시)는 Planned 로 명시. 본 커밋. |
| INFO 4 | Scope | eslint --fix 부작용으로 무관한 타입 캐스트 5개 제거(`as ResumeState`·`as ConversationTurnToolCall[]`×2·`as Record<string,unknown>`×2·`as string`) | **해소** — 5개 전부 HEAD 상태로 복원, diff 를 mcpDiagnostics 변경으로 국한. 본 커밋. |
| INFO 8 | Docs | plan 문서 `TimeoutError` "McpClientService 공유" 문구가 실제 소비 범위와 미세 불일치 | **해소** — plan 문구 정정(소비는 McpToolProvider 만, McpClientService 소비는 follow-up). 본 커밋. |
| INFO 1 | Security | `mcpDiagnostics.errors[].message` 원시 에러 노출 — `sanitizeMcpErrorMessage` 에 secret/URL redaction 없음(자격증명 유출 경로 미발견) | **후속 이관** — task_fa96e218 (spawn_task) 로 defense-in-depth redaction 검토 등록. |
| INFO 2 | Requirement | call-phase(tools/call 등) 실패의 errors[] 미누적 | **의도된 범위 축소** — plan tracker 잔여 항목 + spec §6.2/§8.1 에 Planned 명시. |
| INFO 3 | Requirement | `McpErrorPhase.'initialize'` literal 미사용 | **조치 불필요** — SDK 가 connect/initialize 미분리, §8.1 vocabulary 보존 목적 유지. |
| INFO 5 | Side-effect | `TimeoutError` 를 McpClientService 는 미소비 | **후속** — plan 에 McpClientService granular 소비 follow-up 명시. 하위호환(Error·message 불변) 확인. |
| INFO 6 | Side-effect | `meta.mcpServerSummaries`→`meta.mcpDiagnostics` rename, 프런트 소비 없음 | **확인 완료** — `grep -rn mcpServerSummaries codebase/frontend` 0건, backend 잔존 참조 0건. |
| INFO 7 | Docs | 1-ai-agent §7.1 serverSummaries 생략 | **해소** — WARNING 1 과 함께 정정. |
| INFO 9 | Concurrency | 공유 accumulator 동기 push — 현재 안전, 향후 await-before-push 시 TOCTOU 잠재 | **조치 불필요** — 현재 모든 push 가 await 없이 원자적. 향후 provider 확장 시 주의(plan 기록). |
| INFO 10 | Performance | 카운터/finalize O(1) | **조치 불필요**. |

> reviewer 4종(architecture/maintainability/testing/user_guide_sync) output 파일은 harness bgIsolation write 차단으로 디스크 미기록(manifest success). 통합 SUMMARY 는 나머지 7 reviewer 실질 검토 반영. 재실행은 위험도 LOW·Critical 0 이라 push 차단 사유 아님.

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260706-214056.log`)
- unit: 통과 (`_test_logs/unit-20260706-214141.log`)
- build: 통과 (`_test_logs/build-20260706-214236.log`)
- e2e: 통과 — 236 tests (`_test_logs/e2e-20260706-214436.log`)

(cast 복원 후 lint·unit·build·e2e 전 단계 재통과.)

## 보류·후속 항목

- `task_fa96e218` — `sanitizeMcpErrorMessage` secret/URL redaction (INFO 1, defense-in-depth).
- call-phase(`tools/call`/`resources/read`/`prompts/get`) 실패의 `errors[]` 누적 — `plan/in-progress/spec-sync-mcp-client-gaps.md` 잔여 항목 (§8.1 표 spec 에 Planned 명시).
- `McpClientService` 의 `TimeoutError` granular 소비 (INFO 5).
