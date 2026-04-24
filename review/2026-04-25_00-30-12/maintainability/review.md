### 발견사항

---

**[WARNING] `anthropic.client.ts`: 메시지 변환 로직 완전 중복**
- 위치: `chat()` 내 `messages` 매핑 (~L28–56), `stream()` 내 동일 매핑 (~L201–230)
- 상세: `assistant+toolCalls` 조합 및 `tool` 역할 변환 로직이 두 메서드에서 약 25줄 그대로 복사되어 있음. 변경 시 두 곳을 동시에 수정해야 하며, 한 쪽만 수정될 경우 런타임 불일치 버그 발생.
- 제안: `private buildMessages(params: ChatParams): Anthropic.MessageParam[]` 헬퍼로 추출하여 두 메서드에서 공유.

---

**[WARNING] `anthropic.client.ts`: `toolChoice` 구성 로직 중복**
- 위치: `chat()` (~L70–82), `stream()` (~L240–252)
- 상세: `toolChoice === 'required'`/`'none'`/`auto` 분기 및 `disable_parallel_tool_use: false` 주입이 두 메서드에서 동일하게 반복됨.
- 제안: `private buildToolChoice(toolChoice?: string): Anthropic.ToolChoiceParam | undefined` 로 추출.

---

**[WARNING] `anthropic.client.ts`: `stream()` 메서드 길이 및 중첩 복잡도**
- 위치: `stream()` 전체 (~130줄, 3단 중첩 try-catch + for-await)
- 상세: 스트림 초기화 에러 처리, 이벤트 루프, 블록 상태 관리, finish 이벤트 조합이 한 함수에 혼재. 순환 복잡도가 높아 단위 테스트 작성 및 수정 시 영향 범위 파악이 어려움.
- 제안: 이벤트 디스패치(`handleStreamEvent`) 로직을 별도 메서드로 분리하면 주 루프가 간결해짐.

---

**[WARNING] `anthropic.client.ts`: 에러 코드 탐지 방식이 취약**
- 위치: `stream()` 내 두 곳, `message.includes('429')`
- 상세: HTTP 상태 코드를 에러 메시지 문자열에서 서브스트링 검색으로 판별하는 방식은 메시지 포맷 변경에 취약. Anthropic SDK는 구조화된 에러 타입(`APIError`)을 제공함.
- 제안: `error instanceof Anthropic.APIError && error.status === 429` 로 교체.

---

**[WARNING] `tool-definitions.ts`: `planStepId`/`planStepIds` 스키마 반복**
- 위치: `add_node`, `update_node`, `remove_node`, `add_edge`, `remove_edge` 정의 (~5회 반복)
- 상세: 동일한 두 필드의 JSON Schema 정의가 각 편집 도구마다 복사되어 있음. 설명 문구까지 포함하면 약 7줄 × 5 = 35줄의 중복.
- 제안:
  ```ts
  const planStepFields = {
    planStepId: { type: 'string' },
    planStepIds: { type: 'array', items: { type: 'string' }, description: '...' },
  } as const;
  ```
  각 도구 `properties`에 스프레드로 삽입.

---

**[WARNING] `system-prompt.ts`: `sanitizeUserText`와 `sanitizeLabel` 책임 구분 불명확**
- 위치: `sanitizeUserText()`, `sanitizeLabel()`
- 상세: 두 함수가 거의 동일한 치환 작업을 수행하면서 `sanitizeUserText`에만 마크다운 헤더 중화 및 따옴표 정규화가 추가되어 있음. 이 차이가 함수 이름에서 드러나지 않아 호출 지점에서 올바른 함수 선택이 불명확함.
- 제안: `sanitize(s, maxLen, options: { stripMarkdownHeaders?: boolean })` 단일 함수로 통합하거나, 차이를 주석으로 명시적으로 기록.

---

**[INFO] `anthropic.client.ts`: 매직 넘버 `4096`**
- 위치: `chat()` L64, `stream()` L234
- 상세: 기본 `max_tokens` 값이 두 곳에 하드코딩됨. 변경 시 누락 가능성 존재.
- 제안: 클래스 상단에 `private static readonly DEFAULT_MAX_TOKENS = 4096` 상수 선언.

---

**[INFO] `anthropic.client.ts`: `({ type: 'none' } as never)` 타입 강제 캐스팅 무문서화**
- 위치: `chat()` L74, `stream()` L245
- 상세: SDK 타입 시스템 우회인데 이유가 인라인 주석 없이 처리되어 있음. 이후 SDK 업그레이드 시 조용히 타입 오류가 숨겨질 수 있음.
- 제안: `// SDK의 'none' 타입은 non-streaming 전용이라 타입 정의에서 누락됨` 한 줄 주석 추가.

---

**[INFO] `system-prompt.ts`: 거대한 단일 파일**
- 위치: 파일 전체
- 상세: 정적 프롬프트 블록 3개가 파일 내 인라인 상수로 존재하여 파일 길이가 수백 줄에 달함. 프롬프트 내용 수정과 TypeScript 로직 수정이 같은 파일에서 발생해 git diff 가독성이 낮음.
- 제안: 즉각 리팩토링은 불필요하나, 블록별로 `prompts/blocks/` 하위 파일로 분리하면 변경 이력 추적이 용이해짐.

---

**[INFO] `system-prompt.spec.ts`: `activePlan` 픽스처 중복 정의**
- 위치: 외부 describe 스코프 (~L122) 및 `5-block structural layout` 내부 describe (~L280)
- 상세: 이름이 동일한 `activePlan` 상수가 서로 다른 중첩 스코프에 정의되어 있어, 내부 describe의 테스트가 어느 픽스처를 사용하는지 혼동 가능.
- 제안: 내부 describe의 변수명을 `layoutTestPlan` 등으로 구분.

---

### 요약

코드 전반의 구조와 네이밍은 우수하며, 상수 분리(`LAYOUT_*`)·캐싱 패턴(`expressionReferenceCache`)·도구 종류 분류표(`TOOL_KIND_BY_NAME`) 등 유지보수를 고려한 설계가 곳곳에 보인다. 핵심 문제는 `anthropic.client.ts`의 `chat()`과 `stream()` 간 메시지 변환 및 `toolChoice` 구성 로직의 완전한 중복으로, 어느 한 쪽만 수정될 경우 동작 불일치가 생길 위험이 실질적이다. `tool-definitions.ts`의 `planStepId/planStepIds` 반복과 `system-prompt.ts`의 sanitize 함수 책임 모호함은 낮은 우선순위지만 중장기 수정 비용을 높인다. 전체적으로 유지보수성 수준은 양호하나, 클라이언트 레이어의 중복 코드 해소가 가장 즉각적인 ROI를 가져다준다.

### 위험도

**MEDIUM**