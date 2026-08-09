# 유지보수성(Maintainability) 리뷰

### 발견사항

- **[INFO]** 테스트에서 동일 호출(`findNonTerminalCompletedPlans(root)`)이 여러 `it` 블록에 걸쳐 8회 반복된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:70` (이후 76, 82-84, 88-89, 96, 109-112, 121, 136, 142 등 각 `it` 블록에서 동일 패턴 반복)
  - 상세: `beforeAll` 로 고정 fixture(`root`)를 한 번만 만든 뒤, 개별 테스트가 매번 `findNonTerminalCompletedPlans(root)` 를 새로 호출해 결과를 재계산한다. fixture 가 불변이므로 결과도 매번 동일하며, 계산 자체도 가볍다(로컬 임시 디렉터리 파일 십여 개 스캔).
  - 제안: 현재도 비용이 낮고 테스트 간 격리 측면에서 "각 테스트가 스스로 호출한다"는 명시성이 오히려 읽기 쉬운 선택일 수 있어 필수 수정 사항은 아니다. 다만 fixture 가 커지면 `beforeEach` 에서 1회 계산해 공유하는 방식으로 리팩터링을 고려할 수 있다.

- **[INFO]** `walkPlanMarkdown` 의 최대 중첩 깊이가 4단계(`while → for → if(isDirectory) → if(!recurse)/if(archive)`)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:55` (함수 `walkPlanMarkdown`)
  - 상세: 트리 워커의 전형적인 패턴이라 과도하다고 보기 어렵고, 각 분기가 짧고(1줄 `continue`) 문서화(라인 46-50 docstring)도 충실하다.
  - 제안: 현재 상태로 충분히 읽기 쉬우며 추가 분리는 오히려 간접 참조를 늘릴 수 있어 변경을 권장하지 않는다(참고용 관찰).

### 요약
두 파일 모두 유지보수성 관점에서 높은 완성도를 보인다. 함수는 각각 단일 책임(경로 판별/트리 순회/수집/검증)으로 짧게 분리되어 있고, 이름(`isLifecyclePlan`, `walkPlanMarkdown`, `collectLivePlanMarkdown`, `findNonTerminalCompletedPlans`)이 역할을 정확히 드러낸다. 특히 "왜"를 설명하는 docstring(예: `TERMINAL_STATUSES` 가 `in-progress` 를 포함하지 않는 이유, `status` 가 선택 필드인 이유)이 코드와 함께 유지되어 향후 변경 시 실수를 줄여준다. 저장소 내 실제 사용처(`plan-frontmatter.test.ts`, `spec-links.ts`)를 확인한 결과 이 모듈로의 위임이 실제로 적용되어 있어, 주석이 주장하는 "중복 순회 로직 통합"이 실증된 리팩터링임을 확인했다. 중첩 깊이·매직 넘버·중복 코드 등 명백한 결함은 발견되지 않았고, 지적한 두 건은 모두 INFO 수준의 사소한 관찰에 그친다.

### 위험도
NONE
