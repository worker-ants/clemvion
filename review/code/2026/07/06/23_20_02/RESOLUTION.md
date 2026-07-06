# RESOLUTION — mcp-client 후속 4종 리뷰(23_20_02) 처리

리뷰: `review/code/2026/07/06/23_20_02/SUMMARY.md` — 전체 위험도 **LOW**, Critical 0, WARNING 2(testing).

## 조치 항목

| SUMMARY # | 등급 | 조치 |
|---|---|---|
| WARNING 1 | testing | **해소** — `mcp-client.service.spec.ts` 에 fake-timer 테스트 2건 추가: (a) deadline abort → `TimeoutError` throw, (b) 비-timeout 실패 → 원본 에러 전파(`TimeoutError` 아님). |
| WARNING 2 | testing | **해소** — `mcp-tool-provider.spec.ts` 의 read_resource 단건 테스트를 `it.each` 4종(list_resources·read_resource·list_prompts·get_prompt)으로 확장해 `META_PHASE` 전수 검증. |
| INFO 5 | maintainability | **해소** — `redactMcpSecrets` `{8,}` 하한 근거 주석 추가. |
| INFO 10/11 | api_contract | **확인** — `grep -rn 'MCP_CONNECT_FAILED\|mcpDiagnostics\|resources/list' codebase/frontend/src` 0건 → 프론트가 code/phase 를 하드코딩 분기하지 않음(generic 렌더). MCP_TIMEOUT·신규 phase 값 추가에 breaking 없음. |
| (impl-done INFO 2) | convention | **해소** — `mcp-diagnostics.ts` 파일 헤더의 "call-phase errors[] 는 follow-up" stale 주석을 구현 반영으로 갱신. |
| INFO 1/2/3/6/7/8/9 | arch/maint/testing | follow-up 백로그(§보류) — 본 PR 필수 아님. |

## TEST 결과
- lint: 통과 (`_test_logs/lint-20260706-233321.log`)
- unit: 통과 (`_test_logs/unit-20260706-233411.log`)
- build: 통과 (`_test_logs/build-20260706-233501.log`)
- e2e: 통과 — 236 tests (`_test_logs/e2e-20260706-233635.log`)

## 보류·후속 항목
- `buildCallPhaseErrorDelta` 공통 헬퍼 추출(provider 4곳 delta 생성 중복 응집) — INFO 2.
- `errorResult` positional→options 객체 인자 + `*Delta` 판별 유니온(ISP) — INFO 1/3.
- Cafe24/Makeshop `codeForStatus` 5xx 케이스 테스트 + redaction 엣지(idempotency 등) — INFO 7/8.
- (기존 백로그) §3.3 credentials.cached_capabilities 캐시(infra).
