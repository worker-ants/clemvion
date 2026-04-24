### 발견사항

---

**[WARNING] AnthropicClient: chat()↔stream() 메시지 변환 로직 중복**
- 위치: `anthropic.client.ts` — `chat()` (L28~L64) 및 `stream()` (L182~L218)
- 상세: system 메시지 추출, `messages` 배열 매핑(assistant+toolCalls, tool role), `tool_choice` 빌드(`disable_parallel_tool_use: false` 포함)가 두 메서드에 거의 동일하게 반복됨. DRY 위반이자 향후 API 변경 시 한 쪽만 패치되는 편향 버그 위험.
- 제안: `private buildAnthropicMessages()`, `private buildToolChoice()` 등 private helper로 추출해 두 경로가 공유하도록 리팩토링.

---

**[WARNING] 테스트 전용 진입점이 프로덕션 모듈에서 export됨**
- 위치: `system-prompt.ts` L39~L42 — `export function resetExpressionCacheForTesting()`
- 상세: 테스트 격리를 위한 캐시 리셋 함수가 public API로 노출. 이 패턴은 테스트 관심사가 프로덕션 인터페이스를 오염시키며, 외부 코드가 캐시를 실수로 무효화할 수 있는 위험을 낳음. 또한 `let expressionReferenceCache: string | null = null;` 가 모듈 스코프 뮤터블 상태로 존재해 병렬 테스트 실행 시 상태 누수 가능.
- 제안: 캐시를 클래스 인스턴스 내부로 옮기거나(`SystemPromptBuilder` 클래스), `jest.resetModules()`로 처리 가능하도록 모듈 설계를 조정. 최소한 `@internal` 주석으로 프로덕션 호출 금지를 명시.

---

**[WARNING] 인터페이스 분리 원칙(ISP) 위반 — embed() 항상 reject**
- 위치: `anthropic.client.ts` L164~L170
- 상세: `LLMClient` 인터페이스가 `embed()`를 강제하지만 Anthropic 클라이언트는 항상 `Promise.reject()`를 반환. 임베딩을 지원하지 않는 클라이언트가 임베딩 메서드를 구현해야 하는 ISP 위반. 호출부에서 런타임까지 오류가 지연됨.
- 제안: `LLMClient`를 `ChatLLMClient`와 `EmbeddingLLMClient`로 분리하거나, `embed?: () => Promise<number[][]>` optional 메서드로 선언하고 호출부에서 지원 여부 체크.

---

**[WARNING] system-prompt.ts: 파일 크기 및 다중 책임**
- 위치: `system-prompt.ts` 전체
- 상세: 단일 파일이 (1) 프롬프트 조립 로직, (2) 텍스트 sanitization 유틸리티, (3) expression 레퍼런스 캐싱 인프라, (4) 레이아웃 계산 상수(`LAYOUT_FALLBACK_WIDTH` 등), (5) 수백 줄의 정적 프롬프트 문자열 콘텐츠를 모두 담고 있음. 변경 이유가 5가지 이상 → SRP 위반.
- 제안: 정적 프롬프트 블록을 별도 `.ts` 파일(혹은 tagged template)로 분리; sanitize 함수를 `prompt-sanitize.util.ts`로 추출; 레이아웃 상수를 `layout.constants.ts`로 이동.

---

**[WARNING] 레이어 경계 누수 — UI 관심사가 인프라 레이어에 침투**
- 위치: `anthropic.client.ts` L176 (`MAX_MODELS = 100`, 주석 "UI 드롭다운 용도"), `system-prompt.ts` L16~L20 (레이아웃 px 상수)
- 상세: `MAX_MODELS`는 프레젠테이션 레이어의 드롭다운 제한이 LLM 클라이언트(인프라 레이어)에 하드코딩된 것. `system-prompt.ts`의 픽셀 단위 레이아웃 상수는 캔버스 렌더링 관심사가 프롬프트 빌더에 내재화된 것.
- 제안: `MAX_MODELS`는 `listModels` 호출부(서비스 레이어)가 파라미터로 제공; 레이아웃 상수는 외부 설정 혹은 캔버스 도메인 상수로 이동하고 `buildSystemPrompt()`가 파라미터로 수신.

---

**[INFO] 타입 시스템 우회 — `as never` 사용**
- 위치: `anthropic.client.ts` L79, L245 — `({ type: 'none' } as never)`
- 상세: `toolChoice === 'none'` 분기에서 SDK 타입 불일치를 `as never`로 억제. 타입 시스템이 잡아야 할 오류를 런타임까지 숨김.
- 제안: Anthropic SDK 타입을 확인 후 정확한 캐스트(`as Anthropic.ToolChoiceNone`)로 교체하거나, 분기 구조를 SDK 타입에 맞게 재작성.

---

**[INFO] 오류 감지를 문자열 포함 검사로 수행**
- 위치: `anthropic.client.ts` L257, L298 — `message.includes('429')`
- 상세: HTTP 상태 코드를 에러 메시지 문자열에서 추출. SDK가 구조화된 에러 타입을 제공한다면 타입 기반 체크가 더 안전.
- 제안: `error instanceof Anthropic.RateLimitError` 등 SDK 에러 클래스 활용 검토.

---

**[INFO] tool-definitions.ts: OCP 관점에서 확장 비용**
- 위치: `tool-definitions.ts` L20~L30 — `TOOL_KIND_BY_NAME` 하드코딩
- 상세: 새로운 도구 추가 시 `buildAssistantToolsInternal()` 배열과 `TOOL_KIND_BY_NAME` 레코드를 동시에 수정해야 하는 이중 수정 지점. 둘이 불일치하면 런타임에만 발견됨.
- 제안: 각 도구 정의 객체에 `kind` 필드를 포함시키고 `TOOL_KIND_BY_NAME`을 빌드 시 자동 도출하는 방식으로 단일 진실 원천(Single Source of Truth) 확보.

---

### 요약

전반적인 아키텍처는 LLM 클라이언트 어댑터 패턴, 도구 정의 분리, 프롬프트 빌더 분리 등 합리적인 구조를 취하고 있다. 그러나 세 가지 반복 패턴이 유지보수 부채로 누적될 위험이 있다: (1) `AnthropicClient`의 스트리밍/논스트리밍 경로 간 메시지 변환 코드 중복, (2) `system-prompt.ts`의 다중 책임 누적(콘텐츠·유틸·캐시·레이아웃이 한 파일에 혼재), (3) 테스트 전용 함수 export와 UI/레이아웃 상수의 레이어 누수. 이 중 코드 중복은 Anthropic API 변경 시 편향 버그로 이어질 가능성이 가장 높으며, 파일 크기와 책임 집중은 향후 프롬프트 개정 빈도가 높아질수록 충돌 및 회귀 위험을 증가시킨다.

### 위험도

**LOW**