# 보안(Security) 리뷰

## 발견사항

- **[INFO]** e2e 테스트 DB 접속정보 기본값이 소스에 하드코딩되어 있음(신규 아님, 이동만 됨)
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 함수 `dataSourceOptions()` (게이트 188-190행: `username: ... ?? 'clemvion'`, `password: ... ?? 'clemvion-e2e'`, `database: ... ?? 'clemvion_e2e'`)
  - 상세: `DB_PASSWORD` 등 환경변수가 없을 때 쓰이는 폴백 값. 이번 diff 는 기존 `beforeAll` 안에 있던 동일 리터럴을 별도 함수로 추출(리팩터링)한 것뿐이며 새로 도입된 값이 아니다(`git diff` 로 확인, 이동 전후 문자열 동일). 로컬/CI 전용 일회성 e2e 컨테이너 계정으로 실제 운영 자격증명이 아니며, 프로젝트 관례상 이런 e2e 기본값 하드코딩은 기존에도 허용되는 패턴이다.
  - 제안: 조치 불요(기존 관례 유지). 운영 환경 자격증명과 혼동되지 않도록 유지만 하면 된다.

- **[INFO]** 테스트 헬퍼가 엔티티 메타데이터 문자열(CHECK 식 · 부분 인덱스 `where` 절)을 이스케이프 없이 SQL 에 직접 이어붙임
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 함수 `normalizedPredicate`(게이트 276-295행 부근, `CREATE INDEX ... WHERE ${where}`)와 `normalizedCheck`(게이트 297-314행 부근, `ADD CONSTRAINT ... CHECK (${expression})`)
  - 상세: 문법적으로는 SQL 인젝션 패턴(비-파라미터 문자열 삽입)이지만, 입력값이 사용자 요청이 아니라 코드베이스 내 `@Check`/`@Index({ where })` 데코레이터의 리터럴 문자열(엔티티 소스 코드 자체)에서만 온다. 작성자도 주석(게이트 272-273행)에 "식은 엔티티 데코레이터의 문자열 리터럴에서만 온다 — 외부 입력을 넘기는 용도로 쓰지 말 것"이라고 명시해 신뢰 경계를 문서화함. e2e 테스트로만 실행되며 프로덕션 요청 경로가 아님.
  - 제안: 조치 불요. 다만 이 헬퍼를 향후 다른 목적(예: 런타임 동적 스키마 검증 등 외부 입력이 섞일 수 있는 경로)으로 재사용하지 않도록 현재의 문서화된 경계를 유지할 것.

- **[INFO]** 엔티티 컬럼 데코레이터 변경(`type: 'uuid'`, `enumName`, `default`) 자체는 보안 영향 없음
  - 위치: `alert-rule.entity.ts`, `edge.entity.ts`, `integration-usage-log.entity.ts`, `llm-usage-log.entity.ts`, `model-config.entity.ts`, `node.entity.ts`, `workflow-assistant-session.entity.ts`, `workspace-invitation.entity.ts` (각 diff hunk)
  - 상세: TypeORM 스키마 비교기(`synchronize`)가 참조하는 메타데이터 정정으로, `synchronize: false` 이므로 실제 DDL 실행에는 영향 없다. 접근 제어·입력 검증·직렬화 로직은 변경되지 않았다. 사용자 입력을 다루는 서비스/컨트롤러 레이어는 이번 diff 범위 밖.
  - 제안: 없음.

## 요약

이번 변경은 (1) 여덟 개 TypeORM 엔티티의 컬럼 데코레이터를 실제 DB 스키마와 일치시키는 메타데이터 정정(`type: 'uuid'`, `enumName`, `default` 추가), (2) 그 drift 를 잡는 e2e 스키마 비교 가드 테스트 확장, (3) 계획/리뷰 문서 추가로 구성된다. 사용자 입력을 받는 API·컨트롤러·인증/인가 로직·직렬화 경로는 전혀 건드리지 않았고, 신규 엔드포인트나 신규 외부 입력 처리도 없다. 테스트 파일 내 문자열 SQL 조립은 엔티티 데코레이터 리터럴(개발자 통제 하 소스코드)만을 입력으로 삼는다고 코드 주석으로 명시돼 있고 실제로도 그렇게 쓰이며, e2e 전용 실행 경로라 인젝션 공격 표면이 되지 않는다. 하드코딩된 DB 비밀번호 폴백은 기존에 이미 존재하던 로컬 e2e 기본값을 함수로 추출한 것뿐이라 신규 노출이 아니다. 전반적으로 보안 관점에서 실질적 위험이 발견되지 않았다.

## 위험도

NONE
