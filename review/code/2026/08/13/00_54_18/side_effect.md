# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 테스트 헬퍼 `makeContext()` 의 `body` 정규화 규약이 바뀜 (호출부 전체에 영향)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:131`
  - 상세: `body: opts.body ?? {}` → `body: 'body' in opts ? opts.body : {}` 로 변경. `makeContext()` 는 이 파일 전체(기존 W-4/캐시 히트/Redis 장애/스코프 블록 포함)가 공유하는 헬퍼라, 이 한 줄 변경이 파일 내 **모든** 호출부의 `body` 처리 방식에 영향을 준다 — `body` 키를 아예 생략한 호출은 이전과 동일하게 `{}` 로 정규화되지만, `body: undefined`/`body: null` 을 **명시**한 호출은 이제 `{}` 로 정규화되지 않고 그대로 전달된다. 실제 검증 결과 기존 호출부는 전부 리터럴 객체(`{ a: 1 }` 등) 또는 `body` 변수(항상 `{ a: 1 }` 로 초기화됨)만 넘기므로 이번 변경으로 조용히 깨지는 기존 테스트는 없음을 확인했다. 회귀 위험은 낮지만, 공유 헬퍼의 정규화 규약이 "키 부재"와 "명시적 nullish" 를 구분하는 방향으로 바뀌었다는 점은 향후 새 테스트 작성 시 인지해야 한다.
  - 제안: 별도 조치 불필요 — 의도된 변경이고 diff 자체 주석(L127-130)에 근거가 이미 기술되어 있다. 향후 리뷰에서 새 호출부가 `body: someMaybeUndefinedVar` 형태로 동적 값을 넘기는 경우, "키 생략"과 "값이 undefined" 를 혼동하지 않는지만 유의하면 된다.

- **[INFO]** 프로덕션 로직 변경: `statusCode` 유효성 판정이 좁아져 기존에 캐시된 손상 엔트리의 처리 경로가 바뀜
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `isIdempotencyEntry()` (약 L374-382) / 신설 `isHttpStatusCode()` (약 L394-400)
  - 상세: 종전 `typeof e.statusCode === 'number'` 는 `-1`·`0`·`600`·`200.5` 같은 값도 "유효한 엔트리"로 인정해 그대로 `res.status(...)`/`new HttpException(_, statusCode)` 로 흘려보냈다(운영에서 실제로 `RangeError`→500 을 유발할 수 있는 경로). 변경 후에는 `isHttpStatusCode()`(정수 & 100~599)로 좁혀, 이런 값을 가진 엔트리는 "손상"으로 간주되어 `discardCorruptEntry()` 를 거쳐 **버려지고 재처리**된다. 이는 의도된 버그 수정이며 side effect 관점에서 문제는 아니지만, 배포 시점에 Redis 에 이미 저장돼 있던(혹시 존재한다면) 비정상 `statusCode` 엔트리는 이 변경 이후 캐시 미스로 취급되어 재실행 응답을 다시 만든다는 동작 변화가 있다는 점을 기록해 둔다. 이 인터셉터의 대상 API 가 애초에 100~599 밖의 `statusCode` 를 만들 수 없으므로 실질 영향은 없다.
  - 제안: 조치 불필요. 문서화 목적의 기록.

- **[INFO]** `if (!rawKey || !this.redis)` → `if (rawKey === null || !this.redis)` 는 런타임 동작 동일함을 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 진입부 (약 L109-112)
  - 상세: `readKey()` 는 항상 `null` 또는 "trim 후 길이 1~200인 비어있지 않은 문자열" 만 반환하도록 구현돼 있어(`readKey()` 본문 확인), `rawKey` 가 falsy 이면서 `null` 이 아닌 경우(빈 문자열 등)는 애초에 발생하지 않는다. 따라서 `!rawKey` → `rawKey === null` 전환은 실제 분기 결과를 바꾸지 않는 리팩터(뮤테이션 테스트 관측성 개선 목적)이며 부작용 없음을 확인했다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 변경은 체크박스 상태 갱신 + 완료 기록 추가뿐
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:672`, `:682-696`
  - 상세: `- [ ]` → `- [x]` 로 체크박스를 갱신하고 완료 근거(뮤턴트 10개 전부 사살, 생존 2건의 원인)를 본문에 추가했다. 코드 실행에 영향 없는 문서 변경이며, plan 라이프사이클 규약(체크한 시점에만 체크)에도 부합한다.
  - 제안: 조치 불필요.

전역 변수 도입/수정, 파일시스템 부작용, 환경 변수 읽기/쓰기, 의도치 않은 네트워크 호출, 공개 API(생성자·`intercept()`) 시그니처 변경은 이번 diff 범위에서 발견되지 않았다. Redis I/O(`get`/`set`)는 기존 로직 그대로이고 새로 추가된 것은 없다. `Logger.prototype.warn` 을 `jest.spyOn` 으로 모킹하는 신규 테스트들은 전부 `try/finally` 로 `mockRestore()` 하는 기존 파일 패턴을 그대로 따르고 있어 테스트 간 전역 상태 누수 위험도 없다.

## 요약

이번 diff 는 사실상 순수한 하드닝(`statusCode` 범위 검사 추가)과 테스트 커버리지 확충(경계값 13건)이며, 프로덕션 공개 인터페이스(생성자·`intercept()` 시그니처)는 변하지 않았다. 유일하게 "부작용" 관점에서 눈여겨볼 지점은 공유 테스트 헬퍼 `makeContext()` 의 `body` 정규화 규약 변경인데, 실제 파일 내 모든 호출부를 grep 하여 대조한 결과 기존 테스트를 조용히 깨뜨리는 사례는 없음을 확인했다. `statusCode` 유효성 판정 축소는 의도된 동작 변경(버그 수정)이고 문서화도 충분하다. 전역 변수·파일시스템·환경변수·네트워크·이벤트/콜백 관련 부작용은 발견되지 않았다.

## 위험도

NONE
