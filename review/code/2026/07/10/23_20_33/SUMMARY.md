# AI Review SUMMARY — EIA getStatus context 스키마화

- diff base: `origin/main` (spec `a02db4f9a` + impl `0302bd7ea`; rebase 후 `311015832` + `60c4c8900`)
- 세션: `review/code/2026/07/10/23_20_33/`
- 실행 reviewer 9/14: security · api_contract · requirement · scope · side_effect · testing · documentation · maintainability · architecture
- **skip 5**: performance · dependency · database · concurrency · user_guide_sync — 본 변경은 타입/OpenAPI 스키마 표현 전용으로 신규 의존성·DB·동시성·사용자 가이드 표면이 없다 (router 강제 화이트리스트 7종은 모두 실행됨).

## 종합

| 항목 | 값 |
| --- | --- |
| **Critical** | **0** |
| **Warning** | **5** |
| Info | 다수 |
| 위험도 | LOW (NONE ×3, LOW ×6) |

핵심 주장 — "런타임 wire 무변경, 타입/스키마 표현만" — 은 **3개 reviewer 가 독립 검증**했다. side_effect 는 `interactionType × bc` 전 조합 진리표로 if/else-if → 삼항 재구조화가 완전 동치임을 보였고, security 는 redaction 3곳(`deepRedactSecrets(outputData)` → `nodeOutput`·`buttonConfig.{buttons,nodeOutput}`, `redactThreadForPublic` → `conversationThread`, `deepRedactSecrets` → `result`/`error`)이 값 조립 이전에 계산돼 우회 없음을 확인, api_contract 는 조립 로직 1:1 대응으로 breaking change 없음을 확인했다. `TransformInterceptor` 가 `class-transformer` 를 쓰지 않아(전역 `ClassSerializerInterceptor` 미등록) DTO 데코레이터 변경이 wire 에 영향을 주지 않는다는 점도 실증됐다.

## Warning (전부 조치)

### W1. `responses.dto.ts` 의 spec 상대링크 4곳이 off-by-one 으로 전부 깨짐
**documentation** · main 재검증 완료 (`os.path.exists`: 5단계 → `codebase/spec/...` MISSING, 6단계 → EXISTS)

`dto/` 에서 저장소 루트까지는 6단계(`dto→external-interaction→modules→src→backend→codebase`)인데 `../../../../../`(5단계)를 썼다. 형제 파일 `responses.dto.spec.ts` 는 6단계로 정확 — 명백한 버그. `spec-link-integrity.test.ts` 는 backend 소스를 스캔하지 않아 자동 가드가 못 잡는다.
→ **조치**: 4곳 6단계로 정정.

### W2. `WaitingContextBaseDto`(abstract, 비-export) vs `WaitingContextBase`(export type) 근접 동명 쌍
**maintainability**

접미사 `Dto` 하나 차이라 혼동. 게다가 `WaitingContextBase` 는 논리적 부모가 아니라 **형제 variant** `NodeOutputContextDto` 에서 `Pick` 한다(부모가 비-export 라 우회) — 향후 한쪽 variant 가 필드를 override 하면 조용히 어긋난다. abstract class 를 export 해도 TS 상 문제 없고(구조적 타이핑, 객체 리터럴 대입에 `new` 불필요), 기존 관례(`PaginationQueryDto`)도 "공유 베이스는 그냥 export".
→ **조치**: `WaitingContextBaseDto` 를 export 하고 `WaitingContextBase` alias 제거. 서비스는 base 클래스 타입으로 직접 annotate.

### W3. `expect(context.type).not.toBe('object')` — 약한 negative assertion
**testing** (pre-change DTO 스왑 실측: 15건 중 13건 FAIL 확인)

`context.type` 의 실제 값은 `undefined`. `not.toBe('object')` 는 어떤 값이 와도 통과하고, 바로 위 `oneOf` exact-match 가 이미 같은 회귀를 더 정밀하게 잡는다.
→ **조치**: `toBeUndefined()` 로 강화.

### W4. `currentNode.allOf ?? [{ $ref: currentNode.$ref }]` — 영구 도달 불가 fallback
**testing** (실측: `@nestjs/swagger` ^11.2.7 은 `description` 이 있으면 `$ref` 를 항상 `allOf` 로 wrap)

tautology 는 아니나 `??` 우측은 죽은 분기.
→ **조치**: 실측 확정 shape(`allOf`)을 직접 단언.

### W5. 테스트 커버리지 갭 2건
**testing**

(a) 신규 `conversationThread` 부재 테스트가 기존 테스트와 **실질 중복**(동일 fixture `ai_conversation` + `conversationThread: null`). 미커버 조합은 `buttons` variant + thread 부재.
(b) 본 PR 의 핵심 대상인 **`buttons`/`buttonConfig` variant 의 e2e 커버리지 전무** — `external-interaction.e2e-spec.ts` 는 `ai_conversation` 만 커버(`buttonConfig` grep 0건).
→ **조치**: (a) 중복 테스트를 `buttons` + thread 부재 조합으로 교체. (b) 실 HTTP + DB round-trip 으로 `buttonConfig` variant 선택을 검증하는 e2e 신규 추가.

## 주목할 Info

- **stale base 아티팩트** (requirement · documentation 2인 독립 검출): 리뷰 시점 diff 에 `spec/7-channel-web-chat/1-widget-app.md` §R7 삭제가 나타났으나, 이는 우리 두 커밋이 건드리지 않은 파일이고 분기 이후 **PR #899(`52f46f95f`)가 origin/main 에 먼저 병합**된 결과였다. → main 이 확인 후 `origin/main` 으로 rebase 완료 (충돌 없음, #899 는 내 spec 3파일과 무접점).
- **testing**: 신규 15건 중 pre-change DTO 에서 **13건이 실제로 FAIL** 함을 스왑 실측으로 확인. `discriminator` 재도입 가드도 실제로 `discriminator` 를 넣어 FAIL 함을 실측. `interaction.service.spec.ts` 신규 2건은 pre-change 에서도 PASS — 회귀 검출용이 아니라 기존 동작의 characterization 테스트(런타임 무변경이므로 의도된 성질).
- **architecture**: `abstract` base 의 `@ApiProperty` 상속이 정상 동작함을 실제 OpenAPI 문서 빌드로 확인(`ButtonsContextDto.required = [interactionType, waitingNodeId, buttonConfig]`). base 를 `@ApiExtraModels` 에 등록하지 않아 phantom 스키마도 없다.
- **scope**: 요청 범위 밖으로 보이는 5개 추가(`CurrentNodeDto`·`result`/`error` nullable·§5.3 예시 정정·swagger.md 개정·getStatus 재구성) 전부가 (a) 규약 위반 없이 요청을 이행하기 위한 필수 선행, (b) 신규 불변식과 즉시 충돌했을 기존 부정확성 해소, (c) `/consistency-check` 게이트가 사전 의무화한 항목으로 추적됨. revert 권고 0건.
- **api_contract [INFO]**: variant 에 `additionalProperties: false` 가 없어 `oneOf` 상호배타가 스키마 레벨로 강제되지 않는다. 실제 조립부가 두 키를 동시에 싣는 분기가 없어 실질 위험 없음 — 비차단, 미조치.
- **maintainability [INFO]**: `getStatus` 가 길다(≈115줄). `buildWaitingContext()` private 헬퍼 추출은 다음 관련 변경 시 후보. 본 PR 강제 아님.

## 후속 (본 PR 밖, plan 등재)

- `external-interaction` 모듈 `dto/responses.dto.ts` flat → `dto/responses/` 이관 (swagger.md §5-1, 25개 모듈 중 유일 미준수).
- 위젯 `eia-types.ts` `ExecutionStatus.context` 를 variant union 으로 좁히기 (backend 만 정밀화된 비대칭).
