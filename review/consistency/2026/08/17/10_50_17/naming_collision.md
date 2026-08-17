# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done, EIA masking followups)

## 검토 범위

`git diff origin/main...HEAD` 로 실제 변경분을 직접 대조했다(프롬프트 번들이 컨텍스트 예산 초과로 `16-system-status-api.md` 등 다수 파일과 diff 자체를 생략했으므로, 워킹트리에서 `git diff`/`git log`/`grep`을 절대경로 기준으로 재실행해 근거를 확보). 변경 파일: `spec/5-system/{3-error-handling,6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api,15-chat-channel}.md`, `spec/1-data-model.md`, `spec/conventions/node-output.md`, 및 대응 backend 코드(`redact-stored-error.ts`, `sanitize-error-message.ts`, `websocket.service.ts`, `executions.service.ts`, `background-runs.service.ts`, DTO 2종).

## 발견사항

이번 변경이 새로 도입하는 식별자들을 전수 조사했다:

| 신규 식별자 | 종류 | 충돌 여부 |
|---|---|---|
| `redactStoredDataForResponse` | 함수 (shared/utils) | 없음 — 자매 `redactStoredErrorForResponse`와 같은 파일·명명 규칙, 유일 사용처 |
| `deepRedactSecretsPreserving` | 함수 | 없음 — 유일 사용처(`websocket.service.ts`) |
| `VALUE_MASK_MARKER`('***') / `KEY_MASK_MARKER`('[REDACTED]') / `DEPTH_MASK_MARKER`('[REDACTED_DEPTH]') | 상수 | 없음 — 각각 유일한 정의처, `dist/` 산출물 외 중복 없음 |
| `WIRE_PRESERVED_FIELDS` | 모듈-로컬 상수 | 없음 — 기존 `EXTERNAL_STRIPPED_FIELDS`를 재사용(별칭), 신규 값 아님 |
| `MASKED_INPUT_DATA_REASON` | 모듈-로컬 상수(JSDoc 앵커) | 없음 — `executions.service.ts` 유일 정의, 타 파일은 참조만 |
| `maskWireEnvelope` / `toFanoutEnvelope` | private 메서드(`WebsocketService`) | 없음. `toFanoutEnvelope`는 plan 문서(§"신규 식별자 — 기존 패밀리와 사전 대조") 자체가 기존 `to*` 조립 패밀리(`toTerminalErrorPayload`·`toResponseExecution`·`toExecutionDto`) 및 모듈-로컬 `stripAndRedact`(`interaction.service.ts`, EIA REST `getStatus` 전용)와 대조를 이미 수행했고, 독립 검증으로도 이름·역할 모두 겹치지 않음을 확인 |
| `maskIfPresent` | 모듈-로컬 함수 | 없음 — 유일 사용처 |
| `nodeLabel` (WS `execution.node.*` 4개 이벤트의 `nodeName`→`nodeLabel` 정정) | 필드명 | 없음 — 이미 `execution.node.cancelled`가 동일 의미로 `nodeLabel`을 쓰고 있었고, 실측(엔진 emit 전수 `nodeLabel`, `nodeName` emit 0건) 근거로 spec을 구현에 맞춘 정정. 신규 도입이 아니라 기존 정착 이름과의 정합화 |
| `NodeExecutionSummaryDto.inputData` | Swagger DTO 필드(신규 선언) | 없음 — "런타임 응답엔 있었는데 스키마에만 없었던" 선존 갭 문서화. 자매 `BackgroundRunNodeExecutionDto.inputData`가 이미 동일 의미로 존재 |

추가로 다음 축을 점검했으나 해당 없음:
- **요구사항/정책 ID**: diff에 등장하는 `CCH-AD-07`·`CCH-MP-01/04/06`은 모두 기존 행의 설명 확장이며 신규 ID 아님. 새 `EIA-*`/`RR-PL-*`/`WH-*` 정책 ID 신설 없음. `EIA §R17`도 이미 선행 커밋(`b5e4dbb9c`)에서 확립된 섹션을 확장한 것.
- **API endpoint**: 신규 endpoint 없음 (신규/변경 REST route 0).
- **이벤트명**: WS 이벤트 타입 신설 없음(기존 `execution.node.*`/`execution.*`에 마스킹 계층만 추가).
- **env var / config key**: 신규 없음 (`process.env` 관련 추가 0건).
- **파일 경로**: `git diff --diff-filter=A/R`로 확인 — 신규·이동 파일 0건, 기존 파일만 수정.

## 예방 조치의 정합성 확인 (참고)

`plan/in-progress/eia-fanout-and-internal-data-masking.md` §"신규 식별자 — 기존 패밀리와 사전 대조"에서 개발자가 `toFanoutEnvelope`·`redactStoredDataForResponse` 두 식별자를 기존 패밀리(`redact*`/`strip*`/`sanitize*`/`to*`)와 사전 대조한 기록이 있고, 독립 재검증 결과 그 판단(충돌 없음)이 정확함을 확인했다. 마스킹 마커 문자열(`[REDACTED]`/`***`/`[REDACTED_DEPTH]`)의 "선행 층 마커 재마스킹 금지" 설계도 문서화돼 있어 값-수준 충돌(같은 값이 경로마다 다르게 보이는 문제)까지 이미 스스로 다뤘다.

## INFO (경미, 비차단)

- **동일 리터럴 `'***'`의 독립 다중 사용**: `VALUE_MASK_MARKER`(egress 값-패턴 마스킹, 이번 신설) 외에도 `nodes/logic/_shared/value-masking.util.ts`의 `MASK_SECRET`(Variable Modification `recordValues` 스냅샷 마스킹), `nodes/core/error-codes.ts`의 이메일 마스킹, `auth-configs.service.ts`의 credential suffix 마스킹 등이 각자 독립적으로 리터럴 `'***'`을 사용한다. 식별자 이름은 서로 다르므로 "충돌"은 아니지만, 이번 PR과 무관한 기존 서브시스템들이라 target 범위 밖이다. 향후 마스킹 계층이 더 늘어나면 상수 하나로 수렴할지 검토할 여지는 있다(현 시점 조치 불요).

## 요약

target(`spec/5-system/` impl-done, EIA masking followups)이 새로 도입한 식별자(함수·상수·필드·타입 확장)를 전수 대조한 결과, 기존 사용처와 의미가 다른 재사용(충돌)은 발견되지 않았다. `nodeName`→`nodeLabel` 정정은 신규 도입이 아니라 이미 다른 이벤트에서 쓰이던 이름과의 정합화이며, 미구현 `execution.paused` 행의 잔존 `nodeName`도 문서 내에서 의도적 유지로 명시돼 있어 혼선 소지가 없다. 요구사항 ID·API endpoint·이벤트명·env var·파일 경로 축 모두 신규 항목이 없어 해당 축의 충돌 가능성 자체가 없다. 개발자가 plan 문서에 신규 식별자 사전대조 절차를 이미 수행·기록해 두었고 독립 검증으로도 결론이 일치한다.

## 위험도

NONE
