# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** JSDoc 블록이 연속으로 쌓여 앞 블록이 어느 심볼에도 연결되지 않는다(툴링 상 "떠 있는" 주석)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:95` (큰 설명 블록 시작) ~ `:118` (`VALUE_MASK_MARKER` 선언)
  - 상세: 95~116번째 줄에 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 세 마커를 함께 설명하는 상세 JSDoc(마커-계층 대응표, "안전 방향은 한쪽으로만 열린다" 등 중요한 계약 설명 포함)이 있다. 그런데 바로 다음 줄(117)에 또 다른 한 줄짜리 JSDoc(`/** 값-패턴 마스커가 남기는 마커. */`)이 끼어들고 그 아래(118)에 `export const VALUE_MASK_MARKER = '***';` 가 온다. TSDoc/IDE hover 등 대부분의 문서화 툴링은 심볼 바로 위의 **마지막** 주석 블록만 그 심볼에 연결하므로, 95~116의 풍부한 컨텍스트(웹훅 ingestion·WS 키-마스킹·깊이 상한이 각각 남기는 마커와 그 계약)는 세 상수 중 어디에도 공식적으로 연결되지 않아 IDE 상에서 조회되지 않는다. 소스 파일을 처음부터 끝까지 읽는 사람만 그 맥락을 얻는다.
  - 제안: 큰 설명 블록을 `MASKED_MARKERS` 선언(또는 `isMaskedMarker` 함수) 바로 위로 옮기거나, 세 상수를 하나의 JSDoc 블록 아래 묶고 각 상수에는 `//` 인라인 주석만 붙인다.

- **[INFO]** 런타임에 참조되지 않는 "문서 전용" 상수를 `void` 로 살려두는 관용구
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:83-87` (`MASKED_INPUT_DATA_REASON` 선언과 `void MASKED_INPUT_DATA_REASON;`)
  - 상세: `MASKED_INPUT_DATA_REASON` 은 런타임에 전혀 읽히지 않고, 같은 파일 내 3곳과 `execution-response.dto.ts`·`background-runs.service.spec.ts`·`executions.service.spec.ts` 등 여러 파일에서 `{@link}`/평문 텍스트로만 이름이 인용되는 "문서 앵커"다. unused-var 린트/컴파일 경고를 피하려고 `void MASKED_INPUT_DATA_REASON;` 을 붙였는데, 이 저장소에서 흔치 않은 패턴이라 향후 편집자가 "죽은 코드"로 오인해 삭제할 위험이 있다(바로 위 주석 `// 이 상수는 JSDoc 앵커 전용이다 — 런타임 참조가 없어도 제거하지 않는다.` 가 그 위험을 완화하긴 한다).
  - 제안: 상수를 `export` 해 다른 파일들이 문자열이 아니라 실제 import 로 참조하게 하거나(그러면 lint 도 자연히 만족), 컴파일 대상이 아닌 일반 block comment 로 대체한다.

- **[INFO]** 마스킹 관문 로직·문서가 `executions.service.ts`(1,124줄)에 계속 누적
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (파일 전체, 특히 `toResponseExecution`/`maskIfPresent`/`MASKED_INPUT_DATA_REASON` 주변 `:57-168`, `:1048-1097`)
  - 상세: 이번 diff 로 순증 약 150줄이 더해지며 egress 마스킹 관련 코드·문서(헬퍼 `maskIfPresent`, 상수 `MASKED_INPUT_DATA_REASON`, 응답 타입 `ResponseExecution`/`ResponseNodeExecution`, 관문 `toResponseExecution`)가 이미 여러 책임(재실행, 체인, stop, 목록, 상세 조회)을 가진 서비스 파일에 계속 쌓이고 있다. 현재는 정본 표(§ "읽기 표면 목록")와 헬퍼로 잘 억제돼 있어 당장 문제는 아니나, 파일이 계속 커지는 추세이므로 다음 마스킹 관련 변경 시 이 관문 묶음을 별도 유틸/모듈로 추출하는 것을 고려할 시점이다.
  - 제안: 즉시 조치 불필요. 후속 변경에서 규모가 더 커지면 `execution-response-masking.ts` 류로 분리 검토.

## 요약

이번 변경은 `Execution.error`/`inputData`/`outputData` 세 컬럼과 WS emit 두 경로(wire·fanout)에 걸친 값-패턴 마스킹을 일관되게 적용하며, 자매 표면 누락(과거 반복된 "자매 넷 중 하나만" 결함 클래스)을 구조적으로 막기 위해 공통 관문(`toResponseExecution`, `maskWireEnvelope`/`toFanoutEnvelope`, `maskIfPresent`, `redactStoredDataForResponse`)으로 수렴시켰다. 함수 분리가 적절하고(예: `deepRedactCore` 로 두 공개 진입점 `deepRedactSecrets`/`deepRedactSecretsPreserving` 의 로직을 통합), 네이밍이 목적을 명확히 드러내며(`maskIfPresent`, `toFanoutEnvelope`, `isMaskedMarker`), 각 결정(왜 `inputData` 는 마스킹 대상이 아닌지, 왜 마커를 재마스킹하지 않는지, 왜 두 함수가 형태는 같지만 별도 유지되는지)에 근거를 남겨 다음 편집자가 같은 실수를 반복하지 않도록 설계됐다. 함수 길이·중첩·매직 넘버·중복 코드 관점에서 새로 도입된 결함은 없으며, 발견된 항목은 모두 사소한 문서 배치/스타일 수준(INFO)이다. 테스트 스위트의 표면별 개별 검증 반복(예: `redactStoredErrorForResponse`/`redactStoredDataForResponse` 자매 describe)은 이 저장소가 반복 겪은 "자매 중 하나만 통과" 회귀를 막기 위한 의도된 설계로, RESOLUTION.md 에도 "강제 통합 지양"으로 명시돼 있어 중복이 아닌 방어로 판단해 별도 지적하지 않았다.

## 위험도

LOW
