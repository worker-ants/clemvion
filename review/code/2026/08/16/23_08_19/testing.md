# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `redactStoredDataForResponse` 신규 함수가 자기 자신의 유닛 테스트 파일을 못 받았다 — 자매 함수 대비 비대칭 커버리지
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` (`redactStoredDataForResponse`, 함수 정의부) / `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` (갱신되지 않음 — 이번 diff 에 포함 안 됨)
  - 상세: 같은 파일의 자매 함수 `redactStoredErrorForResponse` 는 `redact-stored-error.spec.ts` 에 전용 테스트가 있다 — null/undefined→null 정규화, **입력 비변이(mutation 안전)**, 레거시 문자열/숫자 타입 통과, 마스킹 경계(캐너리: 자격증명 없는 연결 문자열 통과·평범한 메시지 무손상) 까지 명시적으로 고정돼 있다(특히 "레거시 형태" 테스트는 그 파일 자체 주석에 *"문서한 보장이 구현보다 넓다"* 형태의 재발 방지로 남아 있음). 반면 이번에 추가된 `redactStoredDataForResponse` 는 **같은 프리미티브·같은 원칙**이라고 JSDoc 이 명시하면서도(`@returns 마스킹된 복사본 … 입력은 변이되지 않고 … 입력이 없으면 null`) 이 세 보장 중 어느 것도 함수 단위로 직접 검증되지 않는다. 현재 커버리지는 `executions.service.spec.ts`/`background-runs.service.spec.ts` 의 서비스-레벨 통합 테스트뿐이고, 그나마도:
    - null/undefined 입력 → `null` 반환을 명시적으로 단언하는 테스트 없음(디폴트 fixture 가 `null` 이라 크래시하지 않는다는 정도의 암묵적 스모크 테스트만 존재).
    - **입력 비변이**는 `executions.service.spec.ts` ⑦번 테스트(`DB 원문 불변`)가 유일하게 근접하지만, 그 테스트는 **마스킹이 아예 발생하지 않는 케이스**(`{orderId, qty}`, 시크릿 없음)만 쓴다 — copy-on-change 라 원본이 그대로 재사용되는 자명한 경로다. `redactStoredErrorForResponse` 쪽 테스트처럼 **실제로 마스킹이 일어나는 입력**(예: `LEAKY_IN`)을 넣고 원본 객체가 변이되지 않았는지 직접 확인하는 테스트가 `inputData`/`outputData` 쪽엔 없다.
  - 제안: `redact-stored-error.spec.ts` 에 `describe('redactStoredDataForResponse', …)` 를 추가해 null/undefined 정규화·비변이(마스킹 발생 케이스로)·형태 보존을 직접 고정한다. 자매 함수의 기존 테스트를 거의 그대로 복사-치환하면 된다.

- **[WARNING]** `findById` `nodeExecutions[]` 의 확장된 3-컬럼 copy-on-change 조건이 `inputData`/`outputData` 변화만으로 갈리는 경로를 참조-동일성으로 검증하지 않는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `findById` 안의 `reconciledNodeExecutions` map(`error`/`inputData`/`outputData` 세 필드 동시 비교 후 `? ne : { ...ne, inputData, outputData, error }` 삼항) / `codebase/backend/src/modules/executions/executions.service.spec.ts` `⑤`·`⑤-c` 테스트
  - 상세: 이번 변경은 종전 `ne.error == null ? ne : {...ne, error}` 단일 필드 조건을 `inputData === ne.inputData && outputData === ne.outputData && error === ne.error` 3필드 조건으로 넓혔다. 그런데 `⑤-c`(*"copy-on-change 를 참조 동일성으로 고정"*) 테스트의 두 fixture(`clean`/`failed`)는 **`inputData`/`outputData` 키 자체가 없다**(둘 다 `undefined`) — 즉 이 테스트는 `error` 변화만 관측하고 새로 추가된 두 필드의 등가 비교 분기는 전혀 건드리지 않는다. `⑤`(*"두 컬럼도 마스킹"*) 테스트는 최종 문자열 내용만 `JSON.stringify` 로 확인해 참조 동일성은 보지 않는다. 결과적으로 `inputData === ne.inputData` 나 `outputData === ne.outputData` 항이 조건에서 빠지거나(예: 항상 참으로 단축) 뒤바뀌는 뮤턴트가 있어도 **어떤 기존 테스트도 RED 로 안 바뀐다** — 이 저장소가 반복해 겪은 "자매 중 하나만" 형태를 이번엔 "3필드 중 2필드만" 형태로 재현할 위험이 있다.
  - 제안: `⑤-c` 곁에, `inputData` 또는 `outputData` 만 leaky 하고 `error` 는 `null` 인 행과 셋 다 clean 한 행을 섞어 각각 `toBe`/`not.toBe` 로 참조 동일성을 직접 단언하는 테스트를 추가한다(예: `error`/`outputData` 는 무변화, `inputData` 만 leaky → 새 객체 반환 + `outputData` 는 원본 참조 유지 같은 필드-단위 분리 확인까지 가능하면 더 좋음).

- **[INFO]** `stop()` 경로에서 `inputData` 마스킹 자체는 전용 테스트로 직접 단언되지 않는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` `④ stop — 취소 응답` 테스트
  - 상세: `④` 테스트는 `cancelled` fixture 에 `outputData: {...LEAKY_OUT}` 만 주입하고 `inputData` 는 `baseFake` 디폴트(`null`)로 둔 채 `outputData` 마스킹만 단언한다. `stop` 이 `toResponseExecution` 공통 관문을 재사용하므로 실제 마스킹 로직 자체는 `findById`/`getChain` 쪽 테스트로 간접 커버되긴 하지만, "`stop` 표면이 두 컬럼 다 가린다"는 의도를 그 테스트 자체 안에서 대칭적으로 보여주진 않는다.
  - 제안: 필수는 아니나, `cancelled` fixture 에 `inputData: {...LEAKY_IN}` 도 함께 넣어 `stop` 테스트 하나가 두 컬럼을 모두 겨냥하도록 대칭을 맞추면 의도가 더 명확해진다.

- **[INFO]** `emitKbEvent`/`emitBackgroundRunEvent` 등 나머지 `broadcastToChannel` 호출부는 새 값-패턴 마스킹 초크포인트(`maskWireEnvelope`) 밖에 있고, 그 스코프 경계를 고정하는 테스트/캐너리가 없다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — `emitKbEvent`(라인 자리 `broadcastToChannel` 호출), `emitBackgroundRunEvent`
  - 상세: 이번 PR 은 plan 문서(`plan/in-progress/eia-fanout-and-internal-data-masking.md` §A)에서 `executionEventSubject.next` 가 "정확히 2곳"이라고 명시적으로 실측·범위를 좁혔고, 실제로 `maskWireEnvelope` 는 `emitExecutionEvent`/`emitNodeEvent` 에만 걸려 있다. `emitKbEvent`/`emitBackgroundRunEvent` 는 `sanitizePayloadForWs`(키-이름 기반)만 거치고 값-패턴 마스킹은 받지 않는데, 이게 "의도된 범위 밖"인지 "빠뜨린 자매"인지를 테스트가 구분해 주지 않는다. 이 저장소가 emit 경로 전수화에서 반복적으로 걸린 이력(§A 자체가 그 실측 기록)을 감안하면, 두 경로가 자유 텍스트 에러/출력을 담지 않는다는 전제가 코드 주석/테스트 어디에도 캐너리로 고정돼 있지 않다.
  - 제안: 필수는 아니나(현재 diff 범위 밖 결정이 plan 문서에 명시돼 있음), `emitKbEvent`/`emitBackgroundRunEvent` 가 자유 텍스트 에러 페이로드를 나르지 않는다는 전제를 짧은 주석이나 회귀 테스트로 고정해 두면 향후 그 경로가 확장될 때 조용히 빠지는 것을 막을 수 있다.

## 요약

핵심 마스킹 로직(값-패턴 credential 마스커의 `preserveKeys`/마커-보존 확장, WS wire/fanout 초크포인트, `Execution`/`NodeExecution`/`BackgroundRun` 읽기 표면 전수)은 표면별로 독립된 테스트가 촘촘히 배치돼 있고, mock 은 `beforeEach` 마다 새로 만들어져 테스트 간 격리도 양호하며, copy-on-change·마커-멱등·preserveKeys·llmCalls 예외 같은 미묘한 계약들도 대부분 참조 동일성·정확한 값 비교로 직접 고정돼 있다. 다만 이번에 새로 추가된 `redactStoredDataForResponse` 는 자매 함수(`redactStoredErrorForResponse`)가 가진 전용 유닛 테스트(null 정규화·비변이·레거시 타입 보존)를 못 받고 서비스-레벨 통합 테스트로만 간접 커버되며, `findById` `nodeExecutions[]` 의 확장된 3-컬럼 copy-on-change 조건도 새로 추가된 두 필드(`inputData`/`outputData`)만의 변화를 참조 동일성으로 가르는 테스트가 빠져 있다 — 둘 다 이 저장소가 반복해 겪어 온 "자매 중 하나만 검증됨" 패턴의 축소판이라 WARNING 으로 분류했다. 두 항목 모두 기존 테스트 패턴을 그대로 복제-치환하는 수준의 낮은 비용으로 닫을 수 있다.

## 위험도

MEDIUM
