# 요구사항(Requirement) 리뷰 — 멱등 캐시 키 execution+route 스코프 (Spec EIA §R8)

## 검토 범위
- `CHANGELOG.md` (Unreleased 항목 추가)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- `codebase/backend/test/external-interaction.e2e-spec.ts`

대조 spec: `spec/5-system/14-external-interaction-api.md` §R8 "캐시 키 스코프", `spec/data-flow/15-external-interaction.md` §2.2 Redis 키 표. 대조 plan(완료): `plan/complete/spec-draft-eia-idempotency-key-scope.md`.

## 발견사항

- **[INFO]** spec 문서(`spec/5-system/14-external-interaction-api.md` §R8, `spec/data-flow/15-external-interaction.md` §2.2)와 구현이 line-level 로 정확히 일치한다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:100` (`const executionId = req.interaction?.executionId;`), `:113`(`const route = context.getHandler().name;`), `:115`(`` const redisKey = `${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}`; ``)
  - 상세: spec 이 규정한 키 형식 `interaction:idempotency:<executionId>:<route>:<key>`, `<route>` 값 도메인(`interact`|`cancel`, 출처는 `context.getHandler().name`), "`req.interaction` 이 없으면 전역 키 fallback 없이 캐시를 건너뛴다"(§R8 본문), "스코프 단위는 토큰이 아니라 execution"(§R8 Rationale) 이 모두 구현과 정확히 일치한다. `interaction.controller.ts` 에서 `interact`/`cancel` 두 핸들러만 `@UseInterceptors(IdempotencyInterceptor)` 를 달고 있어 route 값 도메인이 실제로 닫혀 있음을 확인(`refreshToken`/`getStatus` 는 인터셉터 미적용). `InteractionGuard` 가 `@UseGuards()` 로 컨트롤러 레벨에 걸려 NestJS 파이프라인상 인터셉터보다 먼저 실행되므로 `req.interaction` 이 인터셉터 진입 시점에 이미 채워져 있다는 전제도 유효하다.
  - 제안: 없음(정보성 확인).

- **[INFO]** 두 축(execution/route)의 엣지 케이스가 단위 테스트 4건 + e2e 2건으로 대칭 커버된다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (`describe('IdempotencyInterceptor — 캐시 키 스코프 (Spec EIA §R8)')`, 대략 게이트 796~941 구간) / `codebase/backend/test/external-interaction.e2e-spec.ts` 게이트 571~692 (`IDEM-4`, `IDEM-5`)
  - 상세: execution 축(다른 executionId → 다른 캐시 엔트리, GET·SET 둘 다 스코프), route 축(같은 execution 이라도 interact/cancel 분리, `bodyHash` 충돌 상황 재현), ctx 부재 시 fallback 없이 skip(+warn 로그 텍스트 단언), 캐시 hit 이 스코프 키에서만 발생 — 이 네 가지가 각각 독립 테스트로 고정돼 있다. e2e 두 건은 상태코드가 실제로 갈리는 fixture(terminal 410 vs waiting 202, route 별 다른 검증 결과)를 써서 "키 레이아웃만 맞고 실제 피해는 관측 못 하는" 함정을 피했고(`8316c8981` 커밋에서 단언 순서를 행동→레이아웃으로 뒤집어 뮤테이션 생존을 닫음), 현재 코드도 그 순서(`fromB.status`/`viaCancel.status` 단언이 키 존재 단언보다 먼저)를 유지하고 있다.
  - 제안: 없음(정보성 확인).

- **[INFO]** `req.interaction` 부재 시 fallback-없음 경로가 fail-open 정책과 일관되게 구현·테스트됐다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:101-109`
  - 상세: 스코프를 만들 수 없으면 전역 키로 떨어지지 않고 `next.handle()` 로 즉시 통과(+warn), 이는 이 인터셉터의 다른 실패 경로(Redis 미주입·GET/SET 실패·직렬화 실패)와 동일한 fail-open 형태로 CHANGELOG·spec §R8 본문 마지막 문단과 정확히 일치한다. `RequestWithInteraction.interaction` 타입이 항상 `executionId: string`(빈 문자열 아님, Guard 가 빈 값이면 401 throw)이라 실제 런타임에서 이 분기는 "Guard 미적용" 케이스에만 도달하는 방어적 경로이며, 테스트가 `executionId: null` 로 그 상태를 명시적으로 흉내낸다(`undefined` 와 구분).
  - 제안: 없음(정보성 확인).

- **[INFO]** `spec/5-system/4-execution-engine.md` §9.2 Redis 키 레지스트리에 `interaction:idempotency:*` 키가 아직 등재돼 있지 않다.
  - 위치: 해당 없음(spec 문서, 코드 변경 아님)
  - 상세: 이 갭은 이번 diff 이전부터 있었고(EIA 계열 Redis 키 전부가 §9.1/§9.2 표에 없음), `plan/complete/spec-draft-eia-idempotency-key-scope.md` Rationale 말미가 "선재이자 더 넓은 갭이라 별도 항목으로 등재한다"고 명시적으로 범위 밖 처리·후속 등재를 기록해 뒀다. 이번 diff 의 요구사항 충족을 막는 요소가 아니다.
  - 제안: 없음 — 이미 별도 후속 항목으로 추적 중(수정 불필요).

## 요약
`interaction:idempotency:<key>` → `interaction:idempotency:<executionId>:<route>:<key>` 로의 캐시 키 스코프 변경은 `spec/5-system/14-external-interaction-api.md` §R8 "캐시 키 스코프"·`spec/data-flow/15-external-interaction.md` §2.2 Redis 키 표와 필드·값 도메인·fallback 정책까지 line-level 로 일치한다. execution 축·route 축 두 파손 지점이 각각 독립 unit(4건)·e2e(2건) 테스트로 고정돼 있고, e2e 는 상태코드가 실제로 갈리는 fixture 로 "레이아웃만 맞고 행동은 안 맞는" 뮤턴트까지 검출하도록 단언 순서가 설계돼 있다(직전 커밋에서 실측 보강됨). `req.interaction` 부재 시 전역 키로 fallback 하지 않고 캐시를 skip하는 정책도 spec·인접 실패 경로(Redis 미가용 등)와 일관되며 회귀 테스트로 고정됐다. TODO/FIXME 류 미완성 표식, 반환값 누락, 검증되지 않은 에러 경로는 발견되지 않았다. §9.1/§9.2 Redis 키 레지스트리 미등재는 선재하는 더 넓은 갭으로 이미 별도 후속 항목으로 추적 중이라 이번 변경의 결함이 아니다.

## 위험도
NONE
