# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/form-resubmit-fix.md`
검토 기준: spec/4-nodes/3-ai/1-ai-agent.md, spec/4-nodes/6-presentation/0-common.md, spec/0-overview.md, spec/1-data-model.md
검토 일시: 2026-05-24

---

## 발견사항

### [WARNING] tool_result content shape 보강이 기존 SoT 와 부분 불일치

- target 위치: plan `## 변경 범위 > 코드 > 1` — 제안 shape `{ok:true, rendered:false, status:'form_submitted', type:'form_submitted', data:formData, message:'...'}`
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §4.1 도구 카탈로그 표` (L242) 및 `spec/4-nodes/6-presentation/0-common.md §10.9 Layer (4) LLM tool_result content` (L383)
- 상세: 현재 spec 의 `render_form` tool_result content SoT 는 다음 두 곳에서 `{type:'form_submitted', data:{…}}` 로 정의된다.
  - `1-ai-agent.md §4.1` 도구 카탈로그 표의 `render_form` 행 tool_result 칸: `` `{type: 'form_submitted', data: { … }}` JSON ``
  - `0-common.md §10.9` Layer (4) 표 SoT 행: `{ type: 'form_submitted', data: { …formData } }` JSON 직렬화
  - plan 이 제안하는 보강 shape `{ok:true, rendered:false, status:'form_submitted', type:'form_submitted', data:formData, message:'...'}` 는 이 두 SoT 에 `ok`, `rendered`, `status`, `message` 필드를 추가한다. 필드 추가 자체는 기존 spec 에서 명시적으로 금지하지 않으나, spec 이 명시하는 shape 와 실제 구현 shape 가 달라져 drift 가 발생한다.
  - 특히 `rendered: false` 는 display-only render tool 의 tool_result 가 `{ok:true}` 를 쓰는 것(`1-ai-agent.md §6.1.d.i`)과 혼동 가능 — `rendered` 필드가 form_submitted 케이스에 새로 등장하는 근거가 spec 어디에도 없다.
- 제안: plan 이 구현 변경 시 spec 2곳(`1-ai-agent.md §4.1` 도구 카탈로그 표 + `0-common.md §10.9` Layer (4) 표)의 tool_result shape 를 동시에 갱신해야 한다. `rendered: false` 필드는 이미 `ok:true` 가 "render 안 함" 을 implicit 으로 가리키는 display-only 패턴과 의미가 겹치므로 제외하거나 Rationale 에 별도 근거를 기재한다.

---

### [WARNING] `PRESENTATION_TOOLS_GUIDANCE` 변경 범위가 spec 에 대응하는 SoT 없음

- target 위치: plan `## 변경 범위 > 코드 > 2` — `PRESENTATION_TOOLS_GUIDANCE` 에 `form_submitted` 처리 안내 라인 추가
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §6.1 (0.5 및 §4.1 도구 설명)` / `spec/4-nodes/6-presentation/0-common.md §10.2 도구 카탈로그`
- 상세: `PRESENTATION_TOOLS_GUIDANCE` 는 LLM 시스템 프롬프트에 주입되는 안내 텍스트다. spec §4.1 "도구 description" 항목과 §10.2 "기본 description" 칸이 LLM 에 노출되는 도구 설명의 SoT 이지만, `PRESENTATION_TOOLS_GUIDANCE` 전체 문자열은 spec 에 직접 명세되지 않는다. plan 은 이 텍스트에 `form_submitted` 안내를 추가하겠다고 하지만, 해당 안내가 어느 spec 절의 어떤 약속에 근거하는지 명시하지 않는다. spec 갱신 없이 코드만 바꾸면 spec-impl 간 silent drift 가 발생한다.
- 제안: plan 의 spec 변경 목록(`§12.5 / §12.6` 또는 새 Rationale)에 이 안내 텍스트의 원칙(form_submitted 수신 후 동일 render_form 재호출 금지)을 명문화하는 절을 추가한다. `1-ai-agent.md §6.1.d.ii` 또는 `§6.2 step 2.c` 에 인라인 추가도 가능.

---

### [WARNING] spec 갱신 대상 라인 번호가 특정 커밋 기준으로 고정되어 있음

- target 위치: plan `## 변경 범위 > Spec > 1` — `spec/4-nodes/3-ai/1-ai-agent.md` 의 `L242`, `L340`, `L362`
- 충돌 대상: 현재 `spec/4-nodes/3-ai/1-ai-agent.md` 의 실제 라인 위치
- 상세: plan 이 참조하는 L242 (도구 표 `render_form` 행)는 현재 spec 파일에서 확인하면 §4.1 도구 카탈로그 표가 L236 근방에 있다. L340 과 L362 도 실제 파일과 몇 라인 오차가 발생할 수 있다. 이는 구현 충돌이 아닌 추적 정확성 문제이나, project-planner 위임 시 잘못된 라인을 수정하거나 누락하는 회귀 가능성이 있다.
- 제안: plan 에서 라인 번호 대신 섹션 앵커(`§4.1 도구 카탈로그 표`, `§6.1.d.ii`, `§6.2 step 2.c`)로 위치를 특정한다.

---

### [INFO] plan 의 `관련_spec` 목록이 `spec/4-nodes/6-presentation/0-common.md §10.9` 와 `§10.6` 를 별도 명시하지 않음

- target 위치: plan frontmatter `related_spec`
- 충돌 대상: `spec/4-nodes/6-presentation/0-common.md §10.6 Blocking vs Display-only` 및 `§10.9 Form submission wire format`
- 상세: `0-common.md §10.9 Layer (4)` 가 `render_form` tool_result content 의 SoT 이고, `§10.6` 에도 `render_form` blocking 흐름의 tool_result 언급이 있다. plan 의 `related_spec` 에는 `spec/4-nodes/6-presentation/0-common.md` 가 포함되어 있으나, 구체 섹션이 명시되지 않아 project-planner 위임 시 `§10.9` 및 `§10.6` 갱신이 누락될 위험이 있다.
- 제안: plan 의 `## 변경 범위 > Spec > 2` 목록에 `0-common.md §10.6 Blocking vs Display-only` 에도 `form_submitted` tool_result 안내 언급이 필요한지 검토하고, 필요 시 갱신 대상에 명시한다.

---

### [INFO] 새로 추가되는 `message` 필드와 `ok:true` 가드의 LLM 행동 보장 근거가 spec 에 없음

- target 위치: plan `## 변경 범위 > 코드 > 1` 제안 shape 의 `message` 필드
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §4.1` 도구 카탈로그 표 — `render_form` 행의 turn 종료 설명: "LLM 의 다음 응답이 결정"
- 상세: `ok:true` + `message` 필드로 LLM 이 동일 form 을 재호출하지 않도록 유도하겠다는 접근은 현재 spec 이 기술하는 "LLM 이 자유롭게 다음 행동을 결정" 모델과 전략적으로 부합하지만, spec 은 tool_result 안에 안내 메시지를 넣어 LLM 행동을 유도하는 패턴을 명시하지 않는다. 이 변경은 LLM prompt engineering 결정으로서 Rationale 섹션에 근거가 기록돼야 한다.
- 제안: plan 의 spec 변경 항목 `§12.5 / §12.6 Rationale` 에 "form_submitted 후 동일 form 재호출 방지를 위해 tool_result content 에 명시 안내문을 포함하는 결정 근거" 를 기록한다.

---

### [INFO] 테스트 범위가 `PRESENTATION_TOOLS_GUIDANCE` 의 형태에 대한 export 의존성 전제

- target 위치: plan `## 테스트 > 2번째 항목` — "`PRESENTATION_TOOLS_GUIDANCE` (export 되어 있다면) 또는 systemPrompt 생성 로직에"
- 충돌 대상: 기존 spec (특히 `1-ai-agent.md`) 은 `PRESENTATION_TOOLS_GUIDANCE` 의 export 여부를 명세하지 않음
- 상세: "export 되어 있다면" 이라는 조건부 표현은 테스트 가능 여부가 불확실함을 인정하고 있다. spec 레벨에서 이 상수의 테스트 가시성 요건이 없어, 구현자가 export 없이 private 으로 두면 해당 테스트가 생략될 수 있다.
- 제안: plan 에서 "systemPrompt 생성 로직의 통합 테스트로 대체 가능" 을 명시하거나, `PRESENTATION_TOOLS_GUIDANCE` 를 testable 하게 export 할 것을 구현 요건으로 명시한다.

---

## 요약

Cross-Spec 일관성 관점에서 이 plan 의 가장 중요한 위험은 **tool_result content shape 의 spec-impl drift** 다. plan 이 제안하는 `{ok:true, rendered:false, status, type, data, message}` shape 는 현재 spec 2곳(`1-ai-agent.md §4.1` 도구 카탈로그 표 및 `0-common.md §10.9` Layer (4))에 `{type:'form_submitted', data:{…}}` 로 단일 진실이 정의된 shape 와 다르다. 실제 코드가 보강된 shape 로 바뀌면 spec 2곳을 동시 갱신하지 않으면 SSOT 원칙이 깨진다. plan 에 명시된 "project-planner 위임 — spec 본문 + Rationale 보강" 항목이 이를 포함하도록 구체화하면 충돌은 해소된다. `PRESENTATION_TOOLS_GUIDANCE` 변경의 spec 근거 누락 및 라인 번호 기반 위치 지정은 경미하나 위임 시 회귀 원인이 될 수 있어 WARNING 으로 분류했다. CRITICAL 등급의 직접 모순은 없다.

---

## 위험도

MEDIUM
