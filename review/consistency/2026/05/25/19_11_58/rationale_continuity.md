# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`  
검토 대상: `spec/5-system/15-chat-channel.md`  
검토 일시: 2026-05-25

---

## 발견사항

### 1. [INFO] `EiaEvent` union 에 `execution.node.completed` 를 직접 추가하는 대안이 명시 기각됐으나 target 에서 이미 정합 처리됨 (확인 완료)

- **target 위치**: `§3.1 CCH-AD-07`, `§3.3 CCH-MP-06`, `Rationale R-CC-16 (g) / R-CC-16 대안 3 기각`
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md Rationale R-CCA-7 대안 3` — "`EiaEvent` union 자체에 `execution.node.completed` 추가" 기각 (R3 위배 / 의미 경계 붕괴)
- **상세**: target(`15-chat-channel.md`)은 `execution.node.completed` 처리를 `ChatChannelInternalEvent` 별도 타입으로 격리하고 있으며, `EiaEvent` 에 직접 합치지 않는다. 기각된 대안과 충돌 없음. R-CC-16 대안 3 기각 사유도 동일하게 명시되어 있어 연속성 유지.
- **제안**: 현행 기술로 충분. 별도 조치 불필요.

---

### 2. [INFO] `render_form` (AI `render_*` presentations 중) 을 `CCH-MP-01` 처리 대상에서 제외 — 과거 기각 대안 부재 (신규 의식적 미결정)

- **target 위치**: `§3.3 CCH-MP-01` 본문 마지막 문장 + `Rationale R-CC-16 세부 (c)`
- **과거 결정 출처**: 기각된 Rationale 없음 (v1 이전 정책이 없던 신규 항목)
- **상세**: `render_form` (`presentations[*].type === 'form'`) 을 `CCH-MP-01` 처리 대상에서 제외하고 별 plan `chat-channel-form-native-modal` 으로 추적하는 결정은 신규 의식적 미결정(TBD)이며, 기각된 과거 Rationale 과 충돌하지 않는다. 다만 이 결정이 Rationale 에서 명시적으로 검토된 대안 없이 "별 plan 추적" 으로만 표현되어 있다. 향후 `form` 포함 여부를 결정할 때 충돌 기준이 될 설계 원칙이 부재.
- **제안**: R-CC-16 세부 (c) 에 "v1 단계에서 `render_form` 을 포함하지 않는 이유" 한 줄 추가를 권장. 예: `ai_form_render` interactionType 의 `waiting_for_input` 흐름 (CCH-MP-03) 이 이미 form 다단계 처리 SoT 라 ai_message 내 render_form 을 동시 처리하면 두 진입점이 충돌할 위험이 있으며, 별 plan이 두 흐름의 통합 정책을 결정할 때까지 차단이 안전하다는 취지를 명시.

---

### 3. [INFO] `Promise.all` 금지 원칙의 출처 spec 교차 참조 부재

- **target 위치**: `§3.3 CCH-MP-01` — "sequential `await` 추가 발송 (`Promise.all` 금지 — provider rate limit + 표시 순서 보장)"
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md §3 매핑 표 R-CC-16 세부 (d)` — 동일 원칙이 "provider rate limit + 표시 순서 보장 필요" 로 서술
- **상세**: sequential 발송 원칙은 R-CC-16 (d) 에서 일관되게 기술되어 있고 기각된 대안 (`Promise.all`) 도 명시됐다. 그러나 이 원칙이 `CCH-NF-02` (200ms 이내) 와의 관계에서 "시퀀스 전체 합산 latency 는 자연 증가" 를 허용하는 예외임이 CCH-MP-01 본문에는 기재되지 않고 R-CC-16 (d) 에만 있다.
- **제안**: `CCH-MP-01` 본문이나 `CCH-NF-02` 비고에 "presentations[] sequential 발송 시 합산 latency 는 CCH-NF-02 적용 기준 외 (R-CC-16 (d))" 를 한 줄 cross-link 추가하면 구현자가 NF 요구사항과 충돌로 오독하는 것을 방지.

---

### 4. [INFO] `ChatChannelInternalEvent` 를 통한 `execution.node.completed` 수신 — EIA-RL-04 (TX commit 후 발송) 보장의 명시 수준

- **target 위치**: `§3.2 사이드 채널 명시`, `§3.1 CCH-AD-07`, `Rationale R-CC-16 (f)`
- **과거 결정 출처**: `EIA §R10 + spec/5-system/14-external-interaction-api.md §R10 chat-channel-internal 추가 listener 의 R10 허용 범위 (2026-05-25)` — "`WebsocketService.emitToExecution` 이 실행 엔진 §4.4 의 단일 sink 로서 TX commit 후 호출됨. NotificationDispatcher after-commit hook 과 동일 fan-out 채널 — `execution.node.completed` 도 동일 보장"
- **상세**: R-CC-16 (f) 에서 EIA-RL-04 정합을 명시했으나, `execution.node.completed` 가 `NotificationDispatcher after-commit hook` 과 동일 fan-out 채널인지 아니면 별도 경로인지가 `CCH-AD-07` 본문과 `§3.2` 에서 완전히 명확하지 않다. EIA §R10 (2026-05-25 갱신) 이 명확히 기술하고 있어 참조로 보완 가능하나 impl-prep 관점에서 구현자가 독립적으로 파악하기 어려울 수 있다.
- **제안**: `CCH-AD-07` 에 "EIA-RL-04 정합 — `WebsocketService.emit*` 단일 sink 경로이므로 TX commit 후 도착 보장 (EIA §R10 2026-05-25 보강 참조)" cross-link 추가 권장.

---

### 5. [INFO] `template` 노드의 비-blocking 발화에서 `output.rendered` 사용 — snapshot 폐기 결정 (D5)과의 관계

- **target 위치**: `§3.3 CCH-MP-06`, `spec/conventions/chat-channel-adapter.md §3 매핑 표 마지막 행`
- **과거 결정 출처**: `§3.3 CCH-MP-04` 본문 — "v2 정책 (SSR PNG): `output.rendered` snapshot 폐기 (D5 / 2026-05-17) 이후 어댑터가 raw 데이터로부터 직접 SSR 책임"
- **상세**: `CCH-MP-06` 이 `template` 비-blocking 발화 시 `output.rendered` 텍스트를 그대로 사용 ("template: `output.rendered` 텍스트 그대로") 한다고 정의한다. 반면 CCH-MP-04 는 v2 에서 `output.rendered` snapshot 이 폐기됨을 언급하고 있다. 두 기술이 v1/v2 경계로 분리되어 있어 직접 충돌은 아니지만, `CCH-MP-06` 에는 v1 한정 임을 명시하는 문구가 없다.
- **제안**: `CCH-MP-06` 의 `template` 처리 기술에 "v1 — `output.rendered` 텍스트 그대로 (v2 SSR PNG 도입 시 CCH-MP-04 의 D5 snapshot 폐기 정책 동일 적용)" 를 괄호 주석으로 추가하면 v2 전환 시 누락 방지.

---

## 요약

`spec/5-system/15-chat-channel.md` 는 기존 Rationale 에서 명시적으로 기각된 결정을 재도입하거나 합의된 설계 원칙을 직접 위반하는 사항이 없다. R-CC-16 (2026-05-25 신설) 이 기각 대안 4종을 상세히 검토하고 EIA §R10 · R-CCA-5 · R-CCA-7 등 외부 Rationale 과 정합을 명시하고 있어 연속성 측면에서 우수한 품질을 보인다. 발견된 4건은 모두 INFO 수준으로, 구현자가 참조 문서를 별도로 추적해야 하는 부분에서 cross-link 또는 명시 문구를 보강하면 구현 착오 리스크를 낮출 수 있는 사항들이다. CRITICAL 또는 WARNING 등급 발견사항은 없다.

---

## 위험도

LOW
