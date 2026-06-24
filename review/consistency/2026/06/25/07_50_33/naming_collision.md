# 신규 식별자 충돌 검토 — C-2 후속 W7 SPEC-DRIFT 해소

검토 모드: `--impl-prep`
대상: `recordMultiTurnNonProviderToolResults` condition deferral `toolCallCount++` 제거 + `executeProviderToolBatch` 인라인 `'tool_call_budget_exceeded'` → `TOOL_BUDGET_EXCEEDED_ERROR` 상수 + JSDoc §3.f-g 표기 정정 + condition-route `Date.now` 이중호출 단일캡처

---

## 발견사항

- **[INFO]** `TOOL_BUDGET_EXCEEDED_ERROR` 신규 상수 — `MAX_TOOL_CALLS_EXCEEDED` 예약 에러 코드와 유사명 공존
  - target 신규 식별자: `TOOL_BUDGET_EXCEEDED_ERROR` (module-level TypeScript 상수, `ai-turn-executor.ts` 내부)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` 1101행 — `MAX_TOOL_CALLS_EXCEEDED` 는 예약된 공개 에러코드로 "maxToolCalls 초과 강제 종결 결정" 시 사용될 코드명. 동일 spec §6.1.g 에서 `tool_call_budget_exceeded` 는 LLM 에 회신하는 tool_result payload 내 error 키 값이다 (`{ error: 'tool_call_budget_exceeded' }`).
  - 상세: `TOOL_BUDGET_EXCEEDED_ERROR` 신규 상수는 인라인 리터럴 `'tool_call_budget_exceeded'`를 래핑하는 코드 내부 상수이며 공개 에러코드 체계(`ErrorCode` enum, `spec/conventions/error-codes.md`)와 무관하다. `MAX_TOOL_CALLS_EXCEEDED`(예약 spec 에러코드) 와 이름은 유사하나 레이어가 다르다 — spec 에러코드는 `output.error.code` 봉투 값이고, 신규 상수는 LLM tool_result body 안의 JSON 키 값이다. 실제 충돌(동일 네임스페이스에서 다른 의미로 사용)은 아니다.
  - 제안: 상수명은 수용 가능하다. 모듈 상단 주석 또는 JSDoc 에 "LLM tool_result payload 내 error 값 — 공개 에러코드 `MAX_TOOL_CALLS_EXCEEDED` 와 별개" 를 한 줄 명시하면 향후 독자의 혼동을 예방한다. spec 변경 불요.

---

## 나머지 점검 항목 결과

1. **요구사항 ID 충돌**: 해당 없음. target 은 신규 요구사항 ID 를 부여하지 않는다 (spec 변경 없는 버그픽스).

2. **엔티티/타입명 충돌**: 해당 없음. 신규 인터페이스·DTO·엔티티 도입 없음. `TOOL_BUDGET_EXCEEDED_ERROR` 는 상수(string literal alias)이며 TypeScript 타입명이 아니다.

3. **API endpoint 충돌**: 해당 없음. 신규 endpoint 없음.

4. **이벤트/메시지명 충돌**: 해당 없음. `tool_call_budget_exceeded` 는 기존 spec §6.1.g 및 `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` 159행에 이미 정의된 LLM tool_result 내부 JSON 값이다. 신규 이벤트명이 아니며 인라인 리터럴을 상수로 추출하는 것이므로 값 자체는 불변.

5. **환경변수·설정키 충돌**: 해당 없음. 신규 ENV var 또는 config key 없음.

6. **파일 경로 충돌**: 해당 없음. 신규 파일 미생성 (기존 `ai-turn-executor.ts` 내 코드 수정만).

---

## 요약

C-2 후속 W7 구현은 코드 내부 버그픽스 범주이며 외부 식별자(spec ID, 엔티티명, endpoint, 이벤트명, ENV var, 파일경로)를 신규 도입하지 않는다. 유일한 신규 코드 레벨 식별자는 `TOOL_BUDGET_EXCEEDED_ERROR` 상수로, 이는 기존 인라인 리터럴 `'tool_call_budget_exceeded'`(spec §6.1.g 에서 이미 정의된 LLM 메시지 페이로드 값)를 추출한 것이다. `MAX_TOOL_CALLS_EXCEEDED`(예약 공개 에러코드)와 이름 유사성이 있으나 네임스페이스(LLM payload 값 vs. 실행 에러코드 봉투)가 다르며 실질적 충돌이 아니다.

## 위험도

NONE
