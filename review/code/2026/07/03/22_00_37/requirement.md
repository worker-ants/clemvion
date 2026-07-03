# 요구사항(Requirement) Review

## 발견사항

- **[INFO]** `plan/in-progress/refactor/README.md` 요약 각주(30행)가 이번 diff 로 갱신된 표 합계(완료 81/잔여 3)와 불일치
  - 위치: `plan/in-progress/refactor/README.md:27` (표 합계 행, 이번 diff 로 76→81, 8→3, 1→0 갱신됨) vs `:30` (`완료(76) + 철회·종결(20) + 잔여(8) = 104. 처리 종료(완료+철회·종결) = 96/104.` — 미갱신)
  - 상세: 27행 합계는 이번 커밋으로 정확히 갱신됐다(10+3+2+0=15 row 내부 정합, 76+5=81 누적 정합 — C-2(전전 커밋)+M-3/M-6/m-3/m-5(본 커밋) 총 5건 반영). 그러나 30행의 서술형 각주는 옛 수치(76/8)를 그대로 두어 표와 본문이 서로 다른 완료 건수를 주장한다. 실제로는 81+20+3=104, 처리 종료=101/104가 맞다. 이 각주 stale 은 사실 이번 diff 이전(C-2 커밋 44f956e9c)부터 있었으나, 본 diff 가 같은 표를 다시 손대면서도 각주를 갱신하지 않아 괴리가 더 벌어졌다.
  - 제안: 30행을 `완료(81) + 철회·종결(20) + 잔여(3) = 104. 처리 종료(완료+철회·종결) = 101/104.` 로 갱신. 사용자 메모리(`plan 체크박스 = 실제 상태`) 원칙과 궤를 같이 하는 사소한 문서 정합성 이슈이며 기능 결함은 아니다.

- **[INFO]** M-3 (join await + 롤백) 구현이 spec 문서(`spec/5-system/6-websocket-protocol.md`)의 `subscribed` ack wire shape 과 정확히 일치
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:264-281` vs `spec/5-system/6-websocket-protocol.md:894,957` (`{ event:'subscribed', data:{ success, channel?, error? } }`, 권한/한도 거부 = 평문 `error` 문자열)
  - 상세: 신규 join 실패 ack `{ event: 'subscribed', data: { success: false, error: 'Subscription failed — please retry' } }` 는 기존 flat shape 을 그대로 따르며 `errorCode` 같은 신규 필드를 추가하지 않아 spec 이 이미 규정한 계약을 위반하지 않는다. plan 문서 자체도 "spec 대조: B — join await 여부 spec 무언급" 으로 정확히 표시하고 있어 spec 결함/드리프트가 아니라 spec 이 다루지 않는 강건성(robustness) 보강임이 문서·코드 양쪽에서 일관된다.
  - 제안: 없음(확인용).

- **[INFO]** `handleUnsubscribe` 의 best-effort 계약(leave 실패해도 success:true) 이 spec 의 `unsubscribed` ack 계약과 상충하지 않음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:337-364` vs `spec/5-system/6-websocket-protocol.md:138` (`ack: { "event": "unsubscribed", "data": { "success": true, "channel": "..." } }`)
  - 상세: spec 은 unsubscribe 성공 ack 의 shape 만 규정하고 leave() 내부 실패 처리 정책은 언급하지 않는다. 구현이 leave 실패를 warn 로그로만 흡수하고 여전히 `success:true` 를 반환하는 것은 "구독 집합에서는 이미 제거됐다"는 클라이언트 관찰 가능한 사실과 정합하며, 신규 회귀 테스트(`websocket.gateway.spec.ts` "should still ack success when leave() rejects")로 정확히 커버된다.
  - 제안: 없음(확인용).

- **[INFO]** frontend `bind()` off-before-on dedup 로직과 그 회귀 테스트(off count 4/2)의 산술이 실제 등록 경로와 정확히 일치
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:1028,1099` ("connect" 는 `onConnect`+`onReconnect` 2개 핸들러로 각각 bind) vs `use-execution-events.test.ts:273-282` (`connectOffCalls.length` 2→4, `resumedOffCalls.length` 1→2)
  - 상세: "connect" 이벤트는 두 개의 서로 다른 핸들러 참조(`onConnect`, `onReconnect`)로 각각 `bind()` 되므로 각 등록마다 dedup-off 1회 + unmount cleanup 시 explicit `client.off("connect", ...)` 1회씩, 총 2 핸들러 × 2 = 4가 정확하다. "execution.resumed" 는 단일 핸들러라 dedup-off 1 + cleanup-off 1 = 2. 테스트 갱신치가 구현과 정확히 부합.
  - 제안: 없음(확인용).

- **[INFO]** dismiss hysteresis(m-5) 의 cleanup 경로가 "재끊김 시 대기중인 dismiss 타이머 취소" 의도와 정확히 일치
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:1178-1197`
  - 상세: `snapshotReceived` 가 true→false 로 바뀌면 effect 가 재실행되며 이전 effect 의 cleanup(`clearTimeout(dismissTimer)`)이 실행돼 예약된 dismiss 가 취소된다 — 주석이 설명하는 "지연 내에 다시 미수신되면 cleanup 이 이 타이머를 취소해 warning 이 유지된다" 와 코드가 정확히 일치. 신규 unit 테스트(fake timer, 500ms 시점 미-dismiss / 1100ms 시점 dismiss)도 이 동작을 정확히 검증한다.
  - 제안: 없음(확인용).

- **[INFO]** RESOLUTION.md 가 지적한 WARNING(handleUnsubscribe leave 실패 회귀 테스트 누락)이 실제로 FIXED 상태로 코드에 반영됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:77-91` (`'should still ack success when leave() rejects (best-effort)'`)
  - 상세: `leave.mockRejectedValueOnce` 로 leave 실패를 강제하고 `result.data.success===true`, `subs.has(...)===false` 를 단언 — RESOLUTION.md 서술과 실제 diff 내용이 line-level 로 일치한다. "FIXED" 라벨과 실제 테스트 존재 여부가 괴리되지 않음.
  - 제안: 없음(확인용).

## 요약

리뷰 대상은 06-concurrency 잔여 배치(M-3 join await+롤백, M-6 이중 리스너 등록 방어, m-3 connect churn 가드, m-5 dismiss hysteresis) 구현·테스트와 이를 기록한 plan/README/RESOLUTION/SUMMARY 문서다. 코드 검증 결과 4개 항목 모두 plan 문서가 서술한 동작(구독 롤백+`success:false` ack, `bind()` off-before-on dedup, `socket.active` pending 가드, 1초 dismiss hysteresis)과 line-level 로 정확히 일치하며, 관련 spec(`spec/5-system/6-websocket-protocol.md`)의 `subscribed`/`unsubscribed` ack wire shape 을 위반하지 않는다(신규 join 실패 ack 도 기존 flat `{success,error}` 계약을 그대로 따름). RESOLUTION.md 가 주장한 WARNING fix(leave-reject best-effort 회귀 테스트)도 실제 diff 에 정확히 반영돼 있다. 엣지 케이스(빈 Set, join/leave reject, StrictMode 이중 mount, snapshot flap)에 대한 테스트 커버리지도 각 변경에 상응해 추가됐다. 유일하게 발견된 사소한 불일치는 `plan/in-progress/refactor/README.md` 의 표 합계(27행, 이번 diff 로 정확히 갱신됨)와 서술형 각주(30행, 미갱신 — 옛 수치 76/8 잔존)가 서로 다른 완료 건수를 주장하는 문서 정합성 이슈로, 기능·spec 결함이 아닌 INFO 성 기록 누락이다.

## 위험도
NONE
