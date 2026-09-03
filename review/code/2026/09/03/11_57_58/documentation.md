# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** 새 코드 삽입이 기존 JSDoc 을 원래 대상 선언에서 떼어내 엉뚱한 심볼 위에 얹었다 — `armExpiryTimers` 가 사실상 무문서 상태가 됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:162-188` (특히 177-188)
  - 상세: 기존 JSDoc(원본 라인 162-176, "소켓 수명을 토큰 수명에 종속시킨다 (§1.2, Rationale `R-ws-socket-lifetime-binds-token`)...")은 원래 바로 아래의 `armExpiryTimers` 메서드(190행)를 문서화하던 블록이다. 이번 diff 는 신규 `clearExpiryTimers` 메서드와 그 JSDoc(177-181)을 **이 기존 JSDoc 블록과 `armExpiryTimers` 선언 사이에** 삽입했다. 그 결과:
    1. `clearExpiryTimers`(182행) 바로 위에는 이제 JSDoc 두 블록이 연달아 붙는다(162-176, 177-181). 대부분의 IDE/TSDoc 툴링은 **선언에 인접한 마지막 블록만** 해당 심볼의 문서로 인식하므로(두 블록 사이·블록-선언 사이 빈 줄 없음), 177-181 만 `clearExpiryTimers` 문서로 표시되고 162-176 은 고아(orphan) 주석이 된다.
    2. 정작 `armExpiryTimers`(190행, §1.2 토큰 만료·revoke 카브아웃·`exp` 부재 처리 등 보안·계약 관련 핵심 설명을 담은 원래 JSDoc 의 대상)는 이제 바로 위에 **아무 JSDoc 도 없다** — 편집기에서 그 메서드에 호버해도 문서가 뜨지 않는다.
    3. 같은 패턴이 `codebase/backend/src/modules/websocket/websocket-events.types.ts` 에도 반복된다(아래 별도 항목).
    - `git diff` 로 직접 확인: `@@ -167,6 +174,19 @@` 훙크에서 `+` 로 추가된 `clearExpiryTimers` + 그 JSDoc 이, 원래 `armExpiryTimers` JSDoc 의 닫는 `*/` 바로 다음·`private armExpiryTimers(` 선언 바로 앞에 끼워진 것을 확인했다(Read 로 실제 파일도 재확인, 라인 147-190).
  - 제안: `clearExpiryTimers`(+ 그 JSDoc)를 `armExpiryTimers` 정의 **뒤**로 옮기거나(선언 순서: `armExpiryTimers` → `clearExpiryTimers`), 혹은 `clearExpiryTimers` 를 그 위치에 유지하려면 원래 있던 §1.2 JSDoc 블록을 `armExpiryTimers` 바로 위로 재배치해 두 선언이 각각 자신의 JSDoc 바로 아래 오도록 정리한다.

- **[WARNING]** 동일 패턴 — `AuthTokenExpiredPayload` 의 JSDoc 이 신규 상수 삽입으로 원래 대상에서 분리됨
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:287-312` (특히 287-311)
  - 상세: 287-301행의 JSDoc(`Wire payload for {@link AuthEventType.AUTH_TOKEN_EXPIRED}. spec §4.6 의 shape {message, expiresAt}...`, 클라이언트가 `expiresAt` 을 소비하지 않는다는 계약 설명, 동명 다른 필드와의 구분, 이전 리뷰(4R W3)에서 발견된 "초판 JSDoc 이 구현보다 넓었다"는 정정 이력까지 담은 상세 블록)는 원래 바로 다음의 `export interface AuthTokenExpiredPayload`(312행, `{message, expiresAt}`) 를 문서화하던 것이다. 이번 diff 가 그 사이에 `MSG_AUTH_TOKEN_EXPIRING` 상수와 그 자체 JSDoc(302-308)을 끼워 넣어, 287-301 JSDoc 은 이제 `AuthTokenExpiredPayload` 로부터 분리되고 (302-308 이 대신 `MSG_AUTH_TOKEN_EXPIRING` 에 인접 attach), `AuthTokenExpiredPayload` 인터페이스 자체는 직접 선행하는 JSDoc 이 없는 상태가 됐다. Read 로 파일 원본을 재확인해 조립 diff 의 착시가 아님을 검증했다.
  - 제안: `MSG_AUTH_TOKEN_EXPIRING`(+ JSDoc)을 `AuthTokenExpiredPayload` 인터페이스 **뒤**로 옮기거나, `AuthEventType` enum 앞으로 옮겨 기존 payload JSDoc 과 인터페이스 사이를 침범하지 않게 한다.

- **[INFO]** `expiryTimers` 필드 위에 JSDoc 두 블록이 중복 적재됨(오귀속은 아님, 정리 여지)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:147-160`
  - 상세: `private readonly expiryTimers = new Map<...>` 선언 바로 위에 기존 블록(147-150, "소켓별 만료 타이머(사전 통지·강제 종료). `handleDisconnect` 에서 둘 다 해제한다…")과 신규 블록(151-156, "타이머 **쌍**…optional 이 아니다" — non-optional 화 근거)이 연달아 붙는다. 대상 선언은 하나뿐이라 위 두 건과 달리 오귀속(다른 심볼로 잘못 붙는 것)은 아니지만, 두 블록이 내용상 겹치는 서두("소켓별 만료 타이머")를 반복하며 하나의 JSDoc 으로 합쳐질 수 있는 내용이다.
  - 제안: 필수는 아니나, 다음에 이 파일을 만질 때 두 블록을 하나의 JSDoc 으로 병합해 가독성을 높인다.

- **[INFO]** 위 두 WARNING 항목은 같은 커밋 안에서 2회 반복된 동일 패턴(새 선언+JSDoc 을 "기존 JSDoc"과 "그 문서화 대상" 사이에 삽입)이다 — 후속 PR 에서 신규 심볼을 기존 JSDoc 블록 바로 아래에 끼워 넣기 전에, 그 JSDoc 이 원래 어떤 선언을 향하고 있었는지 확인하는 편이 안전하다.

## 그 외 확인 사항 (문제 없음)

- `MSG_AUTH_TOKEN_EXPIRING` 자체의 새 JSDoc(내용)은 상수 승격 근거를 정확히 설명하고, `websocket.gateway.spec.ts` 의 신규 테스트(문구 리터럴 이중 단언·재무장 시 옛 타이머 해제·`unref()` 검증)와 실제 구현이 서로 정합한다.
- `armExpiryTimers` 본문에 새로 추가된 인라인 주석(재무장 시 `clearExpiryTimers` 선제 호출 이유, `Math.max(0, …)` 중복 방어 근거를 `untilNotice`·`cutoff` 양쪽에 각각 명시, `unref()` 이유)은 이전 라운드에서 "근거 주석이 한쪽에만 있다"고 지적된 갭을 정확히 메웠다 — `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 체크리스트 서술과 diff 내용이 1:1 로 일치.
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 의 변경은 이월 INFO 5건의 해소 근거(뮤테이션 RED 축)를 항목별로 기록해 변경 이력 문서화 품질이 양호하다.
- 이번 diff 는 기존에 이미 shipping 된 기능(`auth.token_expired`, CHANGELOG.md 의 "소켓이 만료된 토큰으로 무기한 인가돼 있었다" 항목)의 내부 하드닝/리팩터일 뿐 wire 계약·API·설정을 바꾸지 않으므로, README/CHANGELOG/spec 프로토콜 문서 추가 갱신은 불필요하다(spec 배지 flip 은 이미 별도 planner 턴에서 완료됨 — 본 diff 범위 밖).

## 요약

핵심 발견은 동일 패턴의 문서-선언 오귀속(orphaned JSDoc) 2건이다 — 신규 상수/메서드(`MSG_AUTH_TOKEN_EXPIRING`, `clearExpiryTimers`)가 기존의 상세한 JSDoc 블록과 그 문서화 대상(`AuthTokenExpiredPayload`, `armExpiryTimers`) 사이에 삽입되면서, 두 파일 모두에서 원래 문서가 향하던 심볼이 이제 직접 선행 JSDoc 없이 남았다(툴링상 문서 유실). 내용 자체는 소스에 그대로 남아 있어 순차적으로 읽으면 파악 가능하지만, IDE 호버·TSDoc 생성기 기준으로는 보안/계약 관련 핵심 설명(토큰 revoke 카브아웃, `expiresAt` 비소비 계약 등)이 엉뚱한 심볼에 붙거나 완전히 실종된 것처럼 보인다. 그 외에는 신규 테스트·인라인 주석·plan 변경 이력의 문서화 품질이 양호하고, README/CHANGELOG/spec 갱신 필요성도 없다.

## 위험도

MEDIUM
