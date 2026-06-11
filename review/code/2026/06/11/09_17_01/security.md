# 보안(Security) 리뷰 — auth-refresh-rotation-atomic (05 C-1)

## 발견사항

- **[INFO]** refresh 토큰 회전 원자화 구현 자체는 보안 관점에서 올바른 방향
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` `refresh()` 메서드
  - 상세: 구 토큰 revoke(UPDATE) + 신규 토큰 INSERT 를 `dataSource.transaction` 으로 묶어 중간 실패 시 세션 소실을 방지한다. 기존 구현의 비원자성 세션 소실 취약점을 수정하는 변경이며, 이번 diff 에서 새로운 보안 취약점을 도입하지 않는다.
  - 제안: 유지.

- **[INFO]** TOCTOU 창은 조건부 UPDATE 로 이미 해소됨 — 이전 리뷰 W2 반영 완료
  - 위치: `auth.service.ts` `refresh()` — `manager.getRepository(RefreshToken).update({ id: stored.id, isRevoked: false, expiresAt: MoreThan(now) }, ...)`
  - 상세: 이전 리뷰 세션(`review/code/2026/06/11/08_45_18/`)의 W2(TOCTOU) 권고가 본 변경에서 완전히 반영됐다. revoke UPDATE 의 WHERE 조건에 `isRevoked: false` 와 `expiresAt: MoreThan(now)` 가 포함되어 있어, findOne → 검증 → UPDATE 사이의 동시 요청 이중 회전 창이 DB 단에서 차단된다. `affected = 0` 시 `TOKEN_INVALID` 로 즉각 거부하고 신규 토큰 미발급 처리도 올바르다.
  - 제안: 유지.

- **[INFO]** `generateTokens` optional `manager` 파라미터 — trust boundary 확장 위험 최소화됨
  - 위치: `auth.service.ts` `generateTokens()` private 메서드
  - 상세: 이전 리뷰 W1 권고대로 JSDoc `@internal` 과 "public 승격 금지" 가 명시됐다. 현재 `private` 경계를 유지하는 한 외부 직접 호출이 불가능하고 의도치 않은 트랜잭션 컨텍스트에서 토큰 INSERT 가 발생할 경로가 없다. TypeScript `private` 는 컴파일 타임 보호이며 런타임 직렬화(JSON 직렬화, 리플렉션 등)로 우회 가능하지만, NestJS 서비스 클래스 컨텍스트에서는 실질적 위험이 없다.
  - 제안: 유지. 향후 해당 메서드를 `protected` 또는 `public` 으로 승격하는 경우 트랜잭션 경로를 별도 메서드로 분리하는 것을 권장한다.

- **[INFO]** SHA-256 토큰 해시 및 bcrypt 패스워드 해시 — 암호화 적절
  - 위치: `auth.service.ts` `hashToken()` 및 패스워드 처리
  - 상세: refresh 토큰은 UUID v4(128비트 엔트로피)로 생성된 raw 값을 SHA-256 해시로 DB 에 저장한다. 이 패턴은 표준 보안 관행이다. 패스워드는 bcrypt(12 라운드)를 사용하며 적절하다. 이번 diff 에서 암호화 로직 변경은 없다.
  - 제안: 유지.

- **[INFO]** 트랜잭션 실패 시 일반 `Error` 가 클라이언트에 원문 노출될 가능성
  - 위치: `auth.service.ts` `refresh()` — `dataSource.transaction` reject 전파 경로
  - 상세: `refreshRepo.save` 실패 시 NestJS `HttpException` 이 아닌 일반 `Error` 가 그대로 전파된다. 글로벌 예외 필터가 `Error.message` 를 클라이언트에 직렬화하지 않도록 처리해야 내부 DB 에러 메시지(테이블명, 컬럼명, 제약 조건명 등 스키마 정보)가 외부 노출되지 않는다. 이번 변경이 새로 만든 노출 경로가 아니라 기존 예외 전파 패턴과 동일하나, `dataSource.transaction` 내부에서 새로운 에러 전파 경로가 추가된 것은 사실이다.
  - 제안: 글로벌 예외 필터(`HttpExceptionFilter` 또는 이에 준하는 필터)에서 `instanceof HttpException` 이 아닌 경우 `Internal Server Error` 로 래핑하고 원본 `message` 를 응답 바디에 포함하지 않도록 보장할 것. 이번 변경 범위 밖이나 인지 및 확인 필요.

- **[INFO]** 테스트 파일 내 더미 값 — 하드코딩 시크릿 없음
  - 위치: `auth.service.spec.ts` 전체
  - 상세: `'valid-refresh-token'`, `'raced-refresh-token'`, `'expired-refresh-token'`, `'insert failed'` 등은 모두 테스트 전용 더미 값이며 프로덕션 시크릿이 아니다. API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 실제 시크릿은 발견되지 않는다.
  - 제안: 유지.

- **[INFO]** 인증 우회 가능성 없음 — 세 분기 모두 적절히 거부 처리
  - 위치: `auth.service.ts` `refresh()` — reuse 탐지 분기, 만료 분기, 정상 회전 분기
  - 상세: (1) `isRevoked: true` 인 토큰 재사용 시 family 전체 revoke + `TOKEN_INVALID` 거부, (2) 만료 토큰은 트랜잭션 진입 전 `TOKEN_EXPIRED` 거부, (3) 정상 회전 시 조건부 UPDATE 의 `affected = 0` (동시 회전 또는 만료 경계) 시 `TOKEN_INVALID` 거부, (4) `stored.user` 가 없는 데이터 손상 케이스에 `TOKEN_INVALID` 거부 가드가 추가됐다. 네 가지 비정상 경로 모두 `UnauthorizedException` 으로 안전하게 처리된다.
  - 제안: 유지.

---

## 요약

이번 변경(05 C-1)은 `refresh()` 메서드의 구 토큰 revoke(UPDATE) + 신규 토큰 INSERT 를 `dataSource.transaction` 으로 원자화하는 보안 개선이다. 이전 리뷰 세션의 W2(TOCTOU) 권고가 조건부 UPDATE(`isRevoked: false AND expiresAt > now`)로 완전히 반영됐고, W1(trust boundary) 권고도 `@internal` JSDoc 명시로 수용됐다. 새로운 Critical 또는 Warning 등급의 보안 취약점은 발견되지 않는다. 유일한 잔여 주의 사항은 트랜잭션 실패 시 일반 `Error` 메시지가 클라이언트에 노출될 수 있는 경로로, 이는 글로벌 예외 필터 계층에서 처리해야 할 기존 패턴과 동일한 문제이며 이번 변경이 새로 만든 경로가 아니다. 인증/인가 핵심 로직(bcrypt, SHA-256, reuse 탐지, family revoke, enumeration 방지)은 모두 올바르게 유지되고 있다.

---

## 위험도

LOW
