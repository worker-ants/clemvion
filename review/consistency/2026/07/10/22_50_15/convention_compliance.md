# 정식 규약 준수 검토 — EIA `getStatus.context` 스키마화 (`--impl-prep`)

> 검토 대상: 아직 작성되지 않은 구현 계획 (File 1: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts`, File 2: `codebase/channel-web-chat/src/lib/eia-types.ts:131`)
> 대조한 정식 규약: `spec/conventions/swagger.md`(§1-4/§5-1/§Rationale, commit `a02db4f9a` 로 방금 개정), `spec/5-system/2-api-convention.md` §5.4, `spec/conventions/execution-context.md`(명명 가드 SoT)
> 참고: `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` (동일 작업의 spec-only 선행 draft)

## 발견사항

- **[WARNING]** 응답 DTO 파일 위치가 §5-1 패턴을 따르지 않음 (기존 상태, 이번 변경이 그 파일에 신규 클래스 2개를 추가하며 편차를 확대)
  - target 위치: File 1 — `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` (단일 flat 파일)
  - 위반 규약: `spec/conventions/swagger.md` §5-1 "응답 DTO 위치" — `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`
  - 상세: 코드베이스 실사 결과 `dto/responses/` 서브디렉토리 + `*-response.dto.ts` 패턴을 따르는 모듈이 25개(folders/edges/notifications/hooks/workflow-versions/model-config/knowledge-base/alerts/schedules/workspaces/dashboard/integrations/workflows/... 등)인 반면, `external-interaction` 모듈만 유일하게 `dto/responses.dto.ts` flat 파일을 쓴다. 이번 계획은 이 기존 flat 파일 안에 `ButtonsContextDto`/`NodeOutputContextDto` 신규 클래스 2개를 추가하는 것으로, §5-1 이 규정하는 위치·명명 패턴을 신규 코드에도 그대로 답습하게 된다.
  - 제안: 이번 좁은 스코프(스키마 안전성 수정)에서 파일 이동까지 요구하는 것은 과잉이므로 **차단 사유는 아님** — `interaction.controller.ts` 등 여러 곳에서 import 하는 기존 파일을 이번 커밋에서 옮기면 diff 가 불필요하게 커진다. 다만 별도 후속 항목으로 `dto/responses/` 서브디렉토리 이관(예: `execution-status-response.dto.ts`, `interact-ack-response.dto.ts` 등으로 분리)을 기록해 두는 것을 권한다. 최소한 이번 PR 에서 새로 추가하는 두 클래스만이라도 향후 이관을 염두에 두고 파일 상단에 위치 부채를 알리는 주석을 남기는 것도 대안.

- **[INFO]** `context` 필드 자체의 `nullable: true` 명시 여부 확인 필요
  - target 위치: File 1 — `ExecutionStatusDto.context` 필드 재선언
  - 위반 규약: `spec/5-system/2-api-convention.md` §5.4 체크리스트 — "`null` 을 쓰는 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null`"
  - 상세: `context` 는 `waiting_for_input` 이 아닌 상태에서 `null` (spec §5.3 JSON 예시 `"context": { ... } | null`)이므로 `oneOf` 데코레이터에도 `nullable: true` 를 함께 선언해야 wire 를 정확히 반영한다. 과업 설명(File 1 bullet)은 `@ApiExtraModels` + `oneOf: [getSchemaPath(...)]` 만 명시하고 `nullable` 언급이 없어 누락 가능성이 있다 — 다만 swagger.md §1-4 의 예시 코드(개정판 본문에 있는 바로 그 `ExecutionStatusDto.context` 스니펫)는 `nullable: true` 를 포함하고 있으므로, 그 예시를 그대로 따른다면 문제 없다.
  - 제안: 구현 시 `@ApiPropertyOptional({ oneOf: [...], nullable: true })` 형태로 `nullable: true` 를 반드시 포함할 것 (swagger.md §1-4 예시와 동일).

- **[INFO]** 신규 DTO 필드의 한국어 JSDoc 커버리지는 구현 시점에 재확인 필요
  - target 위치: File 1 — `ButtonsContextDto`/`NodeOutputContextDto` 각 필드 (`interactionType`, `waitingNodeId`, `conversationThread?`, `buttonConfig`/`nodeOutput`)
  - 위반 규약: `spec/conventions/swagger.md` §1-1 "모든 필드에 JSDoc 추가 (한국어)"
  - 상세: 코드가 아직 작성되지 않아 실제 준수 여부는 검증 불가. 참고로 같은 파일의 기존 `InteractAckDto.executionId`(`@ApiProperty({ format: 'uuid' })` 만 있고 JSDoc·description 모두 없음)처럼 이 파일에 JSDoc 누락 전례가 있어, 신규 클래스에서 반복되지 않도록 각별한 주의가 필요.
  - 제안: 구현 완료 후 `/ai-review` 단계에서 §1-1 체크리스트로 재확인.

## 준수 확인 (문제 없음, 근거 기록)

- **닫힌 union 표현 패턴**: `ButtonsContextDto`/`NodeOutputContextDto` + `@ApiExtraModels` + `oneOf: [getSchemaPath(...)]`, `discriminator` 미사용 — 이는 `swagger.md` §1-4 가 방금 신설한 "닫힌 union" 절의 예시 코드와 **문자 그대로 일치**(클래스명까지 동일)한다. `discriminator` 를 생략하는 이유(§Rationale "discriminator 는 판별자가 sound 할 때만")도 `interactionType='buttons'` 가 `buttonConfig`/`nodeOutput` 양쪽에 나타나는 EIA 고유 사례와 정확히 부합한다.
- **명명 가드 (`ExecutionContext*` 접두 금지)**: `ButtonsContextDto`/`NodeOutputContextDto` 어느 쪽도 `ExecutionContext` 접두를 쓰지 않아 `node-handler.interface.ts` 의 엔진 런타임 `ExecutionContext`(SoT: `spec/conventions/execution-context.md`)와 충돌하지 않는다. `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` 체크리스트의 "⚠️ 명명 가드" 항목도 이 접두 금지만 요구하며, 계획된 이름은 이를 만족한다.
- **봉투만 스키마화, 내부는 열어 둠**: `buttonConfig`(2-key envelope: `buttons`+`nodeOutput`)/`nodeOutput` 내부 payload 는 스키마 고정 없이 열어 두는 설계 — `swagger.md` §1-4 "왜 EIA `context` 는 봉투만 스키마화하고 내부는 열어 두는가" Rationale 및 `node-output.md` 와의 SoT 이중화 회피 원칙과 일치.
- **`ConversationThreadDto` 미생성**: `conversation-thread.md` §1.3 이 이미 thread shape 의 SoT 이므로 재선언하지 않는다는 계획은 해당 Rationale 과 정확히 일치. 앵커(`#1-3-conversationthread`)도 실제 문서에 존재함을 확인했다.
- **부재 표현 규칙 (`null` vs 키 생략)**: `conversationThread?` 를 `@ApiPropertyOptional` + `field?: T`(`| null` 없이) 로, 나머지 형제 필드(`currentNode`/`result`/`error`)는 `null` 관례를 유지한다는 설계는 `api-convention.md` §5.4 체크리스트와 정확히 일치하며, 이는 EIA §5.3/§R17 이 요구하는 SSE `waiting_for_input` wire parity((a) 기준)의 원형 사례로 이미 본문·Rationale 에 문서화돼 있다.
- **File 2 (`eia-types.ts:131`)**: `currentNode?: string | null` → 객체 타입 정정 계획은 backend `ExecutionStatusDto.currentNode`(`{id,type,interactionType}|null`) 및 spec §5.3 JSON 예시와 일치하는 wire 정직화로, 출력 포맷 규약 위반 소지가 없다. (channel-web-chat 은 NestJS Swagger 데코레이터 대상이 아니므로 §1-x 데코레이터 규칙 자체는 비적용이나, "DTO 선언이 wire 를 반영해야 한다"는 §5.4 원칙의 취지와 부합.)
- **§1-1 새 JSDoc (:57-58 정정)**: 현재 클래스 JSDoc "클라이언트는 `currentNode.interactionType` 으로 분기" 는 unsound discriminator 를 암시하는 stale 문구이며, EIA §5.3 이 이미 "판별자 없는 닫힌 2-variant union... 키 존재로 분기"로 명문화한 것과 어긋난다 — 이를 고친다는 계획은 규약과의 정합화로 타당하다.

## 요약

계획된 구현은 `spec/conventions/swagger.md` §1-4 가 이번에 신설한 "닫힌 union" 패턴(변형별 DTO + `@ApiExtraModels`/`oneOf`/`getSchemaPath`, `discriminator` 의도적 생략)과 `spec/5-system/2-api-convention.md` §5.4 부재 표현 규칙(`conversationThread` 키 생략 vs 형제 필드 `null`)을 사실상 규약 원문 예시와 동일한 형태로 따르고 있으며, `ExecutionContext*` 명명 충돌 가드도 만족한다. 유일한 구조적 편차는 §5-1 "응답 DTO 위치" 패턴(`dto/responses/*-response.dto.ts`)을 `external-interaction` 모듈이 애초부터 따르지 않고 있다는 점으로, 이번 변경이 그 flat 파일에 신규 클래스를 추가함으로써 편차를 그대로 이어받는다 — 그러나 이는 이번 좁은 스코프의 원인이 아닌 기존 부채이며 즉시 차단할 사안은 아니다. 나머지는 아직 작성되지 않은 코드에 대한 체크리스트성 확인 사항(JSDoc 전 필드 커버리지, `context` 필드의 `nullable: true` 명시)이다.

## 위험도

LOW
STATUS: SUCCESS
