# 보안(Security) 코드 리뷰

## 검토 범위

이번 변경은 백엔드 e2e 테스트 파일 하나(`codebase/backend/test/entity-schema-declarations.e2e-spec.ts`)의
빈칸 보강(읽기 전용 세션 헬퍼 추출 + 회귀 테스트 추가, DB 기본값 왕복 테스트 추가)과 plan/consistency-review
산출 문서(`plan/in-progress/column-guard-gaps.md`, `review/consistency/2026/09/20/00_34_58/**`)로 구성된다.
프로덕션 소스 코드(컨트롤러·서비스·인증 미들웨어 등)는 이번 diff에 포함되지 않았다.

## 발견사항

발견된 보안 취약점 없음. 점검 관점별로 확인한 근거는 다음과 같다.

- **인젝션**: 새로 추가된 쿼리는 모두 파라미터 바인딩(`$1`, `$2` + 배열 인자)을 사용한다
  (`codebase/backend/test/entity-schema-declarations.e2e-spec.ts` `it('선언한 DB 기본값은 값을 생략한 insert 뒤...')` 블록,
  게이트 619·623·627행의 `qr.query(...)` 세 호출). 유일하게 리터럴을 그대로 이어 붙이는 곳(게이트 600행
  `'CREATE TEMP TABLE entity_schema_read_only_probe (x int)'`)은 고정 문자열이며 외부/사용자 입력이 전혀
  섞이지 않는다. 무작위 이메일 생성(게이트 620행 `` `default-probe-${Date.now()}-${Math.random()}@example.com` ``)도
  값이 아니라 바인딩 파라미터로 전달돼 인젝션 표면이 아니다.
- **하드코딩된 시크릿**: 이번 diff가 추가한 코드에는 새로운 시크릿이 없다. `dataSourceOptions()`의
  `process.env.DB_PASSWORD ?? 'clemvion-e2e'` (전체 파일 컨텍스트 게이트 198행)는 diff 대상이 아닌
  기존 코드이며(`git log -p`로 최초 도입 시점부터 동일 값 확인), 로컬/CI 전용 e2e Postgres 컨테이너의
  기본 비밀번호로 프로덕션 자격증명이 아니다.
- **인증/인가**: 해당 없음 — 이 파일은 프로덕션 요청 경로를 다루지 않고, 스키마 비교기(TypeORM
  `createSchemaBuilder().log()`)를 통해 DB 카탈로그를 읽기만 한다. 신설된 `readOnlyDataSourceOptions()`
  (게이트 211~219행)와 그 회귀 테스트(게이트 594~606행)는 오히려 방어를 강화한다 — `default_transaction_read_only=on`
  세션 옵션으로 비교기가 실수로 DDL을 실행하려 들면 Postgres가 거부하도록 만들고, 그 전제가 유지되는지
  자체를 별도 테스트로 검증한다.
- **입력 검증**: 모든 신규 값(부모 행 FK, 임의 이메일)은 테스트 내부에서 생성한 값이며 외부 입력을 받지
  않는다.
- **OWASP Top 10 / 암호화 / 에러 처리**: 새로 추가된 코드에 해당 사항 없음. 에러 메시지 노출 관련
  `attempt()` 헬퍼(게이트 249~264행)는 기존 코드이며 테스트 트랜잭션 내부 로그 용도로 이번 diff에서
  변경되지 않았다.
- **의존성 보안**: 새 의존성 추가 없음(기존 `typeorm`, `pg` 재사용).
- plan/consistency-review 문서(파일 2~10)는 산출물 성격의 마크다운/JSON으로, 시크릿·인젝션 표면을
  포함하지 않는다(grep으로 시크릿 패턴 확인 — 매칭된 항목은 모두 audit 액션명(`trigger.*_token_rotated` 등)·
  스펙 필드명(`api_key`/`bearer_token` 타입 열거)일 뿐 실제 자격증명이 아니다).

## 요약

이번 변경분은 e2e 테스트 코드와 plan/리뷰 산출 문서로 국한되며, 프로덕션 인증·인가·입력 처리 경로를
건드리지 않는다. 신규 SQL은 전부 파라미터 바인딩을 사용하고, 유일한 리터럴 SQL은 사용자 입력이 섞이지
않는 고정 문자열이다. 오히려 이번 diff는 스키마 비교기 연결을 읽기 전용 세션으로 강제하고 그 보장이
유지되는지 확인하는 회귀 테스트를 추가해 방어 계층을 보강했다. 사전에 존재하던 e2e 기본 비밀번호
(`clemvion-e2e`)는 이번 diff의 대상이 아니며 로컬/CI 테스트 전용 값으로 판단된다. 보안 관점에서 차단할
사항이 없다.

## 위험도

NONE
