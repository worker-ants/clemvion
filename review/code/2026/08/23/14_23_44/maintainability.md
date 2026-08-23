# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** 신규 공유 헬퍼 `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 에 대한 직접(colocated) 유닛 테스트 부재 — 같은 파일의 기존 패턴과 불일치
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:97`(`redactStoredFieldsForResponse`), `:144`(`redactNodeExecutionRow`) / `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:12`,`:112`
  - 상세: 같은 파일(`redact-stored-error.spec.ts`)은 기존 두 함수 `redactStoredErrorForResponse`(12번째 줄 `describe`)· `redactStoredDataForResponse`(112번째 줄 `describe`) 각각에 대해 전용 `describe` 블록을 두고 있다. 이번 PR 이 신설한 두 함수 — 이 PR 의 핵심 목적인 "4곳 분산 → 1곳 SoT" 통합의 실체 — 는 이 spec 파일에 대응하는 `describe` 블록이 없다(grep 결과 0건). 현재는 `executions.service.spec.ts`/`background-runs.service.spec.ts` 쪽 4개 표면 테스트(및 plan 문서에 기록된 수동 뮤테이션 실측)로 간접 검증되는데, 이는 이 통합이 없애려던 바로 그 문제(회귀가 여러 호출부에 흩어진 테스트를 거쳐야만 드러남)를 테스트 레이어에서는 그대로 남긴다. 헬퍼 계약(부재→`null` 정규화 vs 참조 보존)이 바뀔 때 원인 진단이 호출부 4곳의 실패를 역추적해야 하는 구조.
  - 제안: `redact-stored-error.spec.ts` 에 `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 전용 `describe` 블록을 추가해 부재→null 정규화, copy-on-change(참조 보존) 계약을 헬퍼 자리에서 직접 고정한다. 기존 뮤테이션 실측(M1/M2)을 그대로 유닛 테스트 케이스로 옮기면 비용이 낮다.

- **[INFO]** `redactNodeExecutionRow` 만 "ForResponse" 접미사 규약을 따르지 않음
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:144`
  - 상세: 같은 파일의 나머지 세 export — `redactStoredErrorForResponse`, `redactStoredDataForResponse`, `redactStoredFieldsForResponse` — 는 모두 "…ForResponse" 접미사로 "이건 egress 응답 조립용" 임을 이름에 드러낸다. 반면 `redactNodeExecutionRow` 만 그 접미사가 없어 네이밍 패턴이 셋 중 하나만 깨진다. 같은 파일·같은 목적(egress 마스킹)의 형제 함수군에서 명명 규칙이 갈리면, 다음에 다섯 번째 헬퍼를 추가하는 사람이 어느 쪽 규칙을 따를지 판단 기준이 없어진다.
  - 제안: 필수는 아니나 `redactNodeExecutionRowForResponse` 등으로 접미사를 맞추거나, 반대로 "ForResponse" 접미사 자체가 "행 전체가 아니라 값 반환" 을 뜻한다는 규칙을 docstring 에 한 줄 명시해 의도적 예외임을 밝히면 향후 혼동을 줄인다.

- **[INFO]** `redactStoredFieldsForResponse` 반환 타입이 `ResponseExecution`/`ResponseNodeExecution` 의 3필드 부분집합과 구조적으로 동일하나 별도로 인라인 선언됨
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:97`-`105` (함수 시그니처), 비교 대상: `codebase/backend/src/modules/executions/executions.service.ts:90`-`99`(`ResponseExecution`), `:108`-`115`(`ResponseNodeExecution`)
  - 상세: `{ inputData: Record<string, unknown> | null; outputData: ...; error: ... }` 형태가 헬퍼의 파라미터 타입·반환 타입, 그리고 `ResponseExecution`/`ResponseNodeExecution` 타입 정의에 각각 손으로 반복된다(현재 3곳). 세 컬럼 중 하나가 타입을 바꾸면(예: `error` 가 배열도 허용하도록 확장) 이 세 자리를 모두 손으로 맞춰야 한다 — 이 PR 이 런타임 로직에서 없애려는 "손 동기화" 패턴이 타입 레이어에는 그대로 남아 있다.
  - 제안: `Pick<ResponseExecution, 'inputData' | 'outputData' | 'error'>` 형태로 반환 타입을 파생시키거나, 반대로 공유 `MaskedTriple` 타입 별칭을 하나 두고 세 자리 모두 그걸 참조하게 하면 드리프트 위험이 줄어든다. 우선순위는 낮음(현재 세 컬럼 타입이 사실상 고정적).

## 요약

세 파일(`background-runs.service.ts`, `executions.service.ts`, `redact-stored-error.ts`)에 걸친 이번 변경은 4곳에 흩어져 "사람이 읽는 주석 표"로만 동기화되던 `inputData`/`outputData`/`error` 마스킹 로직을 `redact-stored-error.ts` 한 파일의 헬퍼 두 개(`redactStoredFieldsForResponse`, `redactNodeExecutionRow`)로 응집시킨 리팩터다. 각 함수는 짧고 단일 책임을 지키며, 왜 헬퍼가 하나가 아니라 둘인지(`null` 정규화 vs copy-on-change 참조 보존) — 그리고 왜 그 차이를 뭉개면 안 되는지를 정본 docstring 한 곳에 매우 상세히 남겨 향후 "자매 표면 누락" 류 재발을 구조적으로 막았다. 매직 넘버·중첩·순환 복잡도·네이밍 문제는 실질적으로 없고, prettier/eslint 도 클린하다. 유일하게 눈에 띄는 간극은 이 통합의 핵심 산출물인 신규 헬퍼 두 개가 같은 스펙 파일 안에서 형제 함수들과 달리 전용 유닛 테스트를 갖지 못해 "코드는 SoT 하나로 합쳤지만 검증은 여전히 4개 호출부를 거쳐야 한다"는 비대칭이 남는다는 점이며, 나머지는 사소한 네이밍·타입 중복 관찰에 그친다.

## 위험도
LOW
