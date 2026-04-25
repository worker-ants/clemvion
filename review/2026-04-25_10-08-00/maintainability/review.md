## 유지보수성 코드 리뷰

### 발견사항

---

- **[WARNING]** `buildReviewChecklist` JSDoc 주석의 검사 개수 불일치
  - 위치: `review-workflow.ts`, `buildReviewChecklist` 함수 JSDoc (`"여섯 개 점검을 순차 실행"`) 및 순서 목록
  - 상세: `NODE_CONFIG_WARNINGS` 검사가 추가되어 실제로는 7개 검사를 수행하지만, JSDoc은 여전히 "여섯 개"라고 명시하고, 순서 목록에서 `NODE_CONFIG_WARNINGS`가 누락되어 있음. 섹션 헤더도 "점검 6) NODE_CONFIG_WARNINGS", "점검 7) REQUEST_COVERAGE_LOW"로 불일치.
  - 제안: JSDoc을 "일곱 개 점검"으로 수정, 순서 목록에 `6) NODE_CONFIG_WARNINGS, 7) REQUEST_COVERAGE_LOW` 포함

---

- **[WARNING]** `buildSystemPrompt`가 파일 하단에 정의된 상수를 참조 (역순 배치)
  - 위치: `system-prompt.ts`, `buildSystemPrompt` 함수 vs. `STATIC_BLOCK_1_ROLE_AND_TURN_OP` 등의 `const` 위치
  - 상세: `buildSystemPrompt`는 파일 상단 근처에 선언되어 있으나, 이 함수가 사용하는 `STATIC_BLOCK_*` 상수들은 파일 하단에 정의됨. 런타임에는 정상 동작하지만(module evaluation 완료 후 호출), 상단→하단 순서로 파일을 읽는 독자에게는 참조 대상이 뒤에 있어 탐색 비용이 발생.
  - 제안: 상수 선언을 함수 앞으로 이동하거나, `buildSystemPrompt` 아래에 `// see STATIC_BLOCK_* constants below` 주석 추가

---

- **[WARNING]** spec 파일 내 복잡한 인라인 정규식 표현
  - 위치: `system-prompt.spec.ts`, 예: `plan-only` 마감 규칙 검사, null-safe 참조 검사
  - 상세: `/plan[- ]only turn[s]?[^\n]*(?:do not|must not)\s+emit|(?:do not|must not)\s+emit[^\n]*plan[- ]only/` 같은 패턴이 `expect(...).toMatch(...)` 안에 인라인으로 작성되어 있음. 테스트 실패 시 어떤 조건을 확인하는지 즉시 파악하기 어려움.
  - 제안: 의미 있는 이름의 상수로 추출. 예: `const PLAN_ONLY_NO_EMIT_PATTERN = /plan[- ]only turn...`

---

- **[WARNING]** `activePlan` 픽스처가 두 `describe` 블록에서 독립 정의
  - 위치: `system-prompt.spec.ts`, 외부 `'Active plan context section'` describe와 내부 `'5-block structural layout'` describe
  - 상세: 두 `activePlan` 변수는 서로 다른 내용을 가지므로 의도적인 분리지만, 동일한 이름으로 shadowing되어 내부 describe에서의 `activePlan`이 외부 것과 다름을 독자가 즉시 알기 어려움. 특히 내부 픽스처가 훨씬 간소화된 버전임.
  - 제안: 내부 describe의 픽스처를 `minimalActivePlan` 등으로 명시적 이름 부여

---

- **[INFO]** `LAYOUT_FALLBACK_WIDTH/HEIGHT/NODE_GAP_X/SIBLING_GAP_Y` 상수의 사용 위치 추적 불가
  - 위치: `system-prompt.ts`, 상수 선언부
  - 상세: 레이아웃 상수들이 `STATIC_BLOCK_*` 템플릿 리터럴 내부에 사용되지만, 거대한 문자열 안에서 `${LAYOUT_FALLBACK_WIDTH}` 형식이 아니라 직접 숫자로 삽입되는 구조라면 상수가 실제로 어디서 쓰이는지 추적하기 어려움. JSDoc의 설명만으로 연결 고리가 끊기는 구조.
  - 제안: 상수를 실제로 `${LAYOUT_FALLBACK_WIDTH}` 보간으로 사용하거나, JSDoc에 "참조 위치: STATIC_BLOCK_3, 레이아웃 지침 섹션" 명시

---

- **[INFO]** `sanitizeLlmProvidedString`이 `shadow-workflow.ts`에서 임포트
  - 위치: `review-workflow.ts` 상단 import
  - 상세: 보안 목적의 문자열 중화 유틸리티가 `shadow-workflow` 모듈에 위치. 향후 다른 모듈에서도 동일 함수가 필요해질 때 shadow-workflow 의존성이 불필요하게 확산될 수 있음.
  - 제안: 중간 규모 이슈이므로 즉각 변경 불필요. 유사 유틸리티가 늘어날 시 `sanitize.ts` 또는 `llm-security-utils.ts`로 분리 고려

---

- **[INFO]** `collectOrphans` 함수 내 과거 구현 설명 주석
  - 위치: `review-workflow.ts`, `collectOrphans` 함수 내 `byId` Map 생성 직전
  - 상세: `"이전 구조는 각 orphan 후보마다 이 Map 을 재생성해 O(N × total_nodes) 로 퇴화했다"` — 과거 버그 수정 경위 설명은 인라인 코드보다 git commit message에 적합한 내용. 코드 자체에 `byId` Map을 한 번만 생성한다는 의도는 이미 코드 구조로 드러남.
  - 제안: 해당 주석 제거 또는 "Map 을 한 번만 생성해 O(N) 조회를 보장" 수준으로 축약

---

- **[INFO]** 테스트 이름 `'keeps the authoritative snapshot guidance that was added previously'`
  - 위치: `system-prompt.spec.ts`, 마지막 독립 `it` 블록
  - 상세: "added previously"는 히스토리 참조 표현으로 맥락 없이는 의미가 없음. 스펙 문서의 영속적 설명으로서 부적절.
  - 제안: `'includes authoritative currentWorkflow snapshot guidance and get_current_workflow reference'`처럼 검증 대상을 직접 서술

---

### 요약

전반적으로 코드 구조는 우수하다. `review-workflow.ts`는 7개 검사 책임을 명확히 분리된 private 함수로 구현했고, 상수 네이밍과 섹션 구분자 활용이 일관적이다. `system-prompt.ts`의 블록 분리 설계(캐시 친화적 정적/동적 분리)는 의도가 명확하며, 모듈 수준 캐시의 테스트 격리 설계(`resetExpressionCacheForTesting`)도 적절하다. 주요 유지보수성 위험은 `buildReviewChecklist` JSDoc의 검사 개수 불일치(코드와 문서의 드리프트)이며, 나머지는 spec 파일의 복잡한 인라인 정규식과 상수 배치 순서 같은 가독성 수준의 개선 사항이다.

### 위험도
**LOW**