### 발견사항

- **[INFO]** 비신뢰 `outputData` 를 타입 단언(`as Record<string, unknown>`) 없이 직접 접근
  - 위치: `apply-execution-snapshot.ts` — `raw = waitingNode.outputData as Record<string, unknown>` 및 이후 중첩 필드 접근 전체
  - 상세: REST API 응답의 `outputData` 는 백엔드가 통제하는 서버 데이터이며, 클라이언트-서버 경계 밖의 외부 공격자가 직접 조작하기 어렵다. 그러나 `raw.meta`, `raw.config`, `raw.output` 등을 `as Record<string, unknown>` 로 강제 단언한 뒤 각 필드를 다시 `as string | undefined` 로 캐스팅하는 패턴은 런타임 타입 안전성 없이 임의 중첩 구조를 신뢰한다. 서버 응답 스키마가 변경되거나 관리자 API 에서 비정상 데이터가 유입될 경우 예외 없이 `undefined` 로 조용히 실패해 예측하기 어려운 상태가 된다.
  - 제안: `zod` 등 런타임 스키마 검증 라이브러리로 `outputData` 구조를 검증하거나, 최소한 각 필드 접근 전에 `typeof` / `Array.isArray` 가드를 통일하여 오염된 데이터가 store 에 주입되는 경로를 명시적으로 차단한다.

- **[INFO]** `turnDebug.llmCalls[].requestPayload.messages` 가 store 에 노출될 가능성
  - 위치: `apply-execution-snapshot.ts` — `meta.turnDebug` 를 `parseHistoryMessages` 에 전달해 assistant 메시지 `metadata` 에 `model`, `inputTokens`, `outputTokens`, `durationMs` 를 매핑하는 분기; 테스트 코드 `turnDebug` 픽스처에는 `requestPayload: { model: "gpt-4o", messages: [] }` 포함
  - 상세: `turnDebug` 의 `requestPayload` 전체가 store 객체 내부 어딘가에 그대로 보존될 경우, 이 값이 렌더러나 DevTools 를 통해 최종 사용자에게 노출될 수 있다. `requestPayload` 에 시스템 프롬프트, 내부 지시문, 다른 사용자 맥락이 포함되어 있다면 정보 노출이 된다. 현재 코드가 `requestPayload` 필드를 어떻게 처리하는지 `parseHistoryMessages` 내부를 확인할 수 없었으나, 테스트 픽스처에서 해당 필드가 존재한다는 점이 확인된다.
  - 제안: `parseHistoryMessages` 에서 `requestPayload` 를 포함한 전체 LLM 요청/응답 원본을 store 에 저장하지 않고, `model`, `inputTokens`, `outputTokens`, `durationMs` 같은 최소 필드만 명시적으로 추출해 할당한다. 시스템 프롬프트 등 민감 필드는 서버에서 `turnDebug` 응답 직렬화 시점에 제거하는 것이 근본 해결책이다.

- **[INFO]** `interactionType` 문자열을 검증 없이 분기 제어에 사용
  - 위치: `apply-execution-snapshot.ts` — `interactionType` 결정 로직 (`meta?.interactionType as string | undefined`) 및 이후 `if (interactionType === "ai_conversation")` 분기
  - 상세: `interactionType` 은 서버 응답에서 추출된 문자열이다. 코드가 `"ai_conversation"`, `"buttons"`, `"form"` 세 값으로 분기하고 나머지는 무시하므로 직접적인 인젝션 취약점은 없다. 그러나 허용 값 집합을 명시적으로 열거하지 않아 향후 분기가 추가될 때 예상치 못한 값이 통과할 수 있다.
  - 제안: `const ALLOWED_INTERACTION_TYPES = ["ai_conversation", "buttons", "form"] as const` 처럼 허용 집합을 선언하고 추출 직후 검증하는 패턴을 도입한다.

- **[INFO]** 테스트 픽스처에 실제 LLM 모델 식별자 하드코딩
  - 위치: `apply-execution-snapshot.test.ts` — `model: "gpt-4o"`, `model: "gpt-4o-2024-08-06"` 등
  - 상세: 테스트 파일이므로 프로덕션 시크릿에 해당하지 않는다. 그러나 특정 LLM 서비스 모델명을 테스트 코드에 고정하면 모델 명칭 변경 시 테스트가 사실상의 계약 문서 역할을 하여 혼란을 줄 수 있다.
  - 제안: 테스트 픽스처의 모델명을 `"test-model-id"` 같은 중립 값으로 교체해 실제 외부 서비스 식별자가 소스코드에 노출되지 않도록 한다.

### 요약

이번 변경(`apply-execution-snapshot.ts` ai_conversation 분기 hydration 추가 + 단위 테스트 4건)은 프론트엔드 클라이언트 내부 상태 관리 로직에 한정된 버그 수정이다. 인증·인가 우회, SQL/커맨드 인젝션, 하드코딩된 시크릿, 평문 전송, 취약한 암호화 알고리즘 등 고위험 OWASP 카테고리에 해당하는 취약점은 발견되지 않았다. 주요 관찰 사항은 REST/WS 서버 응답의 `outputData` 를 런타임 스키마 검증 없이 다단계 타입 단언으로 접근하는 패턴과, `meta.turnDebug` 의 `requestPayload` 가 store 에 그대로 전파될 경우 내부 LLM 프롬프트 정보가 클라이언트 측에 노출될 수 있다는 점이다. 두 항목 모두 현재 공격 표면이 제한적이나 장기적으로 보강이 권장된다.

### 위험도

LOW
