# 보안(Security) 리뷰 결과

## 발견사항

### 발견사항 없음 (신규 보안 취약점 없음)

이번 변경(03 C-2 리팩토링)은 순수 behavior-preserving 메서드 추출이며, 신규 외부 경계·입력 처리·인증 로직·암호화·의존성은 추가되지 않았다.

---

### [INFO] tool 실행 결과에 tc.arguments 가 그대로 직렬화됨
- 위치: `recordSingleTurnNonProviderToolResults` / `recordMultiTurnNonProviderToolResults` 내 normalContent 생성부
- 상세: `tc.arguments` 는 LLM 이 생성한 tool call 인수이므로 외부에서 주입된 임의 값이 포함될 수 있다. 해당 content 는 tool_result 로 LLM 에 재전달되며, opt-in 시 ConversationThread 에도 push 된다. 본 코드는 리팩토링 전에도 동일하게 존재했으므로 이번 변경으로 새롭게 발생한 취약점이 아니다. 단, 메서드 추출로 해당 패턴이 두 곳에 명시적으로 분리되어 식별이 쉬워졌다.
- 제안: 정상 경로에서 stub normalContent 는 실제 외부 도구 실행 결과가 아닌 placeholder 이고, real provider 결과는 `executeProviderToolBatch`→`runProviderTool` 경로에서 별도 sanitization(`sanitizeToolError`, preview 200자 cap)이 적용되므로 현 구조에서 위험도는 낮다. 다만 `arguments: tc.arguments` 미러링이 향후 실제 실행 결과로 교체될 경우 sanitization 누락의 선례가 될 수 있으므로, 해당 필드를 제거하거나 별도 sanitizer 를 명시할 것을 권고한다.

---

### [INFO] FORM_SUBMITTED_GUIDANCE_MESSAGE 보안 경계 주석 양호 — 유지 확인
- 위치: 파일 전체 컨텍스트 내 `FORM_SUBMITTED_GUIDANCE_MESSAGE` 상수 선언부
- 상세: 코드 주석에 "보안 경계: message 필드는 하드코딩 상수만 허용 (프롬프트 인젝션 회피). 사용자 입력은 data 필드 안에만 전달"이 명시되어 있으며 실제 구현도 이를 준수한다. 이번 리팩토링에서 해당 경계가 훼손되지 않았음을 확인한다.
- 제안: 유지.

---

### [INFO] sanitizeToolError / previewContent 패턴 보존 확인
- 위치: `runProviderTool` 내 예외 처리 경로 (전체 컨텍스트)
- 상세: provider 도구 실패 시 내부 오류 메시지를 `sanitizeToolError` 로 truncate 하여 DB connection string·stack trace 등의 민감 정보가 WS/UI/outputData 로 노출되지 않도록 처리하는 기존 패턴이 이번 리팩토링에서 변경 없이 보존되었다.
- 제안: 유지.

---

### [INFO] state 객체의 타입 안전성 (Record<string, unknown> 캐스팅)
- 위치: `processMultiTurnMessage`, `applyMultiTurnTurnMemory`, `handleMultiTurnUserMessageEntry` 등 state 접근 전반
- 상세: `state.rawConfig as Record<string, unknown> | undefined` 등 다수의 unknown 캐스팅이 존재한다. 이는 기존 코드베이스 전반의 패턴이고 이번 리팩토링에서 새롭게 도입된 것이 아니다. 실행 엔진 내부 state 이므로 외부 직접 조작 경로는 없다.
- 제안: 중장기적으로 Zod 등 런타임 schema 검증을 state 역직렬화 시점에 적용하는 것을 고려한다.

---

## 요약

이번 커밋(ff8c5d68)은 `ai-turn-executor.ts` 의 두 god-method(`processMultiTurnMessage`, `executeSingleTurn`)에서 6개의 private 메서드를 추출하는 순수 구조 리팩토링이다. 신규 외부 입력 경계, 인증/인가 로직, 암호화, 외부 라이브러리 의존성은 전혀 추가되지 않았으며, 기존 보안 경계(sanitizeToolError, previewContent 200자 cap, FORM_SUBMITTED_GUIDANCE_MESSAGE 프롬프트 인젝션 방어, formData 10KB cap)가 모두 원형 그대로 보존된다. INFO 등급의 관찰사항(tc.arguments 미러링, state unknown 캐스팅)은 이번 변경으로 새롭게 발생한 것이 아니라 기존 코드베이스에서 이어진 패턴이다. 신규 보안 취약점은 발견되지 않았다.

## 위험도

NONE
