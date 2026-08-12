# 유지보수성(Maintainability) 코드 리뷰

## 대상

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (프로덕션 — `discardCorruptEntry` 신설 + `switchMap` 콜백 리팩터, 다섯-경로 fail-open 표로 갱신된 최종 상태)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (테스트 — 신규 4건 + 형제 테스트 단언 보강, 최종 상태)
- `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` — 문서. 이 관점의 코드 품질 평가 대상은 아니나 diff 내용이 실제 코드 변경과 부합함을 확인
- `review/code/2026/08/12/23_24_08/*`, `review/code/2026/08/12/23_36_13/*` (RESOLUTION.md, SUMMARY.md, `_retry_state.json`, per-agent `.md`/`meta.json`) — 이전 두 라운드의 리뷰 하네스 산출물. 함수 길이·네이밍·중첩·매직넘버 같은 코드 품질 축이 적용되지 않는 자동 생성 감사 아티팩트라 이 관점의 평가 대상 밖으로 둔다(`review/code/<Y>/<M>/<D>/<hh_mm_ss>/` 저장 규약과 일치).

## 발견사항

- **[INFO]** 에러 메시지 포맷팅 삼항식이 파일 안에서 4곳 반복된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:145`(GET 실패 catchError), `:225`(`discardCorruptEntry`, 이번 diff 신설), `:308`(`storeEntry` 직렬화 실패), `:316`(`storeEntry` SET 실패)
  - 상세: 네 곳 모두 `err instanceof Error ? err.message : String(err)` 를 그대로 반복한다. 이번 diff 가 `discardCorruptEntry` 를 신설하면서 기존 3곳(GET·SET·직렬화)에 4번째 발생을 더했다. 로직 오류는 아니고 각 warn 메시지의 접두 문구는 서로 달라 메시지 전체를 통합할 필요는 없다.
  - 제안: `formatErr(err: unknown): string { return err instanceof Error ? err.message : String(err); }` 같은 파일-로컬 헬퍼로 추출해 네 호출부를 `formatErr(err)` 로 축약. 메시지 접두 문구는 그대로 유지해 로그 포맷 차이는 보존한다. (즉시 조치 불요 — 1줄 표현식 수준이라 위험은 낮다.)

- **[INFO]** `switchMap` 콜백(캐시 히트 처리)이 한 클로저 안에서 6가지 분기를 다룬다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:149-202` (`intercept()` 내부 `switchMap((cachedJson) => { ... })`)
  - 상세: 캐시 미스 → 엔트리 손상(파싱 실패) → `bodyHash` 불일치(409) → payload 손상(파싱 실패) → 에러 상태코드 재현(409/410 throw) → 성공 재현(status 설정 + `of()`) 순서로 처리한다. 조기 반환으로 중첩은 1단계로 눌러 놓았고 각 분기 앞에 근거 주석이 충실해 가독성 자체는 준수하지만, 분기 수만 놓고 보면 파일 내 다른 메서드(`cacheTapped`, `storeEntry`)보다 순환 복잡도가 눈에 띄게 높다. `redisKey`/`bodyHash`/`context`/`next` 를 클로저로 캡처하고 있어 별도 private 메서드로 추출하려면 파라미터 4~5개를 넘겨야 한다.
  - 제안: 현재로선 조치 불요. 여섯 번째 분기가 추가되는 시점에 `resolveCacheHit(...)` 형태의 private 메서드 추출을 재고할 것.

- **[INFO]** `discardCorruptEntry` 의 판별 파라미터가 로그 문구용 한국어 리터럴 타입을 겸한다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:220` (`what: '엔트리' | 'payload'`)
  - 상세: `what` 은 오직 warn 메시지 보간(`cache ${what} 손상`)에만 쓰이는데, "무엇이 손상됐는가"라는 내부 식별자와 "로그에 그대로 노출될 표시 문자열"이 한 값으로 합쳐져 있다. 현재 사용 범위에서는 무해하고 파일 전반의 한국어 로그 관례와도 어긋나지 않지만, 이 값이 나중에 로직 분기(문자열 비교)로 쓰이게 되면 오탈자에 취약해진다.
  - 제안: 조치 불요(관찰만). 로그 이외의 분기 조건으로 쓰이는 시점에 `'entry' | 'payload'` 내부 식별자 + 별도 한국어 표시 문구 매핑으로 분리할 것.

- **[INFO]** 신규 테스트 두 건(200 케이스·409 케이스)이 상태코드 값과 idempotency 키만 다르고 본문 구조가 거의 동일하다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:566`(`엔트리는 멀쩡한데 안쪽 responseJson 이 깨진 경우`), `:636`(`안쪽이 깨진 409 엔트리도 500 이 아니라 신규 처리`)
  - 상세: mock 구성(`redis.get.mockResolvedValue(JSON.stringify({...}))`) · `handleSpy` · `warnSpy` · 최종 단언(응답값·`handleSpy`·`warnSpy`·`redis.set` 저장값)이 거의 동형이라 `it.each` 로 파라미터화할 여지가 있어 보인다. 다만 `:637-640` 주석이 "지금은 같은 코드 라인을 타지만 재현 분기가 다시 둘로 갈릴 회귀에 대비해 의도적으로 남겨 둔 캐너리"라고 명시적으로 설명한다 — 통합하면 이 캐너리의 목적(성공/에러 두 채널이 각각 독립적으로 방어를 받는지 검증)이 약해질 수 있어, 단순 중복 제거로 취급하면 안 된다.
  - 제안: 조치 불요 — 의도가 문서화된 중복. 참고로만 기록.

## 이전 두 라운드(`23_24_08`, `23_36_13`) 대조

두 라운드 모두 같은 코드에 대해 동일 관점으로 리뷰했고, WARNING 3건(형제 테스트 단언 얕음·클래스 docstring stale·CHANGELOG 누락)은 소스에서 조치가 반영됨을 확인했다(`idempotency.interceptor.spec.ts:664-680` 단언 보강, `idempotency.interceptor.ts:62-71` 다섯-경로 표, `CHANGELOG.md:3-19` 항목 추가). `discardCorruptEntry` 공유 docstring 의 "종전 동작 뭉갬" INFO 도 `:209-217` 에서 엔트리/payload 두 시나리오로 분리 서술되어 해소됐다. 이번 라운드에서 코드 자체의 상태는 두 라운드 전과 변화가 없으며, 위에 다시 적은 INFO 4건은 전부 이전에도 같은 성격으로 지적·유예된 스타일 관찰이라 새로운 위험을 추가하지 않는다.

## 요약

프로덕션 코드는 매직 넘버·과도한 함수 길이·깊은 중첩·급격한 복잡도 상승 같은 심각한 유지보수성 문제가 없다. `if (cachedJson) { … }` 중첩을 조기 반환으로 평탄화하고, catch·최종 분기에 흩어졌던 `next.handle().pipe(...)` 호출을 `processFresh` 클로저로 묶고, 두 자리에서 각각 부르던 `JSON.parse(cached.responseJson)` 을 `cachedPayload` 단일 파싱으로 제거한 구조는 견고하다. `discardCorruptEntry` 는 "손상 시 warn + 신규 처리 강등" 패턴을 이름 있는 지점 하나로 모아 두 실패 경로의 동작·가시성을 강제로 일치시키며, 클래스 docstring 의 다섯-경로 표는 향후 경로 추가 시 개수 불일치를 막는 좋은 장치다. 테스트 파일도 기존에 확립된 패턴(각 테스트가 독립적으로 mock 을 구성하고 근거 주석을 앞세우는 방식)을 일관되게 따른다. 이번 라운드에서 새로 짚을 것은 없으며, 앞선 두 라운드가 이미 식별한 INFO 4건(에러 포맷팅 삼항식 4중 반복·switchMap 콜백의 분기 수·로그 전용 한국어 리터럴 판별 타입·의도된 테스트 중복)만 재확인됐다 — 전부 즉시 조치를 요구하지 않는 스타일 관찰이다. `review/code/**` 산출물들은 코드 품질 기준이 적용되지 않는 감사 아티팩트다.

## 위험도

LOW
