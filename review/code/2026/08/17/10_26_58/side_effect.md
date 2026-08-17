# 부작용(Side Effect) 코드 리뷰

## 발견사항

- **[WARNING]** `NodeExecutionSummaryDto` 가 `inputData` 필드를 여전히 선언하지 않는데, 이 필드는 실제 런타임 응답(`GET /executions/:id` 의 `nodeExecutions[]`)에 **이번 PR 의 최종 커밋부터 마스킹된 값으로 포함**된다 — 공개 API 스키마(OpenAPI/Swagger)와 실응답의 괴리가 "마스킹 정책 비공개"라는 새 성격을 얻었다.
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` — `NodeExecutionSummaryDto` 클래스(`outputData`/`error` 필드는 선언·설명돼 있으나 `inputData` 필드 자체가 클래스에 없음). 대응 프로덕션 로직: `codebase/backend/src/modules/executions/executions.service.ts` 의 `ResponseNodeExecution` 타입(`inputData: Record<string, unknown> | null` 추가)과 `findById` 의 `reconciledNodeExecutions` map(`maskIfPresent(ne.inputData, redactStoredDataForResponse)`).
  - 상세: 이 저장소는 Nest `ClassSerializerInterceptor` 를 어디에도 걸지 않는다(전역·컨트롤러 레벨 둘 다 grep 0건 — `dangerouslyDisableSandbox` 없이 직접 확인) — 즉 DTO 클래스는 Swagger 문서 생성 전용이고, 컨트롤러가 실제로 반환하는 객체는 화이트리스트 없이 그대로 직렬화된다. `executions.controller.ts` 의 `findById` 핸들러는 `@ApiOkWrappedResponse(ExecutionDetailDto, ...)` 로 문서화돼 있지만 실제로 `this.executionsService.findById(id)` (타입 `ResponseExecution`, `nodeExecutions: ResponseNodeExecution[]`) 를 그대로 반환한다. 이번 PR 의 최종 커밋(`83436ed45`)이 `ResponseNodeExecution` 에 `inputData` 를 추가하고 마스킹을 적용하면서, **이 필드가 무엇인지·왜 `***` 로 보이는지를 설명하는 문서가 하나도 없는 상태에서 정책만 새로 생겼다**. 자매 표면인 `BackgroundRunNodeExecutionDto`(`background-run-response.dto.ts`)는 같은 상황(노드 레벨, 재제출 소비처 없음, egress 마스킹 대상)에 대해 `inputData` 필드를 선언하고 이번 PR 이 상세한 `@ApiPropertyOptional description` 까지 붙였다 — 같은 PR 안에서 두 자매 DTO 가 동일한 정책을 서로 다른 문서화 수준으로 다루는 비대칭이다.
    필드 부재 자체는 이 PR 이 만든 것이 아니라 이미 `plan/complete/spec-sync-execution-history-gaps.md`(완료된 plan) 가 "Swagger `NodeExecutionSummaryDto` 와의 불일치는 백엔드 DTO 정합성 이슈로, 본 plan 범위 밖" 이라 명시하며 알고 있던 선존 갭이다. 다만 그 plan 이 관찰한 시점엔 `inputData` 가 원문 그대로였고("표시되는 값이 무엇인지"는 자명했다), 지금은 그 자리에 **egress 마스킹이라는 새 동작**이 얹혔는데 그 동작을 설명하는 자리가 없다 — External Interaction API(EIA, 이 PR 이 §R17 을 갱신 중인 바로 그 spec 영역)의 스펙 소비자가 Swagger 스키마만 보고 이 필드의 존재·마스킹 여부를 알 방법이 없다.
  - 제안: `NodeExecutionSummaryDto` 에 `inputData?: Record<string, unknown> | null` 필드를 `@ApiPropertyOptional` 로 추가하고, `BackgroundRunNodeExecutionDto.inputData` 와 대칭되는 설명("노드 레벨이라 마스킹 대상", `MASKED_INPUT_DATA_REASON` 참조)을 붙이는 것을 권장한다. 필드 부재 자체(엔티티 shape 대비 다른 필드들의 정합성)까지 이 라운드에서 손댈 필요는 없다(이미 별도 plan 이 범위 밖으로 선언) — 이번 지적은 "부재" 가 아니라 "마스킹 정책이 무선언 필드에 신규로 얹힌 것" 에 한정한다.

## 검토했으나 문제 없음 (참고 — 이전 라운드에서 이미 검증되었고 최종 커밋으로 변경되지 않음)

- 전역 `WeakMap` 캐시(`SANITIZE_CACHE`/`DEEP_REDACT_CACHE`)의 적용 범위 확장, WS wire envelope 바이트 변경(`maskWireEnvelope`/`toFanoutEnvelope`), `ResponseExecution`/`ResponseNodeExecution` 타입 확장, `stop()` 반환 계약 변경(마스킹된 복사본 반환) — 넷 다 `00_23_57` side_effect 라운드가 실측(0 외부 타입 소비자, 내부 호출부 3곳 반환값 미사용, wire 변화 CHANGELOG/spec/유저가이드 공지)으로 검증했고, 최종 커밋(`83436ed45`)은 이 파일들의 해당 로직을 다시 건드리지 않았다. 독립적으로 재확인한 결과도 일치한다:
  - `Nest ClassSerializerInterceptor` 미사용 확인(위 WARNING 근거 재사용) — DTO 는 문서 전용이므로 타입 확장이 곧 실제 응답 형태 확장이다.
  - 프런트 소비처(`execution-store.ts:644`, `rerun-modal.tsx:178`, `editor-toolbar.tsx:126,133`)를 직접 열어 "Execution 레벨만 재제출에 쓰이고 노드 레벨은 표시 전용" 이라는 이번 최종 커밋의 핵심 전제를 재확인했다 — `original.inputData`/`detail.inputData` 는 모두 `ExecutionDto`(최상위) 필드를 가리키고 `nodeExecutions[]` 를 읽지 않는다.
  - `stripExternalOnlyFields`/`deepRedactSecretsPreserving` 모두 lazy clone-on-write 계약(입력 비변이, 무변화 시 참조 재사용)을 지키고 있어, `wireEnvelope`(내부 브로드캐스트용)와 `externalPayload`(fanout 용)가 참조를 공유하는 경로(마스킹·strip 모두 무변화인 경우)에서도 상호 오염이 없음을 코드 레벨에서 재확인했다.
- `getChain()` 은 `nodeExecutions[]` 를 포함하지 않는 `ResponseExecution[]` 만 반환하므로, 이번 최종 커밋의 노드 레벨 `inputData` 마스킹 확장과 무관하다(별도 side effect 없음).
- 백엔드 diff 전체에서 `process.env` 읽기/쓰기, 파일시스템 접근, 신규 네트워크 호출은 발견되지 않았다.

## 요약

이 라운드는 4차례의 선행 ai-review·5차례의 impl-done/consistency 검토를 거친 뒤 사용자가 재택일한 "재제출 카브아웃을 `Execution` 레벨로 한정" 커밋(`83436ed45`, WS↔REST flip-flop CRITICAL 해소)을 포함한 누적 diff다. 순수 함수(`redactStoredDataForResponse`/`deepRedactSecrets*`)와 copy-on-change 원칙이 시종 지켜져 예상 밖의 상태 변경·전역 변수 오염·환경 변수·네트워크 호출은 없다. 다만 이번 최종 커밋이 `NodeExecution.inputData` 에 새 마스킹 정책을 적용하면서, 그 필드가 애초에 Swagger 스키마에 선언조차 안 돼 있던 상황(선존·이미 범위 밖으로 트래킹된 갭)과 겹쳐, "공개 API 응답에 새 마스킹 동작이 얹힌 필드가 문서에 전혀 없다"는 인터페이스 성격의 갭이 새로 관측 가능해졌다. 자매 표면(`BackgroundRunNodeExecutionDto`)은 같은 라운드에서 문서화를 마쳤기 때문에 이 비대칭이 두드러진다.

## 위험도

LOW
