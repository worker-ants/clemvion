# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
Target: `spec/5-system/4-execution-engine.md`
구현 범위: Carousel(blocking) `waiting_for_input` UI stuck 회귀 fix
- 백엔드: `executions.service.ts findById` read-only snapshot normalization
- 프론트: `apply-execution-snapshot.ts` waiting-node 판정 보강

---

## 발견사항

- **[INFO]** `findById` 스냅샷 정규화 동작이 spec 에 미문서화
  - target 위치: `spec/5-system/4-execution-engine.md` §7.4 / §4 (findById 언급 있으나 정규화 계약 없음)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md:168` — `execution.snapshot` 이벤트의 payload 가 `ExecutionsService.findById` 반환값을 그대로 사용함을 명시
  - 상세: `6-websocket-protocol.md §3.1` 이 "스냅샷 payload 는 `ExecutionsService.findById` 반환 객체" 라고 선언하고 있다. 구현 fix 는 `findById` 에서 `NodeExecution.status ∈ {running, pending}` + `outputData.status === 'waiting_for_input'` 일 때 응답 status 를 `waiting_for_input` 으로 surface 하는 read-only 정규화를 추가한다. 이 정규화는 WS `execution.snapshot`, REST `GET /executions/:id`, EIA `GET /api/external/executions/:id` 세 소비처 모두에 자동 전파된다. WS spec 은 "findById 반환값을 사용한다" 까지만 명시하고 "응답 status 는 DB 컬럼과 항상 동일해야 한다" 는 invariant 를 적시하지 않으므로 모순이 아니지만, 정규화 계약이 어디에도 정의돼 있지 않아 향후 소비자 코드가 "findById status = DB status" 를 전제하고 작성될 위험이 있다.
  - 제안: `spec/5-system/4-execution-engine.md` §7.4 또는 새 §4.y 에 "findById read-only 정규화 — 비-terminal NodeExecution 의 `outputData.status === 'waiting_for_input'` 이면 응답 status 를 `waiting_for_input` 으로 surface, DB write 없음" 을 명시. WS spec §3.1 에 "스냅샷 status 는 findById 정규화 포함" 주석 추가.

- **[INFO]** `apply-execution-snapshot.ts` 의 `outputData.status` 신호 사용이 `data-hydration-surfaces.md` 매트릭스에 미반영
  - target 위치: `spec/5-system/4-execution-engine.md` §1.1 (Presentation 노드 waiting_for_input 전이) — 프론트 구현 변경
  - 충돌 대상: `spec/conventions/data-hydration-surfaces.md §1.2` Presentation 노드 hydration 매트릭스
  - 상세: `data-hydration-surfaces.md §1.2` 는 Presentation 노드 hydration field 를 `output.items / output.rows / output.data / output.rendered / output.interaction` 으로 열거하고, waiting reconcile surface 는 `§2.2` 에서 `applyExecutionSnapshot` 의 waiting 분기를 가리킨다. 신규 fix 는 `applyExecutionSnapshot` 의 waiting-node 판정 조건에 `ne.outputData.status === 'waiting_for_input'` (비-terminal ne.status) 를 보조 신호로 추가하는데, 이 신호 소비 경로가 매트릭스에 row 로 존재하지 않는다. 매트릭스 §3 "신규 field 추가 절차" 는 hydration-coverage 단위 테스트가 매트릭스와 코드를 비교한다고 명시 — 만약 테스트가 `outputData.status` 신호를 grep 대상으로 등록하지 않으면 drift 가 생긴다.
  - 제안: `spec/conventions/data-hydration-surfaces.md §1.2` 에 `output.status = 'waiting_for_input'` (비-terminal NodeExecution 의 blocking 인-progress 신호) 행을 추가하고, `applyExecutionSnapshot` waiting 분기의 보조 판정임을 명시.

- **[INFO]** `chat-channel-adapter.md` 의 blocking 케이스 pre-filter 가 `outputData.status === 'waiting_for_input'` 를 사용 — fix 와 일관성 있음
  - target 위치: (구현 연관 — fix 가 신규 surface 를 열지 않음)
  - 충돌 대상: `spec/conventions/chat-channel-adapter.md:160,544` / `spec/5-system/15-chat-channel.md:59,660`
  - 상세: chat-channel-adapter spec 이 "blocking 진입 케이스를 `nodeExec.outputData.status === 'waiting_for_input'` 로 사전 제외한다" 고 명시하고 있다. 이 필터는 `WebsocketService.executionEvents$` 의 `execution.node.completed` in-process 이벤트 경로에서 작동하며, `findById` 응답 경로와 독립적이다. fix 가 `findById` 의 NodeExecution status surface 를 바꿔도 이 in-process 필터는 영향받지 않는다 — **충돌 없음**. 오히려 동일한 `outputData.status` 신호를 `findById` 경로에도 확장 적용하는 fix 는 spec 의 일관된 신호 사용 방식을 따른 것이다.

---

## 요약

`spec/5-system/4-execution-engine.md` 를 scope 로 하는 Carousel stuck 회귀 fix 는 다른 spec 영역과 직접 모순되는 항목이 없다. 유일한 WARNING/CRITICAL 수준 충돌은 발견되지 않았다. 다만 두 가지 INFO 사항이 있다: (1) 백엔드 `findById` read-only 상태 정규화 계약이 `4-execution-engine.md` 에 명시돼 있지 않아 `6-websocket-protocol.md` 가 "findById 반환값 = 스냅샷" 이라고 선언하는 경로와의 의미 계약이 불완전하고, (2) 프론트엔드의 `outputData.status` 보조 신호 사용이 `data-hydration-surfaces.md` 매트릭스에 반영돼 있지 않다. 두 항목 모두 구현 진행을 차단하지 않지만, 구현 완료 후 spec 동기화(impl-done 단계)에서 함께 처리하는 것을 권장한다. chat-channel-adapter 가 동일 `outputData.status` 신호를 사용하는 방식은 fix 와 일관성이 있으며 충돌이 없다.

---

## 위험도

LOW

---

STATUS: SUCCESS
