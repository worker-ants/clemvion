# 신규 식별자 충돌 검토 — EIA/WS 값-패턴 마스킹 followups

대상: `spec/5-system/14-external-interaction-api.md` §R17 / `spec/5-system/6-websocket-protocol.md` §4.1·Rationale / `spec/5-system/12-webhook.md` §5.3 (diff `origin/main..HEAD`, 3 commits: `1b8fd5cc7`·`fe6a54c80`·`e5a63abff`)

## 발견사항

- **[WARNING] 신규 6-surface 열거(①~⑥)가 같은 절의 기존 "잔여 ①②③" 원형숫자 표기와 글리프를 공유**
  - target 신규 식별자: `spec/5-system/14-external-interaction-api.md:1514-1516` — §R17 "적용 범위는 총칭이 아니라 열거다" 캐비엇에 신설된 `① findById ② getChain ③ stop ④ toExecutionDto(목록) ⑤ findById 의 nodeExecutions[] ⑥ BackgroundRunsService.toNodeExecutionDto` (6개 masking 관문 열거)
  - 기존 사용처: 같은 절, 불과 7~14줄 아래(`:1523`,`:1526`,`:1528`)의 `잔여 ①` / `잔여 ②` / `잔여 ③` — WS emit·`inputData`/`outputData`·workflow-assistant LLM 도구 세 항목을 가리키는 **이미 안정된, 외부에서 참조되는** 원형숫자 표기(`plan/complete/eia-internal-rest-error-masking.md:355`, `plan/in-progress/spec-draft-eia-fanout-masking.md:8,54-57` 가 동일 `잔여 ①/②/③` 를 인용)
  - 상세: 같은 §R17 절 안에서 원형숫자 글리프(①②③…)가 서로 무관한 두 열거 — "6개 masking 관문"과 "3개 잔여(gap) 항목" — 에 재사용된다. 코드 쪽 정본인 `ExecutionsService.toResponseExecution` JSDoc 표(`codebase/backend/src/modules/executions/executions.service.ts:1028-1035`)는 이미 일반 숫자 `1 2 3 4 5 6` 을 쓰는데, spec 이 이를 옮겨적으며 원형숫자로 바꿔 우연히 "잔여" 열거와 같은 글리프 계열을 공유하게 됐다. `잔여 ①/②/③` 은 매번 "잔여" 접두가 붙어 즉각 오독으로 이어지진 않지만, 같은 절 안에서 `①`·`②`·`③` 이 두 가지 다른 대상을 가리키는 상태라 grep(`①`)·빠른 스캔·인용 시 두 열거가 하나의 연속 번호 체계로 오인될 위험이 있다. 특히 diff 자체가 "이 문서가 반복해 겪은 실패 형태라 표면을 이름으로 못박는다" 는 목적으로 총칭 대신 열거를 택한 대목이라, 그 열거 표기 자체가 인접한 다른 열거와 섞이는 것은 이 변경의 취지(모호성 제거)와 어긋난다.
  - 제안: 신규 6-surface 열거는 코드 정본(`toResponseExecution` JSDoc)과 동일하게 아라비아 숫자(`1.`~`6.` 또는 `(1)`~`(6)`)로 표기해 원형숫자(①②③)는 기존 "잔여" 열거 전용으로 남긴다. 이렇게 하면 spec 서술이 code comment 의 정본 표기와도 1:1 로 일치해 "소스 정본은 `toResponseExecution` 의 표" 라는 바로 다음 문장과도 더 정확히 맞물린다.

- **[INFO] `execution.node.*` 신규 emit 마스킹 불릿과 기존 `error` 카탈로그 불릿의 제목 구분 — 충돌 아님, 의도적 사전대조 확인**
  - target 신규 식별자: `execution.node.* / 비-종결 execution.* emit 의 자유 텍스트 값 (강제됨 — 2026-08-16)` (`14-external-interaction-api.md:1535`)
  - 기존 사용처: 같은 §R17 안의 `execution.ai_message 라이브 이벤트 (강제됨)`(:1440), `execution.failed payload 의 error.message/error.details — DB Execution.error 원문 (강제됨 — 2026-08-16)`(:1464) — 모두 `error`/자유텍스트 값을 다루는 유사 주제
  - 상세: 세 불릿 모두 필드 경로+표면을 제목에 박아 서로 구분되며(plan `22_22_36` naming INFO-3 을 실제로 반영한 흔적), 실제 실행해 보니 중복·모호성 없음. 문제 없음을 확인차 기록.

- **[INFO] 코드 식별자(`redactStoredDataForResponse`·`WIRE_PRESERVED_FIELDS`·`toFanoutEnvelope`·`maskWireEnvelope`·`deepRedactSecretsPreserving`) — 기존 패밀리와 충돌 없음, 실측 확인**
  - 상세: `git grep` 으로 코드베이스 전체를 확인한 결과 위 식별자들은 전부 **단일 정의**만 갖고 spec 인용과 1:1 대응한다. `redactStoredDataForResponse` 는 자매 `redactStoredErrorForResponse` 와 같은 파일(`shared/utils/redact-stored-error.ts`)·같은 명명 규칙(대상 컬럼만 `Error`↔`Data` 로 교체)이라 의도된 짝이다. `toFanoutEnvelope`/`maskWireEnvelope` 은 `WebsocketService` 의 `private` 메서드로 스코프가 닫혀 있어 외부 식별자와 충돌 표면이 없다. plan 문서(`plan/in-progress/eia-fanout-and-internal-data-masking.md` §"신규 식별자 — 기존 패밀리와 사전 대조")가 이미 이 대조를 셀프 수행했고 실측으로도 일치했다.

- **[INFO] `nodeName` → `nodeLabel` 정정 — 기존 spec 전역 용례와 일치, 충돌 아니라 정합화**
  - 상세: `spec/5-system/6-websocket-protocol.md` §4.1 표의 `node.started`/`node.completed`/`node.failed`/`node.skipped` 4행이 `nodeName` → `nodeLabel` 로 정정됐다. `git grep nodeLabel -- spec/` 로 확인하면 `spec/3-workflow-editor/3-execution.md`·`spec/conventions/conversation-thread.md`·`spec/4-nodes/3-ai/0-common.md` 등 타 spec 문서가 이미 전부 `nodeLabel` 을 이 의미로 쓰고 있어, 이번 정정은 새 이름을 들여오는 것이 아니라 이 표만 낙후돼 있던 것을 나머지 문서군과 맞춘 것이다 — 신규 식별자 충돌 관점에서 오히려 위험을 줄이는 방향.

- **환경변수·config key / API endpoint / webhook·queue·sse 이벤트명 / 파일 경로**: 이번 diff(`spec/5-system/{12-webhook,14-external-interaction-api,6-websocket-protocol}.md`)는 새 endpoint·새 env var·새 spec 파일을 추가하지 않는다. 새 이벤트 이름도 없다(기존 `execution.node.*`/`execution.*` 이벤트의 payload 마스킹 규정과 필드명 정정뿐). 요구사항 ID 축에서도 신규 `EIA-XX-NN`/`R-`id 를 발급하지 않고 기존 `R17`(EIA)·기존 §R17 카탈로그·`R-wontdo-rawws-rest`(WS) 를 확장 인용만 한다 — 이 다섯 관점에서는 충돌 후보 없음.

## 요약

이번 target 은 새 코드 식별자를 spec 에 여러 개 노출하지만(`redactStoredDataForResponse`, `WIRE_PRESERVED_FIELDS`, `toFanoutEnvelope`, `maskWireEnvelope`, `deepRedactSecretsPreserving`), 전부 실측(`git grep`)으로 기존 코드와 1:1 대응하고 명명 패밀리(`redactStored*ForResponse`, `to*` 조립, `mask*` 관문)도 일관돼 CRITICAL 급 충돌은 없다. 유일하게 실체가 있는 지적은 spec 문서 표기 축(원형숫자 ①~⑥)이 같은 §R17 절 안에서 이미 안정적으로 쓰이던 다른 원형숫자 열거(`잔여 ①②③`)와 글리프를 공유하게 된 점으로, 코드 정본이 이미 아라비아 숫자를 쓰고 있으므로 spec 도 그에 맞춰 아라비아 숫자로 표기하면 해소된다. `nodeName`→`nodeLabel` 정정은 신규 식별자 도입이 아니라 기존 spec 전역 용례로의 수렴이라 위험을 줄이는 방향이다.

## 위험도

LOW
