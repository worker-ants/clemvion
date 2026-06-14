# 보안(Security) 리뷰 결과

## 발견사항

### 발견사항 1
- **[WARNING]** Redis 블랙리스트 검사 실패 시 fail-open 동작 — 보안 정책 완화
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `verifyPerExecution()`, `revokePerExecution()`
  - 상세: Redis가 다운되거나 ECONNREFUSED 상태일 때 blacklist 검사를 skip하고 토큰을 valid로 처리한다. 이 정책은 코드 주석과 테스트(`verifyPerExecution — Redis 가 throw 해도 fail-open`)에서 명시적 설계 의도로 확인되지만, 공격자가 Redis 장애를 유도(또는 활용)해 이미 revoke된 토큰(`revokeAllForExecution` 이후에도)을 재사용하는 시나리오가 존재한다. iext_ 토큰의 기본 TTL이 1h이므로 Redis 장애 시 최대 1h 동안 revoke된 토큰이 유효하게 취급된다.
  - 제안: 현재 spec(EIA §8.3)이 이 fail-open 정책을 인가한 것으로 보이나, 운영 환경에서 Redis 장애 알림(alert)을 반드시 구성해야 한다. 보안 민감도가 높은 배포환경이라면 Redis 미가용 시 토큰 검증 자체를 거부(fail-closed)하는 설정 옵션을 고려할 수 있다.

### 발견사항 2
- **[INFO]** dev/test 환경에서 JWT secret 미설정 시 ephemeral random 사용 — 개선된 패턴
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `DEV_EPHEMERAL_SECRET` 상수
  - 상세: 이전의 하드코딩된 `'interaction-fallback'` 고정 문자열을 `randomBytes(32).toString('hex')`로 대체한 변경이다. 모듈 로드 시 1회 생성되는 ephemeral random이라 git 이력에 예측 가능한 비밀값이 남지 않는다. prod에서는 생성자가 `NODE_ENV=production` + secret 미설정 시 throw(fail-closed)하므로 이 키는 절대 사용되지 않는다. 긍정적 보안 개선이다.
  - 제안: 현재 구현 적절. 별도 조치 불필요.

### 발견사항 3
- **[INFO]** prod fail-closed 가드 — JWT secret 미설정 시 부팅 차단
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — 생성자 내 `NODE_ENV === 'production'` 분기
  - 상세: `NODE_ENV=production`에서 JWT secret이 없으면 `Error`를 throw해 애플리케이션 부팅을 차단한다. OAUTH_STUB_MODE 패턴과 동일하게 secure-by-default를 강제한다. 테스트(`NODE_ENV=production + secret 전무 → 생성자 throw`)가 이 동작을 검증하고 있다.
  - 제안: 현재 구현 적절. 별도 조치 불필요.

### 발견사항 4
- **[INFO]** per-trigger 토큰 timing-safe 비교
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `verifyPerTrigger()` 메서드
  - 상세: `timingSafeEqual()`로 SHA-256 해시를 비교해 타이밍 사이드채널을 차단한다. 길이가 다른 두 토큰도 hash 비교로 통일해 길이 정보 누출을 방지한다. 긍정적 보안 패턴이다.
  - 제안: 현재 구현 적절. 별도 조치 불필요.

### 발견사항 5
- **[INFO]** executionId URL 파라미터 UUID 검증
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` — 모든 핸들러의 `@Param('executionId', new ParseUUIDPipe())`
  - 상세: `ParseUUIDPipe`를 통해 UUID 형식이 강제되어 경로 인젝션 및 임의 문자열 주입을 차단한다.
  - 제안: 현재 구현 적절. 별도 조치 불필요.

### 발견사항 6
- **[INFO]** 에러 메시지의 민감 정보 노출 범위
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `revokePerExecution()`, `reconcileTerminalRevocations()` 내 `logger.warn` 호출
  - 상세: 에러 로그에 `err.message`를 포함한다. Redis 연결 오류 메시지에는 host/port 정보가 포함될 수 있으나, 이 로그는 서버 사이드 로그로 클라이언트에 노출되지 않는다. warn 로그의 jti 값 노출은 이미 revoke 요청 컨텍스트 내 값이므로 추가 위험이 낮다.
  - 제안: 현재 범위 적절. 클라이언트 응답에 내부 에러 메시지가 노출되지 않는지 InteractionService 레이어에서 추가 확인 권장.

### 발견사항 7
- **[INFO]** BullMQ job 잔존 정책 — 실패 job 7일 보존
  - 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` — `REMOVE_ON_FAIL_AGE_SEC = 7 * 24 * 60 * 60`
  - 상세: 실패한 reconciliation job이 7일간 BullMQ(Redis)에 보존된다. 현재 RECONCILE_JOB 이름만 job에 기록되고 실제 execution 데이터는 worker가 DB에서 직접 조회하므로 위험이 낮다.
  - 제안: 현재 구현 적절. 별도 조치 불필요.

## 요약

이번 변경은 하드코딩된 JWT fallback secret(`'interaction-fallback'`)을 ephemeral random으로 대체하고, production 환경에서 secret 미설정 시 fail-closed 동작을 추가한 보안 개선이 핵심이다. per-trigger 토큰의 timing-safe 비교, UUID pipe를 통한 입력 검증, blacklist 키 네임스페이스 분리도 적절히 구현되어 있다. 주목할 유일한 설계 트레이드오프는 Redis 장애 시 blacklist 검사를 skip하는 fail-open 정책으로, 이는 spec에서 인가된 graceful degrade 전략이나 운영 환경에서 Redis 장애 모니터링 및 신속 복구가 필수적이다. 하드코딩된 시크릿, SQL 인젝션, XSS, 커맨드 인젝션, 인가 우회, 불안전한 암호화 알고리즘 등의 취약점은 발견되지 않았다.

## 위험도

LOW
