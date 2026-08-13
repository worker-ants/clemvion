# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 스펙 파일이 1,426줄로 매우 커졌다 — 관심사별(캐시 히트/응답 형태, Redis 런타임 장애, 캐시 키 스코프, `readKey`/`hashBody` 경계값) 분리 여지
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1218` (신규 `describe('IdempotencyInterceptor — readKey / hashBody 경계값', …)` 시작, 파일은 1426줄로 종료)
  - 상세: 이번 diff 로 `describe` 블록이 5개(W-4 provider 경로 / 캐시 히트·응답 형태 방어 / Redis 런타임 장애 fail-open / 캐시 키 스코프 / readKey·hashBody 경계값)까지 늘어 파일 하나에 서로 다른 관심축이 누적됐다. 각 블록은 독립적이고 공유 헬퍼(`makeRedis`/`makeContext`/`makeCallHandler`/`scopedKey`/`bodyHashOf`)만 공유하므로 파일 분리 시 손실이 적다.
  - 제안: 지금 당장 급하지 않지만, 다음에 새 `describe` 축을 추가할 때는 `idempotency.interceptor.*.spec.ts` 형태로 관심사별 분리를 고려. 공유 헬퍼는 별도 `idempotency.interceptor.test-helpers.ts` 로 뽑으면 자연스럽게 나뉜다.

- **[INFO]** `jest.spyOn(Logger.prototype, 'warn').mockImplementation()` + `try/finally { warnSpy.mockRestore() }` 보일러플레이트가 파일 전체에 11회 반복(이번 diff 로 1회 추가)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1359` (신규 `it.each` 블록의 `warnSpy` 선언, 예: `'엔트리의 statusCode 가 HTTP 코드가 아니면(%s) 손상으로 보고 신규 처리'`) — 동일 패턴이 이미 파일 전역에 10회 더 존재
  - 상세: 각 자리마다 "단언 실패 시 `mockRestore()` 가 안 돌면 mock 이 뒤 테스트로 샌다"는 동일한 근거 주석을 반복해서 달고 있다(예: 519~528행 부근 주석). 로직 자체는 옳지만, 신규 인스턴스가 추가될 때마다 중복이 선형으로 늘어난다.
  - 제안: `withWarnSpy(async (warnSpy) => { … })` 같은 헬퍼로 `try/finally` + `mockRestore` 를 감싸면 각 테스트 바디가 짧아지고 "복원 누락" 클래스의 실수 여지도 원천적으로 줄어든다. 다만 이건 기존 스타일의 연장이라 이번 diff 단독 책임은 아니며, 파일을 다음에 만질 때 리팩터링 후보로 남겨도 무방하다.

- **[INFO]** `isHttpStatusCode()` 의 HTTP 상태 코드 범위 경계(100/599)가 이름 없는 리터럴
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:397-398`
  - 상세: `(value as number) >= 100 && (value as number) <= 599` — 바로 위 JSDoc(387~392행)이 그 의미(RFC 상태 코드 유효 범위)를 설명하고 있어 당장 오독 위험은 낮지만, 함수 시그니처만 보면 100/599 가 왜 그 값인지 알 수 없다. 같은 파일에 이미 `MAX_KEY_LENGTH`, `TTL_SEC` 처럼 의미 있는 상수를 별도로 뽑는 관례가 있다.
  - 제안: `MIN_HTTP_STATUS_CODE = 100` / `MAX_HTTP_STATUS_CODE = 599` 로 이름을 붙이면 다른 매직 넘버와의 취급 일관성이 생긴다. 이 함수 밖에서 재사용되지 않으므로 우선순위는 낮다.

- **[INFO]** 키 길이 상한 테스트가 "허용 경계"와 "거부 경계" 두 시나리오를 한 `it` 블록에 결합
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1222`
  - 상세: `it('키 길이 상한 — 200자는 쓰고 201자는 캐시 자체를 안 쓴다 (경계 양쪽)', …)` 하나가 `accepted`/`rejected` 두 개의 독립된 Redis mock·인터셉터를 만들어 순차 검증한다. 주석에 "한쪽만 두면 off-by-one 이 통과한다"는 의도적 근거가 있어 설계 결정으로 보이지만, 두 시나리오가 한 테스트에 묶이면 한쪽이 실패했을 때 테스트 이름만으로 어느 쪽인지 즉시 구분하기 어렵다(Jest 실패 스택은 구분되지만 테스트 목록 상에서는 하나로 보임).
  - 제안: 의도가 명확하므로 강제 변경은 불필요. 다만 향후 유사 "경계 양쪽" 테스트를 늘릴 때는 `it.each([['accept', 200, …], ['reject', 201, …]])` 형태로 표준화하면 실패 시 어느 경계가 깨졌는지 테스트 이름에서 바로 드러난다.

## 요약

이번 diff 는 `idempotency.interceptor.ts` 의 `!rawKey` truthiness 를 `rawKey === null` 명시 비교로 좁히고, `statusCode` 형태 검증을 `isHttpStatusCode()` 라는 이름 있는 단일 책임 함수로 분리했으며(오히려 기존 `isIdempotencyEntry()` 의 복잡도를 낮추는 방향), 스펙 파일에는 경계값 테스트 13건을 `it.each` 로 중복 없이 추가했다. 새 코드는 헬퍼 재사용(`makeRedis`/`makeContext`/`makeCallHandler`/`scopedKey`/`bodyHashOf`)을 일관되게 따르고, 네이밍은 목적을 명확히 드러내며, 각 테스트·함수에 "왜 필요한가"를 설명하는 근거 주석이 충실히 붙어 있어 이 저장소의 기존 컨벤션(뮤테이션 실측 기반 회귀 고정, truthiness 대신 명시 비교)과 일치한다. 새로 도입된 위험한 중첩·복잡도 증가는 없으며, 지적 사항은 모두 기존부터 누적된 경미한 개선 여지(파일 길이, 보일러플레이트 반복, 매직 넘버 네이밍)에 그친다.

## 위험도
LOW
