# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 범위

`git diff origin/main...HEAD` 기준 실 변경분:

- `spec/5-system/3-error-handling.md` (§2.2 예시 `nodeName`→`nodeLabel` 정정 + 캐비엇)
- `spec/5-system/6-websocket-protocol.md` (§4.1 이벤트 표 `nodeName`→`nodeLabel` 정정, `execution.snapshot` 캐비엇, 값-패턴 마스킹 캐비엇 신설, `llmCalls` strip-only Rationale 보강)
- `spec/5-system/12-webhook.md` (§5.3 ingestion 마스킹 스코프 caveat 추가)
- `spec/5-system/14-external-interaction-api.md` (§R17 확장 — 적용 표면 "넷"→"여섯", emit 값-패턴 마스킹 신설 불릿, ingestion/egress 공존 절)
- `spec/5-system/15-chat-channel.md` (CCH-MP-06 행에 emit 마스킹 이후값 캐비엇)
- 코드: `shared/utils/{redact-stored-error,sanitize-error-message}.ts`, `modules/websocket/websocket.service.ts`, `modules/executions/executions.service.ts`, `modules/executions/background-runs/background-runs.service.ts`, 관련 DTO 2종 + `.spec.ts`

`spec/conventions/**` 자체는 이번 diff 에서 변경되지 않았다 — 즉 규약 개정 없이 기존 규약 아래서 도메인 spec·코드만 변경됐다. 아래는 그 변경이 기존 규약과 정합한지에 대한 판정이다.

## 발견사항

- **[INFO]** `redact-stored-error.ts` 파일명이 이제 error 외 컬럼도 담당
  - target 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` 신설 함수 `redactStoredDataForResponse`
  - 위반 규약: 없음 — `spec/conventions/**` 에 백엔드 util 파일명·단일 책임에 대한 명시 규약이 존재하지 않아 형식 위반은 아니다.
  - 상세: 파일명은 `redact-stored-error`(단수, error 한정)인데 이번 PR 로 `Execution.inputData`/`outputData` 컬럼(비-error)까지 마스킹하는 `redactStoredDataForResponse` 가 같은 파일에 추가됐다. 함수 자체는 JSDoc 으로 "자매 프리미티브"라 명시해 의도를 밝혔고, import 부(`executions.service.ts`, `background-runs.service.ts`)도 동일 파일에서 두 함수를 함께 가져오므로 기능상 혼란은 없다.
  - 제안: 강제 사항은 아니나, 후속에 `redact-stored-response.ts` 등으로 rename 하거나 파일 상단 주석에 "error 전용이 아니라 egress 응답 마스킹 전용"이라는 스코프 정정을 남기면 파일명과 내용의 괴리가 줄어든다.

- **[INFO]** 두 DTO 파일이 swagger.md §1-1(JSDoc 우선) 과 다른 스타일을 각각 유지
  - target 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` (JSDoc `/** */` 패턴) vs `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` (전 필드 `@ApiPropertyOptional({ description })` 패턴)
  - 위반 규약: [`spec/conventions/swagger.md` §1-1](../../../../../spec/conventions/swagger.md#1-1-모든-필드에-jsdoc-추가-한국어) — "DTO에서는 JSDoc 주석을 추가하고, 설명만으로 부족한 경우에만 `@ApiProperty({...})`로 보강"
  - 상세: `background-run-response.dto.ts` 는 이번 PR 이전부터 전 필드가 데코레이터 `description` 패턴으로 일관돼 있었고, 이번 PR 은 그 기존 파일 스타일을 그대로 따라 새 마스킹 캐비엇 문구를 데코레이터 `description` 에 추가했다(신규 편차 아님, pre-existing). `execution-response.dto.ts` 는 반대로 JSDoc 패턴을 따랐다(§1-1 과 정합). 즉 이번 diff 가 새로 규약을 어긴 게 아니라, 이미 갈라져 있던 두 파일의 기존 스타일을 각각 준수하며 확장했을 뿐이다.
  - 제안: diff 범위 밖이라 이번 PR 에서 고칠 필요는 없다. 다음에 `background-run-response.dto.ts` 를 만질 기회가 있으면 JSDoc 패턴으로 통일하는 편이 §1-1 과 더 가깝다.

- **[INFO]** 마스킹 정책이 단일 `spec/conventions/*.md` 로 중앙화되지 않고 5개 도메인 spec 에 분산
  - target 위치: `spec/5-system/3-error-handling.md`, `6-websocket-protocol.md`, `12-webhook.md`, `14-external-interaction-api.md §R17`, `15-chat-channel.md` 전부에 마스킹 관련 캐비엇이 개별 추가됨
  - 위반 규약: 없음 — CLAUDE.md "정보 저장 위치" 표는 "정식 규약"과 "기술 명세(도메인 spec)"를 별도 행으로 구분할 뿐, cross-cutting 동작을 반드시 `spec/conventions/`로 승격하라는 강제 규칙은 없다. 이 저장소에는 두 선례가 공존한다 — cross-cutting 을 컨벤션으로 뽑아낸 사례(`node-cancellation.md`, `secret-store.md`)와, 도메인 spec 에 SoT 를 두고 다른 문서가 참조만 하는 사례(`error-codes.md` 가 카탈로그를 `3-error-handling.md §1` 에 위임하는 방식과 동형). 이번 PR 은 후자 패턴을 따랐고 `14-external-interaction-api.md §R17`을 단일 SoT 로 지정한 뒤 나머지 4개 문서는 전부 그쪽으로 링크·위임한다(예: `6-websocket-protocol.md` "근거·적용 범위·잔여 갭: EIA §R17", `12-webhook.md`·`15-chat-channel.md` 동일).
  - 상세: SoT 원칙(§R17 단일 열거) 자체는 준수되고 있어 "중복 서술"이 아니라 "위임 참조"로 구성돼 있다. 규약 위반은 아니다.
  - 제안: 마스킹 관련 캐비엇이 앞으로도 더 늘어난다면(예: 다른 표면에도 값-패턴 마스킹이 필요해지는 경우) `spec/conventions/output-masking.md` 류로 승격해 §R17 의 "적용 범위는 총칭이 아니라 열거다" 원칙 자체를 정식 규약화하는 것을 고려할 수 있다 — 지금은 사안이 EIA/WS 두 표면에 집중돼 있어 승격 임계에는 못 미친다.

- **[INFO]** review 세션 timestamp 를 spec 본문에 직접 인용
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 (`23_49_05 naming W1`, `23_49_05 cross_spec`, `23_50_03 side_effect`)
  - 위반 규약: 없음 — 이미 이 저장소 전역에 선례가 다수 있다(`spec/4-nodes/1-logic/10-parallel.md` `23_36_57 rationale_continuity`, `spec/5-system/1-auth.md` `review/consistency/.../17_21_27`, `spec/7-channel-web-chat/4-security.md` `ai-review 15_50_56` 등). 근거 추적성을 남기는 확립된 관행과 일치한다.
  - 상세/제안: 해당 없음 (규약 준수 확인 목적의 참고 기록).

## 요약

이번 diff 는 `spec/conventions/**` 자체를 건드리지 않고 기존 규약 틀 안에서 5개 도메인 spec(`3-error-handling`·`6-websocket-protocol`·`12-webhook`·`14-external-interaction-api`·`15-chat-channel`) 과 대응 코드를 갱신했다. 명명 규약(에러 코드 `UPPER_SNAKE_CASE`, `error-codes.md`), 출력 포맷 규약(node-output §3.2 `output.error` 표준 형태, API 규약 §5.3 envelope), 문서 구조 규약(Overview/본문/Rationale, `##`/`###` 계층, Rationale ID 프리픽스 관행), API 문서 규약(swagger.md JSDoc/`@ApiPropertyOptional`, `additionalProperties: true` 열린 map 사용 조건) 다섯 관점을 모두 대조했으나 CRITICAL/WARNING 급 직접 위반은 발견되지 않았다. `nodeName`→`nodeLabel` 정정은 실측(엔진 emit 전수)에 근거한 문서-대-구현 정합화이고, 신규 마스킹 마커 상수(`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`)는 기존 리터럴을 중앙화한 리팩터라 오히려 명명 일관성을 높였다. 발견된 3건은 모두 INFO 등급으로, ①`redact-stored-error.ts` 파일명이 이제 error 외 컬럼까지 커버하는 스코프 드리프트(강제 규약 없음), ②두 DTO 파일의 JSDoc vs 데코레이터-description 스타일 차이(이번 PR 이전부터의 기존 편차를 각자 스타일 그대로 확장한 것), ③마스킹 정책이 정식 컨벤션 파일이 아니라 도메인 spec(EIA §R17)에 SoT 를 두는 설계 선택(기존 위임 패턴과 동형이라 규약 위반 아님) — 이다.

## 위험도
LOW
