# 보안(Security) 코드 리뷰

## 검토 범위

`codebase/backend/test/helpers/concurrency.ts`(신규) — 9개 e2e 동시성 테스트 파일(`auth-config-`,
`integration-`, `member-remove-`(2블록), `model-config-`, `schedule-`, `trigger-`,
`webauthn-credential-`(2블록), `workflow-`, `workspace-delete-concurrency.e2e-spec.ts`)에 손으로
복제돼 있던 "BEGIN → 락 획득 → 두 요청 동시 발사 → 공허성 가드(`Promise.race`) → COMMIT →
`finally`(ROLLBACK + pending 흡수)" 보일러플레이트를 `raceUnderHeldLock()` 단일 함수로 추출하는
순수 테스트 리팩터다. `PROJECT.md` 에 헬퍼 사용 안내 6줄이 추가됐고, `plan/in-progress/e2e-race-helper.md`
및 선행 `/ai-review`·`/consistency-check --impl-prep` 산출물(`review/code/2026/09/21/20_26_50/**`,
`review/code/2026/09/21/20_45_43/**`, `review/consistency/2026/09/21/19_59_55/**`)이 diff 에 포함돼
있으나 이들은 실행 코드가 아니라 프로세스 게이트 산출물이다.

`codebase/backend/src/**`(프로덕션 코드) 변경은 **0건**이다.

## 검증 방법

- `codebase/backend/test/helpers/concurrency.ts` 전문을 `Read` 로 직접 확인(현재 저장소 상태 —
  모듈 최상위 `KNOWN_LOCK_TIMEOUTS_MS`/`VACUITY_GUARD_MS` 안전 마진 assert 포함).
- `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` 를 `grep` 으로 열어
  SQL 문·인증 헤더·자격증명 사용 패턴을 대조(프롬프트에서 diff 가 생략된 파일이라 별도 확인).
- 9개 e2e spec 전체의 `raceUnderHeldLock(` 호출부와 `sql:` 리터럴을 프롬프트 unified diff 로 전수
  대조 — 모든 락 쿼리가 정적 문자열 리터럴 + `$1`/`ANY($1::uuid[])` 파라미터 바인딩 형태.
- 저장소 파일은 뮤테이션하지 않았다(read-only 리뷰, `git status --short` 변경 없음 확인 불필요 —
  Read/Grep 만 사용).

## 발견사항

CRITICAL/WARNING 없음. 점검 관점별 근거만 기록한다(전부 INFO 이하 — 결함 아님):

- **[INFO] 인젝션 취약점 없음** — 모든 SQL(`SELECT … FOR UPDATE`, `SELECT pg_advisory_xact_lock(hashtext($1))`,
  `SELECT id FROM webauthn_credential WHERE id = ANY($1::uuid[]) FOR UPDATE`, fixture `INSERT`)가
  `pg` 파라미터 바인딩(`$1`, `$2`)만 쓴다. 문자열 결합으로 SQL 을 조립하는 지점은 없다. 헬퍼
  (`concurrency.ts:91`, `locker.query(lock.sql, lock.params)`)는 `lock.sql` 을 호출부로부터 받지만
  그 문자열은 사용자 입력이 아니라 각 e2e spec 파일에 고정된 리터럴이다. HTTP 경로 파라미터
  (`/api/.../${id}`, `/api/auth/2fa/webauthn/credentials/${targetId}`)도 API 응답에서 받은 UUID를
  그대로 쓰는 것이라 외부 입력 경유 경로가 아니다.
  - 위치: `codebase/backend/test/helpers/concurrency.ts:91`; 호출부 9곳의 `sql:` 리터럴 전체
  - 제안: 조치 불요.

- **[INFO] 하드코딩된 값은 로컬 e2e stub — 실제 시크릿 아님** — `integration-delete-concurrency.e2e-spec.ts`
  의 `credentials: { token: 'e2e-intdel-token' }`, `model-config-delete-concurrency.e2e-spec.ts` 의
  `apiKey: 'stub-not-used'`, `webauthn-credential-delete-concurrency.e2e-spec.ts` 의
  `'\x00'::bytea` 더미 공개키는 전부 로컬 docker-compose e2e 네트워크(`E2E_BASE_URL` 기본값
  `http://backend-e2e:3011`)에서만 쓰이는 fixture 값이며, 이번 diff 로 신규 도입된 것도 아니다
  (기존 파일에 있던 값이 헬퍼 호출로 치환되며 그대로 이동). 실제 로그인 토큰(`token`/`otherToken`)은
  `registerAndLogin` 이 매 테스트마다 발급하는 값이지 코드에 박힌 자격증명이 아니다.
  - 위치: 각 e2e spec 파일의 fixture 상수 선언부
  - 제안: 조치 불요.

- **[INFO] 인증/인가 단언 로직 무변경** — 이 테스트들은 정확히 "동시 요청 하에서도 소유권/멤버십
  재검증이 두 번째 요청에 올바르게 재적용되는지"(`webauthn` 소유권 비교, `member-remove` 의
  `NOT_A_MEMBER`/`MEMBER_NOT_FOUND`, `workspace` 삭제의 `WORKSPACE_NOT_FOUND`)를 관찰하는 회귀
  가드다. `raceUnderHeldLock()` 추출은 오케스트레이션(락·발사·가드·트랜잭션 종료)만 옮겼을 뿐,
  각 스펙의 `expect(results...).toEqual(...)`/`expect(results[1].code).toBe(...)` 문자열은 diff
  전후 동일하게 보존된다 — 인가 검증 자체를 약화시키는 변경 없음.
  - 위치: 9개 e2e spec 파일의 `expect(...)` 단언 전체 (예: `member-remove-concurrency.e2e-spec.ts`,
    `workspace-delete-concurrency.e2e-spec.ts`)
  - 제안: 조치 불요.

- **[INFO] 에러 처리 — 민감정보 노출 없음** — 신규 `throw new Error(...)` 두 곳
  (`concurrency.ts` 의 `fires.length < 2` 검증, `expect(raced).toBe('pending')` 공허성 가드)은
  테스트 실행 시점에만 발생하는 개발자 대상 진단 메시지로, 자격증명·내부 경로·DB 스키마 등
  민감정보를 담지 않는다. `finally` 블록의 `ROLLBACK`/`pending` rejection 흡수(`.catch(() => undefined)`)
  도 unhandled-rejection 방지용이며 프로덕션 응답 경로와 무관하다.
  - 위치: `codebase/backend/test/helpers/concurrency.ts` 함수 본문의 두 `throw new Error(...)` 지점
  - 제안: 조치 불요.

- **[INFO] 프로덕션 상수 import 는 단방향 read-only** — 신규 파일이
  `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(`../../src/modules/triggers/trigger-config-lock`)를 import 해
  모듈 로드 시점 안전 마진(`VACUITY_GUARD_MS < TRIGGER_DELETE_LOCK_TIMEOUT_MS`)을 검사하지만,
  `test/` → `src/` 방향의 값 읽기·비교뿐이며 프로덕션 동작에 영향이 없고 시크릿류도 아니다.
  - 위치: `codebase/backend/test/helpers/concurrency.ts:4`, `:12-14`, `:29-36`
  - 제안: 조치 불요.

- **[INFO] 의존성 보안 — 신규 의존성 없음** — `@jest/globals`, `pg` 는 기존 프로젝트에 이미 있던
  의존성이며 `package.json`/lockfile 변경은 diff 에 없다.
  - 제안: 조치 불요.

## 요약

이번 변경은 이미 병합된 9개 동시성 삭제 감사 중복 버그 수정(#1369~#1376)의 e2e 재현 코드에서
반복되던 "락 → 동시 발사 → 공허성 가드 → COMMIT/ROLLBACK" 보일러플레이트를 `raceUnderHeldLock()`
공용 헬퍼로 추출하는 순수 테스트 리팩터다. 프로덕션 코드(`codebase/backend/src/**`) 변경이 전혀
없고, 모든 SQL 은 파라미터 바인딩만 사용해 인젝션 표면이 없으며, 각 테스트가 검증하는 인증/인가/
감사-로그 단언은 리팩터 전후 문자 그대로 보존된다. 하드코딩된 값들은 기존에도 있던 로컬 e2e
stub 자격증명일 뿐 실제 운영 시크릿이 아니다. 프로덕션 상수 import 는 단방향 read-only 비교용이다.
보안 관점에서 새로 도입된 위험은 확인되지 않았다. 이 결론은 동일 코드베이스에 대한 선행 두 리뷰
라운드(`review/code/2026/09/21/20_26_50/security.md`, `review/code/2026/09/21/20_45_43/security.md`,
둘 다 위험도 NONE)와도 일치한다.

## 위험도

NONE
