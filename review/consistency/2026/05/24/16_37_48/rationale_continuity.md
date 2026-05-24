# Rationale 연속성 검토 — form-resubmit-fix

검토 대상: `plan/in-progress/form-resubmit-fix.md`
검토 기준 spec: `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/6-presentation/0-common.md`
검토 시각: 2026-05-24

---

## 발견사항

### [WARNING] `ok:true` 가드 필드 형식이 기존 결정의 "외부 surface 분리" 원칙과 경계 모호

- **target 위치**: `plan/in-progress/form-resubmit-fix.md` §변경 범위 > 코드 > 항목 1 (tool_result content shape)
- **과거 결정 출처**: `spec/4-nodes/6-presentation/0-common.md §Rationale "form submission wire format wrap (2026-05-23)"`, 특히 "왜 internal bus layer 한정" 항목; `spec/4-nodes/3-ai/1-ai-agent.md §12.4` 의 4-layer SSOT 정렬 원칙
- **상세**:
  target 이 제안하는 tool_result shape `{ok:true, rendered:false, status:'form_submitted', type:'form_submitted', data:formData, message:'…'}` 는 기존 spec 에 명시된 LLM tool_result content layer SoT(`spec/4-nodes/6-presentation/0-common.md §10.9` 표 (4)행, `spec/4-nodes/3-ai/1-ai-agent.md §4.1` 표, §6.2 step 2.c) 가 정의한 `{type:'form_submitted', data:{…}}` 형식 위에 `ok`, `rendered`, `status`, `message` 필드를 추가한다.
  `form submission wire format wrap` Rationale 은 LLM tool_result content layer 에 대해 "변경 불요 — 이미 동형 shape 으로 명시되어 있다" 라고 명시했다. 즉 이 layer 는 기존 결정에서 유지 범위로 선언됐는데, target 은 같은 layer 에 새 필드를 추가하는 방향을 제안한다. 이 번복에 대한 새 Rationale 이 target plan 본문에 없다.
  `ok:true` / `message` 추가가 실제로 LLM 재호출 가드 효과를 낼 수 있는지도 불분명하다 — Rationale 이 없으면 이 가드가 "PRESENTATION_TOOLS_GUIDANCE 의 보강" 과 어느 쪽이 주이고 어느 쪽이 보조인지, 효과가 검증됐는지 알 수 없다.
- **제안**:
  plan 에 tool_result content layer 변경이 `form submission wire format wrap` Rationale 의 "변경 불요" 선언을 번복하는 이유를 명시하거나, 대안으로 LLM 재호출 가드를 PRESENTATION_TOOLS_GUIDANCE 텍스트 보강만으로 처리하고 tool_result shape 은 기존 `{type:'form_submitted', data:{…}}` 를 유지하는 경로를 검토하도록 명시한다. spec 변경이 수반될 경우 해당 spec 의 §Rationale 에 "LLM 재호출 가드 필드 추가 결정 근거" 절 신설이 필요하다.

---

### [WARNING] `rendered:false` 필드의 semantic 이 display-only 경로의 `{ok:true}` 스텁과 충돌 가능

- **target 위치**: `plan/in-progress/form-resubmit-fix.md` §변경 범위 > 코드 > 항목 1 code snippet
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §4.1` 도구 표 — display-only 도구 `{ok:true}` 스텁; `spec/4-nodes/6-presentation/0-common.md §10.6` Blocking vs Display-only 구분
- **상세**:
  display-only 도구 (`render_table` 등) 의 tool_result 는 `{ok:true}` 이며 `rendered` 필드가 없다. `render_form` 에 `rendered:false` 를 추가하면, LLM 이 도구군 전체를 보면서 `rendered` 의 의미를 "렌더 완료 여부"로 오해해 display-only 호출이 `rendered:true` 를 암묵적으로 기대하는 방향으로 학습·추론할 수 있다. display-only path 의 `{ok:true}` 와 interactive path 의 `{ok:true, rendered:false, …}` 사이의 `rendered` 비대칭에 대한 설명이 plan 에 없다.
  §12.4 Rationale 은 "display-only / interactive 구분" 을 per-node 분리 설계의 핵심 원칙으로 선언했으나, `rendered` 필드는 두 경로 간 cross-cutting 개념을 도입하면서 그 분리를 흐릴 수 있다.
- **제안**:
  `rendered:false` 필드 추가 필요성을 plan 에 명시 근거로 기재하거나 제거한다. 가드 목적이라면 `status:'form_submitted'` 와 `message` 만으로 충분한지 검토하고 그 결론을 기록한다.

---

### [INFO] §12.5 Rationale 의 "LLM reasoning autonomy 침해 금지" 원칙과 `message` 필드 안의 명령형 안내문 간 미묘한 긴장

- **target 위치**: `plan/in-progress/form-resubmit-fix.md` §변경 범위 > 코드 > 항목 1 code snippet 의 `message` 필드 값
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §12.5` "Form bypass 의 cancelled tool_result 선택" — "backend 가 강제 prompt 박지 않는 이유: LLM 의 reasoning autonomy 침해를 피함"
- **상세**:
  §12.5 는 form bypass 시 backend 가 LLM 에 "다음 행동을 강제하는 prompt" 를 직접 박지 않는 이유로 reasoning autonomy 보존을 들었다. target 이 제안하는 `message:'사용자가 form 을 제출했습니다. 같은 form 을 다시 호출하지 말고 결과를 받아 후속 답변 / 다른 도구 호출 / turn 종결을 하세요.'` 는 LLM 에 구체 행동 목록을 직접 지시하는 형태라 동일 원칙과 긴장이 있다. 단, 이 경우는 bypass 가 아닌 submit 완료 후 재호출 방지가 목적이므로 완전히 동일한 상황은 아니다.
  충돌이 아닌 "원칙의 적용 범위 명확화"가 필요한 수준이나, 이를 plan 에 명시하지 않으면 spec Rationale 갱신 시 해당 원칙이 이 케이스에도 적용되는지 모호해진다.
- **제안**:
  plan 의 spec 갱신 항목 (`§12.5 / §12.6 혹은 새 Rationale 절`) 에 "`message` 필드를 통한 안내가 reasoning autonomy 원칙의 예외 또는 별개 케이스인 이유" 를 함께 기록하도록 명시한다. 예: submit 완료 신호는 상태 전달이지 다음 행동 강제가 아닌 점, form 재호출이 사용자 회귀를 유발하는 확정 버그라는 점에서 bypass 케이스와 다름.

---

### [INFO] 4-layer SSOT 표 (4)행 변경 시 §10.9 본문과 Rationale 의 cross-ref 구조 유지 필요

- **target 위치**: `plan/in-progress/form-resubmit-fix.md` §변경 범위 > Spec > `spec/4-nodes/6-presentation/0-common.md` 항목
- **과거 결정 출처**: `spec/4-nodes/6-presentation/0-common.md §10.9` 의 "4-layer SSOT 정렬" 및 `§Rationale "form submission wire format wrap"` 에서 "본 절은 결정 근거만 담고 정렬 자체는 §10.9 본문이 SoT"
- **상세**:
  기존 spec 아키텍처에서 §10.9 본문이 4-layer SSOT 의 단일 진실이고 Rationale 은 결정 근거만 담는다. target 이 §10.9 (4)행을 변경할 때 이 구조가 유지되어야 한다. target plan 의 spec 변경 항목이 "§10.9 (4)행 보강" 과 "§Rationale 보강" 을 동시에 언급하는 것은 기존 구조와 부합하나, plan draft 단계에서 이 cross-ref 관계를 명시하지 않으면 project-planner 위임 시 §10.9 본문만 바꾸고 Rationale 을 빠뜨리거나 반대 경우가 생길 수 있다.
- **제안**:
  spec 변경 항목에 "§10.9 본문이 SoT — Rationale 은 결정 근거 (LLM 재호출 가드 추가 사유) 만 기재" 라는 주석을 추가해 project-planner 가 구조를 올바르게 따르도록 안내한다.

---

## 요약

`form-resubmit-fix` plan draft 는 Rationale 에 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하지 않는다. 다만 두 가지 WARNING 이 존재한다. 첫째, 기존 `form submission wire format wrap` Rationale 이 "LLM tool_result content layer 는 변경 불요" 라고 선언한 결정을 근거 없이 번복하며 `ok`, `rendered`, `status`, `message` 필드를 추가하는 점이다. 이 번복에 대한 새 Rationale 이 plan 에 없어 project-planner 위임 및 spec 갱신 단계에서 결정 근거가 누락될 위험이 있다. 둘째, `rendered:false` 필드가 display-only 경로의 `{ok:true}` 스텁과 semantic 비대칭을 만들어 display-only / interactive 구분 원칙을 흐릴 수 있으나 설명이 없다. 두 INFO 는 4-layer SSOT 구조 유지와 reasoning autonomy 원칙 적용 범위를 plan 에 명시해 project-planner 위임 시 오류를 방지하는 권고이다. 전체적으로 plan 이 진행되기 전에 WARNING 두 건에 대한 설계 결정 명문화가 필요하다.

---

## 위험도

MEDIUM
