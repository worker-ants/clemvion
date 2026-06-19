# Database Review — V099 GIN index + getUsages refactor

Reviewer: database-reviewer sub-agent
Change: V099__node_config_gin_index.sql/.conf + IntegrationsService.queryUsageNodes helper

---

## 발견사항

### [WARNING] jsonb_path_ops 는 `->>` 등치 조건을 인덱스로 가속하지 못한다

- **위치**: `codebase/backend/migrations/V099__node_config_gin_index.sql` 전체; `integrations.service.ts` queryUsageNodes 내 `n.config ->> 'integrationId' = :integrationId` 조건
- **상세**:
  `jsonb_path_ops` 연산자 클래스는 `@>` (containment) 연산자만 지원한다. PostgreSQL 문서에 명시된 바와 같이, `->>` 텍스트 추출 + `= 'value'` 등치 비교는 `jsonb_path_ops` GIN 인덱스의 스캔 경로가 전혀 없다. 플래너는 해당 조건에 대해 이 인덱스를 사용하지 않고 seq scan(또는 다른 인덱스)으로 fallback한다.
  마이그레이션 SQL 주석 자체도 이 사실을 "직접참조의 `->>` 등치 조건에는 부분 도움 정도다" 라고 기술하고 있으나, 실제로는 "부분 도움"이 아니라 "전혀 도움 없음"이다. 이 구분이 운영 성능 기대치에 오해를 남긴다.
  `jsonb_ops`(기본 연산자 클래스)였다면 `@>` 와 `->>` 양쪽 모두 커버 가능하나, `jsonb_path_ops` 보다 인덱스가 크고 containment 룩업이 느리다는 트레이드오프가 있다.
  현재 쿼리는 두 조건을 `OR` 로 묶으므로 플래너는 BitmapOr(GIN idx scan for `@>`, seq scan / expression idx scan for `->>`) 형태로 처리하거나 전체를 seq scan으로 처리할 수 있다. `node` 테이블이 크면 `->>` 브랜치에 대한 성능 보호가 없는 상태다.
- **제안**:
  두 가지 옵션 중 하나를 택한다.
  1. **별도 expression B-tree 인덱스 추가** (권장): `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_config_integration_id ON node ((config ->> 'integrationId'));` 를 같은 V099 또는 V100으로 추가한다. 이렇게 하면 `->>` 등치는 B-tree, `@>` containment는 GIN이 각각 담당하여 BitmapOr 플랜이 두 경로 모두 인덱스를 활용한다.
  2. **jsonb_ops 로 교체**: GIN을 `jsonb_ops` 로 변경하면 단일 인덱스로 두 조건 모두 지원되나, 인덱스 크기가 커지고 containment 룩업이 상대적으로 느려진다. `node` 테이블에서 `->>` 직접참조 케이스가 `@>` MCP참조보다 훨씬 많다면 이 옵션도 합리적이다.
  현재 주석의 "부분 도움 정도" 문구는 "이 인덱스는 직접참조 조건에 효과 없음 — 별도 expression 인덱스 필요" 로 정정해야 한다.

---

### [INFO] .conf 파일 형식이 V047/V095 와 소폭 다르나 기능 동일

- **위치**: `codebase/backend/migrations/V099__node_config_gin_index.conf`
- **상세**:
  V047 `.conf`는 주석 2줄 + `executeInTransaction=false`, V095 `.conf`는 주석 없이 `executeInTransaction=false` 한 줄. V099 `.conf`는 V047과 동일하게 주석 2줄 + `executeInTransaction=false`를 포함한다. 세 파일 모두 Flyway가 파싱하는 실제 키는 `executeInTransaction=false` 하나이므로 기능 차이는 없다. 프로젝트 내 일관성은 허용 범위 내다.
- **제안**: 변경 불필요. 참고 정보로만 기록.

---

### [INFO] 마이그레이션 번호(V099) — 중복 없음, 네이밍 규약 준수

- **위치**: `codebase/backend/migrations/V099__node_config_gin_index.sql`
- **상세**:
  기존 파일은 V090~V098까지 존재하고 V099는 이번 신규 파일이 유일하다. 이중 언더스코어(`__`) 구분, 소문자 snake_case 설명 부분 모두 프로젝트 기존 관례와 일치한다.
- **제안**: 변경 불필요.

---

### [INFO] CONCURRENTLY 안전성 — IF NOT EXISTS + executeInTransaction=false + DOWN 주석 모두 충족

- **위치**: `V099__node_config_gin_index.sql` 21번 줄, `.conf` 파일
- **상세**:
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS`는 멱등성을 보장한다(이미 존재하는 인덱스에 대해 오류 없이 noop). `executeInTransaction=false`는 CONCURRENTLY의 필수 요구사항(트랜잭션 블록 밖 실행)을 충족한다. 실패 시 INVALID 인덱스 잔존 가능성 및 `DROP INDEX` 후 재시도 방법이 주석으로 명시되어 있다. DOWN 절도 `DROP INDEX CONCURRENTLY IF EXISTS` 형태로 올바르게 작성되었다. V095 대비 동일한 패턴을 따른다.
- **제안**: 변경 불필요.

---

### [INFO] 쓰기 증폭(write amplification) — 낮음, 허용 가능

- **위치**: `V099__node_config_gin_index.sql`
- **상세**:
  GIN 인덱스는 B-tree 대비 쓰기 비용이 높으나, `node` 테이블의 `config` 컬럼은 노드 생성/수정 시에만 변경된다. 워크플로 노드는 실행 중 config가 바뀌지 않는 구조이므로 핫 경로 INSERT/UPDATE 빈도가 낮다. GIN에 따른 쓰기 증폭은 허용 가능한 수준이다. fastupdate(GIN 기본 활성) 덕분에 소규모 쓰기는 pending list에 배치되어 실제 즉시 비용도 완화된다.
- **제안**: 변경 불필요. 향후 `node` 테이블이 대용량 INSERT 패턴으로 바뀔 경우 `WITH (fastupdate=on)` 명시 또는 VACUUM 주기 조정 재검토.

---

### [INFO] queryUsageNodes 리팩터 — DB 관점 영향 없음

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts`, `remove()` 메서드 및 `queryUsageNodes` 헬퍼 추출
- **상세**:
  `remove()`가 `getUsages()` 대신 `queryUsageNodes()`를 직접 호출함으로써 통합 행 중복 조회(findById)를 제거한다. 이는 쿼리 수를 1회 줄이는 올바른 최적화다. 파라미터화된 쿼리(TypeORM QueryBuilder + named parameter) 사용으로 SQL 인젝션 위험 없음. N+1 문제 없음 — 단일 JOIN 쿼리로 workflow+node를 한 번에 가져온 뒤 애플리케이션 레이어에서 Map 그루핑. 트랜잭션 필요성: `remove()`는 삭제 직전 사용처 확인 용도이므로 읽기 전용 헬퍼가 트랜잭션 밖에 있어도 정합성 문제 없음.
- **제안**: 변경 불필요.

---

## 요약

V099 마이그레이션의 핵심 목적인 `@>` containment 쿼리 가속은 `jsonb_path_ops` GIN 인덱스로 올바르게 달성된다. CONCURRENTLY + `executeInTransaction=false` + 멱등 `IF NOT EXISTS` + DOWN 주석의 조합은 프로젝트 선행 마이그레이션(V047, V095)과 동일한 안전 패턴을 따르며 무중단 배포 요건을 충족한다. 그러나 직접참조 경로(`config ->> 'integrationId' = :integrationId`)는 `jsonb_path_ops` GIN의 지원 연산자 범위 밖이므로 이 조건에 대해서는 인덱스 가속이 전혀 없다. 현재 사용 빈도("관리 UI 조회, 빈도 낮음")를 감안하면 즉각적인 장애 위험은 아니나, 노드 수 증가 시 `->>` 브랜치가 seq scan으로 처리되는 성능 공백이 남는다. 별도 expression B-tree 인덱스(`(config ->> 'integrationId')`) 추가 또는 마이그레이션 주석 정정이 권장된다. queryUsageNodes 헬퍼 추출은 DB 관점에서 올바른 최적화다.

---

## 위험도

**MEDIUM**

주된 근거: `jsonb_path_ops` 가 `->>` 등치 조건을 커버하지 못한다는 사실이 마이그레이션 주석에서 과소평가("부분 도움")되어 있으며, 해당 브랜치에 대한 인덱스 보호가 실제로는 부재한다. 즉각 서비스 장애는 아니나, `node` 테이블 성장 시 직접참조 조회가 full seq scan으로 처리되는 성능 회귀 위험이 존재한다.

---

**Verdict**: WARNING — `->>` 브랜치용 별도 expression B-tree 인덱스 추가 또는 `jsonb_ops` 전환 중 하나를 선택하여 두 조회 경로 모두 인덱스 보호를 확보할 것을 권장한다.
