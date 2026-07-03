# 보안(Security) Review

## 대상 개요

`06-concurrency` 잔여 배치(M-3/M-6/m-3/m-5) 재검토. 실질 소스 변경은 WebSocket gateway
의 `join`/`leave` await+롤백(`websocket.gateway.ts`), frontend WS 클라이언트의 이벤트
리스너 이중 등록 방지·connect churn 가드·dismiss hysteresis(`ws-client.ts`,
`use-execution-events.ts`), 그리고 대응 테스트다. 이전 리뷰 세션
(`review/code/2026/07/03/21_48_56/security.md`, 위험도 NONE) 대비 이번 changeset 의 유일한
실질 추가분은 `handleUnsubscribe` 의 `leave()` reject 시 best-effort 성공 계약을 검증하는
회귀 테스트 1건(`websocket.gateway.spec.ts`)과 `plan/`·`review/` 문서 갱신이며, 프로덕션
코드(`websocket.gateway.ts`, `ws-client.ts`, `use-execution-events.ts`)는 직전 세션과
동일하다. 소스코드를 직접 재확인해 아래 판단을 재검증했다.

## 발견사항

- **[INFO]** join/leave 실패 원본 메시지가 서버 로그에만 기록되고 client 에는 노출되지 않음 (기존 정책과 일관)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:270-281` (`handleSubscribe` catch), `codebase/backend/src/modules/websocket/websocket.gateway.ts:349-357` (`handleUnsubscribe` catch)
  - 상세: `client.join(channel)` / `client.leave(channel)` 이 reject 되면 `err.message` 를 `this.logger.warn(...)` 으로만 남기고, client 로 반환되는 ack 는 join 실패 시 고정 문자열(`'Subscription failed — please retry'`), leave 실패 시에는 애초에 실패를 노출하지 않고 `success:true` 로 응답한다. 원본 예외 메시지가 소켓 응답 페이로드에 섞여 나가는 경로는 없음을 코드 레벨에서 재확인했다. 현재 in-memory adapter 에서는 `err.message` 에 민감정보가 담길 가능성이 낮으나, 향후 Redis adapter 등 외부 브로커 도입 시 연결 문자열/자격증명이 에러 메시지에 포함될 수 있어 로그 레벨에서도 완전히 무해하다고 단정할 수는 없다.
  - 제안: 현재 설계(로그 전용 + client 고정 문자열)로 충분. Redis adapter 등 외부 어댑터 도입 시점에 `err.message` 에 credential/connection-string 이 섞이지 않는지 별도 점검 권장(이미 plan/RESOLUTION 에도 후속 항목으로 기록됨).

- **[INFO]** join 실패 롤백이 인가(authorize) 완료 이후 지점에서만 동작 — 우회 경로 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:217-226`(authorize) → `:237-263`(tentative-add + 한도 가드) → `:268-281`(join await + 롤백) → `:292-297`(snapshot 발행)
  - 상세: 순서를 재확인한 결과 `authorizer.authorize()` await 및 workspace/rejection 체크가 `client.join()` await 보다 먼저 실행되고, join 실패 시 즉시 `return` 하여 `emitExecutionSnapshot`(IDOR 방어가 걸린 지점)에는 도달하지 않는다. 즉 join 실패/롤백 신규 로직이 기존 CRIT-1 IDOR 방어(§7.5.2, `verifyOwnership`)를 우회하는 경로를 만들지 않는다.
  - 제안: 없음(확인용).

- **[INFO]** `handleUnsubscribe` 는 `leave()` 실패에도 항상 `success:true` 반환 — 정보 누출/IDOR 아님
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:336-364`, 회귀 테스트 `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` (`'should still ack success when leave() rejects (best-effort)'`, 이번 diff 신규 추가)
  - 상세: `clientSubs.delete(channel)` 이 먼저 실행되어 서버 측 논리 구독 상태는 즉시 정리되며, `client.leave()` 가 reject 되어도 warn 로그만 남기고 ack 는 성공으로 응답한다. room 멤버십이 실제로는 남아있을 가능성이 있으나(disconnect 시 socket.io 가 auto-leave 로 정리), 이는 동일 소유자(같은 워크스페이스/사용자) 채널에 대한 재수신 가능성일 뿐 타 워크스페이스 데이터 노출(IDOR)로 이어지지 않는다. 신규 테스트는 이 best-effort 계약을 정확히 검증한다(`subs.has(channel)` 는 false, `result.data.success`는 true).
  - 제안: 보안 영향 없음. 조치 불요.

- **[INFO]** 신규/변경 로직에서 인젝션·하드코딩 시크릿·인증 우회·암호화 약화 패턴 없음
  - 위치: 전체 diff(`websocket.gateway.ts`, `ws-client.ts`, `use-execution-events.ts` 및 대응 테스트)
  - 상세: 이번 변경은 Promise await/catch 추가, 프런트 이벤트 리스너 dedup(`bind()` 헬퍼), socket.io `active` 상태 가드, `setTimeout` 기반 UX hysteresis 로 구성되며 사용자 입력을 새로 파싱·구성(SQL/명령/경로)하는 지점이 없다. 채널 문자열(`channel`)은 기존 `isValidChannel`/authorizer 검증을 그대로 통과해야 하는 경로 그대로이며 이번 diff 로 검증 로직이 약화되지 않았다. API 키/토큰/자격증명 등 하드코딩된 시크릿도 발견되지 않았다.
  - 제안: 없음.

## 요약

이번 changeset 은 06-concurrency 리팩터 잔여 배치(WebSocket join/leave await+롤백, 프런트 리스너 이중 등록 방지, connect churn 가드, dismiss hysteresis)의 재검토이며, 프로덕션 코드는 직전 세션(21_48_56, 위험도 NONE)과 동일하고 유일한 실질 추가는 `handleUnsubscribe` best-effort 계약을 검증하는 테스트 1건이다. 인증(JWT)·인가(ChannelAuthorizer, IDOR 방어)·에러 client-safe 정책은 이번 diff 로 변경되지 않았으며, 소스를 직접 재확인한 결과 join 실패 롤백·leave best-effort 응답 모두 기존 인가 순서와 정보 노출 정책을 그대로 준수한다. 인젝션, 하드코딩된 시크릿, 인증 우회, 안전하지 않은 암호화, 민감정보 노출 등 실질적 보안 결함은 발견되지 않았다.

## 위험도

NONE
