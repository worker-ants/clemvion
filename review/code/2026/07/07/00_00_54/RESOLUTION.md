# RESOLUTION — mcp-client 후속 리뷰(00_00_54) 처리

리뷰: `review/code/2026/07/07/00_00_54/SUMMARY.md` — 위험도 MEDIUM, Critical 0, WARNING 2.

## 조치 항목

| SUMMARY # | 등급 | 조치 |
|---|---|---|
| WARNING 1 | security | **해소** — `cafe24-mcp-tool-provider.ts`/`makeshop-mcp-tool-provider.ts` execute catch 의 `mcpErrorDelta.message` 를 `sanitizeMcpErrorMessage(errInfo.message)` 로 redact(외부 MCP 경로와 정책 통일). 각 provider spec 에 secret-redact 검증 테스트 1건. redactMcpSecrets 의 bare `token=` extra 패턴을 word-boundary(`\btoken`)로 확장해 space-preceded token 도 커버. |
| WARNING 2 | documentation | **해소(선행 커밋 67279fa20)** — §2.3 라인 81 "Planned" → call-phase errors[] 누적 반영. impl-done 00_00_54 Critical 과 동일 건. |
| impl-done 00_16_19 INFO 5/6 | plan hygiene | **해소** — 착수 체크리스트 실제 상태 갱신, orphan `spec-update-mcp-client-diagnostics.md`(#840 소비 완료 draft) 삭제. |
| INFO(다수) | arch/testing | follow-up 백로그(§보류) — 본 PR 필수 아님. |

## TEST 결과
- lint: 통과 (`_test_logs/lint-20260707-002534.log`)
- unit: 통과 (`_test_logs/unit-20260707-002614.log`)
- build: 통과 (`_test_logs/build-20260707-002704.log`)
- e2e: 통과 — 236 tests (`_test_logs/e2e-20260707-002844.log`)

## 보류·후속 항목
- `buildCallPhaseErrorDelta` 공통 헬퍼 추출 / `errorResult` options 객체 / `*Delta` 판별 유니온(ISP).
- Cafe24/Makeshop 5xx delta·redact idempotency·build+call 병합 통합 테스트.
- CHANGELOG Unreleased 엔트리(프로젝트 관행 시).
- (기존 백로그) §3.3 credentials.cached_capabilities 캐시(infra).
