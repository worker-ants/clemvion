# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
검토 대상: `spec/4-nodes/3-ai` (0-common.md / 1-ai-agent.md / 2-text-classifier.md / 3-information-extractor.md)
검토 일시: 2026-05-24

---

## 발견사항

### [CRITICAL] `render_form` tool_result 의 guard 필드(`ok`, `message`) — target draft vs. Presentation 공통 §10.9 · 기존 AI Agent spec 간 직접 모순

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` (target draft) §4.1 도구 카탈로그 표 (`render_form` 행의 tool_result 열) / §6.1.d.ii / §6.2 step 2.c / §7.4 `_resumeState.pendingFormToolCall` 설명
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md §10.9` (LLM tool_result content 4-layer 분리 표 layer 4) / 현재 디스크 `spec/4-nodes/3-ai/1-ai-agent.md` (§4.1 표, §6.1.d.ii, §6.2 step 2.c)
- **상세**: target draft 는 `render_form` 의 form 제출 시 LLM tool_result content 를 `{ok: true, type: 'form_submitted', data: { … }, message: '<재호출 금지 안내문>'}` 으로 정의하고, 이를 `§12.6 guard 필드` 라고 명명한다. 그러나 현재 디스크 상의 동일 spec 파일(`spec/4-nodes/3-ai/1-ai-agent.md` §4.1·§6.1.d.ii·§6.2 step 2.c) 과 `spec/4-nodes/6-presentation/0-common.md §10.9` 의 layer 4 "LLM tool_result content" SoT 는 모두 `{type: 'form_submitted', data: { …formData }}` 로 명시하며 `ok` 및 `message` 필드가 없다. target draft 가 이 guard 필드를 추가하면서 내부에서 여러 곳(§4.1, §6.1.d.ii, §6.2.c, §7.4, §12.6)에 cross-ref 하고 있으나, 참조 대상인 `§12.6` 이 현재 on-disk spec 에 존재하지 않으며 `spec/4-nodes/6-presentation/0-common.md §10.9` layer 4 정의와도 충돌한다. backend 가 tool_result content 를 `{type:'form_submitted', data:{…}}` 로 emit 한 상태에서 LLM 측이 `ok` / `message` 필드를 기대하도록 동작이 구현되거나, 반대로 구현은 guard 필드를 추가했으나 spec 이 낡은 채로 남으면 두 spec 영역 중 하나가 구현과 단절된다.
- **제안**:
  1. target draft 가 guard 필드(`ok`, `message`) 도입을 공식 결정한 것이라면 — `spec/4-nodes/6-presentation/0-common.md §10.9` layer 4 의 tool_result content 정의를 동일하게 `{ok: true, type: 'form_submitted', data: { … }, message: '…'}` 으로 갱신하고 §12.6 Rationale 을 on-disk spec 에 추가해야 한다.
  2. guard 필드가 아직 결정되지 않은 proposal 이라면 — target draft 의 해당 표현을 기존 on-disk 정의(`{type: 'form_submitted', data: { … }}`)로 되돌리고 §12.6 cross-ref 를 제거해야 한다.

---

### [WARNING] `information-extractor.md` 의 `includeSystemContext` / `systemContextSections` 필드 타입 표기 — `Boolean?` vs `Boolean`

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §11.1` (3 노드 공통 규약 — `Boolean`, 필수 아님 표기 없음)
- **충돌 대상**: `spec/4-nodes/3-ai/3-information-extractor.md §1 config 표` — `includeSystemContext: Boolean?`, `systemContextSections: String[]?` (optional marker `?` 사용)
- **상세**: `0-common.md §11.1` 과 `1-ai-agent.md §1` / `2-text-classifier.md §1` 은 두 필드를 `Boolean` / `String[]` 으로 선언하지만, `3-information-extractor.md §1` 은 `Boolean?` / `String[]?` 로 nullable/optional 타입 마커를 사용한다. target draft(`0-common.md`) 는 공통 규약에서 non-optional 형태로 선언해두었으나 세 노드 중 하나가 다르게 명시되어 있다. schema 생성 시 Zod `.optional()` / `.nullable()` 분기가 달라질 수 있다.
- **제안**: `spec/4-nodes/3-ai/3-information-extractor.md §1` 의 두 필드 타입 표기를 `Boolean` / `String[]` 으로 통일하거나, 공통 규약(`0-common.md §11.1`)이 optional 로 정의하는 것이 맞다면 나머지 노드 문서도 `Boolean?` 으로 정합화한다.

---

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md §12.6` cross-ref — on-disk spec 에 미존재

- **target 위치**: target draft `1-ai-agent.md` §4.1 render_form 행, §6.1.d.ii, §6.2 step 2.c — 모두 "(가드 필드 SoT: §12.6)" 또는 "(가드 필드 `ok`, `message` 의 도입 근거는 §12.6)" 로 cross-ref
- **충돌 대상**: 현재 디스크 `spec/4-nodes/3-ai/1-ai-agent.md` — §12.6 섹션 없음 (§12.5 `render_form` 활성 form timeline 인라인 통합 이 마지막 섹션)
- **상세**: target draft 가 §12.6 을 SoT 로 참조하지만 해당 섹션이 on-disk spec 에 없다. 구현 착수 시 §12.6 부재로 결정 근거를 추적할 수 없다. CRITICAL 발견사항과 동일 원인(guard 필드 도입 결정이 spec 에 완전히 반영되지 않은 상태)이다.
- **제안**: CRITICAL 처리(§12.6 신설 또는 guard 필드 제거)와 함께 해결된다. 별도 조치 불필요.

---

### [INFO] `spec/4-nodes/3-ai/0-common.md §4` `multi_turn` 차단 모드 — `execution.submit_message` 명령 명칭 표기 정합

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §4` — "클라이언트가 `execution.submit_message` 명령으로 사용자 메시지를 전송하면 재개"
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.2` — `execution.submit_message` 동일 명칭으로 정의됨
- **상세**: 표기 자체는 일치하므로 명명 충돌 없음. 단, `0-common.md §4` 에서 form 제출(`render_form` 응답) 시의 `execution.submit_form` 명령을 별도 언급하지 않고 일반 채팅 명령(`execution.submit_message`)만 기술하여 독자가 multi-turn AI 의 form bypass 경로를 유추하기 어렵다. 이는 `1-ai-agent.md §6.2 step 2.a` 에 상세히 기술되어 있으나 공통 규약 §4 와의 참조 연결이 없다.
- **제안**: `spec/4-nodes/3-ai/0-common.md §4` 에 `render_form` 경우(`execution.submit_form`)도 재개 명령으로 언급하고 `1-ai-agent.md §6.2` 로 링크 추가를 고려한다. 구현 차단 수준은 아니다.

---

## 요약

`spec/4-nodes/3-ai` target draft 의 가장 중요한 cross-spec 충돌은 `render_form` tool_result content 에 추가된 guard 필드(`ok: true`, `message`)를 둘러싼 것이다. target draft 는 이를 세 군데(§4.1 표, §6.1.d.ii, §6.2.c) 에서 참조하며 §12.6 을 SoT 로 지목하지만, 현재 on-disk `spec/4-nodes/3-ai/1-ai-agent.md` 에는 §12.6 이 없고 cross-cutting SoT 인 `spec/4-nodes/6-presentation/0-common.md §10.9` layer 4 도 guard 필드 없는 `{type:'form_submitted', data:{…}}` 만을 정의하고 있다. 이 상태로 구현을 착수하면 backend 가 어느 정의를 따르는지 명확하지 않고, 두 spec 영역 중 하나가 구현과 단절된다. 부차 이슈로 `information-extractor.md` 의 `includeSystemContext`/`systemContextSections` 필드에 `?` 타입 마커가 붙어 다른 두 노드와 표기가 불일치한다.

---

## 위험도

CRITICAL

---

STATUS: SUCCESS
