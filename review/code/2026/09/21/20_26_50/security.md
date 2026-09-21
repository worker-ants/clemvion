# 보안(Security) 코드 리뷰 — e2e-race-helper-8d1b6e

## 검토 범위

`codebase/backend/test/helpers/concurrency.ts`(신규) + 이를 사용하도록 리팩터된 9개
e2e 동시성 테스트 파일(`auth-config-delete-concurrency.e2e-spec.ts`,
`integration-delete-concurrency.e2e-spec.ts`, `member-remove-concurrency.e2e-spec.ts`,
`model-config-delete-concurrency.e2e-spec.ts`, `schedule-delete-concurrency.e2e-spec.ts`,
`trigger-delete-concurrency.e2e-spec.ts`, `webauthn-credential-delete-concurrency.e2e-spec.ts`,
`workflow-delete-concurrency.e2e-spec.ts`, `workspace-delete-concurrency.e2e-spec.ts`) +
`plan/in-progress/e2e-race-helper.md` + 관련 consistency 리뷰 산출물(`review/consistency/**`).

프로덕션 코드(`codebase/backend/src/**`) 변경은 0건이며, 성격상 순수 테스트 리팩터
(인라인으로 중복돼 있던 "락 획득 → 두 요청 동시 발사 → 공허성 가드 → COMMIT" 오케스트레이션을
`raceUnderHeldLock()` 헬퍼로 추출)다. 단언(assertion) 로직은 변경되지 않았다.

## 발견사항

없음 — CRITICAL/WARNING/INFO 대상 미검출.

검토한 근거:

- **인젝션**: 모든 SQL 쿼리(락 획득 `SELECT … FOR UPDATE` / `pg_advisory_xact_lock(hashtext($1))`,
  `webauthn-credential-delete-concurrency.e2e-spec.ts` 의 fixture `INSERT`)가 `pg` 파라미터
  바인딩(`$1`, `$2` + `params` 배열)만 쓴다. 문자열 결합으로 SQL 을 조립하는 자리는 없다.
  HTTP 경로 파라미터(`/api/.../${id}`)도 테스트가 API 응답에서 받은 UUID 를 그대로 쓰는 것이라
  외부 입력 경유 경로가 아니다.
- **하드코딩된 시크릿**: `integration-delete-concurrency.e2e-spec.ts` 의
  `credentials: { token: 'e2e-intdel-token' }`, `model-config-delete-concurrency.e2e-spec.ts` 의
  `apiKey: 'stub-not-used'`, `webauthn-...` 의 `'\x00'::bytea` 공개키 더미값 등은 전부 로컬 e2e
  픽스처용 stub 값이며 실제 자격증명·운영 시크릿이 아니다. 신규 도입된 것도 아니다(기존 파일에
  이미 있던 값이 그대로 이동).
- **인증/인가**: 이 테스트들은 정확히 "동시 요청 하에서도 인가/소유권 검사가 두 번째 요청에
  올바르게 재적용되는지"(예: `webauthn` 소유권 비교, `member-remove` 의 owner 금지/admin 확인,
  `workspace` 삭제의 멤버십 재확인)를 관찰하는 회귀 가드다. `raceUnderHeldLock()` 추출은 이
  가드가 관측하는 대상(HTTP 응답 status/code, 감사 로그 카운트)을 하나도 바꾸지 않았다 — diff 를
  보면 `expect(...)` 문은 그대로 남고 오케스트레이션 코드만 헬퍼 호출로 치환됐다.
- **입력 검증**: 테스트 코드이며 사용자 입력 경로가 없다.
- **암호화/평문 전송**: 관련 없음(HTTP 헤더에 `Bearer ${token}` 사용은 기존 e2e 패턴 그대로이며
  로컬 e2e 환경으로만 향한다).
- **에러 처리**: `raceUnderHeldLock()` 의 `finally` 블록이 `ROLLBACK` 실패와 `pending` reject 를
  `.catch(() => undefined)` 로 흡수하는데, 이는 테스트 정리(cleanup) 단계의 unhandled-rejection
  방지 목적이며 민감 정보를 로그/응답에 노출하는 코드가 아니다. 보안 관점의 정보 노출 문제는 아니다
  (테스트 견고성 관점 이슈일 뿐이며, 이 리뷰의 스코프인 보안 취약점에는 해당하지 않는다고 판단).
- **의존성 보안**: 신규 의존성 추가 없음. `@jest/globals`, `pg` 는 기존에도 각 파일이 개별적으로
  import 하던 것을 헬퍼 파일로 옮긴 것뿐이다.
- **OWASP Top 10 일반**: 테스트 전용 파일이며 실행 환경은 `E2E_BASE_URL` 기본값
  `http://backend-e2e:3011`(로컬 docker-compose e2e 네트워크)로 제한된다. 외부에 노출되는 표면이
  아니다.

## 요약

이번 변경은 이미 병합된 9개 동시성 삭제 버그 수정(#1369~#1376)의 e2e 재현 코드에서 반복되던
"락 → 동시 발사 → 공허성 가드(vacuity guard) → COMMIT" 보일러플레이트를 `raceUnderHeldLock()`
공용 헬퍼로 추출하는 순수 테스트 리팩터다. 프로덕션 코드(`codebase/backend/src/**`) 변경이
전혀 없고, 모든 SQL 은 파라미터 바인딩을 사용하며, 각 테스트가 검증하는 인증/인가/감사-로그
단언은 하나도 바뀌지 않았다. 하드코딩된 값들은 기존에도 있던 로컬 e2e stub 자격증명일 뿐 실제
시크릿이 아니다. 보안 관점에서 새로 도입된 위험은 확인되지 않았다.

## 위험도

NONE
