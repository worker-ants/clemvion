# Rationale 연속성 검토 결과

검토 모드: `--impl-done`, scope=`spec/7-channel-web-chat`, diff-base=`origin/main`

---

## 발견사항

### 1. [INFO] `1-widget-app §R6` — lazy→eager 번복은 Rationale 에 완전히 문서화됨, 구현도 정합
- target 위치: `codebase/channel-web-chat/src/widget/use-widget.ts`, `widget-state.ts`, `eia-client.ts`
- 과거 결정 출처: `spec/7-channel-web-chat/1-widget-app.md §R6` (lazy 기각, eager 채택)
- 상세: `§R6` 은 이전 lazy 모델("첫 사용자 텍스트 입력 시 시작 + `firstMessage` 동봉")을 명시적으로 기각하고, eager 전환 이유(캐러셀/버튼/폼 첫 노드 표시 불가, `firstMessage` AI Agent `multi_turn` 에서 유실)와 재평가 근거(open 당 비용 = LLM 토큰 0)를 작성하였다. 구현 diff 는 `start()` 시그니처에서 `firstMessage` 제거, `START` action 에서 `userText` 제거, `open()` 이 `start()` 를 직접 호출하는 구조를 도입함으로써 `§R6` 을 정확히 구현하고 있다. Rationale 번복 문서화 요건 충족.

### 2. [INFO] `3-auth-session §3` 시퀀스 — `firstMessage` 미동봉 기술 방식 정합
- target 위치: `spec/7-channel-web-chat/3-auth-session.md §3` step 1
- 과거 결정 출처: `spec/7-channel-web-chat/1-widget-app.md §R6`
- 상세: `3-auth-session §3` 의 시퀀스 step 1 에 `firstMessage 미동봉 — [1-widget-app §R6]` 이 명시적으로 교차 참조됨. spec 레벨 번복이 두 문서에 일관되게 반영됨.

### 3. [INFO] `use-widget.ts` — `start` 를 공개 actions 에 노출 유지 (I3 주석)
- target 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` line `return { actions: { open, close, start, ... } }`
- 과거 결정 출처: 직접 관련 Rationale 없음. 단, `2-sdk §5 ChatInstance` 계약에 `start()` 는 포함되지 않음.
- 상세: diff 에서 `I3: start 는 open() 이 자동 호출 — 외부 직접 호출 불필요. 하위 호환 목적으로 노출 유지.` 주석과 함께 `start` 를 `actions` 에 계속 포함시켰다. `2-sdk §5 ChatInstance` 타입 계약(공개 인터페이스 SoT)에 `start()` 메서드가 없으므로, 이 노출이 하위 호환 목적인지 내부 인터페이스인지를 명확히 하는 Rationale 이 spec 레벨에 없다. 실제 공개 계약(`ChatInstance`)에는 포함되지 않는 내부 메서드이므로 즉각적 충돌은 없지만, spec 과의 경계가 모호하다.
- 제안: `use-widget.ts` 의 반환 타입이 `ChatInstance` 를 직접 구현하지 않는 구조라면 현 상태로 무방. 만약 외부에서 `actions.start` 를 직접 쓰는 경로가 없다면 제거가 더 명확하나, 지금은 INFO 수준.

### 4. [INFO] C1 flush effect — buttons/form 표면에서 큐 폐기 동작의 spec 근거 부재
- target 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` C1 flush effect (pending?.type !== "buttons" && !== "form" → 큐 폐기)
- 과거 결정 출처: `spec/7-channel-web-chat/1-widget-app.md §3` (상태기계 본문) — "첫 표면 = buttons/form 이면 텍스트 입력창 비활성"은 spec 에 있음.
- 상세: 첫 `waiting_for_input` 이 `buttons` 또는 `form` 이면 큐에 쌓인 텍스트를 폐기하는 동작은 panel.tsx Composer `disabled` 로직과 일치한다. 그러나 "launcher 버블 텍스트가 buttons/form 첫 노드에서 조용히 폐기된다"는 결정이 spec Rationale 에 명시되지 않았다. 기각 대안(예: 큐를 유지해 사용자에게 되돌려 주거나, 추천질문 버블을 사용 불가로 표시하는 대안)이 검토됐는지 불명확하다.
- 제안: `1-widget-app §R6` 또는 별도 INFO 항목으로 "buttons/form 첫 노드 시 launcher 버블 탭 텍스트 폐기" 동작과 근거를 한 줄 추가. 구현 자체는 spec 방향과 충돌하지 않음.

### 5. [INFO] `panel.tsx` Composer `disabled` — `phase=awaiting_user_message + pending=null` 시 enabled 처리
- target 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` Composer disabled 조건
- 과거 결정 출처: `spec/7-channel-web-chat/1-widget-app.md §3` 상태기계
- 상세: `phase=awaiting_user_message + pending=null` 인 경우 Composer 가 enabled 되도록 구현됨 (panel.test.tsx 케이스: "ai_conversation 이전 상태"). spec §3 은 `awaiting_user_message` 진입 후 `waiting_for_input` 타입별 첫 표면을 렌더한다고 기술하며, `pending=null` 인 순간이 실제로 발생하는지(race window)를 명시하지 않는다. test 가 이 케이스를 명시적으로 커버하므로 구현 의도는 명확하나, spec 상태기계 다이어그램이 이 transient 상태를 포함하지 않는다.
- 제안: spec §3 또는 주석에 `pending=null + awaiting_user_message` 가 일시적으로 가능한 race window 임을 한 줄 명시. 현재는 INFO 수준.

---

## 요약

`spec/7-channel-web-chat` 의 핵심 변경인 **lazy→eager 워크플로우 시작 전환(§R6)** 은 `1-widget-app §R6` 에 기각 결정(lazy 모델)·채택 이유·재평가 근거를 모두 갖춰 Rationale 연속성 요건을 완전히 충족한다. `firstMessage` 폐기, `START` action 변경, `open()` 이 `start()` 를 직접 호출하는 구조, `3-auth-session §3` 교차 참조까지 spec-impl-Rationale 세 층이 정합하다. 추가 발견사항은 `start()` 의 공개 actions 노출 경계 모호성, C1 flush 의 buttons/form 폐기 동작에 대한 Rationale 부재, `pending=null + awaiting_user_message` transient 상태의 spec 미명시로, 모두 구현 방향 자체가 합의 원칙과 충돌하지 않는 INFO 수준이다. CRITICAL·WARNING 에 해당하는 기각 대안 재도입, 합의 invariant 직접 위반, 무근거 번복은 발견되지 않았다.

---

## 위험도

LOW
