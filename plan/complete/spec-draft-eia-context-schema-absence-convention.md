---
worktree: eia-execution-context-schema-9bb60b
started: 2026-07-10
owner: planner
spec_impact:
  - spec/conventions/swagger.md
  - spec/5-system/2-api-convention.md
  - spec/5-system/14-external-interaction-api.md
---

# spec-draft — EIA `getStatus.context` 스키마화 + 부재 표현 규칙 명문화

> 출처: PR #874 (`conversationThread` durable 동봉) 후속 2건의 API 계약 갭.
> 관련 spec: `spec/conventions/swagger.md` · `spec/5-system/2-api-convention.md` · `spec/5-system/14-external-interaction-api.md`
> 구현 위임: 본 draft 는 spec-only. `codebase/**` 변경은 후속 `developer` 세션 (동일 PR 내 별 commit).

## 배경 — 코드 실증

`interaction.service.ts` `getStatus()` (L304-322) 가 실제로 반환하는 `context` 는 **닫힌 3-way**:

| 조건 | `context` |
| --- | --- |
| 비-`waiting_for_input` / 대기 `NodeExecution` 부재 / `interactionType` 미인식 | `null` |
| `interactionType === 'buttons'` **그리고** `buttonConfig` 존재 | `{ interactionType, waitingNodeId, conversationThread?, buttonConfig: { buttons, nodeOutput } }` |
| 그 외 truthy `interactionType` — `form`·`ai_conversation`·**`buttonConfig` 없는 `buttons`** | `{ interactionType, waitingNodeId, conversationThread?, nodeOutput }` |

⚠️ **`interactionType` 은 sound discriminator 가 아니다** — 3행이 보이듯 `buttons` 가 `bc` falsy 시 `nodeOutput` 분기로 fallthrough 한다(`if (interactionType === 'buttons' && bc)` → `else if (interactionType)`). 실제 판별자는 **어느 키가 present 인가**(`buttonConfig` vs `nodeOutput`)다.

현재 DTO(`responses.dto.ts:96-102`)는 이를 `Record<string, unknown> | null` + `additionalProperties: true` 로 뭉개 Swagger 에 sub-shape 이 전혀 노출되지 않는다.

**드리프트 실증**: `codebase/channel-web-chat/src/lib/eia-types.ts:131` 이 `currentNode?: string | null` 로 선언 — 실제 wire 는 객체 `{id,type,interactionType}`. 현재 미소비라 무해하나, 스키마 부재가 손수 작성 클라이언트 타입의 드리프트를 잡지 못한 실제 사례다.

## 갭 1 — `context` 스키마화가 현행 규약에 **막혀 있다**

`spec/conventions/swagger.md` §1-4 현행 텍스트:

> - union 또는 dynamic: `@ApiProperty({ type: 'object', additionalProperties: true })`

즉 현재 DTO 는 **규약 준수 상태**다. 스키마화하려면 §1-4 를 먼저 개정해야 한다.

한편 코드는 이미 텍스트보다 앞서 있다 — `api-wrapped.ts:141` `ApiOkWrappedOneOfResponse(dtos, { discriminator })` 가 **응답 레벨** `oneOf` + optional `discriminator` 를 제공하고 §5-2 표에도 등재돼 있다. 없는 것은 **property 레벨** 대응물이다.

### 개정안 — §1-4 를 closed-union vs open-map 으로 분리

```md
### 1-4. nested / enum / union

- enum: `@ApiProperty({ enum: MyEnum, enumName: 'MyEnum' })`
- nested object: `@ApiProperty({ type: () => NestedDto })`
- **닫힌 union (variant 집합이 코드로 확정)**: variant 별 DTO 클래스 + 클래스 데코레이터
  `@ApiExtraModels(VariantA, VariantB)` + `@ApiProperty({ oneOf: [getSchemaPath(VariantA), getSchemaPath(VariantB)] })`.
  variant 를 **한 필드 값으로 무손실 판별**할 수 있을 때만 `discriminator: { propertyName }` 을 덧붙인다.
  판별 필드가 variant 간 값을 공유하면(= 판별자가 unsound) `discriminator` 를 **생략**한다 — SDK 생성기가 잘못 narrowing 한다.
  응답 body 전체가 union 이면 property 레벨 대신 공용 헬퍼 `ApiOkWrappedOneOfResponse` (§5-2) 를 쓴다.
- **열린/동적 map (키 집합이 런타임 결정)**: `@ApiProperty({ type: 'object', additionalProperties: true })`.
  노드 타입별 자유 payload(`nodeOutput`), 사용자 정의 변수 맵 등. **"타입을 모르겠다"는 사유로 쓰지 않는다** — 닫힌 union 은 위 항목으로.
```

§5-2 **표 하단에 각주 1줄** 추가 — 표 행이 아니다. §5-2 표의 `헬퍼` 컬럼은 `common/swagger/` 가 export 하는 **호출형 함수 인벤토리**이고, property-level 패턴은 헬퍼가 아니라 데코레이터 조합이므로 행으로 넣으면 그 불변식이 깨진다.

**적용 범위 (신규 변경 한정)**: 기존 `additionalProperties: true` 필드를 일괄 소급 스키마화하지 않는다. `execution-context.md` §원칙 3 "소급 적용 대상 아님" 과 동일 취지 — 본 개정의 가치는 "앞으로의 불투명 누적 방지"다. EIA `context` 는 본 draft 가 명시 지목하는 **1건의 즉시 적용 대상**이다.

## 갭 2 — 한 응답에 부재 표현 2종 공존

`ExecutionStatusDto` 한 응답 안에서:
- `currentNode` / `result` / `error` → 부재 시 **`null`**
- `context.conversationThread` → 부재 시 **키 생략**

EIA §5.3 은 이미 이 분기를 국소적으로 명문화했다("형제 필드의 `null` 관례와 달리 키 부재"). 없는 것은 **프로젝트 전역 규칙**이다.

### 중요 — 이것은 정규화 대상이 아니다

`conversationThread` 를 `null` 로 정규화하면 SSE `execution.waiting_for_input` wire 와 어긋난다. §5.3/R17 은 REST `context` 를 **SSE wire 와 동일 형식**으로 유지해 위젯이 `parseWaitingForInput` 을 재사용하게 하는 것을 명시 계약으로 둔다. 따라서 **문서화하고, wire 는 건드리지 않는다**.

### 소비 안전성 (확인 완료 — 코드 변경 불요)

- `use-widget.ts:236` — `status.status === "waiting_for_input" && status.context` 가드로 `null` 처리.
- `conversation.ts` `threadToMessages(thread: ConversationThread | undefined)` — `if (!thread?.turns?.length) return []`. optional chaining 이 `undefined` 와 `null` 을 **양쪽 다** short-circuit.
- `eia-events.ts:51` `parseWaitingForInput` — pass-through.

런타임 결함 없음. 순수 문서·타입 갭.

### 개정안 — `api-convention.md` §5.4 "부재 표현" 신설

본 규칙은 **신규 발명이 아니라 기존 관행의 성문화**다. 선례:

| 표현 | 기존 선례 |
| --- | --- |
| `null` | §8.2 `nextCursor`("없으면 `null`"), EIA §5.3 `currentNode`/`result`/`error` |
| 키 생략 | §5.3 에러 응답 `details`("선택 필드 — 존재 시에만 동봉"), EIA §5.3 `context.conversationThread` |

```md
### 5.4 부재 표현 — `null` vs 키 생략

값이 없음을 나타내는 방식은 두 가지이며, **한 응답 안에 섞여도 무방하나 필드별 근거가 있어야 한다.**

| 표현 | 의미 | 선택 기준 |
| --- | --- | --- |
| `null` (키 present) | "이 필드는 이 응답의 계약에 **상시 존재**하며, 지금은 값이 없다" | 기본값. 소비자가 키 존재를 전제하고 값만 분기하면 되는 스칼라·객체 필드 |
| **키 생략** | "present-when-available — 값이 있을 때만 동봉한다" | (a) 같은 데이터를 싣는 **다른 표면(SSE/WS wire)과 형식을 일치**시켜야 할 때, (b) 선택적 부가 컨텍스트라 소비자가 부재를 정상 경로로 다룰 때 |

- 기본은 `null` 이다. 키 생략은 위 (a)/(b) 중 하나에 해당할 때만 쓰고, **해당 필드를 문서화하는 절에 사유를 명시**한다.
- 키를 생략하는 필드는 DTO 에서 `@ApiPropertyOptional` + `field?: T` (`| null` 금지) 로, `null` 을 쓰는 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 로 선언해 **타입이 wire 를 반영**하게 한다.
- 클라이언트는 두 표현 모두 안전하게 다뤄야 한다 — optional chaining(`a?.b`)은 `undefined`·`null` 을 함께 short-circuit 하므로 대개 단일 가드로 충분하다.
- **소급 적용 대상 아님**: 본 규칙은 **앞으로 도입·변경되는 필드**에 적용한다. 이미 문서화된 키 생략 필드(`mcpDiagnostics`, cafe24 `status`·`requiresCafe24Approval`, chat-channel `details.statusCode` 등)는 기준 (b) 를 충족하는 것으로 간주하고 사유 문구를 소급 요구하지 않는다.

> 실사례: [EIA §5.3](./14-external-interaction-api.md#53-단발-상태-조회--get-apiexternalexecutionsexecutionid) 의 `getStatus` 응답은 `currentNode`/`result`/`error` 를 `null` 로, `context.conversationThread` 를 **키 생략**으로 둔다 — 후자는 기준 (a)(SSE `waiting_for_input` wire 와 동일 형식 유지) 때문이다.
```

> **왜 소급 캐리브가 필요한가** — Gap 1 의 §1-4 개정과 동형 취지. 캐리브가 없으면 general MUST 로 읽혀 위 기존 필드들이 신설 직후 `/consistency-check`·`spec-coverage` 감사에서 오탐된다 (cross_spec W2).

## 갭 3 — EIA §5.3 예시 JSON 정정 + cross-ref

**단순 cross-ref 가 아니다.** consistency check 에서 3개 checker 가 독립 수렴한 사항 — `14-external-interaction-api.md:459-468` 의 `context` 예시가 실제 wire 와 3중으로 어긋나 있다:

```jsonc
// 현행 (부정확)
"context": {
  // 노드 종류에 따라 form/button/conversation config 중 하나만 동봉
  "formConfig":         { ... },   // ← 유령 키. 실제로는 nodeOutput 안에 중첩
  "buttonConfig":       { ... },
  "conversationConfig": { ... },   // ← 유령 키. 실제로는 nodeOutput 안에 중첩
  "conversationThread": { ... }
} | null,
"seq": 42,                          // ← 9줄 위 콜아웃 "항상 0 placeholder" 와 모순
```

(a) top-level `formConfig`/`conversationConfig` 는 **존재하지 않는 키** — 실제 wire 는 `nodeOutput.formConfig`/`nodeOutput.conversationConfig`. (b) `interactionType`/`waitingNodeId` 누락. (c) `"seq": 42` 가 L439 콜아웃·§R17 과 정면 모순.

이 예시는 §6.2 outbound notification payload 형태를 복제한 것으로 보이며, §6.2 자체 각주(L575-583)가 "SSE/REST 실제 wire 는 notification 형태와 다르다"고 이미 경고하는 바로 그 패턴이다. Gap 1 의 `oneOf` 스키마(정확)가 반영되면 **같은 문서 안에서 스키마와 예시가 서로 다른 shape 을 주장**하게 되므로 같은 PR 에서 함께 고친다.

정정 후:

```jsonc
"context": {
  "interactionType": "form" | "buttons" | "ai_conversation",
  "waitingNodeId":   "uuid",
  "conversationThread": { ... },   // 키 생략 가능 (present-when-available)
  // ↓ 아래 둘 중 정확히 하나
  "buttonConfig": { "buttons": [ ... ], "nodeOutput": { ... } },
  "nodeOutput":   { ... }
} | null,
"seq": 0,
```

cross-ref:
- EIA §5.3 의 키 생략 문단 → 새 `api-convention §5.4` 로 링크.
- EIA §R17 → 부재 표현이 SSE parity 에서 파생됨을 1문장. **반드시 `[API 규약 §5.4](./2-api-convention.md#54-부재-표현--null-vs-키-생략)` 로 파일명 qualify** — EIA 문서는 자기 자신의 §5.4(`명시적 취소 — POST .../cancel`, L473)를 이미 보유하므로 bare "§5.4" 는 같은 파일 안에서 오독된다 (naming_collision W5).

## Rationale (draft — 반영 시 아래 배정대로 각 spec 의 `## Rationale` 로 이관)

이관 시 각 항목을 **`### <제목>` 헤더로 승격**한다 — 두 대상 문서 모두 `### §N ...` 헤더 패턴을 쓰며(swagger.md `### §0 ...`/`### §5 ...`, api-convention.md `### 413 PAYLOAD_TOO_LARGE...`), 헤더가 없으면 다른 spec 이 anchor 로 인용할 수 없다.

### → `swagger.md` §Rationale 로 이관

**왜 `discriminator` 를 쓰지 않는가** — OpenAPI `discriminator.propertyName` 은 "그 필드 값 → variant" 가 **전단사**임을 SDK 생성기에 약속한다. `getStatus.context` 는 `interactionType='buttons'` 가 `buttonConfig` 변형과 `nodeOutput` 변형 **양쪽**에 나타나므로(핸들러가 `buttonConfig` 를 싣지 못한 경우 후자로 fallthrough) 이 약속이 성립하지 않는다. `discriminator` 를 선언하면 생성된 SDK 가 `buttons` 응답을 항상 `buttonConfig` 변형으로 narrowing 해 런타임 `undefined` 접근을 만든다. 따라서 `oneOf` 만 선언하고 판별은 키 존재로 남긴다. (fallthrough 자체를 없애 discriminator 를 sound 하게 만드는 대안은 wire 변경이라 §5.3/R17 의 SSE parity 계약을 건드린다 — 별건.) 이 규칙은 `api-wrapped.ts` `wrapOneOfDataSchema` 의 기존 JSDoc("호출자는 모든 DTO 가 동일 `propertyName` 필드를 보유함을 보장해야 한다")을 규약 레벨로 승격한 것이다.

**왜 봉투만 스키마화하는가** — `nodeOutput` 과 `buttonConfig.buttons` 는 노드 타입별 자유 payload(`formConfig`/`conversationConfig`/임의 키)로, 실제로 §1-4 가 말하는 **열린 map** 이다. 이를 클래스로 고정하면 노드 타입이 늘 때마다 DTO 가 따라 늘고, 공용 노드 output 규약([`./node-output.md`](./node-output.md) — `1-node-common.md` 등 여러 노드 문서가 참조하는 독립 conventions 문서)과 SoT 가 이중화된다. 봉투(`interactionType`/`waitingNodeId`/`conversationThread`/변형 키)만 닫고 내부는 열어 두는 것이 두 규약의 책임 경계와 일치한다.

**왜 `ConversationThreadDto` 를 만들지 않는가** — [`./conversation-thread.md`](./conversation-thread.md) **§1.3(자료구조)** 이 thread shape(`turns[]`/`source`/`totalChars`/`nextSeq`)의 SoT 다(§4 는 영속화 단계, §8.4 는 durable 컬럼 채택 Rationale). Swagger DTO 로 재선언하면 두 문서가 갈린다. 봉투에서는 `conversationThread` 를 open object 로 두고 description 에서 `conversation-thread.md` 를 지목한다. (`api-convention.md` §5.4 Rationale 에는 cross-ref 1줄만 남긴다.)

### → `api-convention.md` §Rationale 로 이관

**왜 `conversationThread` 를 `null` 로 정규화하지 않는가** — SSE `waiting_for_input` wire 도 present-when-available 이고, [EIA §5.3/§R17](./14-external-interaction-api.md) 이 REST `context` 를 SSE wire 와 **동일 형식**으로 유지하는 것을 명시 계약으로 둔다. 위젯의 `parseWaitingForInput` 재사용이 그 계약 위에 서 있다. `null` 로 정규화하면 두 표면이 갈려 재사용이 깨진다 — 이것이 §5.4 기준 (a)(다른 표면과의 wire parity)의 원형 사례다.

## 체크리스트

- [x] `/consistency-check --spec` 통과 — **BLOCK: NO** (Critical 0 / Warning 5 / Info 6). 세션 `review/consistency/2026/07/10/22_30_47/`. Warning 5건 전부 반영 완료.
- [x] `spec/conventions/swagger.md` §1-4 개정 + §5-2 **각주**(행 아님) + Rationale 3항목 — `a02db4f9a`
- [x] `spec/5-system/2-api-convention.md` §5.4 신설(소급 미적용 캐리브 포함) + Rationale 1항목 — `a02db4f9a`
- [x] `spec/5-system/14-external-interaction-api.md` §5.3 예시 JSON 정정(+`seq: 0`) + §5.3/§R17 cross-ref (§5.4 파일명 qualify) — `a02db4f9a`
- [x] `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 축-분리 cross-ref — `a02db4f9a`
- [x] `/consistency-check --impl-prep` 통과 — **BLOCK: NO** (Critical 0 / Warning 1 / Info 8). 세션 `review/consistency/2026/07/10/22_50_15/`
- [x] 구현:
  - [x] `responses.dto.ts` — `ButtonsContextDto` / `NodeOutputContextDto` oneOf 봉투 (discriminator 없음) + `@ApiExtraModels`. 명명 가드 준수 (`ExecutionContext*` 접두 회피).
  - [x] `CurrentNodeDto` 신설 — `currentNode` 도 닫힌 shape 인데 `additionalProperties` 였다 (§1-4 Rationale 이 인용한 바로 그 드리프트 실증 사례). impl-prep 에서 cross_spec·rationale_continuity 2인 독립 제안.
  - [x] `result`/`error` 에 `nullable: true` 추가 — §5.4 "null 필드는 nullable 선언" 미준수였음. 신규 스키마 테스트가 검출.
  - [x] `responses.dto.ts` stale JSDoc 정정 (unsound discriminator 가정 제거)
  - [x] `eia-types.ts` `currentNode` 타입 드리프트 정정 (`string|null` → 객체)
  - [x] `interaction.service.ts` — `base` 에 `WaitingContextBase` 명시 annotate (object spread 가 literal 을 widening). **런타임 wire 무변경**
- [x] 테스트: `responses.dto.spec.ts` 신규 15건(실 OpenAPI 문서 생성 검증 — dangling `$ref` 포착. pre-change DTO 스왑 시 13건 FAIL 함을 리뷰어가 실측) + `interaction.service.spec.ts` 2건(buttons fallthrough · buttons+thread 부재 키 생략) + `external-interaction.e2e-spec.ts` `I-2` 1건(실 wire buttonConfig variant)
- [x] TEST WORKFLOW: lint PASS · unit PASS · build PASS · e2e PASS (249)
- [x] `/ai-review` (9 reviewer) — **Critical 0 / Warning 5**, 위험도 LOW. 세션 `review/code/2026/07/10/23_20_33/`
- [x] Warning 5건 전부 fix + `RESOLUTION.md` (defer 0건) — 링크 off-by-one · `WaitingContextBase` 명명 · 약한 assertion 2건 · 테스트 중복/e2e 갭
- [x] fix 후 TEST WORKFLOW 재통과 (e2e 249 → **250**, 신규 `I-2` 1건)
- [x] `origin/main` rebase (PR #899 선병합 — 충돌 없음)
- [x] `/consistency-check --impl-done` — **BLOCK: NO** (Critical 0 / Warning 0 / Info 5). 세션 `review/consistency/2026/07/10/23_46_04/`

## 후속

본 PR 의 미해결 항목은 0건. 리뷰 게이트에서 비차단으로 분리 합의된 잔여 3건은 별도 plan 으로 이관했다 → [`eia-context-schema-followups.md`](../in-progress/eia-context-schema-followups.md)

의도적 미조치(재검토 불요) 2건도 같은 문서의 §비고 에 근거와 함께 기록.
