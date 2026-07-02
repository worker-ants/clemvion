# 유지보수성(Maintainability) 리뷰 결과

### 발견사항

- **[INFO]** 함수명 리네이밍은 의도를 더 명확히 개선함
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:854` (`claimResumeEntry`), 및 `continuation-execution.processor.ts:388`
  - 상세: `isNodeExecutionWaiting`(단순 조회/불리언 검사처럼 보이는 이름) → `claimResumeEntry`(부수효과를 갖는 원자적 claim 임을 드러내는 이름)로의 리네이밍은 "이름이 목적을 잘 나타내는지" 관점에서 명백한 개선이다. 이전 이름은 read-only 처럼 읽혔지만 실제로는 상태를 전이(UPDATE)시키는 부수효과 함수였다 — 새 이름이 이 함수가 "claim"(선점) 동작임을 정확히 전달한다. 테스트 파일(`continuation-execution.processor.spec.ts`, `execution-engine.service.spec.ts`)도 새 이름/시맨틱에 맞춰 describe/it 문구까지 일관되게 갱신됐다.
  - 제안: 변경 없음 — 우수 사례로 유지.

- **[INFO]** JSDoc 주석 길이·중복 서술
  - 위치: `execution-engine.service.ts:839-853` (`claimResumeEntry` JSDoc), `continuation-execution.processor.ts:29-37`, `43-50`, `377-395`
  - 상세: 원자 claim 도입 배경·불변식·§7.5 참조가 파일 상단 클래스 JSDoc, `process()` 메서드 내부 주석, `claimResumeEntry` JSDoc 세 곳에서 유사한 내용(비원자 SELECT 재검증 → 원자 UPDATE, "check-then-act 창 없음", "이중 실행 0 기계 보장")이 반복 서술된다. 코드 자체의 가독성엔 영향이 적지만(변경 이력 설명을 각 지점에서 자기완결적으로 남기려는 의도로 보임), 향후 이 로직이 재차 바뀌면 세 곳을 모두 동기화해야 하는 유지보수 부담이 생긴다.
  - 제안: 상세 근거(§7.5 rationale)는 spec 링크로 위임하고, 코드 내 주석은 "무엇을 하는지 + 어디를 보면 되는지" 수준으로 축약하는 편이 장기적으로 더 관리하기 쉽다. 다만 이 프로젝트는 spec-driven 이고 SoT 인용 관례를 따르는 것으로 보여 현재 스타일이 기존 컨벤션과 일치한다 — 강제 수정 사항은 아님.

- **[INFO]** `markNodeExecutionFailed` 의 `status IN (...)` 조건에 대한 매직 리스트 없음, 의미는 주석으로 충분히 설명됨
  - 위치: `execution-engine.service.ts:2421-2429`
  - 상세: `[WAITING_FOR_INPUT, RUNNING]` 배열은 하드코딩이지만 enum 값을 사용하고 있고 바로 위 주석에서 "claim 이후 RUNNING 도 대상이어야 하는 이유"를 정확히 설명한다. 회귀 방지용 unit 테스트(`execution-engine.service.spec.ts` "핵심 회귀 가드: RUNNING 이 status IN 목록에 포함돼야 claim 후 롤백이 동작")도 함께 추가되어 이 목록이 향후 실수로 축소되는 것을 방지한다. 매직 넘버/문자열 문제로 보지 않는다.

- **[INFO]** 신규 로직의 조건 분기 중첩도는 낮게 유지됨
  - 위치: `continuation-execution.processor.ts:387-395`, `execution-engine.service.ts:854-864`
  - 상세: 원자 claim 도입으로 `process()` 에 조건문이 하나 추가됐지만 얕은 단일 depth 를 유지하고, `claimResumeEntry` 자체도 단순 early-return + 단일 쿼리 형태로 순환 복잡도 증가가 거의 없다. 기존 `switch` dispatch table 구조도 그대로 보존됐다.

- **[INFO]** 테스트의 `makeClaimQb` 헬퍼 도입으로 중복 축소
  - 위치: `execution-engine.service.spec.ts:508-514` 및 사용처(516, 535, 545-546)
  - 상세: query-builder mock 을 반환하는 헬퍼 함수(`makeClaimQb(affected)`)를 만들어 4개 테스트 케이스에서 반복되는 mock 셋업 보일러플레이트를 제거했다. 다만 `markNodeExecutionFailed` 테스트(573-581)에서는 동일 shape 의 mock 을 인라인으로 재작성하고 있어(`makeClaimQb` 를 재사용하지 않음) 약간의 중복이 남아있다.
  - 제안: `markNodeExecutionFailed` 테스트의 인라인 mock 도 `makeClaimQb` 로 대체 가능해 보인다 (사소, 우선순위 낮음).

### 요약
이번 변경은 비원자 SELECT 재검증 가드를 DB 레벨 원자 `UPDATE ... WHERE` claim 으로 교체하는 리팩토링으로, 유지보수성 관점에서 전반적으로 양호하다. 가장 눈에 띄는 개선은 `isNodeExecutionWaiting`(read-only 처럼 오해되는 이름) → `claimResumeEntry`(부수효과가 있는 claim 동작을 명확히 드러내는 이름)로의 리네이밍이며, 관련 테스트(processor.spec.ts, service.spec.ts)와 JSDoc·spec 문서(§7.5, §1.1, §1.2, data-flow §1.4)까지 모두 일관되게 갱신되어 네이밍·문서·테스트 간 드리프트가 없다. 함수 길이·중첩 깊이·순환 복잡도 증가는 미미하며, 새로 추가된 `markNodeExecutionFailed` 의 `status IN (WAITING_FOR_INPUT, RUNNING)` 회귀 조건에는 그 이유를 설명하는 주석과 이를 지키는 전용 unit 테스트가 함께 추가되어 향후 실수 축소를 방지한다. 사소한 개선 여지로는 원자 claim 배경 설명이 클래스 JSDoc·인라인 주석·메서드 JSDoc 세 곳에 유사하게 중복 서술된 점과, 테스트 파일에서 `makeClaimQb` 헬퍼를 한 곳(`markNodeExecutionFailed` 테스트)에서 재사용하지 않고 인라인 중복한 점이 있으나 둘 다 CRITICAL/WARNING 수준은 아니다.

### 위험도
NONE
