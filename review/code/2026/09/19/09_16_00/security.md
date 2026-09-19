# 보안(Security) 리뷰

## 발견사항

- **[INFO]** e2e 가드가 엔티티 메타데이터 문자열을 SQL 에 직접 이어 붙인다 (raw SQL 조립)
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — `normalizedPredicate`(약 213~215줄 `CREATE INDEX ... WHERE ${where}`), `normalizedCheck`(약 233~235줄 `ADD CONSTRAINT ... CHECK (${expression})`)
  - 상세: `idx.where` / `chk.expression` 값을 파라미터 바인딩 없이 쿼리 문자열에 직접 삽입한다. 일반적으로는 SQL 인젝션 패턴이지만, 이 값들은 `ds.entityMetadatas`(코드베이스 내 `@Index`/`@Check` 데코레이터의 문자열 리터럴)에서만 오고 외부 요청·사용자 입력과는 경로가 없다. 파일 상단 201~202줄 주석도 "식은 엔티티 데코레이터의 문자열 리터럴에서만 온다 — 외부 입력을 넘기는 용도로 쓰지 말 것"이라고 명시해 위험을 인지하고 스코프를 좁혀 두었다. 실행 대상도 프로덕션 DB 가 아니라 e2e 전용 컨테이너이며 전부 `ROLLBACK` 되는 트랜잭션 안이다.
  - 제안: 현재 스코프(테스트 전용, 내부 상수만 소비)에서는 조치 불요. 다만 이 헬퍼(`normalizedPredicate`/`normalizedCheck`)를 다른 목적으로 재사용할 때 외부 입력이 섞이지 않도록 이름·주석의 경고를 유지할 것.

- **[INFO]** e2e 테스트 DB 자격증명 하드코딩 폴백 (`clemvion-e2e`)
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:129` (`password: process.env.DB_PASSWORD ?? 'clemvion-e2e'`)
  - 상세: 새 파일에 있지만 `test/helpers/db.ts`·`test/app.e2e-spec.ts`·`test/trigger-*.e2e-spec.ts` 등 기존 e2e 스펙 전반에 이미 동일 패턴이 있다(`grep` 확인). 로컬/CI 전용 docker-compose 테스트 DB 자격증명이라 프로덕션 시크릿 유출로 보지 않는다. 신규 위험 아님 — 기존 컨벤션을 그대로 따른 것.

## 요약

이번 diff 는 TypeORM 엔티티 데코레이터(`@Index`/`@Unique`/`@Check`/`onDelete`)의 선언을 실제 Flyway 마이그레이션이 만든 DB 스키마와 일치시키는 정정이며, `synchronize: false` 라 런타임 동작이나 실제 스키마에는 영향이 없다(메타데이터 선언 정합화). 인젝션·인증/인가·시크릿·암호화·에러 노출 등 OWASP 관점에서 신규로 도입되는 공격 표면은 없다. 함께 추가된 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)는 엔티티 메타데이터 문자열을 이스케이프 없이 SQL 에 이어 붙이지만, 그 입력이 코드베이스 내 데코레이터 리터럴로만 한정되고 외부 입력 경로가 없어 실질적 인젝션 위험은 없다(주석으로 스코프도 명시). `Workspace → User` FK 에 `onDelete: 'CASCADE'` 를 추가한 것은 스펙(`1-data-model.md`)과 실제 DB(V001) 를 일치시키는 정정이며 별도 인가 우회를 유발하지 않는다. 리뷰 대상에 포함된 plan/consistency 문서들은 코드가 아니라 정정 근거·검토 기록이라 보안 관점에서 특기할 내용이 없다.

## 위험도
NONE
