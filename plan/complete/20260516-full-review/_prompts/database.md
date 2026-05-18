# 데이터베이스(Database) Full-Project Review Payload

## 미션

main 브랜치(`bbd838ef`) 기준 코드베이스의 DB 상호작용을 면밀히 검토한다.

## 사용자 강조 관점

병렬 작업으로 인한 스키마·인덱스·트랜잭션 일관성 위험:

1. **일관성** — 마이그레이션의 누적·rollback 가능성, naming, 동일 도메인 패턴
2. **스펙 준수** — `spec/1-data-model.md` 의 데이터 모델 vs 실제 스키마
3. **보안** — Row-level isolation (워크스페이스 격리), 암호화 컬럼
4. **리팩토링** — 인덱스 누락·과잉, 트랜잭션 경계

## 최근 병렬 작업 컨텍스트

- B-4: cafe24 데이터베이스 Medium 5건 — DB 영역 hot
- C-1: prod DB encryption check — 암호화 관련
- A-1: integration_action_required 알림 타입 신설 (스키마 변경 수반 가능)
- B-3: 요구사항/API 계약 Medium 7건 (간접적 스키마 영향 가능)

## 검토 범위

- `codebase/backend/src/**/entities/**/*.ts` — TypeORM entity 정의
- `codebase/backend/src/migrations/` 또는 `codebase/backend/database/migrations/`
- `codebase/backend/src/**/repositories/` 또는 service 의 query 호출
- `codebase/backend/src/common/db/`
- `spec/1-data-model.md`
- `codebase/backend/.env.example` — DB 설정

## 작업 지침

1. **인덱스**: WHERE/ORDER BY/JOIN 컬럼이 인덱스를 타는가, 복합 인덱스 컬럼 순서
2. **N+1**: relation 의 eager/lazy, `findOne` 반복 호출
3. **트랜잭션**: 여러 write 가 일관성을 요구할 때 transaction 사용 여부, isolation level
4. **마이그레이션 안전성**: NOT NULL 추가 시 default, 큰 테이블의 DDL 락, online 가능성
5. **스키마 일관성**: spec/1-data-model.md 와 entity 정의 일치
6. **워크스페이스 격리**: 모든 query 에 workspaceId 필터, IDOR 위험
7. **암호화 컬럼**: 민감 정보가 평문 저장되지 않는지 (C-1 결과 확인)
8. **커넥션 관리**: connection pool 누수, queryRunner.release()
9. **대량 데이터**: pagination, streaming, chunk 처리
10. **soft delete vs hard delete**: 일관성

## 출력 형식

```
### 발견사항
- **[CRITICAL/WARNING/INFO]** 짧은 제목
  - 위치: <path>:<line>
  - 상세
  - 제안

### 요약
1 문단

### 위험도
NONE / LOW / MEDIUM / HIGH / CRITICAL
```

CRITICAL: 데이터 손실·일관성 위반·격리 우회. WARNING: 성능·확장성. INFO: 정리.
