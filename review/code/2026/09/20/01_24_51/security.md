# 보안(Security) 리뷰

## 검토 범위

- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — 유일한 실 코드 변경(e2e 테스트 2건 추가 · 헬퍼 추출 · 변수명/주석 정리). 전체 파일을 직접 `Read` 로 열어 대조함.
- `plan/in-progress/column-guard-gaps.md` — plan 문서 (신규).
- `review/code/2026/09/20/01_00_21/**`, `review/consistency/2026/09/20/00_34_58/**` — 이전 라운드 산출물(harness 자동 생성 리포트). 코드가 아니므로 보안 관점 상세 검토 대상이 아니며, 하드코딩 시크릿·인젝션 패턴이 섞였는지만 훑었고 없음을 확인.

## 발견사항

- **[INFO]** 신규로 추가된 두 테스트는 전부 파라미터 바인딩(`$1`, `$2` …)을 사용한다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — `it('선언한 DB 기본값은 값을 생략한 insert 뒤 엔티티로 돌아온다 …')` 블록의 세 `INSERT` 문 (게이트 619~630)
  - 상세: `user`/`workspace`/`workflow` 부모 행을 만드는 raw SQL 세 개 모두 값은 리터럴(`'default-probe'`, `'team'` 등 고정 문자열)이거나 `$1`/`$2` 파라미터로 바인딩되고, 유일한 동적 값(`user.id`, `workspace.id`)도 앞 단계의 `RETURNING id` 결과이지 사용자 입력이 아니다. 이메일 문자열(`default-probe-${Date.now()}-${Math.random()}@example.com`)도 파라미터로 넘어가며 외부 입력이 섞이지 않는다. SQL 인젝션 표면 없음.
  - 제안: 조치 불요 — 확인용 기록.

- **[INFO]** DB 접속 정보에 대한 하드코딩 기본값(`dataSourceOptions()`)은 이번 diff 밖의 기존 코드다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:198-199` (`function dataSourceOptions()` 내부 `password: process.env.DB_PASSWORD ?? 'clemvion-e2e'` 등)
  - 상세: `Read` 로 파일 전체를 확인한 결과 이 함수는 unified diff 어느 hunk 에도 포함되지 않은 기존 코드다(이번 diff 는 `readOnlyDataSourceOptions()` 를 새로 뽑아 이 함수를 재사용하도록 리팩터링했을 뿐, 자격증명 로직 자체는 건드리지 않았다). 로컬/CI 전용 docker-compose e2e DB 자격증명이 fallback 으로 하드코딩돼 있으나 프로덕션 경로가 아니고 값도 이미 공개된 e2e 기본값(`clemvion-e2e`)이라 실질 위험은 없다.
  - 제안: 이번 changeset 재작업 불요 — 참고 기록만 남김(신규 도입 아님).

- **[INFO]** 원시 SQL 문자열 삽입(비파라미터) 헬퍼가 이 파일에 이미 존재하나 이번 diff 로 새로 만들거나 확장되지 않았다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:300-339` (`normalizedPredicate`, `normalizedCheck`) — 함수 바로 위 주석(게이트 297~299)에 "식은 엔티티 데코레이터의 문자열 리터럴(메타데이터)에서만 온다 — 외부 입력을 넘기는 용도로 쓰지 말 것" 이라고 이미 명시돼 있음
  - 상세: `where`/`expression` 값을 이스케이프 없이 쿼리 문자열에 이어 붙이지만, 호출부는 전부 `EntityMetadata`(TypeORM 이 엔티티 데코레이터에서 읽은 값)에서만 값을 가져오고 이번 diff 가 이 경로에 새 호출부나 외부 입력을 추가하지 않았다. 신규 취약점 아님 — 기존 설계의 재확인.
  - 제안: 조치 불요.

## 요약

이번 changeset 의 실질 코드 변경은 `entity-schema-declarations.e2e-spec.ts` 한 파일에 국한되고, 내용도 프로덕션 인증/인가 경로나 외부 입력을 다루지 않는 e2e 테스트 2건 추가(읽기 전용 비교기 세션의 회귀 확인, 선언한 DB 기본값의 RETURNING 왕복 확인)와 순수 리팩터링(변수명·헬퍼 추출·주석)이다. 신규로 작성된 SQL 은 전부 파라미터 바인딩을 쓰고 동적 값은 직전 `RETURNING` 결과뿐이라 인젝션 표면이 없으며, 하드코딩 시크릿·인증 우회·안전하지 않은 암호화·민감정보 노출 에러 처리·신규 의존성 등 OWASP Top 10 관점에서 새로 도입된 문제는 발견되지 않았다. 오히려 신규 테스트 중 하나는 "비교기 연결이 실제로 읽기 전용인지"를 검증하는 방어 계층 회귀 테스트로, 기존 안전장치(공유 e2e DB 보호)를 강화하는 방향이다. `plan/` · `review/` 산출물은 마크다운/JSON 메타 문서로 실행 코드가 아니며 훑어본 범위에서 시크릿·인젝션 패턴은 없었다.

## 위험도

NONE
