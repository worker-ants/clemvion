# Rationale 연속성 검토 — EIA `getStatus.context` 스키마화 (impl-done)

- diff base: `origin/main` (4 commits: `311015832` spec, `60c4c8900` impl, `efc9e791e` ai-review Warning fix, `b1d69ed8c` docs)
- 검토 대상 SoT: 워킹트리 HEAD (`efc9e791e` 반영 최종 상태) — 절대경로로 직접 Read/Grep/실행 검증
- 대조 Rationale: `spec/conventions/swagger.md` §1-4 3개 항목 / `spec/5-system/2-api-convention.md` "왜 conversationThread 를 null 로 정규화하지 않는가 (§5.4)" / `spec/5-system/14-external-interaction-api.md` §R17

## 검증 방법

코드 상태만으로 결론 내리지 않고, 아래는 실제 실행으로 확인했다:

1. `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` 및 `interaction.service.ts` 전문 Read.
2. `git -C <worktree> grep -n "discriminator"` / `"ConversationThreadDto"` — 코드 내 실제 선언 여부.
3. 기존 `responses.dto.spec.ts`(15 tests) `npx jest` 실행 — PASS.
4. **임시 스크래치 테스트**(`__phantom_check.spec.ts`, 검증 후 즉시 삭제 — 저장소에 남기지 않음)로 `SwaggerModule.createDocument()` 를 직접 호출해 `components.schemas` 의 실제 키 목록을 덤프. 결과:
   ```
   SCHEMA_KEYS: ['ButtonsContextDto', 'NodeOutputContextDto', 'CurrentNodeDto', 'ExecutionStatusDto']
   ```
   `WaitingContextBaseDto` 도 `ConversationThreadDto` 도 나타나지 않음.
5. `ConversationThread` 타입이 실제로는 `interface`(데코레이터 없음, `import type` 전용)임을 `conversation-thread.types.ts` 에서 확인 — OpenAPI 모델로 등록될 경로 자체가 없음.

## 점검 관점별 결과

### (a) discriminator 부재
`ExecutionStatusDto.context` 의 `@ApiPropertyOptional` 데코레이터는 `oneOf: [{$ref: ButtonsContextDto}, {$ref: NodeOutputContextDto}]` 만 선언하고 `discriminator` 키를 쓰지 않는다. 코드베이스 전체에서 `discriminator` 문자열이 등장하는 곳은 전부 "선언하지 않는다"는 주석/테스트뿐(`responses.dto.ts:189`, `responses.dto.spec.ts:77-83` — `expect(context.discriminator).toBeUndefined()`, `interaction.service.spec.ts:527-529` — fallthrough 회귀 가드 주석). **swagger.md "discriminator 는 판별자가 sound 할 때만" Rationale 과 완전 정합.**

### (b) `conversationThread` 키 생략 유지 (null 정규화 아님)
`interaction.service.ts` 의 `base` 조립부는 `...(conversationThread ? { conversationThread } : {})` 로 **값이 있을 때만 키를 얹는다** — 이전 커밋과 동일한 패턴이며 `WaitingContextBase`(type) → `WaitingContextBaseDto`(abstract class) 전환은 타입 표현만 바뀌었을 뿐 런타임 조립 로직은 그대로다. DTO 필드 선언도 `conversationThread?: ConversationThread`(옵셔널, `| null` 아님)로 "null 아님, 키 생략" 계약을 유지한다. 신규 e2e `I-2`(`external-interaction.e2e-spec.ts`)가 실 HTTP+DB round-trip 으로 `Object.keys(context)).not.toContain('conversationThread')` 를 직접 검증한다. **api-convention.md "왜 null 로 정규화하지 않는가" Rationale 과 완전 정합.**

### (c) `ConversationThreadDto` 미생성
클래스로 존재하지 않으며(grep 결과 전부 "만들지 않는다"는 테스트/주석), `conversationThread` 필드는 `type: 'object', additionalProperties: true` 로 열린 map 유지 — description 이 `conversation-thread.md` 를 SoT 로 지목. 스키마 덤프에도 `ConversationThreadDto` 없음. **swagger.md "봉투만 스키마화 + ConversationThreadDto 를 만들지 않는다" Rationale 과 완전 정합.**

### (d) 런타임 wire 불변
`getStatus()` 의 object 조립 로직(if/else 삼항, spread 순서, `buttonConfig`/`nodeOutput` 키 이름, `currentNode`/`result`/`error` 의 `null` 관례, `seq: 0` placeholder)은 이번 4-commit 범위에서 **타입 계층만 정밀화**(`Record<string,unknown>` → 판별된 클래스 union)되었을 뿐 실제로 내려가는 JSON 키·값 구조는 바뀌지 않았다. 신규 e2e `I-2` 가 buttons variant 의 실제 HTTP 응답 바디를 검증해 이를 실증한다. RESOLUTION.md 도 "본 PR 은 런타임 무변경이 계약"이라고 명시하며 `getStatus()` 리팩터(길이 추출)를 그 이유로 범위 밖 처리했다.

### (e) `WaitingContextBaseDto` export 가 envelope-only 원칙을 침해하는가
침해하지 않는다. `efc9e791e`(W2 조치)에서 `abstract class` 를 export 로 바꾼 이유는 **TypeScript 컴파일 타임 타입 주석 필요성**(object literal spread 가 리터럴 타입을 넓혀 두 variant 에 assignable 하지 않게 되는 문제) 때문이며, `@ApiExtraModels` 에 등록하지 않는다. 스캐폴드 테스트로 실측한 대로 OpenAPI `components.schemas` 에 `WaitingContextBaseDto` 는 나타나지 않는다 — 클래스 자신의 JSDoc 이 "phantom 스키마가 생기지 않는다"고 명시적으로 예고한 바를 코드가 실제로 지킨다. base 클래스가 가진 필드(`interactionType`/`waitingNodeId`/`conversationThread`)도 envelope 범위 그대로이고, `nodeOutput`/`buttonConfig` 내부 payload 는 여전히 하위 variant 클래스에서 `additionalProperties: true` 로 열려 있다 — "봉투만 스키마화, 내부는 open" 경계가 그대로 유지된다.

## 발견사항

없음 — CRITICAL/WARNING/INFO 모두 없음.

이번 4-commit 은 spec 신설 Rationale(closed-union split · discriminator soundness · envelope-only)과 코드가 **같은 브랜치 내에서 도입과 구현이 짝을 이루는 이례적으로 깨끗한 사례**다. 특히 review-fix 커밋(`efc9e791e`)의 W2 항목은 "새 export 가 phantom 스키마를 만들지 않는다"는 주장을 코드 주석에 명시했고, 본 검토는 이를 실측(스캐폴드 OpenAPI 문서 생성)으로 재확인해 주장이 사실임을 확인했다. 부가적으로 `channel-web-chat/eia-types.ts` 의 `currentNode` 타입 정정은 swagger.md Rationale 이 인용한 "실증 사례"(위젯 타입 드리프트)를 직접 해소하는 후속 조치로, Rationale 예시와 모순 없이 오히려 그 근거가 지목한 결함을 메운다.

## 요약

target 코드(`efc9e791e` 반영 최종 상태)는 같은 브랜치에서 신설된 세 Rationale 항목(닫힌 union 분리, discriminator soundness, envelope-only + ConversationThreadDto 미생성) 및 기존 EIA §R17 / api-convention §5.4 의 "conversationThread 키 생략" 결정을 어느 것도 재도입·번복·우회하지 않는다. review-fix 로 새로 export 된 `WaitingContextBaseDto` 는 OpenAPI 등록 경로(`@ApiExtraModels` 미등록)가 없어 실제 생성된 스키마(`ButtonsContextDto`/`NodeOutputContextDto`/`CurrentNodeDto`/`ExecutionStatusDto` 4종만 존재, 실측 확인)에 영향을 주지 않으며, 런타임 wire 도 e2e 로 불변이 실증됐다. Rationale 연속성 관점에서 위반·번복 사례를 찾지 못했다.

## 위험도

NONE

STATUS: SUCCESS
