### 발견사항

- **[INFO]** 외부 의존성 변경 없음
  - 위치: `system-prompt.ts` imports 전체
  - 상세: 이번 변경은 순수 구조 리팩토링이며 `@workflow/expression-engine`, 내부 모듈(`shadow-workflow`, `workflow-view`, `active-plan-context`, `node-component.registry`) 모두 이전과 동일. `package.json` 변경 없음.
  - 제안: 해당 없음.

- **[WARNING]** 모듈 스코프 가변 상태 — `EXPRESSION_REFERENCE_CACHE`
  - 위치: `system-prompt.ts` L22 (`let EXPRESSION_REFERENCE_CACHE: string | null = null`)
  - 상세: Node.js에서 모듈 캐시는 프로세스 생애 동안 유지되므로 단일 프로세스에서는 의도대로 동작한다. 그러나 Jest의 기본 설정(`--isolateModules` 미사용)에서는 테스트 간 모듈 인스턴스가 공유될 수 있다. `getAllFunctionNames()`가 테스트 픽스처에 따라 달라지는 환경이라면, 첫 테스트가 캐시를 채운 뒤 후속 테스트가 오염된 값을 쓸 가능성이 있다. 현재 spec에서는 같은 expression-engine을 일관되게 사용하므로 실제 발화 가능성은 낮다.
  - 제안: 리스크가 낮으면 그대로 유지해도 무방. 향후 expression engine 플러그인 동적 로딩이나 테스트에서 mock이 필요해지면, `getExpressionReferenceSection`에 `forceRefresh?: boolean` 파라미터를 추가하거나, `jest.resetModules()`를 `afterEach`에 배치하는 방법을 고려할 것.

- **[INFO]** 정적 블록 상수에 레이아웃 매직 넘버가 빌드 타임에 인라인됨
  - 위치: `STATIC_BLOCK_3_EDIT_PLAYBOOK` 템플릿 리터럴 내 `${LAYOUT_FALLBACK_WIDTH}`, `${LAYOUT_NODE_GAP_X}` 등
  - 상세: 상수들이 같은 파일 최상단에 선언되어 있으므로 JavaScript/TypeScript의 모듈 초기화 순서상 안전하다. 의존성 문제 없음.
  - 제안: 해당 없음.

- **[INFO]** `@workflow/expression-engine` 호출 횟수 감소
  - 위치: `getExpressionReferenceSection()` (이전: `renderExpressionReferenceSection()`)
  - 상세: `getAllFunctionNames()`가 매 턴에서 프로세스당 1회 호출로 변경되었다. 해당 함수가 파일시스템 I/O나 외부 레지스트리를 읽는 구조라면 성능 이점이 크다. 내부 패키지이므로 버전 고정·라이선스 이슈 없음.
  - 제안: 해당 없음.

---

### 요약

이번 변경에서 신규 외부 의존성은 전혀 추가되지 않았으며, 내부 모듈 의존 그래프도 변경 없이 유지된다. 유일한 주목 지점은 모듈 스코프 가변 변수 `EXPRESSION_REFERENCE_CACHE`로, 프로덕션 환경에서는 의도된 최적화이나 Jest 모듈 공유 시나리오에서 테스트 오염이 발생할 이론적 가능성이 있다. 현재 테스트 설계가 expression engine을 단일하게 사용하므로 실질적 위험은 낮다.

### 위험도

**LOW**