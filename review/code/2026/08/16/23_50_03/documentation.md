# 문서화(Documentation) 코드 리뷰

## 검토 방법 메모

이 diff 는 `origin/main` 대비 커밋 4개(`f5351e9c2` 이후 `1b8fd5cc7`·`fe6a54c80`·`e5a63abff`)를
포함하며, 그 안에 **이전 리뷰 라운드의 산출물**(`review/code/2026/08/16/23_08_19/*`,
`review/consistency/2026/08/16/{22_22_36,23_10_41}/*`)이 그대로 커밋돼 있어 프롬프트 번들에
같이 실려 있다. 그 산출물들은 이미 지나간 리뷰 결과이므로 재평가 대상으로 삼지 않았고, 대신
그것들이 지적한 WARNING/INFO 가 **이후 커밋에서 실제로 반영됐는지**를 `Read`/`grep` 으로
직접 소스를 열어 대조하는 데 썼다. 확인 결과:

- CHANGELOG 누락(23_08_19 documentation W1) → `CHANGELOG.md` 에 상세 `## Unreleased` 항목으로 반영됨.
- Swagger `inputData`/`outputData` 마스킹 미문서화(23_08_19 documentation W2, requirement W2) →
  `execution-response.dto.ts`·`background-run-response.dto.ts` 양쪽에 `error` 와 대칭되는
  캐비엇 + SoT 링크로 반영됨.
- 마스킹 마커 리터럴 중복(23_08_19 maintainability W1) → `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/
  `DEPTH_MASK_MARKER` 를 `sanitize-error-message.ts` 에서 export 상수로 승격해
  `websocket.service.ts` 가 import 해 공유하는 형태로 반영됨(실측: `grep` 로 두 파일 모두 확인).
- `redactStoredDataForResponse` 전용 유닛 테스트 부재(23_08_19 testing W1) →
  `redact-stored-error.spec.ts` 에 8건짜리 `describe` 신설로 반영됨.
- `findById` `nodeExecutions[]` 3-컬럼 copy-on-change 참조 동일성 미검증(23_08_19 testing W2) →
  `executions.service.spec.ts` `⑥-b` 테스트로 반영됨(실측 확인).
- spec §R17 "잔여 ①·②" 미반영(23_08_19 requirement W1, 23_10_41 plan_coherence W1) →
  `14-external-interaction-api.md` 에서 ①·② 모두 취소선+해소로 flip, ③ 만 범위 밖 유지로
  반영됨.
- plan 최상단 "택일" 표 자기모순(23_08_19 requirement W3) → `eia-fanout-and-internal-data-
  masking.md` 최상단 표가 취소선+정정으로 갱신됨.
- draft `## Rationale` 섹션 부재(23_10_41 convention_compliance W1) →
  `spec-draft-eia-fanout-masking.md` 에 `## Rationale` 섹션 신설로 반영됨.
- `12-webhook §5.3` 인용 앵커 누락(23_10_41 convention_compliance INFO) →
  `14-external-interaction-api.md:1561` 에서 앵커 포함 형태로 정정됨.

즉 이전 두 라운드가 낸 문서화 관련 발견은 실측상 전부 닫혀 있다. 아래는 이번 라운드에서
**새로** 확인한 것만 적는다.

## 발견사항

- **[WARNING]** `NodeExecutionSummaryDto` (Swagger DTO, `GET /api/executions/:id` 의
  `nodeExecutions[]` 항목) 가 이번 diff 로 마스킹이 걸린 세 컬럼(`error`/`inputData`/
  `outputData`) 중 `inputData` 를 **필드 자체로 선언하지 않는다** — 이번 diff 가 바로 이
  클래스 안에서 `outputData`/`error` 필드에 마스킹 캐비엇을 추가하면서도 그 옆 `inputData`
  는 누락된 채로 남았다.
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:135`
    (`export class NodeExecutionSummaryDto`) ~ `:197` — `id`/`nodeId`/`nodeLabel`/`status`/
    `startedAt`/`finishedAt`/`durationMs`/`outputData`(`:182`)/`error`(`:196`) 만 선언되고
    `inputData` 필드가 없다. 이번 diff 가 실제로 편집한 자리는 `:174`-`:175`
    (`outputData` JSDoc 에 "자격증명으로 판별된 값은 마스킹되어 반환된다" 추가)다.
  - 상세: 런타임에서는 `ExecutionsService.findById` 가
    `reconcilePreParkWaitingStatus(...).map<ResponseNodeExecution>(...)` 로 `nodeExecutions[]`
    각 행에 `inputData: maskIfPresent(ne.inputData, redactStoredDataForResponse)` 를 적용해
    실제 JSON 응답에 마스킹된 `inputData` 값을 싣는다(`executions.service.ts:682-694`). 그런데
    이 엔드포인트의 공개 계약인 `ExecutionDetailDto`(`nodeExecutions: NodeExecutionSummaryDto[]`,
    `:203`, `executions.controller.ts:70` `@ApiOkWrappedResponse(ExecutionDetailDto, ...)`)는
    `NodeExecutionSummaryDto` 에 `inputData` 필드 선언 자체가 없어 OpenAPI 스펙에 이 필드가
    아예 등장하지 않는다. 이번 작업의 SoT 표(`executions.service.ts:1029` `toResponseExecution`
    JSDoc "읽기 표면" 표, spec `14-external-interaction-api.md` §R17)는 "여섯 표면·세 컬럼"을
    명시적으로 정본으로 못박고 있는데, 그 여섯 표면 중 하나(`findById` 의 `nodeExecutions[]`)의
    공개 API 문서는 세 컬럼 중 하나(`inputData`)를 아예 기재하지 않아 코드 SoT ↔ Swagger 계약이
    어긋난다. Swagger 만 읽는 외부 통합사·프런트 개발자는 이 필드가 존재한다는 사실 자체를 알
    방법이 없다(마스킹 여부 이전 단계).
  - 제안: `NodeExecutionSummaryDto` 에 `inputData` 필드를 `outputData` 와 동형으로 추가한다
    (`@ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })` +
    "자격증명으로 판별된 값은 마스킹되어 반환된다 — 위 `outputData` 와 같은 정책" JSDoc). 이
    diff 가 이미 같은 클래스의 `outputData`/`error` 를 손대고 있어 한계비용이 낮다.

## 확인했으나 조치 불요로 판단한 항목 (참고)

- **[INFO]** `CHANGELOG.md` 의 `[12-webhook §5.3](./spec/5-system/12-webhook.md)` 링크는
  루트 상대경로로 정확히 해석되지만(`ls spec/5-system/12-webhook.md` 확인) 앵커가 없다.
  같은 절을 가리키는 spec 본문 인용은 이번 diff 로 앵커-포함 형태로 통일됐지만
  (`14-external-interaction-api.md:1561`), CHANGELOG 는 산문 성격이 강해 기존 CHANGELOG
  선례(`[EIA §R17]` 등)도 앵커 없이 문서 전체를 가리키는 관행이 있다 — 국소 스타일 불일치이며
  조치를 요구할 정도는 아니다.
- **[INFO]** `plan/complete/eia-internal-rest-error-masking.md` 신설 + `plan/in-progress/
  eia-internal-rest-error-masking.md` 삭제는 내용 손실 없는 순수 lifecycle 이동으로 확인했다
  (git mv 수준의 diff, 참조 링크 2곳도 함께 정정됨) — 문서화 결함 아님.
- 그 외 신규 함수(`redactStoredDataForResponse`, `deepRedactSecretsPreserving`,
  `maskWireEnvelope`, `toFanoutEnvelope`, `maskIfPresent`)는 모두 "왜" 를 설명하는 JSDoc,
  상호 `{@link}` 참조, 정확한 SoT 경로(상대경로 실측 확인)를 갖추고 있다. 인라인 주석은
  복잡한 분기(copy-on-change 삼항, 마커 멱등, `T` 제네릭을 의도적으로 안 쓰는 이유)마다
  근거를 남긴다. 테스트 파일의 `describe`/`it` 서술은 대부분 "왜 이 테스트가 필요한가"를
  선행 실패 패턴 인용으로 설명한다.

## 요약

이번 diff 는 문서화 관점에서 이례적으로 높은 완결성을 보인다 — 신규 마스킹 프리미티브마다
근거 JSDoc, 단일 정본 표({@link} 참조로 중복 수치 제거), CHANGELOG 상세 항목, Swagger
DTO 캐비엇, spec §R17 잔여 flip 이 모두 갖춰져 있고, 실제로 이전 두 리뷰 라운드
(`23_08_19` 코드 리뷰, `22_22_36`/`23_10_41` 일관성 검토)가 낸 문서화 관련 WARNING/INFO
전부가 이후 커밋에서 실측 확인 가능하게 반영됐다. 이번 라운드에서 새로 발견한 것은 하나뿐이다
— 이번 diff 가 직접 편집하는 `NodeExecutionSummaryDto` 클래스 안에서 `outputData`/`error`
필드에는 마스킹 캐비엇을 추가하면서 같은 클래스에 `inputData` 필드 선언 자체가 없어, 런타임
응답(마스킹된 `inputData` 포함)과 공개 OpenAPI 계약이 어긋난다. 코드 한 줄 추가 수준의 저비용
수정이라 이 PR 안에서 닫는 것을 권장한다.

## 위험도

LOW
