# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (scope: `spec/4-nodes/3-ai`)
검토 대상 파일:
- `spec/4-nodes/3-ai/0-common.md` (변경 없음 — target 으로 포함됨, 변경 내용은 `1-ai-agent.md` 와 `spec/4-nodes/6-presentation/0-common.md`)
- `spec/4-nodes/3-ai/1-ai-agent.md` (변경)
- `spec/4-nodes/6-presentation/0-common.md` (변경)

---

## 발견사항

### [INFO] 2026-05-23 Rationale 의 "LLM-facing layer 변경 불요" 문구를 2026-05-24 변경이 올바르게 갱신했는지 확인 필요

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md` §Rationale "form submission wire format wrap" — "왜 internal bus layer 한정" 단락의 LLM tool_result content 항
- **과거 결정 출처**: `spec/4-nodes/6-presentation/0-common.md` §Rationale "form submission wire format wrap" (2026-05-23). 해당 항은 2026-05-23 sentinel wrap 변경 PR 에서 "LLM tool_result content (`{type:'form_submitted', data:{…}}`, ai-agent §6.2 step 2.c) 는 LLM-facing layer. 변경 불요 — 이미 동형 shape 으로 명시되어 있다." 라고 기술됐다.
- **상세**: 이 "변경 불요" 선언은 2026-05-23 sentinel wrap 변경의 범위 한정 설명이었다 — 즉 그 당시 해당 PR 에서 LLM tool_result layer 는 건드리지 않는다는 의미였다. 2026-05-24 변경은 해당 항을 "기존 `{type, data}` SoT 는 유지 + 재호출 가드 필드 `ok`, `message` 가 함께 직렬화된다 ([AI Agent §12.6])" 로 교체했다. 변경된 내용 자체는 적절하나, 이 Rationale 단락이 옛 "변경 불요" 의 맥락(2026-05-23 PR 한정)임을 명시하지 않아 독자가 "이전 PR 에서 명시적으로 변경하지 않기로 했던 것 아닌가" 라고 오해할 여지가 남는다.
- **제안**: 해당 단락에 "(2026-05-24 갱신 — 옛 '변경 불요' 는 2026-05-23 sentinel wrap PR 의 범위 한정 표현이었으며, 동일 form 재호출 회귀 차단 필요로 가드 필드 추가 — §AI Agent §12.6)" 한 줄을 추가하면 역사적 맥락이 더 명확해진다. 필수 수정 사항은 아니며, §12.6 의 상세 근거가 존재하므로 참조로 충분.

---

### [INFO] `§12.6` Rationale 에서 기각된 (B) 안의 `§12.5` 충돌 근거가 암묵적

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.6 선택지 비교표 — 안 (B, 기각): render-tool-provider same-execution form idempotency 가드
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.5 "Form bypass 의 cancelled tool_result 선택" — "backend 가 강제 prompt 박지 않는 이유: LLM 의 reasoning autonomy 침해를 피함." 으로 LLM 자율 결정 원칙을 명시.
- **상세**: §12.6 표에서 (B) 기각 사유로 "LLM 의 reasoning 자율성 침해 (§12.5 와 충돌)" 를 언급한다. 이 참조는 유효하나, §12.5 가 render_form 도구 재호출의 코드 가드가 아니라 "cancelled tool_result 에 행동 지시 prompt 를 넣지 않는다" 는 결정이라 §12.5 와의 충돌 관계가 한 단계 간접적이다. 직접 충돌 여부는 "idempotency 가드가 LLM reasoning 자율성 침해인가" 에 대한 추가 설명이 있으면 더 명확해진다.
- **제안**: "render-tool-provider 의 동일 tool_call 재실행 거부는 LLM 의 합법적 재호출 의도 (예: 사용자 오타 수정 후 재시도를 LLM 이 판단) 까지 차단하므로 reasoning 자율성 침해로 분류한다" 한 줄 보강 검토. 현재 plan 텍스트에는 "회귀가 닫히는지 먼저 검증 후 추후 별도 plan" 으로 분리해두었으므로, 별도 plan 으로 갈 때 이 설명을 명시하면 된다. 현 §12.6 에서 보강은 선택 사항.

---

## 요약

target 변경 (`spec/4-nodes/3-ai/1-ai-agent.md` §4.1 표 / §6.1.d.ii / §6.2 step 2.c / §12.6 신설, `spec/4-nodes/6-presentation/0-common.md` §10.9 (4) layer / §Rationale 갱신) 은 Rationale 연속성 관점에서 전반적으로 양호하다. 핵심 번복 포인트 — 2026-05-23 Rationale 의 "LLM tool_result content 변경 불요" 선언이 2026-05-24 변경으로 폐기되는 구조 — 는 §12.6 에서 회귀 원인 분석·선택지 비교·기각 근거·기존 원칙(§12.5 LLM reasoning autonomy) 과의 정합까지 상세히 문서화됐다. 기각 대안 (`rendered:false` / `status:'form_submitted'`) 도 명시 기각·이유 제공. 4-layer SSOT 원칙 유지 (다른 세 layer 변경 없음) 도 명문화됐다. CRITICAL 또는 WARNING 수준의 Rationale 연속성 위반은 발견되지 않으며, 두 개의 INFO 수준 보완 제안만 있다.

## 위험도

LOW
