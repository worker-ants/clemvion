# AI Review SUMMARY — PR #633 후속 ⑤⑦ (node.config 인덱스 + remove 이중 findById 제거)

- 일시: 2026-06-19 14:43
- branch: `claude/agent-ab5333a68e686d2b1` (base: origin/main `b8fa1b29`, PR #633 머지 후)
- 변경 성격: Flyway raw SQL 마이그레이션(GIN/expression 인덱스) + 백엔드 서비스 리팩토링(getUsages → private 헬퍼 추출) + 단위테스트 보강
- 리뷰 방식: code-review-agents fallback 평문 Agent fan-out (구현 완료 후 강제 자동 리뷰)
- reviewer 4종 실행: database / side-effect / maintainability / testing

## BLOCK 판정: NO

Critical 0건. Warning 2건은 모두 같은 턴에 fix 완료 (RESOLUTION.md 참조).

## reviewer 별 결과

| reviewer | 위험도 | 핵심 발견 | 처리 |
| --- | --- | --- | --- |
| database-reviewer | MEDIUM (Warning 1) | jsonb_path_ops GIN 은 @> containment 전용 — 직접참조 ->>'integrationId' = ... 등치 브랜치는 인덱스 가속 없음. SQL 주석이 "부분 도움"으로 과소평가. | FIXED — V099 에 직접참조용 expression B-tree 인덱스 idx_node_config_integration_id 추가 + 주석 정정 |
| side-effect-reviewer | NONE | getUsages 공개 계약·NotFound·SQL 내용·workspace scoping·캐시 broadcast 순서 모두 byte 수준 보존. 비-테스트 호출자는 controller 1곳뿐, 변경 없음. | 조치 불필요 |
| maintainability-reviewer | LOW (Info 5) | 구조적으로 올바른 리팩터. .conf 과잉 주석, queryUsageNodes 네이밍 등 INFO. | .conf 1줄 축소 fold-in. 나머지 INFO 는 기존 코드 관습 내라 비차단 |
| testing-reviewer | LOW (Warning 1) | remove() 자체의 NotFoundException 분기 단위테스트 누락 (⑦ 이후 remove-local findOne 이 유일 게이트). | FIXED — remove NotFound 단위테스트 추가 (createQueryBuilder 미호출 어서션 포함) |

## 검증 결과 (fix 반영 후)

- npx tsc --noEmit -p tsconfig.build.json: PASS
- npx jest integrations.service.spec.ts: PASS (122 tests)
- e2e (make e2e-test): 1차 PASS (35 suites / 205 tests, integration-usage-mcp.e2e-spec.ts 포함). 마이그레이션 SQL 변경(2번째 인덱스 추가) 후 재실행으로 V099 재검증 (RESOLUTION.md 참조).

## 후속

- ⑥(프론트 삭제 다이얼로그)은 별도 PR 진행 중 — 본 PR 범위 외.
- testing-reviewer 의 INFO(pg_index.indisvalid 직접 어서션, MCP no-broadcast 대칭 테스트)는 운영 위험 낮아 비차단 deferred.
