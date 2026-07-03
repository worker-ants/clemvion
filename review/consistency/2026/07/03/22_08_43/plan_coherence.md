# Plan 정합성 검토 — spec/5-system/6-websocket-protocol.md (impl-done)

## 검토 대상

- target: `spec/5-system/6-websocket-protocol.md` (spec 본문 변경 없음 — 코드만 변경된 impl-done 배치)
- diff 범위: `websocket.gateway.ts`(+spec.ts), `ws-client.ts`(+test), `use-execution-events.ts`(+test) — join await+롤백(M-3), leave best-effort(M-3), bind off-before-on 이중등록 방어(M-6), connect active pending 가드(m-3), dismiss hysteresis(m-5)
- 대조 plan: `plan/in-progress/refactor/06-concurrency.md`, `plan/in-progress/refactor/README.md`, `plan/in-progress/spec-sync-websocket-protocol-gaps.md`

## 발견사항

- **[INFO]** M-3 이 예정한 "adapter 부재 갭 메모" 후속이 spec-sync-websocket-protocol-gaps.md 에 미반영
  - target 위치: `spec/5-system/6-websocket-protocol.md` (diff 자체엔 없음 — 코드만 변경)
  - 관련 plan: `plan/in-progress/refactor/06-concurrency.md` M-3 "개선 방안" 3번 — "(별건 기록) 멀티 인스턴스 WS 전파에 adapter 자체가 부재한 갭을 `spec-sync-websocket-protocol-gaps.md` 에 메모"
  - 상세: M-3 항목의 "구현 완료" 노트(2026-07-03, 커밋 `13dfe96ba`)는 `join`/`leave` await+롤백 구현과 테스트만 언급하고, 자신이 개선 방안에 명시했던 "adapter 부재 갭 메모" 항목은 완료 서술에 나타나지 않는다. 실제로 `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 는 이번 diff 에서 전혀 수정되지 않았다 (git diff origin/main 확인). 다만 target spec §Rationale(l.967)에 "분산 다중 인스턴스 fan-out 미해결"이라는 인접 갭 서술이 이미 존재해 완전히 미문서화 상태는 아니다 — Redis adapter 도입 시 join 이 비동기화된다는 구체적 트리거 조건만 빠져 있다.
  - 제안: 후속 작업으로 `spec-sync-websocket-protocol-gaps.md` 에 "Redis adapter 도입 시 `client.join()` 비동기화 — 현재 코드는 이미 await+롤백 대응 완료(M-3), adapter 부재 상태에서만 무영향"을 1줄 메모하거나, `06-concurrency.md` M-3 완료 노트에서 해당 후속을 "불필요(spec §Rationale l.967 로 충분)"로 명시 정리. 둘 중 하나만 해도 plan 이 스스로 예정한 항목의 추적이 닫힌다. 차단 사유 아님 — 다음 세션에서 처리 가능.

## 정합성 확인 (문제 없음, 참고용)

- `plan/in-progress/refactor/06-concurrency.md` 의 M-3/M-6/m-3/m-5 4개 항목이 이번 커밋(`13dfe96ba`)으로 diff 와 **완전히 정합**하게 `[x]` 전환되어 있고, 완료 서술의 구현 내역(join await+롤백, leave best-effort, bind off-before-on, connect active 가드, dismiss hysteresis)이 실제 코드 diff 와 1:1 대응한다. `plan/in-progress/refactor/README.md` 의 06-concurrency 집계(완료 5→10, 잔여 7→2)도 같은 커밋에서 동행 갱신됐다 — plan 체크박스가 실제 상태를 반영하는 정상 사례.
- C-2("DB 원자 claim")는 별도 브랜치(`refactor-06-c2-atomic-claim`)에서 이미 완료·머지된 선행 plan이며, 이번 배치(M-3/M-6/m-3/m-5)와 코드 영역이 겹치지 않는다(C-2 는 재개 진입 claim, 본 배치는 WS join/leave/connect/listener) — 선행 조건 미해소 없음.
- C-3(`ExecutionContextService` in-memory, exec-intake PR3 연동)·M-4(`executeAsync` fire-and-forget)는 06-concurrency.md 에 미착수로 명시 남아 있으나, 둘 다 execution-engine 동시성 이슈로 이번 target(WS join/leave/connect 이벤트 계약)과 코드·spec 영역이 무관하다 — target 이 이들의 미해결 상태와 충돌하는 결정을 내리지 않는다.
- M-3 의 join 실패 ack(`{ success: false, error: 'Subscription failed — please retry' }`)는 target spec §3.3 이 이미 정의한 `{ event: 'subscribed', data: { success, error } }` shape 을 그대로 재사용 — 신규 계약 아님. plan 자체가 "spec 갱신 불요"로 판정한 것과 일치하며, spec 확인 결과도 동일 결론이다.
- M-1(`resumed` ack 의미 정정)·C-1(cancel fail-fast)·M-7(nextSeq fail-fast) 등 인접 완료 항목과도 코드·계약 충돌 없음 — 이번 diff 가 건드리는 `subscribe`/`unsubscribe`/`connect`/이벤트 리스너 경로는 이들의 완료 범위(`resumed` ack 의미, publish 실패 표면)와 겹치지 않는다.

## 요약

target(`spec/5-system/6-websocket-protocol.md`, impl-done)의 코드 변경은 `plan/in-progress/refactor/06-concurrency.md` M-3/M-6/m-3/m-5 4개 항목을 정확히 구현한 것이며, 해당 plan 문서와 마스터 인덱스(README.md)가 동일 커밋으로 함께 갱신되어 체크박스·집계가 실제 상태와 정합한다. 미해결 결정(C-3/M-4)이나 선행 plan(C-2 등)과의 충돌·미해소 사전조건은 없다. 유일한 흠은 M-3 가 스스로 예정했던 "adapter 부재 갭 메모" 후속(spec-sync-websocket-protocol-gaps.md)이 이번 배치에 반영되지 않은 점인데, target spec 에 인접 서술이 이미 있어 실질 공백은 작다 — INFO 수준 추적 메모로 충분.

## 위험도

LOW
