# Rationale 연속성 검토 — `eia-execution-context-schema` (--impl-prep)

대상: 구현 예정 변경 2건
- `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` — `ExecutionStatusDto.context` → 닫힌 2-variant `oneOf`(`ButtonsContextDto` | `NodeOutputContextDto`), discriminator 없음, envelope-only.
- `codebase/channel-web-chat/src/lib/eia-types.ts` — `ExecutionStatus.currentNode` 타입 `string | null` → object.

Governing Rationale (커밋 `a02db4f9a`):
- `spec/conventions/swagger.md` §1-4 + 3개 신규 Rationale 항목(닫힌 union 분리 / discriminator soundness / envelope-only)
- `spec/5-system/2-api-convention.md` §5.4 + 신규 Rationale "왜 `conversationThread` 를 `null` 로 정규화하지 않는가"
- `spec/5-system/14-external-interaction-api.md` §R17 (+ §5.3 예시 정정)

## 발견사항

검토 결과, 계획된 구현이 방금 커밋된 Rationale 을 위반하거나 기각된 대안을 재도입하는 지점은 발견되지 않았다. 오히려 계획은 Rationale 본문이 직접 제시한 코드 예시(`ButtonsContextDto`/`NodeOutputContextDto` 네이밍, discriminator 생략, envelope-only)를 그대로 따르고 있다. CRITICAL/WARNING 없음. 아래는 구현 시점에 놓치기 쉬운 지점에 대한 INFO 확인사항이다.

- **[INFO]** `conversationThread` 필드의 TS 선언에서 `| null` 을 쓰지 않아야 함 (api-convention §5.4 DTO 체크리스트)
  - target 위치: `responses.dto.ts` 내 신설 `ButtonsContextDto`/`NodeOutputContextDto`(또는 공유 envelope base)의 `conversationThread` 필드 선언부 (아직 미작성)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 — "DTO 선언이 wire 를 반영해야 한다 — **키를 생략하는 필드는 `@ApiPropertyOptional` + `field?: T` (`| null` 금지)**, `null` 을 쓰는 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null`."
  - 상세: 지시문의 "conversationThread stays key-omitted; siblings stay null" 은 방향성은 맞으나, 실제 클래스 필드를 `conversationThread?: Record<string, unknown> | null` 로 선언하면 (a) wire 상 값이 없을 때 키 자체가 생략되는 실제 동작과 타입 선언이 어긋나고 (b) 방금 커밋된 §5.4 체크리스트를 문면 그대로 위반하게 된다. `currentNode`/`result`/`error` (siblings, `null` 채택)와 달리 `conversationThread` 는 `field?: T` (union 에 `| null` 미포함)로 선언해야 한다.
  - 제안: DTO 작성 시 `conversationThread?: Record<string, unknown>;` (`@ApiPropertyOptional()`, `nullable: true` 미지정)로 선언하고, `currentNode`/`result`/`error` 와 달리 `| null` 을 넣지 않았음을 인라인 주석 또는 JSDoc 으로 §5.4 cross-ref 와 함께 남길 것.

- **[INFO]** 백엔드 `currentNode` 필드는 이번 변경 범위에서 제외되어 여전히 `additionalProperties: true` 로 남음
  - target 위치: `responses.dto.ts` `ExecutionStatusDto.currentNode` (변경 계획에 미포함)
  - 과거 결정 출처: `spec/conventions/swagger.md` §Rationale "§1-4 닫힌 union 을 `additionalProperties` 로 뭉개지 않는다" — 이 항목이 `currentNode` 를 "실증 사례"(위젯 `eia-types.ts` 오선언)로 인용
  - 상세: Rationale 은 `currentNode` 를 **frontend 타입 오선언의 증거**로만 인용했고, 이번 커밋이 강제하는 스키마화 대상은 `context`(닫힌 union) 한정이다 — `currentNode` 는 union 이 아니라 단일 고정 shape(`{id,type,interactionType}`)이므로 §1-4 의 "닫힌 union" 규칙이 직접 적용되진 않는다. 따라서 계획대로 `context` 만 손대는 것은 Rationale 위반이 아니다. 다만 §1-4 일반 원칙("nested object: `@ApiProperty({ type: () => NestedDto })`")의 관점에서는 `currentNode` 도 `additionalProperties:true` 대신 구조화 DTO 로 선언하는 편이 일관적이며, 이는 이번 변경이 남긴 자연스러운 후속 후보다.
  - 제안: 이번 PR 범위에서 강제되지는 않으나, PR 설명 또는 후속 plan 에 "currentNode 도 구조화 DTO 후보" 로 한 줄 남겨 두면 향후 동일 드리프트(스키마 미노출) 재발을 막는 데 도움이 된다. 차단 사유는 아님.

- **[INFO]** `eia-types.ts` 의 `ExecutionStatus.context` 는 이번 계획에서 미변경 (`Record<string, unknown> | null` 유지)
  - target 위치: `codebase/channel-web-chat/src/lib/eia-types.ts` `ExecutionStatus.context`
  - 과거 결정 출처: (직접 위반 아님) `spec/conventions/swagger.md` 신규 union 스키마화 원칙과의 정합성 관찰
  - 상세: 지시문은 `eia-types.ts` 변경을 `currentNode` 타입 정정 한 건으로 명시했다. 이는 governing Rationale 이 명시한 실증 버그(§Rationale "§1-4 닫힌 union...")를 그대로 고치는 것이라 Rationale 과 충돌하지 않는다. 다만 backend 가 `context` 를 닫힌 2-variant 로 스키마화하는 동안 widget 쪽 `context` 타입은 여전히 열린 `Record<string, unknown>` 로 남아, 백엔드/프론트 타입 정밀도가 비대칭이 된다. Rationale 은 프론트 타입까지 이번 커밋 범위로 강제하지 않으므로 이는 차단 사유가 아니라 향후 스코프 참고사항이다.
  - 제안: 필요 시 별도 후속으로 `ExecutionStatus.context` 도 `ButtonsContext | NodeOutputContext | undefined` 형태로 좁힐 수 있음 — 이번 impl-prep 의 필수 조건은 아니다.

## 점검 관점별 요약

1. **기각된 대안의 재도입** — 없음. discriminator 추가(swagger.md Rationale "discriminator 는 판별자가 sound 할 때만" 이 명시 기각), `conversationThread` null 정규화(api-convention §5.4 Rationale 이 명시 기각), `ConversationThreadDto` 신설(swagger.md Rationale "같은 이유로 ConversationThreadDto 도 만들지 않는다" 가 명시 기각) 세 가지 모두 계획에 들어있지 않음을 확인.
2. **합의된 원칙 위반** — 없음. "봉투만 스키마화, 내부(`nodeOutput`/`buttonConfig.buttons`)는 열어 둔다"는 원칙을 그대로 따름. §5.4 의 "기본은 `null`, 키 생략은 (a)/(b) 사유가 있을 때만 + 문서화 절에 사유 명시" 원칙도 R17 본문에 이미 사유가 기재되어 있어 정합.
3. **결정의 무근거 번복** — 해당 없음. 이번 구현은 번복이 아니라 방금 확정된 Rationale 의 최초 코드화(implementation)다.
4. **암묵적 가정 충돌** — 없음. "Runtime wire UNCHANGED" 는 R17/§5.4 가 전제하는 "SSE `waiting_for_input` 과 REST `getStatus.context` 의 wire parity" 불변식을 그대로 보존한다.

## 요약

계획된 구현(`responses.dto.ts` 의 discriminator 없는 닫힌 2-variant `oneOf` + envelope-only 스키마화, `eia-types.ts` 의 `currentNode` 타입 정정)은 방금 커밋된 세 Rationale 위치(swagger.md §1-4 3개 항목, api-convention.md §5.4, EIA §R17)와 대립하는 지점이 없으며, 오히려 Rationale 본문이 제시한 코드 예시·네이밍을 그대로 따르는 정합적 구현이다. discriminator 미채택·`conversationThread` null 미정규화·`ConversationThreadDto` 미신설·wire 불변 네 가지 확인 항목 모두 계획과 일치한다. 다만 (1) `conversationThread` DTO 필드 선언 시 `| null` 을 넣지 않아야 한다는 §5.4 세부 체크리스트는 2줄 요약만으로는 보장되지 않으므로 실제 코드 작성 시 주의가 필요하고, (2) `currentNode` backend 스키마 및 `eia-types.ts` 의 `context` 타입은 이번 범위 밖으로 남아 있으나 이는 Rationale 이 강제하는 범위가 아니다.

## 위험도

NONE
STATUS: SUCCESS