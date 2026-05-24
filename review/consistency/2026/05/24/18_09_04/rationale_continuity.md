# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상 영역: `spec/4-nodes/3-ai`
검토 일시: 2026-05-24

---

## 발견사항

### [INFO] §12.7 가 §4.1 의 `meta.presentationSchemaViolations[]` 진단 채널을 우회하나 — 의도된 분리임을 Rationale 에 명시 보완 필요

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.7 및 §6.2 step 2.c
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §4.1` Schema 위반 처리 Rationale — "1MB cap 초과 시 silent drop + `meta.presentationSchemaViolations[]` 누적"
- **상세**: §4.1 에서 확립된 `render_*` 오류 진단 채널은 `meta.presentationSchemaViolations[]` 이다. §12.7 의 formData 크기 초과는 동일 `render_form` 경로이지만 silent drop 이 아니라 **partial truncate + `formDataTruncation` 메타 in-band** (tool_result content 내부) 방식을 선택했다. 두 경로의 차이점 (LLM-source cap vs user-source cap, payload 자체 vs 사용자 데이터) 은 §12.7 본문에 논리적으로 충분히 설명되어 있다. 다만 §4.1 Rationale 과 §12.7 Rationale 이 서로 명시적으로 cross-ref 하지 않아서 이후 독자가 "왜 이 케이스에서만 `presentationSchemaViolations[]` 를 쓰지 않는가" 를 파악하려면 두 섹션을 모두 읽어야 한다. §4.1 의 `meta.presentationSchemaViolations[]` 설명부에 "사용자 입력 formData cap (§12.7) 은 LLM-facing in-band `formDataTruncation` 으로 별개 처리" 한 줄 각주를 추가하면 연속성이 완결된다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` §4.1 Schema 위반 처리 단락 끝에 단 한 줄 각주 추가 — "사용자가 submit 한 formData 의 크기 cap 은 LLM-source 페이로드 cap 과 성격이 달라 `presentationSchemaViolations[]` 가 아닌 tool_result 내 `formDataTruncation` 으로 처리한다 (§12.7)." 이는 Rationale 의 번복이 아니라 적용 범위 명시이므로 spec 개정 수준이 아닌 각주 한 줄로 충분하다.

---

### [INFO] §12.7 의 단일-turn `render_form` 처리와의 관계 명시 부재

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.7 / §6.1.d.ii
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii` — "single-turn 모드에서 `render_form` 호출 시 §4.1 과 동일하게 1회 재시도 후 silent drop"
- **상세**: single-turn 에서 `render_form` 은 silent drop 이므로 formData 제출 자체가 도달하지 않는다. 따라서 §12.7 의 10KB cap 은 multi-turn 경로에서만 실질적으로 작동한다. §12.7 에 "multi-turn 전용 적용" 임이 명시되지 않아 독자가 single-turn 에도 cap 이 적용된다고 오해할 여지가 있다. 현재 §12.7 이 §6.2 step 2.c 만 cross-ref 하는 것으로 암묵적으로 multi-turn 한정임을 암시하지만 명시적이지 않다.
- **제안**: §12.7 본문에 "본 cap 은 multi-turn 경로에서만 도달 가능 — single-turn 에서는 §6.1.d.ii 의 silent drop 이 먼저 적용되어 form 제출 자체가 이루어지지 않는다" 한 줄 추가. 이는 기존 결정을 번복하는 것이 아니므로 Rationale 갱신이 아닌 본문 각주 수준.

---

## 요약

Rationale 연속성 관점에서 `spec/4-nodes/3-ai` 의 §12.7 신설 내용은 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하지 않는다. tail-truncate (Option C) 는 §12.7 에서 명확히 기각 이유와 함께 재확인됐고, LLM reasoning autonomy 원칙 (§12.5 / §12.6) 과의 정합도 §12.7 본문에서 설명됐다. 4-layer SSOT 원칙 (§10.9) 도 (4) LLM tool_result layer 한정으로 준수했다. 유일한 연속성 보완 지점은 §4.1 의 `meta.presentationSchemaViolations[]` 채널과 §12.7 의 `formDataTruncation` 채널이 왜 분리되어 있는지 §4.1 측에서 명시적으로 cross-ref 하지 않아 독자 혼선 가능성이 있다는 점이며, 이는 각주 한 줄 추가로 해소 가능한 INFO 수준이다. 과거 Rationale 결정의 번복이나 합의된 원칙 위반은 발견되지 않았다.

## 위험도

LOW

---

STATUS: SUCCESS
