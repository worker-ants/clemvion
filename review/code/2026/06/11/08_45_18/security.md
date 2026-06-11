### 발견사항

- **[INFO]** refresh 토큰 rotation의 원자화 구현 자체는 보안 관점에서 올바른 방향
  - 위치: `auth.service.ts` `refresh()` 메서드
  - 상세: 구 토큰 revoke(UPDATE) + 신규 토큰 INSERT를 `dataSource.transaction`으로 묶어 중간 실패 시 세션 소실을 방지한다. 보안 취약점을 해결하는 변경이며 그 자체로는 새로운 취약점을 도입하지 않는다.
  - 제안: 유지.

- **[WARNING]** `generateTokens` 시그니처에 optional `manager?: EntityManager` 추가 — trust boundary 확장
  - 위치: `auth.service.ts` `generateTokens()` (private 메서드)
  - 상세: `manager`가 외부에서 주입될 경우 호출자가 어떤 EntityManager든 전달할 수 있어 의도치 않은 트랜잭션 컨텍스트에서 토큰이 INSERT될 가능성이 있다. 현재는 `private` 메서드이므로 외부 직접 호출은 불가능하지만, 미래에 `protected`나 `public`으로 승격되거나 내부 리팩터링 시 위험이 증가한다.
  - 제안: 트랜잭션 경로를 별도 `private generateTokensInTransaction(manager, ...)` 메서드로 분리해 일반 경로와 명시적 분리를 유지하거나, JSDoc에 `@internal` 명시를 추가해 승격 억제를 문서화할 것을 권장한다.

- **[WARNING]** `refresh()` 내 만료 검증이 트랜잭션 밖에서 수행되어 TOCTOU(Time-of-check/Time-of-use) 창 존재
  - 위치: `auth.service.ts` `refresh()` — `new Date() > stored.expiresAt` 비교 후 트랜잭션 진입
  - 상세: 만료 검증은 트랜잭션 시작 전에 수행되고, 이후 `dataSource.transaction` 내부에서 UPDATE/INSERT가 실행되기까지 극소의 시간 창이 있다. 만료 경계에서 경쟁 조건이 이론적으로 가능하나 현실적 공격 벡터는 매우 좁다. 원칙적으로 만료 검증을 트랜잭션 내에서 원자화하는 것이 바람직하다.
  - 제안: UPDATE 쿼리에 `WHERE id = stored.id AND is_revoked = false AND expires_at > NOW()` 조건을 추가하고, UPDATE `affected` 가 0이면 토큰 무효로 처리하는 방식으로 TOCTOU를 제거할 수 있다.

- **[INFO]** `checkEmail` 엔드포인트는 이메일 존재 여부를 직접 노출 — throttle 컨트롤러 적용 확인 필요
  - 위치: `auth.service.ts` `checkEmail()`
  - 상세: `{ available: true/false }` 반환은 설계상 의도된 기능이다. spec에 5 req/min 제한이 문서화되어 있으나 이번 변경에서 컨트롤러가 포함되지 않아 throttle 실제 적용 여부를 직접 검증하지 못했다.
  - 제안: 컨트롤러에 `@Throttle` 데코레이터 적용 여부를 별도 확인할 것. 이번 diff 범위 밖이다.

- **[INFO]** 트랜잭션 실패 시 일반 `Error`가 클라이언트에 원문 노출될 가능성 — 예외 필터 계층 확인 필요
  - 위치: `auth.service.ts` `refresh()` — `dataSource.transaction` reject 전파
  - 상세: `refreshRepo.save` 실패 시 NestJS `HttpException`이 아닌 일반 `Error`가 전파된다. 글로벌 예외 필터가 이를 500으로 래핑하지 않으면 내부 DB 에러 메시지가 클라이언트에 그대로 직렬화될 수 있다.
  - 제안: 글로벌 예외 필터에서 `Error` 인스턴스의 `message`가 클라이언트에 직렬화되지 않도록 보장해야 한다. 이번 변경 범위 밖이나 인지 필요.

- **[INFO]** SHA-256 해시를 토큰 저장에 사용 — 적절
  - 위치: `auth.service.ts` `hashToken()`
  - 상세: 이메일 검증 토큰, 비밀번호 재설정 토큰, refresh 토큰 모두 SHA-256 해시를 DB에 저장하고 raw 값을 메일/클라이언트에 전달한다. UUID v4 기반 랜덤 토큰(128비트 엔트로피)에 SHA-256 적용은 표준 보안 관행이다. bcrypt 12 라운드 패스워드 해시도 적절하다.
  - 제안: 유지.

- **[INFO]** 테스트 파일 내 `'valid-refresh-token'`, `'mock-access-token'`, `'test-value'` 등은 테스트 전용 더미 값 — 하드코딩 시크릿 아님
  - 위치: `auth.service.spec.ts` 전체
  - 상세: 프로덕션 시크릿이 코드에 포함되지 않는다.
  - 제안: 유지.

---

### 요약

이번 변경의 핵심은 `refresh()` 메서드에서 구 토큰 revoke와 신규 토큰 INSERT를 단일 `dataSource.transaction`으로 원자화한 것으로, 세션 소실 버그를 수정하는 보안 개선 변경이다. 새롭게 도입된 실질적 보안 취약점은 없다. 주요 주의 사항은 두 가지다: (1) `generateTokens`에 optional `EntityManager`를 추가하면서 현재 `private` 경계 내에서는 안전하나, 향후 호출 범위 확장 시 trust boundary가 희석될 수 있으므로 트랜잭션 경로를 별도 메서드로 분리할 것을 권장한다; (2) 만료 검증과 실제 revoke UPDATE 사이의 TOCTOU 창은 매우 좁지만 이론적으로 존재하며, UPDATE WHERE 절에 만료 조건을 포함하는 방식으로 완전히 원자화할 수 있다. 인증/인가 핵심 로직(bcrypt, SHA-256 해싱, reuse 탐지, enumeration 방지 응답 균일화)은 모두 올바르게 유지되고 있다.

---

### 위험도

LOW
