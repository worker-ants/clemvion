# 테스트(Testing) Review

## 검증 방법

- `idempotency.interceptor.spec.ts`, `idempotency.interceptor.ts`, `external-interaction.e2e-spec.ts` 전문을 `Read`로 직접 열어 diff 게이트 번호와 대조.
- `npx jest src/modules/external-interaction/idempotency.interceptor.spec.ts` 실제 실행 → **29 passed, 29 total** 확인 (RESOLUTION.md 주장과 일치).
- `interaction.controller.ts`(`interact`/`cancel` 핸들러명), `cancel.dto.ts`(전 필드 optional), `interact.dto.ts`(`INTERACT_COMMANDS`에 `'cancel'` 포함), `interaction.service.ts`(410 `GoneException` 발생 지점), 전역 `ValidationPipe`(`whitelist+forbidNonWhitelisted`) 를 직접 열어 e2e `IDEM-4`/`IDEM-5` 의 판별 시나리오(410 vs 202, 400 VALIDATION_ERROR)가 실제 코드 경로와 일치하는지 대조.
- `npx tsc --noEmit` — 리뷰 대상 4개 파일 관련 타입 에러 없음 확인. 나머지 tsc 에러(`interaction-token.service.spec.ts`, `interaction.service.spec.ts`)는 이 diff 밖 파일이며 `git diff origin/main...HEAD` 로 무변경 확인 — 회귀 아님.

## 발견사항

- **[INFO]** 유닛 "route 축" 테스트는 키 레이아웃(GET/SET 인자)만 단언하고, 실제 캐시 hit 시 반환값이 route 별로 갈리는지(행동 단언)는 이 블록에서 확인하지 않는다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — `describe('IdempotencyInterceptor — 캐시 키 스코프 (Spec EIA §R8)')` 내 `it('route 축 — 같은 execution 이라도 interact 와 cancel 은 분리된다', ...)` (게이트 854)
  - 상세: 이 mock 은 `redis.get` 이 항상 `null` 을 반환하도록 고정돼 있어(`makeRedis()` 기본값), route 세그먼트를 제거하는 뮤턴트를 넣어도 이 mock 환경에서는 어차피 캐시 미스 → `next.handle()` 경로라 반환값 자체는 변하지 않는다. 즉 이 테스트가 회귀를 잡는 유일한 수단은 키 문자열 비교이며, 이는 설계상 불가피하다(실제 hit/miss 를 가르려면 in-memory stub 이 필요한데 그건 execution 축의 "캐시 hit 재현" 테스트와 e2e `IDEM-5` 가 이미 커버). docstring 도 "이 블록의 `getHandler()` 는 mock 이 만들어 낸 것이라 실 파이프라인의 route 이름은 검증할 수 없다 — 그 자리는 e2e `IDEM-5` 다" 라고 스스로 그 한계를 적어 뒀다.
  - 제안: 조치 불필요. 이미 e2e `IDEM-5`(`external-interaction.e2e-spec.ts` 게이트 644 부근)가 실제 Redis + 실 파이프라인으로 route 축의 행동(410 vs 400 VALIDATION_ERROR)을 판별력 있게(행동 단언을 키 레이아웃 단언보다 먼저 배치) 고정하고 있어 이 갭은 이미 메워져 있다. 기록 목적의 INFO.

- **[INFO]** `executionId` 가 빈 문자열(`''`)인 경우의 유닛 테스트가 없다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:100-101` (`const executionId = req.interaction?.executionId; if (!executionId) {...}`)
  - 상세: `makeContext` 의 `executionId` 옵션은 `undefined`(기본값 사용) 또는 `null`(ctx 부재) 두 갈래만 테스트한다. 빈 문자열은 `!executionId` 로 동일하게 skip 분기를 타므로 프로덕션 로직상 안전하지만, `InteractionGuard` 가 항상 non-empty 값을 합성한다는 전제에 기대는 것이라 그 전제가 깨지면(가드 리팩터 등) 조용히 통과할 수 있다.
  - 제안: 우선순위 낮음. `InteractionGuard.canActivate` 가 `executionId` 부재 시 401 로 먼저 막으므로 실질적으로 도달 불가능한 상태. 조치 불필요, 참고용.

## 정성 평가 (positive findings)

- 직전 라운드(`21_02_30`)에서 testing 카테고리 WARNING #2("route 축 테스트가 GET 만 단언하고 SET route 스코프는 누락")가 이번 diff 에서 실제로 조치됐음을 코드로 확인 — `route 축` 테스트에 `setKeys` 단언이 추가돼 있다(게이트 883-887). RESOLUTION.md 가 주장하는 뮤테이션 사살(GET 스코프 유지·SET 만 전역 키로 만드는 뮤턴트 투입 → 2 테스트 RED)도 현재 테스트 구조(정확한 `toEqual` 배열 비교, `stringContaining` 아닌 exact 키)와 논리적으로 부합한다.
- e2e 신규 2건(`IDEM-4` execution 축, `IDEM-5` route 축)은 판별력 있는 fixture 설계다 — A(410)/B(waiting_for_input→202)처럼 상태 자체가 갈리는 실행을 골라 "레이아웃만 통과하고 실제 피해는 못 잡는" 함정을 피했고, 주석에 "행동 단언을 키 레이아웃 단언보다 먼저 배치해야 한다"는 근거(뮤테이션 실측 — white-box 단언에서 먼저 죽어 행동 단언에 도달 못 했던 경험)까지 남겨, 저장소의 반복 교훈(`feedback_mutation_validity_and_discriminating_input.md`)을 정확히 반영했다.
- `CancelDto`(전 필드 optional) + 전역 `forbidNonWhitelisted` + `InteractDto.INTERACT_COMMANDS` 에 `'cancel'` 포함 + `interaction.service.ts` 의 410 발생 지점을 직접 대조한 결과, `IDEM-4`/`IDEM-5` 의 기대 상태코드(410/202/400)는 실제 프로덕션 분기와 정합한다 — 테스트가 상상의 시나리오가 아니라 실제로 도달 가능한 경로를 겨냥한다.
- `makeContext` mock 의 `getHandler()` 가 진짜 이름 붙은 함수를 반환하도록 설계돼 있어(`{ [routeName]: () => undefined }[routeName]`), `getHandler().name` 이 아닌 다른 경로로 route 를 얻는 회귀까지 덮는다 — mock 과 실제 동작의 괴리를 의식적으로 좁힌 설계.
- warn 로그 단언(`Logger.prototype.warn` spy, `try/finally mockRestore`)이 fail-open 계열 테스트 전반에 일관되게 적용돼 있고, "ctx 부재" 신규 테스트도 같은 패턴을 따른다 — 테스트 격리 위반 없음(각 `it` 이 독립된 `makeRedis()`/interceptor 인스턴스 사용).
- `nest build` = 순수 tsc(minifier 없음)라는 `getHandler().name` 신뢰 전제가 코드 주석 + e2e `IDEM-5` 캐너리로 명시적으로 방어돼 있다 — "문서한 보장이 실제보다 넓다"는 이 저장소의 반복 결함 패턴을 이번엔 사전에 닫았다.
- 회귀 테스트: 기존 `stringContaining('interaction:idempotency:key-1')` 단언을 정확한 `scopedKey(...)` 로 교체(게이트 187) — 스코프 세그먼트가 빠져도 통과하던 느슨한 단언을 정밀화했고, e2e 의 기존 3개 관측점(라인 425/495/538 부근)도 전부 `idempotencyCacheKey()` 헬퍼로 갱신돼 있어 3-세그먼트 포맷과 실제로 동기화됐다(직접 `Read` 로 확인).

## 요약

리뷰 대상 diff 는 이미 한 차례 `code-review` 사이클(`21_02_30`)을 거쳐 testing 카테고리 WARNING(#2 GET/SET 비대칭 단언)을 조치한 상태이며, 그 조치가 코드 레벨에서 실제로 반영됐고 뮤테이션 근거도 구조적으로 타당함을 확인했다. 유닛 29건 전체 실행 결과 GREEN, e2e 신규 2건(`IDEM-4`/`IDEM-5`)은 판별력 있는 fixture 와 "행동 단언 우선" 순서로 설계돼 이 저장소가 과거 반복했던 vacuous-assertion 함정을 피했다. 프로덕션 DTO/컨트롤러/서비스 코드를 직접 대조한 결과 e2e 시나리오의 기대 상태코드도 실제 분기와 정합한다. 남은 갭은 전부 INFO 수준(유닛 route-축 테스트가 키 레이아웃에 한정 — e2e 가 메움, executionId 빈 문자열 미검증 — 도달 불가능)이며 병합을 막을 사유가 아니다.

## 위험도
NONE
