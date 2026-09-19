# 보안(Security) 리뷰 — entity-schema-declaration-drift

## 리뷰 범위 요약

이 변경은 TypeORM 엔티티 6개(`edge`·`integration-expiry-dispatch`·`node-execution`·`node`·
`workflow-assistant-session`·`workspace`)의 `@Index`/`@Unique`/`@Check`/FK `onDelete` **선언**을
실제 DB(Flyway V001~V132)와 일치시키는 정정과, 그 정합을 상시 검증하는 신규 e2e 가드
(`codebase/backend/test/entity-schema-declarations.e2e-spec.ts`) 추가다. `app.module.ts`
가 `synchronize: false` 로 고정돼 있어 이 엔티티 데코레이터들은 DB DDL 을 전혀 발생시키지
않는다 — 즉 이번 변경 전후로 **런타임 DB 스키마·제약·인덱스는 동일**하다. 나머지 리뷰 대상
파일(plan/*.md, review/consistency/**/*.md·json, spec/*.md)은 문서·리뷰 산출물이라 보안
관점에서 다룰 실행 코드가 없다.

## 발견사항

- **[INFO]** e2e 가드가 CHECK 식·부분 인덱스 WHERE 절을 파라미터 바인딩 없이 SQL 문자열에
  직접 삽입한다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 함수 `normalizedPredicate`(137행 부근,
    `` `CREATE INDEX ${probe}_idx ON ${probe} (${cols}) WHERE ${where}` ``)와 `normalizedCheck`(157행 부근,
    `` `ALTER TABLE ${probe} ADD CONSTRAINT ${probe}_chk CHECK (${expression})` ``)
  - 상세: `where`/`expression` 값은 `ds.entityMetadatas`(TypeORM 이 소스의 `@Index({ where })`·`@Check(expression)`
    데코레이터 리터럴에서 뽑아낸 값)에서 오며, 요청·환경변수 등 외부 입력이 개입할 경로가 없다 — 순수하게
    같은 저장소의 컴파일타임 문자열 리터럴을 되읽는 것이다. 컬럼 식별자 쪽은 `db.escapeIdentifier` 로 이스케이프
    하지만(`qualified()`, `cols.map((c) => db.escapeIdentifier(c))`), 식 자체는 이스케이프하지 않는다. 이는 CI/로컬
    전용 e2e 테스트 하네스이고 프로덕션 요청 경로가 아니므로 실질적 SQL 인젝션 벡터는 아니다. 다만 이 헬퍼
    함수(`normalizedCheck`/`normalizedPredicate`)가 향후 다른 목적으로 재사용되며 외부 입력을 받게 될 경우를
    대비해, "입력은 엔티티 메타데이터로 국한된다"는 전제를 파일 상단 주석에 명시해 두면 다음 사람이 재사용 시
    실수를 줄일 수 있다.
  - 제안: 현 상태로도 위험은 없음(강제 수정 불요). 재사용 시 주의 문구만 권장.

- **[INFO]** e2e DB 자격증명 하드코딩 fallback (기존 관례 재사용, 신규 아님)
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 52~56행
    (`password: process.env.DB_PASSWORD ?? 'clemvion-e2e'` 등)
  - 상세: 이 값들은 `codebase/backend/test/helpers/db.ts` 의 `createDbClient()` 와 동일한 fallback
    패턴을 그대로 반복한다. 대상은 `docker-compose.e2e.yml` 이 띄우는 ephemeral 로컬/CI 전용 Postgres
    로, 프로덕션 자격증명이 아니다. 새로 도입된 하드코딩이 아니라 저장소 전역 e2e 관례를 한 파일 더 따른
    것이라 이 PR 고유의 결함으로 보지 않는다.
  - 제안: 조치 불요.

- **[INFO]** FK `onDelete: 'CASCADE'` 를 코드에 처음 명시 (동작 변경 아님, 인지 목적)
  - 위치: `codebase/backend/src/modules/workspaces/entities/workspace.entity.ts` — `owner` 관계
    (`@ManyToOne(() => User, { onDelete: 'CASCADE' })`)
  - 상세: 실제 DB FK(V001)는 이전부터 `ON DELETE CASCADE` 였고 `synchronize: false` 라 이 선언 추가로
    삭제 동작이 바뀌지 않는다. 다만 이 정정으로 "User 삭제 시 소유 Workspace 전체가 연쇄 삭제된다"는
    사실이 코드 상에서 처음으로 명문화된다 — 향후 User 삭제(현재 앱 경로 없음) 기능을 추가하는 사람이
    이 CASCADE 를 그대로 신뢰해도 되는지 재검토가 필요하다는 점만 기록해 둔다(`spec/1-data-model.md`
    Rationale "FK 서른하나의 처분" 게이트 대상 중 하나 — consistency-checker 도 같은 지점을 INFO 로
    이미 짚었다). 이번 정정 자체가 권한 상승·데이터 유출을 만들지는 않는다.
  - 제안: 조치 불요(정보성).

## 점검 관점별 결과

1. **인젝션**: 해당 없음. 앱 코드(edge/node/node-execution/workflow-assistant-session/workspace
   entity)는 데코레이터 인자 문자열 정정뿐이고 사용자 입력 경로와 무관. e2e 테스트의 문자열 SQL
   조립은 위 INFO 참고(실질 벡터 없음).
2. **하드코딩된 시크릿**: 신규 시크릿 없음. e2e fallback 자격증명은 기존 관례의 반복(로컬 ephemeral
   DB 전용).
3. **인증/인가**: 변경 없음. 엔티티 데코레이터 정정과 신규 e2e 테스트는 인증·인가 로직을 건드리지
   않는다.
4. **입력 검증**: 해당 없음(사용자 입력을 받는 컨트롤러/서비스 코드 변경 없음).
5. **OWASP Top 10**: 해당 사항 없음. `synchronize: false` 로 인해 이 변경이 DB 스키마·제약을
   실제로 바꾸지 않으므로 무결성 제약 우회 같은 새로운 노출면이 생기지 않는다.
6. **암호화**: 해당 없음.
7. **에러 처리**: e2e 가드는 실패 시 Postgres 에러 메시지(`err_.message`)를 테스트 리포트에 그대로
   담지만, 이는 CI 로그에 한정되고 스키마 내부 구조(컬럼명 등, 이미 소스에 공개된 정보)만 노출한다 —
   민감정보(자격증명·PII) 유출 경로 아님.
8. **의존성 보안**: 변경 없음(신규 의존성 추가 없음, `pg`/`typeorm` 기존 사용 패턴 그대로).

## 요약

이번 변경은 `synchronize: false` 하에서 TypeORM 엔티티 데코레이터의 인덱스·유니크·CHECK·FK
선언을 실제 DB(Flyway 마이그레이션)와 일치시키는 순수 메타데이터 교정이며, 런타임 DB 동작·API
표면·인증인가 로직을 전혀 바꾸지 않는다. 신규 e2e 가드는 CHECK/부분 인덱스 조건을 임시 테이블에
직접 만들어 비교하는 방식으로 SQL 문자열을 조립하지만, 그 입력은 컴파일타임 엔티티 메타데이터로
국한되어 외부/사용자 입력이 개입할 경로가 없어 실질적 SQL 인젝션 벡터가 아니다. e2e DB 자격증명
fallback 은 저장소 전역에 이미 존재하는 관례를 재사용한 것으로 신규 하드코딩 시크릿이 아니다.
Critical/Warning 급 보안 결함은 발견되지 않았다.

## 위험도

NONE
