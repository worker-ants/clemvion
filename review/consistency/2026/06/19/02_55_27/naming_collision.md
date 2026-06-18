# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md` (scope)
실제 변경 파일: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts`
diff-base: `origin/main`

---

## 발견사항

### 발견사항 1

- **[INFO]** `LLM_API_ERROR` — 테스트 픽스처 코드로만 존재, spec 표에 미등록
  - target 신규 식별자: `LLM_API_ERROR` (test 픽스처 `err.code` 값으로 주입, `expect(result.code).toBe('LLM_API_ERROR')` 로 검증)
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md §10` (L1083–L1092) 에 정의된 공식 LLM 에러 코드 표는 `LLM_CALL_FAILED` / `LLM_RATE_LIMIT` / `LLM_RESPONSE_INVALID` / `TOOL_EXECUTION_FAILED` / `MAX_TOOL_CALLS_EXCEEDED` 만 열거하며 `LLM_API_ERROR` 는 없다. 소스 파일(`ai-turn-orchestrator.service.ts`)에도 이 코드는 존재하지 않는다.
  - 상세: `LLM_API_ERROR` 는 §10 L1099 의 "명시 code 보존(passthrough)" 분기를 검증하기 위한 픽스처 임의 코드다. spec 표에 등재된 공식 코드와 이름이 겹치지 않으므로 의미 충돌은 없다. 다만 코드 이름이 `LLM_CALL_FAILED` 와 유사해(LLM + API/CALL + FAILED/ERROR), 읽는 사람이 "spec 등록 코드인가?" 라고 혼동할 여지가 있다.
  - 제안: 혼동 가능성을 낮추려면 픽스처 코드를 `SOME_VENDOR_CUSTOM_CODE` 등 spec 표와 겹칠 가능성이 없는 임의 문자열로 교체하는 것이 명확하다. 단, 현 상태에서 실제 런타임 충돌은 없다 — `classifyLlmError` 의 passthrough 분기는 등록 여부와 무관하게 코드를 그대로 보존하므로 `LLM_API_ERROR` 도 의도대로 통과한다. 테스트 목적 픽스처이므로 강제 변경 불요.

### 발견사항 2

- **[INFO]** `LLM_PROVIDER_QUOTA` — 테스트 픽스처 코드로만 존재, spec 표에 미등록
  - target 신규 식별자: `LLM_PROVIDER_QUOTA` (신규 테스트 케이스 픽스처 `err.code` 값)
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md §10` LLM 에러 코드 표 및 `spec/conventions/error-codes.md` 에 `LLM_PROVIDER_QUOTA` 이름으로 정의된 코드는 없다. 소스 파일 전체(`codebase/**/*.ts`, dist 제외)에서 테스트 파일 이외 어디에도 이 문자열이 존재하지 않는다.
  - 상세: `LLM_PROVIDER_QUOTA` 는 §10 L1099 passthrough 분기("미등록 explicit code 는 code 그대로 보존, retryable=false")를 검증하기 위한 가상의 vendor 에러 코드 예시다. spec 표에 미등재이므로 기존 식별자와 의미 충돌 없다.
  - 제안: 충돌 없음. 픽스처로서의 선택은 적절하다 — "spec 표에 없는 벤더 임의 코드" 를 명시적으로 표현하는 이름이라 테스트 의도가 명확하다.

---

## 요약

이번 diff 는 테스트 파일(`ai-turn-orchestrator.service.spec.ts`)에만 변경이 있고, spec 파일 본체 변경은 없다. 새로 사용된 코드 문자열 `LLM_API_ERROR` 와 `LLM_PROVIDER_QUOTA` 는 모두 테스트 픽스처 목적의 임의 vendor 에러 코드로, spec §10(`spec/4-nodes/3-ai/1-ai-agent.md`) 의 공식 LLM 에러 코드 표(`LLM_CALL_FAILED` / `LLM_RATE_LIMIT` / `LLM_RESPONSE_INVALID` 등)와 의미·표기 충돌이 없다. `LLM_API_ERROR` 는 `LLM_CALL_FAILED` 와 이름이 다소 유사하여 혼동 여지가 있으나 실제 소스 코드나 spec 표에 동일 이름이 사용된 사례가 없어 충돌로 판단하지 않는다. API endpoint, 이벤트명, 환경변수, 파일 경로, 요구사항 ID, 엔티티명 관점의 신규 식별자 도입은 없다.

## 위험도

NONE
