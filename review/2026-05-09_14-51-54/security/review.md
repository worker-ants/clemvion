### 발견사항

---

**[WARNING] 로그 인젝션 — 신규 가드 코드의 미검증 값 삽입**
- 위치: `continuation-bus.service.ts` — `publish()` 추가 블록, `acquireLock()` 추가 블록, `releaseLock()` 추가 블록
- 상세: `dispatch()` 메서드는 이미 로그 인젝션 방어를 구현하고 있다(`/[\x00-\x1F\x7F]/g` strip). 그러나 이번에 추가된 세 가드 블록은 `msg.type`, `msg.executionId`, `key` 값을 그대로 템플릿 리터럴에 삽입한다. Redis pub/sub 채널은 외부에서 직접 메시지를 주입할 수 있는 경계이므로, 제어 문자나 개행(`\n`)이 포함된 `executionId`가 수신되면 로그 포맷이 오염될 수 있다.

  ```typescript
  // 위험: msg.executionId 가 "id\nERROR [Auth] password=..." 같은 값이면 로그 위조
  this.logger.error(
    `Continuation publish 실패 (${msg.type} / ${msg.executionId}): ...`,
  );
  ```

- 제안: `dispatch()`의 sanitize 패턴을 공유 헬퍼로 추출하거나, 가드 블록 내 로그에도 동일하게 적용한다.

  ```typescript
  const sanitize = (v: string) =>
    String(v).slice(0, 100).replace(/[\x00-\x1F\x7F]/g, ' ');

  this.logger.error(
    `Continuation publish 실패 (${sanitize(msg.type)} / ${sanitize(msg.executionId)}): ...`,
  );
  ```

---

**[INFO] 분산 lock 토큰 — 보안 수준 적절**
- 위치: `continuation-bus.service.ts:lockToken`
- 상세: `hostname() + randomUUID()` 조합을 사용하며, `randomUUID()`는 `node:crypto` 기반의 CSPRNG를 사용한다. 컨테이너 환경에서 PID 충돌 문제를 정확히 회피하는 올바른 접근이다. 추가 지적 없음.

---

**[INFO] Lua 스크립트 — 파라미터 바인딩 사용으로 인젝션 없음**
- 위치: `continuation-bus.service.ts:releaseLock()`
- 상세: `KEYS[1]`/`ARGV[1]` 방식으로 키와 토큰을 분리 전달하므로 Redis Lua 인젝션 위험 없음.

---

**[INFO] 에러 메시지의 민감 정보 노출 수준 — 허용 범위**
- 위치: 신규 가드 블록 전반
- 상세: 로그에 노출되는 `key`(`exec:recover:lock` 같은 내부 상수)와 `executionId`는 운영자 대상 서버 로그에만 기록된다. 클라이언트에 직접 노출되는 경로는 없으므로 정보 유출 위험은 낮다.

---

**[INFO] 테스트 코드의 내부 필드 접근 — 보안 영향 없음**
- 위치: `continuation-bus.service.spec.ts` — `publisher 미초기화 가드` describe
- 상세: `bus as unknown as { publisher?: unknown }` 캐스팅으로 `private` 필드를 조작하나, 이는 테스트 전용 코드다. `try/finally`로 원복을 보장해 다른 테스트 오염이 없다.

---

### 요약

이번 변경은 NestJS 라이프사이클 race condition을 해결하기 위한 방어적 가드 추가와 `onApplicationBootstrap`으로의 호출 시점 이동이 핵심이다. 보안 관점에서 가장 주의할 부분은 신규 가드 블록에서 외부 출처 값(`msg.type`, `msg.executionId`)을 sanitize 없이 로그에 삽입하는 로그 인젝션 위험이다. 기존 `dispatch()` 메서드는 이미 이 방어를 구현하고 있으나 신규 코드 경로에는 적용되지 않았다. 분산 lock 토큰 생성, Lua 스크립트 파라미터 바인딩, AI 메시지 길이 검증 등 나머지 보안 통제는 양호하다. 하드코딩된 시크릿, SQL 인젝션, 인증·인가 우회 등 OWASP Top 10 주요 항목에 해당하는 취약점은 없다.

### 위험도

**LOW**