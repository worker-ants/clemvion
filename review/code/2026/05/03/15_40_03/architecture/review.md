### 발견사항

---

**[WARNING] 실행 엔진에 LLM 도메인 검증 로직 누수**
- 위치: `execution-engine.service.ts` — `filterAiNoLlmProviderError()`
- 상세: `ExecutionEngineService`는 노드 실행 오케스트레이션 책임을 가진 인프라 레이어다. 그런데 이 메서드는 "어떤 노드 타입이 AI 노드인지", "어떤 에러 메시지가 LLM 누락을 의미하는지", "워크스페이스에 기본 LLM이 있는지"를 모두 알아야 한다. LLM 설정 도메인 지식이 실행 엔진으로 흘러들어온 것으로, SRP/레이어 책임 위반이다. 이 로직은 AI 노드 핸들러 또는 별도 `AiNodeValidationPolicy` 서비스가 소유하는 것이 자연스럽다.
- 제안: `NodeHandler.validate(config, context?)` 시그니처에 `ExecutionContext`를 선택적으로 넘겨 핸들러 내부에서 컨텍스트 인지 검증을 수행하도록 인터페이스를 확장하거나, `AiValidationPostProcessor` 같은 별도 서비스로 추출해 실행 엔진에 주입한다.

---

**[WARNING] AI 노드 타입 목록의 프론트엔드·백엔드 이중 관리**
- 위치: `backend/src/nodes/ai/llm-provider-rule.ts:AI_LLM_PROVIDER_NODE_TYPES` / `frontend/src/lib/utils/node-config-summary.ts:LLM_PROVIDER_NODES`
- 상세: 두 Set은 완전히 동일한 집합(`ai_agent`, `text_classifier`, `information_extractor`)을 독립 파일에 선언한다. 새 AI 노드 추가 시 두 곳을 동시에 수정해야 하며, 누락 시 캔버스 경고 억제와 실행 엔진 필터가 서로 어긋난다. Monorepo 구조임에도 공유 패키지가 없어 발생하는 경계 문제다.
- 제안: `packages/node-types`(또는 기존 `@workflow/node-summary`) 공유 패키지에 `AI_LLM_PROVIDER_NODE_TYPES`를 단일 출처로 두고 양쪽에서 import한다.

---

**[WARNING] `NodeHandler.validate()` 반환 타입이 `string[]`인 구조적 부채**
- 위치: `execution-engine.service.ts:filterAiNoLlmProviderError()` — `errors.includes(AI_NO_LLM_PROVIDER_MESSAGE)`
- 상세: 코드 자체도 주석으로 인정하듯, 메시지 문자열로 에러 종류를 식별하는 것은 인터페이스 설계 미비의 우회로다. 현재는 상수 공유로 typo를 막지만, 향후 메시지 다국어화나 동일 패턴의 에러가 추가될 때마다 문자열 비교 분기가 늘어난다. 이 패턴이 선례가 되면 validation 레이어가 점진적으로 문자열 파싱 코드로 채워진다.
- 제안: `validate()` 반환 타입을 `{ valid: boolean; errors: Array<{ code: string; message: string }> }`로 변경해 코드 기반 식별을 가능하게 한다. 인터페이스 변경 범위가 크다면 단기 대안으로 현 방식을 유지하되, 이 기술 부채를 ADR 또는 TODO 이슈로 명시적으로 추적한다.

---

**[INFO] `filterAiNoLlmProviderError` 프라이빗 메서드 직접 테스트**
- 위치: `execution-engine.service.spec.ts` — `as unknown as Filterable` 캐스팅
- 상세: TypeScript의 접근 제어를 우회해 private 메서드를 직접 테스트하는 패턴은 구현 세부사항에 테스트가 결합됨을 의미한다. 메서드 리네임이나 추출 리팩토링 시 테스트가 함께 깨진다.
- 제안: 퍼블릭 API(`execute` 엔드-투-엔드 또는 통합 시나리오)를 통해 동일한 분기를 검증하거나, 메서드를 독립 클래스로 추출해 직접 테스트 가능하게 만든다.

---

**[INFO] `workflow-canvas.tsx`의 초기 설정 빌드 로직 인라인**
- 위치: `workflow-canvas.tsx` — `buildInitialConfig` useCallback
- 상세: AI 노드 추가 시 기본 LLM을 자동 주입하는 로직이 캔버스 컴포넌트에 직접 존재한다. 기능적으로 올바르지만, 캔버스 컴포넌트의 크기를 키우고 재사용·단독 테스트를 어렵게 한다.
- 제안: `useDefaultLlmPrefill(nodeType, defaultConfig)` 커스텀 훅으로 추출하거나, `buildInitialConfig`를 별도 유틸 함수로 분리한다.

---

### 요약

이번 변경의 핵심 아이디어—선언적 스키마 규칙과 런타임 컨텍스트 인식을 분리해 SSOT를 유지한다—는 올바른 방향이다. `llm-provider-rule.ts`로 상수를 단일화하고, `hasDefaultLlmConfig`를 존재 확인 전용 메서드로 분리한 것도 적절하다. 그러나 LLM 도메인 검증 로직이 실행 엔진 안으로 침투한 점, 동일한 노드 타입 집합이 프론트엔드·백엔드에 이중으로 관리되는 점, `validate()` 인터페이스의 `string[]` 설계 부채가 누적되는 점이 중기적으로 유지보수 비용을 높일 아키텍처 리스크다.

### 위험도

**LOW**