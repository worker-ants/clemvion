# 유지보수성(Maintainability) 리뷰

## 리뷰 대상
- `CHANGELOG.md` (문서, "멱등 캐시 키를 execution + route 로 스코프" 항목 추가)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- `codebase/backend/test/external-interaction.e2e-spec.ts`

## 발견사항

- **[WARNING]** 거의 동일한 테스트 키-조립 헬퍼가 unit/e2e 두 파일에 각각 정의되어 있고, 두 required 문자열 파라미터의 **순서가 서로 반대**다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:68` (`function scopedKey(rawKey, executionId = DEFAULT_EXECUTION_ID, route = DEFAULT_ROUTE)`) vs `codebase/backend/test/external-interaction.e2e-spec.ts:129` (`function idempotencyCacheKey(executionId, rawKey, route = 'interact')`)
  - 상세: 두 헬퍼 모두 최종적으로 같은 포맷 문자열(`interaction:idempotency:${executionId}:${route}:${rawKey}`)을 조립하지만, `scopedKey` 는 `(rawKey, executionId, route)` 순서이고 `idempotencyCacheKey` 는 `(executionId, rawKey, route)` 순서다. 두 인자 모두 타입이 `string` 이라 TypeScript 가 순서 오류를 잡아주지 못한다. 같은 기능의 헬퍼를 파일 간에 옮겨 쓰거나 참고할 때(이번 PR 처럼 unit → e2e 로 같은 개념을 이식하는 경우가 실제로 있었다) 인자 순서를 착각해 조용히 잘못된 키를 단언하는 테스트를 작성할 위험이 있다.
  - 제안: 두 헬퍼의 인자 순서를 통일하거나(예: 둘 다 `(executionId, rawKey, route)`), 포지셔널 인자 실수를 원천 차단하도록 `{ executionId, rawKey, route }` 옵션 객체 시그니처로 통일하는 것을 고려.

- **[INFO]** `intercept()` 메서드가 이번 변경으로 스코프 키 산출 로직(약 19줄, `executionId` 파생 + early-return + `route` 파생)이 추가되며 더 길어졌다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:91`~`170` (`intercept`)
  - 상세: 이 클래스는 이미 `cacheTapped`/`storeEntry` 를 private 헬퍼로 분리해 관심사를 나누는 패턴을 쓰고 있다. 이번에 추가된 스코프 키 산출 블록(`executionId`/`route`/`redisKey` 계산 + 부재 시 조기 반환)도 같은 패턴을 따라 별도 private 메서드(예: `resolveScopedKey(req, context, rawKey): string | null`)로 뽑아내면 `intercept()` 본문이 "스코프 판정 → RxJS 파이프라인" 두 단계로 더 뚜렷이 나뉘어 가독성이 개선될 여지가 있다. 다만 early-return 가드로 중첩은 얕게(최대 2단) 유지되어 있고, 각 블록에 근거 주석이 충실히 달려 있어 차단 수준은 아니다.
  - 제안: 향후 이 메서드에 스코프 축이 추가되면(예: 세 번째 축) 분리 검토.

- **[INFO]** `route` 값이 `context.getHandler().name`(런타임 함수 이름)에서만 파생된다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:113`
  - 상세: 하드코딩된 라우트 enum 대신 함수 이름에 의존하는 선택은 주석(§110-112)에 근거가 명시돼 있고, unit 테스트가 `{ name }` 리터럴로 흉내낸 mock 을 명시적으로 배제(`makeContext` JSDoc, `interceptor.spec.ts:86-87`)하고 e2e 테스트(IDEM-5)가 실 파이프라인에서 이 값을 고정하는 등 회귀 방지가 이미 갖춰져 있다. 순수 유지보수성 관점에서는 매직 문자열이 아니라 코드 자체의 이름에 암묵적으로 결속된다는 점만 인지 포인트로 남긴다 — 차단 사유는 아니다.

- **[INFO]** 스코프 키 포맷(`interaction:idempotency:<executionId>:<route>:<key>`)이 프로덕션 코드 1곳 + 테스트 헬퍼 2곳(위 WARNING 대상)에 각각 독립적으로 하드코딩되어 있다.
  - 위치: `idempotency.interceptor.ts:115`, `idempotency.interceptor.spec.ts:73`, `external-interaction.e2e-spec.ts:134`
  - 상세: 테스트가 프로덕션 로직을 다시 구현해 회귀를 잡는 것은 이 코드베이스의 의도된 패턴(주석에 "테스트가 손으로 문자열을 짜지 않게 한다" 명시)이라 나쁘지 않으나, 포맷이 바뀌면 3곳을 동기화해야 한다는 점은 남는다. 위 WARNING 의 인자 순서 통일과 함께, 필요하다면 두 테스트 헬퍼를 공유 테스트 유틸로 묶는 것도 고려할 수 있으나 unit/e2e 계층 분리 관례상 우선순위는 낮다.

전반적으로 이번 변경은 기존 클래스의 스타일(근거를 담은 상세 주석, early-return 가드, `Guard 가 세팅한 값만 신뢰` 같은 명시적 불변식 서술, private 헬퍼 분리 패턴)을 잘 따르고 있다. 네이밍(`executionId`/`route`/`redisKey`/`DEFAULT_EXECUTION_ID`/`DEFAULT_ROUTE`)은 목적을 명확히 드러내고, 매직 넘버는 새로 도입되지 않았다. 테스트 쪽은 `IDEM-N` 네이밍 컨벤션을 그대로 이어받아 일관성이 유지된다. `RequestWithInteraction` 타입을 새로 만들지 않고 `interaction.guard.ts` 의 기존 타입을 재사용한 점도 SoT 중복을 피한 좋은 선택이다.

## 요약
변경은 소규모이고 기존 코드 스타일(상세 근거 주석, early-return 가드, private 헬퍼 분리)을 일관되게 따르며 새로운 매직 넘버나 심각한 중첩·복잡도 증가는 없다. 유일하게 실질적인 지적은 unit/e2e 두 스펙 파일에 거의 동일한 키 조립 테스트 헬퍼가 인자 순서만 바뀐 채 따로 존재해 향후 복붙 실수의 소지가 있다는 점(WARNING)이며, 그 외에는 `intercept()` 길이 증가와 함수명 기반 라우트 파생에 대한 낮은 우선순위 인지 포인트(INFO)뿐이다. 병합을 막을 이유는 없다.

## 위험도
LOW
