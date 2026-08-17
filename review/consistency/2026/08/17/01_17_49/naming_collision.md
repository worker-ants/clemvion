# 신규 식별자 충돌 검토

## 검토 범위

diff-base `origin/main` 대비 `spec/5-system/**`(+ `spec/1-data-model.md`, `spec/conventions/node-output.md`) 전체 누적 diff (총 8,605 삽입/117 삭제, 이 브랜치의 마스킹 연쇄 커밋 전체 — 최신 커밋 `39cb0bf1a` 포함)와 이를 뒷받침하는 `codebase/backend` 코드 변경(`redact-stored-error.ts`·`sanitize-error-message.ts`·`websocket.service.ts`·`executions.service.ts`·`execution-response.dto.ts` 등)을 실제 워킹트리에서 직접 diff 를 재산출해 확인했다 (prompt 번들의 `<git diff …>` 섹션은 컨텍스트 예산으로 절단돼 있어 원문을 신뢰할 수 없었음).

## 발견사항

- **[INFO]** `execution.paused`(미구현) 행만 `nodeName` 잔존 — 나머지 4개 형제 이벤트는 `nodeLabel` 로 정정됨
  - target 신규 식별자: 없음 (이번 diff 는 오히려 `nodeName` → `nodeLabel` 로 **정정**하는 방향)
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md` §4.1 이벤트 표 — `execution.node.started`/`completed`/`failed`/`skipped`/`cancelled` 는 이번 diff 로 `nodeLabel` 정정 완료, 그러나 **같은 표의 `execution.paused`**(계획·미구현) 행은 여전히 `nodeName` 그대로 남아 있음 (L185).
  - 상세: `nodeLabel` 은 spec 전역(`conversation-thread.md`·`4-ai-assistant.md`·`0-common.md`·`data-flow/13-agent-memory.md` 등)에서 이미 "노드 라벨" 의미로 일관되게 쓰이는 확립된 필드명이다. 이번 정정으로 같은 §4.1 표 안에 `nodeLabel`(구현됨 5행)과 `nodeName`(미구현 1행)이 **나란히** 남아, 향후 `execution.paused` 를 구현할 때 spec 표의 필드명을 그대로 베껴 `nodeName` 을 실제로 emit 해버릴 위험이 있다 — 그러면 다시 이번에 정정한 것과 같은 drift 가 재발한다.
  - 제안: 이미 문서 자체가 각주(`> **Note (2026-08-16 정정 완료)**: … 구현 착수 시 nodeLabel 로 맞춘다`)로 캐비엇을 달아 위험을 완화했으므로 추가 조치는 선택 사항이지만, `execution.paused` 행의 `nodeName` 도 지금 `nodeLabel` 로 함께 정정하고 각주를 지우면 표 안에 사변적 예외가 하나도 안 남는다.

- **[WARNING]** 새 마커 상수 `KEY_MASK_MARKER = '[REDACTED]'` 가 기존 독립 정의 2곳과 리터럴 값만 공유(이름은 다름)
  - target 신규 식별자: `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 신규 export `KEY_MASK_MARKER`(`'[REDACTED]'`) — `deepRedactCore`/`isMaskedMarker` 가 "이미 마스킹된 값이면 재마스킹하지 않는다"는 멱등성 계약의 근거로 삼는 상수.
  - 기존 사용처: `codebase/backend/src/nodes/integration/_base/sanitize-response-headers.util.ts:25` (`const REDACTED = '[REDACTED]'`, 모듈-비공개) · `codebase/backend/src/modules/workflow-assistant/tools/redact.ts:11` (`const REDACTED = '[REDACTED]'`, 모듈-비공개) · `http-request.handler.ts:84` 의 인라인 리터럴.
  - 상세: 이름은 서로 다르므로 "동일 식별자가 다른 의미로 충돌"하는 CRITICAL 케이스는 아니다. 그러나 새로 추가된 `isMaskedMarker`(→ 마커 재마스킹 방지)는 **문자열 값의 일치**에만 의존하는데, 값이 일치하는 근거가 되는 두 기존 상수가 모두 **비공개(un-exported)**라 import 로 묶을 수 없어 "우연히 같은 리터럴" 로만 결합돼 있다. 이번 diff 의 자체 주석(`sanitize-error-message.ts` 신규 JSDoc)이 이미 이 결합을 문서화하고 "`[REDACTED]` 는 문서화된 계약" 이라 명시했지만, 컴파일러가 강제하는 관계가 아니라서 세 곳 중 한 곳이 마커 문자열을 바꾸면(예: `sanitize-response-headers.util.ts` 가 `'[HIDDEN]'` 로 바뀌는 등) `isMaskedMarker` 가 조용히 놓치고 이중 마스킹(`[REDACTED]` → `***`)이 재발할 수 있다.
  - 제안: 이미 이번 diff 가 §R17/§4.1 문서에 "마커는 덮지 않는다"는 불변식을 명문화했으니, 후속으로 (a) `sanitize-response-headers.util.ts`/`workflow-assistant/tools/redact.ts` 의 `REDACTED` 를 export 해 `sanitize-error-message.ts` 의 `KEY_MASK_MARKER` 를 단일 진실로 참조하게 하거나, (b) 최소한 세 정의 지점에 상호 참조 주석(`{@link}`)을 남겨 drift 를 막는 조치를 트래커에 등재할 것을 권장한다. 이번 PR 을 막을 사안은 아니다(CRITICAL 아님) — 세 리터럴이 지금은 실제로 같은 값이라 기능 회귀는 없다.

- **[INFO]** `WIRE_PRESERVED_FIELDS`(신규) 는 `EXTERNAL_STRIPPED_FIELDS`(기존)의 의미상 반대 이름이지만 실제로는 같은 배열을 감싼 파생값
  - target 신규 식별자: `codebase/backend/src/modules/websocket/websocket.service.ts` 신규 `const WIRE_PRESERVED_FIELDS: ReadonlySet<string> = new Set(EXTERNAL_STRIPPED_FIELDS)`.
  - 기존 사용처: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 의 기존 export `EXTERNAL_STRIPPED_FIELDS`(`= ['llmCalls']`, 이 diff 이전부터 존재 — `git diff origin/main...HEAD` 에서 이 파일은 무변경).
  - 상세: "wire 에서 보존" 대 "외부로 나갈 때 제거" 라는 반대 방향 이름이 같은 `['llmCalls']` 리스트를 가리키는 것 자체는 두 소비 방향(내부 wire 유지 vs fanout 제거)이 논리적으로 상반되므로 정당하고, 코드 주석도 "두 목록이 갈리면 안 된다" 는 이유로 명시적으로 `new Set(EXTERNAL_STRIPPED_FIELDS)` 파생을 택해 이름 충돌/drift 위험을 스스로 차단했다. 실질적 충돌은 아니며 참고용으로만 기록한다.
  - 제안: 조치 불요.

- **[없음]** 신규 요구사항 ID / API endpoint / webhook·queue·SSE 이벤트명 / 환경변수·설정키 / spec 파일 경로 충돌
  - 이번 diff 는 `spec/5-system/{1-data-model,3-error-handling,6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api,15-chat-channel}.md` + `spec/conventions/node-output.md` 의 **기존 섹션·기존 필드·기존 R-번호(§R17 등)·기존 정책 ID(EIA-*, CCH-MP-*)** 안에서 서술을 보강/정정하는 것이 전부다. 새 REST endpoint, 새 WS/webhook 이벤트명, 새 ENV var, 새 spec 파일은 도입되지 않았다.
  - 코드 쪽 신규 식별자(`redactStoredDataForResponse`, `maskIfPresent`, `MASKED_INPUT_DATA_REASON`, `maskWireEnvelope`, `toFanoutEnvelope`, `deepRedactSecretsPreserving`, `deepRedactCore`, `VALUE_MASK_MARKER`/`DEPTH_MASK_MARKER`, `DeepRedactOptions`, `NO_OPTS`, `MASKED_MARKERS`, `isMaskedMarker`, `ResponseExecution.outputData`/`ResponseNodeExecution.outputData`)는 전수 grep 결과 각각 자기 모듈·형제 함수 범위 밖에서 다른 의미로 재사용되고 있지 않음을 확인했다.

## 요약

이번 target diff(`spec/5-system/**` 누적 변경 + 뒷받침 코드)는 신규 요구사항 ID·API endpoint·이벤트명·환경변수·spec 파일 경로를 새로 도입하지 않으며, 새로 추가된 코드 식별자(`redactStoredDataForResponse`·`maskIfPresent`·`MASKED_INPUT_DATA_REASON`·`maskWireEnvelope`·`toFanoutEnvelope`·`deepRedactSecretsPreserving`·`VALUE_MASK_MARKER` 등)도 전수 확인 결과 기존 코드베이스에서 다른 의미로 쓰이고 있지 않아 CRITICAL 급 충돌은 없다. 다만 (1) 같은 WS 이벤트 표 안에서 구현된 5개 행은 `nodeLabel` 로 정정됐는데 미구현 `execution.paused` 행만 `nodeName` 으로 남아 표 내부에 필드명 불일치가 잔존하고, (2) 새 마커 상수 `KEY_MASK_MARKER='[REDACTED]'` 가 import 불가능한(비공개) 두 기존 동일-리터럴 상수와 이름 없이 값으로만 결합돼 있어 향후 한쪽이 바뀌면 마스킹 멱등성이 조용히 깨질 여지가 있다 — 둘 다 기능 회귀는 아니고 문서/유지보수 관점의 WARNING·INFO다.

## 위험도

LOW
