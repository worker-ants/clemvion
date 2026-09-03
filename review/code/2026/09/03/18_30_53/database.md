# 데이터베이스(Database) 리뷰

## 개요

이번 변경은 `plan/in-progress/entity-nullable-column-type-mismatch.md` 배치 3 — TypeORM 엔티티의 TS
타입을 실제 DB 컬럼의 `nullable` 여부와 일치시키는 작업이다. 스키마 변경(마이그레이션 파일)은
전혀 포함되지 않았고, 엔티티 클래스의 TS 타입 애너테이션과 일부 `@Column` 메타데이터(`type:`)
추가만 있다. `folders.controller.ts` 의 캐스트 제거, `folders.service.spec.ts`/
`scripts/backend-typecheck-baseline.json` 은 그에 따른 타입/ratchet 부수 변경이다.

## 검증 (실제 DB 스키마 대조)

`codebase/backend/migrations/V001__initial_schema.sql` 을 직접 열어 이번에 넓힌 8개 필드가
실제로 `NOT NULL` 제약이 없는지 대조했다.

| 엔티티.필드 | 마이그레이션 정의 | nullable 일치 |
|---|---|---|
| `AuditLog.ipAddress` | `ip_address VARCHAR(45)` (L326) | 일치, `type: 'varchar'` 도 `VARCHAR(45)` 와 정확히 일치 |
| `AuthConfig.ipWhitelist` | `ip_whitelist TEXT[]` (L201) | 일치 |
| `AuthConfig.lastUsedAt` | (timestamptz, NOT NULL 없음) | 일치 |
| `Edge.condition` | `condition JSONB` (L132) | 일치 |
| `Folder.parentId` / `parent` | `parent_id UUID REFERENCES folder(id) ON DELETE CASCADE` (L68, NOT NULL 없음) | 일치 |
| `WorkflowVersion.changeSummary` | `change_summary TEXT` (L257) | 일치 |
| `WorkspaceMember.joinedAt` | `joined_at TIMESTAMPTZ` (L57, NOT NULL 없음) | 일치 |

또한 `app.module.ts:112` 등 전체가 `synchronize: false` 로 설정돼 있고 스키마 SoT 는 Flyway
마이그레이션임을 확인했다 — 즉 엔티티의 `type:`/`nullable:` 메타데이터는 TypeORM 쿼리 빌더·
런타임 매핑에만 쓰이고 DDL 을 유발하지 않는다. 이번 변경으로 인한 자동 스키마 동기화 위험은
없다.

## 점검 관점별 평가

1. **인덱스** — 해당 없음. 쿼리 자체가 변경되지 않았다.
2. **N+1 쿼리** — 해당 없음. `folders.service.spec.ts` 의 테스트는 기존 batched-frontier N+1
   가드(V-04, BFS 형제 배치 조회)를 그대로 검증하며, 이번 diff 는 그 fixture 의 `parentId`
   캐스트 제거(`null as unknown as string` → `null`)만 바꿨다 — 쿼리 패턴 변화 없음.
3. **트랜잭션** — 해당 없음.
4. **마이그레이션 안전성** — 스키마 변경 없음(마이그레이션 파일 미포함). `AuditLog.ipAddress` 에
   붙은 `type: 'varchar'` 는 실제 컬럼(`VARCHAR(45)`)과 일치하는 **메타데이터 정정**이며,
   `synchronize: false` 이므로 무중단 배포 영향 없음. 참고로 이 `type:` 추가는 plan 이 배치 1에서
   발견한 실제 런타임 결함(`string | null` 이 TypeORM 의 `design:type` 리플렉션에서
   `Object` 로 방출돼 `DataTypeNotSupportedError` 로 부팅 실패)의 재발 방지 조치로, DB
   관점에서 오히려 올바른 수정이다.
5. **스키마 설계** — 개선. TS 타입이 실제 nullable 컬럼과 어긋나 있던 것을 정렬해 컴파일 타임
   null 안전성을 확보한다(`strictNullChecks: true` 확인됨). `Folder.parentId`/`parent` 는
   `@JoinColumn` 컬럼과 이름이 일치해 relation 이 타입을 공급하므로 `type:` 생략이 타당하다는
   plan 의 주장도 마이그레이션 대조로 재확인된다.
6. **커넥션 관리** — 해당 없음.
7. **SQL 인젝션** — 해당 없음. Raw 쿼리·문자열 결합 없음.
8. **대량 데이터** — 해당 없음.

## 발견사항

- **[INFO]** `AuthConfigDto` (이번 diff 파일 목록에는 포함되지 않음)가 `ipWhitelist: string[]` 를
  non-null 로 Swagger 문서화하는데, 엔티티/DB/서비스 실동작은 모두 nullable 이라는 계약 불일치가
  `plan/in-progress/entity-nullable-column-type-mismatch.md:242-253` 에 이미 자체 기록돼 있다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md` §"새로 드러난 축" (해당 파일 자체 diff 내 게이트 240~253)
  - 상세: DB 컬럼·엔티티 nullability 와 API 응답 DTO 선언이 어긋나면 클라이언트가 `null` 을
    받고도 타입상 안전하다고 오인할 수 있다. 다만 작성자가 이미 범위를 인지하고 "이름 중복
    문제를 먼저 해결해야 확정 가능"이라는 이유로 **의도적으로 이번 PR 범위에서 제외**했음을
    스스로 명시했다.
  - 제안: 별도 후속 작업(엔티티별 귀속 확정 후 DTO 계층 일괄 정정)으로 진행. 이번 PR 에서 추가
    조치 불필요.

이 외에 DB 관점에서 지적할 결함은 발견되지 않았다.

## 요약

이번 diff 는 스키마·쿼리·트랜잭션·커넥션·인덱스 어느 것도 건드리지 않는 순수 TypeORM 엔티티
TS 타입 정합화(nullable 컬럼 ↔ TS `| null`) 작업이며, 실제 마이그레이션 SQL 과 대조한 결과 넓힌
8개 필드 전부 DB 상 이미 nullable 이었음을 확인했다. `AuditLog.ipAddress` 의 `type: 'varchar'`
추가는 실제 컬럼 정의(`VARCHAR(45)`)와 정확히 일치하며 과거 부팅 실패(TypeORM 메타데이터 유실)
재발을 막는 올바른 보강이다. `synchronize: false`(Flyway 가 스키마 SoT) 이므로 무중단 배포
리스크도 없다. 유일한 관찰 사항(DTO nullability 불일치)은 작성자가 이미 인지·기록하고 범위 밖으로
명시적으로 유예한 항목이라 이번 PR 에 대한 조치는 불필요하다.

## 위험도

NONE
