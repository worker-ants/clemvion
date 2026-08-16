STATUS=success requirement review complete — CRITICAL 0 · WARNING 3 · INFO 1
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — EIA fanout + 내부 REST `inputData`/`outputData` 값-패턴 마스킹

## 발견사항

- **[WARNING] [SPEC-DRIFT] spec 이 "아직 원문" 이라고 못박은 두 표면을 이 diff 의 코드가 이미 마스킹한다 — 카탈로그 미동기**
  - 위치: `spec/5-system/14-external-interaction-api.md:1515-1518` (§R17 "잔여(범위 밖)" ①·② 불릿), `spec/5-system/6-websocket-protocol.md:184` ("같은 소켓의 `execution.node.*` **emit** 은 이 관문을 지나지 않아 아직 원문이다")
  - 상세: 두 spec 문서는 현재도 "① WS `execution.node.*` emit 의 `error` 는 여전히 원문" / "② `inputData`/`outputData` 는 내부 REST 에 마스킹이 걸리지 않는다" 라고 명시한다. 그런데 이 diff 는 정확히 그 두 표면을 구현한다 — `codebase/backend/src/modules/websocket/websocket.service.ts` 의 `maskWireEnvelope`(신설, `emitExecutionEvent`/`emitNodeEvent` 양쪽의 wire+fanout 에 적용)와, `codebase/backend/src/modules/executions/executions.service.ts` `toResponseExecution`/`toExecutionDto` + `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` `toNodeExecutionDto` 의 `redactStoredDataForResponse` 호출이 그것이다. 코드는 의도적이고 정확하다(테스트 163건 통과, `nest build` 통과, 실제 로직도 정합) — 즉 "코드가 틀림" 이 아니라 "spec 이 낡음" 이다. 이 gap 은 개발자도 이미 인지하고 있다: 같은 diff 의 `plan/in-progress/eia-fanout-and-internal-data-masking.md` 체크리스트에 `- [ ] spec — 6-websocket-protocol.md fanout 마스킹 규정`, `- [ ] spec — 14-external-interaction-api.md §R17 카탈로그 등재 + 잔여 ①·② 둘 다 flip` 이 **미체크**로 남아 있다(같은 문서 158-182 줄의 다른 항목은 전부 `[x]`). 다만 이 plan 의 frontmatter 에는 `spec_impact` 필드 자체가 없다(완료된 자매 plan `plan/complete/eia-internal-rest-error-masking.md` 는 `spec_impact` 리스트를 갖는 것과 대조적) — 두 spec 파일이 미갱신 상태로 남을 위험을 frontmatter 레벨에서도 못 잡는다.
  - 제안: 코드는 그대로 두고 spec 을 반영한다(project-planner 턴). `14-external-interaction-api.md` §R17 "잔여(범위 밖)" ①·②를 "해소" 로 flip(③ 은 그대로 범위 밖 유지 — 이 항목만 실제로 유효), `6-websocket-protocol.md:184` 의 "아직 원문이다" 문구를 관문 상속 서술로 교체. `eia-fanout-and-internal-data-masking.md` frontmatter 에 `spec_impact: [spec/5-system/14-external-interaction-api.md, spec/5-system/6-websocket-protocol.md]` 추가.

- **[WARNING] 응답 DTO Swagger JSDoc — `inputData`/`outputData` 에 새로 걸린 마스킹이 문서화되지 않았다 (자매 `error` 필드와 비대칭)**
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:48`(`ExecutionDto.inputData`), `:57`(`ExecutionDto.outputData`), `:152`(`NodeExecutionSummaryDto.outputData`) / `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:49`, `:56`(`BackgroundRunNodeExecutionDto.inputData`/`outputData`)
  - 상세: 같은 파일·같은 클래스의 `error` 필드 JSDoc(`execution-response.dto.ts:65-79`, `:169-175`, `background-run-response.dto.ts:63-69`)은 이미 "자격증명으로 판별된 값은 마스킹되어 반환된다 — DB 원문과 다를 수 있다" 를 명시한다(#1179 에서 반영). 이번 diff 는 정확히 같은 마스킹을 `inputData`/`outputData` 에도 걸었는데, 세 DTO 파일의 해당 필드 JSDoc 은 여전히 "입력 데이터", "출력 데이터 (JSON, NodeHandlerOutput shape)" 처럼 형태만 설명하고 마스킹 사실을 언급하지 않는다. `PROJECT.md` §"사후 보정 PR 패턴 금지 — 같은 turn 원칙" 이 요구하는 "같은 PR·같은 turn" 문서 갱신 의무와, 자매 PR(#1179)이 정확히 이 클래스의 `error` 필드에서 이미 실행한 선례에 비춰 보면, 이번 diff 의 미반영은 그 규약의 비대칭 적용이다. Swagger 스펙 소비자(프론트/외부 API 문서)는 `inputData`/`outputData` 가 DB 원문과 다를 수 있다는 사실을 문서만으로 알 수 없다.
  - 제안: 세 위치의 `inputData`/`outputData` JSDoc 에 `error` 필드와 동형의 마스킹 캐비엇("자격증명으로 판별된 값은 `***` 로 마스킹되어 반환된다 — DB 원문과 다를 수 있다. SoT: EIA §R17")을 추가.

- **[WARNING] plan 문서 자기모순 — 상단 "결정" 표는 fanout-only, 실제 구현·하단 체크리스트는 wire 도 마스킹**
  - 위치: `plan/in-progress/eia-fanout-and-internal-data-masking.md:22`("A | **fanout 브랜치에만** 값-패턴 마스킹") vs `:64-68`("### 왜 wire 가 아니라 fanout 인가") vs `:162-164`("A — 두 emit 이 공유하는 초크포인트... > **사용자 재택일로 wire 도 마스킹**")
  - 상세: 이 문서 최상단의 "사용자가 2026-08-16 에 택일했다" 요약 표(18-24줄)는 A 항목을 "fanout 브랜치에만" 으로 적어 두었고 §A 본문(64-68줄)도 "왜 wire 가 아니라 fanout 인가" 라는 제목으로 그 결정을 정당화한다. 그런데 실제 구현(`websocket.service.ts` 의 `maskWireEnvelope` 가 wire 에도 적용됨)과 하단 체크리스트(162-164줄)는 "**사용자 재택일로 wire 도 마스킹**(`ExecutionChannelAuthorizer` 실측으로 초안 전제가 반증됨)" 이라고 번복 사실을 적어 둔다. 최종 코드는 후자(wire+fanout 둘 다 마스킹)가 맞고 실제로 구현·테스트된 것도 이쪽이다 — 문제는 최상단 "결정" 요약 표와 §A 소제목이 번복 이전 상태로 멈춰 있어, 이 문서를 표만 보고 참조하는 다음 사람(또는 spec 반영 시 planner)이 "fanout-only" 로 오독할 위험이 있다.
  - 제안: 상단 결정 표의 A 행을 "fanout+wire 모두(`llmCalls` 만 wire 예외)" 로 갱신하고, §A 소제목("왜 wire 가 아니라 fanout 인가")도 번복 사실을 반영하도록 수정하거나 "(초안 근거 — 이후 반증됨, §162 참조)" 캐비엇을 붙인다.

- **[INFO] 마커 보존은 credential-key 전량 마스킹 분기에만 걸려 있다 — 자유 텍스트 안에 마커가 실린 경우는 범위 밖**
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` `deepRedactObject`(credential-key 분기의 `isMaskedMarker` 체크)
  - 상세: `MASKED_MARKERS`/`isMaskedMarker` 보존 로직은 `CREDENTIAL_KEY_PATTERN` 이 일치하는 키의 값을 통째로 마스킹하려는 지점에서만 동작한다. 문자열 leaf 를 `redactSecrets`/`redactSecretsInJsonString` 으로 패턴 치환하는 경로(비-credential 키 하위)에는 이 보존이 적용되지 않는다. 실제 문서화된 유일한 충돌 시나리오(webhook `headers.authorization`/`headers.cookie` 의 `[REDACTED]`, WS `apiKey` 등)는 전부 credential-key 이름 하위라 이 구현으로 충분히 커버되지만, 만약 마커 문자열이 비-credential 키의 자유 텍스트 안에 `Authorization: [REDACTED]` 형태로 임베드되어 있고 그 전체가 `SECRET_LEAK_PATTERNS` 의 `Authorization:` 패턴에 매칭되면, 그 값은 `***` 로 재마스킹된다(노출 방향은 아니고 마커만 달라짐 — "절대 unmask 하지 않는다" 불변식은 유지되지만 "같은 값이 경로마다 다르게 보인다" 는 이 작업이 없애려던 것과 같은 형태의 잔여 불일치). 현재 캐너리 테스트는 이 조합을 커버하지 않는다.
  - 제안: 낮은 우선순위 — 실제 사례가 관측되면 캐너리 테스트 추가 검토. 지금 당장 코드 변경을 요구할 정도는 아니다(회색지대·범위 밖 성격).

## 요약
`inputData`/`outputData` 자유 텍스트 값-패턴 마스킹을 WS fanout+wire(node/execution 이벤트)와 내부 REST(`ExecutionsService` 4경로 + `BackgroundRunsService` 본문 노드)로 확장하는 작업이며, 핵심 로직(`redactStoredDataForResponse`, `deepRedactSecretsPreserving`, 마커 멱등성, copy-on-change)은 정확하고 표면별 테스트(163개, 4 스위트 전부 GREEN)로 잘 뒷받침된다. `nest build` 도 타입 오류 없이 통과해 `ResponseExecution`/`ResponseNodeExecution` 타입 확장도 정합적이다. 다만 이 코드 변경이 구현한 두 표면(WS `execution.node.*` emit 마스킹, 내부 REST `inputData`/`outputData` 마스킹)을 `spec/5-system/14-external-interaction-api.md` §R17 과 `spec/5-system/6-websocket-protocol.md` §4.1 이 여전히 "미마스킹/원문" 으로 명시하고 있어 spec-코드 불일치가 존재한다 — 개발자가 이미 in-progress plan 체크리스트에 미결로 등재해 두었으므로 놓친 것은 아니지만, 이 diff 상태로 병합되면 spec 이 실제 보안 동작보다 보수적으로 낡은 채 남는다. 여기에 더해 신규로 마스킹이 걸린 `inputData`/`outputData` 필드의 Swagger DTO JSDoc 이 자매 `error` 필드와 달리 갱신되지 않았고, plan 문서 자체에도 "fanout-only" 대 "wire 도 마스킹" 자기모순이 남아 있다. 기능적 결함(CRITICAL)은 발견되지 않았다.

## 위험도
MEDIUM
