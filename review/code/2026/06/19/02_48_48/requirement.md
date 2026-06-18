# 요구사항(Requirement) 리뷰 결과

리뷰 대상: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts`
변경 유형: 테스트 추가 (미등록 explicit code passthrough 가드 2건)

---

## 발견사항

### [INFO] 기능 완전성 — 두 변경 모두 의도한 동작을 올바르게 검증

**변경 1** (기존 테스트 "details 필드를 포함한 오류를 처리한다"에 `expect(result.code).toBe('LLM_API_ERROR')` 추가):

- 위치: diff 블록 1 (`+expect(result.code).toBe('LLM_API_ERROR');`)
- 에러 객체는 `code: 'LLM_API_ERROR'`, `details: { retryAfter: 60, status: 429 }`를 가진다.
- `extractHttpStatus`는 에러 최상위의 `.status` / `.statusCode` / `.response.status`를 읽는다. 이 에러는 최상위 `.status` 없이 `details.status: 429`만 있으므로 `extractHttpStatus`는 `undefined` 반환.
- `classifyLlmError(undefined, 'LLM_API_ERROR', 'API error')`: is429=false, isAuth=false, is5xx=false, isNetwork=false → explicit code passthrough 분기 → `{ code: 'LLM_API_ERROR', retryable: false }`.
- 따라서 `result.code === 'LLM_API_ERROR'` 어서션은 구현과 정확히 일치하며 올바르다.

**변경 2** (신규 테스트 "미등록 explicit code 는 정규화 시 그대로 passthrough"):

- 위치: diff 블록 2 (새 `it(...)` 블록)
- `code: 'LLM_PROVIDER_QUOTA'`, 메시지 `'vendor quota exhausted'` — is429·isAuth·is5xx·isNetwork 분기 모두 불통.
- explicit code 분기 (`typeof explicitCode === 'string' && explicitCode.length > 0`) 에 진입 → `{ code: 'LLM_PROVIDER_QUOTA', retryable: false }`.
- `expect(result.code).toBe('LLM_PROVIDER_QUOTA')` 및 `expect(retryable).toBe(false)` 어서션 모두 구현과 일치.

### [INFO] 엣지 케이스 — `details.status=429`가 rate limit 승격을 유발하지 않음을 명시적으로 테스트

- 위치: diff 블록 1 주석 (L479-482)
- `extractHttpStatus`는 오직 에러 최상위 `.status`만 읽으므로 `details.status=429`는 is429 판별에 영향 없음. 이는 구현 코드(L1021-1027)와 정확히 일치.
- 이 경계값 케이스가 이전에 명시적 어서션 없이 암묵적으로만 통과되던 동작을 명시 가드로 고정한 것은 적절한 보강이다.

### [INFO] spec fidelity — 구현 passthrough 동작과 spec §10 L1099 일치

- 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §10 L1099
- Spec L1099: "명시 code(`LLM_RESPONSE_INVALID` 등)→보존(non-retryable)"
- 구현(`ai-turn-orchestrator.service.ts` L1073-1074): `if (typeof explicitCode === 'string' && explicitCode.length > 0) { return { code: explicitCode, retryable: false }; }`
- 테스트가 참조하는 "passthrough" 동작은 spec 명시된 "보존(non-retryable)" 규칙의 정확한 구현이다.
- `LLM_API_ERROR`와 `LLM_PROVIDER_QUOTA`는 spec §10 표에 등재된 코드가 아니지만, spec L1099의 "등" 표현이 미등록 explicit code도 동일 passthrough 규칙을 따름을 함의한다. 구현도 코드 문자열을 whitelist 검사 없이 그대로 통과시키므로 spec 의도와 부합한다.

### [INFO] TODO/FIXME — 없음

변경된 코드 전체에서 TODO, FIXME, HACK, XXX 주석 미발견.

### [INFO] 의도와 구현 간 괴리 — 없음

- 테스트 설명("미등록 explicit code 는 정규화 시 그대로 passthrough")이 실제 검증 내용(classifyLlmError의 explicit code 분기 통과)과 일치한다.
- 변경 1의 주석("status/network/429/auth 분기에 안 걸리면 classifyLlmError 가 그대로 보존")이 구현 분기 로직(L1064-1078)을 정확히 설명한다.

### [INFO] 반환값 — 모든 어서션 경로에서 적절한 값 검증

- 변경 1: `result.code`, `result.details`(retryAfter, status, retryable) 모두 명시 검증.
- 변경 2: `result.code`, `result.details.retryable` 검증. `result.message`는 직접 검증하지 않으나 이 테스트의 목적(code passthrough + retryable 분류)에 한정된 것으로 허용 범위.

---

## 요약

이번 변경은 `extractAiTurnErrorPayload`의 "미등록 explicit code passthrough" 동작을 명시 테스트로 고정하는 순수 테스트 보강이다. 변경 1은 기존 테스트에 `result.code` 어서션을 추가해 `details.status=429`가 rate limit 승격을 유발하지 않는 경계값을 명시 가드로 확보했고, 변경 2는 `LLM_PROVIDER_QUOTA`와 같은 미등록 코드도 classifyLlmError의 explicit code 보존 분기로 처리됨을 독립 테스트로 검증한다. 두 변경 모두 `spec/4-nodes/3-ai/1-ai-agent.md §10 L1099`("명시 code→보존·non-retryable")와 구현(`ai-turn-orchestrator.service.ts` L1073-1074)에 line-level로 일치한다. 기능 누락, spec 불일치, 엣지 케이스 미처리, 비즈니스 로직 오류는 발견되지 않았다.

## 위험도

NONE
