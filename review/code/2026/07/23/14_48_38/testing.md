### 발견사항

- **[INFO]** 2차 라운드 잔여 갭("`??` 좌우 우선순위 미고립") 실제로 닫혔음을 실측 재확인
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:202-204` (`const endReason = (result?.endReason as string|undefined) ?? (output.endReason as string|undefined);`), 대응 테스트 `__tests__/output-shape.test.ts:697` (`prefers result.endReason over output.endReason when both are present`)
  - 상세: 직접 `output-shape.ts` 를 편집해 2건의 뮤턴트를 주입하고 vitest 로 재현했다 — (1) fallback(`?? output.endReason`) 통째로 제거 → `output-shape.test.ts:665` 단 1건만 red (2) `??` 좌우 순서 교환 → `output-shape.test.ts:719` 단 1건만 red. 둘 다 문서(RESOLUTION.md/plan §측정1b·1c)가 주장한 그대로였고, 다른 40개 테스트는 영향받지 않았다(고립성 확인). `endReason` 값 도메인 뮤턴트(R1: `?? "completed"` 기본값 주입)도 재현해 `output-shape.test.ts:629` 만 단독 red 임을 확인했다. plan `output-shape-comment-followups.md` 의 실측 표는 신뢰할 수 있는 근거다.
  - 제안: 없음 (검증 완료, 기록 목적).

- **[INFO]** 순수 함수 테스트 — mock/stub 불필요, 실동작 괴리 없음
  - 위치: `__tests__/output-shape.test.ts` 전체 (42 tests)
  - 상세: `isConversationOutput`/`unwrapNodeOutput`/`extractIeSnapshot`/`extractAiMetadata`/`extractTurnDebug` 모두 부수효과 없는 순수 함수이고, 모든 테스트가 지역 객체 리터럴(`raw`)만으로 구성돼 있다. mock/spy 가 전혀 없고 필요하지도 않다 — "Mock 적절성" 관점에서 이상적인 형태.
  - 제안: 없음.

- **[INFO]** 테스트 격리 — 실행 순서·공유 상태 의존 없음, 회귀 없음 재확인
  - 위치: `__tests__/output-shape.test.ts` 전체
  - 상세: `vitest run src/components/editor/run-results/__tests__/output-shape.test.ts` 를 직접 실행해 **42 passed** 확인(문서 주장과 일치, 39→40→41→42 누적). 각 `it` 이 독립된 `raw` 리터럴을 생성하고 `beforeEach`/module-level mutable state 가 없어 순서 의존이 없다. `output-shape.ts` non-comment diff 는 `git diff origin/main..HEAD` 로 직접 필터링해 **0줄**임을 재확인했다 — 이번 diff 는 판정 로직을 전혀 바꾸지 않았으므로 기존 40개 테스트의 유효성도 그대로 유지된다.
  - 제안: 없음.

- **[INFO]** (사전 존재, diff 범위 밖) `isConversationOutput` 최상위 타입 가드에 대한 직접 단위 테스트 부재
  - 위치: `output-shape.ts:164` (`if (!outputData || typeof outputData !== "object" || Array.isArray(outputData)) return false;`)
  - 상세: `null`/`undefined`/배열/원시값(string, number) 입력이 `false` 를 반환하는지 직접 고정하는 fixture 가 없다. 이 가드 라인은 이번 diff 에서 무변경(주석/JSDoc 전용 diff)이라 신규 갭은 아니며, 호출부 3곳(`result-detail.tsx`, `result-timeline.tsx`)이 이미 `outputData: unknown` 을 그대로 넘기는 구조라 실무 위험은 낮다. 그러나 이 함수가 "대화 UI 전체의 게이트"로 명시된 만큼 완전성 관점에서 남겨진 코너다.
  - 제안: 후속 편집(다음에 이 함수를 건드릴 때) 이월 항목으로 `expect(isConversationOutput(null)).toBe(false)` 류의 가드 테스트 3~4건 추가 검토. 병합 차단 사유 아님.

- **[INFO]** (사전 존재, diff 범위 밖) `Array.isArray` 가드의 "truthy-but-not-array" 변형 미고립
  - 위치: `output-shape.ts:187-188` (`hasResultMessages = !!result && Array.isArray(result.messages)`, `hasLegacyMessages = Array.isArray(output.messages)`)
  - 상세: `messages` 필드가 배열이 아닌 truthy 값(예: 객체·문자열)일 때 해당 가드가 `false` 를 유지하는지 고정하는 fixture 가 없다 — `Array.isArray(x)` 를 `x != null` 로 약화하는 리팩터가 있으면 관측되지 않는다. 이 역시 이번 diff 로 도입된 로직이 아니고(가드 라인 무변경), #983/이번 followup 이 이미 촘촘히 고립한 12개 뮤턴트 목록(OR-분기 6 + AND-guard 4 + endReason 2단 조회 2)에는 포함되지 않은 별도 클래스다.
  - 제안: 필수 아님. 향후 이 함수의 AND-guard 를 다시 손댈 기회에 함께 검토.

- **[INFO]** 소소한 주석 스타일 비대칭 — "prefers result.endReason ..." 테스트만 명시적 "고립 조건" 불릿 목록 생략
  - 위치: `__tests__/output-shape.test.ts:697-720`
  - 상세: 같은 파일의 인접 테스트들(`rejects result.messages when the endReason key is absent entirely`, `detects a terminal whose endReason sits at output.endReason ...`)은 "고립 조건 —" 형식의 명시적 불릿 목록으로 어떤 필드가 부재/존재해야 하는지 나열하는데, 바로 다음에 추가된 "prefers result.endReason over output.endReason" 테스트는 산문으로만 설명하고 동일한 불릿 목록이 없다(다만 직전 fixture 를 그대로 재사용하는 구조라 실질적으로 암묵적으로 계승됨). 기능적 결함은 아니고 순수 가독성 일관성 문제.
  - 제안: 선택 사항 — 다음 편집 시 동일한 "고립 조건 —" 불릿 형식으로 통일하면 4개 테스트 전체가 같은 패턴을 따르게 된다.

### 요약

이번 라운드(3차)의 실질 diff 는 (1) 2차 리뷰 testing INFO 1(`??` 좌우 우선순위 미고립)을 닫는 신규 fixture 1건(39→40→41→**42**) 추가, (2) 같은 갭을 JSDoc "Stage 5 이후 종결" bullet 에 서술 추가(WARNING 1 반영), (3) plan 문서·이전 리뷰 산출물 커밋으로 구성되며, `isConversationOutput` 판정 로직 자체(`output-shape.ts`)는 이번 diff 에서 전혀 바뀌지 않았다(`git diff origin/main..HEAD` non-comment 라인 0줄 직접 확인). 신규 fixture 가 실제로 주장한 뮤턴트(fallback 제거·`??` 좌우 교환·기본값 주입)를 정확히 1건씩만 잡는지 세 가지를 직접 소스에 뮤턴트를 주입해 재현했고 모두 문서(plan `output-shape-comment-followups.md`, RESOLUTION.md) 주장과 일치했다 — 이 프로젝트의 mutation 실측 관행이 신뢰할 만한 근거로 뒷받침된다. 테스트는 순수 함수에 대한 지역 객체 리터럴 기반이라 mock 이 전혀 없고(적절), 실행 순서·공유 상태 의존이 없어 격리도 양호하며, 42개 테스트 전체가 정확히 원 OR-체인 6분기 + AND-guard 4곳 + endReason 2단 조회의 존재/우선순위까지 서로 겹치지 않게 고립시킨 상태다. 남은 갭(최상위 타입 가드 미고립, `Array.isArray` truthy-value 변형 미고립, 주석 스타일 사소한 비대칭)은 모두 이번 diff 이전부터 있던 낮은 실무 위험의 코너이거나 순수 스타일 문제로, 병합을 막을 사유가 아니다. Critical·Warning 급 테스트 결함은 없다.

### 위험도
LOW
