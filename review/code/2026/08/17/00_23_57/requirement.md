# 요구사항(Requirement) 코드 리뷰

## 검토 방법

`origin/main` 대비 이 브랜치의 diff(prompt payload, 71개 리스트 항목 — 다수는 이전 review/consistency
라운드 산출물)와, 컨텍스트 예산으로 diff 가 생략된 핵심 소스를 `Read`/`Grep` 으로 직접 열어 line-level
로 대조했다:

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (전체)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (전체)
- `codebase/backend/src/modules/executions/executions.service.ts` (`toResponseExecution` ·
  `toExecutionDto` · `findById` · `getChain` · `stop`/`stopInternal` · `reRun` · `maskIfPresent` ·
  `MASKED_INPUT_DATA_REASON`)
- `codebase/backend/src/modules/executions/executions.service.spec.ts` (⑤·⑤-b·⑤-c·⑥-b·⑦·⑧·⑧-b)
- `codebase/backend/src/modules/websocket/websocket.service.spec.ts` (값-패턴 마스킹 describe 전체)
- `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (`EXTERNAL_STRIPPED_FIELDS`)
- `spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/6-websocket-protocol.md` §4.1,
  `spec/5-system/12-webhook.md` §5.3
- `git log`/`git show --stat b05756d9e` 로 HEAD 커밋이 실제로 `23_50_03` RESOLUTION 이 서술하는
  CRITICAL 철회 + WARNING 6건 조치를 전부 포함하는지 실측 확인

이 changeset 은 이미 이 저장소의 표준 `/ai-review`(2라운드: `23_08_19`, `23_50_03`)와
`/consistency-check`(3라운드: `22_22_36` impl-prep, `23_10_41` spec, `23_49_05` impl-done)를 거쳤고,
그 산출물(RESOLUTION.md 포함)이 diff 안에 커밋돼 있다. 본 라운드는 그 결과가 **최종 소스 상태와
실제로 일치하는지**를 재검증하는 데 집중했다 — 이전 라운드가 이미 CRITICAL 1건(재제출 경로 오염)을
찾아 되돌렸고, 그 되돌림이 현재 HEAD(`b05756d9e`)에 정확히 반영돼 있음을 확인했다.

## 발견사항

- **[INFO]** `maskIfPresent` 의 타입 시그니처가 실제 null 가능성(`value == null` 분기가 `value` 를
  그대로 반환)을 감춘다 — 이미 `23_50_03` maintainability WARNING #6 으로 지적되고 "정적 계약과
  런타임 방어를 의도적으로 분리했다"는 JSDoc(같은 파일 `:104-109`)으로 해소 처리된 항목의 재확인.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `maskIfPresent`
    (함수 정의부, JSDoc 바로 아래)
  - 상세: 현재도 이 상태이며 새로운 위험은 아니다 — 대입 대상(`ResponseNodeExecution.outputData`/
    `.error: Record<string, unknown> | null`)이 이미 `| null` 을 허용해 실질적 결함으로 이어지지
    않는다. 재확인 목적으로만 기록.
  - 제안: 조치 불요(기존 결정 유지). 향후 이 헬퍼가 non-null 강제가 실제로 필요한 다른 대입 대상에
    재사용될 때만 시그니처를 좁힐 것.

- **[INFO]** `sanitizePayloadForWs`(WS 키-이름 마스킹, `websocket.service.ts:67-68`)의
  `CREDENTIAL_KEY_PATTERN` 은 `x-api-key`/`x-auth-token` 접두 변형을 포함하지 않는 반면, 값-패턴
  계층(`sanitize-error-message.ts:84-85`)의 동명 패턴은 포함한다 — 두 마스커가 서로 다른 정규식을
  쓴다는 것을 `websocket.service.ts:80` 자신의 주석("WS-layer `CREDENTIAL_KEY_PATTERN` 을 미러")이
  이미 명시하고 있어 인지된 상태다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:67-68` vs
    `codebase/backend/src/shared/utils/sanitize-error-message.ts:84-85`
  - 상세: 이 diff 가 새로 만든 괴리가 아니라 기존 코드다(두 상수 모두 이번 diff 의 변경 대상이 아님).
    다만 이번 PR 이 두 마스킹 층(키-이름/값-패턴)을 명시적으로 "쌓이는 방어"로 문서화하면서
    (`sanitize-error-message.ts:100-115`) 두 계층의 credential-key 인식 범위가 서로 다르다는
    사실은 언급하지 않는다. `x-api-key: sk-live-...` 같은 값이 WS wire 에 실리면 키-이름 층은
    못 잡고, 값-패턴 층(`deepRedactSecretsPreserving`)의 `CREDENTIAL_KEY_PATTERN` 은 `x-api-key`
    를 인식하므로 실제로는 값-패턴 층이 이 갭을 메운다 — 노출로 이어지지 않는다.
  - 제안: 조치 불요(실질 노출 없음, 두 계층이 상호 보완). 참고 기록.

## 확인했으나 문제 없음 (spec fidelity 검증 상세)

- **§R17 6-surface 열거와 코드 1:1 일치**: spec(`14-external-interaction-api.md:1512-1518`)이 명시하는
  "(1) findById (2) getChain (3) stop (4) toExecutionDto(목록) (5) findById 의 nodeExecutions[]
  (6) BackgroundRunsService.toNodeExecutionDto" 여섯 표면이 실제 코드에서 각각
  `toResponseExecution`(findById/getChain/stop 공용 관문, `executions.service.ts:1087-1097`) ·
  `toExecutionDto`(`:1030-1031`) · `findById` 행 단위 map(`:713-729`, `maskIfPresent` 적용) ·
  `background-runs.service.ts` `toNodeExecutionDto`(`outputData: redactStoredDataForResponse(...)`)로
  정확히 대응한다. `reRun` 은 `findById` 를 재사용하므로 별도 관문이 필요 없다(`:568`).
- **`inputData` 비대상 결정의 일관성**: spec §R17 "잔여 ② — outputData 해소, inputData 는 의도적
  비대상"과 코드(`MASKED_INPUT_DATA_REASON`, `toResponseExecution`/`toExecutionDto`/`findById` 모두
  `inputData` 를 마스킹 관문에서 명시적으로 제외)가 정확히 일치한다. `findById` 의 `nodeExecutions[]`
  copy-on-change 삼항(`:726`)은 `outputData === ne.outputData && error === ne.error` **2필드**만
  비교한다 — `inputData` 가 대상이 아니므로 정확하다. 회귀 캐너리(`⑥-b`, `executions.service.spec.ts
  :1293-1347`)가 `inputData` 만 leaky 한 행이 복제되지 않음을 참조 동일성으로 직접 고정한다.
- **WS 값-패턴 마스킹 wire+fanout 양쪽 적용**: spec(`14-external-interaction-api.md:1564-1569`,
  `6-websocket-protocol.md:193`)이 "wire 에도 건다(boundary parity), llmCalls 만 예외"라고 규정하는
  대로 `emitExecutionEvent`/`emitNodeEvent` 둘 다 `maskWireEnvelope`(`websocket.service.ts:387-394`)
  를 broadcast 직전에 거치고, `WIRE_PRESERVED_FIELDS = new Set(EXTERNAL_STRIPPED_FIELDS)`
  (`:79-81`)가 `['llmCalls']`(`strip-external-only-fields.ts:91`)와 정확히 동일한 참조라 두 목록이
  갈릴 수 없다.
- **`:184` self-contradiction 실제로 해소됨**: `23_10_41` naming_collision 이 WARNING 으로 지적한
  `6-websocket-protocol.md` §4.1 표 안 기존 각주(*"emit 은 관문을 지나지 않아 아직 원문"*)가 현재
  spec 에서 *"별도의 emit 시점 값-마스킹을 받는다(아래 §4.1 캐비엇 참조)"* 로 정정돼 있음을 직접
  확인했다 — stale 문구가 남아 있지 않다.
- **마커 비재마스킹 계약**: `deepRedactSecrets`/`deepRedactSecretsPreserving`(`sanitize-error-message.ts
  :130-132, 245-258`)이 `MASKED_MARKERS`(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`) 를 정확 일치로
  보존하고, `VALUE_MASK_MARKER` 상수가 `:71`(`redactSecrets`) · `:226`(depth 초과) · `:258`
  (credential-key 마스킹) 세 write-site 모두에서 실제로 쓰인다 — `23_50_03` maintainability
  WARNING #5(리터럴 잔존)이 정확히 해소돼 있다.
- **12-webhook §5.3 캐비엇과 코드 정합**: spec(`12-webhook.md:320-330`)의 신설 캐비엇 *"이 ingestion
  층이 inputData 의 유일한 방어다"* 는 `inputData` 가 실제로 egress 마스킹 대상이 아닌 현재 코드
  상태와 정확히 일치한다(마스킹됐다면 이 문장이 틀렸을 것).
- **TODO/FIXME/HACK/XXX**: `git diff origin/main...HEAD` 로 이번 changeset 의 코드/문서 파일
  전체에서 grep — 신규 도입 0건.
- **반환값 완전성**: `maskIfPresent`/`redactStoredDataForResponse`/`redactStoredErrorForResponse`/
  `deepRedactSecrets`/`deepRedactSecretsPreserving` 모두 모든 입력 형태(null/undefined/object/
  string/number/array/credential-key/depth 초과)에 대해 명시적 값을 반환하며 암묵적 `undefined`
  경로가 없다.

## 요약

이번 changeset(WS emit 값-패턴 마스킹 wire+fanout 확장, `Execution`/`NodeExecution`/`BackgroundRun`
`outputData` egress 마스킹 6표면, 마커 비재마스킹 계약)은 소스를 직접 열어 대조한 결과 spec
(`spec/5-system/14-external-interaction-api.md` §R17, `6-websocket-protocol.md` §4.1,
`12-webhook.md` §5.3)과 line-level 로 정확히 일치한다. 특히 이 브랜치 자체가 이미 2라운드의
`/ai-review`(CRITICAL 1건 — `inputData` 재제출 경로 오염 — 을 찾아 설계를 되돌림, WARNING 15건
조치)와 3라운드의 `/consistency-check`(self-contradiction 각주 정정 포함)를 거쳤고, 최종 HEAD
커밋(`b05756d9e`)이 그 모든 조치를 실제로 포함하고 있음을 `git show --stat` 과 소스 직접 대조로
확인했다. 새로 발견된 항목은 둘 다 INFO(기존 결정의 재확인, 사전에 인지된 비-신규 계층 간 패턴
차이로 노출로 이어지지 않음)이며 코드 변경을 요구하지 않는다. `inputData`/`outputData`/`error` 세
컬럼의 마스킹 대상 여부, wire/fanout 양쪽 적용, `llmCalls` 예외, 마커 idempotency 는 모두 의도한
비즈니스 규칙을 정확히 구현하고 있고 회귀 캐너리로 고정돼 있다.

## 위험도

NONE
