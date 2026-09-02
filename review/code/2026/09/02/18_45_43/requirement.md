# 요구사항(Requirement) 리뷰

대상: `auth.token_expired` — WS 소켓 수명을 토큰 수명에 종속(backend 타이머 + frontend 구독·재핸드셰이크). 3라운드째 리뷰(1R/2R 는 이미 CRITICAL 2건 + WARNING 다수를 발견·수정·뮤테이션으로 재검증 완료 — `review/code/2026/09/02/17_38_12/RESOLUTION.md`, `review/code/2026/09/02/18_18_53/RESOLUTION.md`). 본 라운드는 그 수정이 반영된 최종 상태를 기준으로 독립적으로 재검토했다.

## 발견사항

- **[INFO]** spec 배지가 아직 "미구현(Planned)" 인 채로 코드는 이미 구현을 마쳤다 (developer 권한 밖, 이미 등재됨)
  - 위치: `spec/5-system/6-websocket-protocol.md:28`(intro blockquote `_(계획·미구현)_`), `:876`(§4.6 표 `auth.token_expired _(계획·미구현)_`), `:1133`("배지는 구현 전까지 Planned 다")
  - 상세: 본 diff(`websocket.gateway.ts`/`ws-client.ts`/두 spec 파일)가 §1.2·§4.6·§9.2 가 서술한 backend 타이머 + frontend 구독·명시적 재연결을 완전히 구현했는데도, spec 본문은 여전히 `auth.token_expired` 를 "계획·미구현" 으로 표기한다. line-level 로는 spec 과 코드가 어긋나 보이지만, 이는 코드 결함이 아니라 developer 가 spec 원저자가 아니라서(자기-반증형 소정정 예외 미해당) 의도적으로 건드리지 않은 것이다 — `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 체크리스트에 "머지 후 planner 턴" 항목으로 이미 정확히 포인터가 남아 있다(`spec-sync-websocket-protocol-gaps.md:23` 체크박스도 같은 이유로 아직 `[ ]`). 새로 조치할 필요 없음 — 다만 SUMMARY 집계 시 "spec 불일치" 로 오판하지 않도록 명시.
  - 제안: 조치 불요(이미 plan 에 등재됨). 머지 후 planner 턴에서 spec 배지 flip + tracker 체크박스 동시 갱신.

- **[INFO]** 필드/이벤트/타입 시그니처는 spec §4.6·Rationale `R-ws-socket-lifetime-binds-token` 과 line-level 로 완전히 일치
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:283-300` (`AuthEventType.AUTH_TOKEN_EXPIRED = 'auth.token_expired'`, `AuthTokenExpiredPayload { message: string; expiresAt: string }`) vs `spec/5-system/6-websocket-protocol.md:876`(`{ message, expiresAt }`)·`:1144`(lead time 60초 — 900초의 약 6.7%)·`:1148`(`expiresAt` = 강제 종료 시각)
  - 상세: `TOKEN_EXPIRY_LEAD_MS = 60_000`(`websocket.gateway.ts:144`)은 spec 이 고정한 60초와 정확히 일치. `expiresAt` 계산(`expiresAtMs = expSeconds * 1000` → cutoff 시각)도 spec 의 "이 소켓이 강제 종료되는 시각" 정의와 일치. access token TTL 900초(`auth.module.ts:41`, `auth.service.ts:1065`)로 60/900=6.67%, 주석의 "약 6.7%" 실측과도 일치(직접 계산 검증). revoke 카브아웃("자연 exp 까지 최대 15분")도 `1-auth.md §1.4·§2.3` 및 유저 가이드 mdx(`password-and-sessions.mdx:72`, `.en.mdx:56`)의 "within 15 minutes"/"최대 15분" 표현과 수치까지 정합. 결함 아님 — spec fidelity 관점에서 긍정적으로 확인.
  - 제안: 조치 불요.

- **[INFO]** #1174 회귀 가드(`EXPECTED_EXPORTS`) 완전성 — 이전 라운드 WARNING 이 이번 diff 에 이미 반영됨
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:62-66`
  - 상세: `AuthEventType`/`AuthTokenExpiredPayload` 가 목록에 추가돼 있고, 실제로 `websocket-events.types.ts` 의 두 신규 export 와 1:1 대응함을 `Read` 로 직접 대조 확인. 조치 완료 상태.
  - 제안: 조치 불요.

- **[INFO]** 프론트 in-flight 가드·backend 타이머 해제 양쪽 모두 엣지 케이스가 테스트로 고정돼 있음
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:189-211`(겹친 트리거 in-flight 가드), `:232-259`(재발급 실패 시 소켓 미터치 — 빈 토큰/throw 두 갈래), `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:793-824`(lead time 보다 짧은 토큰 즉시 통지, `exp` 없는 토큰은 타이머 미설정)
  - 상세: 직접 코드를 읽고 각 분기(재발급 성공/빈 토큰/throw, 겹친 트리거, `exp` 없음, lead time 보다 짧은 잔여 시간)를 대조한 결과 spec §1.2/§9.2 가 요구하는 동작과 어긋나는 지점을 찾지 못했다. `armExpiryTimers` 의 `Math.max(0, …)` 중복 방어(:187-190)도 문서화된 대로 "Node 가 음수 지연을 1ms 로 강제" 하는 런타임 세부와 별개로 의도를 명시하는 용도로 판단, 결함 아님.
  - 제안: 조치 불요.

- **[INFO]** 재발급이 반복 실패하면 자동 재시도가 없다 — 설계상 정지점으로 보이나 명시 문서화는 없음
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:78-80`(catch 블록, `console.error` 만 하고 종료)
  - 상세: `refreshAndReconnect` 가 `refreshAccessToken()` 에서 throw 하면 로그만 남기고 소켓은 그대로 disconnected 상태로 남는다. 다만 cutoff 시점에 서버가 `disconnect()` 하면 `reason === "io server disconnect"` fallback 이 다시 한 번 재시도 기회를 준다(사전 통지 재발급 실패 → cutoff 강제종료 → fallback 재시도). 그 fallback 마저 실패하면(예: refresh token 자체가 무효) 이후 자동 재시도 경로가 없다 — Socket.IO 내장 재연결도 서버발신 disconnect 엔 발화하지 않는다(§6.1 예외)는 게 이 설계의 전제이므로 의도된 정지점으로 보인다(재발급이 근본적으로 실패하면 재로그인이 맞는 응답). 이 자체는 spec 이 요구하는 무한 재시도를 약속하지 않으므로 결함으로 보기 어렵다.
  - 제안: 조치 불요(설계상 타당). 다만 이 정지점(재발급이 두 번 다 실패하면 사용자가 조용히 끊긴 채 남는다)을 유저 가이드나 코드 주석에 한 줄 명시하면 다음 사람이 "왜 재시도가 없나"를 다시 조사하지 않아도 된다 — 선택 사항.

## 요약

핵심 변경(backend `armExpiryTimers`/`AuthEventType`/`AuthTokenExpiredPayload`, frontend `refreshAndReconnect` 공통 헬퍼 + `auth.token_expired`/`disconnect(io server disconnect)` 구독)은 spec §1.2·§4.6·§6.1·§9.2 및 Rationale `R-ws-socket-lifetime-binds-token` 과 필드명·이벤트명·기본값(60초 lead·900초 TTL·15분 revoke 카브아웃)까지 line-level 로 정확히 일치했다. TODO/FIXME 잔존 없음, 모든 코드 경로에서 반환값·에러 ack 형태가 일관되며, 이전 2라운드가 발견한 두 Critical(재핸드셰이크 no-op·재진입 가드 부재)은 뮤테이션 테스트로 재검증된 채 현재 코드에 반영돼 있음을 직접 코드 읽기로 확인했다. 유일하게 남은 line-level 불일치는 spec 본문의 `_(계획·미구현)_` 배지가 아직 flip 되지 않은 것인데, 이는 developer 권한 밖이라는 사유로 plan 체크리스트에 이미 포인터가 등재된 기지(旣知) 항목이라 새로운 결함으로 보지 않는다. 요구사항 충족·엣지 케이스·에러 시나리오·spec fidelity 전 관점에서 추가로 조치할 Critical/Warning 은 발견하지 못했다.

## 위험도

NONE
