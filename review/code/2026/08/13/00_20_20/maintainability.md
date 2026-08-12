# 유지보수성(Maintainability) 코드 리뷰

## 대상

이번 라운드(`00_20_20`)의 실제 코드 diff는 origin/main 대비 5개 커밋(`8a2d13031`→`86de12278`)이 누적된 것이며, 그중 앞 4개 커밋(캐시 키 스코프, 안쪽 `responseJson` 손상 방어, docstring 정정 2건)은 이미 `23_24_08`·`23_36_13`·`23_48_38` 세 라운드에서 유지보수성 관점으로 전량 리뷰됐고 WARNING 3건은 소스에 반영 완료, 남은 것은 INFO(스타일 관찰)뿐임을 이번에도 직접 대조 확인했다(에러 포맷팅 삼항식 4곳 반복 여전(:145/:240/:323/:331), 한국어 리터럴 판별 타입 여전(:235), `discardCorruptEntry<T>` 제네릭 단일 타입 사용 여전 — 셋 다 재확인만, 상태 불변).

이번 라운드에서 **새로 리뷰 대상이 되는 것**은 마지막 커밋 `86de12278`(`fix(eia): JSON.parse('null') 은 던지지 않는다`)이 추가한 부분이다:
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `isIdempotencyEntry()`/`describeShape()` 신설, `switchMap` 콜백에 형태 검증 분기 추가, `discardCorruptEntry` 파라미터명 `err`→`detail` 변경
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — `it.each` 8-케이스 형태 검증 매트릭스 신설, 기존 두 테스트에 `try/finally` 로 `warnSpy` 복구 보강
- `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` — 문서. 이 관점의 코드 품질 평가 대상 아님
- `review/code/**`, `review/consistency/**` 하위 신규 파일들 — 리뷰 하네스 감사 아티팩트. 함수 길이·네이밍·중첩 같은 코드 품질 축이 적용되지 않는 자동 산출물이라 이 관점 평가 대상 밖으로 둔다(이전 라운드들과 동일한 판단)

## 발견사항

- **[INFO]** `switchMap` 콜백의 분기 수가 이번 커밋으로 6개→7개로 다시 늘었다 — 이전 라운드가 "여섯 번째 분기가 추가되면 재고하라"고 명시적으로 남긴 재검토 트리거를 넘긴 시점
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:149-217` (`intercept()` 내부 `switchMap((cachedJson) => { ... })`)
  - 상세: `!isIdempotencyEntry(parsed)` 검사(`:170-176`, 이번 커밋 신설)가 캐시 미스 · 엔트리 문법 오류 · `bodyHash` 불일치(409) · payload 문법 오류 · 에러 상태코드 재현 · 성공 재현에 이어 **일곱 번째 서로 다른 반환 지점**을 이 클로저에 더했다. `23_24_08`/`23_48_38` 두 라운드 모두 이 콜백의 분기 수를 이미 INFO로 짚으면서 "여섯 번째 분기가 추가되는 시점에는 `resolveCacheHit(...)` 같은 private 메서드 추출을 재고할 것"이라고 명시적 트리거를 남겼는데, 이번 커밋이 정확히 그 자리에 새 분기를 더했다. 조기 반환으로 중첩은 여전히 1단계이고 각 분기 앞 근거 주석도 충실해 즉각적인 가독성 저해는 없지만, 순환 복잡도 수치 자체는 파일 내 다른 메서드(`cacheTapped`, `storeEntry`)와의 격차가 더 벌어졌다.
  - 제안: 여전히 즉시 조치를 요구할 수준은 아니지만, 이전 라운드가 설정해 둔 재검토 트리거(6번째 분기)를 이미 넘겼으므로 다음에 이 콜백을 건드릴 때는 `resolveCacheHit(cachedJson, redisKey, bodyHash, context, processFresh)` 형태의 private 메서드 추출을 실제로 검토할 것을 권한다. 클로저 캡처 변수(`redisKey`/`bodyHash`/`context`/`processFresh`)가 4~5개라 추출 시 파라미터 목록이 길어지는 트레이드오프는 여전히 유효하다.

- **[INFO]** `discardCorruptEntry` 의 두 번째 파라미터가 이번 커밋으로 `err`→`detail` 로 개명되면서, 실제 예외 객체와 합성된 진단 문자열이라는 두 가지 다른 의미를 한 파라미터가 겸하게 됐다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:234-243` (`discardCorruptEntry<T>` 정의), 호출부 `:161`(catch 된 실제 `unknown` 예외), `:171-175`(`형태 불일치 (${describeShape(parsed)})` 로 합성한 문자열), `:200`(catch 된 실제 예외)
  - 상세: 개명 자체는 두 성격이 섞였다는 사실을 정직하게 반영한 방향(원래 `err` 였을 때가 더 오해 소지가 있었다)이라 개선이지만, 여전히 타입은 `unknown` 그대로라 시그니처만 봐서는 "예외 아니면 이미 사람이 읽을 수 있는 설명 문자열"이라는 두 형태를 구분할 수 없다. `detail instanceof Error ? detail.message : String(detail)` 가 두 경우 모두 안전하게 처리하므로 버그는 아니다.
  - 제안: 조치 불요(현재 두 호출부뿐이라 위험 낮음). 세 번째 호출부가 생기면 `detail: unknown | string` 대신 명시적으로 `Error | string` 로 좁히거나, JSDoc 에 "catch 된 예외 또는 이미 사람이 읽을 수 있는 설명 문자열 둘 다 받는다"는 한 줄을 추가하는 편이 다음 사람에게 더 정확한 신호가 된다.

- **[INFO]** 신설 `isIdempotencyEntry`/`describeShape` 두 헬퍼는 단일 책임·명확한 네이밍·풍부한 근거 주석(뮤테이션 실측 경위 포함)을 갖춰 이 파일의 기존 헬퍼 함수(`isErrorStatusCacheable`, `readKey`, `hashBody`) 스타일과 일관된다 — 감점 아님, 확인 기록
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:370-378`(`isIdempotencyEntry`), `:380-385`(`describeShape`)
  - 상세: `value === null` 을 별도 절로 분리하고 세 필드를 각각 `typeof` 로 검사하는 구조가, 왜 `Array.isArray`/`typeof !== 'object'` 절을 뺐는지(관측 가능한 동작이 없는 절은 거짓 신호를 준다)까지 docstring 에 근거를 남겨 재추가 유혹을 사전에 차단한다. `describeShape` 는 로그에 원본 캐시 값을 찍지 않기 위한 별도 함수로 분리돼 있어 목적이 명확하다.

- **[INFO]** 신규 `it.each` 형태-검증 매트릭스(8케이스)는 이 파일에서 처음 쓰인 패턴이지만 코드베이스 전반(62개 spec 파일)에서 이미 널리 쓰이는 관례라 일관성 문제는 없다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:552-605`
  - 상세: fixture 배열이 "조건을 하나씩만 위반해야 한다"는 이유를 주석(`:548-551`)에 먼저 적고, 그 근거로 이전 뮤테이션 실측 실패담(여러 조건을 동시에 위반해 개별 검사의 생존 여부를 못 갈랐던 사고)까지 남겨 향후 fixture 추가 시 같은 함정을 피하도록 안내한다. 라벨(`'null'`, `'숫자'`, ...)과 실제 JSON 문자열이 나란히 있어 실패 시 어떤 케이스인지 즉시 식별 가능.

## 요약

이번 라운드에서 새로 리뷰 대상이 된 코드는 `isIdempotencyEntry`/`describeShape` 신설과 `switchMap` 콜백에 형태 검증 분기 추가, 그리고 이를 뒷받침하는 `it.each` 8-케이스 테스트다. 새 헬퍼 두 개는 단일 책임·명확한 네이밍·근거 충실한 주석으로 이 파일의 기존 스타일과 잘 맞고, 매직 넘버·중복 코드·과도한 중첩 같은 심각한 문제는 없다. 유일하게 짚을 만한 것은 `switchMap` 콜백의 분기 수가 이전 두 라운드가 스스로 설정해 둔 재검토 트리거("여섯 번째 분기가 추가되면 추출을 재고할 것")를 이번 커밋으로 넘겼다는 점 — 즉시 조치가 필요한 수준은 아니지만 다음에 이 콜백을 건드릴 때는 실제로 private 메서드 추출을 검토해야 한다. `discardCorruptEntry` 의 `detail` 파라미터가 예외/합성 문자열 두 형태를 겸하게 된 것도 사소한 관찰이다. 이전 라운드들이 지적한 INFO 항목(에러 포맷팅 삼항식 4중 반복, 한국어 리터럴 판별 타입, 제네릭 단일 타입 사용)은 이번 diff로 변화가 없다. CHANGELOG·plan 문서 변경, `review/**` 감사 아티팩트는 이전 라운드와 동일하게 이 관점의 평가 대상 밖이다.

## 위험도

LOW
