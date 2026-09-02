# 요구사항(Requirement) 리뷰

대상: WS `auth.token_expired` — 소켓 수명을 토큰 수명에 종속시키는 기능
(`spec/5-system/6-websocket-protocol.md` §1.2/§1.3/§4.6/§6.1/§9.2, Rationale
`R-ws-socket-lifetime-binds-token`). HEAD = `a18376f0c`(feat `b019d7de3` → 1R~4R fix
4커밋), `review/code/2026/09/02/{17_38_12,18_18_53,18_45_43,19_12_36}/**` 4라운드 리뷰가
선행. 이번은 **5라운드째**(세션 `19_41_19`) — 선행 라운드의 RESOLUTION/SUMMARY 를 주장으로
받아쓰지 않고 `codebase/backend/src/modules/websocket/websocket.gateway.ts`,
`codebase/frontend/src/lib/websocket/ws-client.ts`, 두 테스트 파일, `websocket-events.types.ts`,
`spec/5-system/6-websocket-protocol.md` 본문·Rationale 을 직접 `Read` 로 재대조하고,
`check-frontend-typecheck-ratchet.py`(frontend), `npx jest websocket.gateway.spec.ts`(backend
67 passed), `npx vitest run ws-client.test.ts`(frontend 26 passed, 이번 실행은 flake 미관측)를
실제 재실행해 4라운드가 기록한 상태가 여전히 유효한지 확인했다(저장소 파일은 수정하지 않음,
`git status --short` 로 확인 — 뮤테이션 없이 순수 재실행만 수행).

## 발견사항

- **[INFO]** `[SPEC-DRIFT]` §1.2/§4.6/Rationale 이 여전히 `auth.token_expired` 를 `_(계획·미구현)_`(Planned)로 표기 — 구현은 이번 diff 로 완전히 완료됨. **이미 추적됨, developer 권한 밖, 조치 불요**
  - 위치: `spec/5-system/6-websocket-protocol.md:52`("서버발신 emit 은 미구현 (Planned)"),
    `:876`(§4.6 표의 `_(계획·미구현)_` 배지), `:1100`("잔여(Planned, 구현 대기)"),
    `:1133`("배지는 구현 전까지 Planned 다")
  - 상세: `codebase/backend/src/modules/websocket/websocket.gateway.ts` 의 `armExpiryTimers`
    (170-210행, `handleConnection` 243행에서 호출) + `AuthEventType`/`AuthTokenExpiredPayload`
    (`websocket-events.types.ts:283-305`) + frontend `ws-client.ts` 의 구독/재핸드셰이크
    (111-143행)가 정확히 이 배지가 "구현 대기"라고 부르는 것을 구현했음을 코드로 재확인했다.
    분류 기준상 이는 "코드가 맞고 spec 이 낡은" 전형적인 SPEC-DRIFT다 — 다만 `spec_impact:
    none`(`plan/in-progress/ws-token-expired-socket-lifetime-impl.md:5`)로 developer 가 이번 PR
    범위에서 명시적으로 spec 을 건드리지 않기로 했고, 그 문구의 원저자가 아니므로
    CLAUDE.md 자기-반증형 소정정 예외에도 해당하지 않는다. 같은 plan 체크리스트(84-86행)에
    "머지 후 planner 턴 — spec 의 `_(계획·미구현)_` 배지 flip(§1.2·§4.6·Rationale·`:28`)과
    `spec-sync-websocket-protocol-gaps.md:23` 체크박스"로 이미 명시 등재돼 있고, 1R~4R
    requirement/api_contract 리뷰가 전 라운드 이 상태를 확인·재확인했다.
  - 제안: 코드 조치 불요(재확인). "코드 유지 + spec 반영" — 머지 후 별도 planner 턴에서
    `spec/5-system/6-websocket-protocol.md:52,876,1100,1133` 의 `_(계획·미구현)_`/Planned 배지를
    구현 완료로 flip 하고 `plan/in-progress/spec-sync-websocket-protocol-gaps.md:23` 체크박스도
    함께 닫는다. 이미 tracked 이므로 WARNING 으로 격상하지 않고 INFO 로 유지한다.

- **[INFO]** cross-generation race 회귀 가드 테스트의 낮은 확률 flaky 관측(4R WARNING) — 이번 재실행(26/26)에서는 재현 안 됨, plan 에 watch 항목으로 이미 등재
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:287`(`it("옛 세대의
    재발급은 새 소켓을 건드리지 않는다", ...)`)
  - 상세: 4R 리뷰어가 76회 중 1회 관측한 flake 를 이번 라운드에서 재실행(`vitest run` 1회,
    26/26 pass)으로는 재현하지 못했다. 4R RESOLUTION 이 150회 반복 0실패를 이미 기록했고,
    `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:98-109` 에 "재현 못 했다 를 flaky
    아니다 로 읽지 말 것" 이라는 명시적 watch 항목(재개 신호: 한 번이라도 더 실패하면 원인을
    끝까지 판다)으로 이미 등재돼 있다. 새로운 정보 없음.
  - 제안: 조치 불요(재확인). 다음 실패 관측 시 plan 의 재개 신호를 따른다.

## 검토했으나 이상 없음으로 판단한 항목 (spec §1.2/§1.3/§4.6/§6.1/§9.2 + Rationale 대조, line-level)

- **lead time 60초**: `websocket.gateway.ts:144` `TOKEN_EXPIRY_LEAD_MS = 60_000` = spec §1.2:52/
  §9.2:1061/Rationale:1141 "만료 60초 전" 과 문구 단위 일치.
- **payload shape**: `AuthTokenExpiredPayload { message: string; expiresAt: string }`
  (`websocket-events.types.ts:302-305`) = spec §4.6:876 표 `{ message, expiresAt }`. `expiresAt`
  의미("이 소켓이 강제 종료되는 시각")도 JSDoc(`:291`)·spec(`:876`)·Rationale 삼자가 동일 문구.
- **notice/cutoff 페어링 + exp 부재 가드**: `armExpiryTimers`(`:170-210`)가 `exp` 비-number/
  비-finite 시 조기 return(spec §1.2 "그런 토큰은 핸드셰이크 검증이 이미 통과시킨 것이라 끊을
  근거 없음" 과 일치) → `handleConnection:243`에서만 호출 → `handleDisconnect:286-291`에서 `notice`·
  `cutoff` 둘 다 `clearTimeout` — spec "handleDisconnect 에서 타이머 해제" 와 일치. 백엔드
  `websocket.gateway.spec.ts` 5개 케이스(사전 통지 1회·정시 disconnect·둘 다 해제·lead time 보다
  짧은 토큰 즉시 통지·`exp` 부재 무동작, 720-825행)가 이 표를 그대로 커버 — 재실행 67/67 pass.
- **revoke 카브아웃**: `armExpiryTimers` JSDoc(`:162-164`) "닫는 범위는 자연 만료뿐" = spec
  §1.2:55/Rationale 의 "명시적 revoke 는 refresh family 만 무효화, access token 은 자연 exp 까지
  유효(최대 15분)" 와 일치. `password-and-sessions.{mdx,en.mdx}` Callout 의 "최대 15분" 표현도
  access token TTL(900초=15분)과 정확히 일치.
- **클라이언트 명시 재연결(no-op 회피)**: `ws-client.ts:85-86`
  `if (mySocket.connected) mySocket.disconnect(); mySocket.connect();` 가 spec §6.1:969/
  §9.2:1061 이 요구하는 "명시적 `socket.connect()`"를 실제 재핸드셰이크로 이행 — 1R 이 잡은
  "connect() 단독 no-op" 결함이 현재 코드에 없음을 재확인. 테스트(`ws-client.test.ts:155-172`)가
  `disconnect`→`connect` 호출 순서까지 단언.
- **fallback 좁은 reason 필터**: `ws-client.ts:140-143`
  `if (reason !== "io server disconnect") return;` — spec §9.2:1062 "reason === 'io server
  disconnect'" 와 정확히 일치, 대조군 테스트(`:323-333`, `transport close` 는 무시)로 확인.
- **in-flight 재진입 가드 + 세대 격리**: `ws-client.ts:60,64,68,74,94-96` — 헬퍼 내부 공통
  가드(2R 수정) + 소켓 세대 스냅샷·비교(3R 수정) + `.finally` 초기화(3R 수정)가 모두 현재
  코드에 남아 있고, 대응 테스트(겹친 트리거/옛 세대 무시/가드 재초기화, 189-321행) 재실행 통과.
- **typecheck ratchet 회귀 없음**: `python3 scripts/check-frontend-typecheck-ratchet.py` 재실행
  → `OK: frontend 타입 진단 52건 / 15파일 — baseline 과 일치.` (1R C2 — 테스트가
  `connect(token: string)` 시그니처를 어기고도 vitest 타입 strip 으로 통과하던 결함 — 의 재발
  없음 재확인).
- **TODO/FIXME/HACK/XXX**: `git diff origin/main..HEAD -- codebase/` 에 해당 마커 0건
  (websocket 변경 파일 5개 전수 확인).
- **반환값 완전성**: `armExpiryTimers`(void, 부작용 함수)·`handleConnection`/`handleDisconnect`
  모두 모든 분기(토큰 부재·검증 실패·exp 부재·정상)에서 명시적으로 처리하고 암묵적
  `undefined` 반환으로 새는 경로 없음. frontend `refreshAndReconnect` 도 성공/빈 토큰/throw
  세 경로 모두 소켓 상태를 일관되게 남긴다(테스트 232-259행으로 커버).

## 요약

이번 diff 는 `spec/5-system/6-websocket-protocol.md` §1.2/§1.3/§4.6/§6.1/§9.2 + Rationale
`R-ws-socket-lifetime-binds-token` 이 규정한 계약(60초 lead time·notice+cutoff 타이머 페어·
자연 만료 카브아웃·명시적 재핸드셰이크·좁은 fallback reason·in-flight/세대 가드)을 backend·
frontend 양쪽에서 line-level 로 정확히 구현하고 있음을 소스 직접 대조와 3개 테스트 스위트
재실행(backend 67/67, frontend 26/26, typecheck ratchet baseline 일치)으로 재확인했다. 선행
4라운드가 발견·조치한 Critical 2건(재핸드셰이크 no-op·typecheck ratchet 미실행)과 다수
Warning(cross-generation race·in-flight 가드 무검증·중복 로직·JSDoc 과잉 서술 등)은 현재 코드에
전부 해소된 상태로 남아 있다. 이번 라운드에서 새로 발견한 결함은 없으며, 남은 두 관찰
(spec Planned 배지 SPEC-DRIFT·cross-generation flaky 관측)은 둘 다 이전 라운드에서 이미
식별·추적되고 있고 developer 권한 밖(전자)이거나 재현 불가(후자)로 조치 불요 상태임을 재확인한
것뿐이다. 요구사항 충족·spec fidelity 관점에서 병합을 막을 사안 없음.

## 위험도

LOW
