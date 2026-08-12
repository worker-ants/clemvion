STATUS=success

===REPORT_MARKDOWN_BELOW===

# 부작용(Side Effect) Review — 멱등 캐시 키 스코프(execution + route) + `21_02_30` 조치 반영본

이번 라운드는 이전 라운드(`21_02_30`)와 동일한 프로덕션 변경(`IdempotencyInterceptor`)에 더해,
그 라운드의 WARNING 3건 조치(테스트 헬퍼 인자 순서 통일, route 축 SET 단언 추가, 모듈 docstring
갱신)와 `plan/` 문서 이동·`review/code/2026/08/12/21_02_30/**` 산출물 커밋을 포함한 전체 diff를
대상으로 한다. 프로덕션 로직(`idempotency.interceptor.ts`) 자체는 이전 라운드와 동일하다.

## 발견사항

- **[INFO]** ctx 부재 경로에 신규 `Logger.warn` 호출 — 매 요청마다 발생 가능한 로그 부작용, 현재는 도달 불가
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:105-108` (`this.logger.warn(...)` → `return next.handle();`)
  - 상세: `req.interaction`(Guard 가 세팅)이 없으면 매 요청마다 `warn` 로그를 남기고 캐시를 건너뛴다. `IdempotencyInterceptor` 의 유일한 두 소비처(`interaction.controller.ts:66,112` — `interact`/`cancel`)는 둘 다 클래스 레벨 `@UseGuards(InteractionGuard, InteractionRateLimitGuard)`(`interaction.controller.ts:58`)가 걸려 있어 Guard 가 인터셉터보다 항상 먼저 돈다 — 정상 배선에서는 이 분기가 사실상 도달 불가능이라 로그 폭주 같은 실질 부작용은 없다. `IdempotencyInterceptor` grep 결과 소비처가 이 두 라우트로 한정됨을 재확인했다.
  - 제안: 조치 불필요. 향후 Guard 가 없는 라우트에 이 인터셉터를 재사용할 때만 재검토(이미 SUMMARY INFO #7 로 처분·유예됨 — 재확인).

- **[INFO]** 캐시 키 포맷 변경으로 배포 시점 기준 구-포맷 Redis 엔트리가 고아화
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:121` (`const redisKey = \`${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}\`;`)
  - 상세: `interaction:idempotency:<key>` → `interaction:idempotency:<executionId>:<route>:<key>` 로 키 형태가 바뀌어, 배포 직전까지 구 포맷으로 적재된 엔트리는 새 코드가 절대 조회하지 않는다. 데이터 오염은 아니고 TTL(24h)로 자연 만료된다. 이번 라운드에서 CHANGELOG.md:30-32 에 "배포 전환기" 문단이 추가되어 이 갭이 명시적으로 문서화됐다(이전 라운드는 INFO 로만 지적, 이번엔 이미 반영됨).
  - 제안: 추가 조치 불필요 — 이미 문서화 완료.

- **[INFO]** `route` 축이 런타임 함수 이름(`context.getHandler().name`)에 의존 — 빌드 파이프라인 전제
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:119` (`const route = context.getHandler().name;`)
  - 상세: `nest build`(순수 `tsc`, minifier 없음) 전제 하에서만 안전하다는 점이 주석(`:114-118`)에 명시돼 있고, 그 전제가 깨지면 e2e `IDEM-5`(`codebase/backend/test/external-interaction.e2e-spec.ts:644`)가 실 파이프라인에서 RED 로 알리도록 캐너리가 마련돼 있다. 단위 mock(`idempotency.interceptor.spec.ts` 의 `makeContext`)은 `getHandler()` 를 자체 구성하므로 이 전제를 검증하지 못한다는 한계도 문서화됨(`idempotency.interceptor.spec.ts:99-100`).
  - 제안: 조치 불필요. 향후 세 번째 컨트롤러가 이 인터셉터를 재사용할 때만 재검토.

- **[INFO]** `intercept()` 의 `getRequest<T>()` 제네릭 타입 인자가 `Request` → `RequestWithInteraction` 로 변경 — 런타임 시그니처 불변
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:18`(`import type`), `:92`(`getRequest<RequestWithInteraction>()`)
  - 상세: `import type` + 제네릭 인자 교체뿐이라 `intercept(context, next): Observable<unknown>` 이라는 `NestInterceptor` 런타임 계약은 그대로다. `RequestWithInteraction`(`interaction.guard.ts:71`, `Request` 를 extend 하고 optional `interaction` 필드만 추가하는 상위 호환 타입)을 `interaction.guard.ts`/`interaction.controller.ts`/`interaction-stream.controller.ts` 가 이미 동일하게 쓰고 있어 새 패턴이 아니다. `interaction.guard.ts` 는 `idempotency.interceptor.ts` 를 참조하지 않아(grep 확인) 순환 의존도 없다.
  - 제안: 없음.

- **[INFO]** 테스트 공유 fixture `makeContext()` 의 기본 동작 변경이 파일 내 기존 모든 호출부에 소급 적용됨
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:102-134` (`makeContext`), 특히 `:114-115`(`executionId` 기본값 주입), `:121-124`(`interaction` 필드 spread)
  - 상세: `executionId` 를 명시하지 않은 기존 호출부(예: `:179` `makeContext({ idempotencyKey: 'key-1', body: { a: 1 } })`)는 이제 자동으로 `interaction: { executionId: 'exec-aaa', tokenFamily: 'iext' }` 를 받는다. 이 diff 이전에는 `req.interaction` 자체를 인터셉터가 읽지 않았으므로 이 변화는 프로덕션 계약 변경(§R8 스코프 도입)을 정확히 뒤따르는 필수 갱신이며, 부작용이 아니라 의도된 동기화다. 다만 **공유 헬퍼 하나의 기본값 변경이 파일 전역의 모든 기존 테스트 동작에 영향**을 준다는 점은 side-effect 관점에서 기록해 둔다 — 검증: 기존 W-4/캐시 히트/fail-open 세 describe 블록의 단언이 `scopedKey(DEFAULT_EXECUTION_ID, ...)` 로 일관되게 갱신돼 있어(`:187` 등) 회귀 없이 반영됐다.
  - 제안: 없음(확인 완료).

## 확인했으나 문제 없음

- `REDIS_KEY_PREFIX`(`'interaction:idempotency:'`) 상수 불변 — 신·구 키 모두 같은 접두 유지, 접두 기반 소비처 전수 grep 결과 없음.
- 새 전역 변수·모듈 레벨 mutable 상태 도입 없음(`DEFAULT_EXECUTION_ID`/`DEFAULT_ROUTE` 는 테스트 파일 스코프 `const`).
- 환경 변수 읽기/쓰기 변경 없음.
- 네트워크 호출 대상·횟수 변경 없음 — 기존 Redis `GET`/`SET` 호출 그대로, 키 값만 변경.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:935` 신규 `it`(ctx 부재 경로)의 `jest.spyOn(Logger.prototype, 'warn')` 은 `try/finally` 로 `mockRestore()` 되어 다른 테스트로 누출 없음(`:961-963`).
- `external-interaction.e2e-spec.ts` 의 신규 `IDEM-4`/`IDEM-5`(:571, :644)는 각각 `randomUUID()` 로 독립된 workflow/execution 을 생성해 다른 e2e 테스트와 DB row·Redis 키 네임스페이스 충돌이 없다.
- `plan/in-progress/spec-draft-eia-idempotency-key-scope.md` → `plan/complete/` 이동은 완전한 rename(구 경로에 잔존 없음, `find` 로 확인)이며 런타임에 소비되는 파일이 아니라 부작용 없음.
- `review/code/2026/08/12/21_02_30/**` 신규 파일 9건(RESOLUTION.md·SUMMARY.md·`*.md` 리뷰 산출물·`meta.json`·`_retry_state.json`)은 이 저장소 관례상 `review/` 가 gitignore 대상이 아니라 커밋되는 감사 기록이며, 런타임 코드 경로와 무관.
- `IdempotencyInterceptor` 는 `interaction.controller.ts` 의 `interact`/`cancel` 두 라우트에만 바인딩됨을 grep 으로 재확인 — 시그니처 변경의 호출자 영향 범위가 그 두 곳으로 한정.
- CHANGELOG.md 변경은 문서 전용, 런타임 부작용 없음. 인접 항목과의 구조(제목 레벨 `##`)도 깨지지 않음.

## 요약

이번 diff 의 실질 부작용은 Redis 캐시 키 네임스페이스를 의도적으로 좁히는 것(보안 수정 그 자체)이 유일하며, 배포 전환기 고아 엔트리는 TTL 로 자연 소멸하고 CHANGELOG 에 명시됐다. `IdempotencyInterceptor` 는 여전히 `interact`/`cancel` 두 라우트로 소비 범위가 닫혀 있고, 전역 상태·환경 변수·네트워크 대상·공개 시그니처(호출자 관점)의 변화는 없다. `route` 축의 함수명 리플렉션 의존과 fail-open 로그 추가는 이전 라운드부터 일관되게 INFO 로 유지되는 낮은 위험의 잠재적 브리틀니스이며 캐너리(e2e IDEM-5)로 보강돼 있다. 이번 라운드에 추가된 테스트/문서 조치(WARNING 3건 반영)는 프로덕션 로직을 건드리지 않았고, 공유 테스트 fixture(`makeContext`) 기본값 변경은 프로덕션 계약 변경을 정확히 뒤따르는 의도된 동기화로 확인됐다. 신규 CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도

LOW
