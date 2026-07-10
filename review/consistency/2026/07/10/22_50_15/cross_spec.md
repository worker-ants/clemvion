# Cross-Spec 일관성 검토 — EIA `ExecutionStatusDto.context` closed union (impl-prep)

## 검토 대상

- `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` — `context` 를 `Record<string,unknown>|null` (open) 에서 `ButtonsContextDto | NodeOutputContextDto` closed `oneOf` (no discriminator) 로 교체. `currentNode`/`result`/`error` 는 `nullable:true`, `conversationThread` 는 key-omitted. JSDoc(:57-58) 정정.
- `codebase/channel-web-chat/src/lib/eia-types.ts:131` — `currentNode?: string|null` → `{ id, type, interactionType } | null`.
- 런타임/wire 변경 없음 (type + OpenAPI 스키마 표현만).
- 근거 spec: `spec/conventions/swagger.md` §1-4 + Rationale, `spec/5-system/2-api-convention.md` §5.4, `spec/5-system/14-external-interaction-api.md` §5.3 (commit a02db4f9a, 이미 반영됨).

## 발견사항

이번 구현 계획은 이미 커밋된 `spec/5-system/14-external-interaction-api.md` §5.3 본문(`context` 는 판별자 없는 닫힌 2-variant union, `discriminator` 생략 근거, `conversationThread` key-omission 근거)과 `spec/conventions/swagger.md` §1-4 / Rationale(닫힌 union 예시 코드가 `ButtonsContextDto`/`NodeOutputContextDto` 이름까지 동일하게 명시, `ConversationThreadDto` 미생성 근거)을 **문자 그대로 코드화**하는 작업이다. 다른 spec 영역과의 충돌은 발견되지 않았다.

- **[INFO]** `currentNode` 필드의 Swagger 메타데이터는 이번 변경 범위 밖이지만 동일 컨벤션과 살짝 어긋난 채 남는다
  - target 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:85-94` (`currentNode`)
  - 충돌 대상: `spec/conventions/swagger.md` §1-2("nested object: `@ApiProperty({ type: () => NestedDto })`") / §1-4("열린 map 은 실제로 키가 열려 있는 경우에 한한다")
  - 상세: `currentNode` 의 TS 타입은 이미 `{ id: string; type: string; interactionType: 'form'|'buttons'|'ai_conversation'|null }` 로 **닫힌 shape** 인데, `@ApiPropertyOptional` 데코레이터는 `type: 'object', additionalProperties: true` (열린 map) 로 선언되어 있다. `context` 필드와 정확히 같은 종류의 TS-vs-Swagger drift(§1-4 Rationale 이 실증 사례로 든 것과 동형 패턴)이나, 이번 File 1 변경 지시 범위는 `context` 로 명시적으로 한정되어 있어 `currentNode` 는 그대로 남는다. 기능·wire 에는 영향 없음(순수 문서화 메타데이터 drift).
  - 제안: 차단 사유 아님. 이번 PR 로 손대지 않아도 되나, `currentNode` 도 같은 파일 안에서 손대는 김에 `type: () => CurrentNodeDto` 또는 최소 nested object 표기로 함께 정리하면 §1-4 Rationale 이 지적한 drift 패턴의 재발을 파일 전체 단위로 막을 수 있다. 후속 커밋으로 미뤄도 무방.

## 요약

target 구현은 신규 요구사항이 아니라 직전 커밋(a02db4f9a)으로 이미 확정된 `spec/5-system/14-external-interaction-api.md` §5.3, `spec/conventions/swagger.md` §1-4/Rationale, `spec/5-system/2-api-convention.md` §5.4 의 문서화된 결정을 타입/OpenAPI 스키마로 코드화하는 작업이다. `ButtonsContextDto`/`NodeOutputContextDto` 클래스명·필드 구성(`interactionType`/`waitingNodeId`/`conversationThread?`/`buttonConfig{buttons,nodeOutput}` 또는 `nodeOutput`)은 swagger.md 예시 코드와 정확히 일치하고, discriminator 생략 근거(§interactionType=buttons 가 fallthrough 로 두 variant 모두에 나타남, `interaction.service.ts:309-322` 의 `bc` 존재 여부 분기와 일치)도 이미 spec 에 기술된 그대로다. `conversationThread` 를 key-omitted(`|null` 금지)로, `ConversationThreadDto` 를 만들지 않고 envelope 만 스키마화하는 결정도 conversation-thread.md §1.3 을 SoT 로 유지하려는 기존 Rationale 과 정합한다. WS §4.4.5 wire, data-flow/15, chat-channel spec 어디에도 이 DTO 표현과 모순되는 별도 정의는 없다. File 2 의 프런트 타입 정정도 실제 wire(백엔드 `currentNode` 구조)와 일치하며 현재 미소비 필드라 회귀 위험이 없다. 유일한 관찰 사항은 범위 밖의 기존 `currentNode` Swagger 메타데이터 drift(INFO, 비차단)뿐이다.

## 위험도

NONE
