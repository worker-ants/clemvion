# 보안(Security) 리뷰 — race-helper-guard-tests

## 리뷰 범위

이번 diff 는 프로덕션 런타임 코드를 포함하지 않는다. 전부 다음 범주에 속한다.

- 테스트 전용 순수 함수 모듈 신규 (`codebase/backend/src/shared/testing/overlap-preconditions.ts` + self-spec)
- 기존 e2e 테스트 헬퍼(`codebase/backend/test/helpers/concurrency.ts`) 리팩터 — 동일 검사 로직을 순수 함수 호출로 교체
- `PROJECT.md` 문서 한 줄 추가(테스트 헬퍼 파일 배치 규약 예외)
- `plan/**`, `review/consistency/**` 산출물(마크다운·JSON) — 작업 추적/일관성 검토 보고서

신규 모듈은 JSDoc 에 명시된 대로 `tsconfig.build.json` 이 `src/shared/testing/**` 를 exclude 하므로 `dist/` 로 나가지 않고, import 0 (런타임 의존 없음)이다. 즉 프로덕션 공격 표면에 전혀 노출되지 않는다.

### 발견사항

- **[INFO]** 락 SQL 은 파라미터 바인딩을 사용해 인젝션 표면이 없음 (참고용, 결함 아님)
  - 위치: `codebase/backend/test/helpers/concurrency.ts` — `raceUnderHeldLock` 함수 내 `await locker.query(lock.sql, lock.params);` (전체 파일 컨텍스트 게이트 83번째 줄)
  - 상세: `lock: { sql: string; params?: unknown[] }` 형태로 SQL 텍스트와 파라미터를 분리해 `pg` 드라이버의 `$1`/`$2` 플레이스홀더 방식을 그대로 쓰고 있다. `sql` 자체는 호출부(테스트 코드)가 정적으로 작성하는 문자열이라 런타임 사용자 입력이 개입할 여지가 없고, 값은 전부 `params` 배열로 바인딩된다. SQL 인젝션 우려 없음.
  - 제안: 조치 불요. 향후 이 헬퍼를 확장할 때도 `sql` 문자열에 사용자/동적 값을 직접 이어붙이지 않고 `params` 바인딩을 유지할 것.

- **[INFO]** 신규 검증 함수 둘은 순수 함수로 외부 입력·I/O 없음
  - 위치: `codebase/backend/src/shared/testing/overlap-preconditions.ts` — `assertEnoughFiresForOverlap`, `assertGuardBelowKnownTimeouts`
  - 상세: 두 함수 모두 숫자 비교만 수행하고 예외 메시지에 담기는 값(`fireCount`, `guardMs`, 상수명, 타임아웃값)은 전부 테스트 코드 내부에서 정적으로 정의된 값이다. 사용자 입력이나 신뢰 경계를 넘는 데이터가 관여하지 않으므로 인젝션·정보 노출 위험이 없다.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 전체 diff (files 1~6)
  - 상세: API 키·비밀번호·토큰·인증서 패턴을 grep 했으나 코드에 직접 포함된 시크릿은 발견되지 않았다. `review/consistency/**` 산출물에 등장하는 `password_hash`·`email_verify_token`·`password_reset_token`(SHA-256 해시 저장) 등은 기존 spec(`spec/5-system/1-auth.md`) 내용을 인용한 검토 보고서 텍스트일 뿐, 이번 diff 가 새로 도입한 코드가 아니다.
  - 제안: 조치 불요.

- **[INFO]** 인증/인가·에러 처리 노출 관련 영향 없음
  - 위치: 전체 diff
  - 상세: 이번 변경은 인증/인가 로직, 프로덕션 에러 핸들러, 암호화 로직을 전혀 건드리지 않는다. 새 `Error` 메시지(예: `assertGuardBelowKnownTimeouts` 의 throw 메시지)는 테스트 실행 시에만 노출되는 내부 타임아웃 상수명·ms 값으로, 민감정보가 아니며 프로덕션 사용자에게 도달하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 의존성 변경 없음
  - 위치: 전체 diff
  - 상세: 신규 라이브러리 추가나 버전 변경이 diff 에 없다(`@jest/globals`, `pg` 기존 의존성 재사용).
  - 제안: 조치 불요.

## 요약

이번 변경은 e2e 동시성 테스트 헬퍼의 내부 가드 로직(발사 개수 검사, 공허성 가드 타임아웃 비교)을 순수 함수로 추출하고 self-spec 으로 검증한 리팩터링으로, 프로덕션 런타임 코드·API 표면·인증/인가·암호화·의존성 어디에도 영향을 주지 않는 테스트 전용 변경이다. SQL 사용은 파라미터 바인딩을 준수하고 있고, 신규 모듈은 빌드 산출물에서 제외되어 프로덕션 공격 표면에 노출되지 않는다. 하드코딩된 시크릿, 인젝션 벡터, 인가 우회, 민감정보 노출 등 어떤 카테고리에서도 CRITICAL/WARNING 급 발견사항이 없다.

## 위험도
NONE
