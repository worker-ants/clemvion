# RESOLUTION — `auth.token_expired` 구현 리뷰 1라운드

대상 SUMMARY: 위험도 **CRITICAL** · Critical **2** · Warning **8** · INFO 9

**Critical 2건 + Warning 5건 조치.** 두 Critical 은 성격이 정반대인데 뿌리가 같다 —
**내 검증이 내 주장보다 좁았다.**

## C1 (requirement·concurrency) — 보장한 "끊김 없음" 이 매 900초마다 깨졌다

`socket.connect()` 는 **이미 연결된 소켓에서 완전한 no-op** 이다. 리뷰어 말을 받아쓰지 않고
소스를 열어 확인했다 (`socket.io-client@4.8.3`):

```js
connect() { if (this.connected) return this; ... }
```

사전 통지 시점의 소켓은 **연결돼 있다.** 그래서 새 토큰이 `socket.auth` 에만 얹히고
재핸드셰이크가 없다 — 실제 재연결은 **서버가 `exp` 에 강제 종료한 뒤 fallback 에서만** 일어난다.
spec §9.2 의 *"성공하면 사용자에게 끊김이 보이지 않는다"* 가 **매 토큰 주기마다 결정적으로**
깨졌고, `/auth/refresh` 도 두 번 불렸다.

**내 테스트가 왜 못 잡았나 — vacuous 의 세 번째 형태다.** `createMockSocket()` 이
`connected: false` 로 고정돼 있어 **프로덕션에 존재하지 않는 상태**를 검사했다. fixture 를
실제 상태(`connected = true`)로 바꾸자 곧바로 RED 가 났다.

고침: 재발급 후 `if (socket.connected) socket.disconnect();` 를 앞세워 명시적으로 재핸드셰이크
한다. 통지 창(60초) 안에서 끝나므로 실제 공백은 밀리초다. 테스트에 **호출 순서**
(`disconnect` → `connect`)까지 단언했다 — 순서가 뒤집히면 다시 no-op 이다.

## C2 (testing) — 내가 두 PR 전에 만든 게이트가 내 회귀를 잡았다

신규 프론트 테스트 3곳이 `connect()` 를 인자 없이 불렀다(`connect(token: string)`).
**`vitest` 는 타입을 strip 해 20/20 GREEN** 이었고 lint·unit·build·e2e 도 전부 통과했다.

`scripts/check-frontend-typecheck-ratchet.py`(#1263)만이 잡았다:

```
src/lib/websocket/__tests__/ws-client.test.ts: 0 → 3   (TS2554)
```

**그런데 내가 그걸 안 돌렸다.** `run-test.sh` 4단계 밖이라(PROJECT.md 가 그렇게 적는다)
습관에서 빠졌다. 인자를 채워 baseline 52/15 로 복귀했고, **plan 체크리스트에 명시적 단계로
넣었다** — 다음 사람이 같은 자리에서 넘어지지 않게.

> 이 건이 #1263 의 투자를 사후 정당화한다. 그 게이트가 없었으면 CI 에서 터졌을 것이다.

## W1 (architecture·maintainability·documentation) — 세 트리거가 같은 몸통을 반복

`connect_error` · `auth.token_expired` · `disconnect` 가 각자 "재발급 → `auth.token` 교체 →
재연결" 을 들고 있었다. 재발급 정책이 바뀌면 한쪽만 고치는 shotgun surgery 가 된다.

`connect_error` 핸들러를 공통 헬퍼 호출로 위임해 **구현을 한 곳에 모았다.** C1 수정이 그
헬퍼 안에 있으므로, 통합하지 않았으면 `connect_error` 경로에는 no-op 결함이 남았을 것이다 —
통합이 곧 회귀 방지다.

## W3 (documentation) — export 완전성 목록이 조용히 약해졌다

`EXPECTED_EXPORTS` 는 #1174 회귀(72 suites 가 `Cannot read properties of undefined`)를 막는
**완전한 목록**인데 신규 export 2개가 빠졌다. **부분집합 검사라 RED 가 안 난다** — 그래서
조용하다. `AuthEventType`·`AuthTokenExpiredPayload` 를 추가하고 그 이유를 주석에 남겼다.

## W4 (documentation) — CHANGELOG

최근 5개 커밋이 전부 동반 갱신했는데 이번만 빠졌다. Unreleased 에 추가했다 — `connect()` 가
no-op 이라는 사실과 revoke 카브아웃까지 적었다.

## W5·W6 — 등재 (권한 밖 · 배포 판단)

- **W5 spec 배지 flip** — §1.2·§4.6·Rationale·`:28` 의 `_(계획·미구현)_` 와 tracker 체크박스는
  **developer 권한 밖**이다. 그 문구의 원저자가 아니므로 자기-반증형 소정정 예외에 해당하지
  않는다. plan 체크리스트에 "머지 후 planner 턴" 으로 등재했다.
- **W6 배포 전환 창** — 이 로직을 모르는 **구버전 번들**(배포 시점에 열려 있던 탭)은 최대
  900초 뒤 무통지로 끊긴다. FE 우선 배포로 창을 줄이거나 그 이탈을 감내한다는 판단을 배포
  런북에 남기도록 등재했다. **코드로 해결할 문제가 아니다.**

## 미조치

- **W2**(mock 이 connected 를 전환하지 않음) — **C1 조치에 흡수**됐다. 같은 지적의 다른 각도다.
- **W7**(유저 가이드·e2e) — 사용자 대면 UI 변경이 없는 **내부 신뢰성 개선**이다. WS 토큰 만료
  e2e 는 900초를 기다리거나 토큰 수명을 주입해야 해 현 e2e 하네스의 boot-only 게이트와 결이
  다르다. **미조치이며 우선순위 판단**이다.
- **W8**(`WsTokenExpiryService` 추출) — 리뷰어도 *"지금 당장 결함은 아님, 선택적"*. 타이머
  로직이 30줄이고 gateway 의 생명주기 훅(`handleConnection`/`handleDisconnect`)에 직접 붙는다.
  추출하면 그 훅과 서비스 사이에 arm/disarm 왕복이 생겨 오히려 누수 지점이 늘어난다.
- **INFO 9건** — #1(revoke 카브아웃)은 설계 의도로 이미 승인됨. #2·#4(타입 좁히기·별칭)와
  #5(메시지 상수화)는 취향 범위. #3(`onModuleDestroy` backstop)은 모든 소켓이
  `handleDisconnect` 를 거치므로 관측된 리스크가 없다. #8(빈 consistency 세션)은 조치 불요.

## 검증

lint · unit · build · e2e(291) **PASS** ·
backend websocket **178** · frontend websocket **198** ·
frontend ratchet **52/15**, backend ratchet **199/38** ·
뮤테이션: cutoff 해제 누락 RED · `exp` 가드 제거 RED · FE reason 가드 제거 RED ·
`Math.max(0,…)` 제거 **GREEN(생존이 정상, 사유 기록)** · fixture 를 실제 상태로 교정 **RED**.
