# Rationale 연속성 검토 — ai-agent-formdata-size-limit plan draft

검토 일시: 2026-05-24
검토 모드: plan draft (--plan)
Target: `plan/in-progress/ai-agent-formdata-size-limit.md`

---

## 발견사항

### [WARNING] `render-tool-provider` 의 1MB cap 과 "동형"이라 했으나 실제 설계 결정은 이형(異形)

- **target 위치**: `## 채택안` 섹션 — "`render-tool-provider.ts` 의 `PRESENTATION_MAX_BYTES = 1MB` 패턴과 동형하게 form_submitted 전용 cap 적용"
- **과거 결정 출처**: `spec/4-nodes/6-presentation/0-common.md §4 + §10.4 Rationale` ("1MB cap")
- **상세**:
  Presentation 노드의 `PRESENTATION_MAX_BYTES = 1024 × 1024` cap 은 **Carousel/Table 의 element tail truncate** 패턴이다 — 구조 보존 상태에서 배열 끝의 element 를 잘라낸다. 잘린 사실은 `output.{itemsTruncated|rowsTruncated}: true` + `output.{itemsTotalCount}` 로 surface 한다. 반면 target 이 제안하는 10KB cap 은 **string 필드 값 균등 truncate** + `truncation.truncatedFields: string[]` 메타를 LLM-facing tool_result content 에 추가하는 방식이다. tail truncate vs field-value truncate 는 근본적으로 다른 알고리즘이며, surface 위치도 다르다(NodeOutput vs tool_result JSON 필드). 동형 패턴이라고 기술하면서 실제로는 이형 알고리즘을 도입하는 것이 검토자를 오도할 수 있다. 또한 `PRESENTATION_MAX_BYTES` 는 render-tool-provider 의 LLM tool 모드에 적용되며 그 근거는 "Presentation 은 사용자 가시 surface 라 정상 사용 시 거대해질 수 있는 반면 1MB 초과는 runaway 데이터 신호" — form 입력 10KB cap 의 토큰 DoS 방어 목적과 결정 배경이 다르다.
- **제안**: plan 의 "동형" 표현을 "유사 패턴에서 영감을 얻되 독립적 결정"으로 수정하고, 차이점(알고리즘: tail drop vs per-field value truncate, surface: node output vs LLM tool_result content, cap 크기 근거: runaway 데이터 vs 토큰 DoS 방어)을 명시한다. 구현 후 spec 보강 시 §12.7 의 Rationale 에 이 차이를 명시할 것.

---

### [WARNING] 4-layer SSOT 의 (4) LLM tool_result content layer 에 신규 필드 (`truncation`) 추가 — 다른 layer 영향 0 여부 미검토

- **target 위치**: `## 채택안` — "tool_result content 에 `truncation` 메타 필드 추가 (LLM-facing): `{originalBytes, cappedBytes, truncatedFields: string[]}`"
- **과거 결정 출처**: `spec/4-nodes/6-presentation/0-common.md §10.9` + `§Rationale "form submission wire format wrap"` — 4-layer SSOT 의 (4) LLM tool_result content layer 는 `{ok: true, type: 'form_submitted', data: {…}, message: '<재호출 금지 안내문>'}` 로 확정되어 있음. 동 Rationale 은 "**본 가드 필드는 LLM-facing layer 한정 — 위 (1)(2)(3) layer 형식은 변경 없다**" 를 원칙으로 명시.
- **상세**:
  target 은 "4-layer SSOT 의 다른 layer 영향 0 (LLM-facing layer 한정)" 이라고 기술하면서 `truncation` 필드를 tool_result content 에 추가한다. 현행 spec §10.9 의 4-layer SSOT 표 (4)열 은 tool_result content 의 shape 를 `{ ok, type, data, message }` 로 정의한다. 여기에 `truncation` 필드가 추가되면 표 (4)열 의 공식 shape 가 변경되는 것이다. plan 이 "다른 layer 영향 0" 이라고 주장하는 것은 맞지만, (4) layer 자체의 shape 변경에 대해 spec §10.9 표를 함께 갱신해야 한다는 점이 명시되지 않았다. 비록 spec §12.6 이 SoT 로 (4) layer 를 참조하므로 §12.7 spec 보강 시 자연히 해소될 수 있으나, "4-layer SSOT 의 다른 layer 영향 0" 이라는 표현이 (4) layer shape 변경 자체도 영향 없다는 오독을 유발한다.
- **제안**: plan 표현을 "(1)(2)(3) layer 영향 0; (4) LLM tool_result content layer 의 shape 에 `truncation` 필드가 추가됨 — spec §10.9 표 (4)열 및 AI Agent §6.2 step 2.c 본문도 spec 보강 단계에서 함께 갱신 필요"로 명확히 기술한다.

---

### [WARNING] developer 역할이 spec 직접 수정을 "작은 보강 예외"로 자기 승인 — CLAUDE.md 역할 분리 원칙 위반

- **target 위치**: `### Spec (spec/) — 작은 보강` 섹션 마지막 문단 — "본 변경은 §12.6 의 직접 후속이라 dev skill 안에서 직접 갱신 (CLAUDE.md spec read-only 룰의 작은 보강 예외) — 변경 면적이 한 단락 이하라 project-planner 위임의 비용 대비 효과가 낮음. PR body 에 사유 명시 + ai-review 가 post-impl 검증."
- **과거 결정 출처**: `developer/SKILL.md §경로별 권한` 표 — `spec/` 행: "**Read only — 수정 시 `project-planner` 위임.** 갱신 제안은 `plan/in-progress/spec-update-<name>.md`". 동 §절대 원칙 — "기획 금지: `spec/` 신규 정의·대규모 개정 안 함. 필요 시 `project-planner` 위임."
- **상세**:
  developer SKILL.md 는 `spec/` 를 read-only 로 규정하며 예외 조항이 없다. target plan 이 "변경 면적이 한 단락 이하", "비용 대비 효과가 낮음", "pr body 사유 명시 + ai-review post-impl 검증" 을 이유로 developer 가 직접 spec 을 수정하겠다고 자기 승인하는 것은 SKILL.md 에 명시된 역할 분리 규칙을 번복하는 것이다. 과거 결정 근거는 "기획(Spec)과 구현(codebase)의 역할 분리"이며, 변경 면적의 크고 작음은 이 원칙의 예외 조건으로 인정된 적이 없다.
- **제안**: plan 에서 해당 자기 승인 문단을 제거하고, spec 갱신 phase 를 `project-planner` 위임으로 정식 등록한다 (MEMORY.md "구현 plan 은 spec 갱신까지 정식 phase 로 포함, '외부 위임' 한 줄로 묶지 말 것" 선례와도 정합). plan 체크리스트 2번 항목을 "[ ] spec 보강 — project-planner 위임 (plan/in-progress/spec-update-ai-agent-formdata-size-limit.md 신설)" 형태로 수정한다.

---

### [INFO] `REVIEW WORKFLOW — 변경 면적 작아 skip 검토` — developer SKILL.md 의 REVIEW WORKFLOW 단계 강제성 확인 필요

- **target 위치**: `## 진행 체크리스트` 6번 항목 — `- [ ] REVIEW WORKFLOW — 변경 면적 작아 skip 검토`
- **과거 결정 출처**: `developer/SKILL.md §작업 워크플로` — "순서대로 모두 수행. 각 단계 문제 발견 시 해당 단계부터 다시."
- **상세**:
  developer SKILL.md 의 워크플로는 9단계 전 순서 수행이 원칙이며, REVIEW WORKFLOW 도 단계 9로 열거되어 있다. "변경 면적 작아 skip" 은 SKILL.md 에 명시된 예외 조건이 아니다. 단, 본 SKILL.md 가 "generic skeleton" 이고 PROJECT.md 에 구체 규정이 있을 수 있으므로 CRITICAL 이 아닌 INFO 로 분류한다. PROJECT.md 확인 후 skip 이 허용된 경우라면 plan 에 근거 조항을 명시하는 것이 바람직하다.
- **제안**: PROJECT.md 의 REVIEW WORKFLOW skip 조건을 확인하고, 해당 조항 번호를 plan 체크리스트에 명시한다.

---

## 요약

target plan 은 `render_form` formData 의 LLM tool_result 크기 cap 을 도입하는 합리적인 보안 hardening 방향이며, 기존 spec 에서 명시적으로 기각된 대안을 재도입하거나 핵심 invariant 를 직접 위반하는 사항은 발견되지 않았다. 다만 세 가지 점에서 Rationale 연속성 긴장이 존재한다. 첫째, `PRESENTATION_MAX_BYTES` 패턴과의 "동형" 주장이 알고리즘·배경이 다른 이형 결정을 오도할 수 있다. 둘째, 4-layer SSOT (4) layer shape 변경에 대해 "영향 0" 표현이 해당 layer 자체 변경을 은폐한다. 셋째 — 그리고 가장 중요하게 — developer 역할이 SKILL.md 의 `spec/ read-only` 원칙을 "변경 면적 작다"는 이유로 자기 승인 예외 처리하는 것은 확립된 역할 분리 Rationale 에 반하며, spec 갱신은 반드시 `project-planner` 위임으로 정식 처리해야 한다.

## 위험도

MEDIUM
