# 테스트(Testing) 리뷰 — masking-gate-consolidation

## 발견사항

- **[WARNING]** 신규 공개 헬퍼 `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 에 직접 유닛 테스트가 없다 — 이 통합 작업의 신설 SoT 함수인데 오히려 옛 하위 프리미티브만 테스트된다
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:97`(`redactStoredFieldsForResponse` export), `codebase/backend/src/shared/utils/redact-stored-error.ts:144`(`redactNodeExecutionRow` export). 대응 스펙 파일 `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` 에는 두 함수를 겨눈 `describe` 블록이 전혀 없다(1~171줄 전체 확인 — `redactStoredErrorForResponse`/`redactStoredDataForResponse` 두 개만 다룬다).
  - 상세: `grep -rn "redactStoredFieldsForResponse\|redactNodeExecutionRow" codebase/backend/src --include="*.spec.ts"` 결과 0건 — 두 함수는 오직 `executions.service.spec.ts`·`background-runs.service.spec.ts` 의 서비스 레벨 통합 테스트(TypeORM QueryBuilder mock 경유)를 통해서만 간접 검증된다. 이 PR 의 취지 자체가 "넷이 흩어져 있던 걸 파일 하나(SoT)로 모은다"인데, 정작 그 SoT 파일의 스펙 파일은 갱신되지 않았다 — 다음에 이 헬퍼를 세 번째 소비처에서 재사용할 때, 회귀는 무겁고 먼 서비스 스펙에서만(혹은 못) 잡힌다. 다만 plan 문서(`plan/in-progress/masking-gate-consolidation.md` §결과)가 보고한 뮤테이션 실측(M1 5 RED·M2 2 RED, `tsc` 선검증 통과)은 실제로 존재하는 서비스 레벨 캐너리들과 좌표가 일치해 신뢰할 만하다 — 즉 **동작 회귀 위험은 낮지만, 단위 테스트 지역성(locality)이 빠졌다.**
  - 제안: `redact-stored-error.spec.ts` 에 `describe('redactStoredFieldsForResponse', ...)`/`describe('redactNodeExecutionRow', ...)` 를 추가해 (a) 세 필드 모두 마스킹, (b) 무변화 시 `redactNodeExecutionRow` 가 같은 참조를 반환하는 copy-on-change, (c) 한 필드만 leaky 해도 새 객체를 반환하는지를 함수 자체 레벨에서 직접 고정한다.

- **[WARNING]** `maskIfPresent` 의 `undefined` 방어 분기(JSDoc 이 명시적으로 약속한 런타임 가드)가 어떤 테스트로도 실행되지 않는다
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:113-131` (`maskIfPresent` 함수, docstring: "본문의 `== null` 은 TypeORM 이 런타임에 `undefined` 를 줄 수 있는 경로에 대한 방어").
  - 상세: `grep -rn "inputData: undefined\|outputData: undefined\|error: undefined" codebase/backend/src --include="*.spec.ts"` 로 전체 백엔드를 훑어도 `executions.service.spec.ts`/`background-runs.service.spec.ts` 어디에도 이 세 필드를 `undefined` 로 주입하는 fixture 가 없다 — `null` 케이스(예: `it('error 가 null 이면 null 그대로 통과시킨다 ...')`, `background-runs.service.spec.ts:356`)만 고정돼 있고 `undefined` 분기는 미검증 상태다. `maskIfPresent` 는 export 되지 않아 오직 `redactNodeExecutionRow` 경유로만 테스트 가능하다. 이 갭은 이번 리팩터가 새로 만든 것은 아니다(같은 코드가 종전엔 `executions.service.ts` 안에 인라인돼 있었고 그때도 미검증이었다) — 다만 지금이 "문서화된 보장이 구현보다 넓다"(`redactStoredErrorForResponse` 스펙 파일이 정확히 이 패턴을 다른 함수에 대해 캐너리로 고정해 둔 선례가 있다, `redact-stored-error.spec.ts:54-77`)를 반증할 자연스러운 시점이다 — 헬퍼가 공유 유틸로 승격되며 재사용 가능성이 커졌기 때문.
  - 제안: `redactNodeExecutionRow({ ...row, inputData: undefined } as unknown as NodeExecution)` 형태로 캐스트 주입해 "값을 그대로 통과시킨다"는 문서 약속을 캐너리 테스트로 고정한다 (기존 `redactStoredErrorForResponse` 스펙의 "[레거시]" 캐스트 패턴을 그대로 재사용 가능).

- **[INFO]** 서비스 레벨 간접 커버리지 자체는 두텁고 판별력이 높다 — 회귀 위험 낮음
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` (`⑤`·`⑥-b`·`⑦`·`⑧`·`⑧-b` 등), `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts` (`body nodeExecutions[] 의 inputData·outputData 를 모두 마스킹한다` 등).
  - 상세: `findById`/`findByWorkflow`/`getChain`/`stop`/`toNodeExecutionDto` 각 표면마다 leaky-value 캐너리 + copy-on-change 참조 동일성 단언(`⑥-b`, `codebase/backend/src/modules/executions/executions.service.spec.ts:1318-1372`)이 있고, `inputData`·`outputData` 를 분리해 asserts 하는 이유("합쳐서 하나만 두면 한쪽 필드 소실 회귀를 못 잡는다")까지 주석으로 명시돼 있다. `background-runs.service.ts` 쪽도 `error`/`outputData`/`inputData` 각각을 별개 테스트로 커버한다(`background-runs.service.spec.ts:173,226,356`). plan 문서가 보고한 M1(5 RED)·M2(2 RED) 뮤테이션 결과와 실측 테스트 좌표가 정확히 일치한다.
  - 제안: 없음(참고 기록). 위 WARNING 두 건은 이 두터운 간접 커버리지를 대체하자는 것이 아니라, 신설 SoT 파일 자체에 지역적(local) 단위 테스트를 보완하자는 것이다.

- **[INFO]** `redact-stored-error.spec.ts:105-110` 자매 함수 주석("`error` 스위트와 같은 항목을 각각 겨눈다")의 원칙이 이번에 추가된 두 신규 함수에는 적용되지 않았다
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:105-110`.
  - 상세: 해당 파일 자체가 "두 함수 본문이 동일하다고 한쪽만 검증하면 안 된다"는 원칙을 문서화해 뒀는데, `redactStoredFieldsForResponse`(3필드 조합)와 `redactNodeExecutionRow`(3필드 + copy-on-change)는 그 원칙의 새 적용 대상임에도 이 파일에 반영되지 않았다. 위 첫 WARNING 과 같은 근본 원인.
  - 제안: 위 첫 WARNING 제안과 동일한 커밋에서 함께 해소 가능.

## 요약

이번 통합(`redactStoredFieldsForResponse`/`redactNodeExecutionRow` 신설 + 4개 호출부 교체)의 **동작 회귀 위험은 낮다** — `executions.service.spec.ts`/`background-runs.service.spec.ts` 양쪽에 표면별(findById/findByWorkflow/getChain/stop/nodeExecutions/background-runs) leaky-value 캐너리와 copy-on-change 참조 동일성 단언이 이미 두텁게 존재하고, plan 문서가 보고한 뮤테이션 실측(M1 5 RED·M2 2 RED, `tsc` 선검증)도 그 테스트 좌표와 정확히 일치해 신뢰할 만하다. 다만 **테스트 지역성**은 아쉽다 — 이번에 신설된 두 공개 헬퍼(정작 이 작업의 "SoT" 그 자체)가 co-located 스펙 파일(`redact-stored-error.spec.ts`)에는 전혀 등장하지 않고, 서비스 레벨 통합 테스트로만 간접 검증된다. 특히 JSDoc 이 명시적으로 약속한 `undefined` 런타임 방어 분기는 어떤 테스트로도 실행되지 않는 상태로 남아 있다(리팩터 이전부터의 기존 갭이지만, 헬퍼가 공유 유틸로 승격된 지금이 메꿀 자연스러운 시점). 두 WARNING 모두 몇 줄의 직접 유닛 테스트 추가로 해소 가능하며 머지를 막을 사안은 아니다.

## 위험도
LOW
