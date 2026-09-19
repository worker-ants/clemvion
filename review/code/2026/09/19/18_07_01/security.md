# 보안(Security) 코드 리뷰

## 검토 범위

`codebase/backend/src/modules/{alerts,edges,integrations,llm,model-config,nodes,workflow-assistant,workspaces}/entities/*.ts` (총 8개 TypeORM 엔티티 파일)의 `@Column` 데코레이터 메타데이터 정정(`type: 'uuid'` · `enumName` · `default` 추가)과, 그 정합성을 검증하는 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 가드 확장. 나머지 변경 파일(`plan/**`, `review/consistency/**`)은 문서·리뷰 산출물이라 보안 관점 대상 코드가 아니다.

## 발견사항

- **[INFO]** e2e 테스트 DB 접속 정보가 소스에 하드코딩된 fallback 값으로 존재
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — `dataSourceOptions()` 함수(184~196번째 줄)
  - 상세: `process.env.DB_PASSWORD ?? 'clemvion-e2e'`, `username: ... ?? 'clemvion'`, `database: ... ?? 'clemvion_e2e'`, `host: ... ?? 'postgres'` 형태로 로컬 docker-compose e2e 환경의 기본 자격증명이 코드에 직접 적혀 있다. 다만 이번 diff 는 기존에 `beforeAll` 안에 인라인으로 있던 동일 리터럴을 `dataSourceOptions()` 함수로 리팩터링해 재사용한 것뿐이며, 값 자체는 이번 변경으로 **신규 도입된 것이 아니다**(환경변수로 오버라이드 가능, 프로덕션 자격증명이 아닌 e2e 전용 fixture). 실제 위험은 낮으나 하드코딩된 시크릿 스캔 관점에서 참고용으로 기록한다.
  - 제안: 현행 유지 가능(테스트 전용 로컬 fixture). 프로덕션 자격증명과 혼동되지 않도록 유지.

- **[INFO]** 신규 테스트 코드가 엔티티 메타데이터 문자열을 이스케이프 없이 SQL 에 직접 이어붙임
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — `normalizedPredicate`(276~296번째 줄), `normalizedCheck`(298~315번째 줄) 및 이를 호출하는 컬럼/인덱스 비교 테스트
  - 상세: `idx.where`, `chk.expression` 값을 이스케이프 없이 `CREATE INDEX ... WHERE ${where}`, `ALTER TABLE ... CHECK (${expression})` 형태로 문자열 보간한다. 코드 주석(273~274번째 줄)이 "식은 엔티티 데코레이터의 문자열 리터럴(메타데이터)에서만 온다 — 외부 입력을 넘기는 용도로 쓰지 말 것" 이라고 이미 명시하고 있어, 작성자가 이 위험을 인지하고 스코프를 제한했다. 값의 출처는 저장소에 커밋된 엔티티 데코레이터 리터럴뿐이라 외부/사용자 입력이 도달할 경로가 없고, 트랜잭션은 항상 ROLLBACK 되며 대상은 e2e 전용 임시 테이블이다. 실질적 인젝션 취약점은 아니다.
  - 제안: 현행 유지. 다만 이 헬퍼 함수들을 향후 다른 목적(예: 사용자 입력이 섞이는 스크립트)으로 재사용하지 않도록 위 주석의 경고를 유지할 것.

- **[INFO]** `model-config.entity.ts` 의 `apiKey` 컬럼은 이번 diff 의 변경 대상이 아님(참고 확인)
  - 위치: `codebase/backend/src/modules/model-config/entities/model-config.entity.ts` — `apiKey` 필드(58~59번째 줄 부근)
  - 상세: 이번 diff 는 같은 파일의 `kind` 컬럼에 `default: 'chat'` 을 추가했을 뿐이며, API 키를 담는 `apiKey: varchar(500)` 컬럼 자체는 변경되지 않았다. 평문 저장 여부(암호화 컬럼인지)는 이번 변경 범위 밖이라 판단하지 않았고, 실제로도 diff 에 해당 컬럼 정의 변경이 없다.
  - 제안: 없음(이번 변경과 무관, 참고용 확인).

나머지 7개 엔티티 파일 변경(`type: 'uuid'` 추가, `enumName` 추가, `default` 값 추가)은 TypeORM 스키마 비교기가 실제 DB 컬럼 정의(이미 마이그레이션으로 적용된 `uuid`/enum 타입 이름/기본값)와 선언을 일치시키는 순수 메타데이터 정정이며, `synchronize: false` 환경에서 런타임 쿼리 생성·인증/인가·입력 검증 로직에 영향을 주지 않는다. 인젝션·인증 우회·시크릿 노출·암호화 약화·에러 메시지 정보 노출·의존성 관련 이슈는 발견되지 않았다.

## 요약

이번 변경은 8개 TypeORM 엔티티의 `@Column` 메타데이터(uuid 타입·enum 이름·기본값)를 실제 DB 스키마와 일치시키는 선언 정정과, 이를 검증하는 e2e 가드(컬럼 층 스키마 비교) 확장으로 구성되며 신규 엔드포인트·인증/인가 로직·사용자 입력 처리 경로를 전혀 건드리지 않는다. 새로 추가된 e2e 테스트는 엔티티 데코레이터의 정적 문자열만을 SQL 에 보간하고(외부 입력 도달 경로 없음, 트랜잭션 ROLLBACK 보장), 비교기를 읽기 전용 세션(`default_transaction_read_only=on`)으로만 연결해 공유 DB 를 실수로 변경하지 않도록 방어하는 등 보안적으로 신중하게 설계되어 있다. 하드코딩된 e2e DB 자격증명은 기존부터 있던 로컬 fixture 값을 함수로 리팩터링한 것이며 신규 노출이 아니다. Critical/Warning 급 발견사항은 없다.

## 위험도

NONE
