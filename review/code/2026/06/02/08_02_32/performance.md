### 발견사항

- **[INFO]** Lua 스크립트 문자열이 static 필드로 정의되어 있어 매 호출마다 재생성되지 않음 — 올바른 구현
  - 위치: `cafe24-install-rate-limit.service.ts` L465-468 (`INCR_EXPIRE_LUA`)
  - 상세: `private static readonly` 로 클래스 로드 시 1회 초기화. 매 `recordFailure` 호출에서 문자열 재할당 없음. 적절함.
  - 제안: 없음.

- **[INFO]** `isLockedOut` 에서 Redis GET 1회 + 정수 파싱 — O(1), 네트워크 왕복 1회. 최적에 가까움
  - 위치: `cafe24-install-rate-limit.service.ts` L356-362
  - 상세: `Number.parseInt(raw, 10)` 후 `Number.isFinite` 검사. 불필요한 연산 없음. 단순 비교로 충분하고 실제로 그렇게 구현되어 있음.
  - 제안: 없음.

- **[INFO]** `recordFailure` 에서 Lua eval 1회로 INCR + 조건부 EXPIRE 를 원자적으로 처리 — 네트워크 왕복 1회
  - 위치: `cafe24-install-rate-limit.service.ts` L378-384
  - 상세: 두 커맨드를 별도 호출(INCR → EXPIRE)로 구현했으면 왕복 2회 + race condition 위험이 있었을 것. Lua eval 단일 호출로 양쪽 모두 해결. 성능 및 정확성 모두 양호.
  - 제안: 없음.

- **[WARNING]** `recordFailure` 의 반환값(INCR 후 카운트)을 버린다 — 추가 Redis 호출 없이 lockout 임박 여부 판단 가능했던 기회 손실
  - 위치: `cafe24-install-rate-limit.service.ts` L378-384; `third-party-oauth.controller.ts` L939, L953
  - 상세: Lua 스크립트는 INCR 후 현재 카운트 `c` 를 반환한다. 컨트롤러는 `recordFailure` 직후 다음 요청에서야 `isLockedOut` 으로 lockout 를 감지한다. 현재 설계에서는 임계치 도달 시점 요청은 `recordFailure` 완료 후에도 lockout 되지 않고 (이미 오류 응답은 내보냈으므로 실질적 차이는 없지만), 만약 향후 "카운트가 임계치에 막 도달했을 때 즉시 추가 조치"가 필요해진다면 별도 Redis 호출이 생긴다. 현재 동작에서 성능 문제는 없음 — 실패 경로(이미 4xx 응답 반환 중)에서만 호출되고 응답 완료 전 `await` 으로 블로킹.
  - 제안: 단기적으로 문제 없음. 장기적으로 `recordFailure` 가 카운트를 반환하도록 시그니처를 `Promise<number>` 로 바꾸면 컨트롤러에서 "이번 실패로 임계치 도달" 을 알 수 있어 추가 Redis GET 없이 즉시 lockout 로그/알림 가능. 현재 구조에서는 낮은 우선순위.

- **[WARNING]** 컨트롤러의 실패 경로에서 `recordFailure` 가 `await` — 실패 응답 레이턴시에 Redis 왕복이 추가됨
  - 위치: `third-party-oauth.controller.ts` L939 (invalid token 형식), L953 (INVALID_TOKEN / INVALID_HMAC)
  - 상세: 실패 응답을 클라이언트에 보내기 전에 `await this.installRateLimit.recordFailure(clientIp)` 를 블로킹 대기한다. 정상 사용자에게는 영향 없지만(성공 경로에서는 호출 안 함), 실패 응답의 레이턴시가 Redis 왕복(일반적으로 수 ms 이내)만큼 늘어난다. Redis 연결 지연·timeout 시 최대 수백 ms 추가 가능. graceful degradation 으로 예외는 catch 되므로 요청 자체는 실패하지 않음.
  - 제안: 보안 목적에서 fire-and-forget(`void this.installRateLimit.recordFailure(clientIp)`)이 허용된다면 응답 레이턴시를 줄일 수 있음. 단, 카운터 기록 전 응답이 나가므로 동일 클라이언트가 즉시 재시도할 경우 카운터가 반영되지 않을 수 있는 짧은 race window 가 생김. 대용량 enumeration 공격에서는 이 차이가 의미 있을 수 있으므로 현재의 `await` 방식이 더 안전함. 현재 구현 유지 권장.

- **[INFO]** `Cafe24InstallRateLimitService` 는 NestJS singleton — Redis 커넥션이 모듈 생명주기 동안 유지되어 연결 풀 재사용 적절함
  - 위치: `cafe24-install-rate-limit.service.ts` L289-344 (constructor + `OnModuleDestroy`)
  - 상세: `lazyConnect: true` 로 실제 첫 명령 시 연결, `onModuleDestroy` 에서 `quit()` 으로 정리. 연결이 요청마다 새로 생성되지 않아 성능상 문제 없음.
  - 제안: 없음.

- **[INFO]** `buildKey` 는 템플릿 리터럴 단순 문자열 연결 — O(1), 허용 가능
  - 위치: `cafe24-install-rate-limit.service.ts` L391-393
  - 상세: IP 주소는 최대 45자(IPv6), 키 프리픽스 고정. 매 호출마다 단순 문자열 하나 생성. 캐싱 불필요.
  - 제안: 없음.

- **[INFO]** `isLockedOut` 가 모든 요청의 임계 경로에서 호출됨 — Redis GET 1회가 모든 cafe24 install 요청에 추가됨
  - 위치: `third-party-oauth.controller.ts` L925 (`await this.installRateLimit.isLockedOut(clientIp)`)
  - 상세: 정상 요청도 Redis GET 1회를 거친다. Redis 가 로컬 네트워크에 있을 경우 p99 1-2ms 수준. 이 엔드포인트는 Cafe24 설치 플로우(저빈도)에서만 호출되므로 Redis 부하는 무시 가능. 단, Redis 장애 시 fail-open 으로 처리되어 lockout 체크가 생략됨 — 성능 측면에서는 올바른 트레이드오프.
  - 제안: 없음. 고빈도 엔드포인트라면 로컬 in-memory bloom filter / sliding window 사전 필터링을 고려할 수 있으나, 이 엔드포인트의 특성상 불필요.

### 요약

변경 코드의 성능 설계는 전반적으로 양호하다. 핵심인 `recordFailure` 는 Lua eval 단일 왕복으로 INCR + EXPIRE 를 원자적으로 처리해 불필요한 Redis 호출을 최소화했고, `isLockedOut` 는 GET 1회 + O(1) 비교로 구현되어 있다. Redis 커넥션은 NestJS singleton 생명주기로 재사용되며, Lua 스크립트 문자열은 static 필드로 1회만 초기화된다. 한 가지 주목할 점은 실패 경로에서 `recordFailure` 를 `await` 하여 Redis 왕복만큼 응답 레이턴시가 늘어나는 구조인데, 보안적 정확성(카운터 선반영 후 응답) 측면에서 의도적이며 이 엔드포인트의 저빈도 특성상 운영상 문제는 없다. `recordFailure` 의 반환값(현재 카운트)을 활용하지 않아 추후 임계치 도달 즉시 감지 기능 추가 시 불필요한 추가 Redis 호출이 생길 수 있으나 현재 스펙에서는 문제 없다.

### 위험도

LOW
