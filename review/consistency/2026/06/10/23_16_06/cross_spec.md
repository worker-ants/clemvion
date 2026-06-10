# Cross-Spec 일관성 검토 결과

**target**: `plan/in-progress/spec-update-ws-resumed-ack.md`
**검토 대상 spec 변경**: `spec/5-system/6-websocket-protocol.md` §4.2, `spec/5-system/4-execution-engine.md` §7.5

---

## 발견사항

### 1. **[CRITICAL]** WS §4.2 표 line 241 — `resumed` 정의가 여전히 "재개 성공 여부" (변경 대상 확인)

- **target 위치**: plan §1 "WS §4.2 — `resumed` 정의 정정" (변경 제안)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` line 241 — `| resumed | boolean | 재개 성공 여부 |`
- **상세**: target plan 이 "재개 성공 여부 → 재개 시작 수락(enqueue) 여부"로 정정하겠다고 선언한 항목이 **현재 spec 에 여전히 "재개 성공 여부"로 남아 있다**. 이것은 target 이 해결하려는 바로 그 모순 ①이다. plan 이 적용되기 전까지는 spec 의 정의와 코드의 실제 동작(always-enqueue, `resumed` 는 항상 `true`)이 충돌하는 상태다. 다른 영역 소비자(`data-flow/3-execution.md` line 171, `spec/5-system/15-chat-channel.md`, `spec/5-system/14-external-interaction-api.md`)가 `waiting_for_input → resumed` 전이와 후행 이벤트를 올바르게 기술하고 있어 실질 모순은 WS §4.2 표 한 줄에 국한되나, 이 정의가 다른 문서가 참조하는 anchor 이므로 정정이 전파돼야 한다.
- **제안**: target plan 대로 WS §4.2 line 241 을 "재개 시작 수락(enqueue) 여부 — 정상 enqueue 시 항상 `true`, 실패는 `queued: false`"로 정정한다. `data-flow/3-execution.md` line 171 은 이미 "후행 `EXECUTION_CANCELLED` 이벤트로 surface"를 올바르게 기술하고 있어 별도 수정 불필요.

---

### 2. **[CRITICAL]** 엔진 §7.5 line 967 — `RESUME_*` 를 ack 의 `resumed: false` 로 기술 (변경 대상 확인)

- **target 위치**: plan §2 "엔진 §7.5(line 967) — §7.5.1 과 일치" (변경 제안)
- **충돌 대상**: `spec/5-system/4-execution-engine.md` line 967 — "이 셋 모두 … ack 에 `resumed: false` + `error` 객체로 노출된다"
- **상세**: 같은 파일 §7.5.1 (line 995) 은 "RESUME_* 는 후행 `EXECUTION_CANCELLED` 이벤트" 라고 직교 정의한다. line 967 의 "ack 에 `resumed: false`" 기술은 §7.5.1 과 **동일 파일 내 직접 모순**이다. target plan 이 이를 해소하겠다고 선언한 내용이며, plan 적용 전까지 이 모순은 미해소 상태다. WS §4.2 line 298~302 는 `RESUME_*` 코드를 에러 코드 표에 나열하면서 "Execution 은 `cancelled` 로 종결"만 기술하고 "ack `resumed: false` 동기 응답"을 명시하지 않아 §7.5.1 과 정합하므로, WS 쪽 설명은 현재도 올바르다.
- **제안**: target plan 대로 엔진 §7.5 line 967 의 "ack 에 `resumed: false` + error 객체로 노출" 을 "worker 측 비동기 실패 — 후행 `EXECUTION_CANCELLED` 이벤트(`error.code = RESUME_*`)로 통지, 동기 ack 아님" 으로 정정한다.

---

### 3. **[INFO]** WS §4.2 line 339 — `retry_last_turn` 실패 ack 에 `resumed: false` 포함 기술 (변경 범위 외)

- **target 위치**: plan §1 "retry_last_turn(별 명령)의 `resumed: false` 분기는 본 정정 대상 아님" 주석
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` line 339 — `{ success: false, ..., resumed: false, error: { code, message } }` (retry_last_turn 실패 ack)
- **상세**: target plan 은 4종 continuation 명령 ack 만 변경 범위로 한정하고, `retry_last_turn` 의 `resumed: false` 는 "publisher 측 동기 검증 실패"이므로 본 정정 대상이 아님을 명시했다. WS §4.2 의 retry_last_turn 실패 ack(`{ resumed: false }`)는 line 339 에 기술돼 있으며 이는 gateway line 708/732/770/814 의 동기 검증 실패 경로와 일치한다. 이 경로는 plan 변경과 충돌하지 않는다.
- **제안**: 정정 완료 후 WS §4.2 에 "`retry_last_turn` 의 `resumed: false` 는 publisher 사전 검증 실패이므로 4종 continuation ack 의 always-enqueue 원칙과 별개" 임을 명시적으로 주석 추가하면 독자 혼동을 방지할 수 있다 (권고 수준).

---

### 4. **[INFO]** `spec/5-system/14-external-interaction-api.md` line 441 — "waiting_for_input → resumed 전이" 표현

- **target 위치**: plan §1 변경안 (enqueue 수락 신호로 정의 변경)
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` line 441 — "`waiting_for_input → resumed` 전이를 일으켜 상태가 바뀐 뒤"
- **상세**: 이 표현의 `resumed` 는 WS ack 필드가 아니라 엔진 내부 **NodeExecution status enum**(`status: 'resumed'` — 엔진 §5.4 표, line 88)을 가리킨다. target plan 의 변경 범위는 ack payload 필드 `resumed: boolean` 의 **설명 텍스트**이지 status enum 값이 아니므로 충돌은 없다. 다만 두 `resumed` (ack 필드 vs status enum) 가 동일 단어를 다른 의미로 쓰는 명명 중의성이 존재한다.
- **제안**: 엔진 status enum 의 `resumed` 와 WS ack 필드 `resumed` 를 구분하는 인라인 주석을 WS §4.2 에 추가하면 장기적 혼동을 방지할 수 있다 (권고 수준, 동기화 필요).

---

### 5. **[INFO]** `spec/data-flow/3-execution.md` line 171 — 이미 올바른 기술

- **target 위치**: plan §2 변경 후 cross-link 대상
- **충돌 대상**: `spec/data-flow/3-execution.md` line 171 — "rehydration 슬로우 패스의 실패(`RESUME_*`)는 후행 `EXECUTION_CANCELLED` 이벤트로 surface"
- **상세**: 이 문서는 target plan 이 목표로 하는 "후행 `EXECUTION_CANCELLED` 이벤트" 기술을 **이미** 올바르게 유지하고 있다. 엔진 §7.5 line 967 과의 불일치는 이 data-flow 문서가 §7.5.1 를 따르고 있기 때문이다. target plan 이 §7.5 line 967 을 정정하면 세 문서 모두 일치하게 된다.
- **제안**: 별도 수정 불필요.

---

## 요약

target plan 이 수정하겠다고 선언한 두 모순(WS §4.2 `resumed` 정의 / 엔진 §7.5 `RESUME_*` 노출 방식)은 현재 **spec 에 미반영 상태로 실존하는 충돌**이다. 두 항목은 각각 CRITICAL 등급이며, plan 을 그대로 적용하면 다른 영역과의 충돌이 없다. `data-flow/3-execution.md`, `6-websocket-protocol.md` §4.2 에러 코드 표, `5-system/15-chat-channel.md`, `5-system/14-external-interaction-api.md` 는 현재도 §7.5.1 의 "후행 이벤트" 해석을 따르고 있어 target 변경과 정합한다. 주의할 것은 `retry_last_turn` 의 `resumed: false` 는 plan 변경 범위 외이며 별개 경로(publisher 동기 검증 실패)임을 WS §4.2 내에서 명시적으로 구분해 두는 것이 독자 혼동 방지에 도움이 된다(INFO 수준).

## 위험도

MEDIUM
(현재 spec 내부에 CRITICAL 모순 2건이 존재하나, target plan 이 이를 정정하는 방향이고 코드·다른 영역 spec 과는 정합하므로 plan 적용 자체는 다른 영역을 깨지 않는다. plan 미적용 상태의 위험도가 MEDIUM.)
