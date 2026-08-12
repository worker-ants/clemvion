# 유지보수성(Maintainability) 코드 리뷰

## 대상

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (프로덕션 — `discardCorruptEntry` 신설 + `switchMap` 콜백 리팩터, 최종 상태)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (테스트 — 4건 신규, 그중 1건은 이전 리뷰 라운드(`23_24_08` WARNING #1)의 지적으로 단언이 보강된 최종 상태)
- `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` — 문서. 이 관점의 코드 품질 평가 대상 아님(내용은 실제 코드 변경과 부합함을 확인)
- `review/code/2026/08/12/23_24_08/*` (RESOLUTION.md, SUMMARY.md, `_retry_state.json`, 9개 reviewer `.md`/`meta.json`) — 리뷰 하네스가 생성한 감사 아티팩트. 함수·네이밍·중첩 같은 코드 품질 축이 적용되지 않는 자동 산출물이라 이 관점에서는 평가 대상 밖으로 둔다. 다만 앞선 라운드의 WARNING 3건(테스트 단언 얕음·docstring stale·CHANGELOG 누락)이 실제로 프로덕션 코드에 반영됐는지는 대조 확인했다 — 세 건 모두 소스에서 확인됨.

## 발견사항

- **[INFO]** 에러 메시지 포맷팅 삼항식이 파일 안에서 4곳 반복된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:145` (GET 실패 catchError), `:225` (`discardCorruptEntry`, 이번 diff 신설), `:308` (`storeEntry` 직렬화 실패), `:316` (`storeEntry` SET 실패)
  - 상세: 네 곳 모두 `err instanceof Error ? err.message : String(err)` 를 그대로 반복한다. 이번 diff 가 `discardCorruptEntry` 를 신설하면서 이 패턴의 세 번째 발생(기존 GET·SET·직렬화 세 곳 중 이미 있던 것)에 네 번째 발생을 더했다 — "rule of three" 를 넘겨 반복이 더 뚜렷해진 시점이다. 로직 오류는 아니고 각 warn 메시지의 접두 문구(`GET 실패`, `${what} 손상`, `직렬화 실패`, `SET 실패`)는 서로 달라 메시지 자체를 통합할 필요는 없다.
  - 제안: `function formatErr(err: unknown): string { return err instanceof Error ? err.message : String(err); }` 같은 파일-로컬 헬퍼로 추출해 네 호출부를 `formatErr(err)` 로 축약. 메시지 접두 문구는 그대로 유지해 로그 포맷 차이는 보존한다.

- **[INFO]** `switchMap` 콜백(캐시 히트 처리)이 한 클로저 안에서 5가지 서로 다른 분기를 다룬다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:149-202` (`intercept()` 내부 `switchMap((cachedJson) => { ... })`)
  - 상세: 이 콜백 하나가 캐시 미스, 엔트리 손상(파싱 실패), `bodyHash` 불일치(409 conflict), payload 손상(파싱 실패), 에러 상태코드 재현(409/410 throw), 성공 재현(status 설정 + `of()`) 을 순서대로 처리한다. 조기 반환으로 중첩은 1단계로 잘 눌러 놓았고 각 분기 앞에 근거 주석이 충실해 가독성 자체는 준수하지만, 분기 수(≈6)만 놓고 보면 이 콜백 하나의 순환 복잡도가 파일 내 다른 메서드(`cacheTapped`, `storeEntry`)보다 눈에 띄게 높다. 현재는 `redisKey`/`bodyHash`/`context`/`next` 를 클로저로 캡처하고 있어 별도 private 메서드로 뽑으려면 파라미터 4~5개를 넘겨야 하므로, 추출이 명백히 더 나은 선택인지는 판단이 갈린다 — 강제 조치를 요하는 수준은 아니다.
  - 제안: 현재로선 조치 불요. 이 콜백에 여섯 번째 분기가 추가되는 시점에는 `resolveCacheHit(cachedJson, redisKey, bodyHash, context, processFresh)` 형태의 private 메서드 추출을 재고할 것.

- **[INFO]** `discardCorruptEntry` 의 판별 파라미터가 로그 문구용 한국어 리터럴 타입이다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:220` (`what: '엔트리' | 'payload'`)
  - 상세: `what` 은 오직 warn 메시지 보간(`cache ${what} 손상`)에만 쓰이는데 타입 자체가 `'엔트리' | 'payload'` 로 한국어/영어가 섞인 리터럴 유니온이다. 동작에는 문제가 없고(임의 문자열 유입은 타입으로 차단됨) 파일 전반이 주석·에러 메시지에 한국어를 쓰는 관례와 크게 어긋나지도 않지만, "무엇이 손상됐는가"라는 내부 식별자와 "로그에 그대로 노출될 표시 문자열"이 한 값으로 합쳐져 있어 향후 이 값을 로직 분기(문자열 비교)에 쓰게 되면 오탈자에 취약해진다.
  - 제안: 조치 불요(현재 사용 범위에서는 무해). 이 값이 로그 이외의 분기 조건으로 쓰이게 되면 그때 `'entry' | 'payload'` 내부 식별자 + 별도 한국어 표시 문구 매핑으로 분리할 것.

## 이전 라운드(`23_24_08`) WARNING 대조 확인

`RESOLUTION.md`/`SUMMARY.md` 가 주장하는 세 건의 유지보수성 인접 조치가 실제 소스에 반영됐는지 직접 대조했다.

- WARNING #1(테스트 단언 얕음, testing/side_effect 소관이나 코드 형태에 영향): `idempotency.interceptor.spec.ts:664-673` 에 `redis.set` 호출 횟수·`stored.bodyHash`·`stored.statusCode`·`JSON.parse(stored.responseJson)` 단언이 형제 테스트(`:588-596`)와 동형으로 추가됨. 확인됨.
- WARNING #2(클래스 docstring "세 경로" stale): `idempotency.interceptor.ts:62-79` 가 산문에서 표로 바뀌며 다섯 경로 전부(생성자 null·GET·SET·직렬화·엔트리/payload 손상)를 나열하고 각 행이 `{@link}` 로 구현 지점을 가리킨다. 확인됨.
- WARNING #3(CHANGELOG 누락): `CHANGELOG.md:3-19` 에 증상·클라이언트 영향·파싱 순서 계약화 근거를 담은 `## Unreleased` 항목이 새로 생김. 확인됨.

이전 라운드 INFO 중 `discardCorruptEntry` 공유 docstring 의 "종전 동작 뭉갬" 지적도 `idempotency.interceptor.ts:209-217` 에서 엔트리/payload 두 시나리오로 분리 서술되어 반영됐음을 확인했다.

## 요약

프로덕션 코드는 이번 diff 전체를 통틀어 매직 넘버·과도한 함수 길이·깊은 중첩·급격한 복잡도 상승 같은 심각한 유지보수성 문제가 없다. `if (cachedJson) { … }` 중첩을 조기 반환으로 평탄화하고, 캐치 분기·최종 분기에 흩어졌던 `next.handle().pipe(...)` 호출을 `processFresh` 클로저로 묶고, `JSON.parse(cached.responseJson)` 중복 파싱을 `cachedPayload` 단일 파싱으로 제거한 구조는 여전히 유효하고 견고하다. 신설된 `discardCorruptEntry` 는 "손상 시 warn + 신규 처리 강등" 이라는 반복 패턴을 이름 있는 지점 하나로 모아 두 실패 경로의 동작·가시성을 강제로 일치시킨다. 이전 라운드(`23_24_08`)가 지적한 WARNING 3건(형제 테스트 단언 비대칭, 클래스 docstring stale, CHANGELOG 누락)은 모두 소스에서 조치가 실제로 반영됐음을 대조 확인했고, INFO 로 지적됐던 `discardCorruptEntry` 공유 docstring 의 시나리오 뭉갬도 분리 서술로 해소됐다. 이번 라운드에서 새로 짚은 것은 전부 INFO 수준(에러 포맷팅 삼항식 4중 반복, `switchMap` 콜백의 분기 수, 로그 전용 한국어 리터럴 판별 타입)이며 셋 다 즉시 조치를 요구하지 않는 스타일 관찰이다. 테스트 파일도 기존에 확립된 패턴(각 테스트가 독립적으로 mock 을 구성하고 근거 주석을 앞세우는 방식)을 일관되게 따른다.

## 위험도

LOW
