# Consistency Check SUMMARY — impl-prep: EIA `getStatus.context` 스키마화

- 모드: `--impl-prep` (scope `spec/5-system/14-external-interaction-api.md`)
- checker: cross_spec · rationale_continuity · convention_compliance · plan_coherence · naming_collision (5/5 SUCCESS)
- 세션: `review/consistency/2026/07/10/22_50_15/`
- 선행 spec 커밋: `a02db4f9a`

## BLOCK: NO

Critical 0 · Warning 1 · Info 8. 위험도: NONE ×3, LOW ×2.

계획된 구현은 `a02db4f9a` 가 확정한 결정의 **최초 코드화**이며, Rationale 이 명시 기각한 4개 대안(discriminator 추가 · `conversationThread` null 정규화 · `ConversationThreadDto` 신설 · wire 변경) 중 어느 것도 재도입하지 않음을 rationale_continuity 가 항목별 확인.

## Warning

### W1. `external-interaction` 모듈만 §5-1 응답 DTO 위치 패턴 미준수 (기존 부채)
**검출: convention_compliance**

swagger.md §5-1 은 `dto/responses/*-response.dto.ts` 를 규정하고 25개 모듈이 이를 따르나, `external-interaction` 만 flat `dto/responses.dto.ts` 다. 이번 변경이 그 flat 파일에 신규 클래스를 추가해 편차를 이어받는다.

→ **판정**: 차단 아님. 파일 이관은 본 PR 범위(스키마 안전성) 대비 과잉이며 import 표면을 넓게 건드린다. **후속 항목으로 기록**하고 이번엔 flat 파일 유지.

## 구현 시 반영 (Info → 반영 의무화)

- **I1** `context` 의 `oneOf` 데코레이터에 **`nullable: true` 명시** — 비-waiting 시 `null` 이므로 wire 반영 필수 (api-convention §5.4). *(convention_compliance)*
- **I2** `conversationThread` 는 **`| null` 금지** — `@ApiPropertyOptional()` + `field?: T` (nullable 미지정). 키 생략 필드이므로 §5.4 체크리스트 문면 그대로. 형제 `currentNode`/`result`/`error` 만 `nullable: true` + `?: T | null`. *(rationale_continuity)*
- **I3** 전 필드 한국어 JSDoc (§1-1). 같은 파일 `InteractAckDto.executionId` 에 누락 전례 있음. *(convention_compliance)*
- **I4** **`currentNode` 도 구조화 DTO 로** — TS 타입은 이미 닫힌 shape 인데 Swagger 는 `type:'object', additionalProperties:true` 다. §1-4 Rationale 이 **바로 이 필드를 드리프트 실증 사례로 인용**하고 있으므로, 그 사례를 고치지 않은 채 남기는 것은 부정합. `CurrentNodeDto` 신설 + `type: () => CurrentNodeDto`. **cross_spec·rationale_continuity 2인 독립 제안.** *(범위 확대이나 본 PR 의 명시 목적 "Swagger 에 sub-shape 노출" 과 동일 선상)*

## 후속 (본 PR 밖)

- `external-interaction` 모듈 `dto/responses/` 서브디렉토리 이관 (W1).
- 위젯 `eia-types.ts` `ExecutionStatus.context` 를 `ButtonsContext | NodeOutputContext` 로 좁히기 (현재 `Record<string,unknown>|null` 유지 — backend 만 정밀화돼 타입 비대칭). *(rationale_continuity I3)*

## 충돌 없음 확인

- **명명**: `ButtonsContextDto`/`NodeOutputContextDto` 는 `codebase/` 전체 grep 0건. `ExecutionContext*` 접두 회피는 엔진 런타임 `ExecutionContext`(100+ 파일 참조, SoT `execution-context.md`)와의 혼동을 사전 차단 — 올바른 선택으로 확인. 근접명 `ButtonConfig`(button.types.ts)와는 단복수·Config/Context·Dto 접미사로 구분됨.
- **`ExternalInteractionType`**: `eia-types.ts:26` 에 이미 export — `currentNode` 타입 정정 시 추가 import 불요.
- **plan 소유권**: `responses.dto.ts`/`eia-types.ts`/`ExecutionStatusDto` 를 주장하는 다른 in-progress plan 0건. `spec-sync-external-interaction-api-gaps.md` 는 축-분리 문구로 이미 조율됨.
- **`node-output-redesign/`**: EIA 응답 DTO 를 다루지 않음. `nodeOutput` 을 open map 으로 남기는 결정이 오히려 그 노드별 churn 을 의도적으로 흡수 — 정합.
- **cross-spec**: WS §4.4.5 waiting_for_input wire · conversation-thread · node-output · data-flow/15 어디에도 본 DTO 표현과 모순되는 정의 없음.
- **미해소 선행 plan**: 없음.
