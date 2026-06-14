# RESOLUTION — mcp-client-gaps §6.2 ai-review (2026-06-14/01_44_24)

RISK=LOW, Critical 0, Warning 3. 수동 조치.

## WARNING 처리
| # | 상태 | 조치 |
|---|------|------|
| 1 SPEC-DRIFT (§6.2 383행 "별도 skipReason 도입 안 함") | ✅ FIXED | 외부 MCP status/connect/list 실패는 `serverSummaries[]` 의 `skipped(skipReason='error')` 로 표면화됨을 명시(errors[] 도입 전 단일 표면). §354·§383 두 곳 갱신. |
| 2 TESTING (pushMcpServerSummary 단위 테스트) | ✅ FIXED | `mcp-diagnostics.spec.ts` 신규 — append·undefined no-op·skipped 누적 3건. |
| 3 SCOPE (spec 수정이 developer 경계) | ⏭ 수용 | 구현 동반 SPEC-DRIFT doc-sync(요구사항 변경 아님, 상태 메모) — telegram/discord PR 과 동일 패턴, 비차단. |

## INFO 처리
| # | 상태 | 조치 |
|---|------|------|
| 4/5 재사용 세션 connected 중복 push | ✅ FIXED | `pushConnectedSummary` 에 integrationId dedup guard + 재build dedup 테스트. |
| 8 pushConnectedSummary JSDoc | ✅ FIXED | 파라미터·dedup·no-op 조건 JSDoc 추가. |
| 9 openServer JSDoc throw 계약 | ✅ FIXED | "skipped push 후 re-throw(§6.2)" 로 갱신. |
| 10 spec §6.2 errors[] 서술 | ✅ FIXED | W1 과 함께 갱신. |
| 2 inputSchema unknown 미검증 | ⏭ 후속(범위 밖, 기존 코드) |
| 1,3,6,7,11,12 픽스처·SSRF 주석·status diagnostics·타입 단언·테스트명 | 수용/일부 |

## 검증
- tool-providers **218건 통과**(connected/skipped/dedup + pushMcpServerSummary 단위 3건). build·lint(0) 통과.

## 결론
Critical 0. Warning 3 해소(W1 spec·W2 테스트·W3 수용). 가치 INFO(dedup·JSDoc) 반영.
