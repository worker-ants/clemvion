### 발견사항

없음.

본 PR(diff `origin/main...HEAD`, scope `spec/5-system/` + 관련 코드)이 도입한 신규 식별자를 전수 확인했으나 기존 사용처와 충돌하는 항목이 없었다.

**확인한 신규 식별자와 충돌 검사 결과**:

- **함수/메서드명**: `redactStoredDataForResponse`(`shared/utils/redact-stored-error.ts`), `deepRedactSecretsPreserving`·`deepRedactCore`·`isMaskedMarker`(`shared/utils/sanitize-error-message.ts`), `WebsocketService.maskWireEnvelope`·`WebsocketService.toFanoutEnvelope`(`modules/websocket/websocket.service.ts`) — 전부 `git grep` 전수 검색 결과 정의처 1곳 + 호출/테스트 참조만 존재. 기존에 다른 의미로 쓰인 동명 식별자 없음.
- **상수/마커명**: `VALUE_MASK_MARKER`(`'***'`) · `KEY_MASK_MARKER`(`'[REDACTED]'`) · `DEPTH_MASK_MARKER`(`'[REDACTED_DEPTH]'`) · `MASKED_MARKERS` · `WIRE_PRESERVED_FIELDS` · `DeepRedactOptions`(interface) · `MASKED_INPUT_DATA_REASON` — 모두 신규 도입이며 저장소 내 유일한 정의처. 리터럴 값 자체(`'[REDACTED]'`/`'***'`)는 기존에도 동일 문자열로 이미 사용되던 마커를 상수로 승격한 것뿐이라 의미 충돌 없음(오히려 여러 곳에 흩어져 있던 동일 리터럴을 단일 SoT 로 통합).
- **요구사항 ID**: 본 PR 은 `EIA §R17`, `EIA-RL-06`, `EIA-AU-08` 등 기존 ID 를 **참조**만 하고 새 `EIA-XX-NN` 행을 추가하지 않았다(`spec/5-system/14-external-interaction-api.md` 요구사항 표 diff 없음 — 본문 산문 섹션만 갱신). 신규 ID 부여 없음.
- **API endpoint**: 코드 diff 전체(`git diff origin/main...HEAD -- codebase/`)에 `@Get/@Post/@Put/@Patch/@Delete` 신규 추가 없음. 신규 endpoint 없음.
- **이벤트명**: WS 이벤트 이름(`execution.node.*`, `execution.snapshot` 등) 신규 도입 없음 — 기존 이벤트의 payload 필드명 표기(`nodeName` → `nodeLabel`)를 실측(엔진 emit 전수 `nodeLabel` 사용, `nodeName` emit 0건)에 맞춰 정정한 것으로, `nodeLabel` 은 같은 표의 `execution.node.cancelled` 행에 이미 쓰이던 필드명과 동일해 오히려 표 내부 불일치를 해소했다.
- **환경변수**: 신규 ENV var 도입 없음(`WEBCHAT_IDLE_REAP_GRACE_MS`·`EXECUTION_SEQ_TTL_SECONDS` 등은 기존 ID 를 재인용).
- **파일 경로**: `spec/`·`codebase/` 아래 신규 파일 생성 없음(전부 기존 파일 수정). `plan/in-progress/` 신규 파일 2개(`eia-fanout-and-internal-data-masking.md`, `spec-draft-eia-fanout-masking.md`)는 기존 명명 컨벤션(`eia-*`, `spec-draft-eia-*`)을 따르며 같은 디렉터리의 `eia-context-schema-followups.md`·`spec-draft-eia-62-waiting-payload.md` 등과 충돌 없음.

### 요약

본 PR 은 EIA/WS 마스킹 계층(값-패턴 마스킹 초크포인트, `inputData`/`outputData` egress 마스킹)을 신설하며 여러 신규 함수·상수·DTO 주석을 도입했지만, `git grep` 전수 검색으로 확인한 결과 모든 신규 식별자가 저장소 내 유일한 정의처를 가지며 기존 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수·파일 경로와 충돌하지 않는다. 유일하게 관찰된 표기 변경(`nodeName`→`nodeLabel`)도 신규 도입이 아니라 기존 구현·타 이벤트 행과 이미 일치하던 필드명으로의 정정이라 충돌이 아닌 정합화다.

### 위험도
NONE
