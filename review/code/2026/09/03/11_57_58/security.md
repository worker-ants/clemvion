# 보안(Security) 리뷰 — WS 토큰 만료 소켓 수명 이월 INFO 정리

## 리뷰 범위

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `MSG_AUTH_TOKEN_EXPIRING` wire 문구 상수 신설
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `expiryTimers` 쌍 타입 non-optional 화, `clearExpiryTimers` 헬퍼 추출(재무장 시 선제 해제 포함), `setTimeout(...).unref()` 추가, 상수 사용
- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 위 변경에 대응하는 회귀 테스트 3종 추가
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` — 문서 갱신(체크리스트 위생, 코드 영향 없음)

이 diff 는 기존 `#1266`(소켓 수명을 토큰 수명에 종속시키는 `auth.token_expired` 기능)의 리뷰에서 5라운드 연속 지적된 이월 INFO 5건을 한 번에 정리하는 순수 리팩터/하드닝 커밋이다. 인증·인가·구독 채널 검증(IDOR 가드, `verifyOwnership`, `channelAuthorizers`) 로직 자체는 이 diff 에서 변경되지 않았다.

## 발견사항

발견된 취약점 없음. 참고용 관찰 사항만 기록한다.

- **[INFO]** `armExpiryTimers` 진입부의 선제 `clearExpiryTimers(client.id)` 호출은 현재 경로에서는 도달 불가(Socket.IO 는 연결마다 새 `client.id` 발급)하지만, 향후 `connectionStateRecovery` 활성화 시 동일 `client.id` 재연결이 가능해진다. 이때도 `armExpiryTimers` 는 `handleConnection` 에서 `jwtService.verify(token)` 검증을 통과한 새 `exp` 클레임으로만 재무장되므로, 인가 우회나 만료 시각 조작 경로는 생기지 않는다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:215` (`this.clearExpiryTimers(client.id);`)
  - 상세: `client.id` 는 서버(Socket.IO)가 생성하는 값으로 공격자가 임의 지정할 수 없어, 타 사용자 세션의 타이머를 조기 해제시키는 방식의 악용 경로는 없다.
  - 제안: 현 상태로 문제 없음. `connectionStateRecovery` 도입 시 이 가정(재무장이 항상 새로 검증된 `exp` 기반)이 유지되는지 재확인 권장.

- **[INFO]** `notice`/`cutoff` 타이머에 `.unref()` 를 추가한 것은 보안 취약점 수정이 아니라 가용성(프로세스 셧다운 지연 방지) 하드닝이다. 공격 표면에 영향 없음.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:238`-`239`

- **[INFO]** `MSG_AUTH_TOKEN_EXPIRING` 상수 export 는 이미 소켓을 통해 클라이언트에 평문으로 전송되던 문구를 리터럴에서 상수로 옮긴 것뿐이라, 새로운 정보 노출은 없다. 테스트가 `expect.any(String)`(vacuous) 대신 상수+리터럴을 함께 단언하도록 강화된 것도 품질 개선이며 보안 결함은 아니다.
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:309`-`310`

- **[INFO]** `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 변경은 문서(체크리스트) 갱신뿐이며 코드 실행 경로에 영향 없음.

## 요약

이번 diff 는 이전 라운드에서 이미 보안 검토를 마친 WS 토큰 만료 기능(`auth.token_expired`)에 대한 순수 리팩터/하드닝(타이머 쌍 non-optional 화, 해제 로직 단일화, `.unref()`, wire 문구 상수화 + 테스트 강화)이다. 인증(JWT 검증)·인가(`verifyOwnership`, `channelAuthorizers`, notifications userId 매칭)·에러 메시지 새니타이징(`buildContinuationErrorAck`) 등 보안 관련 로직은 변경되지 않았고, 인젝션·시크릿 하드코딩·평문 전송·암호화 약화 등 OWASP Top 10 관점의 새로운 취약점은 발견되지 않았다. `clearExpiryTimers` 선제 호출과 `.unref()` 는 오히려 타이머 누수·셧다운 지연이라는 잠재적 가용성 리스크를 줄이는 방향의 방어적 코드다.

## 위험도

NONE
