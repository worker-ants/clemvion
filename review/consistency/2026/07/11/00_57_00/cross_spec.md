# Cross-Spec 일관성 검토 — EIA `getStatus.context` 스키마화 (rebase-onto-#903 재검토)

## 검토 범위 확정

`git diff origin/main...HEAD --stat` 로 실제 diff 를 직접 확인. payload 에 나열된 `review/**` 산출물·`meta.json`·`_retry_state.json` 등은 이번 브랜치의 review 세션 잔재(harness 표준 mis-scoping)이며 spec 충돌 분석 대상이 아니므로 제외. 실질 spec-linked diff 는:

- `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` (+ `.spec.ts`, e2e)
- `codebase/channel-web-chat/src/lib/eia-types.ts`
- `spec/5-system/14-external-interaction-api.md` §5.3
- `spec/5-system/2-api-convention.md` §5.4 (신설)
- `spec/conventions/swagger.md` §1-4 + Rationale

`git log origin/main...HEAD` 확인 결과, rebase 로 `49c2185d1`(PR #903, `getStatus()` 2단계 컬럼 projection)이 base 에 편입되어 있고, 이 브랜치의 커밋(`c44673cfd`~`14b21d51a`)은 그 위에 재배치됐을 뿐 자체 내용은 rebase 전과 동일. `interaction.service.ts` 를 직접 Read 하여 **머지된 최종 상태**(threadRow 2단계 조회 + context 조립 로직 공존)를 확인했다.

## 발견사항

검토 관점 (a)~(d) 전항목 실증 결과, **충돌 없음**.

- **[INFO]** #903 rebase 이후에도 `getStatus()` 실제 출력이 EIA §5.3 예시 JSON과 일치함을 코드로 직접 확인
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.3 응답 JSON 예시 (`currentNode`/`context`/`result`/`error`/`seq`/`updatedAt`)
  - 대조 대상: 머지된 `interaction.service.ts:265-397` `getStatus()`
  - 상세: #903 의 `STATUS_PROJECTION_COLUMNS`(1단계: `id/status/workflowId/startedAt/finishedAt/outputData`)는 `conversationThread` 를 의도적으로 제외하고, `waiting_for_input` 분기에서만 `threadRow`(2단계, `select:['id','conversationThread']`)를 `Promise.all` 로 nodeExecution 조회와 병렬 조회한다. 조립되는 `context` 객체(`interactionType`/`waitingNodeId`/조건부 `conversationThread`/`buttonConfig` 또는 `nodeOutput`)와 `currentNode`(`id`/`type`/`interactionType`)·`result`/`error`(`deepRedactSecrets` 마스킹 후 `null`)·`seq`(`SSE_SEQ_PLACEHOLDER=0`)·`updatedAt`(`finishedAt ?? startedAt ?? new Date()`)는 spec §5.3 예시와 필드명·nullable 여부·조건 모두 1:1 일치. 2단계 조회의 `conversationThread` 는 `redactThreadForPublic` 를 그대로 통과시켜 §R17 마스킹 불변식도 유지됨. 이는 순수 내부 조회 최적화이며 wire 계약을 바꾸지 않는다는 #903 커밋 메시지의 주장이 코드로 실증됨.
  - 제안: 조치 불요 (정보성 확인).

- **[INFO]** DTO ↔ swagger.md §1-4 oneOf 패턴 일치
  - target 위치: `responses.dto.ts` `ExecutionStatusDto.context` (`@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto, CurrentNodeDto)` + `oneOf: [{$ref: ButtonsContextDto}, {$ref: NodeOutputContextDto}]`, discriminator 미선언)
  - 대조 대상: `spec/conventions/swagger.md` §1-4 신설 절 + "discriminator 는 판별자가 sound 할 때만" Rationale
  - 상세: swagger.md 가 규정하는 "닫힌 union — variant DTO + `@ApiExtraModels` + `oneOf`/`getSchemaPath`, discriminator 는 판별자가 sound 할 때만" 패턴을 코드가 정확히 구현. `interactionType` 이 `buttons` variant 양쪽(`ButtonsContextDto`/`NodeOutputContextDto` fallthrough)에 나타나 discriminator 로 쓸 수 없다는 spec 의 반례 서술이 `interaction.service.ts` 의 실제 분기 로직(`interactionType === 'buttons' && bc` 조건부 분기, `bc` 없으면 nodeOutput 으로 fallthrough)과 정확히 일치. `responses.dto.spec.ts` 가 OpenAPI 문서를 실제 생성해 `discriminator` 부재·`oneOf` 배열·`ApiExtraModels` 등재 여부를 회귀 가드로 고정.
  - 제안: 조치 불요.

- **[INFO]** DTO ↔ api-convention §5.4 null-vs-키-생략 규칙 일치
  - target 위치: `WaitingContextBaseDto.conversationThread`(`@ApiPropertyOptional`, `field?: T` — `| null` 없음) vs `ExecutionStatusDto.result`/`error`/`currentNode`(`@ApiPropertyOptional({nullable: true})`, `field?: T | null`)
  - 대조 대상: `spec/5-system/2-api-convention.md` §5.4 "DTO 선언이 wire 를 반영해야 한다" 규칙 및 그 Rationale("왜 conversationThread 를 null 로 정규화하지 않는가")
  - 상세: §5.4 는 "키 생략 필드는 `@ApiPropertyOptional` + `field?: T`(`| null` 금지), `null` 필드는 `nullable: true` + `field?: T | null`" 을 명문화. `conversationThread`(키 생략, SSE wire parity 근거 (a))와 `result`/`error`/`currentNode`(null, 기본값)의 DTO 선언이 이 규칙을 정확히 따름. `responses.dto.spec.ts` 의 "부재 표현 — null vs 키 생략" describe 블록이 이를 OpenAPI 스키마 레벨(`required` 배열·`nullable` 플래그)에서 재확인.
  - 제안: 조치 불요.

- **[INFO]** #903 의 2단계 조회 분리가 §5.3/§R17 wire 계약에 어떤 영향도 주지 않음을 확인
  - target 위치: `interaction.service.ts` `getStatus()` JSDoc "조회는 2단계" 절 + `STATUS_PROJECTION_COLUMNS` 상수
  - 대조 대상: EIA §5.3 응답 계약, §R17 (`redactThreadForPublic` 공유 helper 불변식)
  - 상세: 1단계에서 `conversationThread` 를 제외하고 `waiting_for_input` 상태에서만 2단계로 재조회하는 것은 **컬럼 fetch 시점**의 최적화이며, 응답 조립 로직(`if (execution.status === WAITING_FOR_INPUT) {...}`)의 조건·결과 shape 는 이 브랜치의 스키마화 변경(oneOf DTO 도입) 이전과 동일하게 유지된다. `execution.service.ts` 주석에 "왕복 depth 는 2 로 그대로(늘어난 쿼리는 PK 단건 조회)", "1단계와의 간극에 상태가 바뀌어도 응답은 스냅샷이라 무해"라고 명시되어 있고, 이 경합 처리가 §5.3 의 계약(단발 스냅샷 조회)과 모순되지 않음. 신규 e2e `I-2. getStatus wire — buttons 노드는 buttonConfig variant, thread 부재 시 키 생략` 이 실 DB round-trip 으로 2단계 조회 이후에도 wire 가 spec 대로 나오는지 검증. #903 자체의 커밋 메시지에도 "wire 형식 무변경 — spec §5.3/§R17 응답 계약 그대로인 내부 조회 최적화"로 명시되어 있고, #903 별도 `--impl-done` 라운드(3회, `review/consistency/2026/07/10/{22_25_21,23_20_43,23_41_06}`)에서 이미 독립 검증됨.
  - 제안: 조치 불요.

- **[INFO — 참고, 비차단]** 클라이언트 SDK/위젯 타입이 여전히 backend 의 닫힌 union 과 비대칭 (이미 추적 중)
  - target 위치: `codebase/channel-web-chat/src/lib/eia-types.ts` `ExecutionStatus.context` (`Record<string, unknown> | null` 그대로, `currentNode` 만 이번 diff 로 typed 됨)
  - 충돌 대상: `codebase/packages/sdk/src/client.ts:124` `context?: Record<string, unknown> | null;` — 둘 다 backend DTO 의 신규 `ButtonsContextDto | NodeOutputContextDto` 정밀화를 반영하지 않음
  - 상세: 이는 spec-vs-spec 충돌이 아니라 코드-vs-DTO 비대칭이며, `plan/in-progress/eia-context-schema-followups.md` 에 "EIA client 타입의 context 정밀화 (2곳)" 항목으로 이미 명시 추적 중(위젯 + SDK 둘 다 명시, `--impl-done` I1 이 SDK 쪽을 추가 검출했다고 기록). 신규 발견 아님 — 정보성 재확인.
  - 제안: 조치 불요 (별도 plan 이 이미 커버).

## 요약

Rebase 로 편입된 PR #903(`getStatus()` 2단계 컬럼 projection)과 본 브랜치의 EIA `context` 닫힌-union 스키마화 변경(`responses.dto.ts`/`interaction.service.ts`/`eia-types.ts`)을 머지 후 최종 상태로 직접 대조한 결과, (a) EIA §5.3 예시 JSON, (b) swagger.md §1-4 oneOf 패턴, (c) api-convention §5.4 null-vs-키-생략 규칙, (d) #903 의 조회 최적화 어느 것도 서로 모순되지 않는다. #903 의 2단계 projection 은 순수 내부 조회 레이어 변경이고 응답 조립 로직·조건 분기는 그대로이므로 wire 계약이 보존되며, 이는 코드 주석·신규 e2e(I-2)·#903 자체의 3회 독립 `--impl-done` 라운드로 이미 실증됐다. 유일하게 눈에 띄는 잔여 비대칭(클라이언트 SDK/위젯 `context` 타입이 아직 미정밀화)은 spec 충돌이 아니라 이미 별도 plan 에 추적 중인 code-level 후속 항목이다. 신규 요구사항 ID·데이터 모델·RBAC·상태 전이·계층 책임 충돌은 발견되지 않았다.

## 위험도

NONE

STATUS: SUCCESS
