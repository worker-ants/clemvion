# 보안(Security) 리뷰 결과

**대상 커밋**: bf91ebfff2b61a7ecb9981447c1b5a73327f3094
**리팩토링 유형**: behavior-preserving 내부 메서드 분해 (executeSingleTurn god-method 분해)

---

## 발견사항

### [INFO] 프롬프트 인젝션 경계 — 기존 설계 유지 확인
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`, `buildSingleTurnSystemPrompt`, `buildSingleTurnMessages`
- **상세**: 추출된 `buildSingleTurnSystemPrompt` 는 `systemPrompt`(config 유래, 템플릿 엔진이 이미 해결한 값) 를 그대로 `finalSystemPrompt` 에 연결한다. 이 변경 자체는 기존 동작을 보존한다. 코드 내에 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 주석에 "**보안 경계**: `message` 필드는 하드코딩 상수만 허용 (프롬프트 인젝션 회피)" 이 명시되어 있으며, 이번 리팩토링은 해당 경계를 변경하지 않는다.
- **제안**: 현 상태 유지. 추후 `buildSingleTurnSystemPrompt` 에 동적 사용자 입력이 직접 삽입되는 경우 별도 sanitization 레이어 추가 필요.

### [INFO] 에러 메시지 새니타이징 — 기존 로직 이관 없음
- **위치**: `sanitizeToolError` 함수 (변경 없음), `runProviderTool` (변경 없음)
- **상세**: 이번 diff 는 `sanitizeToolError` 함수나 에러 처리 경로를 건드리지 않았다. 기존의 "서버 측 원본 스택 로그, 클라이언트/LLM 에는 sanitized 요약만 노출" 패턴이 그대로 유지된다.
- **제안**: 현 상태 유지.

### [INFO] formData byte cap — 변경 없음
- **위치**: `capFormDataBytes`, `FORM_SUBMITTED_MAX_BYTES` (변경 없음)
- **상세**: `render_form` submit 시 LLM context 에 직렬화되는 formData 를 10KB 로 cap 하는 로직은 이번 리팩토링 범위 밖이며 수정되지 않았다. token-bomb 방어가 유지된다.
- **제안**: 현 상태 유지.

### [INFO] tool_result content 미리보기 제한 — 변경 없음
- **위치**: `TOOL_RESULT_PREVIEW_CHARS = 200`, `previewContent` (변경 없음)
- **상세**: WebSocket 이벤트로 내보내는 `tool_call_completed` payload 의 content preview 를 200자로 제한하는 로직이 그대로 유지된다. KB chunk 등 민감 데이터의 수동 WS 구독자 노출이 제한된다.
- **제안**: 현 상태 유지.

---

## 요약

이번 변경은 `AiTurnExecutor.executeSingleTurn` (~545줄) god-method 의 setup 단계를 behavior-preserving 으로 `buildSingleTurnSystemPrompt` / `buildSingleTurnMessages` / `applySingleTurnMemoryInjection` 세 private 메서드로 분해한 순수 리팩토링이다. 보안 관점에서 새로운 인젝션 경로, 하드코딩된 시크릿, 인증/인가 변경, 입력 검증 우회, 암호화 알고리즘 변경, 에러 메시지 노출 확대, 취약 의존성 도입 등 어떤 취약점도 도입되지 않았다. 기존에 코드 내 명시된 프롬프트 인젝션 경계(`FORM_SUBMITTED_GUIDANCE_MESSAGE`의 보안 경계 주석), `sanitizeToolError` 에러 마스킹, formData byte cap, tool_result preview 제한이 모두 그대로 보존된다. 분해 후에도 외부 public 시그니처 및 tool-loop 흐름이 불변이므로 인증/인가 우회나 상태 전이 변조 위험도 없다.

---

## 위험도

NONE
