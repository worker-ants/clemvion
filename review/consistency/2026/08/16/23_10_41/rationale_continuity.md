# Rationale 연속성 검토 — spec-draft-eia-fanout-masking.md

## 검토 방법
target draft(`plan/in-progress/spec-draft-eia-fanout-masking.md`)의 5개 변경 지점을 각각
- `spec/5-system/14-external-interaction-api.md` `## Rationale` (R1~R19, 특히 R17)
- `spec/5-system/6-websocket-protocol.md` `## Rationale` (llmCalls strip-only 결정 등)
- `spec/5-system/12-webhook.md` `## Rationale` (민감 헤더 ingestion 마스킹 결정)
- `spec/2-navigation/14-execution-history.md` R-5 (boundary masking parity)

와 대조했고, 인용된 라인 번호(`:1515-1525` 등)·함수명(`deepRedactSecretsPreserving`·
`redactStoredDataForResponse` 등)은 실제 spec 원문과 `codebase/backend/src` 소스를 열어
직접 확인했다.

## 발견사항

- **[INFO]** `nodeName` 잔존 예시가 error-handling 스펙에 하나 더 있음(범위 밖, 문제 아님)
  - target 위치: 변경 2 · 2-a (`spec/5-system/6-websocket-protocol.md` §4.1 4행 정정)
  - 과거 결정 출처: 해당 없음(신규 정정, 기각된 결정 재도입 아님)
  - 상세: `spec/5-system/3-error-handling.md` §2.2 "실행 에러 형식" 예시 JSON(그 파일
    249행)에도 `"nodeName": "AI Agent"` 가 남아 있다. 그러나 이는 WS `execution.node.*`
    이벤트 필드가 아니라 별개의 범용 에러 포맷 예시이고, `spec/5-system/15-chat-channel.md`
    §Rationale(659행)의 `{nodeName}` i18n placeholder 언급도 WS wire 필드와 무관한 별도
    네임스페이스(사용자 마스킹 결정 근거)다. target 의 4행 정정은 이 두 곳을 깨지 않는다 —
    검토 요청 관점 "nodeName→nodeLabel 정정이 다른 인용처를 깨지 않는가" 는 **통과**.
  - 제안: 조치 불필요(정보 제공용). error-handling.md §2.2 예시가 stale 이라면 별도
    cross-spec 정합화 항목으로 다룰 것(본 target 의 스코프 밖).

- **[INFO]** `deepRedactSecretsPreserving` 신규 사용은 기존 "단일 마스킹 SoT" 원칙을
  준수함(긍정 확인)
  - target 위치: 변경 1 · 1-a "처방" 문단
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` Rationale "llmCalls 외부
    수신자 strip"(강제 처방을 한 곳에 두는 이유 — "출구를 각자 조립하면 한 번에 하나씩만
    고쳐진다")
  - 상세: target 이 도입하는 `deepRedactSecretsPreserving` 은 완전히 새로운 마스킹
    프리미티브가 아니라 `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의
    기존 `deepRedactSecrets` 와 **같은 캐시·같은 패턴 SoT** 를 공유하는 `preserveKeys` 변형
    (`WIRE_PRESERVED_FIELDS`로 `llmCalls` 서브트리만 skip)이다. 실제 구현
    (`websocket.service.ts` `maskWireEnvelope`)의 JSDoc 이 "wire 에도 거는 이유"를 EIA
    §R17 "boundary masking parity"(execution-history R-5 원용)와 동일 근거로 명시적으로
    인용하고 있어, target draft 의 서술과 소스 코드 코멘트가 1:1 로 일치한다.
  - 제안: 없음(정합 확인).

- **[INFO]** 잔여 ①·②·③ 목록의 라인 인용(`:1515-1525`)과 표면 개수(4곳→6곳)가 실측과
  정확히 일치함(긍정 확인)
  - target 위치: 변경 1 · 1-b, 1-c
  - 과거 결정 출처: EIA §R17 "적용 범위는 총칭이 아니라 열거다" (`14-external-interaction-api.md`
    1512-1525행)
  - 상세: 코드 확인 결과 `redactStoredDataForResponse`(`inputData`/`outputData`)가 이미
    `executions.service.ts`(`toResponseExecution`·`toExecutionDto`·`nodeExecutions[]` map)와
    `background-runs.service.ts`(`toNodeExecutionDto`)의 **응답 DTO 조립 시점**(egress)에
    걸려 있다 — R17 의 "egress-only(내부 소비처는 faithful 유지, DB 는 원문)" 원칙과 정확히
    부합하며 storage-time redaction 이 아니다. target 이 flip 하려는 잔여①(WS
    `execution.node.*` emit)·잔여②(`inputData`/`outputData`)는 실제로 이번 구현이 닫은
    갭과 정확히 대응하고, 잔여③(workflow-assistant LLM 도구, 키-이름 기반
    `maskSensitiveFields` 와의 병합 금지 사유)은 원 Rationale 이 이미 "별도 결정"으로
    분리해 둔 항목이라 target 이 손대지 않는 것이 맞다.
  - 제안: 없음(정합 확인). 이 항목은 "발견사항"이라기보다 검증 기록이며, 본 draft 가
    구현(이미 merge 대기 중인 `1b8fd5cc7`·`fe6a54c80`)을 정확히 반영하고 있음을 뒷받침한다.

- **[INFO]** 2-c 의 "번복이 아니라 범위 명확화" 프레이밍은 원문 기각 근거와 정합
  - target 위치: 변경 2 · 2-c
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` Rationale "llmCalls 외부
    수신자 strip" 절의 "기각된 대안: 값-레벨 마스킹은 에디터 디버깅 가치를 훼손하고
    부분적이며, 워크스페이스 내 viewer/editor 역할 게이트는 별도 RBAC 확장이 필요해
    본 결정 범위를 넘는다."
  - 상세: 인용문은 원문과 정확히 일치(조작·과장 없음). 원 기각 대상은 "`llmCalls` 를
    값-마스킹으로 **대체**한다"는 제안이었고, target 이 신설하는 값-패턴 마스킹은
    `llmCalls` 가 아닌 `error`/`message` 등 **다른** 자유 텍스트 필드를 대상으로 하며
    `llmCalls` 자체는 여전히 wire 원문 유지·fanout strip-only 다. 즉 결정 대상이 겹치지
    않아 "번복"이 아니라는 target 의 주장은 방어 가능하다. 실제 구현(`WIRE_PRESERVED_FIELDS`
    로 `llmCalls` 를 masking 대상에서 제외)도 이 구분을 그대로 지킨다.
  - 제안: 없음.

- **[INFO]** 변경 3(webhook §5.3 캐비엇)은 ingestion 마스킹 Rationale 의 "단일 소스
  커버" 주장을 축소가 아니라 스코프 한정으로 보완함
  - target 위치: 변경 3
  - 과거 결정 출처: `spec/5-system/12-webhook.md` Rationale "민감 헤더 마스킹 —
    ingestion(저장) 시점 채택" (b) "`inputData`·`output.request.headers`·`$trigger.headers`
    + 향후 신규 read 경로까지 단일 소스로 커버"
  - 상세: 원 근거 (b)는 **헤더 값**이 세 표면에 동일하게 나타나므로 ingestion 1회 마스킹으로
    커버된다는 뜻이며, "`inputData` 안의 모든 자유 텍스트"를 포괄한다는 뜻이 아니다. 그러나
    현재 spec 본문(§5.3 :319 부근)의 "`inputData`/`output_data` 를 노출하는 **모든** read
    경로가 자동으로 마스킹된다"는 문장은 헤더 한정임을 명시하지 않아, EIA §R17 이 새로
      닫은 **body/params 자유 텍스트 자격증명** 갭까지 이미 해소된 것으로 오독될 여지가
    있었다(target 스스로 지적한 지점과 동일). target 의 캐비엇은 이 스코프를 명확히 하는
    것으로, ingestion 결정 자체를 뒤집지 않는다. `inputData` 라는 동일 필드명이 (a) 웹훅
    헤더 ingestion 마스킹 대상과 (b) EIA R17 의 egress 값-마스킹 대상(노드/실행 레벨
    inputData/outputData 컬럼)에 겹쳐 쓰이는 용어 중의라 향후 다른 독자가 혼동할 여지는
    남아 있으나, target 의 1-d + 변경 3 캐비엇이 이미 "두 철학이 공존한다"고 명시적으로
    구분해 두었으므로 실질적 위험은 낮다.
  - 제안: (선택) 변경 3 캐비엇에 "이 스코프 한정은 `Execution.inputData` 의 **헤더
    서브필드**에 한정되고, 같은 컬럼의 body/자유 텍스트 부분은 [EIA §R17 잔여② 해소]가
    별도로 커버한다"는 한 문장을 추가하면 두 `inputData` 용례의 혼동을 원천 차단할 수
    있다. 필수는 아님(INFO).

## 요약
target draft 는 이미 머지 대기 중인 구현(`1b8fd5cc7`·`fe6a54c80`, PR #1177~#1179)을 spec 에
등재하는 문서이며, 검토 대상 4가지 관점(기각된 대안 재도입·합의 원칙 위반·무근거 번복·
암묵적 가정 충돌) 중 어느 것도 위반하지 않는다. ①·② flip 은 EIA §R17 자신이 못박은
"적용 범위는 총칭이 아니라 열거다" 원칙을 그대로 계승해 표면을 이름으로 나열하며, ③을
그대로 범위 밖에 두는 것도 원 Rationale 이 이미 분리해 둔 이유(키-이름 기반
`maskSensitiveFields` 힌트 보존과 값-패턴 마스킹의 단순 합성 금지)와 일치한다. 2-c 는
strip-only 결정의 "번복"이 아니라 대상 필드가 다른 "범위 명확화"라는 주장을 원문 인용과
실제 코드(`WIRE_PRESERVED_FIELDS`)가 뒷받침한다. 변경 3 은 ingestion 마스킹 결정의
"단일 소스 커버" 근거를 뒤집지 않고 스코프(헤더 key 한정)를 명확히 할 뿐이다. 4곳→6곳
표면 확장, `deepRedactSecretsPreserving`·`redactStoredDataForResponse` 도입은 실제
소스 코드(`websocket.service.ts`·`executions.service.ts`·`redact-stored-error.ts`)와
1:1 대조로 확인됐고, 모두 "egress-only"(DB 원문 보존, 응답 시점만 마스킹) 불변식을
지킨다. 유일한 잔여 관찰은 `inputData` 라는 동일 필드명이 webhook 헤더-ingestion 마스킹과
EIA egress 값-마스킹 두 문맥에서 쓰여 향후 독자를 혼동시킬 수 있다는 점이나, target 이
이미 1-d/변경 3 에서 두 철학을 명시적으로 구분해 실질 위험은 낮다.

## 위험도
LOW
