# Code Review 통합 — V086 listScopes filesort 인덱스

**BLOCK: NO** — Critical 0. 4 code reviewer 전원 BLOCK:NO. e2e Flyway non-transactional 적용 + indisvalid=t 직접 확인.

## 조치(legit)
| reviewer | 발견 | 조치 |
|---|---|---|
| database/requirement | SQL 주석 "index-only scan 으로 커버" 과장(PG loose index scan 없음, visibility map/vacuum 의존) | 주석을 "heap fetch 최소화 covering 인덱스, 완전 index-only 는 vmap 최신 시 — autovacuum 의존" 으로 정확화 |
| scope/convention(중복) | plan frontmatter `spec`+`spec_impact` 동일 중복 | `spec` 키 제거(`spec_impact` 만, Gate C 정식 필드) |

## 확인(정상)
- database: 기존 `(…,created_at)` 인덱스와 중복 아님(용도 직교), CONCURRENTLY+.conf 컨벤션 일치, write 오버헤드 수용.
- side-effect: SQL 무변경 → 결과/동작 불변, 회수/evict 경로 무영향.

## 보류
- database INFO: 배포 후 `EXPLAIN ANALYZE` 로 Heap Fetches 검증·INVALID 모니터링 — 운영 체크리스트(코드 외).
- scope: rag-rerank spec_impact 동봉(#481과 동일 fix, green 게이트용) — identical 내용이라 merge 무충돌, 격리 인지.

## reviewer별 BLOCK: database NO · side-effect NO · scope NO · requirement NO
