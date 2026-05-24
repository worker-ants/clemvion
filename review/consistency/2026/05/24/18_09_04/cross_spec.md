# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
대상 영역: `spec/4-nodes/3-ai`
검토 일시: 2026-05-24

---

## 발견사항

### [INFO] `output.interaction.data` 에 raw formData 가 유지됨 — 의도된 설계이나 명시 없음

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.b` / `§7.5`
- 충돌 대상: `spec/conventions/node-output.md §4.5` / `spec/conventions/conversation-thread.md §1.4`
- 상세: `§12.7` 의 10KB cap 은 layer (4) LLM tool_result content 의 `data` 필드에만 적용된다. 그러나 `§6.2 step 2.b` 에서 form 제출 시 `output.interaction.{type:'form_submitted', data:{<field>:value}, receivedAt}` 로 emit 되는 `resumed` 스냅샷의 `data` 는 여전히 raw (비-truncated) formData 를 담는다. 이 raw formData 는 `node-output §4.5` 의 `form_submitted` payload 로도 사용되며, `conversation-thread §1.4` 의 `source: 'presentation_user'` 텍스트 렌더 (`name=John, age=30`, 200자 cap) 에도 영향을 준다. cap 초과 케이스에서 `output.interaction.data` 는 raw 전체를 담고, LLM 이 보는 tool_result content 의 `data` 만 truncated 되는 의미 분기가 spec 내 명시적 언급 없이 암묵적으로 처리된다.
- 제안: `§12.7` 또는 `§6.2 step 2.b` 에 "cap 은 LLM tool_result content layer (4) 한정이며, `output.interaction.data` 와 `presentation_user` thread turn 의 formData 는 raw 전체를 담는다" 는 단 한 줄 명시를 추가하면 구현자 혼동을 방지할 수 있다. 현 스펙 구조 자체는 4-layer SSOT 원칙에 부합하므로 코드 변경 불요.

---

### [INFO] `meta.presentationCalls[].bytes` — formData truncation 케이스의 bytes 의미 미정의

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.10` / `§7.1` meta 표
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §4.1` ("Schema 위반 처리" 절), `spec/4-nodes/6-presentation/0-common.md §10.4`
- 상세: `meta.presentationCalls[]` 의 `bytes?` 필드는 display-only `render_*` 도구의 페이로드 바이트를 기록한다. `render_form` 의 `status: 'form_submitted'` 케이스에서 이 `bytes` 가 tool_result content 전체 (truncated `data` 포함 + `ok` + `message` 포함) 인지, raw formData 원본 바이트인지, 아니면 cap 후 바이트인지 정의가 없다. display-only 케이스 (`PRESENTATION_MAX_BYTES = 1MB`) 에서는 cap 된 payload 바이트가 기록된다고 추론되지만, `render_form` 의 `form_submitted` 케이스에 대한 별도 언급이 없다.
- 제안: `§7.10` 의 `meta.presentationCalls[]` 표 비고 또는 `§12.7` 에 "status: 'form_submitted' 케이스의 bytes = tool_result content 직렬화 후 바이트 (또는 미기록)" 를 명시하거나, 기록 불요라면 명시적으로 `bytes?: never` (form_submitted 케이스는 omit) 로 정의한다. metric 트레이스 용도라 구현 차단 이슈는 아니다.

---

## 요약

`spec/4-nodes/3-ai` 영역의 신규 `§12.7` (`render_form` submit 후 formData 10KB cap) 및 `spec/4-nodes/6-presentation/0-common.md §10.9` (4) layer 보강은 기존 4-layer SSOT 원칙, `PresentationPayload.truncation` 명명 분리, WebSocket wire format, internal continuation bus sentinel, NodeOutput `interaction.type` 과 직접 충돌하지 않는다. 두 spec 의 cross-reference (`§12.7 ↔ §10.9 (4) layer`) 도 양방향 일치한다. 발견된 두 항목은 모두 INFO 수준 — 구현자가 cap 범위를 `output.interaction.data` (raw 전체 유지) 와 혼동할 여지 및 `meta.presentationCalls[].bytes` 정의 공백이며, 어느 쪽도 두 영역의 상호 작동을 불가하게 하지 않는다. CRITICAL 또는 WARNING 등급의 충돌은 없다.

---

## 위험도

LOW
