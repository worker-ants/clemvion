# RESOLUTION — 메모리 백로그 그루밍 코드리뷰

대상: review/code/2026/06/05/12_57_57/SUMMARY.md (5 reviewer, Critical 0, BLOCK:NO).

## 조치
| 발견 | 조치 |
|---|---|
| W1 (database/requirement SPEC-DRIFT/performance) — listScopes OFFSET 초과 시 total=0 미문서화 | spec `17-agent-memory.md §6` 에 "페이지네이션(scopes): total 은 LIMIT 전 전체 distinct scope 수, offset 초과 시 0행→total=0 (UI 는 total 범위 내 페이지라 무해)" 명시 |
| W2 (testing) — q 필터 테스트가 result.total/items 미단언 | q 경로 mock 에 total 포함 행 반환 + result.items/total 단언 추가 |
| W3 (testing) — controller total=0 over-page page 계산 케이스 부재 | controller spec 에 total=0 → page(offset 파생)=4·totalItems 0·totalPages 0 케이스 추가 |

## 보류 (백로그)
- ORDER BY MAX(updated_at) filesort 인덱스 — 기존부터 존재(본 변경 신규 회귀 아님), `(workspace_id, scope_key, updated_at)` 인덱스 마이그레이션은 버전충돌 리스크+admin 저빈도라 백로그 유지.

## TEST 결과
(게이트 재수행 결과로 채움)
