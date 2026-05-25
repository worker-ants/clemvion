# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md` (revision 3)
검토 일시: 2026-05-25

---

## 발견사항

### [WARNING] `영향 평가` 섹션의 `renderPresentationNode` 언급 — 본문 결정(6함수 유지)과 불일치

- **target 위치**: draft `## 영향 평가` — "chat-channel 어댑터 구현" 3번째 항목 `새 함수 renderPresentationNode 추가 — Telegram/Slack/Discord adapter 모두 구현 의무`
- **충돌 대상**: draft 자체의 `결정 1` 및 `Spec 갱신안 §A §1.1` — "함수 개수는 6 그대로 유지", `renderNode` 시그니처를 union 입력으로 확장
- **상세**: draft 의 `결정 1` 과 `§Rationale R-CCA-7` 은 "7번째 함수 `renderPresentationNode` 신설 — R-CCA-5 대안 2 가 명시 기각" 을 명시적으로 기각하면서 6함수 유지를 채택한다. 그러나 `## 영향 평가` 하단의 동일 문서 안에 "새 함수 `renderPresentationNode` 추가 — Telegram/Slack/Discord adapter 모두 구현 의무" 가 남아 있다. 이는 round 2 C-6 에서 해소됐다고 표시됐으나 영향 평가 항목이 이전 revision(7함수 방안) 의 텍스트 그대로 잔류한 것이다. spec 갱신안에 포함될 경우 `chat-channel-adapter.md §1.1` 의 6함수 표 정의, `R-CCA-5 대안 2`, 신설 `R-CCA-7` 과 직접 모순된다.
- **제안**: `## 영향 평가` 의 해당 항목을 "`renderNode` 시그니처 확장 (`EiaEvent | ChatChannelInternalEvent` union 입력) — 기존 6함수 인터페이스 유지, Telegram/Slack/Discord adapter 의 `renderNode` 구현 갱신 의무" 로 교체.

---

### [WARNING] `ChatChannelInternalEvent` 구독 소스 표기 — `WebsocketService.executionEvents$` vs `NotificationDispatcher EventEmitter` 계층 혼선

- **target 위치**: draft `§A §1.3 신설 ChatChannelInternalEvent` 주석 — "구독 소스: `WebsocketService.executionEvents$` Subject (R8 catch-up 결정 경로)" / `결정 1` — "chat-channel dispatcher 는 `WebsocketService.executionEvents$` Subject 를 단일 구독 (이미 R8 catch-up 으로 결정된 경로)"
- **충돌 대상**: `spec/5-system/15-chat-channel.md §3.2 / R8` — "Chat Channel 어댑터는 같은 process 안의 **NotificationDispatcher 가 fan-out 하는 EventEmitter** 를 구독한다" / `CCH-AD-05` — "어댑터가 **NotificationDispatcher 의 after-commit EventEmitter 에 in-process listener 로 attach**"; `spec/5-system/14-external-interaction-api.md R10` — "외부 HTTP notification 와 어댑터의 채널 emit 은 같은 after-commit hook 에서 fan-out"
- **상세**: R8 (15-chat-channel.md §542) 은 실제 구현 구조를 다음과 같이 기술한다: Fan-out source = `WebsocketService.executionEvents$` RxJS Subject 이고, `ChatChannelDispatcher` 는 그 Subject 의 downstream listener 이지만 어댑터 계층 (CCH-AD-05 / EIA R10) 에서 공식 기술은 "NotificationDispatcher after-commit EventEmitter" 이다. draft 는 `§1.3` 주석에 `WebsocketService.executionEvents$` 를 구독 소스로 직접 노출하여 `CCH-AD-05` 의 "NotificationDispatcher facade" 원칙과 표현이 충돌한다. EIA R10 한 줄 보강 (draft `§C`) 이 이 관계를 명확히 설명하려 하지만, `§1.3` type 주석 자체가 이미 다른 계층의 구현 세부(RxJS Subject 이름)를 노출한다.
- **제안**: `§1.3` 의 주석에서 `WebsocketService.executionEvents$` 직접 노출을 제거하고 "구독 소스: `ChatChannelDispatcher` 의 in-process 구독 경로 (실행 엔진 §4.4 단일 sink → NotificationDispatcher / WebsocketService 를 통한 fan-out, R8 경로)" 로 추상화 수준을 맞춤. 구현 세부(Subject 이름)는 `15-chat-channel.md R8` 에 이미 기술됨.

---

### [WARNING] `EIA-RL-04` 정합 논거 — `WebsocketService.emitToExecution` 이 TX commit 후 호출되는 보장의 SoT 명확화 필요

- **target 위치**: draft `결정 1` — "EIA-RL-04 (TX commit 후 발송) 보장: `WebsocketService.executionEvents$` Subject 는 `WebsocketService.emitToExecution` 이 단일 sink (실행 엔진 §4.4) 이며 모든 emit 은 TX commit 후 호출됨."
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md R10` — `WebsocketService` 단일 sink 정책에서 `emitToExecution` 이 TX commit 후에만 호출된다는 보장은 `4-execution-engine.md §4.4` 가 아니라 **NotificationDispatcher 의 after-commit hook** 이 보장하는 것. EIA `EIA-RL-04` 는 "TX commit 후 발송" 요구사항이며, 이는 `emitToExecution` 의 호출 위치가 after-commit 인지에 달려 있음.
- **상세**: 실행 엔진 §4.4 는 "단일 sink" 정책만 정의하고 "TX commit 후 호출" 을 명시하지 않는다. `WebsocketService.executionEvents$` Subject 는 구독의 진입 경로이며, TX commit-after 보장은 NotificationDispatcher 의 hook 계층에서 온다. draft 는 두 보장을 혼합하여 기술해 EIA R10 본문의 "after-commit hook 에서 fan-out" 논리와 미묘하게 충돌한다. 채택한 새 listener (`execution.node.completed`) 가 동일 after-commit 보장을 받는지 — 즉 `WebsocketService.emitToExecution` 이 비-blocking presentation 완료 시에도 after-commit 에서 호출되는지 — 를 spec 에서 명확히 해야 한다.
- **제안**: draft `결정 1` 의 EIA-RL-04 정합 설명을 "NotificationDispatcher 의 after-commit hook 과 동일 채널을 통해 fan-out 됨" 으로 보강하고, 비-blocking presentation 완료 시 실행 엔진이 `WebsocketService.emitToExecution` 을 after-commit 시점에 호출하는지 `4-execution-engine.md §4.4` 또는 `15-chat-channel.md R8` 에서 교차 확인 후 근거를 명시할 것.

---

### [INFO] `§C` EIA `§R10` 보강 — 기존 R10 본문과의 문체 정합

- **target 위치**: draft `§C` — "`WebsocketService.executionEvents$` Subject 의 EIA outbound 5종 외 이벤트 (예: `execution.node.completed`) 를 sub-filter 로 추가 구독하는 것은 R10 허용 범위"
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md R10` 본문 — 현재 마지막 문단 "추가 facade 사례 — Chat Channel adapter" 의 기술 방식
- **상세**: R10 본문 기존 Chat Channel 설명은 "NotificationDispatcher 가 after-commit hook 위에 노출하는 in-process EventEmitter 의 listener 로 attach" 를 중심으로 기술한다. draft 의 한 줄 보강은 `WebsocketService.executionEvents$` 를 직접 노출하여 기존 R10 의 추상화 수준과 일치하지 않는다. 기능상 모순은 아니나 독자가 R10 을 읽을 때 일관되지 않은 어휘를 접하게 된다.
- **제안**: R10 보강 문장의 어휘를 기존 R10 본문 수준에 맞춰 "chat-channel 어댑터가 EIA outbound 5종 외 이벤트 (예: `execution.node.completed` presentation 노드 한정) 도 동일 fan-out 경로에서 sub-filter 로 추가 구독하는 것은 R10 허용 범위 — 단일 sink(`WebsocketService.emitToExecution`) 는 변경 없으며, 어댑터는 그 결과를 소비하는 consumer 한정" 으로 조정.

---

### [INFO] `telegram.md §7 변경 관리` 의무 — CCH-MP-06 / CCH-AD-07 cross-ref 추가 대상

- **target 위치**: draft `## 영향 평가` — "`spec/4-nodes/7-trigger/providers/telegram.md §5.4` — 현재 정의된 `CCH-MP-04` v1 fallback 가 그대로 적용. `§7 변경 관리` 의무에 따라 동반 갱신 — CCH-MP-06 / CCH-AD-07 cross-ref 추가."
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/telegram.md` 실제 구조 — 해당 파일에는 `§7 변경 관리` 섹션이 존재하지 않음 (실제 섹션 구조: §3, §4, §5, §6, §7 명령 처리, §8 비기능, Rationale). `chat-channel-adapter.md §7` 의 "변경 관리" 절 의무는 Convention 파일에 존재하며, telegram.md 자체에 독립 변경 관리 절이 없음.
- **상세**: draft 영향 평가가 참조하는 "`telegram.md §7 변경 관리`" 는 실제로는 `telegram.md §7 명령 처리` 섹션이다. 변경 관리 의무는 `chat-channel-adapter.md §7` 에 정의되어 있고 ("두 spec 동시 갱신 의무"), `telegram.md` 가 별도 변경 관리 섹션을 갖지 않는다. 이 표현이 spec 본문에 포함될 경우 독자의 혼란을 야기할 수 있다.
- **제안**: 영향 평가의 해당 항목을 "`spec/4-nodes/7-trigger/providers/telegram.md §5.4` — 현재 정의된 `CCH-MP-04` v1 fallback 가 그대로 적용. [`chat-channel-adapter.md §7` 변경 관리](../conventions/chat-channel-adapter.md#7-변경-관리) 의무에 따라 동반 갱신 필요 (CCH-MP-06 / CCH-AD-07 cross-ref 추가)." 로 수정.

---

### [INFO] `§1.3 ChatChannelInternalEvent` 의 `node.type` 4종 — `5-template.md` 비-blocking 범위와의 교차 확인

- **target 위치**: draft `§A §1.3` — `node.type` 은 `"carousel" | "table" | "chart" | "template"` 4종
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md §2` — 비-blocking(버튼 미설정) 과 blocking(버튼 설정) 를 `buttons` 배열 유무로 구분; `spec/4-nodes/7-trigger/providers/telegram.md §5.4` — `template` 은 `(CCH-MP-04 범위 외 — v2 구현 대상)` 로 별도 표기
- **상세**: telegram.md §5.4 매트릭스에서 `template` 은 기존 `CCH-MP-04` 의 명시적 범위 밖(`CCH-MP-04 범위 외`)으로 표기되어 있다. draft 는 `§A §1.3` 의 `node.type` 에 `template` 을 포함하고 `§3 매핑 표` 신규 row 에서 `output.rendered` 텍스트 발송을 명시적으로 정의한다. 이는 telegram.md §5.4 와의 drift — telegram.md §5.4 의 `template` 행을 동반 갱신하지 않으면 두 spec 이 다른 처리를 기술하게 된다. draft 영향 평가에서는 telegram.md §5.4 갱신 필요성을 언급하지만 구체 내용이 없다.
- **제안**: spec 반영 시 `telegram.md §5.4` 의 `template` 행에서 `(CCH-MP-04 범위 외 — v2 구현 대상)` 부분을 `(비-blocking 완료 시 `CCH-MP-06` 경로 — `output.rendered` plain text `sendMessage`. blocking carousel/buttons 조합은 기존 `CCH-MP-04` 경로 유지)` 형태로 갱신하도록 draft 영향 평가에 명시할 것.

---

## 요약

Round 3 revision 의 주요 구조적 결정들 — `EiaEvent` 5종 유지, `ChatChannelInternalEvent` 별도 신설, `renderNode` union 확장, 6함수 인터페이스 유지, `EiaAiMessageEvent.presentations?` 보강 — 은 기존 `chat-channel-adapter.md`, `15-chat-channel.md`, `14-external-interaction-api.md` 의 핵심 원칙(R3, R-CCA-5, EIA R10, CCH-AD-05)과 충돌하지 않는다. 발견된 WARNING 2건은 모두 draft 내부의 불일치(영향 평가에 기각된 방안의 텍스트 잔류, 계층 추상화 수준 혼선)이며 다른 spec 과의 직접 모순이 아니다. INFO 2건은 telegram.md §5.4 동반 갱신 범위 명확화와 문체 정합에 관한 것으로, 규범적 충돌 없이 정리 가능하다. CRITICAL 사항은 발견되지 않았다.

---

## 위험도

LOW

STATUS: OK
