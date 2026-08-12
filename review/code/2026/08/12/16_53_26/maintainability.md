# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 캐시 히트 분기에서 `JSON.parse(cached.responseJson)` 이 두 번 중복 호출된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:137`, `:143` (`intercept()` 의 `switchMap` 콜백, 캐시 히트 branch)
  - 상세: `if (isErrorStatusCacheable(cached.statusCode)) { throw new HttpException(JSON.parse(cached.responseJson) ...) }` 분기와 그 아래 `return of(JSON.parse(cached.responseJson) as unknown);` 가 각각 독립적으로 같은 문자열을 파싱한다. 두 분기가 상호 배타적이라 실행 시 실제로는 1회만 도는 게 맞지만, 소스만 보면 "같은 값을 두 번 파싱"하는 모양이라 읽는 사람이 "왜 캐시된 상태인데 두 번 파싱하지?"라고 잠깐 멈추게 된다. 파싱 실패 시 예외 메시지도 두 지점에서 각각 발생할 수 있어 디버깅 시 스택트레이스 위치가 갈린다.
  - 제안: `const parsed = JSON.parse(cached.responseJson) as unknown;` 을 두 분기 위로 한 번만 끌어올리고, `HttpException` 생성자에는 `parsed as Record<string, unknown>` 을 재사용. 단일 파싱 지점으로 좁혀 두면 이후 이 값에 정규화 로직(예: 응답 스키마 검증)이 추가될 때도 한 곳만 고치면 된다.

- **[INFO]** "닫힌 목록" 판정이 성공(2xx) 쪽은 `cacheTapped` 내부에 인라인, 오류(409/410) 쪽은 `isErrorStatusCacheable` named 함수로 — 두 절반이 비대칭적으로 팩터링돼 있다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:172-177` (인라인 `if (statusCode < 200 || statusCode >= 300) return;`) vs `:239-241` (`isErrorStatusCacheable` named 함수)
  - 상세: 클래스 상단 docstring 과 `isErrorStatusCacheable` JSDoc 모두 "§R8 닫힌 목록 = 2xx + 409 + 410" 을 하나의 정책으로 설명하는데, 실제 구현은 그 정책의 절반(에러 쪽)만 이름 붙은 단일 출처(`isErrorStatusCacheable`)로 뽑혀 있고 나머지 절반(성공 쪽 2xx 범위 판정)은 여전히 `tap` 콜백 안의 인라인 비교식이다. `isErrorStatusCacheable` 의 JSDoc 이 "성공 쪽은 별도 분기가 본다"고 명시하고 있어 의도된 분리이긴 하나, 그 "별도 분기"가 이름 없는 인라인 조건이라는 점에서 대칭이 깨진다 — 향후 §R8 범위가 또 바뀔 때(예: 1xx 를 캐시 대상에 추가) 수정 지점을 찾으려면 클래스 하나가 아니라 두 군데(named 함수 + 인라인)를 봐야 한다.
  - 제안: 필수는 아니나, `isSuccessStatusCacheable(statusCode)` 를 같은 방식으로 뽑아 두 판정을 대칭으로 맞추면 "닫힌 목록"이라는 하나의 정책이 코드에서도 하나의 인터페이스(두 named 함수 또는 단일 함수의 두 분기)로 드러난다.

- **[INFO]** `intercept()` 가 캐시 조회·hash 충돌·에러 재현·정상 재현 네 가지 책임을 한 메서드(약 60줄, 주석 포함)에 담고 있다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:88-150`
  - 상세: `switchMap` 콜백 하나가 (1) 손상 JSON fallback, (2) bodyHash 불일치 시 409, (3) 캐시된 409/410 을 예외로 재throw, (4) 캐시된 2xx 를 정상 응답으로 재현, (5) 캐시 미스 시 downstream 위임 — 다섯 갈래를 순차 `if` 로 처리한다. 이번 diff 로 (3) 분기가 새로 추가되며 메서드가 조금 더 길어졌다. 실측 순환 복잡도는 여전히 낮은 편이고(각 분기가 얕고 서로 독립적) 인라인 주석이 각 분기의 근거를 바로 옆에 남겨 두어 지금 당장 가독성이 크게 훼손되진 않지만, 여기에 분기가 하나 더 늘면(예: 다른 상태코드 처리) 단일 메서드로는 버거워질 수 있는 지점이다.
  - 제안: 필수 조치 아님. 캐시 히트 처리(현재 `if (cachedJson) { ... }` 블록 전체)를 `private replayCached(cached, context, bodyHash): Observable<unknown>` 로 추출하면 `intercept()` 자체는 "캐시 조회 → 히트/미스 위임"이라는 한 단계로 짧아지고, 히트 처리 로직은 독립적으로 이름이 붙어 테스트·리뷰 대상이 명확해진다.

- **[INFO]** 리뷰 대상에 포함된 `review/code/2026/08/12/16_29_45/**` 10개 파일(RESOLUTION.md, SUMMARY.md, `_retry_state.json`, `meta.json`, 각 reviewer `.md`)은 이전 리뷰 라운드가 생성한 산출물이며, 사람이 유지보수하는 소스가 아니라 리뷰 시점의 기록이다.
  - 위치: `review/code/2026/08/12/16_29_45/` 하위 신규 파일 전체
  - 상세: 이 저장소 컨벤션상 리뷰 산출물은 그대로 커밋되는 이력 기록이라(WARNING 이더라도 사후 수정 대상이 아님), 가독성·네이밍·중첩·매직넘버 등 통상적 유지보수성 기준을 적용할 대상이 아니다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 이전 라운드(`16_29_45`) 의 CRITICAL(409/410 캐싱이 도달 불가능한 dead code)을 `catchError` 확장 + `storeEntry`/`isErrorStatusCacheable` 추출로 재설계한 결과다. 유지보수성 관점에서는 순재작업 대비 개선됐다 — 캐시 적재 로직을 `storeEntry` 하나로 통합해 `tap.next` 와 `catchError` 두 콜백 간 중복을 제거했고, 이전 라운드에서 INFO 로 지적됐던 "isCacheable 인라인" 문제도 에러 쪽은 `isErrorStatusCacheable` named 함수로 뽑아 해소했다. 조건식·JSDoc 은 짧고 의도가 명확하며, 코드·테스트(`makeThrowingHandler` 도입)·문서(CHANGELOG·spec·plan) 네 층이 서로 정합하다. 남은 것은 전부 선택적 개선 여지(INFO)뿐이다 — 캐시 히트 분기의 중복 `JSON.parse` 호출, 성공/에러 두 판정 간 팩터링 비대칭, `intercept()` 가 담당 분기 하나가 늘며 다소 길어진 점. 셋 다 지금 당장 가독성을 해치는 수준은 아니며 필수 수정 사항이 아니다.

## 위험도

NONE
