# 테스트(Testing) 리뷰 — EIA `getStatus.context` OpenAPI 스키마화

diff base: `origin/main` (a02db4f9a spec + 0302bd7ea impl)

## 검증 방법

주장을 문서 read 만으로 판단하지 않고, 실제로:
1. `responses.dto.spec.ts` 를 현재 코드에서 실행 → 15/15 PASS 확인.
2. `origin/main` 의 pre-change `responses.dto.ts` 를 워킹트리에 스왑해 같은 스펙 재실행 → **13/15 FAIL, 2/15 PASS** 확인 후 원복.
3. `SwaggerModule.createDocument()` 가 실제로 생성하는 `ExecutionStatusDto`/`CurrentNodeDto`/`ButtonsContextDto`/`NodeOutputContextDto` JSON 스키마를 직접 덤프해 각 assertion 의 실제 대상값 확인.
4. `context` 데코레이터에 `discriminator: { propertyName: 'interactionType' }` 를 되돌려 넣어 가드 테스트가 실제로 잡는지 확인 후 원복.
5. `currentNode` 데코레이터에서 `nullable`/`description` 을 제거해 NestJS Swagger 가 `allOf` wrap 대신 bare `$ref` 를 내는 조건을 실측.
6. `interaction.service.spec.ts` 신규 2건을 `origin/main` 의 pre-change `interaction.service.ts` 에서도 재실행 → 둘 다 PASS 확인 후 원복.
7. `interaction.service.spec.ts`/`external-interaction.e2e-spec.ts` 전체를 grep 해 기존 커버리지(버튼 happy path·conversationThread present-case·conversationThread 부재-case) 유무 확인.

원복 후 `git status`/`git diff --stat` 로 워킹트리가 clean 함을 재확인함 (스왑 실험으로 인한 잔여 변경 없음).

---

## 발견사항

### [INFO] `currentNode.allOf ?? [{ $ref: currentNode.$ref }]` — 실제로는 순수 tautology 아니지만, 영구 도달 불가능한 죽은 fallback

- 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.spec.ts:132`
- 상세:
  - 실측 결과 `currentNode` 의 실제 생성 스키마는 항상 `{ description, nullable: true, allOf: [{ $ref: ".../CurrentNodeDto" }] }` 형태다 (`allOf` 존재).
  - 추가로 확인: NestJS Swagger(`^11.2.7`)는 `$ref` 프로퍼티에 **어떤 sibling 키워드**(`description` 만 있어도, `nullable` 없어도)라도 붙으면 `allOf` 로 wrap 한다. sibling 이 전혀 없을 때만 bare `{ $ref }` 를 낸다. `currentNode` 데코레이터는 `description` 을 항상 갖고 있으므로, `??` 우측 fallback(`{ $ref: currentNode.$ref }`)은 **이 코드베이스 구조상 영구적으로 도달 불가능**하다.
  - 다만 지적된 우려("두 분기 모두 trivial 하게 통과하는가")는 실측상 **사실이 아니다** — fallback 분기가 실행되더라도 비교 대상 `getSchemaPath(CurrentNodeDto)` 는 실제 SUT 값과 무관하게 독립적으로 계산되므로(클래스 리플렉션), `currentNode.$ref` 가 잘못되거나 `undefined` 면 여전히 실패한다. 즉 자기참조(self-referential) tautology 는 아니다.
  - 그럼에도 이 hedge 는 두 가지 다른 스키마 표현(`allOf` wrap vs bare `$ref`+sibling)을 "동등하게 허용"하는 효과를 내는데, 후자는 OpenAPI 3.0 상 `$ref` sibling 키가 무시되는 스펙이라 실제로는 **`nullable` 이 소비자에게 유실되는 열등한 표현**이다. 즉 hedge 는 두 표현을 구분 없이 통과시켜, "정확히 어떤 스키마 shape 이 나오는가"에 대한 정밀도를 낮춘다.
- 제안: 실측으로 확정된 실제 shape 을 직접 단언하도록 단순화 — `expect(currentNode).toEqual({ description: expect.any(String), nullable: true, allOf: [{ $ref: getSchemaPath(CurrentNodeDto) }] })` 또는 최소한 `expect(currentNode.allOf).toEqual([...])` 로 고정하고 `??` fallback 을 제거. 현재 형태는 죽은 코드이자, NestJS Swagger 버전 거동에 대한 불확실성을 그대로 코드에 남겨둔 것.

### [WARNING] `expect(context.type).not.toBe('object')` — 약한 negative assertion, 상위 assertion 과 중복

- 위치: `responses.dto.spec.ts:126`
- 상세: 실측 결과 `context.type` 은 (oneOf 분기이므로) `undefined` 다. `not.toBe('object')` 는 `undefined`·`'array'`·`'string'` 등 `'object'` 이외의 **어떤 값이 와도** 통과한다 — "정확히 oneOf 형태인가"를 증명하지 않는다. pre-change 코드에서는 `context.type === 'object'` 였으므로 이 assertion 자체는 회귀를 잡긴 하지만(실측 확인 완료), 바로 위 `context 는 두 variant 의 oneOf 다` 테스트가 이미 `context.oneOf` 를 정확한 배열로 `toEqual` 검증하고 있어 이 negative check 은 실질적으로 중복이며, 방어 범위도 더 좁다.
- 제안: `expect(context.type).toBeUndefined()` 로 정밀화하거나, 상위 oneOf exact-match 테스트로 이미 충분히 커버되므로 이 줄을 제거하고 `additionalProperties` 체크만 남겨도 무방.

### [WARNING] `interaction.service.spec.ts` 신규 conversationThread 부재 테스트가 기존 테스트와 사실상 중복

- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:550-567` (신규) vs `interaction.service.spec.ts:765-784` (기존, diff 밖 — pre-existing)
- 상세: 신규 테스트("waiting_for_input — durable thread 부재 시 conversationThread 키 자체를 생략한다")와 기존 테스트("waiting_for_input — conversation_thread 가 null(배포 이전 row)이면 conversationThread 키 미동봉")는:
  - 둘 다 `conversationThread: null`, `outputData.meta.interactionType: 'ai_conversation'`, node type `ai_agent`/`ai_agent` 로 **동일한 fixture**를 세팅.
  - 둘 다 "context 에 conversationThread 키가 없다"를 검증(matcher 만 다름: `Object.keys(...).not.toContain` + `toBeUndefined()` vs `not.toHaveProperty`).
  - 새로 추가된 커버리지가 사실상 없다 — 같은 시나리오를 다른 matcher 로 재확인하는 수준.
- 제안: 신규 테스트를 `buttons` variant(현재 `buttons`+conversationThread 부재 조합은 어디에도 없음) 또는 `conversation_thread` 컬럼이 `undefined`(row 자체가 컬럼을 안 가진 legacy 상황과 `null` 명시값의 구분)로 분화해 실질적 신규 엣지케이스를 커버하거나, 기존 테스트로 통합.

### [WARNING] `buttons`/`buttonConfig` variant 의 e2e(실 HTTP+DB round-trip) 커버리지 부재

- 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` (테스트 I/J, L344-479 부근)
- 상세: `grep -n "buttonConfig\|'buttons'" test/*.e2e-spec.ts` 결과 0건 — e2e 레벨에서 `interactionType='buttons'` 케이스(및 이번 PR 의 핵심인 `buttonConfig` 복원 성공/실패 fallthrough)를 실제 HTTP 요청 + 실 DB row 로 검증하는 테스트가 **전혀 없다**. 기존 e2e 테스트 I/J 는 `ai_conversation` 만 다룬다.
  - `interaction.service.spec.ts` 의 mock 기반 유닛 테스트는 buttons happy-path(기존, L501)와 fallthrough(신규, L530)를 모두 커버하지만, 이는 `nodeRepo.findOne` 을 손수 구성한 mock 객체로 대체한 것이라 실제 TypeORM 컬럼 타입·JSON 직렬화·DB round-trip 상에서 같은 결과가 나오는지는 검증되지 않는다.
  - 이번 PR 은 정확히 "buttons 인터랙션의 스키마·판별 로직" 이 핵심 주제이므로, 이 변형에 대한 e2e 부재는 이 PR 범위에서 상대적으로 눈에 띄는 갭이다.
- 제안: 기존 e2e 테스트 I(`ai_conversation` secret 마스킹)와 대칭으로 `buttons` + `buttonConfig` 를 seed 하는 e2e 케이스 1건 추가(마스킹까지 함께 검증하면 일석이조), 또는 최소한 fallthrough(구성 데이터에 `buttonConfig` 없는 buttons 노드) 케이스를 e2e 로 1건 추가.

### [INFO] `WaitingContextBaseDto`(abstract) 가 `components.schemas` 에 새어 나오지 않는지 검증하는 테스트 없음

- 위치: `responses.dto.spec.ts` (전체)
- 상세: 실측상 현재는 `WaitingContextBaseDto` 가 스키마에 등장하지 않는다(정상). 그러나 `ConversationThreadDto 를 만들지 않는다` 같은 형태의 negative 가드가 이 클래스에는 없다 — abstract base 가 실수로 `@ApiExtraModels` 대상이 되거나 별도 참조돼 schemas 에 노출되는 회귀를 잡지 못한다. 우선순위 낮음(현재 구조상 발생 가능성 낮음).
- 제안: 필요시 `expect(schemas.WaitingContextBaseDto).toBeUndefined()` 1줄 추가.

### [INFO] plan 체크리스트의 테스트 건수 표기(14건) 와 실제(15건) 불일치

- 위치: `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` 체크리스트 vs `responses.dto.spec.ts` 실제 `it`/`it.each` 총 15건(파라미터화 展開 포함)
- 상세: 사소한 북키핑 오차. 코드 결함 아님.
- 제안: 필요시 정정(낮은 우선순위, 선택 사항).

---

## 점검 관점별 답변 (요청 사항 1~5)

**(1) 각 신규 assertion 이 pre-change 코드에서 실제로 FAIL 하는가**

- `responses.dto.spec.ts`: 실측 결과 15건 중 **13건 FAIL / 2건 PASS**(pre-change DTO 로 스왑 후). PASS 한 2건(`discriminator 미선언` 가드, `ConversationThreadDto 미생성` 가드)은 애초에 "미래 회귀를 막는 forward guard"로 설계된 것이며, pre-change 코드에도 discriminator/ConversationThreadDto 가 없었으므로 자연스럽게 통과하는 것이 맞다 — 결함 아님(discriminator 재도입 시 실제로 FAIL 함을 별도로 실측 확인, 아래 (4) 참고).
- `interaction.service.spec.ts` 신규 2건: 흥미롭게도, `origin/main` 의 pre-change `interaction.service.ts` 로 스왑해도 **둘 다 PASS 한다**. 이는 이번 diff 의 `interaction.service.ts` 변경이 순수 타입 리팩터(`WaitingContextBase` 명시 annotate)일 뿐 런타임 동작을 바꾸지 않았기 때문(plan 체크리스트도 "런타임 wire 무변경" 명시). 즉 이 2건은 **"이번 diff 의 회귀를 잡는 테스트"가 아니라 "이전부터 존재했지만 테스트되지 않았던 동작에 대한 신규 characterization 테스트"**다 — 정확한 분류로는 유효하고 가치 있으나(신규 DTO 설계 근거인 fallthrough 를 실행 가능한 증거로 고정), 실제 diff 자체에 대한 회귀 방지력은 없다는 점을 report 상 명확히 해둔다.

**(2) `currentNode.allOf ?? [{ $ref: currentNode.$ref }]` — real assertion 인가 trivial pass 인가**

- 실측: 현재 생성 스키마는 항상 `allOf` 를 쓴다(`nullable`/`description` 등 sibling 이 있으면 무조건 wrap). fallback 우측은 **영구 도달 불가능한 죽은 코드**다.
- 다만 도달했다고 가정해도 **순수 tautology 는 아니다**(비교 대상이 SUT 와 독립적으로 계산됨) — 위 발견사항 [INFO] 참고. "두 분기 모두 trivial 하게 pass" 라는 가정은 실측상 기각하되, 죽은 코드·정밀도 저하라는 관점에서 개선 여지는 있음.

**(3) 커버리지 갭**

- `$ref` dangling 검증: `@ApiExtraModels` 등재 여부(`schemas.X` defined) + `oneOf`/`allOf` 의 정확한 `$ref` 문자열 `toEqual` 조합으로 사실상 dangling-ref 방지를 커버함. 충분.
- `buttons`+`buttonConfig` happy path: **이미 기존 테스트가 커버**(`interaction.service.spec.ts:501`, diff 밖 — pre-existing). 갭 아님.
- `conversationThread` present-case: **이미 기존 테스트가 커버**(`interaction.service.spec.ts:606, 630`, diff 밖 — pre-existing). 갭 아님.
- 신규로 드러난 실질 갭: (a) `conversationThread` 부재-case 신규 테스트가 기존 테스트와 중복(위 WARNING), (b) `buttons`/`buttonConfig` 의 e2e 커버리지 전무(위 WARNING).

**(4) `discriminator` 재도입을 잡는 테스트가 있는가**

- 있다. `context 는 discriminator 를 선언하지 않는다` 테스트(`responses.dto.spec.ts:109`)가 이를 담당하며, `context` 데코레이터에 `discriminator: { propertyName: 'interactionType' }` 를 실제로 되돌려 넣어 **FAIL 함을 실측 확인**(`Received: {"propertyName": "interactionType"}`). 유효한 가드.

**(5) 실 HTTP 응답 shape 에 대한 e2e/contract 테스트 누락 여부**

- `ai_conversation` variant 는 e2e 로 커버됨(`external-interaction.e2e-spec.ts` 테스트 I/J, secret 마스킹 포함, 실 DB row → 실 HTTP GET).
- `buttons`/`buttonConfig` variant 는 e2e 미존재(위 WARNING). 이번 PR 의 핵심 변경 대상이므로 우선순위 있는 갭으로 판단.
- `responses.dto.spec.ts` 는 실 `AppModule`/`ApiOkWrappedResponse` 대신 최소 `StubController` + 순수 `ApiOkResponse({ type: ExecutionStatusDto })` 로 문서를 생성한다. `@ApiExtraModels(...)` 가 `ExecutionStatusDto` 클래스 자체에 붙어 있어(컨트롤러가 아니라) 실제 프로덕션 경로(`interaction.controller.ts` 의 `@ApiOkWrappedResponse(ExecutionStatusDto)`)와 스키마 등록 메커니즘이 동일함을 확인했다 — 기능적으로 동등하며, 기존 프로젝트 선례(`common/swagger/api-wrapped.spec.ts`)와도 패턴이 일치한다. 실질적 갭이라기보단 의도된 단위 격리로 판단(정보성).

---

## 요약

새 `responses.dto.spec.ts` 는 손으로 데코레이터 메타데이터를 들여다보는 대신 실제 `SwaggerModule.createDocument()` 를 호출해 생성 문서를 검증하는 견실한 접근이며, 실측 결과 15건 중 13건이 pre-change DTO 에서 실제로 FAIL 함을 확인해 회귀 방지력이 실질적임을 검증했다. `discriminator` 재도입 가드도 직접 패치해 FAIL 함을 확인했다. 다만 `currentNode` 의 `allOf ?? [...]` fallback 은 이 코드베이스 구조상 영구 도달 불가능한 죽은 분기이며(순수 tautology 는 아니지만 정밀도를 낮추는 hedge), `context.type not.toBe('object')` 는 상위 exact-match 테스트와 중복되는 약한 negative assertion이다. `interaction.service.spec.ts` 신규 2건 중 fallthrough 테스트는 진짜 신규 커버리지지만, conversationThread 부재 테스트는 기존 pre-existing 테스트(L765)와 사실상 중복이라 실질 가치가 낮다. 가장 눈에 띄는 실질 갭은 이번 PR 의 핵심 변경 대상인 `buttons`/`buttonConfig` variant 에 대한 e2e(실 HTTP+DB) 커버리지가 전무하다는 점 — 유닛 레벨(mock)로는 충분히 커버되지만 실 DB round-trip 검증이 `ai_conversation` variant 에만 존재한다.

## 위험도

LOW

(정밀도가 낮은 assertion 2건과 테스트 중복 1건, e2e 갭 1건 — 전부 test-quality 개선 여지이며 기능적 결함이나 순수 vacuous-pass 테스트는 발견되지 않음. 핵심 주장인 dangling-$ref 방지·discriminator 재도입 가드는 실측으로 유효성 확인됨.)
