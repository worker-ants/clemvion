### 발견사항

---

- **[WARNING]** 프로덕션 모듈에 테스트 전용 API 노출
  - 위치: `system-prompt.ts:35-38` — `export function resetExpressionCacheForTesting()`
  - 상세: `let expressionReferenceCache`라는 모듈 수준 가변 상태(module-level mutable state)를 리셋하는 함수가 `export`로 공개되어 있다. 이 함수는 프로덕션 API surface에 포함되지만 테스트 격리 목적 외에 정당한 호출 경로가 없다. 모듈이 자신의 캐시를 외부에서 무효화할 수 있도록 허용하는 것은 단일 책임 원칙(SRP) 위반이며, 실수로 프로덕션 경로에서 호출될 경우 매 턴 expression 섹션을 재계산하는 비용이 발생한다.
  - 제안: 캐시를 클래스나 팩토리 함수로 캡슐화하거나, Jest의 `jest.resetModules()` 또는 `jest.isolateModules()`를 이용해 테스트 격리를 수행하고 `reset*` 함수를 모듈에서 제거한다. 또는 `/* @internal */` 주석과 함께 별도 `system-prompt.test-utils.ts`로 분리해 프로덕션 API surface에서 분리한다.

---

- **[WARNING]** `ReviewChecklistItem.data` 필드의 타입 소거(type erasure)
  - 위치: `review-workflow.ts:82` — `data?: unknown`
  - 상세: `ReviewChecklistCode`는 7종류의 코드를 열거하는 판별 유니온(discriminated union)으로 설계되어 있으나, `data` 필드는 `unknown`으로 선언되어 코드 타입과 데이터 shape 사이의 계약이 타입 시스템 밖 주석으로만 유지된다. 소비 측(`stream.service`, `finish` 핸들러 등)에서는 매번 타입 단언(as Array<...>)을 해야 하며, 이 shape 계약이 깨져도 컴파일 타임에 감지되지 않는다. `review-workflow.spec.ts` 전반에서도 `as Array<{portId: string}>` 같은 단언이 반복된다.
  - 제안: 코드별 페이로드를 명시한 discriminated union으로 선언한다:
    ```ts
    type ReviewChecklistItem =
      | { code: 'ORPHAN_NODES'; blocking: true; details: string; data: OrphanEntry[] }
      | { code: 'DANGLING_OUTPUT_PORTS'; blocking: true; details: string; data: DanglingPortEntry[] }
      | ...
    ```
    이렇게 하면 소비 측에서 코드 타입 가드만으로 data 필드의 shape가 좁혀진다.

---

- **[WARNING]** 체크리스트 확장이 OCP를 위반 — 추가마다 `buildReviewChecklist` 수정 필요
  - 위치: `review-workflow.ts:170-250` — `buildReviewChecklist` 함수 전체
  - 상세: 현재 구조는 7개 점검을 `if (items.length > 0) { items.push(...) }` 패턴으로 순차 나열한다. 새 점검을 추가하려면 이 함수를 수정해야 하며(OCP 위반), 점검 순서는 코드 위치에 의존한다. 팀이 새 점검을 독립적으로 개발하거나 조건부로 활성화하려 할 때 충돌 지점이 된다.
  - 제안: 점검을 `(input: BuildReviewChecklistInput) => ReviewChecklistItem | null` signature의 배열로 등록하는 레지스트리 패턴을 고려한다:
    ```ts
    const CHECKS: Array<(input: BuildReviewChecklistInput) => ReviewChecklistItem | null> = [
      checkUnresolvedFailures,
      checkOrphans,
      ...
    ];
    export function buildReviewChecklist(input) {
      return CHECKS.flatMap(fn => fn(input) ?? []);
    }
    ```
    체크 함수가 7개 이하인 현재는 당장 필수는 아니지만, 점검 항목이 지속적으로 늘어나는 도메인 특성상 미리 정비하면 향후 변경 비용을 줄인다.

---

- **[INFO]** `collectUnmentionedPendingUserConfig`가 전체 `BuildReviewChecklistInput`을 받음 — 과도한 결합
  - 위치: `review-workflow.ts:360` — 함수 시그니처
  - 상세: 이 함수가 실제로 사용하는 필드는 `assistantText`, `shadowSnapshot`, `collectPendingUserConfig` 세 가지뿐이다. 전체 입력 인터페이스를 받으면 이 함수가 미래에 다른 필드를 무심코 참조할 여지가 생기고, 단위 테스트에서 불필요한 필드까지 채워야 한다.
  - 제안: 필요한 세 필드만 구조 분해해 받는 시그니처로 좁힌다. 이 패턴은 `collectDanglingOutputPorts(snapshot, nodeDefs)`처럼 이미 일부 점검 함수에서 올바르게 적용되어 있다.

---

- **[INFO]** 레이아웃 상수 선언과 실제 사용 위치가 분리되어 추적 어려움
  - 위치: `system-prompt.ts:14-18` — `LAYOUT_FALLBACK_WIDTH/HEIGHT`, `LAYOUT_NODE_GAP_X/Y`
  - 상세: 상수는 파일 상단에 선언되어 있으나, 사용 위치는 파일 하단의 `STATIC_BLOCK_3_EDIT_PLAYBOOK` 문자열 리터럴 내부이다(잘린 부분). 이 상수가 실제 문자열에 반영되는지, 아니면 단순히 문서화 목적인지 코드만 보아서는 알기 어렵다. 상수가 문자열 인터폴레이션에 쓰인다면 의도적이지만, 쓰이지 않는다면 불필요한 선언이다.
  - 제안: 상수가 정말 static block 내에서 인터폴레이션으로 사용되고 있는지 확인하고, 사용하지 않는다면 제거한다. 사용한다면 JSDoc에 "used in STATIC_BLOCK_3"를 명시해 의도를 명확히 한다.

---

- **[INFO]** 5블록 구조의 캐시-친화 순서가 `buildSystemPrompt` 시그니처 수준에서만 문서화됨
  - 위치: `system-prompt.ts:49-67` — 함수 JSDoc
  - 상세: 블록 순서(정적 → 동적)는 LLM provider 캐시 효율에 직접 영향을 미치는 핵심 불변 조건이다. 현재 이 제약은 JSDoc 주석으로만 선언되어 있으며, `5-block structural layout` 테스트 describe가 이를 회귀 방어한다. 구조 자체는 올바르며 테스트가 잘 고정되어 있다.
  - 제안: 현 접근은 충분하나, 명칭 있는 섹션 상수들(`STATIC_BLOCK_1_*`, `STATIC_BLOCK_2_*`, `STATIC_BLOCK_3_*`)을 배열로 선언하면 순서를 선언적으로 강제할 수 있다:
    ```ts
    const BLOCKS = [BLOCK1, BLOCK2, BLOCK3, dynamicSection] as const;
    return BLOCKS.join('\n');
    ```

---

### 요약

전체 아키텍처는 LLM 프롬프트 조립이라는 도메인에 적합하게 설계되어 있다. `system-prompt.ts`의 5블록 캐시-친화 구조는 명확한 의도와 테스트 회귀 방어를 갖추고 있으며, `review-workflow.ts`의 점검별 함수 분리도 단일 책임 원칙을 잘 따른다. 주요 구조적 약점은 두 가지다: (1) 모듈 수준 가변 상태를 리셋하는 테스트 전용 함수가 프로덕션 API에 노출되어 있어 캡슐화 경계를 침범하고, (2) `ReviewChecklistItem.data`의 `unknown` 타입이 7가지 코드별 페이로드 계약을 타입 시스템 밖으로 밀어내어 소비 측에서 반복적인 타입 단언을 요구한다. 체크리스트 확장 패턴은 현재 규모에서는 수용 가능하나 항목 수가 늘어날수록 OCP 부담이 커지므로 레지스트리 패턴으로의 전환을 고려할 시점이다.

### 위험도

**LOW**