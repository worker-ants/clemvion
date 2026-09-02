# 아키텍처(Architecture) 리뷰

## 검토 배경

대상 diff 는 `origin/main`(`6ffadb1f4`) 대비 5개 커밋(`b019d7de3` feat + `a9316a0a6`/`1bd2000d5`/
`e5b683d75`/`a18376f0c` 1R~4R fix)의 최종 누적 상태다 — WS 소켓 수명을 JWT access token 수명에
종속시키는 `auth.token_expired` 기능(backend `websocket.gateway.ts`/`websocket-events.types.ts`,
frontend `ws-client.ts`). 이미 **4라운드**의 전담 아키텍처 리뷰(`review/code/2026/09/02/
{17_38_12,18_18_53,18_45_43,19_12_36}/architecture.md`)를 거쳤고 전부 CRITICAL 0·아키텍처
카테고리 WARNING 0(LOW/NONE)으로 수렴했다. 4R fix 커밋(`a18376f0c`)의 실제 코드 변경은
`git show`로 대조한 결과 JSDoc 문구 정정 1건 + 빈 줄 1개 삭제뿐이라 새 아키텍처 표면이 생기지
않았다. 이번 라운드는 `websocket.gateway.ts`·`ws-client.ts`·`ws-client.test.ts`·
`websocket-events.types.ts` 를 `Read` 로 직접 재확인해 독립적으로 SOLID·결합도·레이어·순환
의존·모듈 경계·확장성을 재검증했다(저장소 파일은 읽기만 함, 뮤테이션 없음 —
`git status --short` 로 미변경 확인).

`review/**`·`review/consistency/**`·plan 문서(파일 10~94)는 `/ai-review`/`--impl-prep` 프로세스
산출물이거나 작업 추적 문서로 애플리케이션 코드가 아니므로 이번 아키텍처 판단 대상에서 제외한다.

## 발견사항

- **[INFO]** `AuthTokenExpiredPayload` 의 "진단·로깅용" 이라는 재정정된 JSDoc 조차, 실제로는 어느
  소비자도 로깅하지 않는다 — 필드가 wire 계약에는 있지만 런타임에는 완전히 미사용
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `AuthTokenExpiredPayload`
    JSDoc(`export interface AuthTokenExpiredPayload` 바로 위, "이 필드는 **진단·로깅용**이다") 대조
    `codebase/frontend/src/lib/websocket/ws-client.ts:133-135` (`socket.on("auth.token_expired", () => { return refreshAndReconnect("auth.token_expired"); })`)
  - 상세: 4R 에서 이미 "클라이언트가 남은 창을 계산한다" 는 과다 서술을 "진단·로깅용" 으로 좁혔고
    (`websocket-events.types.ts:296-299`), 그 정정 자체는 정확하다 — spec §9.2 계약 위반이
    아니라는 판단도 옳다. 다만 좁힌 문구도 "로깅용" 이라는 실제 쓰임을 약속하는데, 핸들러
    (`ws-client.ts:133`)는 payload 인자를 아예 받지 않는다(`() => {...}`, 화살표 함수가 이벤트
    데이터를 무시). `message`/`expiresAt` 어느 필드도 `console.log`/`console.error`/원격 로깅
    어디에도 닿지 않는다 — 현재 코드베이스 전체에서 `AuthTokenExpiredPayload` 의 두 필드는 서버가
    직렬화(`websocket.gateway.ts:194-198`)하는 것 말고는 아무 소비자가 없다. 기능 결함은 아니고
    (spec 이 요구하는 건 emit 자체이지 클라이언트 소비가 아니다) 병합 차단 사유도 아니지만, wire
    계약에 "지금 아무도 안 쓰는 필드" 를 얹어 두는 것은 인터페이스가 실제 소비자 요구보다 넓다는
    신호다(ISP 관점의 경미한 과잉 설계) — 다음 사람이 이 필드를 보고 "이미 로깅되고 있겠거니"
    오판할 여지가 있다.
  - 제안: 지금 조치 불요. 실제로 진단 로깅이 필요해지는 시점(예: 만료 임박 UX 배너, 텔레메트리)에
    맞춰 채우거나, 그 전까지는 JSDoc 을 "현재는 어떤 소비자도 이 필드를 읽지 않는다 — 향후 진단
    용도로 예약" 정도로 한 번 더 정확히 낮추는 편이 다음 독자에게 더 정직하다.

- **[INFO]** 타이머 쌍 타입이 여전히 optional — 실제 불변식(항상 함께 존재)이 타입에 드러나지
  않음. 4라운드 연속 이월, "취향 범위"로 명시 보류
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-153`(`expiryTimers`
    필드 선언), `:192`(`armExpiryTimers` 내부 `timers` 지역 변수 선언), 소비부 `:287-289`
    (`handleDisconnect` 의 `if (timers.notice) …` / `if (timers.cutoff) …`)
  - 상세: `armExpiryTimers` 는 `notice`·`cutoff` 를 항상 같은 실행 경로에서 함께 대입해 Map 에
    저장한다(한쪽만 세팅되는 분기가 없음을 직접 `Read` 로 재확인). 그런데도 값 타입은
    `{ notice?: NodeJS.Timeout; cutoff?: NodeJS.Timeout }` 로 둘 다 optional 이라, "두 타이머는
    항상 쌍" 이라는 불변식이 컴파일 타임에 강제되지 않고 `handleDisconnect` 의 방어적
    optional-check 가 항상 참인 조건을 숨긴다.
  - 제안: `{ notice: NodeJS.Timeout; cutoff: NodeJS.Timeout }` non-optional 화. 동작 영향 없는
    표기 수준 이슈로 지금 반영 여부는 선택 — 4라운드 연속 같은 판단이 유지돼도 무방하다.

- **[INFO]** wire 메시지 문자열이 파일 내 기존 상수화 관례(`MSG_NOT_AUTHENTICATED` 등)를 따르지
  않음. 4라운드 연속 이월
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:195`(`armExpiryTimers`
    내부 `message: 'Access token expires soon — refresh and reconnect.'`) 대조
    `:86-87`(`MSG_NOT_AUTHENTICATED`/`MSG_NOT_AUTHORIZED_EXECUTION`)
  - 상세: 같은 파일 상단은 "명문 wire 문자열 — 변경 금지" 주석과 함께 모듈 상수로 뽑는 확립된
    패턴이 있으나 이 문자열만 인라인이다. 테스트가 `expect.any(String)` 으로만 검증해 지금 당장
    깨지지 않는다(재확인).
  - 제안: `MSG_AUTH_TOKEN_EXPIRING` 류 상수로 승격(선택, 병합 차단 아님).

## SOLID·모듈 경계·순환 의존·확장성 재검증 (이상 없음, 독립 확인)

- **SRP/ISP**: `AuthEventType`/`AuthTokenExpiredPayload` 는 `ExecutionEventType`/`KbEventType` 과
  같은 층위·같은 파일(`websocket-events.types.ts`)에 추가돼 "wire 이벤트 타입 전용, 로직 없음"
  경계를 유지한다. `EXPECTED_EXPORTS` 완전성 목록(`websocket-events.types.spec.ts`)에도 두 신규
  export 가 반영돼 #1174 급 회귀(부분집합 검사라 export 누락이 조용히 통과)를 다시 막는다.
- **순환 의존 없음**: `websocket-events.types.ts` 는 자체 스펙이 "zero-import" 를 강제하는 파일이고
  이번 추가분도 새 import 를 들이지 않는다. `websocket.gateway.ts` → `websocket-events.types.ts`
  단방향만 있고, `ws-client.ts` 는 backend enum 을 import 하지 않고 문자열 리터럴을 쓴다(기존
  다른 이벤트들과 일치하는 관례). backend↔frontend 간 순환 의존 없음.
- **OCP**: 신규 서버발신(emit-only) 이벤트가 인바운드 전용 화이트리스트(`KNOWN_WS_EVENTS`)를
  건드리지 않았다 — 인바운드 검증 표면을 넓히지 않는 올바른 판단.
  `KNOWN_WS_EVENTS`(`:41-50`) 직접 대조로 재확인.
- **DIP/레이어 책임**: `armExpiryTimers` 는 connection-lifecycle 을 다루는 NestJS Gateway
  (프레젠테이션/프로토콜 레이어) 안에 남아 있고, 인가 판단(JWT 검증)이나 도메인 비즈니스 로직을
  침범하지 않는다.
- **책임 누적 추세(gateway/클로저)** — 1R 에서 이미 근거를 남기고 의도적으로 보류된 트레이드오프,
  4라운드째 악화 없음: backend 는 `subscriptions`/`wsRateLimiter`/`expiryTimers` 세 축의 소켓별
  상태를 `handleConnection`/`handleDisconnect` 쌍에서 대칭적으로 arm/disarm 하는 기존 관례를
  그대로 따른다(1075줄, God-object 성향은 있으나 각 축이 명확히 분리된 `Map<socketId,…>` 형태라
  응집도 자체는 유지된다). `WsTokenExpiryService` 로 추출하지 않은 판단은 "타이머 로직 30줄,
  추출 시 gateway 훅↔서비스 arm/disarm 왕복이 오히려 누수 지점을 늘린다" 는 근거로 이미
  평가·보류됐다. frontend `connect()` 클로저도 동일 성격이나, 이번 PR 의 통합(`refreshAndReconnect`
  단일 헬퍼)으로 오히려 중복이 사라졌다.
- **동시성-아키텍처 경계**: 3R 이 발견한 cross-generation race(옛 소켓 세대의 in-flight 재발급이
  공유 `socket` 클로저 변수를 통해 새 세대를 건드리는 문제)는 `const mySocket = socket` 스냅샷
  (`ws-client.ts:68`) + `socket !== mySocket` 세대 비교(`:74`) 가드로 해소된 상태를 재확인했다.
  진입 시점 스냅샷 + 사후 identity 비교는 stale-closure 방어의 표준 형태이며, 별도 클래스·상태
  머신 도입 없이 기존 클로저 구조 안에서 최소 침습으로 문제를 닫아 아키텍처를 불필요하게
  무겁게 만들지 않았다.
- **확장성**: 신규 트리거가 하나 더 필요해지면(예: 서버 유지보수 공지) `refreshAndReconnect` 를
  그대로 재사용해 `socket.on(...)` 한 줄만 추가하면 되는 구조라, "재발급→재연결" 계약을 다시
  중복시킬 필요가 없다. backend 도 `armExpiryTimers` 패턴이 네 번째 소켓별 상태 축으로 확장될
  때를 대비한 서비스 추출 지점이 이미 RESOLUTION 에 조건부로 문서화돼 있다.

## 요약

4라운드에 걸친 전담 아키텍처 리뷰와 이번 5차 독립 재검증 모두 SOLID·결합도/응집도·레이어 분리·
순환 의존·모듈 경계 관점에서 CRITICAL/WARNING 급 결함을 찾지 못했다. 4R fix 커밋의 실제 코드
변경(JSDoc 정정, 빈 줄 제거)은 새 아키텍처 표면을 만들지 않았고, 소스를 직접 재확인한 결과
이전 라운드가 기록한 설계(도메인별 이벤트 enum 분리, gateway 의 `Map<socketId,…>` 기반 대칭
arm/disarm, 프런트 재연결 트리거의 단일 헬퍼 통합, 세대 비교를 통한 stale-closure 방어)가 정확히
유지되고 있다. 남은 것은 4라운드 연속 이월된 INFO 3건 — (1) 좁혀진 JSDoc 조차 실제로는 아무
소비자가 읽지 않는 필드를 "로깅용"으로 서술하는 잔여 과다 약속, (2) 타이머 쌍 타입의 optional
완화 미반영, (3) wire 메시지 문자열 상수화 누락 — 뿐이며 전부 병합을 막을 사안이 아니다. 이미
근거를 갖춰 의도적으로 보류된 gateway/클로저 책임 누적 추세도 이번 라운드에서 그 경계를 넘지
않았다.

## 위험도

LOW
