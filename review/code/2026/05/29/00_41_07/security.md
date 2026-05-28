# 보안(Security) 리뷰 결과

리뷰 대상 커밋: `840db52d` — `fix(external-interaction): terminal jti revoke 를 notification config 게이트 위로 hoist`

---

## 발견사항

### 인젝션 취약점

- **[INFO]** 인젝션 취약점 없음
  - 위치: 전 파일
  - 상세: 변경된 코드는 테스트 파일 2개 + 프로덕션 서비스 파일 1개. DB 접근은 TypeORM Repository API(`findOne`, `delete`, `insert`)만 사용하며 raw query 없음. Redis 접근도 `SET`/`GET` primitive API 사용. 사용자 입력이 쿼리 문자열로 직접 삽입되는 경로 없음.

---

### 하드코딩된 시크릿

- **[WARNING]** 테스트 코드 내 토큰 유사 리터럴 — 저위험
  - 위치: `interaction.guard.spec.ts` L159, L244, L310, L312
  - 상세: `'Bearer iext_xxx'`, `'Bearer itk_secret'`, `'itk_correct'`, `'itk_wrong'` 등의 리터럴이 테스트 픽스처로 사용된다. 이는 실제 시크릿이 아니고 mock 환경에서 모양 검증용이므로 기능적 위험은 없다. 그러나 `itk_secret`이라는 이름이 실 운영 값처럼 보여 혼동 가능성이 있다.
  - 제안: 테스트 픽스처 토큰은 `itk_test_fixture_only` 처럼 목적이 명확한 이름을 사용하면 코드 읽기 시 혼동을 줄일 수 있다. 보안 블로커 수준은 아님.

- **[INFO]** `interaction-token.service.ts` L136 fallback secret
  - 위치: `interaction-token.service.ts` L136 (`this.secret = envSecret ?? 'interaction-fallback'`)
  - 상세: 이 변경에서 수정된 코드는 아니지만 리뷰 맥락에서 확인. 환경변수 미설정 시 `'interaction-fallback'`이라는 고정 문자열이 JWT 서명 시크릿으로 사용된다. warn 로그가 있어 인지는 가능하나, 프로덕션 배포 체크리스트에서 이 환경변수 강제화가 필요하다. 본 커밋에서 신규 도입된 것은 아님.

---

### 인증/인가

- **[INFO]** EIA-AU-04 미충족 버그 수정 — 보안 개선
  - 위치: `notification-fanout.service.ts` L89–L100 (hoist 된 revoke 블록)
  - 상세: 핵심 변경은 `revokeAllForExecution` 호출을 notification 게이트 early return 이전으로 이동시킨 것이다. 이전 구현에서는 `notification` 미설정 트리거(interaction-only)가 terminal 이벤트를 수신해도 토큰이 revoke되지 않아 1시간 만료 전까지 유효한 상태로 유지되었다. 이번 수정으로 모든 terminal 이벤트에서 토큰 무효화가 보장된다.
  - 제안: 수정 방향이 올바름. 추가 제언 없음.

- **[WARNING]** revoke fail-open 정책 — 제한적 위험 존재
  - 위치: `notification-fanout.service.ts` L104–L111 (catch 블록)
  - 상세: `revokeAllForExecution` 예외 시 warn 로그 후 진행한다(fail-open). Redis 장애 또는 DB 장애 시 terminal 이벤트가 발생해도 실제 revoke가 이루어지지 않는다. 이 경우 이미 종료된 execution에 대해 최대 1시간(IEXT_DEFAULT_TTL_SEC) 동안 토큰이 유효 상태로 남는다.
  - 제안: fail-open 정책은 가용성 우선 설계로서 명시적 의도이고 코드 주석/스펙에도 기술되어 있다. 다만 revoke 실패를 단순 warn이 아닌 별도 알람 채널(Sentry, PagerDuty 등)로 에스컬레이션하는 모니터링을 권장한다. 토큰 TTL을 현재 1h에서 단축하는 것도 잔여 위험 축소 방법이다.

- **[INFO]** InteractionGuard — `blacklisted` reason 매핑 검증
  - 위치: `interaction.guard.ts` L175–L176 (`mapReason`)
  - 상세: 신규 테스트 케이스가 검증하는 `blacklisted` → `TOKEN_REVOKED` 매핑이 프로덕션 코드(`mapReason`)에 이미 구현되어 있음을 확인. 테스트와 프로덕션 코드 간 불일치 없음.

---

### 입력 검증

- **[INFO]** `triggerId` 검증 충분
  - 위치: `notification-fanout.service.ts` L88–L98
  - 상세: `typeof triggerId !== 'string' || triggerId.length === 0` 검사가 revoke 블록보다 앞에 위치해 triggerId 없는 manual 실행에서는 revoke를 호출하지 않는다. 불필요한 DB 쿼리와 revoke 오작동을 적절히 방어함.

- **[INFO]** 테스트 코드 내 `as never` 타입 캐스팅
  - 위치: `notification-fanout.service.spec.ts` L419–L420, `interaction.guard.spec.ts` L128–L130
  - 상세: mock 객체를 `as never`로 캐스팅하여 타입 검사를 우회한다. 테스트 파일에 국한된 패턴으로 프로덕션 보안에는 영향 없음.

---

### OWASP Top 10

- **[INFO]** A07: Identification and Authentication Failures — 부분 해소
  - 상세: 이번 커밋의 핵심이 token revocation 보장이므로 OWASP A07 범주 개선에 해당. broken authentication 시나리오 중 "종료된 세션/토큰이 계속 유효" 패턴을 차단함.

- **[INFO]** A09: Security Logging and Monitoring Failures
  - 위치: `notification-fanout.service.ts` L107–L110
  - 상세: revoke 실패 시 `this.logger.warn`만 남긴다. 앞서 언급했듯 알람 연동이 없으면 조용히 실패할 수 있다.

---

### 암호화

- **[INFO]** 암호화 관련 변경 없음
  - 상세: 이번 diff에서 암호화 알고리즘 변경 없음. 기존 `HS256` JWT + `timingSafeEqual` 비교 + `sha256` 해싱 패턴은 이전 커밋에서 확립된 것으로 적절하다.

---

### 에러 처리

- **[WARNING]** 에러 메시지에 내부 오류 정보 포함
  - 위치: `notification-fanout.service.ts` L109 (`err.message`)
  - 상세: `revokeAllForExecution 실패 — fail-open: ${err.message}` 형태로 에러 메시지가 로그에 기록된다. 이 로그는 외부 응답에 노출되지 않고 서버 내부 Logger로만 기록되므로 직접적인 정보 노출 위험은 없다. 단, 로그 수집 시스템이 외부에 접근 가능한 경우 Redis 연결 정보(host:port 등)가 에러 메시지에 포함될 수 있으므로 로그 접근 권한 관리가 필요하다.
  - 제안: `err.message` 대신 에러 코드 또는 분류 정보만 로깅하는 방안을 장기적으로 고려. 현재 수준은 운영 허용 범위.

- **[INFO]** 에러 처리 패턴 일관성
  - 상세: `err instanceof Error ? err.message : String(err)` 패턴이 일관되게 사용되어 non-Error 예외 처리 시 런타임 오류가 발생하지 않는다.

---

### 의존성 보안

- **[INFO]** 신규 의존성 없음
  - 상세: 이번 변경에서 새로운 npm 패키지가 추가되지 않았다. 기존 `jsonwebtoken`, `ioredis`, `typeorm` 의존성은 이전 커밋에서 도입된 것.

---

## 요약

이번 커밋은 terminal 이벤트 시 iext JTI 무효화가 outbound notification 설정 유무와 독립적으로 반드시 수행되도록 실행 순서를 수정하는 보안 버그 픽스이다. 핵심 변경(revoke 호출 hoist)은 EIA-AU-04 요구사항 충족을 위한 올바른 방향이며, 신규 단위 테스트가 회귀를 차단하는 구조로 잘 구성되어 있다. 주요 잔여 위험은 Redis/DB 장애 시 revoke가 조용히 실패하는 fail-open 정책으로, 운영 알람 미비 시 인지 지연이 발생할 수 있다. 하드코딩된 실 시크릿은 없으며, 인젝션·암호화·에러 노출 관련 신규 취약점은 발견되지 않았다.

---

## 위험도

LOW
