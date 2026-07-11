# 부작용(Side Effect) 리뷰 — `efc9e791e`

프리요청된 5개 검증 항목을 전부 실증(코드 재실행 포함)했다. 결론: 이 커밋은 런타임 동작·OpenAPI wire 를 변경하지 않는다. Fix 는 의도대로 적용됐고 새로운 부작용은 없다.

## 검증 상세

### (1) `export abstract class WaitingContextBaseDto` 가 `components.schemas` 에 등재되지 않는지

실제 OpenAPI 문서를 빌드해 스키마 키를 덤프하는 임시 jest 테스트(`SwaggerModule.createDocument` 기반, `responses.dto.spec.ts` 와 동일 패턴)를 작성·실행 후 즉시 삭제(작업 트리에 잔존물 없음, `git status --porcelain` 확인).

```
SCHEMA_KEYS=["ButtonsContextDto","CurrentNodeDto","ExecutionStatusDto","NodeOutputContextDto"]
```

`WaitingContextBaseDto`/`WaitingContextBase` 어느 쪽도 `components.schemas` 에 없다. `@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto, CurrentNodeDto)` (responses.dto.ts:154) 에도 base 클래스가 등재되지 않았음을 소스에서 직접 확인. `export` 전환은 TS 컴파일 타임 가시성만 바꾼 것이고, `@nestjs/swagger` 는 데코레이터 메타데이터(`@ApiExtraModels` 등록 여부)로만 `components.schemas` 엔트리를 만들기 때문에 export 여부와 무관 — 실측으로 확인된 대로 phantom 스키마 없음.

### (2) 타입 제약이 완전히 동일하게 유지되는지 (narrowing/optionality 보존)

부모 커밋(`efc9e791e^`)의 원래 타입:
```ts
export type WaitingContextBase = Pick<
  NodeOutputContextDto,
  'interactionType' | 'waitingNodeId' | 'conversationThread'
>;
```
`NodeOutputContextDto extends WaitingContextBaseDto` 이고 세 필드(`interactionType`/`waitingNodeId`/`conversationThread`) 중 어느 것도 override 하지 않으므로, 이 `Pick` 결과는 `WaitingContextBaseDto` 자신의 필드 집합과 구조적으로 완전히 동일하다(추가 필드도, 누락 필드도 없음). 신 커밋에서 이 3개 필드가 바로 `WaitingContextBaseDto` 의 전체 필드다(responses.dto.ts:91-108) — `interactionType: 'form' | 'buttons' | 'ai_conversation'`(3-literal union, `string` 으로 widen 안 됨), `conversationThread?: ConversationThread`(optional, `| null` 없음, present-when-available 유지).

`npx tsc -p tsconfig.build.json --noEmit` 재실행 결과 에러 0 — annotation 교체 후에도 `const base: WaitingContextBaseDto = { interactionType, waitingNodeId, ...(conversationThread ? {...} : {}) }` 대입이 여전히 타입체크를 통과하고, 이후 `ButtonsContextDto`/`NodeOutputContextDto` 로의 spread/대입도 컴파일 에러 없이 유지됨을 확인. 구조적 타이핑이므로 abstract 클래스에 `new` 없이 객체 리터럴을 대입하는 것도 문제 없음(private/protected 멤버 없음 확인). Widening 재도입 없음.

### (3) `getStatus` 가 이전과 동일 키를 방출하는지

`git show efc9e791e -- .../interaction.service.ts` 전체 diff 는 다음 2줄뿐이다:
```diff
-  type WaitingContextBase,
+  type WaitingContextBaseDto,
...
-          const base: WaitingContextBase = {
+          const base: WaitingContextBaseDto = {
```
(+주석 1줄 추가). 값 조립 로직(`interactionType`, `waitingNodeId`, conditional `conversationThread` spread) 은 문자 하나 안 바뀜 — type-only import 및 타입 annotation 교체뿐이라 런타임 동작·wire 키 방출은 100% 동일. 실측으로 `responses.dto.spec.ts` + `interaction.service.spec.ts` 재실행 시 52/52 통과 확인.

### (4) `WaitingContextBase`(구 이름) 에 대한 dangling 참조

```
grep -rnw "WaitingContextBase" --include='*.ts' --include='*.tsx' .   → 0 매치
grep -rlw "WaitingContextBase" codebase/backend/dist                  → 0 매치 (컴파일된 dist 포함)
grep -rlw "WaitingContextBase" $(find . -type d -name dist)           → 0 매치 (monorepo 전역 dist 포함)
```
신 이름 `WaitingContextBaseDto` 사용처는 정의(responses.dto.ts:91) + `ButtonsContextDto`/`NodeOutputContextDto` extends(118, 134) + `interaction.service.ts` 의 type-only import·annotation(34, 308) 뿐 — barrel/index 재-export 없음, 타 모듈에서 `responses.dto` 를 가져다 쓰는 곳도 없음. 노출 표면 확장 없음.

### (5) 신규 e2e `I-2` 의 DB 상태 잔존 — 인접 테스트에 영향 가능성

`external-interaction.e2e-spec.ts` 는 파일 전체에 `afterEach`/트렁케이션이 전혀 없다(`beforeAll`/`afterAll` 은 DB client 연결/해제만). 기존 테스트 A~J 전부 동일하게 `createTriggerWithInteraction()`(workspace/user/workflow/node/trigger 를 매 호출마다 `randomUUID()` 로 신규 생성) + 개별 `execution`/`node_execution` insert 를 하고 정리하지 않는 것이 이 파일의 확립된 컨벤션이다. `I-2` 도 동일 패턴(`nodeId`/`executionId`/node_execution row id 모두 `randomUUID()`) 을 그대로 따른다 — PK 충돌 없고, 이후 조회는 항상 자기 자신의 UUID 로 스코프되므로 cross-test 오염 경로가 없다.

교차 파일 영향도 확인: 리포지토리 전체에서 비-스코프 `COUNT(*)`/`SELECT *` 패턴을 grep 한 결과 `execution-crash-redrive.e2e-spec.ts`/`execution-stalled-redelivery.e2e-spec.ts` 의 카운트 쿼리도 전부 `WHERE execution_id = $1 AND node_id = $2` 로 스코프돼 있어, `I-2` 가 남기는 잔존 row 가 다른 파일의 집계 단언을 깨뜨릴 여지는 없다. `I-2` 는 기존 관례를 그대로 따른 것이며 새로운 부작용 클래스를 도입하지 않는다.

## 추가 확인 (범위 외 회귀 없음 재확인)

- `git show efc9e791e --name-only` — 소스/테스트 변경은 5개 파일(dto·dto.spec·interaction.service·interaction.service.spec·e2e-spec) 로 프롬프트가 명시한 범위와 일치. 나머지는 `plan/in-progress/*.md` 문서 갱신 + `review/code/2026/07/10/23_20_33/**` 이전 리뷰 세션 산출물(코드 아님, 정상적 리뷰 워크플로 산출).
- `npx eslint <5개 소스 파일>` — 에러/경고 0.
- `npx tsc -p tsconfig.build.json --noEmit` — 에러 0.
- 관련 unit 재실행 — `responses.dto.spec.ts` + `interaction.service.spec.ts` 52/52 pass.
- 작업 트리에 검증용으로 만든 임시 파일(`__tmp_schema_dump.spec.ts`) 은 삭제 완료, `git status --porcelain` 로 잔존물 없음 확인(리뷰 산출 스캐폴드 디렉터리 제외).

## 발견사항

없음. Critical/Warning 대상 부작용 없음.

## 요약

이 커밋은 순수 리네이밍/annotate 교체다 — `abstract class` 를 `export` 하고 별도 `Pick` 기반 type alias 를 제거해 그 자리를 대체했을 뿐, 값 조립 로직·`@ApiExtraModels` 등록 목록·필드 타입 제약은 문자 그대로 보존된다. OpenAPI 문서를 실제로 빌드해 스키마 키를 덤프한 결과 `WaitingContextBaseDto` 는 `components.schemas` 에 나타나지 않아 phantom 스키마 우려가 실증적으로 기각됐고, `tsc --noEmit` 재검증으로 타입 좁힘(3-literal union, optional-without-null)도 그대로 보존됨을 확인했다. `interaction.service.ts` 의 실질 diff 는 타입 주석 교체 2줄뿐이라 `getStatus` 방출 키는 커밋 전후 완전히 동일하다. 구 이름에 대한 dangling 참조는 dist 포함 리포지토리 전역에서 0건이다. 신규 e2e `I-2` 는 파일의 기존 무-정리(no-cleanup) + `randomUUID()` 스코핑 컨벤션을 그대로 따르며, 인접 테스트의 집계 쿼리도 전부 ID-스코프돼 있어 상태 누수로 인한 교차 오염 경로가 없다.

## 위험도

NONE

STATUS: SUCCESS
