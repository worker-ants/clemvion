# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 캐시 히트 분기에서 `JSON.parse(cached.responseJson)` 이 두 번 중복 호출된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:137`, `:143` (`intercept()` 의 `switchMap` 콜백, 캐시 히트 branch)
  - 상세: `if (isErrorStatusCacheable(cached.statusCode)) { throw new HttpException(JSON.parse(cached.responseJson) ...) }` 분기와 그 아래 `return of(JSON.parse(cached.responseJson) as unknown);` 가 각각 독립적으로 같은 문자열을 파싱한다. 두 분기가 상호 배타적이라 실행 시 실제로는 1회만 도는 게 맞지만, 소스만 보면 "같은 값을 두 번 파싱"하는 모양이라 읽는 사람이 잠깐 멈추게 된다. 직전 라운드(`16_53_26` RESOLUTION #4·5·6)에서 "선택적 개선, 지금 손대면 재설계 diff 를 흐린다" 는 이유로 **의도적으로 유예**된 항목이며, 이번 라운드 diff 에서도 해당 코드는 변경되지 않았다.
  - 제안: 필수 아님. `const parsed = JSON.parse(cached.responseJson) as unknown;` 을 두 분기 위로 한 번만 끌어올리면 단일 파싱 지점이 된다.

- **[INFO]** "닫힌 목록" 판정이 성공(2xx) 쪽은 `cacheTapped` 내부에 인라인, 오류(409/410) 쪽은 `isErrorStatusCacheable` named 함수로 — 두 절반이 비대칭적으로 팩터링돼 있다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:177`(인라인 `if (statusCode < 200 || statusCode >= 300) return;`) vs `:239-241`(`isErrorStatusCacheable` named 함수)
  - 상세: 클래스 상단 docstring 과 `isErrorStatusCacheable` JSDoc 모두 "§R8 닫힌 목록 = 2xx + 409 + 410" 을 하나의 정책으로 설명하는데, 구현은 그 정책의 절반(에러 쪽)만 이름 붙은 단일 출처로 뽑혀 있고 나머지 절반(성공 쪽 범위 판정)은 여전히 `tap` 콜백 안의 인라인 비교식이다. `isErrorStatusCacheable` JSDoc 이 "성공 쪽은 별도 분기가 본다" 고 명시하고 있어 의도된 분리이긴 하나, 향후 §R8 범위가 또 바뀌면(예: 1xx 추가) 수정 지점을 named 함수 + 인라인 두 군데에서 찾아야 한다. 이 역시 `16_53_26` 라운드에서 선택적 개선으로 유예된 항목이고 이번 diff 에서 변경되지 않았다.
  - 제안: 필수 아님. `isSuccessStatusCacheable(statusCode)` 를 같은 방식으로 뽑으면 정책이 두 named 함수로 대칭을 이룬다.

- **[INFO]** `intercept()` 가 캐시 조회·hash 충돌·에러 재현·정상 재현·캐시 미스 다섯 갈래를 한 메서드(88~150행, 약 63줄)에 담고 있다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:88-150`
  - 상세: `switchMap` 콜백 하나가 (1) 손상 JSON fallback, (2) bodyHash 불일치 시 409, (3) 캐시된 409/410 을 예외로 재throw, (4) 캐시된 2xx 를 정상 응답으로 재현, (5) 캐시 미스 시 downstream 위임을 순차 `if` 로 처리한다. 각 분기가 얕고 서로 독립적이며 인라인 주석이 근거를 바로 옆에 남겨 두어 현재는 가독성이 크게 훼손되지 않지만, 분기가 하나 더 늘면 단일 메서드로는 버거워질 지점이다. `16_53_26` 라운드에서 이미 유예된 항목이고 이번 라운드에서 코드 변경 없음.
  - 제안: 필수 아님. 캐시 히트 처리 블록 전체를 `private replayCached(cached, context, bodyHash): Observable<unknown>` 로 추출하면 `intercept()` 는 "조회 → 히트/미스 위임" 한 단계로 짧아진다.

- **[INFO]** 테스트 스펙의 error-채널 케이스 6건(400·409·410·5xx·3xx·404)이 거의 동일한 4~5줄 보일러플레이트(`makeRedis` → `makeInterceptor` → `intercept` 호출 → `redis.set` 단언)를 반복한다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:244-396` (`'throw 된 400 VALIDATION_ERROR …'` 부터 `'throw 된 404 도 캐시하지 않는다…'` 까지 6개 `it` 블록)
  - 상세: 이 라운드에서 400 케이스가 error 채널로 바뀌며(`16_53_26` WARNING #1 fix) 동일 구조의 케이스가 하나 더 늘었다. 각 블록이 "예외 타입 + statusCode 기대값 + redis.set 호출 여부/저장값" 만 다르고 나머지 골격이 동일해 `it.each`로 테이블화하면 케이스 추가/누락 여부를 표 하나로 조망할 수 있다. 다만 이 저장소는 각 `it` 옆에 "왜 이 케이스가 필요한가"를 설명하는 주석을 다는 관행(예: `=== 400` 오답이 여기서 걸린다, `>= 400` 오답이 저기서 걸린다)이 있고 이는 `it.each` 테이블로 압축하면 개별 사유 주석을 붙이기 번거로워진다 — 현재 형태가 오히려 그 관행과 더 잘 맞는다.
  - 제안: 선택 사항. 케이스가 더 늘어나 개별 사유 주석의 가치보다 반복 비용이 커지는 시점에 파라미터화를 고려.

- **[INFO]** `review/code/2026/08/12/{16_29_45,16_53_26}/**` 신규 파일들은 이전 리뷰 라운드가 생성한 산출물이며 사람이 유지보수하는 소스가 아니라 리뷰 시점의 이력 기록이다
  - 위치: 해당 디렉터리 하위 신규 파일 전체 (`RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`, `meta.json`, 각 reviewer `.md`)
  - 상세: 저장소 컨벤션(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)상 그대로 커밋되는 이력이라 가독성·네이밍·중첩·매직넘버 등 통상적 유지보수성 기준을 적용할 대상이 아니다.
  - 제안: 조치 불요.

## 요약

이번 라운드는 `16_29_45`(CRITICAL: 409/410 캐싱 dead code)와 `16_53_26`(WARNING: 400 케이스만 옛 mock 형태로 남음)을 거쳐 이미 재설계·수정이 끝난 최종 코드를 대상으로 한다. `idempotency.interceptor.ts`/`idempotency.interceptor.spec.ts` 실제 소스는 이번 diff 에서 추가 변경 없이 그대로이며(400 테스트만 error 채널로 교체), 캐시 적재 로직은 `storeEntry` 하나로 통합돼 있고 조건식(`isErrorStatusCacheable`)은 named 함수로 추출돼 근거 주석과 함께 명확하다. 함수 길이·네이밍·중첩 깊이·매직 넘버 모두 이 코드베이스의 "근거를 코드 옆에 남기는" 컨벤션과 일치하며 새로 추가된 결함 클래스는 없다. 남은 것은 전부 `16_53_26` 라운드에서 이미 의도적으로 유예한 선택적 개선(`JSON.parse` 중복, 성공/에러 판정 팩터링 비대칭, `intercept()` 길이)과, 이번 라운드에서 새로 관찰된 테스트 보일러플레이트 반복(파라미터화 고려 가능) 뿐이며 전부 INFO 수준이다.

## 위험도

NONE
