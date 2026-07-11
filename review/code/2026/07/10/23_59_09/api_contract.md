# API 계약(API Contract) 리뷰 — Fresh review of `efc9e791e` (fix commit)

대상 커밋: `efc9e791e369833f784a3a9f5f2a51568f171c76` (parent `60c4c8900`)
성격: 직전 리뷰(`review/code/2026/07/10/23_20_33/`) Warning 5건(W1~W5) 반영. Critical 0 / Warning 5 전부 수정.
본 리뷰의 임무: 지정된 4개 검증 항목만 확인 — 새 이슈 탐색이 아니라 **fix 가 API 계약을 깨지 않았는지 검증**.

## 검증 (1) — 생성된 OpenAPI 문서가 커밋 전후 byte-for-byte 동일한가

`responses.dto.ts` diff 를 전수 대조한 결과, 데코레이터(`@ApiProperty`/`@ApiPropertyOptional`/`@ApiExtraModels`) 인자는 **단 한 곳도 변경되지 않았다**. 변경분은 3종뿐이다:

1. JSDoc 상대링크 오프바이원 정정(`../×5`→`../×6`, 4곳) — 순수 주석, 런타임/메타데이터 영향 없음.
2. `abstract class WaitingContextBaseDto` 에 `export` 키워드 추가 — TS 모듈 시스템의 export 가시성일 뿐, `reflect-metadata` 데코레이터 메타데이터나 `@nestjs/swagger` 스캐너 동작에 영향 없음.
3. `export type WaitingContextBase = Pick<NodeOutputContextDto, ...>` 타입 별칭 삭제 — 순수 TS 타입(컴파일 타임에 완전히 소거), 애초에 `@ApiExtraModels` 에 등록된 적도 없고 어떤 데코레이터 인자에도 참조된 적 없음.

경험적으로도 검증했다. `git show 60c4c8900:.../responses.dto.ts` (커밋 직전 버전)를 워킹트리에 임시로 덮어쓰고, **커밋 이후 강화된** `responses.dto.spec.ts`(실제 `SwaggerModule.createDocument()` 호출로 `components.schemas` 를 검증하는 파일 — `context.oneOf`, `context.type toBeUndefined()`, `currentNode.allOf`, `nullable`, `required` 배열 등 15건)를 그대로 실행:

```
# BEFORE (커밋 직전 dto.ts) + AFTER(강화된) spec
Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total

# AFTER (커밋 이후 dto.ts) + AFTER spec
Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
```

두 경우 모두 **15/15 동일하게 통과** — `context.oneOf`(정확히 `ButtonsContextDto`/`NodeOutputContextDto` `$ref` 2건), `context.type === undefined`, `context.additionalProperties === undefined`, `currentNode.allOf === [{$ref: CurrentNodeDto}]`, `currentNode.nullable === true`, 각 variant 의 `required` 배열, `conversationThread` optional/non-nullable, `result`/`error` nullable 등 모든 스키마 특성이 커밋 전후 동일함을 실증했다. 테스트 후 `responses.dto.ts` 를 원상 복구했고 `git diff` 로 HEAD 와 완전 일치함을 확인했다(작업 트리 오염 없음).

**결론: OpenAPI 문서는 스키마 키·`context.oneOf`·`nullable`·`required` 배열 모두 byte-for-byte 동등하다.** 이번 커밋은 순수 리팩터/문서화이며 API 표면에 어떤 변경도 없다.

## 검증 (2) — `WaitingContextBase` 타입 별칭 제거가 퍼블리시 패키지 공개 API 를 깨는가

`codebase/packages/sdk`(`@workflow/sdk`, `private` 플래그 없음 — 배포 대상), `codebase/packages/web-chat-sdk`, `codebase/channel-web-chat`(private app) 전체를 grep:

```
grep -rn "WaitingContextBase" codebase/ spec/ --include="*.ts" --include="*.md"
→ codebase/backend/dist/...  (gitignore 대상 로컬 빌드 산출물, 커밋 이력에 없음)
→ codebase/backend/src/modules/external-interaction/interaction.service.ts (내부 consumer)
→ codebase/backend/src/modules/external-interaction/dto/responses.dto.ts (선언부)
```

`codebase/packages/sdk/src`, `codebase/packages/web-chat-sdk/src`, `codebase/channel-web-chat/src` 어디에도 `WaitingContextBase`/`responses.dto`/`external-interaction/dto` 참조가 **0건**이다. `@workflow/sdk` 는 `src/client.ts` 에 자체 손타이핑한 `ExecutionStatus` 인터페이스(`context?: Record<string, unknown> | null`)를 갖고 있으며 백엔드 DTO 를 import 하지 않는다 — SDK 는 OpenAPI 계약(런타임 wire)만을 신뢰하는 독립 타입 선언이다. 백엔드 모듈 내부의 TS 타입 별칭은 애초에 어떤 workspace 패키지의 `import` 대상도 아니었으므로, 이를 제거하는 것은 **어떤 퍼블리시 패키지의 공개 API 도 건드리지 않는다.** breaking change 아님.

## 검증 (3) — `WaitingContextBaseDto` export 가 barrel/index 를 통해 공개 API 에 유출되는가

- `codebase/backend/src/modules/external-interaction/` 하위에 barrel `index.ts` 없음(`external-interaction.module.ts` 만 존재, `providers`/`exports` 는 서비스 클래스만 — DTO 재노출 없음).
- 저장소 전체에서 `export * from .../external-interaction` 또는 named re-export 패턴 0건.
- `WaitingContextBaseDto` 를 실제로 import 하는 곳은 `interaction.service.ts` 단 한 곳이며, `import { type WaitingContextBaseDto } from './dto/responses.dto'` — **type-only import**(컴파일 타임 소거, 런타임 번들에 미포함).
- OpenAPI 스키마 관점: `@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto, CurrentNodeDto)` 데코레이터에 `WaitingContextBaseDto` 는 등록되지 않았고, 어떤 컨트롤러의 `@ApiProperty({ type: ... })` 도 이를 직접 참조하지 않는다 — 검증 (1)에서 실측한 대로 `components.schemas` 에 `WaitingContextBaseDto` 항목이 생기지 않는다(phantom 스키마 없음).

**결론: `export abstract class` 가 됐지만 barrel-export/공개 API/OpenAPI 문서 어디에도 유출되지 않는다.** TS 모듈 시스템상 "exported" 는 됐으나, 소비처가 모듈 내부 1곳(type-only)뿐이라 실질적 공개 표면(published package, OpenAPI schema)에는 무해하다 — RESOLUTION.md W2 조치 근거(구조적 타이핑 + `@ApiExtraModels` 미등록)와 정확히 부합.

## 검증 (4) — e2e `I-2` 의 `res.body.data.context` 가 문서화된 `{data}` envelope 과 일치하는가

`interaction.controller.ts`:
```ts
@ApiOkWrappedResponse(ExecutionStatusDto)
async getStatus(...): Promise<ExecutionStatusDto> { ... }
```
핸들러는 `data` 키가 없는 평범한 `ExecutionStatusDto`(`id`/`workflowId`/`status`/`currentNode`/`context`/`result`/`error`/`seq`/`updatedAt`)를 그대로 반환한다. 전역 `TransformInterceptor`:
```ts
map((data) => {
  if (data && typeof data === 'object' && 'data' in data) return data;
  return { data };
})
```
`ExecutionStatusDto` 에는 `data` 키가 없으므로 `'data' in data` 가 항상 `false` → 무조건 `{ data: ExecutionStatusDto }` 로 래핑된다. 이는 `api-convention.md §5.1` 단일 리소스 계약(`{"data": {...}}`)과 정확히 일치하며, `@ApiOkWrappedResponse` 헬퍼(`wrapDataSchema`)가 OpenAPI 문서에도 동일하게 `{ data: $ref ExecutionStatusDto }` 로 선언해 문서·런타임이 수렴한다.

`I-2` 테스트의 `const context = res.body.data.context;` 는 이 래핑을 정확히 반영한 접근이다. 이번 커밋에서 컨트롤러 반환 타입·인터셉터·`@ApiOkWrappedResponse` 데코레이터는 전혀 변경되지 않았으므로(diff 범위 밖), envelope 계약은 커밋 전후 무변경으로 유지된다. **일치.**

## 점검 관점별 요약

1. **하위 호환성** — Breaking change 없음. (1)(2) 로 실증.
2. **버전 관리** — 응답 스키마 무변경이므로 버전 bump 불요, 타당.
3. **응답 형식** — `{data: ExecutionStatusDto}` envelope, `context.oneOf` 등 스키마 표현 전부 무변경(실측).
4. **에러 응답** — 본 diff 범위 밖(무변경).
5. **요청 검증** — 응답 DTO 만 대상, 요청 DTO 변경 없음.
6. **URL/경로 설계** — 무변경.
7. **페이지네이션** — 해당 없음(단발 상태 조회).
8. **인증/인가** — 무변경(`InteractionGuard`/컨트롤러 데코레이터 그대로).

## 발견사항

없음. 4개 검증 항목 모두 "fix 가 API 계약을 깨지 않았다"로 확정됐다. 신규 CRITICAL/WARNING/INFO 없음.

## 요약

이번 커밋(`efc9e791e`)은 직전 리뷰의 Warning 5건(spec 링크 off-by-one, `WaitingContextBase`/`WaitingContextBaseDto` 명명 혼동, 약한 테스트 단언 2건, 테스트 중복+e2e 갭)을 반영한 순수 리팩터/테스트 강화 커밋이다. API 계약 관점에서 4개 지정 검증을 모두 실증했다: (1) `responses.dto.ts` 의 실제 변경분은 JSDoc 링크 정정·`export` 키워드 추가·미사용(데코레이터에서 참조되지 않는) 타입 별칭 삭제뿐이며, 커밋 전후 dto.ts 를 교차 실행한 OpenAPI 문서 생성 테스트(15/15)가 스키마 완전 동등성을 실측 확인했다. (2) 제거된 `WaitingContextBase` 타입 별칭은 `@workflow/sdk`·`web-chat-sdk`·`channel-web-chat` 어디에도 참조되지 않는 백엔드 모듈 내부 전용 타입이라 퍼블리시 패키지 공개 API 에 영향 없다. (3) 새로 export 된 `WaitingContextBaseDto` 는 barrel/index 재노출 경로가 없고 type-only import 소비처 1곳뿐이며 `@ApiExtraModels` 미등록으로 OpenAPI 문서에도 나타나지 않아 공개 표면 유출이 없다. (4) 신규 e2e `I-2` 의 `res.body.data.context` 접근은 `TransformInterceptor` pass-through 규칙과 `api-convention.md §5.1` 단일 리소스 `{data: <obj>}` 계약에 정확히 부합한다. 신규 이슈 없음.

## 위험도

NONE

STATUS: SUCCESS
