# 보안(Security) 코드 리뷰

## 개요

이 changeset 은 취약점을 새로 만드는 diff 가 아니라, 이미 알려진 두 egress-masking 갭
(§A WS emit 값-패턴 마스킹, §B 내부 REST `inputData`/`outputData` 마스킹)을 닫는
**보안 하드닝 커밋**이다. 핵심 변경:

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `deepRedactSecrets` 를
  `deepRedactCore`(공유 walk) + `deepRedactSecretsPreserving`(preserveKeys 예외)로 분리하고,
  마스킹 마커 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)을 상수화해 재마스킹(멱등성) 가드 도입.
- `codebase/backend/src/modules/websocket/websocket.service.ts` — `emitExecutionEvent`/
  `emitNodeEvent` 두 emit 경로가 공유하는 `maskWireEnvelope` 초크포인트를 도입해 wire·fanout
  양쪽에 값-패턴 마스킹 적용(`llmCalls` 만 `WIRE_PRESERVED_FIELDS` 로 wire 원문 보존, fanout 은
  기존 `stripExternalOnlyFields` 로 필드째 제거).
- `codebase/backend/src/shared/utils/redact-stored-error.ts` — `error` 전용이던 마스킹을
  `inputData`/`outputData` 컬럼까지 확장하는 자매 함수 `redactStoredDataForResponse` 추가.
- `executions.service.ts`/`background-runs.service.ts` — 6개 읽기 표면(`findById`·`getChain`·
  `stop`·목록 `toExecutionDto`·`findById` 의 `nodeExecutions[]`·`BackgroundRunsService`) 전체에
  일괄 적용. `Execution.inputData`(최상위) 만 카브아웃(재제출 소비처 보호를 위해 의도적으로
  마스킹 제외, `MASKED_INPUT_DATA_REASON` 에 근거 명문화) — `NodeExecution.inputData` 는
  재제출 소비처가 없어 마스킹 대상.

코드·정규식·인가 경계를 직접 대조 검증했다(diff + 전체 파일 Read, `git diff f5351e9c2..HEAD`
기준). 아래는 발견사항이며 전부 INFO — 이 diff 가 도입한 CRITICAL/WARNING 급 취약점은
찾지 못했다.

## 발견사항

- **[INFO]** `Execution.inputData`(최상위, node-level 아님)는 egress 마스킹 대상에서 의도적으로
  제외된다 — 트리거 자유 텍스트에 자격증명이 있으면(webhook 민감 헤더 제외) 계속
  워크스페이스 멤버 전원(뷰어 포함)에게 원문 노출된다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `MASKED_INPUT_DATA_REASON` 상수 및 JSDoc(58~92행 부근), `toResponseExecution`(1044~1046행 부근 `inputData: execution.inputData ?? null,` 줄)
  - 상세: Re-run 모달·에디터 "히스토리에서 불러오기"가 이 값을 그대로 재제출 소비하기 때문에 마스킹하면 `'***'` 가 새 실행의 실제 입력이 되는 기능 오염이 생겨(양쪽 CRITICAL 로 이미 독립 발견됨), 의도적으로 카브아웃한 트레이드오프다. 잔여 갭임을 코드 주석 자체가 인정하고 있고("트리거 파라미터 자유 텍스트의 자격증명은 계속 노출된다"), webhook 민감 헤더는 ingestion 시점에 이미 `[REDACTED]` 되어 있어 주요 벡터는 이미 닫혀 있다. 이 변경이 만든 새 취약점이 아니라 기존 상태 유지이며, 문서화·트래커 등재까지 되어 있어 재지적할 실익은 낮다.
  - 제안: 조치 불요(설계 결정, 이미 문서화). 후속으로 "마스킹 마커 감지 시 프런트가 재입력을 강제"하는 가드가 선행되면 이 컬럼도 닫는다는 계획이 이미 코드 주석에 등재되어 있으므로 그 계획을 트래킹하는 정도로 충분하다.

- **[INFO]** 마커 멱등성(`isMaskedMarker`) 검사는 `CREDENTIAL_KEY_PATTERN` 매치 분기(키-이름 기반)에만 적용되고, 값-패턴 정규식 치환(`redactSecrets`/`SECRET_LEAK_PATTERNS`) 경로에는 적용되지 않는다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `deepRedactObject` 함수 내 `isMaskedMarker(v) ? v : VALUE_MASK_MARKER` 분기 vs `deepRedactCore` 상단의 문자열 leaf 처리(`redactSecrets`/`redactSecretsInJsonString` 호출부)
  - 상세: 이미 `[REDACTED]`로 마스킹된 텍스트가 credential-key 가 아닌 자유 텍스트 필드에 박혀 있고 그 안에 `Authorization:` 같은 접두어가 남아 있으면(예: `note: "Authorization: [REDACTED]"`), `/\bAuthorization:[^\r\n]*/gi` 패턴이 그 나머지 줄 전체를 다시 `***` 로 치환한다. 정보 노출 방향이 아니라(오히려 더 가려짐) 표시 일관성 문제이며, 이미 알려진 "잔여 갭"으로 문서화된 트레이드오프의 연장선이라 보안 위험은 없다.
  - 제안: 조치 불요. 필요시 `redactSecrets` 자체에도 마커 사전-검사를 추가할 수 있으나 우선순위 낮음.

- **[INFO]** `WebsocketService.emitKbEvent`(KB 문서 처리 이벤트, `kb:<documentId>` 채널)와 `emitBackgroundRunEvent`(`background:run:<id>` 채널)는 이번 diff 의 새 값-패턴 마스킹 초크포인트(`maskWireEnvelope`)를 거치지 않고 `sanitizePayloadForWs`(키-이름 기반)만 적용한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — `emitKbEvent`(약 310~324행), `emitBackgroundRunEvent`(약 449~465행). 둘 다 이번 diff 에서 변경되지 않은 기존 코드다.
  - 상세: 실측 결과 `emitBackgroundRunEvent`의 유일한 자유-텍스트 필드인 `errorMessage`는 호출부(`codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts`)에서 이미 `sanitizeErrorMessage`(별도 모듈, `shared/utils/sanitize-error-message.ts`의 `redactSecrets` 재사용)를 거쳐 전달되므로 실질 갭은 아니다. `emitKbEvent`는 이번 changeset 의 선언된 범위(§A: execution/node WS 이벤트) 밖이라 회귀가 아니지만, 임베딩/그래프 추출 provider 에러 메시지에 자격증명이 echo 될 수 있는 클래스라 같은 값-패턴 마스킹 부재 상태다.
  - 제안: 조치 불요(범위 밖, 이번 diff 의 회귀 아님). 후속 하드닝 후보로만 기록 권장.

## 요약

리뷰 대상 diff 는 인젝션·인증 우회·하드코딩 시크릿·안전하지 않은 암호화 같은 전형적
취약점을 도입하지 않았다. 오히려 그 반대로, WS emit 두 경로(`emitExecutionEvent`/
`emitNodeEvent`)와 내부 REST 읽기 6표면에서 값-패턴 자격증명(Bearer 토큰·JWT·URI
userinfo)이 원문으로 새던 실제 갭을 공유 초크포인트(`maskWireEnvelope`/
`redactStoredDataForResponse`)로 닫는 보안 수정이다. `sanitizePayloadForWs`(키-이름
기반)와 `deepRedactSecrets`(값-패턴 기반)의 역할 분리, `llmCalls` preserve-key 예외가
fanout `stripExternalOnlyFields` 로 외부 노출 없이 유지되는지, WS 구독 인가(`workspace
소유만 검사, role 무관`)가 REST 인가와 동일 인구임을 근거로 wire 마스킹까지 확장한 논리,
마커(`[REDACTED]`/`***`/`[REDACTED_DEPTH]`) 재마스킹 방지로 webhook ingestion 계약을
깨지 않는지까지 코드·정규식·테스트 캐너리를 직접 대조해 확인했고, 모두 일관됐다. 유일한
잔여 리스크는 `Execution.inputData`(최상위) 카브아웃인데, 이는 Re-run 재제출 기능을
보호하기 위해 의도적으로 문서화된 트레이드오프이며 이 diff 가 만든 신규 결함이 아니다.
정규식(`SECRET_LEAK_PATTERNS`)도 중첩 정량자·backtracking 폭발 소지가 없는 선형 패턴들로
구성돼 ReDoS 우려도 없다.

## 위험도
NONE
