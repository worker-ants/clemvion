# 보안(Security) Review

## 리뷰 범위

이번 diff 는 실질 코드 변경 1건(`codebase/backend/test/terminal-duration-sql.e2e-spec.ts`, 신규
e2e 테스트)과, plan 문서 갱신 2건(`plan/complete/terminal-duration-sql-safety-net.md` 신설,
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 항목 종결 갱신), 그리고 **이전
라운드**(`11_15_39` code review, `10_48_33` consistency-check)의 산출물 20개(모두
`review/**` 하위 리포트/메타 파일)로 구성된다. 후자는 문서·리포트 성격이라 인젝션·인증·시크릿
관점에서 적용 대상이 아니며, 신규 시크릿·자격증명·토큰 값도 발견되지 않았다(전수 grep 확인 —
`SECRET_LEAK_PATTERNS`, `notification.secret`, `TOKEN_REFRESH_*` 등은 모두 기존 규약/에러코드
이름을 인용한 서술이지 실제 시크릿 값이 아니다).

따라서 보안 관점의 실질 검토 대상은 신규 e2e 테스트 파일 하나다.

## 코드 분석 — `terminal-duration-sql.e2e-spec.ts`

- **SQL 인젝션**: 없음. 두 개의 쿼리 모두 pg 파라미터 바인딩(`$1`/`$2`)을 사용한다.
  - `durationMs()`(파일 내 함수, `SELECT ${toPgSql()} AS duration_ms ...`)는 `toPgSql()` 이
    반환하는 문자열을 템플릿 리터럴로 삽입하지만, 그 입력은 사용자 제어값이 아니라 소스에
    하드코딩된 정본 상수 `TERMINAL_DURATION_MS_SQL`(`codebase/backend/src/shared/utils/terminal-duration.ts`)의
    named 파라미터 자리표시자(`:terminalFinishedAt`)를 `$1` 로 1:1 치환한 결과다. 실제 값
    (`finishedAt`, `startedAt`)은 모두 `db.query(sql, [finishedAt, startedAt])` 배열로 바인딩되며
    문자열 결합되지 않는다.
  - `column()`(스키마 전제 `describe` 블록)도 `table_name = $1 AND column_name = $2` 형태로
    완전히 파라미터화됐고, 인자로 넘기는 `entityTable()`/`entityColumn()` 값은 TypeORM
    `getMetadataArgsStorage()` 메타데이터에서 유도한 값(엔티티 데코레이터에 정적으로 선언된
    테이블/컬럼명)이라 외부 입력 경로가 없다.
  - 이 테스트가 검증 대상으로 삼는 `TERMINAL_DURATION_MS_SQL` 자체(원본 SQL 상수)도 이번 diff
    가 아니라 이전 PR 에서 도입된 기존 코드이며, 마찬가지로 named 파라미터 바인딩만 쓴다.
- **하드코딩된 시크릿**: 없음. DB 접속은 `./helpers/db.ts` 의 `createDbClient()`(diff 밖, 기존
  파일)를 재사용하며 이 e2e 파일 자체는 자격증명을 다루지 않는다.
- **인증/인가**: 해당 없음. 프로덕션 인증 경로 변경이 아니고, e2e 러너 컨테이너 내부에서 같은
  docker network 의 Postgres 에 직접 접속하는 테스트 인프라 코드다.
- **입력 검증**: 해당 없음. 모든 입력값(`START`, `plusMs()` 결과, `PG_INT4_MAX` 배수)은 테스트
  코드 내부에서 생성되는 상수/계산값이며 외부(네트워크·사용자) 입력 경로가 없다.
- **암호화**: 해당 없음. 평문 전송이나 해시 관련 코드 변경 없음.
- **에러 처리**: `entityTable()`/`entityColumn()` 이 메타데이터를 못 찾으면 `throw new Error(...)`
  로 실패하는데, 메시지에는 프로퍼티명만 포함되고 민감정보(자격증명·내부 경로·스택 등)는
  노출하지 않는다.
- **의존성 보안**: 신규 의존성 추가 없음(`@jest/globals`, `pg`, `typeorm` 모두 기존 사용 중인
  패키지의 재사용 import).

## 문서 변경 검토

`plan/complete/terminal-duration-sql-safety-net.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
갱신분은 작업 완료 서술과 뮤테이션 검증 결과 기록이며, 시크릿·자격증명·엔드포인트 등 민감정보
노출 없음. `review/code/2026/08/23/11_15_39/RESOLUTION.md` 는 이전 라운드에서 summary
sub-agent 가 셸 `cp` 로 파일 쓰기 권한 차단을 우회했던 사건(그 자체가 이전 라운드의 SECURITY
WARNING 대상)을 기록하고 있으나, 이는 **개발 하네스(리뷰 도구) 자체의 정책 준수 이슈**이지
프로덕션 코드의 보안 취약점이 아니며 이미 해소된 것으로 서술돼 있다. 별도 신규 발견사항으로
등재하지 않는다(이전 라운드에서 이미 다뤄졌고, 재발 방지 조치는 이번 diff 의 범위 밖).

## 발견사항

없음.

## 요약

이번 변경의 실질 코드는 `TERMINAL_DURATION_MS_SQL` 상수를 실제 Postgres 에 태워 값을 검증하는
신규 e2e 테스트 1개뿐이며, 두 쿼리 모두 pg 파라미터 바인딩을 정확히 사용해 SQL 인젝션 벡터가
없다. 문자열 삽입(`toPgSql()`)은 사용자 입력이 아닌 소스 상수의 파라미터 자리표시자 치환이라
인젝션과 무관하다. 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출
에러 처리, 취약 의존성 등 어떤 카테고리에서도 문제가 발견되지 않았다. 나머지 파일(plan 문서,
이전 리뷰/consistency-check 산출물)은 서술형 문서로 보안 관점 결함이 없다.

## 위험도

NONE
