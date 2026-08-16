# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** 마스킹 마커 문자열(`'[REDACTED]'` / `'[REDACTED_DEPTH]'`)이 두 파일에 각각 리터럴로 중복돼 있고, 이번 PR 의 핵심 계약(마커를 다시 덮지 않기)이 그 리터럴 일치에 의존한다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:117-121` (`MASKED_MARKERS = new Set(['***', '[REDACTED]', '[REDACTED_DEPTH]'])`) vs `codebase/backend/src/modules/websocket/websocket.service.ts:102`(`return '[REDACTED_DEPTH]';`)·`:132`(`result[k] = '[REDACTED]';`)
  - 상세: `websocket.service.ts` 는 애초에 이 두 마커를 이름 있는 상수로 export 하지 않고 `sanitizeInner`/`sanitizePayloadForWs` 안에 인라인 리터럴로 갖고 있다. 이번 diff 가 추가한 `MASKED_MARKERS` 는 그 값을 **다른 파일에서 다시 타이핑**해 맞춘 것이라, 둘 사이에 import 관계나 타입 체크가 전혀 없다. 나중에 누군가 WS 레이어의 마커 문자열을 바꾸면(`sanitizeInner`), `MASKED_MARKERS` 는 옛 문자열을 계속 보존 대상으로 오인하고 새 문자열은 인식 못 해 **재마스킹**(`***` 로 덮어씀)한다 — 이 PR 이 정확히 막으려는 그 회귀가 조용히 재발한다. 캐너리 테스트도 같은 리터럴을 하드코딩해 쓰므로(예: `sanitize-error-message.spec.ts` 의 `'[REDACTED]'`) 한쪽만 바뀌면 테스트가 잡아주지 못할 수 있다.
  - 제안: `'[REDACTED]'`/`'[REDACTED_DEPTH]'` 를 `websocket.service.ts` (또는 두 파일이 공유하는 위치)에서 export 된 이름 있는 상수로 승격하고, `MASKED_MARKERS` 가 그 상수를 import 해 구성하도록 바꾼다. 최소한 두 파일이 같은 리터럴에 의존한다는 사실을 서로의 JSDoc 에서 `{@link}` 로 교차 참조라도 남긴다.

- **[WARNING]** `findById` 의 node-level 마스킹 콜백이 "null 이면 그대로, 아니면 redact" 패턴을 3번 반복하고 그 결과를 다시 3항 비교로 합친다 — 필드가 늘 때마다 이 반복이 선형으로 늘어난다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:655-680` (`reconcilePreParkWaitingStatus(nodeExecutions).map<ResponseNodeExecution>((ne) => {...})`)
  - 상세: `inputData`/`outputData`/`error` 세 필드 각각에 대해 `ne.X == null ? ne.X : redactStoredXForResponse(ne.X)` 가 반복되고, 마지막에 `inputData === ne.inputData && outputData === ne.outputData && error === ne.error` 로 copy-on-change 를 수동 재구성한다. 이 파일 자신의 주석이 *"이 저장소가 반복해 겪은 자매 넷 중 하나만"* 을 여러 번 경계하는데, 정작 이 콜백은 같은 형태의 손-작성 반복을 세 벌 두고 있어 네 번째 마스킹 대상 컬럼이 추가될 때 이 세 줄+비교 한 줄을 또 손으로 늘려야 한다.
  - 제안: `function maskIfPresent<T>(value: T | null | undefined, redact: (v: T) => T | null): T | null | undefined { return value == null ? value : redact(value); }` 같은 작은 헬퍼로 3회 반복을 축약하고, `copy-on-change` 비교도 `[inputData, outputData, error]` 배열 순회로 일반화하면 필드 추가 시 한 줄만 늘어난다.

- **[INFO]** "세 컬럼(`error`/`inputData`/`outputData`) 값을 redact 해서 반환 객체에 얹는" 3줄짜리 블록이 서로 다른 두 파일, 세 곳에서 문자 그대로 반복된다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:978-980`(`toExecutionDto`) 및 `:1042-1044`(`toResponseExecution`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:304-306`(`toNodeExecutionDto`)
  - 상세: 세 곳 모두 `inputData: redactStoredDataForResponse(x.inputData), outputData: redactStoredDataForResponse(x.outputData), error: redactStoredErrorForResponse(x.error),` 형태로 동일하다(바인딩되는 변수명만 `execution`/`rest`/`row` 로 다름). 이 PR 의 설계 의도(각 게이트가 독립적으로 호출해야 "하나만 빠짐"을 막는다)를 존중하면 강제 통합은 오히려 위험하지만, 최소한 반복되는 3줄 자체를 `{ error, inputData, outputData }` 만 반환하는 작은 순수 함수로 뽑아 각 게이트가 그 함수를 부르고 spread 하는 형태(`...redactColumns(row)`)로 바꾸면 반복 타이핑 실수(예: 한 곳만 `redactStoredDataForResponse` 대신 `redactStoredErrorForResponse` 를 오타로 씀) 위험이 줄어들고, 게이트 "호출 여부"는 여전히 3곳에서 독립적으로 남는다.
  - 제안: 위와 같이 3줄 블록만 공유 헬퍼로 뽑고, "호출한다/안 한다"의 개별성은 그대로 유지.

- **[INFO]** `redactStoredErrorForResponse`/`redactStoredDataForResponse` 두 함수의 본문이 매개변수 이름(`err` vs `data`)만 다르고 완전히 동일하다.
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:28-35`, `:66-71`
  - 상세: JSDoc 은 두 함수가 "자매 · 같은 프리미티브 · 같은 원칙, 대상 컬럼만 다르다"고 명시적으로 설명하고 있어 의도된 분리임을 알 수 있고, 실제 마스킹 로직은 `deepRedactSecrets` 하나로 이미 공유되므로 위험은 낮다. 다만 두 함수의 4줄짜리 몸체(`null`/`undefined` 가드 + 캐스트)까지 완전히 동일해, 향후 가드 조건을 바꿀 일이 생기면(예: 빈 객체 `{}` 도 `null` 로 취급하도록) 두 곳을 각각 고쳐야 하고 한쪽만 고치면 조용히 갈린다.
  - 제안: 굳이 별도 식별자를 유지해야 한다면(호출부 가독성·미래 분기 여지) `redactStoredDataForResponse` 가 `redactStoredErrorForResponse` 를 내부적으로 호출하도록(또는 공통 사설 헬퍼를 감싸도록) 바꿔 가드 로직의 단일 출처를 만드는 것을 고려.

- **[INFO]** 한 파일(`websocket.service.ts`) 안에서 "민감정보 노출을 줄인다"는 유사한 목적의 연산에 `sanitize`(`sanitizePayloadForWs`) / `mask`(`maskWireEnvelope`) / `redact`(import 된 `deepRedactSecretsPreserving`) / `strip`(`stripExternalOnlyFields`) 네 가지 동사가 섞여 쓰인다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:100`(`sanitizePayloadForWs`), `:380-387`(`maskWireEnvelope`, 내부에서 `deepRedactSecretsPreserving` 호출), `:401-410`(`toFanoutEnvelope`, 내부에서 `stripExternalOnlyFields` 호출)
  - 상세: 각 함수는 JSDoc 으로 상세히 구분되어 있어(키-이름 기반 vs 값-패턴 기반 vs 필드 제거) 실제 혼동 위험은 문서로 완화돼 있지만, 처음 이 파일을 읽는 사람 입장에서 "sanitize 와 mask 와 redact 가 왜 다른 동사인가"를 문서를 다 읽기 전까지는 알기 어렵다. `maskWireEnvelope` 라는 이름이 내부적으로 부르는 함수는 `redact*` 계열(`deepRedactSecretsPreserving`)이라, 메서드명의 동사(`mask`)와 위임 대상의 동사(`redact`)가 어긋나는 점도 사소한 불일치다.
  - 제안: 필수는 아니나, 이 파일 상단에 "이 파일에서 쓰는 네 동사의 역할 구분표"를 한 번만 두거나(이미 개별 JSDoc 은 있으니 요약 인덱스만 추가), 최소한 `maskWireEnvelope` 를 `redactWireEnvelope` 로 맞춰 위임 대상과 동사를 일치시키는 것을 고려.

## 요약

이번 diff 는 `Execution.error` 마스킹(이미 머지된 #1179)의 자매 컬럼(`inputData`/`outputData`)과 WS fanout/wire 값-패턴 마스킹을 새로 추가하는 작업으로, 각 함수·타입에 "왜 이렇게 했는가"를 촘촘히 남기는 이 저장소의 문서화 관행을 그대로 따르고 있고 네이밍도 기존 `redact*`/`sanitize*`/`strip*` 패밀리와 일관된다. 다만 (1) 이 PR 의 핵심 계약인 "마스킹 마커를 다시 덮지 않는다"가 두 파일에 흩어진 하드코딩 리터럴 일치에 의존하는 점, (2) `findById` 의 node-level 마스킹 콜백에서 같은 null-guard-redact 패턴이 3회 손으로 반복되는 점이 향후 필드 추가·마커 변경 시 조용히 갈릴 수 있는 지점으로 남아 있다. 나머지는 이미 `deepRedactSecrets` 로 로직 공유가 이뤄진 상태에서의 사소한 표면 중복·동사 선택 불일치 수준이라 위험도는 낮다.

## 위험도
LOW
