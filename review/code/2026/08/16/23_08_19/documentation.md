# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 가 이번 변경(WS fanout 값-패턴 마스킹 신설 + `inputData`/`outputData` egress 마스킹 4~5개 표면)에 대해 갱신되지 않았다 — 이 저장소의 확립된 관례를 깬다.
  - 위치: `CHANGELOG.md` (이번 diff 에 포함되지 않음 — `git diff origin/main --stat -- CHANGELOG.md` 결과 무변경 확인)
  - 상세: `CHANGELOG.md` 는 `## Unreleased — ...` 항목 87개를 갖는, 이 저장소에서 실제로 지켜지는 관례다. 특히 바로 직전에 머지된 자매 PR (`#1179`, `f5351e9c2`, 같은 `Execution.error` 읽기 경로 마스킹)은 "⚠️ wire 변화" 캐비엇을 포함한 상세 항목을 남겼고, 그 이전의 종결 이벤트 마스킹(`#1177`)도 마찬가지다. `CHANGELOG.md:176`의 `## Unreleased — (보안) llmCalls raw 프롬프트가 외부로 새고 있었다 — fanout(depth-1) + REST 스냅샷` 항목은 이번 diff 의 §A(WS node/execution emit 값-마스킹 신설)와 **정확히 같은 클래스**(자유 텍스트 값 안의 자격증명이 fanout 으로 새던 결함)다. 이번 diff 는 응답 바이트가 바뀌는 wire-visible 변경(REST `inputData`/`outputData`·WS wire+fanout `error`/`input`/`output`)을 여러 표면에 도입했음에도 항목이 없다.
  - 제안: 기존 항목들과 같은 형식(⚠️ wire 변화 캐비엇 포함)으로 `## Unreleased` 항목을 추가한다. 정본 트래커(`plan/in-progress/eia-fanout-and-internal-data-masking.md`)의 체크리스트에도 CHANGELOG 항목이 없으므로, push 게이트 전에 이 작업 자체를 트래커에 추가해 두는 것이 안전하다.

- **[WARNING]** Swagger 응답 DTO 의 `inputData`/`outputData` 필드 설명이 새로 걸린 마스킹 동작을 반영하지 못한다 — 같은 DTO 안의 자매 `error` 필드는 이미 마스킹을 명시하고 있어 비대칭이다.
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:49` 및 `:57` (`ExecutionDto.inputData`/`outputData` — `@ApiPropertyOptional` 설명이 각각 "입력 데이터 — 트리거가 워크플로우에 주입한 input …", "출력 데이터 — 워크플로우 최종 결과 …"로 평범하게 남아 있음). 대조: 같은 파일 `:65`~`:72` 의 `error` 필드는 "**자격증명으로 판별된 값은 마스킹되어 반환된다** … DB 원문과 다를 수 있다 … SoT: EIA §R17" 을 명시.
  - 위치 2: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:49`-`:61` (`BackgroundRunNodeExecutionDto.inputData`/`outputData` — "입력 데이터 (JSON)"/"출력 데이터 (JSON, NodeHandlerOutput shape)"만 기재). 대조: 같은 파일 `:63`-`:69` 의 `error` 필드는 마스킹 사실과 SoT 를 명시.
  - 상세: 이번 diff 는 `executions.service.ts`/`background-runs.service.ts` 에서 `redactStoredDataForResponse` 를 `inputData`/`outputData` 컬럼에 새로 적용해, 두 필드도 이제 DB 원문과 다를 수 있는 상태가 됐다(자격증명 값-패턴이 `***` 로 치환). 그런데 두 DTO 파일 모두 `error` 필드는 (직전 PR #1179 에서) 마스킹 사실을 Swagger 설명에 명시적으로 적어 뒀지만, 이번 diff 가 같은 마스킹을 적용한 `inputData`/`outputData` 는 그 설명을 갱신하지 않았다. OpenAPI 스펙만 보는 외부 통합사·프런트 개발자는 이 두 필드가 DB 원문과 달라질 수 있다는 사실을 알 방법이 없다.
  - 제안: `error` 필드와 동일한 패턴으로 `inputData`/`outputData` 의 `@ApiPropertyOptional`/JSDoc 설명에 "자격증명으로 판별된 값은 마스킹되어 반환된다(DB 원문과 다를 수 있음)" + SoT 링크(`shared/utils/redact-stored-error.ts` / EIA §R17)를 추가한다. `plan/in-progress/eia-fanout-and-internal-data-masking.md` 체크리스트에도 이 항목이 없으므로 함께 등재를 고려.

- **[WARNING]** `spec/5-system/14-external-interaction-api.md` §R17 과 `spec/5-system/6-websocket-protocol.md` 가 이번 diff 가 구현한 마스킹 계층(코드가 자신의 SoT 로 반복 지목하는 그 문서)을 아직 반영하지 못한 상태다.
  - 위치: `spec/5-system/14-external-interaction-api.md:1500`-`1508` — §R17 "잔여(범위 밖)" 불릿이 여전히 "① WS `execution.node.*` **emit** 경로의 `error` 는 여전히 원문이다 … ② `inputData`/`outputData` 는 **다른 컬럼**이라 포함되지 않는다"고 서술한다. 하지만 이번 diff 의 `websocket.service.ts`(`maskWireEnvelope`/`toFanoutEnvelope`)와 `executions.service.ts`/`background-runs.service.ts`(`redactStoredDataForResponse`)가 정확히 이 ①·②를 구현한다.
  - 위치 2: `spec/5-system/6-websocket-protocol.md` — `maskWireEnvelope`/`toFanoutEnvelope`/`WIRE_PRESERVED_FIELDS`/`deepRedactSecretsPreserving` 어느 것도 이 문서에 등장하지 않는다(grep 0건).
  - 상세: `websocket.service.ts`(`maskWireEnvelope` JSDoc)와 `redact-stored-error.ts`(`redactStoredDataForResponse` JSDoc)는 반복적으로 "SoT: EIA §R17"을 인용하는데, 그 인용 대상 문서는 이번 diff 가 구현한 동작을 아직 "잔여(미해결)"로 서술한다 — 코드와 SoT 문서가 어긋난 상태다. 다만 이는 `plan/in-progress/eia-fanout-and-internal-data-masking.md` 체크리스트에 `spec — 14-external-interaction-api.md §R17 카탈로그 등재 + 잔여 ①·② 둘 다 flip`, `spec — 6-websocket-protocol.md fanout 마스킹 규정` 항목으로 이미 명시적으로 추적되고 있어(둘 다 미체크) "조용한 누락"은 아니다.
  - 제안: 이 리뷰 라운드가 spec 반영 이전 코드 단계 체크포인트라면 현재로선 정보성으로 남기되, push 게이트(`--spec`) 전까지 반드시 두 spec 파일을 갱신해 코드의 "SoT" 인용이 실제로 가리키는 대상과 일치하게 한다.

- **[INFO]** `NodeExecutionSummaryDto`(execution 상세 응답의 `nodeExecutions[]`) Swagger 스키마에 `inputData` 필드 자체가 없다 — 이번 diff 가 그 필드에 마스킹을 걸긴 하지만(런타임엔 존재), API 문서에는 애초에 등장하지 않는다.
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:123`-`182` (`NodeExecutionSummaryDto` 클래스 — `outputData`(`:162`)·`error`(`:176`)만 선언, `inputData` 없음)
  - 상세: `executions.service.ts` 의 `findById` 노드 매핑(`reconciledNodeExecutions`)은 이번 diff 로 `ne.inputData` 에도 `redactStoredDataForResponse` 를 적용하지만, 이는 이번 PR 이 만든 새 결함이 아니라 `git log -p` 로 확인한 선존 갭이다(`inputData` 필드는 이 DTO 클래스에 애초에 선언된 적이 없다). 이번 diff 로 인해 두드러지는 정도이므로 참고용으로 남긴다.
  - 제안: 별건으로 등재하거나, 위 WARNING 항목(inputData/outputData Swagger 설명 갱신) 작업 시 함께 처리를 고려.

## 요약

이번 diff 는 문서화 관점에서 전반적으로 이례적으로 높은 품질을 보인다 — 신규 함수(`redactStoredDataForResponse`, `deepRedactSecretsPreserving`, `maskWireEnvelope`, `toFanoutEnvelope`)마다 "왜"를 설명하는 JSDoc, 표면 카탈로그를 단일 정본(`{@link}` 참조로 중복 수치 제거)에 모으는 구조, 계약 캐너리 테스트에 대한 근거 주석, spec 문서 인용의 실측 검증(grep 으로 직접 대조) 등 이 저장소의 반복 실패 패턴("자매 넷 중 하나만")을 의식적으로 막는 문서화가 코드·테스트 전반에 배어 있다. 다만 이 diff 의 실제 파급 범위(변경 파일 밖)를 추적한 결과, 두 가지 확실한 갭이 남아 있다 — (1) 확립된 `CHANGELOG.md` 관례(87건의 선례, 특히 바로 직전 자매 PR·같은 클래스의 보안 항목)를 이번 wire-visible 변경이 따르지 않았고, (2) 같은 DTO 안에서 `error` 필드는 마스킹 사실을 Swagger 문서에 명시했지만 이번에 마스킹이 걸린 `inputData`/`outputData` 는 그 갱신을 놓쳤다. 코드가 반복 인용하는 SoT(`spec/5-system/14-external-interaction-api.md` §R17, `6-websocket-protocol.md`)는 아직 이번 동작을 반영하지 못한 상태지만, 이는 이 작업의 plan 체크리스트에 이미 미결 항목으로 명시돼 있어 조용한 누락은 아니다.

## 위험도

LOW
