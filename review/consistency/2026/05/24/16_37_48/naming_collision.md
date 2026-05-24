# 신규 식별자 충돌 검토 — form-resubmit-fix

검토 대상: `plan/in-progress/form-resubmit-fix.md`
검토 모드: plan draft (--plan)
검토 일시: 2026-05-24

---

## 발견사항

### [WARNING] `rendered: false` — 기존 `{ok:true, rendered:true}` 패턴과 의미 혼동 가능

- target 신규 식별자: plan §변경 범위 코드 1번이 제안하는 tool_result content shape 안의 `rendered: false`
- 기존 사용처:
  - `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts:731-732` — display-only 경로의 tool_result에 `{ ok: true, rendered: true, ... }` 가 이미 사용됨
  - `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:197` — `PRESENTATION_TOOLS_GUIDANCE` 가이드라인에 `{ok: true, rendered: true, ...}` 가 "카드 정상 표시" 신호로 명문화되어 LLM 에게 노출됨
  - `spec/4-nodes/6-presentation/0-common.md:322` — display-only tool_result 스텁 `{ok:true}` 로 명시
- 상세: display-only 경로는 `{ok:true, rendered:true}` (또는 minimal `{ok:true}`) 를 "표시 성공" 신호로 쓴다. plan 이 제안하는 `rendered: false` 는 "form이 display 되었으나 interactive 제출 흐름이므로 다시 render 하지 말라"는 의미인데, `rendered` 필드의 true/false 값이 display-only(`true`) 와 form-submitted(`false`) 라는 **서로 다른 도구 종류의 상태를 같은 키로 구분**하게 된다. LLM 이 `rendered:true` = "표시됨", `rendered:false` = "표시 안 됨" 으로 오독할 여지가 있다. 실제로 form 은 표시되었지만 `rendered:false` 를 받으므로 혼선이 발생한다.
- 제안: `rendered: false` 대신 `submitted: true` 또는 `rendered` 필드를 생략하고 `status: 'form_submitted'` 필드만으로 의도를 명확화. 기존 `PRESENTATION_TOOLS_GUIDANCE` 의 "호출 결과 해석" 가이드라인에도 `form_submitted` 케이스 설명 추가 시 `rendered` 키를 언급하지 않는 것이 일관성 유지에 유리.

---

### [INFO] `status: 'form_submitted'` 신규 top-level 필드 — `type` 필드와 중복 노출

- target 신규 식별자: plan §변경 범위 코드 1번이 제안하는 `status: 'form_submitted'`
- 기존 사용처:
  - `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:1647` — 현재 tool_result content는 `{ type: 'form_submitted', data: formData }` 로 `type` 키를 사용
  - `spec/4-nodes/6-presentation/0-common.md:383` (§10.9 4-layer SSOT (4) layer) — `{type: 'form_submitted', data: { …formData }}` 로 SoT 정의됨
  - `spec/4-nodes/3-ai/1-ai-agent.md:242` (render_form 도구 표의 tool_result 칸) — `{type: 'form_submitted', data: { … }}` 로 명시
- 상세: `type: 'form_submitted'` 는 4-layer SSOT 의 (4)번 layer 로 spec 에 이미 정규화된 식별자다. plan 은 이 위에 `status: 'form_submitted'` 를 추가하는데, `type` 과 `status` 가 같은 값 `'form_submitted'` 를 중복 운반한다. 두 키의 의미가 실질적으로 동일해 LLM 이 어느 쪽을 권위 있는 신호로 볼지 불명확해질 수 있다.
- 제안: `type: 'form_submitted'` 는 spec SoT(§10.9, ai-agent §6.2)가 정의한 기존 키이므로 유지. `status` 필드는 추가하지 않거나, 추가하더라도 `type` 과 다른 의미(예: 처리 성공 여부를 나타내는 `status: 'ok'`)를 갖도록 구분. plan 의 테스트 기준 (§테스트: "`status: 'form_submitted'` 또는 `type: 'form_submitted'` 포함")은 두 키 중 하나만 채택된 경우에도 통과하도록 수정.

---

### [INFO] `message` 필드 신규 도입 — 기존 `PRESENTATION_TOOLS_GUIDANCE` 와 레이어 이중화

- target 신규 식별자: plan §변경 범위 코드 1번의 `message: '사용자가 form 을 제출했습니다. ...'`
- 기존 사용처:
  - `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:183-201` (`PRESENTATION_TOOLS_GUIDANCE`) — systemPrompt 에 주입되는 가이드라인이 이미 "호출 결과 해석" 안내를 제공
  - `spec/4-nodes/6-presentation/0-common.md:383` 4-layer SoT (4) — tool_result content schema 에 `message` 필드는 정의되어 있지 않음
- 상세: tool_result 안의 `message` 필드는 spec SoT(§10.9 4-layer SSOT)에 없는 신규 필드다. 충돌은 없지만 spec 과 코드 양쪽에서 동시에 보강되어야 단일 진실 원칙이 유지된다. plan 이 spec 갱신(§변경 범위 Spec 1번, L340/L362)을 함께 포함하고 있으므로 원칙상 문제는 없으나, spec 갱신 PR 이 아직 실행되지 않은 상태에서 코드 먼저 병합되면 spec-code drift 가 발생한다.
- 제안: spec 갱신 체크리스트 항목 (`project-planner 위임 — spec 본문 + Rationale 보강`)이 완료된 후 코드 구현이 진행되도록 순서를 명시하거나, 동일 PR 에 spec 과 코드를 함께 포함시킬 것.

---

### [INFO] `ok: true` 필드 복원 — 기존 stub `{ok:true, pending:'form_submission'}` 와의 관계 명확화 필요

- target 신규 식별자: plan 제안 shape 의 `ok: true` 보강 (form_submitted 경로에 추가)
- 기존 사용처:
  - `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts:691` — render_form 호출 직후의 초기 stub content 는 `{ok: true, pending: 'form_submission'}` 으로 `ok:true` 를 이미 가짐. 이 stub 이 form 제출 시 handler(`ai-agent.handler.ts:1647`)에서 교체됨
  - 회귀 주석(plan §원인): "tool_result content 가 `{ok:true, pending:'form_submission'}` → `{type:'form_submitted', data:{…}}` 로 바뀌면서 `ok:true` 신호가 사라짐"
- 상세: stub `{ok:true, pending:'form_submission'}` 은 render_form 도구가 blocking 진입할 때 handler 가 먼저 LLM 메시지 이력에 넣어두는 임시값이고, 실제 제출 시 handler 가 해당 stub 을 `{type:'form_submitted', data}` 로 덮어쓴다 (`ai-agent.handler.ts:1641-1653`). plan 이 제안하는 `ok: true` 복원은 이 덮어쓰기 단계의 최종 content 에 `ok:true` 를 추가하는 것으로 충돌은 없다. 그러나 stub 단계의 `ok:true` 와 최종 content 의 `ok:true` 가 다른 신호임을 spec 에서 구분해두지 않으면 미래 독자에게 혼선이 생길 수 있다.
- 제안: spec §10.9 보강 시 "(4) layer: stub 단계 `{ok:true, pending:'form_submission'}`" 와 "제출 후 교체 content `{ok:true, type:'form_submitted', data:{…}, message:…}`" 를 명확히 분리 기술.

---

## 요약

plan `form-resubmit-fix.md` 가 도입하는 신규 식별자(`ok:true` 복원, `rendered:false`, `status:'form_submitted'`, `message` 필드)는 기존 다른 의미의 식별자와 **직접 충돌하지 않는다**. 그러나 `rendered: false` 는 기존 `rendered: true` (display-only 성공 신호)와 같은 키를 공유해 LLM 가이드라인과 의미적 혼동이 발생할 수 있고, `status: 'form_submitted'` 는 spec SoT 에 정의된 `type: 'form_submitted'` 와 동일 값을 중복 운반해 불필요한 이중화가 된다. `message` 필드는 spec SoT(§10.9 4-layer table)에 아직 없는 신규 키이므로 spec 선행 갱신이 필요하다. 전체적으로 CRITICAL 충돌은 없고 WARNING 1건 · INFO 3건 수준이다.

---

## 위험도

LOW
