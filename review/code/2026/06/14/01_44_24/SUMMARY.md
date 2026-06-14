# Code Review 통합 보고서 — mcp-client-gaps §6.2 (외부 MCP serverSummaries)

## 전체 위험도
**LOW** — 구현 안전·범위 내. Critical 0. WARNING 3(SPEC-DRIFT 1·TESTING 1·SCOPE 1).

## Critical
없음.

## 경고 (WARNING)
| # | 카테고리 | 발견사항 | 조치 |
|---|----------|----------|------|
| 1 | SPEC-DRIFT | spec §6.2 383행 산문("외부 MCP … 별도 skipReason 도입 안 함")이 구현(skipped skipReason='error')과 상충 | FIX (spec 383행 갱신) |
| 2 | TESTING | pushMcpServerSummary 단위 테스트(undefined guard·append) 부재 | FIX |
| 3 | SCOPE | spec 파일 수정이 developer 역할 경계(내용은 상태 메모, 요구사항 변경 아님) | 수용 (구현 동반 doc-sync, 비차단) |

## 참고 (INFO) 처리
| # | 항목 | 조치 |
|---|------|------|
| 4/5 | 재사용 세션 경로 connected 중복 push 가능성 + 미검증 | FIX (integrationId dedup + 테스트) |
| 8 | pushConnectedSummary JSDoc 누락 | FIX |
| 9 | openServer JSDoc throw 계약(skipped push 후 re-throw) 미반영 | FIX |
| 10 | spec §6.2 errors[] 누적 서술 약간 불일치 | FIX (W1 과 함께) |
| 2 | inputSchema unknown 미검증(기존 코드) | 후속 이슈(범위 밖) |
| 1,3,6,7,11,12 | 테스트 픽스처 더미·SSRF 주석·status 실패 diagnostics·타입 단언·테스트명 스타일 | 일부 FIX/수용 |

## 에이전트별 위험도
requirement LOW(SPEC-DRIFT)·scope LOW(역할 경계)·side_effect LOW·testing LOW·maintainability LOW·documentation LOW·security NONE. (performance·architecture·dependency·database·concurrency·api_contract·user_guide_sync 라우터 제외)

## 라우터 결정
router 선별 — 7명(security·requirement·scope·side_effect·maintainability·testing·documentation). 진단 push 최소 오버헤드라 perf/arch/db/concurrency/api/user-docs 제외.
