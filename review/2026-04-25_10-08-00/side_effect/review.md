## 부작용 코드 리뷰

### 발견사항

---

**[WARNING] 모듈 수준 가변 캐시와 테스트 전용 함수가 프로덕션 코드에 노출**
- 위치: `system-prompt.ts` — `let expressionReferenceCache: string | null = null;` 및 `export function resetExpressionCacheForTesting()`
- 상세: `expressionReferenceCache`는 모듈 생명주기 전체에서 공유되는 가변 상태다. `resetExpressionCacheForTesting()`는 `export`되어 있어 프로덕션 코드에서도 호출 가능하며, 실수로 호출되면 해당 프로세스의 모든 후속 요청에 대한 Expression 섹션이 재계산된다. 주석으로 "프로덕션 호출 금지"라고 명시했으나 런타임 가드가 없다.
- 제안: `if (process.env.NODE_ENV !== 'test') return;` 가드를 함수 첫 줄에 추가하거나, `@internal` 표기 + `/* istanbul ignore */` 조합으로 의도를 명확히 한다.

---

**[WARNING] `spec` 파일에서 캐시 리셋 후 `afterEach` 복구 없음**
- 위치: `system-prompt.spec.ts` — `'resetExpressionCacheForTesting clears the module-scope expression cache'` 테스트
- 상세: 해당 테스트 내에서 `resetExpressionCacheForTesting()`를 호출한 뒤 다시 `buildSystemPrompt`를 호출해 캐시를 재충전하므로 이 테스트 자체는 안전하다. 그러나 `beforeEach`/`afterEach`로 캐시를 명시적으로 격리하지 않기 때문에, 미래에 `getAllFunctionNames()`를 mock하는 테스트가 추가될 경우 실행 순서에 따라 캐시 오염이 발생할 수 있다.
- 제안: `describe` 블록 상단에 `afterEach(() => resetExpressionCacheForTesting())` 를 추가해 테스트 간 완전 격리를 보장한다.

---

**[INFO] `collectDanglingOutputPorts`의 빈 `nodeDefs` 조기 반환이 무음 실패처럼 동작**
- 위치: `review-workflow.ts` — `collectDanglingOutputPorts` 함수 첫 줄
- 상세: `nodeDefs.length === 0`이면 `DANGLING_OUTPUT_PORTS` 검사를 통째로 건너뛴다. DI 실패 또는 레지스트리 주입 누락으로 `nodeDefs`가 빈 배열로 들어올 경우, dangling 포트가 실제로 존재해도 감지되지 않으며 체크리스트에 아무 항목도 나타나지 않는다. 현재 스펙상 의도된 동작이지만, 레지스트리 주입 체인이 변경되면 조용히 무력화된다.
- 제안: 호출부(`workflow-assistant-stream.service`)에서 `nodeDefs` 주입 여부를 startup 로그로 남겨 관찰 가능성을 높인다.

---

**[INFO] `details` 문자열은 sanitize되지만 `data` 배열 필드는 원문 그대로 보존**
- 위치: `review-workflow.ts` — `collectDanglingOutputPorts` 내 `dangling.push()` 및 `buildReviewChecklist` 내 `items.push()`
- 상세: `DANGLING_OUTPUT_PORTS` 항목의 `data` 배열(`nodeLabel`, `portLabel`)은 클라이언트 DTO 원문을 유지한다. 이는 LLM이 구조화 필드로 파싱하기 위해 의도된 것이며 테스트도 이를 명시적으로 검증한다. 그러나 미래에 `data` 필드가 UI에 직접 렌더링되는 경로가 추가될 경우, `# HACK\n\`rm -rf /\`` 형태의 레이블이 markdown/HTML로 해석될 수 있다.
- 제안: `data` 배열이 UI 렌더링 경로에 진입하지 않는다는 계약을 API 레벨 주석 또는 타입으로 명시한다.

---

**[INFO] Expression 캐시는 프로세스 재시작 없이는 갱신 불가**
- 위치: `system-prompt.ts` — `expressionReferenceCache` 초기화 로직
- 상세: `getAllFunctionNames()`의 결과는 최초 호출 시 한 번만 캐싱되며, 이후 expression engine에 함수가 동적으로 추가·제거되어도 반영되지 않는다. LLM 프롬프트 생성 용도에서는 허용 가능한 트레이드오프지만, 플러그인 기반 hot-reload 아키텍처로 발전할 경우 stale 참조가 된다.
- 제안: 현재 아키텍처에서는 문제없으나, 이 제약을 함수 주석에 명시적으로 기술해 향후 변경 시 인지하도록 한다.

---

### 요약

네 파일 모두 외부 상태 변경, 파일시스템 접근, 네트워크 호출, 이벤트 발생 등 명백한 부작용은 없다. 유일한 가변 공유 상태는 `system-prompt.ts`의 `expressionReferenceCache`이며, 이는 Node.js 단일 스레드 환경에서 안전하게 동작하도록 설계되어 있다. 다만 `resetExpressionCacheForTesting()`이 `export`된 채로 프로덕션 코드에 노출되어 있고 런타임 가드가 없다는 점, 그리고 `system-prompt.spec.ts`에서 캐시 상태가 테스트 간 명시적으로 격리되지 않는다는 점이 잠재적 위험 요소다. `review-workflow.ts`의 데이터 처리 로직은 전반적으로 순수 함수 패턴을 잘 따르고 있다.

### 위험도

**LOW**