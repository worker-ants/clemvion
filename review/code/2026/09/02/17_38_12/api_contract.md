# API 계약(API Contract) 리뷰

대상: WS `auth.token_expired` 사전 통지 + 소켓 만료 disconnect 구현
(`websocket-events.types.ts` / `websocket.gateway.ts` / `websocket.gateway.spec.ts` /
`ws-client.ts` / `ws-client.test.ts`) + 관련 plan 문서. 나머지 `review/consistency/**` 산출물
파일들(파일 8~27)은 순수 프로세스 아티팩트(리뷰 실행 로그)로 API 계약과 무관해 리뷰 대상에서 제외했다.

## 발견사항

- **[WARNING]** 배포 전환 구간 — 구버전(스테일) WS 클라이언트가 무기한·무통지로 끊긴 채 복구되지 않을 수 있음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:170`(`armExpiryTimers`) ·
    `codebase/backend/src/modules/websocket/websocket.gateway.ts:242-243`(`handleConnection` 호출부)
  - 상세: 이 변경으로 **모든** 인증된 소켓이 access token TTL(900초, `auth.module.ts` `expiresIn: 900`) 도달 시
    무조건 `client.disconnect()` 된다. Socket.IO는 서버발신 `disconnect()`에 자동 재연결을 발화하지 않으므로
    (spec §6.1 예외, 본 PR의 `ws-client.ts`가 정확히 이 이유로 명시적 `connect()` 를 새로 구현했다), `auth.token_expired`
    구독 + `disconnect` reason 분기 재연결 로직이 없는 클라이언트는 **최대 900초 뒤 조용히, 영구적으로 끊긴다.**
    이 로직을 모르는 채로 계속 열려 있을 수 있는 대상:
    1. **백엔드 배포 시점에 이미 열려 있던 브라우저 탭.** SPA는 핫스왑되지 않으므로, 이 PR이 프론트·백엔드를
       한 커밋에 묶어도 배포 *이전에* 열려 있던 세션은 구버전 JS 번들(= `auth.token_expired` 리스너·
       `disconnect` reason 분기 없음)을 계속 실행 중이다. 배포 후 최대 15분 안에 그 탭들은 재연결 없이
       끊긴다 — 사용자는 페이지를 새로고침하기 전까지 원인을 알 수 없다.
    2. `ws-client.ts` 래퍼를 거치지 않는 raw `socket.io-client` 소비자(있다면) — 동일하게 무통지 종료.
    spec(`spec/5-system/6-websocket-protocol.md`) 과 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`
    양쪽 모두 이 "이미 연결된 구버전 세션의 배포 전환 창" 시나리오를 언급하지 않는다(Rationale 절 전수 검색 결과
    rollout/롤링배포 관련 서술 없음 — `RESUME_INCOMPATIBLE_STATE` 항목만 별개 기능의 롤링배포를 다룬다).
    참고로 이 변경 자체는 "핸드셰이크 이후 토큰을 재검증하지 않아 만료 뒤에도 무기한 인가되는" 실재하는 인가 갭을
    닫는 의도된 보안 수정이라, 강제 종료 자체는 정당하다 — 다만 **그 종료가 복구 불가능한 클라이언트에게 가는 창**이
    빠져 있다.
  - 제안: 배포 런북에 "FE 우선 배포(또는 동시 배포 후 900초 이내 무통지 이탈 감내)" 를 명시하거나, `ws-client.ts`
    상위 소비자(레이아웃/전역 훅)에 `disconnect` reason 이 `io server disconnect` 인 모든 경우(이 PR이 이미
    `io server disconnect` 를 잡고 있으므로 그 자체로는 구버전 번들에서 해결 안 됨) 대응이 아니라, **구버전 번들
    자체가 겪는 문제**이므로 "예상치 못한 WS 세션 종료가 감지되면 전체 페이지 새로고침을 권유하는 배너"와 같은
    번들-불가지론적 안전망을 검토할 것. 최소한 이 rollout 리스크를 spec Rationale 이나 impl plan 에 "알려진 배포
    창 리스크"로 기록해 다음 배포 담당자가 놀라지 않게 할 것.

- **[INFO]** 만료 강제 종료 시 `error` 이벤트 미발행 — 인증 실패 경로와 신호 방식이 다름
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:201-207`(cutoff 콜백) 대비
    `codebase/backend/src/modules/websocket/websocket.gateway.ts:218-225`, `:263-266`(핸드셰이크 인증 실패 경로)
  - 상세: `handleConnection` 의 최초 인증 실패(토큰 없음/무효)는 `client.emit('error', { message })` 후
    `disconnect()` 해 클라이언트가 "왜"를 명시적으로 받는다. 반면 만료 cutoff 는 `error` 이벤트 없이 곧장
    `client.disconnect()` 만 호출한다 — 클라이언트는 오직 Socket.IO 의 `disconnect` reason 문자열
    (`"io server disconnect"`)로만 원인을 추론해야 한다. spec §6.1/§9.2 가 의도적으로 이렇게 설계했고
    (사전 통지 `auth.token_expired` 가 원인 신호 역할을 대신함) 프론트 테스트도 이 계약대로 작성되어 실결함은
    아니지만, 같은 게이트웨이 안에서 "연결 종료 사유 통지" 방식이 두 갈래(explicit `error` payload vs. implicit
    disconnect reason)로 나뉜다는 점은 신규 소비자가 `error` 이벤트만 구독해서는 이 케이스를 못 잡을 수 있어
    기록해 둔다.

## 검토했으나 이상 없음으로 판단한 항목

- **네이밍/버전 관리**: `AuthEventType.AUTH_TOKEN_EXPIRED = 'auth.token_expired'` 는 기존
  `ExecutionEventType`/`NodeEventType`/`InAppNotificationEventType` 의 `namespace.snake_case` 관례와
  정확히 일치. 신규 이벤트는 인바운드 `@SubscribeMessage` 화이트리스트(`KNOWN_WS_EVENTS`)에 넣지 않는데,
  이 이벤트는 서버 emit-only 이므로 올바른 판단이다.
- **요청 검증**: `armExpiryTimers` 는 `typeof expSeconds !== 'number' || !Number.isFinite(expSeconds)` 로
  방어하고, `exp` 는 이미 `jwtService.verify()` 로 서명 검증을 통과한 값만 들어온다(공격자 조작 불가).
  `expSeconds`(900초 규모)는 Node `setTimeout` 최대 지연(≈24.8일)에 전혀 근접하지 않아 오버플로 리스크 없음.
  타이머 해제(`handleDisconnect`)도 notice/cutoff 양쪽을 모두 정리해 소켓당 누수 없음.
- **응답 형식/스키마**: `AuthTokenExpiredPayload { message: string; expiresAt: string }` 는 spec §4.6 shape 과
  정확히 일치하고, `expiresAt`(ISO 8601, "이 소켓이 강제 종료되는 시각")의 의미가 `_retryState.expiresAt`·
  `auth.refreshed.expiresAt` 와 충돌하지 않도록 JSDoc·spec 양쪽에 3중 명명 충돌이 명시적으로 구분되어 있다
  (consistency `naming_collision` checker 가 이미 확인, plan 문서 참조).
  프론트 `ws-client.ts` 는 `payload.message` 를 소비하지 않고 `auth.token_expired` 수신 자체를 트리거로만
  쓰므로, 필드 자체가 아직 활용되지 않아도 계약 위반은 아니다(spec 이 명시한 shape 을 그대로 구현).
- **인증/인가**: 이 변경은 오히려 실재하던 인가 갭(핸드셰이크 이후 토큰 재검증 부재로 만료된 토큰의 소켓이
  무기한 인가된 채 이벤트를 계속 수신)을 닫는 보강. revoke 카브아웃(자연 만료까지만 유효, 명시적 revoke는
  대상 아님)도 spec Rationale 이 명시한 범위와 코드 주석이 정확히 일치.
- **URL/경로 설계·페이지네이션**: 해당 변경에 REST 엔드포인트·목록 API 변경 없음 — 해당 없음.
- **에러 응답(HTTP)**: 해당 변경은 WS 이벤트/disconnect 이지 HTTP 응답이 아니므로 상태 코드 적절성은 논외.
  (WS 자체의 에러 신호 방식은 위 INFO 항목 참조.)

`plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 에 이미 등재된 별도 API convention 갭
(`2-api-convention.md` §6 상태 코드 표 `410`/`202` 미등재, `PASSWORD_INVALID` vs `INVALID_PASSWORD` 네이밍)은
이번 diff 의 코드 변경 범위 밖(다른 모듈)이고 이미 planner 트랙 항목으로 기록돼 있어 본 리뷰에서 중복 기재하지
않는다.

## 요약

이번 변경은 WS 채널에 신규 서버 emit 이벤트(`auth.token_expired`, `{message, expiresAt}`)를 additive 로 추가하고,
소켓 수명을 토큰 수명에 종속시켜 실재하던 인가 갭(만료된 토큰으로도 소켓이 무기한 인가되던 문제)을 닫는다.
이벤트 네이밍·페이로드 shape·요청측 방어 검증·인가 강화는 spec(§1.2/§4.6/§9.2)과 정확히 정합하고 테스트도
충실하다. API 계약 관점의 실질 리스크는 하나다 — **강제 disconnect 로 인해, 이 신규 재연결 로직을 모르는(주로
배포 시점에 이미 열려 있던 구버전 프론트엔드 번들) 클라이언트가 최대 15분 뒤 조용히·복구 불가능하게 끊길 수 있고**,
이 배포 전환 창은 spec/plan 어디에도 명시적으로 다뤄지지 않았다. 데이터 손실이나 보안 하락은 아니며 페이지
새로고침으로 자연 복구되므로 CRITICAL 은 아니지만, 배포 시점에 사용자가 영문 모를 세션 끊김을 겪을 수 있어
런북/문서화 조치를 권고한다.

## 위험도

LOW–MEDIUM (WARNING 1건 — 배포 전환 구간 구버전 클라이언트 무통지 이탈; INFO 1건)
