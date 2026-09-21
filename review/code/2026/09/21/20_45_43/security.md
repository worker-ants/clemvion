# 보안(Security) 리뷰

## 대상

`codebase/backend/test/helpers/concurrency.ts`(신규)로 9개 e2e 동시성 테스트 파일(11 블록)에
손으로 복제돼 있던 "BEGIN → 락 → 발사 → 공허성 가드 → COMMIT/ROLLBACK" 보일러플레이트를
추출하는 순수 테스트 리팩터. `codebase/backend/src/**` 프로덕션 코드 변경은 0건이다. 나머지
diff(`plan/in-progress/e2e-race-helper.md`, `review/code/2026/09/21/20_26_50/**`,
`review/consistency/2026/09/21/19_59_55/**`)는 이전 세션의 plan·리뷰·consistency 산출물로,
보안 관점에서 검토할 실행 코드가 아니다.

## 검증 방법

- `codebase/backend/test/helpers/concurrency.ts` 전문을 직접 `Read` 로 확인.
- 헬퍼를 사용하는 9개 e2e spec 전체에서 `raceUnderHeldLock(` 호출부와 `sql:` 리터럴을 grep 해
  전수 대조 — 모든 락 쿼리가 정적 문자열 리터럴 + `$1`(및 `ANY($1::uuid[])`) 파라미터 바인딩
  형태임을 확인했다.
- 저장소 파일은 뮤테이션하지 않았다(read-only 리뷰).

## 발견사항

- **[INFO]** SQL 인젝션 표면 없음 (확인 결과, 결함 아님)
  - 위치: `codebase/backend/test/helpers/concurrency.ts:76` (`locker.query(lock.sql, lock.params)`),
    호출부 9곳의 `sql:` 리터럴 전부
  - 상세: 리팩터 전후 모두 락 SQL 은 호출부에 하드코딩된 문자열이며, 가변 값(`id`, `memberId`,
    `targetId`, `triggerConfigLockKey(...)`, `[idA, idB]`)은 전부 `pg` 의 파라미터 바인딩(`$1`)으로
    전달된다. 문자열 접합(concatenation)으로 SQL 을 구성하는 지점은 없다. 헬퍼가 `lock.sql` 을
    임의 호출부 문자열로부터 받긴 하지만, 그 문자열은 사용자 입력이 아니라 각 e2e spec 파일에
    고정된 리터럴이므로 인젝션 가능 경로가 아니다.
  - 제안: 조치 불요.

- **[INFO]** 신규 파일이 프로덕션 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)를 import 하지만 단방향 read-only
  - 위치: `codebase/backend/test/helpers/concurrency.ts:4`, `:19-24`
  - 상세: `test/` → `src/` 방향의 import 이며 값을 읽어 비교만 한다(모듈 로드 시 `assert` 성격의
    throw). 프로덕션 동작에 영향 없고, 시크릿·자격증명류도 아니다.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 변경된 10개 코드 파일(`concurrency.ts` + 9개 e2e spec) 전체
  - 상세: 리팩터 diff 에 API 키·비밀번호·토큰·인증서 패턴이 신규로 추가되지 않았다. 기존
    e2e 파일들이 쓰던 `registerAndLogin`/`uniqueEmail` 등 로컬 테스트 fixture 헬퍼 호출 방식도
    그대로 유지된다.
  - 제안: 조치 불요.

- **[INFO]** 인증/인가 단언 로직 무변경
  - 위치: 9개 e2e spec 파일 전체 — 예: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts`
    의 소유권 비교, `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` 의 `NOT_A_MEMBER`/
    `MEMBER_NOT_FOUND` 코드 단언
  - 상세: 이번 diff 는 락 획득·발사·공허성 가드·트랜잭션 종료 오케스트레이션만 헬퍼로 옮겼을
    뿐, 각 스펙의 응답 상태 코드·에러 코드 단언(`expect(results...).toEqual(...)`,
    `expect(results[1].code).toBe(...)`)은 문자 그대로 보존되어 있다. 인증/인가 검증 로직이나
    권한 체크 대상 엔드포인트 자체는 건드리지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 에러 처리·정보 노출 관련 변경 없음
  - 위치: `codebase/backend/test/helpers/concurrency.ts:68-70` (신규 `throw new Error`)
  - 상세: 새로 추가된 두 `throw` (thunk 개수 미달, 공허성 가드 실패)는 테스트 실행 시점에만
    발생하는 개발자 대상 진단 메시지이며, 프로덕션 응답 경로나 사용자 대면 에러 메시지와는
    무관하다. 민감 정보(자격증명, 내부 경로, DB 스키마 이상)가 메시지에 포함되지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 의존성 변경 없음
  - 상세: `import { expect } from '@jest/globals'`, `import { Client } from 'pg'` 는 기존
    프로젝트에 이미 존재하던 의존성이며, `package.json`/lockfile 변경은 diff 에 없다.
  - 제안: 조치 불요.

## 요약

프로덕션 코드(`codebase/backend/src/**`) 변경이 0건인 순수 e2e 테스트 헬퍼 추출 리팩터다. 새로
도입된 락 SQL 은 전부 정적 리터럴 + 파라미터 바인딩이라 인젝션 표면이 없고, 하드코딩된
시크릿·인증/인가 우회·안전하지 않은 암호화·민감정보 노출·신규 취약 의존성 등 점검 항목
전반에서 결함을 발견하지 못했다. 각 e2e spec 의 상태 코드/에러 코드 단언은 리팩터 전후
동일하게 보존되어 검증 대상 자체가 약화되지도 않았다. CRITICAL/WARNING 없음.

## 위험도

NONE
