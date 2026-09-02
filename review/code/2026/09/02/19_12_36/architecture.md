# 아키텍처(Architecture) 리뷰

## 검토 배경

대상 diff 는 `origin/main..HEAD` 4개 커밋(`b019d7de3` feat + `a9316a0a6`/`1bd2000d5`/`e5b683d75`
1R~3R fix)의 최종 누적 상태다. `auth.token_expired` — WS 소켓 수명을 JWT access token 수명에
종속시키는 기능이며, backend(`websocket.gateway.ts`, `websocket-events.types.ts`)와
frontend(`ws-client.ts`) 양쪽 구현이다. 이미 **3라운드**의 전담 아키텍처 리뷰
(`review/code/2026/09/02/{17_38_12,18_18_53,18_45_43}/architecture.md`)를 거쳤고, 마지막
`18_45_43` 라운드는 CRITICAL 0·WARNING(아키텍처 카테고리 0, concurrency/testing 카테고리
cross-generation race 1건)으로 수렴했다. 이번 리뷰는 `HEAD`(`e5b683d75`, 3R fix 커밋)의 실제
소스를 직접 `Read` 해 그 라운드 이후 변경이 없음을 확인하고(`git log` 상 3R 커밋이 곧 HEAD),
독립적으로 SOLID·결합도·레이어·순환의존·모듈 경계·확장성을 재검증했다.

review/·plan/ 아래의 나머지 파일(리뷰 산출물, consistency 세션 로그, plan 문서)은 애플리케이션
코드가 아니므로 이번 아키텍처 판단 대상에서 제외한다.

## 발견사항

- **[INFO]** 공유 wire 타입 JSDoc 이 실제 소비자 구현보다 넓은 계약을 문서화 — 3라운드 연속 이월, 아직 미조치
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `AuthTokenExpiredPayload`
    JSDoc(`export interface AuthTokenExpiredPayload` 바로 위 블록, "클라이언트는 이 값으로 남은 창을
    계산해 재발급 + 명시적 재연결을 수행한다") 대조 `codebase/frontend/src/lib/websocket/ws-client.ts`
    의 `socket.on("auth.token_expired", () => { return refreshAndReconnect("auth.token_expired"); })`
  - 상세: `expiresAt`/`message` 필드는 프로덕션 코드 어디에서도 읽히지 않는다 — 핸들러는 payload 를
    인자로 받지 않고 이벤트 수신 즉시 무조건 재발급을 시작한다. spec §1.2/§9.2 의 계약("통지 창 안에
    refresh+재연결")은 이 즉시-처리로 충족되므로 기능 결함은 아니지만, JSDoc 은 존재하지 않는
    "남은 창 계산" 로직이 클라이언트에 있다고 다음 독자에게 잘못 전달한다. `18_45_43` 라운드가
    이미 이 항목을 architecture INFO#7 로 기록했고 SUMMARY 는 "선택(선택)" 으로 분류했다 — 3R fix
    커밋(concurrency/testing 대응)이 이 JSDoc 을 건드리지 않아 그대로 남아 있다.
  - 제안: JSDoc 을 실제 동작에 맞게 정정("통지를 받으면 즉시 refresh+재연결하며 `expiresAt` 은
    현재 소비되지 않는다")하거나, 반대로 `expiresAt` 을 실제로 활용(로깅·짧은 잔여 시간 시
    우선순위 조정 등)하도록 구현을 넓힌다. 병합을 막을 사안은 아니다.

- **[INFO]** `WebsocketGateway`/`ws-client.ts connect()` 양쪽 모두 소켓별 상태·정책 책임이 대칭적으로 누적되는 추세 — 1R 에서 이미 근거를 남기고 의도적으로 보류된 트레이드오프, 이번 라운드에서 새로 악화되지 않음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:144-153`(`TOKEN_EXPIRY_LEAD_MS`,
    `expiryTimers` 필드), `:170-210`(`armExpiryTimers`) / `codebase/frontend/src/lib/websocket/ws-client.ts`
    의 `connect()` 클로저 전체(소켓 생성 + `refreshAndReconnect` 정의 + 3개 트리거 리스너 배선)
  - 상세: backend 는 `subscriptions`/`wsRateLimiter`/`expiryTimers` 세 축의 소켓별 상태를
    `handleConnection`/`handleDisconnect` 쌍에서 대칭적으로 arm/disarm 하는 기존 관례를 그대로
    따른다. `WsRateLimiterService` 처럼 별도 서비스로 분리하지 않고 gateway 필드로 흡수한 점은
    1R 아키텍처 리뷰가 이미 지적했고, RESOLUTION 이 "타이머 로직 30줄, 추출 시 gateway 훅과
    서비스 사이 arm/disarm 왕복만 늘어난다"는 근거로 명시적으로 보류했다. frontend `connect()`
    도 동일 성격 — 소켓 생성·에러 로깅·인증 재발급 정책(단일 in-flight 헬퍼 + 3트리거 라우팅)을
    한 클로저에 담고 있으나, 오히려 이번 PR 의 W1 통합으로 중복은 사라졌다(단일 헬퍼화).
  - 제안: 지금은 조치 불요 — 이미 평가·보류된 결정이며 이번 diff 가 경계를 새로 넘지 않았다.
    소켓별 상태 축이 backend 에서 **네 번째**로 늘거나 frontend 재연결 트리거가 하나 더 추가되면
    그때 `WsTokenExpiryService`/`createAuthRefreshCoordinator` 류 추출을 재검토.

- **[INFO]** 타이머 쌍 타입이 여전히 optional — 실제 불변식(항상 쌍으로 존재)이 타입에 드러나지 않음. 2회 "취향 범위"로 명시 보류됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-153`(`expiryTimers` 필드),
    `:192`(`armExpiryTimers` 내부 `timers` 지역 변수)
  - 상세: `{ notice?: NodeJS.Timeout; cutoff?: NodeJS.Timeout }` 두 필드가 `armExpiryTimers` 안에서
    항상 같은 실행 경로에서 함께 대입되는데도 optional 로 선언돼 있어, `handleDisconnect` 의
    `if (timers.notice) …` 방어적 체크가 실제로는 항상 참인 조건을 숨긴다.
  - 제안: `{ notice: NodeJS.Timeout; cutoff: NodeJS.Timeout }` non-optional 화. 동작 영향 없는
    표기 수준 이슈로, 지금 반영 여부는 선택.

- **[INFO]** wire 메시지 문자열이 파일 내 기존 상수화 관례(`MSG_NOT_AUTHENTICATED` 등)를 따르지 않음. 2회 이월
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `armExpiryTimers` 내부
    `message: 'Access token expires soon — refresh and reconnect.'`
  - 상세: 같은 파일 상단(`MSG_NOT_AUTHENTICATED`/`MSG_NOT_AUTHORIZED_EXECUTION`)은 "명문 wire
    문자열 — 변경 금지" 주석과 함께 모듈 상수로 뽑는 확립된 패턴이 있으나 이 문자열만 인라인이다.
    테스트가 `expect.any(String)` 으로만 검증해 지금 당장 깨지진 않는다.
  - 제안: `MSG_AUTH_TOKEN_EXPIRING` 류 상수로 승격(선택).

## SOLID·모듈 경계·순환 의존 재검증 (이상 없음, 독립 확인)

- **SRP/ISP**: `AuthEventType`/`AuthTokenExpiredPayload` 는 `ExecutionEventType`/`KbEventType` 과
  같은 층위·같은 파일(`websocket-events.types.ts`)에 추가돼 "wire 이벤트 타입 전용, 로직 없음"
  경계를 유지한다. `EXPECTED_EXPORTS` 완전성 목록(`websocket-events.types.spec.ts`)에도 반영돼
  #1174 급 회귀(부분집합 검사라 export 누락이 조용히 통과하는 문제)를 다시 막는다.
- **순환 의존 없음**: `websocket-events.types.ts` 는 자체 스펙이 "zero-import" 를 강제하는 파일이고
  이번 추가분(enum·interface)도 새 import 를 들이지 않는다. `websocket.gateway.ts` →
  `websocket-events.types.ts` 단방향만 있고, `ws-client.ts` 는 backend enum 을 import 하지 않고
  문자열 리터럴(`"auth.token_expired"`)을 쓴다 — 기존 다른 이벤트들과 일치하는 관례라 새 결합이
  아니다. backend↔frontend 간 순환 의존 없음.
- **OCP**: 신규 서버발신(emit-only) 이벤트가 인바운드 전용 화이트리스트(`KNOWN_WS_EVENTS`)를
  건드리지 않은 판단이 올바르다 — 인바운드 검증 표면을 넓히지 않는다.
- **DIP/레이어 책임**: `armExpiryTimers` 는 connection-lifecycle 을 다루는 NestJS Gateway(프레젠테이션/
  프로토콜 레이어) 안에 남아 있고, 인가 판단(JWT 검증)이나 도메인 비즈니스 로직을 침범하지 않는다.
- **동시성-아키텍처 경계**: `18_45_43` 라운드가 발견한 cross-generation race(옛 소켓 세대의
  in-flight 재발급이 공유 `socket` 클로저 변수를 통해 새 세대를 건드리는 문제, WARNING)는
  `mySocket = socket` 스냅샷 + `if (socket !== mySocket) return;` 세대 비교 가드로 해소됐음을
  `ws-client.ts:68,74` 에서 직접 확인했다. 이 패턴(진입 시점 스냅샷 + 사후 identity 비교)은
  stale-closure 방어의 표준 형태로, 별도 클래스·상태 머신 도입 없이 기존 클로저 구조 안에서
  최소 침습으로 문제를 닫아 아키텍처를 불필요하게 무겁게 만들지 않았다.

## 우수 사례 (참고)

- `armExpiryTimers`(arm)/`handleDisconnect`(disarm) 페어링이 `subscriptions`/`wsRateLimiter` 와
  동일한 `Map<socketId, …>` 라이프사이클 관례를 재사용 — 신규 추상화 도입 없이 기존 패턴에 편승.
- frontend `refreshAndReconnect` 단일 헬퍼로 세 트리거(`connect_error`·`auth.token_expired`·
  `disconnect: io server disconnect`)의 "재발급→교체→재연결" 계약을 한 곳에 모아 1R 이 지적한
  shotgun-surgery 위험을 실제로 제거했다.

## 요약

3라운드에 걸친 전담 아키텍처 리뷰와 이번 독립 재검증 모두 SOLID·결합도/응집도·레이어 분리·
순환 의존·모듈 경계 관점에서 CRITICAL/WARNING 급 결함을 찾지 못했다. 핵심 설계(도메인별 이벤트
enum 분리, gateway 의 `Map<socketId,…>` 기반 arm/disarm 대칭 패턴, 프런트 재연결 트리거의 단일
헬퍼 통합, 세대 비교를 통한 stale-closure 방어)는 기존 코드베이스 관례를 일관되게 따르며 확장성
측면에서도 무리가 없다. 1R 이 제기한 gateway/클로저 책임 누적 추세는 이미 근거를 갖춰 의도적으로
보류됐고 이번 diff 가 그 경계를 넘지 않았다. 남은 것은 3라운드 연속 이월된 INFO 4건 — JSDoc이
실제보다 넓은 계약을 문서화·타이머 쌍 타입의 optional 완화 미반영·wire 문자열 상수화 누락·
책임 누적 추세 관찰 — 뿐이며 전부 병합을 막을 사안이 아니다.

## 위험도

LOW
