# 데이터베이스(Database) 리뷰 결과

## 발견사항

### DB 관련 코드 식별

변경된 파일 중 실제 DB 쿼리를 수행하는 파일은 다음이다.

- `codebase/backend/src/modules/hooks/embed-config.service.ts` — TypeORM Repository 를 통해 `Trigger`, `Workspace` 를 조회하는 `EmbedConfigService.resolve()` 메서드.
- `codebase/backend/src/modules/hooks/hooks.module.ts` — `Workspace` 엔티티를 `TypeOrmModule.forFeature` 에 추가.
- `codebase/backend/src/modules/hooks/embed-config.service.spec.ts` — 위 서비스의 단위 테스트(mock repository 사용, 실 DB 접근 없음).
- 나머지 파일(`.claude/test-stages.sh`, `.github/workflows/web-chat-checks.yml`, `channel-web-chat/**`) — DB 코드 없음.

---

### **[INFO]** 순차 2-hop 쿼리 (잠재적 최적화 여지)

- 위치: `codebase/backend/src/modules/hooks/embed-config.service.ts` 라인 351-364
- 상세: `resolve()` 는 먼저 `triggerRepository.findOne({ where: { endpointPath, type: 'webhook' }, select: { workspaceId: true } })` 로 trigger 를 조회하고, 이어서 `workspaceRepository.findOne({ where: { id: trigger.workspaceId }, select: { settings: true } })` 로 workspace 를 조회한다. 이는 2-hop 순차 쿼리이며 N+1 패턴은 아니다(반복문 없음). 단일 JOIN 쿼리로 줄일 수 있으나 현재 규모(캐시 5분 TTL + `select` 최소화)에서 실질 문제는 없다.
- 제안: 트래픽이 증가하거나 캐시를 제거할 경우, TypeORM QueryBuilder 또는 `findOne({ relations: ['workspace'], select: ... })` 방식으로 단일 쿼리로 통합하는 것을 고려한다.

### **[INFO]** 인덱스 — `endpointPath` + `type` 복합 조건

- 위치: `codebase/backend/src/modules/hooks/embed-config.service.ts` 라인 351-354
- 상세: `WHERE endpointPath = ? AND type = 'webhook'` 조건이다. `Trigger` 엔티티에 `endpointPath` 를 포함하는 인덱스(또는 복합 인덱스)가 없으면 full scan 이 발생한다. 이 엔드포인트는 위젯 부팅마다 호출되므로(비록 5분 캐시가 있더라도) 빈번할 수 있다.
- 제안: `Trigger` 엔티티 정의에 `@Index(['endpointPath', 'type'])` 또는 `endpointPath` 단일 인덱스가 있는지 확인한다. 신규 마이그레이션 없이 기존 인덱스가 커버하고 있다면 무방하다.

### **[INFO]** 트랜잭션 불필요 — 읽기 전용, 적절히 처리됨

- 위치: `codebase/backend/src/modules/hooks/embed-config.service.ts` 전체
- 상세: `resolve()` 는 순수 읽기 전용 메서드이며 쓰기 연산이 없다. 트랜잭션 미사용은 올바른 선택이다.

### **[INFO]** 커넥션 관리 — TypeORM Repository 주입, 적절히 처리됨

- 위치: `codebase/backend/src/modules/hooks/embed-config.service.ts` + `hooks.module.ts`
- 상세: `@InjectRepository` 를 통해 TypeORM 관리 커넥션 풀을 사용한다. `Workspace` 엔티티를 `TypeOrmModule.forFeature` 에 추가한 것도 올바르다. 별도 커넥션 획득/해제 로직 없음 — TypeORM이 풀 관리를 담당하므로 적절하다.

### **[INFO]** SQL 인젝션 안전

- 위치: `codebase/backend/src/modules/hooks/embed-config.service.ts` 라인 351-363
- 상세: TypeORM `findOne({ where: {...} })` 는 파라미터화된 쿼리를 생성한다. `endpointPath` 는 외부 입력이지만 직접 문자열 보간 없이 ORM이 바인딩 처리하므로 SQL 인젝션 위험 없음.

### **[INFO]** 스키마 변경(마이그레이션) 없음

- 상세: 이번 변경은 기존 `Trigger`, `Workspace` 엔티티를 읽기만 하며 스키마 DDL 변경이 없다. 마이그레이션 안전성 이슈 해당 없음.

---

## 요약

이번 변경에서 DB 접근 코드는 `EmbedConfigService.resolve()` 단 하나이며, TypeORM Repository 패턴을 올바르게 사용하고 있다. SQL 인젝션 위험 없음, 커넥션 풀 관리 정상, 트랜잭션 불필요한 읽기 전용 경로로 설계가 적절하다. 주요 관찰 사항은 (1) `Trigger.endpointPath` + `type` 조건에 인덱스 존재 여부 확인이 필요하며, (2) 2-hop 순차 조회는 현재 5분 캐시 레이어가 있어 실질적 문제는 없으나 트래픽 증가 시 단일 JOIN으로 최적화를 검토할 수 있다. 나머지 변경 파일(.sh, .yml, 위젯 프론트엔드)은 DB 코드를 포함하지 않는다. 전체적으로 DB 관점의 즉각적 위험은 없다.

## 위험도

LOW
