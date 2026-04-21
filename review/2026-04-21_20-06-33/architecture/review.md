### 발견사항

- **[INFO]** `buildChatInputs` / `startChatSession` helper 추출 — 좋은 DRY 적용
  - 위치: `google.client.ts` L88–131
  - 상세: `chat()`과 `stream()`이 공유하는 메시지 변환 로직이 private helper로 분리되어 단일 책임 원칙이 개선됨. `startChatSession`도 별도 메서드로 분리되어 응집도 향상.
  - 제안: 현행 유지.

- **[WARNING]** `classifyStreamError`의 에러 분류 로직이 지나치게 단순
  - 위치: `google.client.ts` L51–53
  - 상세: HTTP 429 여부를 문자열 포함 여부로 감지하는 것은 취약함. Google SDK가 에러 메시지 형식을 변경하면 분류가 깨짐. Anthropic/OpenAI 클라이언트가 동일한 패턴을 사용하는지 확인 필요.
  - 제안: 에러 분류를 `LLMClient` 인터페이스 혹은 공통 유틸(`llm/utils/classify-error.ts`)로 끌어올려 모든 provider가 동일 규칙을 공유하도록 한다. 또는 SDK의 에러 타입(status code 등)을 직접 검사.

- **[WARNING]** `stream()` 내 tool call ID 생성이 `chat()`과 중복
  - 위치: `google.client.ts` L237 vs L164
  - 상세: `call_${Date.now()}_${random}` 패턴이 두 메서드에 각각 인라인으로 존재. 동일한 ID 포맷이 두 곳에 복사되어 있어 포맷 변경 시 양쪽을 수정해야 함.
  - 제안: `generateToolCallId()` 같은 private 또는 모듈 수준 유틸로 추출.

- **[INFO]** `mapGoogleFinishReason` 모듈 수준 순수 함수로 분리 — 긍정적
  - 위치: `google.client.ts` L27–50
  - 상세: provider-specific 변환 로직이 클래스 외부 순수 함수로 있어 테스트 용이성이 높음. 동일 패턴이 다른 provider에도 적용되면 일관성 확보됨.

- **[WARNING]** `asString` helper가 파일 내 private 유틸로 중복 선언 가능성
  - 위치: `workflow-assistant-stream.service.ts` L519–524
  - 상세: `asString`은 LLM args의 unknown 타입 안전 접근을 위한 범용 유틸인데, 지금은 이 서비스 파일에만 존재함. 다른 tool handler나 서비스가 같은 패턴이 필요할 때 복사될 위험이 있음.
  - 제안: `src/common/utils/type-guards.ts` 같은 공유 유틸 모듈로 이동. 다만 현재는 이 파일 하나에서만 쓰이므로 당장 필수는 아님 — 두 번째 사용 시점에 추출.

- **[INFO]** `safeParse`의 Array guard 추가 — 정확한 타입 좁히기
  - 위치: `workflow-assistant-stream.service.ts` L508–514
  - 상세: 기존 `typeof parsed === 'object'`는 배열도 통과시켜 `Record<string, unknown>`으로 잘못 취급될 수 있었음. `!Array.isArray` 조건 추가로 방어됨.

- **[INFO]** `LlmConfig` 타입 명시 (`let llmConfig: LlmConfig`)
  - 위치: `workflow-assistant-stream.service.ts` L104
  - 상세: 명시적 타입 선언으로 try/catch 블록 이후 타입 안전성 확보. `any` 추론 위험 제거.

- **[INFO]** `redactConfig`의 `(value as unknown[])` 캐스팅 — strict 모드 호환성 개선
  - 위치: `redact.ts` L16
  - 상세: `Array.isArray` 가드 이후에도 `value.map`의 타입이 `T & unknown[]`으로 추론되어 발생하던 TS 컴파일 경고를 `unknown[]`으로 명시 캐스팅하여 해소. 기능 변경 없음.

- **[WARNING]** `stream()`의 상태 변수 누적 스타일 — 재진입 안전성 없음
  - 위치: `google.client.ts` L205–213
  - 상세: `inputTokens`, `outputTokens` 등이 루프 외부에서 선언되어 chunk마다 **덮어쓰기**됨(last-write wins). 이는 Gemini API가 누적 카운트를 마지막 청크에만 실어 보내는 특성에 의존하는 구조임. 이 가정이 깨지면 토큰 계수가 틀어짐.
  - 제안: 주석에 "Gemini API는 usage를 마지막 청크에 누적값으로 전달한다"는 가정을 명시하거나, 최대값 취득(`Math.max`) 방어 코드 추가.

---

### 요약

이번 변경은 전반적으로 아키텍처 품질을 개선하는 방향이다. `GoogleClient`에서 `buildChatInputs` / `startChatSession` 추출은 코드 재사용성과 단일 책임을 높이며, `stream()` 구현이 `chat()`과 동일한 변환 규칙을 공유하게 되어 provider 계층의 응집도가 향상되었다. `safeParse`의 배열 guard와 `asString` helper 추가는 외부 LLM 응답의 unknown 타입을 서비스 레이어에서 안전하게 좁히는 올바른 접근이다. 주요 아키텍처 우려는 세 가지다: (1) 에러 분류 로직이 provider 클라이언트 내부에 분산되어 공통 추상화 부재, (2) tool call ID 생성 패턴 중복, (3) Gemini 스트림 usage 누적이 "마지막 청크에 전체값" 가정에 암묵적으로 의존한다는 점. 이 세 항목은 기술적 부채로 남지만 현행 운영에 즉각적 위험은 없다.

### 위험도

**LOW**