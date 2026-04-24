### 발견사항

---

**[WARNING] `AnthropicClient` 공개 메서드에 JSDoc 부재**
- 위치: `anthropic.client.ts` — `chat()`, `stream()`, `listModels()`, `testConnection()`, `embed()`
- 상세: 클래스 자체와 5개 공개 메서드 모두 JSDoc 없음. 특히 `stream()`은 300줄에 달하며 블록 인덱스 기반 그룹핑, `argsParts` 배열 누적, `finishReason` 상태 관리, signal abort 처리 등 비자명한 로직이 밀집해 있음. `chat()`의 `tool_choice` 조합 로직(parallel 강제 설정)도 WHY 설명이 인라인 주석으로만 있고 메서드 시그니처 수준에서는 없음.
- 제안: 최소한 `chat()`과 `stream()`에 `@param`/`@returns`/`@throws` 없이도 "parallel tool use 강제 설정 이유"와 "스트림 이벤트 변환 구조"를 한 단락으로 설명하는 JSDoc 추가 권장.

---

**[WARNING] `renderNodeCatalog` JSDoc가 ED-AI-40 이후 정책과 부분 불일치**
- 위치: `system-prompt.ts:73-79`
- 상세: JSDoc에 "LLM 이 `add_edge` 전에 `get_node_schema` 로 실제 포트를 먼저 확인해야 함을 인지하도록"이라고 명시되어 있으나, ED-AI-40 이후 실제 정책은 "편집한 노드는 `result.ports`로 충분, `get_node_schema`는 편집하지 않는 기존 노드에만 필요"로 변경됨. 주석이 구 정책을 그대로 서술해 오해를 유발할 수 있음.
- 제안: JSDoc을 "동적 포트 노드에 `[dynamic-ports]` 마커를 붙여 LLM이 스냅샷에만 존재하는(이 턴에 편집하지 않은) 노드에 엣지 연결 시 `get_node_schema`를 호출해야 함을 인지하도록 한다"로 수정.

---

**[INFO] `buildAssistantTools()` 및 `buildAssistantToolsInternal()` JSDoc 없음**
- 위치: `tool-definitions.ts:224-228`
- 상세: `buildAssistantTools()`는 유일한 외부 공개 함수이지만 JSDoc 없음. `ASSISTANT_TOOLS` 상수에는 모듈-레벨 캐싱 이유가 잘 문서화되어 있으나, 함수 자체에는 없어 반환값 타입 이외 컨텍스트를 얻기 어려움.
- 제안: `/** 워크플로우 어시스턴트에 전달될 정적 tool 목록을 반환한다. 매 호출 시 동일 참조를 반환한다. */` 한 줄로도 충분.

---

**[INFO] `anthropic.client.ts` 내 언어 일관성**
- 위치: `anthropic.client.ts:137-140` (`listModels` 인라인 주석)
- 상세: 코드베이스 내 주석이 한국어/영어 혼용 패턴을 따르는데, `listModels`의 인라인 주석은 한국어, `stream()`의 블록 주석은 한국어, `chat()`의 parallel tool use 설명은 영어로 섞여 있음. 일관성 문제이므로 Critical은 아니지만 유지보수 시 혼선 가능.
- 제안: 코드베이스 컨벤션이 한국어 우선이면 영어 인라인 주석을 한국어로 통일 (또는 반대). `chat()`의 긴 영어 병렬 도구 주석이 특히 눈에 띔.

---

**[INFO] `truncate()` 헬퍼에 JSDoc 없음**
- 위치: `system-prompt.ts` 하단 `truncate()` 함수
- 상세: `sanitizeUserText`와 `sanitizeLabel`은 JSDoc이 있으나 이 둘이 의존하는 `truncate()`는 없음. 단순하지만 "말줄임 포함 최대 길이" 계약이 명시적이지 않음 (`maxLen - 1`이 `…` 자리).
- 제안: `/** 문자열을 maxLen 이하로 절단하고 초과 시 끝에 '…'를 붙인다. 결과 길이는 maxLen 이하. */` 한 줄 추가.

---

**[INFO] 스트림 `spec.ts` 의 `makeService` 내부 `candidateLookup` 모의 객체 문서 누락**
- 위치: `workflow-assistant-stream.service.spec.ts:109-114`
- 상세: `candidateLookup`은 `MockDeps` 인터페이스에 선언되지 않아 `mocks` 반환값에 타입 안전하게 접근이 안 되며, 상단 `MockDeps` 인터페이스를 보는 독자는 이 의존성이 존재하는지 모름. 스프레드 `{...mocks, candidateLookup}`으로 반환하지만 인터페이스에 없음.
- 제안: `MockDeps`에 `candidateLookup` 항목 추가 또는 별도 타입으로 분리.

---

### 요약

전반적으로 문서화 품질은 양호한 편이다. `system-prompt.ts`는 5블록 레이아웃 설계 의도, 캐싱 전략, 보안 중화 로직의 순서 의존성까지 JSDoc으로 명확히 설명하고 있고, 테스트 파일들은 사용자 보고 버그와 연결된 한국어 주석으로 "왜 이 테스트가 존재하는가"를 잘 전달한다. 가장 취약한 부분은 `AnthropicClient`로, 복잡한 스트림 처리 로직을 담은 공개 메서드들에 메서드-레벨 JSDoc이 전혀 없으며, `renderNodeCatalog` JSDoc은 ED-AI-40 이후 변경된 `get_node_schema` 호출 정책과 미묘하게 불일치해 수정이 필요하다.

### 위험도
**LOW**