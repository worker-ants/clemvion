### 발견사항

- **[WARNING]** JWT secret fall-back 으로 dev 환경에서 고정 평문 문자열 사용
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — constructor, `this.secret = envSecret ?? 'interaction-fallback'`
  - 상세: `NODE_ENV !== 'production'` 인 환경(dev/test/CI)에서 `INTERACTION_JWT_SECRET` 과 `JWT_SECRET` 이 모두 미설정이면 `'interaction-fallback'` 이라는 고정 평문이 HS256 서명 키로 사용된다. 이 fallback 문자열은 코드에 하드코딩되어 버전 관리 이력에 노출된다. dev 브랜치 이미지가 외부 스테이징 환경에 잘못 배포되거나, CI 에서 발급된 토큰이 유출되면 공격자가 동일 시크릿으로 임의 토큰을 위조할 수 있다.
  - 제안: fallback 을 완전히 제거하고 `NODE_ENV` 무관하게 시크릿 미설정 시 서비스 기동을 거부(throw)하는 것이 가장 안전하다. 테스트 환경에서는 각 테스트 스위트에서 직접 `randomBytes(32).toString('hex')` 를 생성하여 주입(spec 파일의 `TEST_SECRET` 패턴과 동일)하고 코드베이스에 고정 시크릿이 남지 않도록 한다.

- **[WARNING]** reconcileTerminalRevocations batchLimit 파라미터 상한 미검증 — 잠재적 자원 고갈
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `async reconcileTerminalRevocations(batchLimit = 500)` 시그니처
  - 상세: `batchLimit` 에 상한 검증이 없다. 현재 유일한 호출자(`TerminalRevokeReconcilerService.reconcile()`)는 인수를 전달하지 않아 즉각적 위험은 없으나, 메서드가 public 이라 이후 코드에서 거대한 값을 전달하면 DB 에 상한 없는 LIMIT 쿼리가 발생하고 결과 셋 메모리 부하 및 Redis 집중 쓰기로 서비스 가용성이 저하될 수 있다.
  - 제안: 메서드 첫 줄에 `const safeLimit = Math.min(Math.max(1, batchLimit), 1000)` 을 추가하여 상하한을 강제한다.

- **[WARNING]** fail-open revoke 실패 — 메트릭 미수집으로 관찰 가능성 부재
  - 위치: `interaction-token.service.ts` — `revokePerExecution`, `revokeAllForExecution`, `reconcileTerminalRevocations` 의 catch 블록 전반; `terminal-revoke-reconciler.service.ts` — `reconcile()` catch 블록
  - 상세: execution 종료 후 Redis SET 실패 또는 DB find/delete 실패가 발생하면 해당 jti 는 blacklist 에 등록되지 않고 토큰이 최대 1시간(IEXT_DEFAULT_TTL_SEC) 동안 유효한 채로 남는다. 이는 의도적 트레이드오프로 spec §3.4 EIA-RL-06 에 문서화되어 있으나, 현재 `logger.warn` 만 남기고 메트릭을 수집하지 않는다. 대량 revoke 실패가 발생해도 운영자가 인지하지 못하는 상황이 발생할 수 있다.
  - 제안: `revoke_failure_total` Prometheus 카운터(또는 동등 메트릭)를 revoke 실패마다 증가시키고, 임계치 초과 시 알람을 발화한다. spec plan 에서도 권고된 사항이며, reconciler 의 분 단위 재시도가 이미 구현되어 있어 근본 완화는 갖춰져 있다.

- **[INFO]** 에러 로그에 executionId 포함
  - 위치: `interaction-token.service.ts` — `reconcileTerminalRevocations` warn 로그: `` `reconcile revoke 실패 (executionId=${executionId})` ``
  - 상세: executionId 는 외부 공개 API 에서도 사용되는 값이므로 자체로는 민감 정보 노출이 아니다. 로그 수집 시스템의 접근 권한이 적절히 제한되어 있다면 실제 위험 낮음.
  - 제안: 로그 접근 제어 정책을 재검토하는 수준으로 충분. 코드 변경 불필요.

- **[INFO]** BullMQ 큐 인증·인가는 인프라 의존
  - 위치: `terminal-revoke-reconciler.service.ts` — BullMQ queue 등록 및 process 핸들러
  - 상세: 큐는 Redis 를 통해 내부에서만 접근 가능하고 외부 API 에 노출되지 않으므로 직접적인 취약점은 아니다. Redis 접근 권한이 느슨하면 공격자가 큐에 임의 잡을 삽입해 reconcile 을 과도 실행시킬 수 있다.
  - 제안: Redis 를 VPC 내부로 제한하고 인증(requirepass / ACL)을 적용한다. 코드 수준 변경 불필요.

### 요약

이번 변경(EIA interaction 토큰 terminal revoke at-least-once 보강 — `TerminalRevokeReconcilerService` + `reconcileTerminalRevocations` 신설)은 전반적으로 보안 관점에서 양호하다. SQL 인젝션은 TypeORM parameterized 쿼리(`:...terminal` 바인딩)로 방어되고 있으며, 프로덕션 환경에서는 JWT 시크릿 미설정 시 즉시 throw 하는 fail-closed 가드가 작동한다. 인증 우회 가능성은 별도 `InteractionGuard` 에서 처리되어 본 파일 범위를 벗어난다. 주요 위험은 dev/CI 환경에서 `'interaction-fallback'` 고정 시크릿이 버전 이력에 노출되는 점(WARNING), 대량 revoke 실패 시 메트릭 미수집으로 운영자가 인지 불가한 점(WARNING), `batchLimit` 상한 미검증으로 인한 잠재적 DB 과부하(WARNING) 세 가지다. CRITICAL 에 해당하는 취약점(인증 우회, 직접적 시크릿 노출, 알려진 취약 라이브러리 사용)은 발견되지 않았다.

### 위험도

MEDIUM
