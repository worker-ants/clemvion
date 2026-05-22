# 유지보수성(Maintainability) 리뷰 결과

**대상 커밋 범위**: `406d9327~1..2851638b` (feat: AI Agent `render_*` presentation tool family)
**검토 일시**: 2026-05-22
**검토 파일 수**: 22개

---

## 발견사항

### [WARNING] `pushAiThreadTurn` 시그니처에 빈 `undefined` 인자 반복 등장
- **위치**: `ai-agent.handler.ts` — `pushAiThreadTurn(...)` 호출 4곳 (single-turn condition route, single-turn final, multi-turn condition route, multi-turn final)
- **상세**: `presentations` 파라미터가 5번째 자리에 추가되면서, 기존 `toolCalls` 자리(4번째)에 매번 `undefined`를 명시적으로 전달하는 패턴이 4곳에 중복된다.
  ```ts
  this.pushAiThreadTurn(context, nodeRef, 'ai_assistant', finalText,
    undefined,                                           // toolCalls
    presentationPayloads.length > 0 ? presentationPayloads : undefined,
  );
  ```
  인자가 명명되지 않기 때문에 4번째 인자가 `toolCalls`인지 아닌지 읽을 때마다 시그니처를 확인해야 한다. 파라미터가 더 늘어나면 읽기 난이도가 기하급수적으로 증가한다.
- **제안**: `pushAiThreadTurn`의 3~5번째 파라미터를 옵션 객체(`options?: { toolCalls?, presentations? }`)로 묶는 리팩터링. 단기적으로는 named 구조체를 도입하지 않더라도, 최소한 내부 선행 주석으로 `// toolCalls=undefined, presentations=…` 형태를 통일하면 파악 비용이 줄어든다.

---

### [WARNING] `presentationCalls` / `presentationSchemaViolations` 인라인 타입이 3곳에 중복 정의
- **위치**: `ai-agent.handler.ts` — 싱글턴·멀티턴 local accumulator 선언(2곳) + `buildMetaForTurn` 파라미터 타입(1곳)
- **상세**: 아래 인라인 타입이 파일 내 3번 반복된다.
  ```ts
  Array<{
    toolName: string;
    toolCallId: string;
    status: 'rendered' | 'schema_violation' | 'dropped' | 'form_pending';
    bytes?: number;
  }>
  ```
  `presentationSchemaViolations`의 인라인 타입도 마찬가지로 3번 반복된다. `AgentToolResult` 인터페이스의 `presentationCall` 필드에도 동일 형태가 존재한다(`agent-tool-provider.interface.ts`).
- **제안**: `agent-tool-provider.interface.ts` 또는 `render-tool-provider.ts`에 `PresentationCallTrace`와 `PresentationSchemaViolation` 타입을 export하고 모든 사용처에서 참조하도록 통일. 현재 status 리터럴 집합이 바뀔 경우 3곳을 일일이 수정해야 한다.

---

### [WARNING] `applyOneMbCap` 함수 내 carousel·table 분기 코드가 구조적으로 중복
- **위치**: `render-tool-provider.ts` 라인 158-211
- **상세**: carousel(`items` 배열)과 table(`rows` 배열)에 대한 tail-truncate 로직이 완전히 동일한 루프 구조를 공유하면서 프로퍼티 이름(`items` vs `rows`)만 다르다. 추후 `template`이나 다른 배열형 타입이 추가될 경우 세 번째 복사본이 생긴다.
- **제안**: 배열 프로퍼티 이름을 파라미터로 받는 내부 헬퍼를 추출한다.
  ```ts
  function tailTruncateArray(
    payload: Record<string, unknown>,
    key: 'items' | 'rows',
    truncationFlag: 'itemsTruncated' | 'rowsTruncated',
    countFlag: 'itemsTotalCount' | 'rowsTotalCount',
  ): { payload: ...; truncation?: ... }
  ```

---

### [WARNING] `execute` 메서드가 과도하게 길고 다중 책임을 가짐
- **위치**: `render-tool-provider.ts` 라인 242-425 (184줄)
- **상세**: 단일 `execute` 메서드가 ①JSON 파싱 유효성 검사, ②도구 등록 여부 확인, ③single_turn 모드 거부, ④schema 검증, ⑤defaults overlay, ⑥1MB cap 적용, ⑦chart/template/form 오버사이즈 처리, ⑧`render_form` 인터랙티브 응답, ⑨display-only 응답 반환의 9단계를 직접 처리한다. 각 에러 경로마다 동일 구조의 반환 객체를 조립하는 코드가 5번 반복된다:
  ```ts
  return {
    toolCallId: call.id,
    content: JSON.stringify({ error: 'INVALID_PAYLOAD', issues }),
    status: 'error',
    presentationCall: { toolName: call.name, toolCallId: call.id, status: 'schema_violation' },
    presentationSchemaViolation: { toolName: call.name, issues, attempts: 1 },
  };
  ```
- **제안**: `makeSchemaViolationResult(call, issues)` 헬퍼 함수를 추출하면 반복이 제거되고 `execute` 메서드가 제어 흐름에 집중할 수 있다. 더 나아가 각 검증 단계를 별도 private 메서드로 분리하는 것을 권장한다.

---

### [INFO] `AssistantPresentationsBlock`에서 `presentations.length === 0` 가드가 호출부와 컴포넌트 모두에 존재
- **위치**: `assistant-presentations-block.tsx` 라인 1080, `conversation-inspector.tsx` 라인 993-995
- **상세**: `AssistantPresentationsBlock` 내부에서 `if (!presentations || presentations.length === 0) return null`으로 빈 배열을 처리하고, 호출부에서도 `presentations.length > 0`을 조건으로 한다. 이중 가드 자체가 버그는 아니지만, 호출부 조건이 없어도 컴포넌트가 안전하게 동작하므로 한쪽이 과잉이다.
- **제안**: 호출부의 `{presentations.length > 0 && <AssistantPresentationsBlock .../>}` 조건을 제거하고 컴포넌트 내부의 가드에 일임하거나, 반대로 컴포넌트 내부 가드를 제거하고 `prop`이 항상 비어있지 않다는 계약을 명시한다. 두 방향 모두 허용되나 일관성 있게 선택해야 한다.

---

### [INFO] `conversation-inspector.tsx` SummaryView 에서 `isAssistant` 가드와 `item.presentations` 접근이 분리됨
- **위치**: `conversation-inspector.tsx` 라인 1004-1007
- **상세**: `isAssistant && item.presentations && item.presentations.length > 0` 조건이 있는데, `SelectedItemDetail` 같은 곳에서는 `const presentations = item.presentations ?? []`로 로컬 변수를 뽑아 쓰는 패턴이 적용되었지만 `SummaryView`에는 적용되지 않아 스타일이 불일치한다.
- **제안**: `SummaryView` 내에서도 동일하게 `const presentations = isAssistant ? (item.presentations ?? []) : []` 로 뽑아 쓰고 조건을 단순화하면 코드베이스 스타일 일관성이 높아진다.

---

### [INFO] `typeFromToolName`의 `as PresentationType` 캐스팅과 `SCHEMA_BY_TYPE` 조회 가드
- **위치**: `render-tool-provider.ts` 라인 82-86
- **상세**: `suffix`를 `PresentationType`으로 강제 캐스팅한 후 곧바로 `SCHEMA_BY_TYPE[suffix]` 존재 여부로 유효성을 검사한다. 캐스팅 시점과 유효성 검사 시점이 달라서 타입 안전성이 눈에 띄지 않게 우회된다.
  ```ts
  const suffix = name.slice('render_'.length) as PresentationType;
  return SCHEMA_BY_TYPE[suffix] ? suffix : null;
  ```
- **제안**: 캐스팅 없이 `suffix`를 `string`으로 유지한 뒤 `SCHEMA_BY_TYPE` key 집합으로 타입 가드를 작성하면 더 명확하다:
  ```ts
  function isPresentationType(s: string): s is PresentationType {
    return s in SCHEMA_BY_TYPE;
  }
  ```

---

### [INFO] `execution-store.ts`에서 타입 re-export와 직접 import가 동일 파일에 공존
- **위치**: `execution-store.ts` 라인 1606-1613
- **상세**: `PresentationType`, `PresentationPayload`, `PresentationPayloadTruncation`를 `export type { ... }`로 re-export하면서 동시에 동일 파일에서 `import type { PresentationPayload }`로 직접 import한다. re-export 주석이 "Single SoT lives in conversation-utils.ts"라고 명시하고 있음에도 `execution-store.ts`가 중간 re-export 계층으로 동작하는 것은 미래에 소비자 코드가 두 경로 중 임의로 하나를 택하는 drift를 유발할 수 있다.
- **제안**: re-export를 유지하는 것이 하위 호환성 목적이라면 JSDoc 주석에 그 이유를 명확히 기재하고(현재는 있음), 신규 소비자는 `conversation-utils`에서 직접 import하도록 팀 컨벤션을 공식화한다.

---

### [INFO] `buildTools`와 `execute`의 eslint-disable 주석 위치
- **위치**: `render-tool-provider.ts` 라인 223-224, 241
- **상세**: `// eslint-disable-next-line @typescript-eslint/require-await` 주석이 각 메서드마다 존재하며 그 이유를 설명하는 주석도 함께 붙어 있어 의도는 명확하다. 다만, 두 곳에 동일한 패턴이 반복된다. `AgentToolProvider` 인터페이스 설계가 동기 구현을 자연스럽게 지원하지 않음을 시사한다.
- **제안**: 장기적으로는 인터페이스 레벨에서 `buildTools`/`execute`를 동기 가능 signature로 허용(`Promise<T> | T`)하거나, sync-only 구현용 기반 클래스를 제공하는 것을 검토할 수 있다. 즉각적인 수정이 필요한 사항은 아니다.

---

### [INFO] 매직 상수 `'render_'` 문자열 리터럴이 여러 곳에 분산
- **위치**: `render-tool-provider.ts` 라인 77, 83, 218 / `render-tool-provider.spec.ts` 라인 437-440
- **상세**: `'render_'` prefix 문자열이 `renderToolName`, `typeFromToolName`, `matches` 세 함수에 리터럴로 반복된다. 현재는 5종으로 고정이라 큰 문제가 없지만 prefix 변경 시 모든 곳을 수동으로 갱신해야 한다.
- **제안**: `const RENDER_TOOL_PREFIX = 'render_' as const` 상수를 선언하고 모든 사용처를 이에 참조하도록 통일한다. 테스트 파일의 `'render_'` 하드코딩도 동일 상수를 공유하는 것이 이상적이다.

---

## 요약

전반적으로 이 변경은 신규 `render_*` 가상 도구 패밀리를 기존 4-prefix 분류 체계에 깔끔하게 삽입하고 있으며, 파일별 책임 분리와 주석 품질이 높다. 특히 `RenderToolProvider`의 schema map, JSON Schema 캐싱, defaults overlay 로직은 의도가 명확하게 전달된다. 그러나 유지보수성 관점에서 두 가지 반복 패턴이 주의를 요한다. 첫째, `pushAiThreadTurn`의 `undefined` 플레이스홀더 인자 패턴이 4곳에 등장하여 시그니처 변경 시 취약하다. 둘째, `PresentationCallTrace`와 `PresentationSchemaViolation` 인라인 타입이 `agent-tool-provider.interface.ts`, `ai-agent.handler.ts`(2곳)에 걸쳐 총 3회 중복 정의된다. 이 두 사항이 가장 높은 유지보수 부채이며, 중간 우선순위의 리팩터링 대상으로 권장한다. `execute` 메서드 내 schema violation 반환 객체 중복(5회)도 헬퍼 추출로 단순화할 수 있다. 나머지 발견사항은 INFO 수준으로 기능에는 영향이 없다.

---

## 위험도

**LOW**

(기능 버그나 즉각적 시스템 장애를 유발하는 요소는 없다. WARNING 항목들은 코드가 확장될 때 drift 및 수정 누락 위험을 높이는 구조적 중복이며, 현재 동작 정확성에는 영향을 주지 않는다.)
