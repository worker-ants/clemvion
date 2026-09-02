# 요구사항(Requirement) 리뷰

대상: WS `auth.token_expired` — 소켓 수명을 토큰 수명에 종속시키는 기능
(`spec/5-system/6-websocket-protocol.md` §1.2/§1.3/§4.6/§6.1/§9.2, Rationale
`R-ws-socket-lifetime-binds-token`). 커밋 `b019d7de3`(feat) → `a9316a0a6`(1R fix) →
`1bd2000d5`(2R fix) → `e5b683d75`(3R fix), origin/main = `6ffadb1f4`(spec 확정). 이번은
**4라운드째**(세션 `19_12_36`) 검토다. 앞선 3라운드의 RESOLUTION.md/SUMMARY.md 를 **주장으로
받아쓰지 않고**, `codebase/backend/src/modules/websocket/websocket.gateway.ts`,
`codebase/frontend/src/lib/websocket/ws-client.ts`, 각 테스트 파일, `spec/5-system/6-websocket-protocol.md`
본문·Rationale 을 직접 `Read` 해 대조했고, 프론트 테스트·백엔드 테스트·typecheck ratchet 을
실제로 재실행했다(뮤테이션은 걸지 않음 — 3라운드에 걸쳐 이미 다축으로 검증된 로직이라 재현
가치가 낮다고 판단, 대신 반복 실행으로 결정성만 확인).

## 발견사항

- **[WARNING]** 교차-세대(cross-generation) race 를 막는 유일한 회귀 가드 테스트가 드물게 flaky 하다
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts` — `it("옛 세대의
    재발급은 새 소켓을 건드리지 않는다", ...)` (§9.2 describe 블록 내, `gen1`/`gen2` 세대 비교
    테스트)
  - 상세: `npx vitest run src/lib/websocket/__tests__/ws-client.test.ts` 를 76회 반복 실행한
    결과(전체 파일 56회 + 해당 테스트 단독 20회) **1회** 다음과 같이 실패했다:
    ```
    AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
      ❯ ws-client.test.ts:320  expect(gen1.connect).not.toHaveBeenCalled();
    ```
    이 테스트는 3R 이 고친 W1(cross-generation race) 의 **유일한 회귀 방지망**이다 — RESOLUTION.md
    (`review/code/2026/09/02/18_45_43/RESOLUTION.md`)는 "세대 비교 제거 뮤턴트가 이 단언에서
    RED 로 갈렸다"고 기록하는데, 그 갈라지는 지점인 단언 자체가 비결정적이면 그 뮤테이션
    검증의 신뢰도도 함께 흔들린다. 소스(`ws-client.ts:60-98`)를 직접 추적하면 테스트 코드
    안에는 `client.connect("another-token")` 과 `release("new-token")` 사이에 `await` 가
    전혀 없어 — JS 의 동기 실행 보장상 `socket` 클로저 변수는 `refreshAccessToken()` 의 continuation
    이 재개되기 **전에** 이미 `gen2` 로 재할당돼 있어야 하고, `socket !== mySocket` 가드가 항상
    참이어야 한다. 즉 **애플리케이션 로직 자체에서 이 실패를 설명할 인과 경로를 찾지 못했다**
    — 재현이 1/76 로 극히 낮고 결정적 재현 스크립트도 확보하지 못했으므로, 실제 프로덕션
    레이스라기보다 vitest mock/워커 스케줄링 잡음일 가능성이 높다고 판단하지만 **부재를
    증명한 것은 아니다.**
  - 제안: 병합을 막을 사안은 아니나(재현율 낮음 + 코드 경로상 인과 불명), 이 테스트가 지키는
    보장(§9.2 "끊김 없음")의 유일한 가드라는 점을 감안해 `vitest --repeat-each=200 -t "옛
    세대의"` 류로 격리 반복 실행해 결정성을 재확인하고, 원인이 밝혀지지 않으면 최소한 CI
    flake-tracker 에 등재해 다음 실패가 "이미 알려진 flake" 로 조용히 넘어가지 않게 할 것.

- **[INFO]** spec §4.6/§1.2/Rationale 이 여전히 `auth.token_expired` 를 `_(계획·미구현)_`(Planned)로 표기 — 구현은 이미 완료됨. **이미 추적됨, 조치 불요**
  - 위치: `spec/5-system/6-websocket-protocol.md:52`("서버발신 emit 은 미구현 (Planned)"),
    `:876`(§4.6 표의 `_(계획·미구현)_` 배지), `:1100`("잔여(Planned, 구현 대기)"),
    `:1133`("배지는 구현 전까지 Planned 다")
  - 상세: 이번 diff(`AuthEventType.AUTH_TOKEN_EXPIRED` emit·`armExpiryTimers`·`ws-client.ts`
    구독/재연결)가 이 문구가 "구현 대기"라고 부르는 것을 정확히 구현했음을 코드로 확인했다.
    그런데도 spec 은 여전히 Planned 로 남아 있어 spec 을 "이 이벤트가 실재하는가"의 SoT 로
    읽는 다음 소비자를 오도할 수 있다. 다만 이 문구는 CLAUDE.md 의 자기-반증형 소정정 예외가
    명시적으로 배제하는 "제품 정의·요구사항·API 계약" 범주이고, developer 는 이 문구의 원저자가
    아니므로 지금 직접 고칠 권한이 없다. `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`
    체크리스트에 "머지 후 planner 턴 — spec 배지 flip(§1.2·§4.6·Rationale·`:28`)과
    `spec-sync-websocket-protocol-gaps.md:23` 체크박스"로 이미 명시 등재돼 있고, 1R·2R·3R
    api_contract/requirement 리뷰가 모두 이 상태를 확인·재확인했다.
  - 제안: 코드 조치 불요(재확인). 이미 등재된 planner 턴에서 배지를 flip 할 것 — SPEC-DRIFT
    로 분류하지 않는 이유는 배지 갱신이 developer 권한 밖으로 명시 위임돼 있어 "코드가 맞고
    spec 만 낡았다"는 판단을 이 reviewer 가 내려도 실행 주체가 바뀌지 않기 때문이다.

- **[INFO]** `AuthTokenExpiredPayload` JSDoc 이 클라이언트의 실제 처리보다 더 넓게 서술 — 의도와 구현 간 소폭 괴리. **이미 추적됨(3R INFO#7), 조치 불요**
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:293`(JSDoc
    "클라이언트는 이 값으로 남은 창을 계산해 재발급 + 명시적 재연결을 수행한다") vs
    `codebase/frontend/src/lib/websocket/ws-client.ts:133-136`(`auth.token_expired` 핸들러 —
    payload 인자를 아예 받지 않고 즉시 `refreshAndReconnect` 호출)
  - 상세: JSDoc 은 클라이언트가 `expiresAt` 값으로 "남은 창을 계산"한다고 적지만, 실제 핸들러는
    payload 필드를 전혀 읽지 않고 통지를 받는 즉시 재발급을 시작한다. spec §9.2 의 "통지 창(60초)
    안에" 라는 계약 자체는 여전히 충족한다(즉시 시작이 창 안에 끝나는 것의 상위집합이라 더
    안전한 전략) — 기능 결함은 아니고 문서가 구현보다 넓게 약속하는 수준의 괴리다. 직전 라운드
    (`review/code/2026/09/02/18_45_43/`)의 architecture/INFO#7 이 동일 지점을 이미 지적했고
    RESOLUTION.md 가 "다음에 이 payload 를 실제로 쓰거나 JSDoc 을 좁힐 때 정리할 자리"로 의도적
    보류했다.
  - 제안: 조치 불요(재확인). 향후 이 payload 를 실제로 소비하거나 JSDoc 을 "즉시 재발급을
    개시하며 expiresAt 은 정보 제공용"으로 좁힐 때 정리.

## 검토했으나 이상 없음으로 판단한 항목 (spec §1.2/§1.3/§4.6/§6.1/§9.2 + Rationale 대조)

- **lead time 60초**: `websocket.gateway.ts:144` `TOKEN_EXPIRY_LEAD_MS = 60_000` = spec §1.2/§9.2/Rationale
  이 명시한 "만료 60초 전" 과 문구 단위로 일치. Rationale 의 "900초의 약 6.7%" 산술도 60/900=6.67%로 일치.
- **payload shape**: `AuthTokenExpiredPayload { message: string; expiresAt: string }` = spec §4.6 표
  `{ message, expiresAt }`. `expiresAt` 의미("이 소켓이 강제 종료되는 시각")도 JSDoc·spec·Rationale
  삼자가 동일 문구로 일치.
- **notice/cutoff 페어링**: `armExpiryTimers` 가 `exp` 부재/비-finite 시 조기 return(§1.2 "그런 토큰은
  핸드셰이크 검증이 이미 통과시킨 것이라 끊을 근거 없음" 과 일치) → `handleConnection`(:243)에서만
  호출 → `handleDisconnect`(:286-291)에서 둘 다 `clearTimeout` — spec "handleDisconnect 에서 타이머
  해제" 와 일치. 백엔드 테스트(`websocket.gateway.spec.ts`) 5개 케이스(사전 통지 1회·정시 disconnect·
  둘 다 해제·lead time 보다 짧은 토큰 즉시 통지·`exp` 부재 시 무동작)가 이 표를 그대로 커버.
- **revoke 카브아웃**: `armExpiryTimers` JSDoc "닫는 범위는 자연 만료뿐" = spec §1.2/Rationale 의
  "명시적 revoke 는 refresh family 만 무효화, access token 은 자연 exp 까지 유효" 와 일치. 백엔드
  `auth.service.ts` 를 직접 확인한 결과 `revokeAllFamilies` 는 refresh token 레코드만 다루고 access
  token(stateless JWT) 을 무효화하는 경로는 없음 — 코드가 이 카브아웃을 실제로 강제한다.
- **클라이언트 명시 재연결 필수**: `ws-client.ts` 의 `refreshAndReconnect` 가
  `if (mySocket.connected) mySocket.disconnect(); mySocket.connect();` 로 명시적 재핸드셰이크를
  강제 — spec §6.1 예외("서버발신 disconnect 는 자동 재연결 대상이 아니다")·§9.2 8번("명시적
  `socket.connect()`") 과 일치. 1R 이 잡은 no-op 결함(단독 `connect()` 호출)은 현재 코드에 없음을
  직접 확인.
- **fallback 경로의 좁은 reason 필터**: `socket.on("disconnect", reason => { if (reason !==
  "io server disconnect") return; ... })` — spec §9.2 8번 "reason === 'io server disconnect'" 와
  정확히 일치, 다른 reason(`transport close` 등)에 개입하지 않아 Socket.IO 내장 백오프와 이중으로
  붙는 것을 방지(대조군 테스트로 확인됨).
- **in-flight 재진입 가드**: 2R 가 지적한 "가드가 트리거별로 흩어져 있어 신규 트리거가 무가드"
  문제는 현재 `inFlight` 를 헬퍼 내부(트리거 공통)에 두는 구조로 해소돼 있고, `.finally(() =>
  { inFlight = null; })` 리셋도 확인됨 — 다음 900초 주기에 다시 갱신하는지 검증하는 테스트
  (`가드는 완료 후 초기화된다`)가 실행돼 통과함을 직접 재실행으로 확인.
- **typecheck ratchet 회귀 없음**: `python3 scripts/check-frontend-typecheck-ratchet.py` 를 직접
  재실행 → `OK: frontend 타입 진단 52건 / 15파일 — baseline 과 일치.` (1R 이 겪은 C2 — 테스트가
  `connect(token: string)` 시그니처를 어기고도 vitest 가 타입을 strip 해 통과하던 문제 — 의 재발
  없음을 확인).
- **백엔드 테스트 결정성**: `npx jest src/modules/websocket/websocket.gateway.spec.ts` 실행 →
  `67 passed, 67 total` (fake timer 기반이라 결정적).
- **유저 가이드**: `password-and-sessions.mdx`/`.en.mdx` 의 "최대 15분" 표현은 access token TTL
  실측값(`auth.module.ts:41` `expiresIn: 900`)과 정확히 일치(900초 = 15분).
- **TODO/FIXME/HACK/XXX**: `git diff origin/main..HEAD -- codebase/` 에서 0건.

## 요약

3라운드에 걸친 선행 리뷰(17_38_12/18_18_53/18_45_43)가 지적한 Critical 2건(재핸드셰이크 no-op·
typecheck ratchet 미실행)과 다수 Warning(cross-generation race·in-flight 가드 무검증·중복 로직
등)이 현재 코드에 실제로 해소돼 있음을 소스 직접 대조와 재실행으로 재확인했다. spec
`R-ws-socket-lifetime-binds-token` 의 계약(60초 lead time·notice+cutoff 타이머 페어·자연 만료
카브아웃·명시적 재연결 필수·좁은 fallback reason)이 backend/frontend 코드와 line-level 로
일치하며, 이번 라운드에서 새로 발견한 유일한 실질 항목은 **cross-generation race 회귀 가드
테스트 1건의 낮은 확률(76회 중 1회) flaky 재현** — 애플리케이션 코드 경로 자체에서는 이 실패를
설명할 인과를 찾지 못해 harness 잡음 쪽에 무게를 두지만 원인 미확정이라 WARNING 으로 남긴다.
그 외 두 건(spec Planned 배지·payload JSDoc 과잉 서술)은 이전 라운드에서 이미 식별·추적되고
있으며 developer 권한 밖이거나 조치 불요로 판단된 상태를 재확인했을 뿐 새로운 결함이 아니다.

## 위험도

LOW
