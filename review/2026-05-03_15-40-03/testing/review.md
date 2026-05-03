### 발견사항

---

**[WARNING] `workflow-canvas.tsx` `buildInitialConfig` 로직에 대한 테스트 부재**
- 위치: `workflow-canvas.tsx` - `buildInitialConfig` 콜백, `handleAddNodeFromSearch`, `onDrop`
- 상세: AI 노드 추가 시 `llmConfigId`를 기본값으로 자동 주입하는 핵심 동작이 어떤 테스트로도 검증되지 않음. `defaultLlmConfigId`가 null일 때 덮어쓰지 않는 조건(`!config.llmConfigId`)도 미검증.
- 제안: `buildInitialConfig`를 순수 함수로 분리하거나, 캔버스 컴포넌트 테스트에서 `handleAddNodeFromSearch` 호출 시 `config.llmConfigId`가 올바르게 설정되는지 검증하는 단위 테스트 추가.

---

**[WARNING] `llm-config-selector.test.tsx` — `useT` 모킹 부재**
- 위치: `llm-config-selector.test.tsx` 전체
- 상세: `vi.mock("@/lib/i18n")`가 없어 `useT` 훅이 테스트 환경에서 실제 번역 컨텍스트 없이 호출됨. 만약 `useT`가 Next.js i18n 컨텍스트 Provider를 필요로 한다면 렌더 자체가 실패하거나, 원시 i18n 키가 반환되어 `/현재|currently/i` 매칭이 실패함.
- 제안: `vi.mock("@/lib/i18n", () => ({ useT: () => (key: string, vars?: Record<string, string>) => key + (vars?.name ? ':' + vars.name : '') }))` 형태로 최소 mock 추가 또는 실제 번역 dict를 로드하는 테스트 헬퍼 구성.

---

**[WARNING] `filterAiNoLlmProviderError` 내 `hasDefaultLlmConfig` 예외 경로 미처리 및 미테스트**
- 위치: `execution-engine.service.ts:2414` / `execution-engine.service.spec.ts` - `AI no-llm-provider rule post-filter` describe
- 상세: `hasDefaultLlmConfig` 가 throw할 경우 `filterAiNoLlmProviderError`가 예외를 그대로 전파하여 `INVALID_NODE_CONFIG` 대신 다른 에러로 실행이 실패함. DB 연결 오류 등 일시적 장애 시 AI 노드가 실행 불가 상태가 됨.
- 제안: 내부에 try-catch를 추가하여 `hasDefaultLlmConfig` 실패 시 안전하게 `errors`를 그대로 반환하고, 이 fallback 동작을 테스트로 검증.

---

**[INFO] `filterAiNoLlmProviderError` private 메서드 접근 방식 — 타입 캐스트 취약성**
- 위치: `execution-engine.service.spec.ts:2994~3072`
- 상세: `(service as unknown as Filterable).filterAiNoLlmProviderError(...)` 패턴은 메서드 시그니처 변경 시 TypeScript가 컴파일 오류를 발생시키지 않아 테스트가 런타임에서야 실패함. `Filterable` 타입 정의가 실제 구현과 어긋날 경우 오탐 없이 통과할 수 있음.
- 제안: 허용 가능한 패턴이나, `filterAiNoLlmProviderError`의 매개변수 타입이 변경되면 `Filterable` 인터페이스도 동기화해야 함을 주석으로 명시. 또는 `@VisibleForTesting` 패턴을 도입해 `protected`로 낮추고 테스트 서브클래스 활용.

---

**[INFO] `context.variables.__workspaceId` 키 자체가 없는 케이스 미테스트**
- 위치: `execution-engine.service.spec.ts:3063` — `'keeps the error when workspaceId is missing in context'`
- 상세: `buildContext('')`는 `{ variables: { __workspaceId: '' } }`를 생성하므로 빈 문자열 케이스를 테스트함. 그러나 `buildContext()`(인자 없음)처럼 `__workspaceId` 키 자체가 `variables`에 존재하지 않는 경우는 미커버. 구현상 `context.variables?.__workspaceId`가 `undefined`를 반환해 `|| ''`로 동일하게 처리되므로 기능적으로는 동일하지만 의미적으로 다른 케이스.
- 제안: `buildContext()` (undefined)와 `buildContext('')` (빈 문자열) 케이스를 별도 테스트로 분리하거나 테스트명을 `'keeps the error when workspaceId is empty or absent'`로 수정.

---

**[INFO] `resolveConfig` 에러 메시지 테스트에서 한국어 하드코딩**
- 위치: `llm.service.spec.ts:228` — `expect(...).rejects.toMatchObject({ response: { message: expect.stringContaining('워크스페이스 정보가 없어') } })`
- 상세: 에러 메시지 문자열이 구현 코드(`llm.service.ts:238`)에 직접 의존. 메시지가 변경되면 테스트도 함께 깨짐. 에러 코드(`LLM_CONFIG_NOT_FOUND`) 검증이 이미 있으므로 메시지 내용 검증은 중복성 있음.
- 제안: 메시지 상수를 별도 파일로 추출해 테스트와 구현이 동일 상수를 참조하거나, 메시지 내용 검증 대신 `workspaceId` payload 검증에 집중.

---

**[INFO] LlmConfigSelector 테스트 — 상호작용 케이스 미테스트**
- 위치: `llm-config-selector.test.tsx` 전체
- 상세: `onChange` 콜백이 올바른 `id`로 호출되는지, 선택지 변경 시 `noDefaultHint`가 사라지는지 등 사용자 인터랙션 경로가 미검증. 현재 테스트는 초기 렌더 상태만 검증함.
- 제안: `userEvent.selectOptions` 또는 `fireEvent.change`를 사용한 선택 변경 테스트 추가.

---

### 요약

전반적으로 신규 백엔드 로직(`filterAiNoLlmProviderError`, `hasDefaultLlmConfig`)은 핵심 분기를 충실히 커버하는 테스트가 작성되어 있고, SSOT 상수 추출 역시 기존 테스트를 깨지 않는 안전한 리팩토링이다. 다만 프론트엔드 영역에서 `buildInitialConfig`(캔버스 노드 추가 시 기본 LLM 자동 주입) 로직이 테스트되지 않은 점이 주요 갭이고, `LlmConfigSelector` 테스트의 `useT` 모킹 부재는 환경에 따라 테스트 자체가 실패할 수 있는 구조적 문제다. 백엔드 `filterAiNoLlmProviderError`에서 `hasDefaultLlmConfig` 예외가 전파되는 경로도 보호되지 않아 일시적 인프라 장애 시 예상치 못한 실행 오류가 발생할 수 있다.

### 위험도

**LOW**