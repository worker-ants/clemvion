# Code Review 통합 — 메모리 백로그 그루밍 (listScopes 단일쿼리 · embeddingModel widget · B3 테스트)

**BLOCK: NO** — Critical 0. 5 reviewer(database/performance/side-effect/requirement/testing) 전원 BLOCK:NO.
대상(merge-base 7afa9ae0..HEAD): listScopes 단일쿼리, embeddingModel widget 'text'→'expression', B3 경계 테스트.
게이트: lint/unit/build/e2e(173) PASS.

## Critical
_없음._

## Warning (조치)
| # | reviewer | 발견 | 조치 |
|---|---|---|---|
| W1 | database/requirement(SPEC-DRIFT)/performance | listScopes OFFSET ≥ 전체 그룹 수 → 0행 → total=0 (기존 2쿼리는 빈 페이지에도 실제 total). 단일쿼리의 본질적 trade-off, 코드 정확, 프론트 over-page 안 함 → benign | spec 17-agent-memory §6 에 "OFFSET 초과 시 total=0" 1줄 명시(SPEC-DRIFT 닫기) |
| W2 | testing | listScopes `q` 필터 테스트가 result.total/items 미단언 | q 경로 반환값 단언 추가 |
| W3 | testing | controller spec 에 total=0 over-page page 계산 케이스 부재 | controller total=0 케이스 추가 |

## INFO (백로그 유지)
- ORDER BY MAX(updated_at) filesort (인덱스 미커버) — **기존부터 존재, 본 변경 신규 회귀 아님**. `(workspace_id, scope_key, updated_at)` 인덱스는 마이그레이션 백로그 유지.

## 확인 사항 (정상)
- COUNT(*) OVER() LIMIT 전 평가 → 정상 페이지 total 기존과 동일(database/side-effect/performance 확인).
- workspace_id 격리·q ILIKE 파라미터 바인딩·embedding 제외 유지.
- embeddingModel widget 'expression': 렌더 위젯만 변경, 기존 저장 평문값 호환(side-effect 확인).
- B3 경계 테스트(runningSummary≠undefined, budget==currentTokens) 오라클 신뢰·핀 정확(testing 확인).
- 금지 항목(마이그레이션/서비스분리/page.tsx분해) 미혼입(requirement/scope 확인).

## reviewer별 BLOCK: database NO · performance NO · side-effect NO · requirement NO · testing NO
