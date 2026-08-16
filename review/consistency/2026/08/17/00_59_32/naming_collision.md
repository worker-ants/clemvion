# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 검토 범위 재구성

프롬프트 번들의 `<git diff origin/main...HEAD -- code_areas>` 섹션이 컨텍스트 예산 초과로 생략되어 있어, 대상 worktree(`/Volumes/project/private/clemvion/.claude/worktrees/eia-masking-followups-3cd512`)에서 직접 `git diff origin/main...HEAD`(stat + 관련 파일 전문)를 재산출해 분석했다. 실질 변경 spec 파일: `spec/1-data-model.md`, `spec/5-system/{3-error-handling,6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api,15-chat-channel}.md`. 코드 변경: `codebase/backend/src/modules/websocket/websocket.service.ts`, `codebase/backend/src/shared/utils/{sanitize-error-message,redact-stored-error}.ts`, `executions.service.ts`, `background-runs.service.ts`, 관련 DTO/spec 파일. 이번 PR 은 신규 기능이 아니라 **기존 마스킹 체계에 신규 초크포인트·마커 상수·헬퍼 함수를 추가**하는 성격이라, 점검은 이 신규 식별자들이 기존 명명 패밀리와 겹치는지에 집중했다.

## 발견사항

- **[INFO]** `redactStoredDataForResponse` 가 정의된 파일명이 함수 의미와 어긋난다
  - target 신규 식별자: `redactStoredDataForResponse` (`codebase/backend/src/shared/utils/redact-stored-error.ts:66`)
  - 기존 사용처: 같은 파일의 자매 함수 `redactStoredErrorForResponse` (동 파일 28행) — 파일명은 `redact-stored-**error**.ts`
  - 상세: 신규 함수는 `Execution.error` 가 아니라 `inputData`/`outputData` **컬럼**을 마스킹한다(spec 14-external-interaction-api.md §R17 "적용 범위는 총칭이 아니라 열거다" 항목이 `outputData` 담당자로 이 함수를 명시). 파일명이 `-error`로 고정돼 있어 "Data" 용도의 함수가 이 파일에 있다는 것이 이름만으로는 드러나지 않는다. plan 문서(`plan/in-progress/eia-fanout-and-internal-data-masking.md` §"신규 식별자 — 기존 패밀리와 사전 대조") 가 이미 "자매 `redactStoredErrorForResponse` 와 같은 파일·같은 명명 규칙, Error↔Data 로 대상 컬럼만 갈린다"고 의도적 배치임을 명시해 뒀다 — 충돌은 아니고 저자도 인지하고 있는 트레이드오프다.
  - 제안: 실제 충돌은 아니므로 액션 불필요. 향후 파일을 리네임할 계기(예: 세 번째 `redactStored*ForResponse` 자매 추가)가 생기면 `redact-stored-error.ts` → `redact-stored-execution-fields.ts` 류로 넓히는 것을 고려.

- **[INFO]** `execution.paused`(미구현) 행에 `nodeName` 이 유일하게 잔존
  - target 신규 식별자: 없음(target 은 `nodeLabel` 로 통일하는 정정) — 참고용 잔여 관찰
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md:185` `execution.paused _(계획·미구현)_` 행 `{ executionId, nodeId, nodeName, reason }`
  - 상세: 이번 diff 는 `execution.node.started/completed/failed/skipped` 4행의 `nodeName` → `nodeLabel` 오기를 실측 기반으로 정정했다(엔진 emit 전수가 `nodeLabel`, `nodeName` emit 0건). 같은 `execution.*` 이벤트 패밀리 안에서 미구현 `execution.paused` 행만 `nodeName` 이 그대로 남아, 같은 파일 안에 두 필드명이 병존하게 됐다. target 문서 자체가 이를 각주로 명시("미구현 이벤트 execution.paused 행은 emit 대상이 아니라 그대로 두되, 구현 착수 시 nodeLabel 로 맞춘다")하고 있어 의도된 유예이지 누락이 아니다.
  - 제안: 액션 불필요(이미 각주로 처리됨). 실제 `execution.paused` 구현 착수 PR 에서 `nodeLabel` 로 함께 정정하면 됨 — 재지적 방지용으로만 기록.

- **[INFO]** 신규 마커 상수 3개(`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`) — 충돌 없음, 확인 완료
  - target 신규 식별자: `VALUE_MASK_MARKER`('***') · `KEY_MASK_MARKER`('[REDACTED]') · `DEPTH_MASK_MARKER`('[REDACTED_DEPTH]') (`codebase/backend/src/shared/utils/sanitize-error-message.ts:118-122`)
  - 확인: `git grep`으로 코드베이스 전체에서 이 세 이름이 이번 diff 밖에서 다른 의미로 쓰이는 곳 없음을 확인. 값 자체(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)는 종전부터 리터럴로 산재해 있던 것을 상수화한 것이라 **문자열 값 충돌이 아니라 오히려 SoT 통합**이다.

## 확인했으나 충돌 없음으로 판정한 항목 (근거만 기록)

- `MASKED_INPUT_DATA_REASON`(`executions.service.ts:83`) — 코드베이스 전체에서 유일, `_REASON` 접미 상수 패밀리(`COUNTER_REGRESSION_REASON_PATTERN`, `STATUS_REASON_SET`)와 이름 충돌 없음.
- `WIRE_PRESERVED_FIELDS`(`websocket.service.ts:79`) — `EXTERNAL_STRIPPED_FIELDS` 를 재사용하는 별칭 Set. 코드베이스에 동명 식별자 없음.
- `toFanoutEnvelope`/`maskWireEnvelope`(`WebsocketService` 신규 private 메서드) — plan 문서가 이미 `interaction.service.ts` 의 모듈-로컬 `stripAndRedact` 와의 동명 재사용을 의도적으로 회피했다고 밝혔고, 실제로 두 식별자 모두 클래스 범위 내 유일함을 grep 으로 확인.
- `deepRedactSecretsPreserving`(`sanitize-error-message.ts`) — `deepRedactSecrets` 자매 확장, 동명 충돌 없음.
- `execution.node.*` emit payload 의 `nodeLabel` 필드 — spec 전역(`3-workflow-editor/4-ai-assistant.md`, `conventions/conversation-thread.md`, `4-nodes/3-ai/0-common.md` 등)에서 이미 "노드 표시 라벨 스냅샷"이라는 동일 의미로 쓰이던 필드명과 정확히 일치. 신규 도입이 아니라 spec 오기를 실제 사용 중인 이름에 맞춘 정정이므로 충돌 해소 방향.
- `Execution.error`/`Execution.inputData`/`Execution.outputData` 등 엔티티 컬럼명, `STATE_MISMATCH`/`INVALID_EXECUTION_STATE` 등 에러 코드 — 이번 diff 는 새 코드/필드를 추가하지 않고 기존 필드에 마스킹 정책만 얹었다. 신규 요구사항 ID·API endpoint·webhook/queue 이벤트명·ENV var·설정 키는 이번 diff 범위에 없음.
- `spec/5-system/14-external-interaction-api.md` §R17 의 "잔여 ①②③"(원형숫자)와 표면 열거 "(1)~(6)"(아라비아 숫자) — 문서 자체가 두 열거를 글리프로 구분하겠다고 명시했고(2026-08-16 `23_49_05` naming W1 후속), 실제 본문에서 원형숫자·아라비아 숫자가 혼용되지 않고 정확히 분리돼 있음을 확인.

## 요약

이번 PR 은 신규 엔터티·API endpoint·요구사항 ID·이벤트명·ENV 변수를 도입하지 않고, 기존 마스킹 파이프라인에 새 헬퍼 함수·마커 상수·private 메서드를 추가하는 리팩터/하드닝 성격이다. 신규 식별자들은 이름 충돌 없이 기존 명명 패밀리(`redact*ForResponse`, `*_MASK_MARKER`, `to*Envelope`)에 정합하게 배치됐고, 이 배치는 plan 문서(`eia-fanout-and-internal-data-masking.md`)가 착수 시점에 이미 기존 패밀리와 대조해 문서화해 둔 것이라 저자 스스로 충돌 위험을 선제 검토한 흔적이 있다. `nodeName`→`nodeLabel` 정정은 새 충돌이 아니라 오래된 spec-vs-code drift(오기)를 실측으로 바로잡은 것이며, 유일한 잔여(`execution.paused` 행)도 각주로 명시적으로 유예됐다. CRITICAL/WARNING 급 신규 식별자 충돌은 발견하지 못했고, INFO 2건은 정보성 관찰(파일명-함수명 미스매치, 미구현 이벤트 필드명 잔존)로 즉시 조치 불필요.

## 위험도

LOW
