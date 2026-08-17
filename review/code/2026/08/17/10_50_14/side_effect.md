# 부작용(Side Effect) 리뷰

이번 changeset(EIA §R17 잔여 마스킹 확장 — WS emit 값-패턴 마스킹 + 내부 REST `inputData`/`outputData`
마스킹, 6라운드째 followup)은 이미 5차례 ai-review/consistency-check 라운드를 거치며 CRITICAL 급
부작용(WS↔REST flip-flop, 타입 시그니처 확장의 소비자 영향, 전역 캐시 교차 오염)이 실측 기반으로
해소돼 있었다. 이번 라운드는 그 위에 추가된 최신 커밋 2개(`83436ed45` 노드 레벨 마스킹 방향 전환,
`09286d542` 문서·Swagger 선언 전파)를 포함해 전체 diff 를 독립적으로 재검증했다.

## 발견사항

- **[INFO]** `NodeExecutionSummaryDto.inputData` 신규 Swagger 필드 선언 — 런타임 동작 변화 없음, 소비자 0건 확인
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:172`(`inputData?: Record<string, unknown> | null;` 선언부, JSDoc 은 `:172`-`184`)
  - 상세: 이 필드는 이미 런타임 응답에는 항상 존재했고(선존 갭) 스키마에만 없었다. 이번 커밋(`09286d542`)은 그 필드를 처음 `@ApiPropertyOptional` 로 선언했을 뿐 직렬화 로직 변화는 없다. `NodeExecutionSummaryDto`/`ResponseExecution`/`ResponseNodeExecution` 를 import 하는 소스 모듈을 `rg` 로 재검증했고(`codebase/backend/src/modules/executions/executions.service.ts` · `executions.service.spec.ts` · `background-runs.service.ts`(주석 텍스트 언급 1건뿐) 외 0건), frontend 쪽도 `NodeExecutionSummaryDto` 참조가 없다. Swagger 문서 소비자(자동 생성 API 클라이언트 등)에도 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** `ResponseNodeExecution`/`ResponseExecution` 타입 재확장(`inputData`/`outputData` non-null → `| null`) — 인터페이스 변경이나 영향 범위 실측 완료
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `ResponseExecution`/`ResponseNodeExecution` 타입 선언(파일 상단 `const MASKED_INPUT_DATA_REASON`/`maskIfPresent` 바로 아래 블록)
  - 상세: 이전 라운드(`00_23_57` side_effect)가 `outputData` 확장의 영향을 실측(소비자 0건, `nest build` PASS)한 데 이어, 이번 라운드 커밋(`83436ed45`)이 `ResponseNodeExecution.inputData` 도 같은 방식으로 `Record<string, unknown> | null` 로 넓혔다. 같은 방법으로 재검증한 결과 소비자 집합에 변화 없음(위 항목과 동일 grep 결과).
  - 제안: 조치 불요.

- **[INFO]** 마스킹 정책 방향이 커밋 1개 사이에서 반전(`Execution.inputData` 원문 유지 ↔ `NodeExecution.inputData` 마스킹) — 문서·테스트·구현 3층 정합 확인
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts`(`MASKED_INPUT_DATA_REASON` JSDoc·`toResponseExecution`·`findById` 의 `reconciledNodeExecutions` map), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:305`(`inputData: redactStoredDataForResponse(row.inputData)`)
  - 상세: `83436ed45` 는 직전 커밋이 카브아웃을 노드 레벨까지 확대해 발생시킨 WS↔REST flip-flop(프런트 store 슬롯 공유로 인한 화면 깜빡임 + 내부 wire 마스킹 무력화)을 되돌리는 CRITICAL fix다. 되돌린 방향이 `executions.service.spec.ts`(`⑤`·`⑥-b`, "노드 레벨은 세 컬럼 전부가 복제를 유발한다")와 `background-runs.service.spec.ts`("body nodeExecutions[] 의 inputData·outputData 를 모두 마스킹한다")에 캐너리로 고정돼 있음을 소스에서 직접 확인했고, 두 테스트 스위트 모두 현재 소스와 방향이 일치한다(과거 두 라운드가 겪은 "개수·목록 서술이 방향과 어긋나는" 재발 패턴이 이번엔 없다).
  - 제안: 조치 불요.

- **[INFO]** `sanitize-error-message.ts`/`websocket.service.ts` 의 전역 `WeakMap` 캐시(`DEEP_REDACT_CACHE`/`SANITIZE_CACHE`) 적용 범위가 이번 changeset 으로 확장됨 — 재확인 결과 교차 오염 없음
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts`(`DEEP_REDACT_CACHE` 선언부·`deepRedactSecrets` 함수), `codebase/backend/src/modules/websocket/websocket.service.ts:91`(`SANITIZE_CACHE`)
  - 상세: 두 캐시 모두 프로세스 전역·모듈 스코프이며 선존 패턴이다. 신규 `deepRedactSecretsPreserving`(WS wire 마스킹 전용)은 옵션이 다른 변형이 같은 캐시를 쓰면 서로의 결과가 오염되는 것을 막기 위해 **명시적으로 캐시를 우회**하도록 구현돼 있고, 그 사실을 고정하는 캐너리(`sanitize-error-message.spec.ts` "캐시를 공유하지 않는다 — 같은 객체를 두 모드로 불러도 서로 오염되지 않는다")를 직접 읽어 구현과 일치함을 확인했다. 캐시 키가 값이 아니라 객체 identity 이므로 DB row 조회마다 새 객체가 생성되는 한 컬럼·행 간 교차 오염 경로는 없다.
  - 제안: 조치 불요. (기존 라운드가 남긴 caveat 그대로 유효: 캐시를 거치는 객체를 마스킹 후 in-place mutate 하는 새 호출부가 생기면 stale 결과 위험이 생긴다 — 현재는 그런 호출부 없음.)

- **[INFO]** WS wire envelope 마스킹 순서 — `attachRoutingContext` 가 붙이는 `chatChannel` 의 `[REDACTED]` 마커가 값-마스킹 이후에 첨부되어 재마스킹(덮어쓰기) 되지 않음을 확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts`(`toFanoutEnvelope` → `attachRoutingContext` 호출 순서, `emitExecutionEvent`/`emitNodeEvent` 의 `maskWireEnvelope` → `gateway.broadcastToChannel` → `toFanoutEnvelope` 순서)
  - 상세: `maskWireEnvelope`(값-패턴 마스킹)는 `wireEnvelope` 조립 시점에 이미 완료되고, `toFanoutEnvelope` 는 그 결과에 대해 strip → routing-context 첨부만 수행한다. `attachRoutingContext` 가 붙이는 `chatChannel` 은 별도로 `sanitizePayloadForWs`(키-이름 마스킹)만 거치고 값-패턴 마스킹 관문을 다시 지나지 않으므로, JSDoc 이 주장하는 "다시 걸면 `[REDACTED]` 를 `***` 로 덮는다"는 위험이 애초에 발생하지 않는 순서로 배선돼 있다. 콜백/이벤트 발생 순서(`gateway.broadcastToChannel` → `executionEventSubject.next`) 자체도 변경 전과 동일하다.
  - 제안: 조치 불요.

## 요약

이번 라운드에서 실측 재검증한 범위(전역 캐시 확장·타입 시그니처 재확장·마스킹 방향 반전·WS 이벤트 페이로드 변경·신규 Swagger 필드) 전부 문서화된 의도적 결정이고, 소비자 영향은 매 라운드 `rg` 재검증으로 실증돼 있다(외부 타입 소비자 0건, `stop()` 반환값을 쓰지 않는 내부 호출부 3곳, 캐시 교차 오염 경로 없음). 새로 도입된 전역 상태는 없고(기존 WeakMap 두 개의 스코프만 넓어짐), 파일시스템·환경 변수·네트워크 호출 표면은 이번 diff 에 없다. `executions.service.spec.ts`/`background-runs.service.service.spec.ts` 의 캐너리가 현재 소스의 마스킹 방향과 실제로 일치함을 직접 대조해, 과거 두 라운드가 겪은 "캐너리 서술이 구현 방향과 어긋나는" 재발 패턴이 이번 라운드에는 없음을 확인했다. CRITICAL/WARNING 급 신규 부작용은 발견하지 못했다.

## 위험도
LOW
