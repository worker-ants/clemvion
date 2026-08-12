# 요구사항(Requirement) 리뷰 — 멱등 캐시 키 execution+route 스코프 (Spec EIA §R8)

## 검토 범위
- `CHANGELOG.md`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- `codebase/backend/test/external-interaction.e2e-spec.ts`
- `plan/complete/spec-draft-eia-idempotency-key-scope.md` (신규, 완료), `plan/in-progress/spec-draft-eia-idempotency-key-scope.md` (삭제, 이동)
- `review/code/2026/08/12/21_02_30/**` (직전 라운드 리뷰 산출물 — RESOLUTION.md 기준 WARNING 3건 전부 조치됨)

대조 spec: `spec/5-system/14-external-interaction-api.md` §R8 "캐시 키 스코프"(EIA-IN-11 L81, EIA-RL-02 L140), `spec/data-flow/15-external-interaction.md` §1.2 시퀀스(L93·L98)·§2.2 Redis 키 표(L258).

## 검증 방법
- 현재 소스(`idempotency.interceptor.ts`)를 직접 `Read` 하여 diff 게이트가 아니라 실 파일 줄 번호로 로직 재확인.
- `spec/5-system/14-external-interaction-api.md`, `spec/data-flow/15-external-interaction.md` 를 `grep` 으로 열어 spec 본문과 코드의 문자열을 직접 대조.
- `npx jest src/modules/external-interaction/idempotency.interceptor.spec.ts` 직접 실행 — **29/29 통과** 재현.
- `interaction.guard.ts` 를 열어 `ExternalInteractionRequestContext.executionId: string`(항상 non-empty, Guard 가 빈 값이면 401 throw) 확인 — 인터셉터의 `!executionId` 분기가 "Guard 미적용" 상태만 잡는다는 주석 주장을 실코드로 재확인.
- `interaction.service.ts` 에서 `GoneException`+`EXECUTION_TERMINATED` 던지는 두 지점(L253, L431) 확인 — e2e `IDEM-4` fixture("terminal execution 은 어떤 명령이든 410")의 전제가 실제 서비스 로직과 일치함을 검증.

## 발견사항

없음. (CRITICAL/WARNING 없음)

## 참고 (INFO)

- **[INFO]** spec 문서와 구현이 line-level 로 정확히 일치
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 내 `const executionId = req.interaction?.executionId;`, `const route = context.getHandler().name;`, `` const redisKey = `${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}`; ``
  - 상세: `spec/data-flow/15-external-interaction.md:258` 의 Redis 키 표가 `interaction:idempotency:<executionId>:<route>:<key>` 를 그대로 요구하고, `spec/5-system/14-external-interaction-api.md:1061` (§R8 Rationale "캐시 키 스코프")가 `<route>` 의 값 도메인(`interact`\|`cancel`)·출처(`InteractionGuard` 가 합성한 값)까지 명시한다. 코드가 그 형식·출처·값 도메인을 그대로 구현한다. EIA-IN-11(L81)·EIA-RL-02(L140) 요구사항 문구("동일 execution·동일 route 안에서")도 구현의 실제 스코프 단위와 정확히 일치.
  - 제안: 없음(정보성 확인).

- **[INFO]** `req.interaction` 부재 시 fallback-없음 정책이 spec·다른 실패 경로와 일관
  - 위치: `idempotency.interceptor.ts` `intercept()` 의 `if (!executionId) { ... return next.handle(); }` 분기
  - 상세: 전역 키로 떨어지지 않고 캐시 자체를 skip(+warn) 하는 설계가 spec §R8 Rationale 의 "구현 인계 — ctx 부재 시의 처분"(스코프 없는 전역 키로 fallback 하지 않는다)과 정확히 일치하며, 이 인터셉터의 다른 fail-open 경로(Redis 미주입·GET/SET 실패·직렬화 실패)와 동일한 정책 형태를 유지한다. `RequestWithInteraction.interaction.executionId` 타입이 항상 non-empty string(Guard 가 빈 값이면 401)이므로 이 분기는 "Guard 미적용" 케이스에만 실질 도달하는 방어 코드이고, 테스트(`makeContext({ executionId: null })`)가 그 상태를 `undefined`(기본값 주입)와 명시적으로 구분해 흉내낸다.
  - 제안: 없음(정보성 확인).

- **[INFO]** 두 파손 축(execution/route)이 unit 4건 + e2e 2건으로 대칭 커버되고, e2e 는 상태코드가 실제로 갈리는 fixture 를 쓴다
  - 위치: `idempotency.interceptor.spec.ts` 의 `describe('IdempotencyInterceptor — 캐시 키 스코프 (Spec EIA §R8)')` / `external-interaction.e2e-spec.ts` 의 `IDEM-4`·`IDEM-5`
  - 상세: `IDEM-4` 는 A=terminal(410)·B=waiting_for_input(202)으로 상태 자체를 다르게 둬서 "레이아웃만 맞고 실제 피해(남의 응답 수신)는 못 본다"는 함정을 피했고, `IDEM-5` 는 `CancelDto` all-optional 특성으로 인한 실제 hash 충돌(`{command:'cancel'}` 이 interact 에선 정상 명령·cancel 에선 `forbidNonWhitelisted` 400)을 재현한다. 두 e2e 모두 "행동(상태코드) 단언" 을 "키 레이아웃 단언" 보다 앞에 둬 뮤테이션 실측(플랜 문서에 기록됨)으로 판별력을 확인했다. `interaction.service.ts:253,431` 의 `GoneException`+`EXECUTION_TERMINATED` throw 지점을 직접 확인해 IDEM-4 의 전제("terminal execution 은 어떤 명령이든 410")가 실제 서비스 로직과 맞음을 검증했다.
  - 제안: 없음(정보성 확인).

- **[INFO]** `spec/5-system/4-execution-engine.md` §9.1/§9.2 Redis 키 레지스트리에 `interaction:idempotency:*` 가 아직 등재돼 있지 않음
  - 위치: 해당 없음(spec 문서, 코드 변경 아님)
  - 상세: 이 갭은 이번 diff 이전부터 있었고(EIA 계열 Redis 키 전부가 §9.1/§9.2 표에 미등재), `plan/complete/spec-draft-eia-idempotency-key-scope.md` Rationale 말미가 "선재이자 더 넓은 갭이라 별도 항목으로 등재한다"고 명시적으로 범위 밖 처리와 후속 등재를 기록해 뒀다. 이번 diff 의 요구사항 충족을 막는 요소가 아니다.
  - 제안: 없음 — 이미 별도 후속 항목으로 추적 중.

- **[INFO]** 직전 라운드(`21_02_30`) 리뷰의 requirement WARNING/CRITICAL 은 이번 라운드에도 재현되지 않음
  - 위치: `review/code/2026/08/12/21_02_30/RESOLUTION.md`
  - 상세: 직전 라운드는 requirement 관점에서 WARNING/CRITICAL 없이 INFO 4건만 냈고(당시 requirement.md), 그 라운드의 WARNING 3건(테스트 헬퍼 인자 순서, GET/SET 비대칭 단언, 모듈 docstring stale)은 다른 카테고리(maintainability/testing/documentation) 소관이었으며 RESOLUTION.md 에 따라 전부 조치되어 현재 소스에 반영돼 있음을 직접 확인(`scopedKey(executionId, rawKey, route)` 순서 통일, route 축 테스트에 `redis.set` 단언 추가, 모듈 docstring 4번째 describe 색인).
  - 제안: 없음.

## SPEC-DRIFT

없음. spec 은 이미 이 구현을 앞서 반영해 뒀고(코드가 spec 을 따라가는 정상 순서), 코드-spec 사이에 line-level 불일치가 없다.

## 요약

`interaction:idempotency:<key>` → `interaction:idempotency:<executionId>:<route>:<key>` 로의 캐시 키 스코프 확장은 `spec/5-system/14-external-interaction-api.md` §R8·EIA-IN-11·EIA-RL-02, `spec/data-flow/15-external-interaction.md` §1.2·§2.2 와 필드명·값 도메인·fallback 정책까지 line-level 로 정확히 일치한다. execution 축·route 축 두 파손 지점이 unit(4건)·e2e(2건)로 각각 독립 고정돼 있고, e2e 는 상태코드가 실제로 갈리는 fixture(terminal 410 vs waiting 202, route 별 400/410)로 "레이아웃만 맞고 행동은 안 맞는" 뮤턴트까지 검출하도록 단언 순서가 설계돼 있다. `req.interaction` 부재 시 전역 키로 fallback 하지 않고 캐시를 skip하는 정책도 spec·인접 실패 경로(Redis 미가용 등)와 일관되며 회귀 테스트로 고정됐다. TODO/FIXME 류 미완성 표식은 관련 3개 소스 파일에서 발견되지 않았고, 모든 분기가 적절한 값(캐시된 응답 재현 / next.handle() 통과 / 409 예외)을 반환한다. 직전 라운드 리뷰(`21_02_30`)가 지적한 WARNING 3건은 모두 조치돼 있음을 소스에서 직접 확인했다. §9.1/§9.2 Redis 키 레지스트리 미등재는 이 diff 이전부터 있던 더 넓은 갭으로 별도 후속 항목으로 이미 추적 중이라 이번 변경의 결함이 아니다.

## 위험도
NONE
