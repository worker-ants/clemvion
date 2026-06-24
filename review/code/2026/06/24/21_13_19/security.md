### 발견사항

- **[INFO]** 로그 인젝션 방어 — `sanitizeForLog` 존재 및 적절한 적용
  - 위치: `continuation-bus.service.ts` `sanitizeForLog()` (라인 705–708), `publish()` 내 logger.error 호출
  - 상세: `sanitizeForLog`가 제어문자(\x00-\x1F, \x7F)를 공백으로 치환하고 200자 최대 길이를 적용한다. `publish()` 내 `msg.type`과 `msg.executionId`를 로그에 기록할 때 이 함수를 통과시킨다. 로그 포맷 인젝션 공격(CRLF 주입 포함)에 대한 방어가 적절히 구현되어 있다.
  - 제안: 현재 구현 유지. `acquireLock` / `releaseLock` 의 `key` 파라미터도 `sanitizeForLog`를 거치므로 일관성 양호.

- **[INFO]** Redis Lua 스크립트 — 파라미터화된 eval 사용으로 인젝션 위험 없음
  - 위치: `continuation-bus.service.ts` `releaseLock()` (라인 685–689)
  - 상세: Lua 스크립트가 리터럴 문자열로 하드코딩되어 있고, `key`와 `this.lockToken`이 KEYS/ARGV 배열로 전달된다. 사용자 입력이 스크립트 본문에 직접 삽입되지 않으므로 Lua 인젝션 위험이 없다. `client.eval(script, 1, key, this.lockToken)` 형태로 ioredis의 파라미터 바인딩을 올바르게 사용하고 있다.
  - 제안: 현재 구현 유지.

- **[INFO]** 분산 락 토큰 — `randomUUID()` + hostname 조합으로 추측 불가
  - 위치: `continuation-bus.service.ts` 라인 543
  - 상세: `lockToken = \`${hostname()}:${randomUUID()}\`` 는 `node:crypto`의 암호학적으로 안전한 UUID를 사용한다. `Math.random()` 기반이 아니므로 락 토큰 위조 공격에 안전하다.
  - 제안: 현재 구현 유지.

- **[INFO]** M-7 random fallback 제거 — 보안상 긍정적 변경
  - 위치: `continuation-bus.service.ts` `nextSeq()` (변경 전 랜덤 fallback 제거)
  - 상세: 기존 `Math.random()` 기반 seq fallback은 암호학적으로 안전하지 않을 뿐 아니라 jobId 충돌/dedup 무력화를 통해 중복 job 처리 공격 벡터가 될 수 있었다. 이번 변경으로 INCR 실패 시 null을 반환하고 호출자가 재시도하도록 유도하므로 보안 및 정합성 양면에서 개선이다.
  - 제안: 현재 변경 방향 유지.

- **[INFO]** 에러 메시지 — 내부 정보 노출 수준 적절
  - 위치: `executions.service.ts` `stop()` WAITING 분기, `continuation-bus.service.ts` `publish()` logger.error
  - 상세: 503 응답 본문의 `message` 필드는 "Cancel could not be queued (continuation bus unavailable). Please retry." — Redis 장애 여부를 일반적으로 노출하지만 내부 스택 트레이스나 연결 문자열은 포함하지 않는다. `publish()`의 logger.error는 서버 사이드 전용이며 응답에 포함되지 않는다. `error-codes.ts`의 `ErrorCode` 주석에도 `EXECUTION_INTERNAL_ERROR`의 경우 내부 error.message/stack이 클라이언트에 전송되지 않는다는 leak-block 게이트 언급이 있다.
  - 제안: 503 응답 메시지에 "continuation bus unavailable"이라는 내부 인프라 힌트가 포함되어 있다. 운영 환경에서 공격자에게 Redis 의존 여부를 알릴 수 있다. 위험도가 낮지만 "Service temporarily unavailable. Please retry." 수준으로 일반화할 수 있다. 현재 수준은 클라이언트 재시도 유도 목적상 허용 범위 내로 판단한다.

- **[INFO]** 하드코딩된 시크릿 — 없음
  - 상세: 코드 전체에서 API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 발견되지 않는다. Redis 연결 설정은 `RedisConnectionProvider`를 통해 외부에서 주입된다.

- **[INFO]** 입력 검증 — `executionId`는 서비스 내부에서 생성되거나 상위 레이어에서 검증
  - 위치: `continuation-bus.service.ts`, `executions.service.ts`
  - 상세: `publish()`로 전달되는 `executionId`는 사용자 직접 입력이 아닌 서비스 레이어 내부 값이다. Redis 키 prefix(`exec:cont:seq:`)에 `executionId`가 직접 삽입되나, Redis 키 자체는 인젝션 취약점이 없다(키 연산은 ioredis 라이브러리가 프로토콜 수준에서 안전하게 처리). 상위 REST 레이어에서 `id` 파라미터 검증이 이루어지는지는 이번 변경 범위 외이며 기존 검증 체계에 의존한다.
  - 제안: 이번 변경 범위 외. 기존 REST 레이어의 UUID 형식 검증이 유지된다면 문제없다.

### 요약

이번 변경(C-1+M-7)은 보안 관점에서 전반적으로 긍정적이다. M-7에서 `Math.random()` 기반 seq fallback을 제거함으로써 jobId 충돌을 통한 dedup 무력화 가능성이 차단되었고, C-1에서 fire-and-forget 패턴을 제거하여 Redis 장애 시 에러가 유실되지 않고 503으로 표면화된다. Lua 스크립트는 파라미터 바인딩을 올바르게 사용하고, 로그 인젝션 방어(`sanitizeForLog`)가 일관되게 적용되며, 분산 락 토큰은 암호학적으로 안전한 UUID를 사용한다. 하드코딩된 시크릿은 없다. 503 응답 메시지에 "continuation bus unavailable"이라는 내부 인프라 힌트가 포함된 점은 주의 수준의 관찰이나 클라이언트 재시도 유도 목적상 허용 범위 내이다. 신규 취약점이나 보안 회귀는 없다.

### 위험도

NONE
