# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target: `spec/5-system/15-chat-channel.md`
검토 일시: 2026-05-25

---

## 발견사항

### [INFO] §3.2 본문의 구독 소스 기술이 R8 캐치업과 경미하게 불일치
- **target 위치**: `spec/5-system/15-chat-channel.md §3.2 사이드 채널 명시` (line 184)
- **과거 결정 출처**: 같은 파일 `Rationale R8 (2026-05-24)` — Fan-out source 가 `WebsocketService.executionEvents$` RxJS Subject 임을 실제 코드 기준으로 재정의. ChatChannelDispatcher 는 NotificationDispatcher 와 별개 모듈로 이미 분리되어 있음을 명시.
- **상세**: §3.2 는 "NotificationDispatcher 가 노출하는 in-process EventEmitter 의 listener 로 attach" 라고 기술하지만, R8 (2026-05-24 catch-up) 은 실제 fan-out source 가 `WebsocketService.executionEvents$` RxJS Subject 이며 ChatChannelDispatcher 가 별도 모듈로 구독한다고 명확히 재정의했다. 두 기술이 공존하면 구현자가 "NotificationDispatcher 에 listener 를 연결해야 하는가 vs. WebsocketService Subject 에 구독해야 하는가"를 혼동할 수 있다. 의도적 번복은 아니고 본문 보완 누락으로 판단된다.
- **제안**: §3.2 를 R8 과 정합하도록 보완 — "어댑터의 outbound subscription 은 `WebsocketService.executionEvents$` RxJS Subject (= 실행 엔진 §4.4 단일 sink) 를 `ChatChannelDispatcher` 모듈이 직접 구독하는 형태. NotificationDispatcher 와 SseAdapter 는 동일 Subject 의 다른 subscriber 로 병존." 현행 "NotificationDispatcher 가 노출하는 in-process EventEmitter" 문구는 spec 작성 원본(2026-05-21) 기준의 설계를 서술하며, R8 이 이를 실제 코드 기준으로 수정했으나 §3.2 에는 반영이 누락된 상태.

---

### [INFO] CCH-MP-06 의 `template output.rendered` 텍스트 그대로 사용이 `output.rendered` snapshot 폐기 결정(D5)과의 관계를 명시하지 않음
- **target 위치**: `spec/5-system/15-chat-channel.md §3.3 CCH-MP-06` (line 82)
- **과거 결정 출처**: 같은 파일 `CCH-MP-04` 및 R-CC-11 — "v2 정책 (SSR PNG) 에서 `output.rendered` snapshot 폐기 (D5 / 2026-05-17) 이후 어댑터가 raw 데이터로부터 직접 SSR 책임" 이 명시됨.
- **상세**: CCH-MP-06 은 "`template` 은 `output.rendered` 텍스트 그대로" 라고 명시한다. CCH-MP-04 는 v2 에서 `output.rendered` snapshot 폐기(D5)를 전제로 어댑터가 raw 데이터 직접 SSR을 담당한다고 기술한다. template 노드는 carousel/chart/table 과 달리 v2 SSR 대상에 포함되지 않는지, 혹은 포함될 경우 `output.rendered` 폐기 이후의 template rendering 경로가 어떻게 바뀌는지 명시가 없다. 현재는 gap 수준이고 R-CC-16 (d) 의 "시각형(carousel/table/chart) 에는 SSR v2 적용, template 은 별 처리" 맥락으로 짐작되나 spec 에서 명확한 기술이 없다.
- **제안**: CCH-MP-06 의 `template` 행에 "v2 SSR PNG 대상 외 (template 은 텍스트 렌더 유지, `output.rendered` 폐기 영향 없음)" 한 줄 또는 cross-ref 추가하면 D5 결정과의 관계가 명확해진다.

---

## 요약

`spec/5-system/15-chat-channel.md` 의 이번 변경 (CCH-AD-07, CCH-MP-01 보강, CCH-MP-06, R-CC-16) 은 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 항목을 포함하지 않는다. 신규 요구사항 (비-blocking presentation 발화, AI render_* presentations[] 처리) 에 대한 Rationale (R-CC-16) 이 함께 작성되어 있고, 기각된 대안 3종 (EIA §6.1 화이트리스트 확장, 7번째 함수 신설, ai_message 와 분리된 별도 이벤트 발사) 도 명시 기각 사유와 함께 기록되어 있다. EIA R10 단일 sink 원칙, R4 in-process EventEmitter 채택, R-CC-10 single-path 정책, R-CC-11 visualNode enum, R-CC-12 202 고정 정책 모두 위반이 없다. 다만 §3.2 본문의 구독 소스 기술이 R8 (2026-05-24 catch-up) 에서 재정의한 실제 코드 구조와 경미하게 불일치하며, CCH-MP-06 의 template 처리가 D5 `output.rendered` 폐기 결정과의 관계를 명시하지 않은 점이 INFO 수준 보완 사항으로 식별된다.

## 위험도

LOW
