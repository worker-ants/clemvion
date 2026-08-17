# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[INFO]** 세 마커 상수를 함께 설명하는 풍부한 JSDoc 블록이 어느 심볼에도 공식적으로 귀속되지 않는다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:95`-`116` (마커 계층·계약 설명 블록) 직후 `:117`(별도 한 줄 JSDoc) → `:118`(`VALUE_MASK_MARKER` 선언)
  - 상세: 95~116줄에 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 세 마커의 계층 대응표와 "안전 방향은 한쪽으로만 열린다" 등 중요한 계약이 담긴 JSDoc 이 있다. 그런데 바로 다음 줄(117)에 또 다른 한 줄짜리 JSDoc(`/** 값-패턴 마스커가 남기는 마커. */`)이 끼어들고 그 아래(118)에 `export const VALUE_MASK_MARKER = '***';` 가 온다. TSDoc/IDE hover 등 대부분의 문서화 툴링은 심볼 바로 위의 **마지막** 주석 블록만 그 심볼에 연결하므로, 95~116의 컨텍스트는 세 상수 중 어디에도 연결되지 않는다. 이 항목은 앞선 리뷰 라운드(`00_23_57`)에서도 지적됐고 팀은 "typedoc 미도입이라 무해"로 조치 불요 처분했다 — 이번 diff 에서도 그 형태가 그대로 유지된다.
  - 제안: 조치 불요(기존 처분 유지). typedoc/tsdoc 렌더링을 도입하게 되면 그때 큰 블록을 `MASKED_MARKERS` 선언 위로 옮기거나 세 상수를 하나의 블록 아래 묶는 것을 고려.

- **[INFO]** 런타임 미참조 상수를 `void` 로 살려 lint 를 통과시키는 관용구
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:93`-`94` (`// 이 상수는 JSDoc 앵커 전용이다 — 런타임 참조가 없어도 제거하지 않는다.` + `void MASKED_INPUT_DATA_REASON;`)
  - 상세: `MASKED_INPUT_DATA_REASON` 은 여러 파일에서 `{@link}`/평문으로만 인용되는 "문서 앵커"라 `void` 로 unused-var 경고를 피했다. 이 저장소에 흔치 않은 패턴이라 향후 편집자가 "죽은 코드"로 오인해 지울 위험이 있으나, 바로 위 주석이 그 위험을 명시적으로 완화한다. 이전 라운드에서도 "상수를 지우면 참조가 끊기도록 의도한 것"으로 조치 불요 처분됨.
  - 제안: 조치 불요. 다만 재발 방지가 더 필요해지면 상수를 `export` 해 다른 파일들이 문자열 인용 대신 실제 import 로 참조하게 하는 대안이 있다.

- **[INFO]** 마스킹 관문 로직·문서가 이미 여러 책임을 가진 `executions.service.ts` 에 계속 누적
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` 전체(1,140줄), 특히 `:57`-`123`(`MASKED_INPUT_DATA_REASON`, `maskIfPresent`), `:139`-`176`(`ResponseExecution`/`ResponseNodeExecution` 타입), `:1064`-`1113`(`toResponseExecution`)
  - 상세: 이번 diff 로 마스킹 관련 코드·문서가 재실행/체인/stop/목록/상세 조회를 이미 담당하던 서비스 파일에 순증 ~150줄 더해졌다. 현재는 `toResponseExecution` JSDoc 의 "읽기 표면 목록" 표를 정본으로 삼아 억제되고 있어 당장 문제는 아니나, 파일이 계속 커지는 추세라 다음 마스킹 관련 변경 시 이 관문 묶음을 별도 유틸(`execution-response-masking.ts` 류)로 추출하는 것을 검토할 시점이 가까워지고 있다.
  - 제안: 즉시 조치 불필요. 규모가 더 커지면 분리 검토.

- **[INFO]** `redactStoredErrorForResponse`/`redactStoredDataForResponse` 두 공개 함수의 본문이 문자 그대로 동일하다
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:28`-`35`, `:66`-`71`
  - 상세: 두 함수 모두 `if (x === null || x === undefined) return null; return deepRedactSecrets(x) as Record<string, unknown>;` 로 로직이 동일하고 이름과 대상 컬럼(문서)만 다르다. 표면적으로는 DRY 위반처럼 보이지만, 같은 파일의 `.spec.ts`(`redact-stored-error.spec.ts:105`-`171`)가 두 함수를 **독립 describe 로 각각** 고정하고 있고, 이 저장소가 반복 겪은 "한쪽 관문만 고치고 자매가 갈리는" 결함 클래스를 막기 위한 의도적 선택으로 읽힌다(같은 판단이 `redactStoredDataForResponse` JSDoc 의 "자매 프리미티브" 서술에도 나타난다). 강제 통합이 오히려 향후 두 컬럼의 마스킹 정책이 갈릴 때(예: `error` 만 패턴이 확장되는 경우) 시그니처를 억지로 맞추는 부담을 만들 수 있어, 현재 상태를 결함으로 보지 않는다.
  - 제안: 조치 불요. 두 함수가 다시 합쳐질 필요가 생기면(예: 세 번째 자매 컬럼 등장) 그때 공통 헬퍼로 승격 검토.

## 요약

이번 diff(`Execution`/`NodeExecution`/`BackgroundRun` 의 `inputData`/`outputData` egress 마스킹 확장 + WS emit 값-패턴 마스킹 초크포인트 도입)는 유지보수성 관점에서 전반적으로 견고하다. 공통 관문(`maskIfPresent`, `toResponseExecution`, `maskWireEnvelope`/`toFanoutEnvelope`, `redactStoredDataForResponse`, `deepRedactCore`)으로 로직을 수렴시켜 이 저장소가 반복 겪어 온 "자매 표면 중 하나만 고쳐 갈라지는" 결함 클래스를 구조적으로 억제했고, 함수 분리가 목적에 맞으며(`deepRedactCore` 로 `deepRedactSecrets`/`deepRedactSecretsPreserving` 두 공개 진입점의 로직을 통합), 네이밍이 의도를 명확히 드러낸다(`maskIfPresent`, `toFanoutEnvelope`, `isMaskedMarker`, `WIRE_PRESERVED_FIELDS`). 각 비직관적 결정(왜 `Execution.inputData` 만 마스킹 예외인지, 왜 마커를 재마스킹하지 않는지, 왜 두 자매 함수를 통합하지 않는지, 왜 `maskIfPresent` 가 제네릭을 쓰지 않는지)에 소스 추적 가능한 근거를 남겨 다음 편집자가 같은 실수를 반복하지 않도록 설계됐다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 관점에서 새로 도입된 결함은 없다(가장 복잡한 신규 함수 `deepRedactObject`/`maskIfPresent` 도 분기가 얕고 각 분기에 근거 주석이 붙어 있다). 발견된 항목은 모두 이전 리뷰 라운드에서 이미 검토·처분(대부분 "조치 불요")된 저위험 사항의 재확인 수준(INFO)이며, 이번 diff 가 새로 만든 문제는 아니다. 다만 `executions.service.ts` 가 마스킹 로직을 계속 흡수하며 커지는 추세는 이번 라운드에도 유효한 관찰 포인트로 재확인해 둔다.

## 위험도
LOW
