# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
대상 문서: `spec/5-system/15-chat-channel.md`
검토 일시: 2026-05-25

---

## 발견사항

### [INFO] `CCH-AD-07` / `CCH-MP-06` 신설 — WS protocol spec 에 cross-link 없음

- target 위치: `spec/5-system/15-chat-channel.md §3.1 CCH-AD-07`, `§3.3 CCH-MP-06`
- 충돌 대상: `spec/5-system/6-websocket-protocol.md §4.4`
- 상세: CCH-AD-07 는 `execution.node.completed` in-process listener 를 신설한다. WebSocket protocol spec (`6-websocket-protocol.md`) 은 `execution.node.completed` 이벤트를 §4.4 테이블에 정의하고 있지만, chat-channel-internal consumer 로서 이 이벤트를 어댑터가 sub-filter 로 attach 한다는 사실에 대한 cross-link 가 해당 spec 에 없다. EIA spec (`14-external-interaction-api.md §R10`) 에는 2026-05-25 보강이 이미 반영되어 있어 EIA 쪽은 정합. WS spec 는 언급 없음.
- 제안: `spec/5-system/6-websocket-protocol.md §4.4` 의 `execution.node.completed` 행에 "chat-channel 어댑터가 in-process listener 로 구독 (CCH-AD-07)" 주석 한 줄 추가 권장. blocking 아님 — 구현 전 필수 수정 아님.

---

### [INFO] `CCH-MP-06` 에서 `output.rendered` 필드 의존 — `node-output.md` 폐기 검토 대상과 교차

- target 위치: `spec/5-system/15-chat-channel.md §3.3 CCH-MP-06`, `spec/conventions/chat-channel-adapter.md §3 매핑 표 (execution.node.completed 행)`
- 충돌 대상: `spec/conventions/node-output.md §189` ("`output.rendered` (HTML snapshot) → 후속 노드 로직이 참조할 런타임 값이 아니면 `meta.rendered` 로 이동 검토"라는 검토 권고)
- 상세: CCH-MP-06 와 chat-channel-adapter convention `§3` 의 `execution.node.completed` 행은 Template 노드 비-blocking 발화 시 `output.rendered` 텍스트를 그대로 사용한다고 명시한다. `node-output.md §189` 는 `output.rendered` 를 "프런트 렌더링용이면 유지 가능하나 후속 노드 로직 참조 값이 아니면 `meta.rendered` 이동 검토"라고 권고하고 있어 향후 Template 노드 output 재편 시 CCH-MP-06 구현이 `output.rendered` 가 없는 shape 에서 실패할 수 있다. 현재는 명시적 폐기 결정이 없으므로 "모순"보다는 "잠재 drift" 수준.
- 제안: Template 노드 output 에서 `output.rendered` 가 확정 필드로 유지됨을 `spec/4-nodes/6-presentation/2-template.md` 또는 `node-output.md §4.3` 에 명시화해 CCH-MP-06 의 의존 근거를 공식화 권장. 구현 차단 사유 아님.

---

### [INFO] `CCH-MP-04` 의 "v2 `output.rendered` snapshot 폐기 (D5)" 언급 — 현재 v1 구현 범위와 혼용 가능성

- target 위치: `spec/5-system/15-chat-channel.md §3.3 CCH-MP-04` ("v2 정책 — `output.rendered` snapshot 폐기 (D5 / 2026-05-17) 이후 어댑터가 raw 데이터로부터 직접 SSR 책임")
- 충돌 대상: `spec/conventions/chat-channel-adapter.md §3 매핑 표 (execution.node.completed 행)` — v1 에서 `output.rendered` 직접 사용
- 상세: CCH-MP-04 는 v2 에서 `output.rendered` snapshot 이 폐기되고 어댑터가 raw 데이터로부터 SSR 한다고 기술한다. 같은 target spec 의 CCH-MP-06 과 convention 의 `execution.node.completed` 행은 v1 에서 Template 의 `output.rendered` 를 사용한다고 명시한다. 두 기술은 직접 모순이 아니지만 (v1 vs v2 구분이 명확), "D5 폐기" 의 scope 가 blocking presentation (`CCH-MP-04`) 에만 적용되는지 비-blocking (`CCH-MP-06`) 에도 적용되는지 본문이 명시하지 않아 v2 구현자가 오독할 여지가 있다.
- 제안: CCH-MP-04 의 "D5 폐기" 주석에 "(blocking presentation 의 v2 SSR 한정 — 비-blocking `CCH-MP-06` 의 `output.rendered` 사용은 별도 결정 필요)" 한 줄 추가 권장. 구현 차단 사유 아님.

---

### [INFO] `§3.1 CCH-AD-07` 섹션 앵커와 요구사항 ID 위치 불일치

- target 위치: `spec/5-system/15-chat-channel.md §3.1 CCH-AD-07` (원문에서 `### 3.1 어댑터 라이프사이클` 섹션 내 테이블 행으로 존재)
- 충돌 대상: `spec/conventions/chat-channel-adapter.md §3 매핑 표 (execution.node.completed 행)` 의 SoT 링크 — `[Spec Chat Channel §3.1 CCH-AD-07](../5-system/15-chat-channel.md#31-실행-엔진과의-연결)`
- 상세: convention §3 매핑 표에서 CCH-AD-07 의 SoT 링크가 `#31-실행-엔진과의-연결` 앵커를 가리키는데, target spec (`15-chat-channel.md`) 의 해당 섹션 제목은 `### 3.1 어댑터 라이프사이클` 이다. Markdown 앵커 자동 생성 규칙상 `#31-어댑터-라이프사이클` 이 맞고 `#31-실행-엔진과의-연결` 은 존재하지 않는 앵커다. 링크가 404 로 깨져 있어 cross-spec navigation 이 실패한다.
- 제안: `spec/conventions/chat-channel-adapter.md §3` 의 `execution.node.completed` 행 SoT 링크를 `#31-어댑터-라이프사이클` 로 수정하거나, target spec 에 별도 앵커(`<a id="31-실행-엔진과의-연결">`) 를 추가해야 한다. 구현 전 수정 권장 (링크 깨짐은 review 도구 오탐의 원인이 될 수 있음).

---

### [INFO] `Trigger.config` 필드 `hasBotToken` derived 필드 — `spec/1-data-model.md §2.8` 의 cross-link 갱신 여부 확인 필요

- target 위치: `spec/5-system/15-chat-channel.md §5.4.2`
- 충돌 대상: `spec/1-data-model.md §2.8 Trigger` 의 `config` JSONB 설명
- 상세: target spec §5.4.2 는 "`spec/1-data-model.md §2.8` Trigger 의 `config` JSONB 설명 하단에 동일 cross-link 한 줄 추가" 를 명시한다. 실제 `spec/1-data-model.md §2.8` 의 `config` 컬럼 설명을 확인하면 이미 `응답 DTO 전용 derived 필드 hasBotToken: boolean (botTokenRef IS NOT NULL → true) — DB 컬럼 아님, SoT [Spec Chat Channel §5.4.2]` 라는 cross-link 가 포함되어 있어 **정합 완료** 상태다. 충돌 아님 — 확인 INFO.

---

### [INFO] `spec/2-navigation/2-trigger-list.md §3` PATCH 설명의 `inboundSigning` 차단 — 신규 추가 정합 확인

- target 위치: `spec/5-system/15-chat-channel.md §5.4.1.1`
- 충돌 대상: `spec/2-navigation/2-trigger-list.md §3 PATCH 노트`
- 상세: trigger-list spec 의 `PATCH /api/triggers/:id` 설명에는 이미 `config.chatChannel.inboundSigning` / `inboundSigningPlaintext` 의 PATCH 차단 명시가 포함되어 있고 (`(c) §3 PATCH 노트에 config.chatChannel.inboundSigning / inboundSigningPlaintext 차단 명시`) target spec §5.4.1.1 과 내용이 정합한다. 충돌 없음 — 확인 INFO.

---

## 요약

`spec/5-system/15-chat-channel.md` 의 이번 변경 (CCH-AD-07 / CCH-MP-06 신설, CCH-MP-01 보강) 은 데이터 모델(`spec/1-data-model.md §2.8`), EIA spec(`14-external-interaction-api.md §R10`), convention(`conventions/chat-channel-adapter.md`), 텔레그램 provider spec(`4-nodes/7-trigger/providers/telegram.md §5.4`) 과 핵심 사항이 정합한다. 발견된 사항은 모두 INFO 등급으로, WebSocket protocol spec 의 cross-link 누락 1건과 앵커 오류 1건, `output.rendered` 필드 의존성의 향후 drift 가능성 1건이 주요 항목이다. 이 중 앵커 오류(`#31-실행-엔진과의-연결`)는 구현 착수 전 수정이 권장되며, 나머지는 구현을 차단하는 직접 모순 없다.

---

## 위험도

LOW
