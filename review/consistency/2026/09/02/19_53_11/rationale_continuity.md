# Rationale 연속성 검토 — `spec/5-system/` (--impl-done)

## 검토 범위와 방법

scope(`spec/5-system/`) 자체의 델타는 0개 파일이다(이 브랜치는 spec 을 바꾸지 않았다). 구현
diff 는 8개 파일 / 699줄로, 실질은 `codebase/backend/src/modules/websocket/websocket.gateway.ts`
· `websocket-events.types.ts`(+테스트) 와 `codebase/frontend/src/lib/websocket/ws-client.ts`
(+테스트), 유저 가이드 mdx 2개, CHANGELOG, plan 문서 2개다. 프롬프트 번들은 근거 문서
`spec/5-system/6-websocket-protocol.md`(99,032자)를 예산 초과로 절단했으므로, HEAD 워킹트리를
절대경로로 직접 `Read`/`git grep` 해 §1.2·§1.3·§4.6·§6.1·§9.2 및 `## Rationale` 의
`R-ws-socket-lifetime-binds-token`·`R-wontdo-rawws-rest`·`R-wontdo-maintenance-appping` 세
항목 전문을 확인했다. 실제 코드 diff(`git diff origin/main...HEAD`)와 이 세 Rationale 항목,
그리고 `spec/5-system/1-auth.md` §1.4·§2.3(refresh family revoke가 access token 을
무효화하지 않는 stateless JWT 전제)을 대조했다.

이 라운드는 동일 결정에 대한 이전 `--impl-prep` 검토(`review/consistency/2026/09/02/17_13_02/
rationale_continuity.md`, 위험도 NONE)의 **구현 완료 후 재검증**이다 — 그때는 계획 문서만
있었고, 지금은 실제 코드가 그 계획을 그대로 구현했는지를 본다.

## 발견사항

CRITICAL/WARNING 급 Rationale 연속성 위반은 발견되지 않았다.

- **[INFO] 구현이 `R-ws-socket-lifetime-binds-token` 의 기각된 대안·범위 경계를 코드 수준에서 준수** — 조치 불요
  - target 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
    (`armExpiryTimers`, `handleConnection`, `handleDisconnect`) · `websocket-events.types.ts`
    (`AuthEventType`/`AuthTokenExpiredPayload`) · `codebase/frontend/src/lib/websocket/ws-client.ts`
    (`refreshAndReconnect`, `connect_error`/`auth.token_expired`/`disconnect` 3-트리거)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale`
    §`R-ws-socket-lifetime-binds-token`(결정 2026-09-02) — "기각된 대안"(emit-only·명령별
    재검증 guard·won't-do), "닫지 않는 것"(자연 만료만 닫고 명시적 revoke 는 넓히지 않음),
    "왜 lead time 60초인가"(관측 가능한 계약, 구현 자유도 아님)
  - 상세: 구현은 세 기각 대안 중 어느 것도 재도입하지 않았다 — emit **후** `disconnect()` 를
    실제로 수행하고(emit-only 아님), 명령별 재검증 guard 를 두지 않고 소켓 레벨 타이머로
    수신 자체를 막으며(guard-only 아님), won't-do 로 방치하지 않고 구현을 완결했다.
    `TOKEN_EXPIRY_LEAD_MS = 60_000` 은 spec 이 고정한 값 그대로 하드코딩되어 있고, 코드 주석이
    "관측 가능한 계약이라 구현 자유도가 아니다" 라는 Rationale 의 문구를 그대로 반복한다.
    revoke 관련 코드(비밀번호 변경·WebAuthn counter regression 등, `1-auth.md` §2.3/§1.4.E)는
    이번 diff 에서 건드리지 않았다 — "닫는 범위는 자연 만료뿐" 이라는 명시적 카브아웃을
    조용히 넓히지 않았다. 유저 가이드(`password-and-sessions.mdx`)의 "다른 기기 로그아웃 시
    최대 15분 안에 끊긴다" 문구도 access token TTL 900초(`auth.module.ts:41`)와 정확히
    일치하며, revoke 가 즉시 종료를 보장하지 않는다는 카브아웃을 사용자에게 정직하게 노출한다
    (즉시 종료로 과장하지 않음).
  - 제안: 없음.

- **[INFO] `R-wontdo-rawws-rest` 의 "REST 대체 충분" 결정과 충돌 없음** — 조치 불요
  - target 위치: `websocket-events.types.ts` 의 `AuthEventType.AUTH_TOKEN_EXPIRED`,
    `ws-client.ts` 의 `refreshAndReconnect`
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale`
    §`R-wontdo-rawws-rest`(결정 2026-07-08) — "§1.3 in-band `auth.refresh`/`auth.refreshed`"
    비채택. WS 상에서 토큰을 직접 재발급/전달하는 프로토콜은 REST 대체로 충분하다고 기각됨.
  - 상세: 신규 `auth.token_expired` 는 편도 통지(만료 예고)일 뿐 토큰 재발급 자체를 WS 로
    수행하지 않는다 — `refreshAndReconnect` 는 여전히 REST `refreshAccessToken()` 을 호출한다.
    기각된 "in-band 갱신"(WS 위에서 토큰을 주고받는 별도 프로토콜)을 재도입한 것이 아니라,
    REST 재발급을 **트리거**하는 신호만 WS 로 보낸다 — 결정이 허용한 잔여 항목
    (`auth.token_expired` emit, §4.6 "잔여(Planned, 구현 대기)")과 정확히 일치한다.
  - 제안: 없음.

- **[INFO] `1-auth.md` 자체 Rationale 과 §2.3/§1.4.E 의 revoke 불변식 정합** — 조치 불요
  - target 위치: `spec/5-system/1-auth.md` §2.3(비밀번호 변경 시 revoke) · §1.4.E(WebAuthn
    counter regression 시 즉시 revoke)
  - 과거 결정 출처: 동 문서 `## Rationale` — refresh token family revoke 는 stateless
    access JWT 를 무효화하지 못한다는 전제.
  - 상세: 이번 diff 가 이 두 revoke 경로에 아무 변경도 가하지 않아, WS 소켓의 "자연 만료까지
    산다" 카브아웃과 access-token stateless 전제가 계속 정합한다. 즉시 종료가 필요해지면
    이는 spec 이 명시적으로 범위 밖에 둔 별개 결정이라 새 planner 턴이 필요하다는 점을
    plan(`ws-token-expired-socket-lifetime-impl.md`)도 동일하게 인지하고 있다(체크리스트
    "머지 후 planner 턴" 항목).
  - 제안: 없음.

## 요약

이번 `--impl-done` 검토 대상(WS 소켓 수명을 토큰 수명에 종속시키는 구현)은 `spec/5-system/
6-websocket-protocol.md` 의 `## Rationale` §`R-ws-socket-lifetime-binds-token`이 명시한
기각된 대안(emit-only·명령별 guard·won't-do) 어느 것도 재도입하지 않았고, "닫는 범위는
자연 만료뿐"이라는 명시적 스코프 경계와 "60초 lead time 은 구현 자유도가 아니다"라는 설계
원칙을 코드·주석·유저 가이드 수준까지 문구 단위로 준수한다. `R-wontdo-rawws-rest`가 기각한
"WS in-band 토큰 갱신"과도 혼동되지 않으며(REST 재발급을 트리거하는 편도 통지일 뿐), `1-auth.md`
의 revoke 불변식과도 모순이 없다. 이전 `--impl-prep` 라운드(위험도 NONE)의 판단이 실제
구현으로 정확히 이행되었음을 확인했다.

## 위험도

NONE
