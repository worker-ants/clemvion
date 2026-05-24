# 부작용(Side Effect) 리뷰

리뷰 대상: form-resubmit-fix (render_form submit 후 동일 form 재호출 회귀 차단)
리뷰 일시: 2026-05-24

---

## 발견사항

### [INFO] tool_result content shape 확장이 하위 레이어에 영향 없음 — 명시적 확인

- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1658–L1671
- 상세: `JSON.stringify({type:'form_submitted', data: formData})` 에서 `{ok:true, type:'form_submitted', data, message}` 로 shape 가 확장된다. 이 content 는 LLM 에게만 전달되는 tool_result 레이어다. `execution-engine.service.ts` 의 `isFormSubmittedSentinel` (L611–L617) 이 확인하는 내부 버스 sentinel `{type:'form_submitted', formData}` 와는 완전히 다른 구조체이고, `appendPresentationInteraction` 호출 (L1681–L1691) 에서 `interaction.data` 로 들어가는 값은 `{...formData, via:'ai_render'}` 로 원래의 formData 에서 직접 파생된다 — tool_result content JSON string 을 파싱해 사용하지 않는다. NodeOutput `interaction.type` 도 `'form_submitted'` 문자열 리터럴로 별도 하드코딩 (L1686)되어 있어 tool_result content 의 `type` 필드 확장에 영향을 받지 않는다. WS wire 레이어도 마찬가지다. 4-layer SSOT 의 다른 세 레이어가 tool_result content 문자열을 파싱해 분기하는 경로가 코드베이스 전체에 존재하지 않음을 확인했다.
- 제안: 현행 유지. 우려 없음.

---

### [INFO] `PRESENTATION_TOOLS_GUIDANCE` 상수 변경이 모든 append 경로에 즉시 반영됨

- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1005, L1451
- 상세: `PRESENTATION_TOOLS_GUIDANCE` 는 module-level 불변 상수이고, 두 경로(single-turn L1005, multi-turn L1451) 에서 `finalSystemPrompt += PRESENTATION_TOOLS_GUIDANCE` 로 append 된다. 변경된 상수(말미에 `form_submitted` 가드 라인 추가)는 이 두 경로 모두에 자동으로 반영된다. 의도적 범위 확장이며 부작용 없음.
- 제안: 현행 유지.

---

### [INFO] `FORM_SUBMITTED_GUIDANCE_MESSAGE` 신규 모듈 레벨 상수 도입

- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L214–L215
- 상세: 새 모듈 레벨 `const` 상수가 추가되었다. export 되지 않으며, 같은 파일 내부에서만 참조된다. 전역 스코프 오염 없음. 이 상수의 값은 `PRESENTATION_TOOLS_GUIDANCE` 의 `form_submitted` 안내 라인과 의미적으로 정렬되어 있어 LLM 이 수신하는 system prompt 메시지와 tool_result message 가 일관된 신호를 전달한다.
- 제안: 현행 유지.

---

### [INFO] e2e 테스트 픽스처 INSERT — `user` 테이블 `role` 컬럼 제거, `email_verified` 추가

- 위치: `codebase/backend/test/chat-channel-discord.e2e-spec.ts` L30, `codebase/backend/test/chat-channel-slack.e2e-spec.ts` L47
- 상세: 이전 INSERT 는 `role` 컬럼에 `'user'` 를 삽입하고 `email_verified` 를 생략했다. 변경 후 INSERT 는 `email_verified = true` 를 명시하고 `role` 컬럼을 제거했다. 이 변경은 DB 스키마 현실을 반영하는 픽스처 수정이다 (다른 e2e 파일 `external-interaction.e2e-spec.ts` L51이 이미 같은 패턴을 사용 중). 테스트 외 프로덕션 코드에는 영향 없음.
- 제안: 현행 유지.

---

### [INFO] e2e 테스트 픽스처 INSERT — `workflow` 테이블 `is_active`, `current_version`, `created_by` 컬럼 추가

- 위치: `codebase/backend/test/chat-channel-discord.e2e-spec.ts` L47, `codebase/backend/test/chat-channel-slack.e2e-spec.ts` L64
- 상세: `workflow` INSERT 에 `is_active = true`, `current_version = 1`, `created_by = userId` 가 추가됐다. `created_by` 에 `userId` 를 바인딩하므로 FK 관계가 성립한다. 다른 e2e 픽스처와 동일한 패턴 (`external-interaction.e2e-spec.ts` L66). 부작용 없음.
- 제안: 현행 유지.

---

### [INFO] e2e 테스트 픽스처 INSERT — `trigger` 테이블 `name` 컬럼 추가

- 위치: `codebase/backend/test/chat-channel-discord.e2e-spec.ts` L54, `codebase/backend/test/chat-channel-slack.e2e-spec.ts` L76
- 상세: `trigger` INSERT 에 `name` 컬럼과 하드코딩 리터럴 값이 추가됐다. 다른 e2e 픽스처와 동일한 패턴. 부작용 없음.
- 제안: 현행 유지.

---

### [INFO] 테스트 파일에서 `parsed` 타입에 `ok?` 및 `message?` optional 필드 추가

- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts` L1654–L1659, L1853–L1858
- 상세: 기존 `{type, data}` 타입 assertion 에 `ok?: boolean`, `message?: string` 이 추가됐다. optional 로 선언되어 타입 assertion 자체는 이전 테스트를 깨지 않는다. 이어지는 `expect(parsed.ok).toBe(true)` 와 `expect(parsed.message).toMatch(...)` 단언이 실제 구현 변경과 쌍을 이루므로 의도한 회귀 가드가 정확히 설정됐다.
- 제안: 현행 유지.

---

### [WARNING] `PRESENTATION_TOOLS_GUIDANCE` 내 `form_submitted` 가드 라인과 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 의 텍스트가 동기화 방어 미흡

- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L202–L203 (guidance 내 form_submitted 라인), L214–L215 (`FORM_SUBMITTED_GUIDANCE_MESSAGE`)
- 상세: 두 텍스트는 의미상 동일하지만 다른 문장으로 표현되어 있다. `PRESENTATION_TOOLS_GUIDANCE` 내 라인: "같은 form 을 다시 호출하지 마세요 … `data` 의 입력값을 reasoning 에 반영해 후속 답변(텍스트) / 다른 도구 호출 / turn 종결 중 하나로 진행하세요." vs `FORM_SUBMITTED_GUIDANCE_MESSAGE`: "같은 form 을 다시 호출하지 말고, data 의 입력값을 받아 후속 답변 / 다른 도구 호출 / turn 종결 중 하나로 진행하세요." 현재는 의미상 충돌은 없으나, 미래에 한쪽만 수정될 경우 LLM 이 system prompt 와 tool_result message 에서 서로 다른 안내를 받는 드리프트가 발생할 수 있다. 상수 JSDoc 주석에 "두 텍스트 동기화 유지 필요" 를 명시하고, 가능하다면 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 의 핵심 어구를 `PRESENTATION_TOOLS_GUIDANCE` 에서 직접 참조하거나 별도 단위 테스트로 문자열 포함 여부를 검증하는 것이 바람직하다.
- 제안: `PRESENTATION_TOOLS_GUIDANCE` 내 form_submitted 가드 라인의 핵심 어구를 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 상수를 인라인 삽입해 단일 진실로 관리하거나, spec §12.6 테스트에서 두 텍스트의 정합 여부를 단언하는 unit test 1건 추가.

---

## 요약

이번 변경은 LLM tool_result content shape 에 `ok:true` 와 `message` 필드를 추가하고 `PRESENTATION_TOOLS_GUIDANCE` 시스템 프롬프트에 `form_submitted` 처리 가드 라인을 보강하는 것이 핵심이다. tool_result content 는 LLM 에만 노출되는 레이어이며, 하위 레이어(내부 버스 sentinel, NodeOutput interaction, WS wire)는 해당 content 문자열을 파싱해 분기하는 경로가 없음을 코드 전체 확인으로 검증했다. e2e 픽스처의 SQL INSERT 변경은 DB 스키마 현실을 다른 기존 e2e 파일과 동일하게 맞추는 것으로 프로덕션 코드에 영향이 없다. 의도치 않은 전역 상태 변경·파일시스템 부작용·네트워크 호출·이벤트/콜백 변화는 없다. 유일한 주의 항목은 `PRESENTATION_TOOLS_GUIDANCE` 와 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 두 텍스트가 현재는 의미상 일치하지만 별도 문자열로 관리되어 미래 드리프트 위험이 있다는 점이며, 이는 기능 회귀를 유발하지 않는 수준이다.

## 위험도

LOW
