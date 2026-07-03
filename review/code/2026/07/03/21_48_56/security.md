# 보안(Security) Review

## 발견사항

- **[INFO]** join 실패 에러가 서버 로그에 원문 그대로 기록됨 (내부 정보 노출 범위는 로그로 한정)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `handleSubscribe` catch 블록 (`this.logger.warn(...err.message...)`), `handleUnsubscribe` catch 블록
  - 상세: `client.join(channel)` / `client.leave(channel)` 실패 시 `err.message`를 서버 로그(`logger.warn`)에 기록한다. client 로 반환되는 ack 는 고정 문자열(`'Subscription failed — please retry'`)이라 client-safe 하며, 기존 `buildContinuationErrorAck` 의 typed/untyped 분리 패턴과 일관되게 원본 메시지를 client 에 전달하지 않는다. 다만 어댑터(Redis 등) 전환 시 `err.message` 에 연결 문자열·호스트 정보가 담길 가능성이 있어 로그 레벨에서도 완전한 무해성은 보장되지 않는다.
  - 제안: 현재 설계(로그 전용, client 에는 fallback 고정 문자열)로 충분하나, 향후 Redis adapter 도입 시 `err.message` 에 credential 이 섞이지 않는지(예: Redis URL에 password 포함) 별도 점검 권장.

- **[INFO]** join 실패 롤백 로직의 동시성 안전성 확인됨 (문제 없음, 검증 목적 기록)
  - 위치: `websocket.gateway.ts` `handleSubscribe` — tentative-add(`clientSubs.add(channel)`) 후 `await client.join(channel)` 실패 시 `clientSubs.delete(channel)`
  - 상세: JS 이벤트 루프의 단일 스레드 특성상 `await` 지점 사이에 다른 핸들러가 끼어들 수 있으나, 동일 클라이언트의 동일 채널에 대한 중복 subscribe race 는 `isNewSubscription` 체크와 tentative-add 사후 가드(size 초과 시 rollback)로 방어되어 있다. join 실패 rollback 도 동일 `clientSubs` 참조를 조작하므로 일관성이 유지된다. IDOR 인가(`authorizer.authorize`)는 join 이전에 이미 완료되어 있어 join 실패/롤백 경로가 인가 우회로 이어지지 않는다.
  - 제안: 없음 — 기존 IDOR 방어(§CRIT-1, W-5, S1 등 코드 주석에 명시)와 정합적으로 확장됨.

- **[INFO]** `handleUnsubscribe` 가 `leave` 실패에도 항상 `success: true` 반환
  - 위치: `websocket.gateway.ts` `handleUnsubscribe`
  - 상세: `clientSubs.delete(channel)` 후 `client.leave(channel)` 이 reject 되어도 warn 로그만 남기고 ack 는 그대로 성공 처리한다. 주석에 의도된 것으로 명시(`disconnect 시 정리`). room 멤버십이 실제로는 유지된 채 클라이언트는 "구독 해제됨"으로 인지하는 상태가 남을 수 있으나, `clientSubs`(서버 측 논리 구독 상태)는 이미 제거되었으므로 이후 `broadcastToChannel` 이 해당 클라이언트에게 새 이벤트를 보내더라도 클라이언트 측에서 걸러질 여지는 없다 — room 을 통한 emit 이 계속 도달할 수 있음(정보 누출은 아니고 동일 소유자 채널이므로 IDOR 아님, UX/리소스 이슈에 가까움).
  - 제안: 보안 영향은 없음(동일 워크스페이스/사용자 채널 재수신에 불과). 필요시 disconnect 시 강제 `leave` 로 정리되는 것으로 충분.

- **[INFO]** 신규 테스트에서 SQL 인젝션 유사 페이로드로 UUID validation 회귀 가드 확인됨 — 기존 방어 유지
  - 위치: `websocket.gateway.spec.ts` L427-444 (`background:run:not-a-uuid; DROP TABLE x;`)
  - 상세: 이번 diff 에서 새로 추가된 테스트는 아니고 기존 방어(UUID 정규식 검증 후에만 DB 조회)가 이번 변경으로 깨지지 않았음을 재확인. `verifyBackgroundRunOwnership` 이 호출되지 않아 injection 이 DB 계층에 도달하지 않는다.
  - 제안: 없음(정보성).

## 요약

이번 변경은 `06-concurrency` 잔여 배치(M-3, M-6, m-3, m-5)로, WebSocket subscribe/unsubscribe 시 `join`/`leave` 를 `await`하고 실패 시 구독 상태를 롤백하는 견고성 개선, 프런트엔드 이벤트 리스너 이중 등록 방지(off-before-on), WS 클라이언트 연결 churn 방지 가드(`active` 체크), 그리고 재연결 flap 시 warning toast hysteresis 를 다룬다. 인증(JWT)·인가(channel authorizer, IDOR 방어)·에러 메시지 client-safe 정책은 기존 로직을 그대로 재사용하며 이번 diff 로 변경되지 않았고, 새로 추가된 join/leave 실패 경로도 인가 완료 이후 지점에서만 동작하므로 우회 경로가 생기지 않는다. 새 에러 처리도 client 에는 고정 generic 메시지만 노출하고 원본 에러는 서버 로그로 한정해 기존 §7.5.2 누출 차단 정책과 일관된다. 신규/변경된 로직에서 인젝션, 하드코딩 시크릿, 인증 우회, 암호화 약화 등 실질적 보안 결함은 발견되지 않았다.

## 위험도

NONE
