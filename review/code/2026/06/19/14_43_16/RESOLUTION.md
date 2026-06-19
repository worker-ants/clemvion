# RESOLUTION — PR #633 후속 ⑤⑦ ai-review

대상 SUMMARY: 같은 디렉토리 SUMMARY.md (BLOCK: NO). Warning 2건 fix.

## R1 — database-reviewer WARNING (MEDIUM): jsonb_path_ops 가 ->> 등치 브랜치를 가속 못함

- 진단: GIN(jsonb_path_ops) 는 @> containment 전용 연산자 클래스라 직접참조
  `(config ->> 'integrationId') = :id` 텍스트 등치 조건에는 인덱스 스캔 경로가 없다.
  최초 V099 SQL 주석은 이를 "부분 도움 정도"로 과소 표현했다.
- 조치: V099 마이그레이션에 직접참조 브랜치 전용 expression B-tree 인덱스를 추가.
  - `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_config_integration_id ON node ((config ->> 'integrationId'));`
  - 헤더 주석을 "인덱스 2종" 구조로 정정 — GIN=@> containment, B-tree=->> 등치.
    플래너가 OR 두 브랜치를 각 인덱스 BitmapOr 로 결합 가능. DOWN 절도 2 인덱스 drop 으로 갱신.
  - 두 CREATE INDEX CONCURRENTLY 는 동봉 .conf 의 executeInTransaction=false 로
    동일 비-트랜잭션 마이그레이션에서 순차 실행된다.

## R2 — testing-reviewer WARNING (LOW): remove() NotFound 단위테스트 누락

- 진단: ⑦ 리팩터 이후 remove() 의 존재검증은 remove-local findOne 단독이 담당한다
  (이전엔 getUsages→findById 가 겸함). 이 분기에 단위테스트가 없었다.
- 조치: describe('remove') 에 테스트 추가:
  - findOne→null 시 NotFoundException throw 검증 +
    nodeRepo.createQueryBuilder 가 호출되지 않음(NotFound short-circuit) 어서션.
  - 결과: integrations.service.spec.ts 121 → 122 tests, 전부 PASS.

## 부수 fold-in (maintainability INFO)

- V099 .conf 를 V095 관습대로 `executeInTransaction=false` 한 줄로 축소 (설명은 .sql 헤더 단일화).

## 검증 (fix 후)

- tsc --noEmit -p tsconfig.build.json: PASS
- jest integrations.service.spec.ts: PASS (122)
- e2e make e2e-test: 마이그레이션(2 인덱스) 적용 + integration-usage-mcp.e2e-spec.ts 재검증 (본 RESOLUTION 작성 시점 재실행).

## 비차단 deferred (INFO)

- queryUsageNodes 네이밍, getUsages JSDoc, 테스트명 PR 번호 표기 — 기존 코드베이스 관습 내. 변경 안 함.
- e2e pg_index.indisvalid 직접 어서션, MCP 차단 no-broadcast 대칭 테스트 — 운영 위험 낮아 deferred.
