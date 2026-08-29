# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 범위

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 의 `switchMap` 콜백 본문을 `resolveCacheHit()` private 메서드로 추출(순수 구조 리팩터), 그 인자를 묶는 `CacheLookup` 인터페이스 신설.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — plan 문서. 체크박스 완료 반영 + 실측/예측 표 추가. 코드가 아니므로 유지보수성 관점 발견사항 없음.
- `review/consistency/2026/08/29/17_23_43/*` (SUMMARY.md, meta.json, `_retry_state.json`, checker 산출 md 6종) — orchestrator 가 생성한 리뷰 산출물. 애플리케이션 소스가 아니므로 이 관점의 대상 밖.

### 발견사항

- **[INFO]** `resolveCacheHit` 는 인자를 객체(`CacheLookup`)로 묶는데, 같은 클래스의 동급 private 헬퍼(`cacheTapped`, `storeEntry`)는 이번 변경 후에도 여전히 위치 인자를 나열한다 — 파라미터 전달 방식이 클래스 내에서 두 스타일로 갈린다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:222`(`resolveCacheHit(cachedJson, lookup: CacheLookup)`) vs `:335`(`cacheTapped(redisKey, bodyHash, context)`), `:386`(`storeEntry(redisKey, bodyHash, statusCode, payload)`)
  - 상세: `cacheTapped`/`storeEntry` 도 3~4개의 관련 값(`redisKey`/`bodyHash`/`context`(+`statusCode`/`payload`))을 받는데 여전히 위치 인자다. `CacheLookup` 을 도입한 근거(`redisKey`/`bodyHash` 뒤바뀜 뮤턴트가 조용하지 않다는 실측)는 이 두 헬퍼에도 동일하게 적용될 수 있는 논리라, 한쪽만 객체화하면 "이 클래스는 언제 파라미터를 객체로 묶는가" 에 대한 일관된 규칙이 안 보인다.
  - 제안: 지금 당장 통일할 필요는 없지만(세 메서드 모두 같은 PR 은 아님), 다음에 이 헬퍼들을 만질 때 같은 판단 기준(호출부 실수가 타입으로 안 잡히는데 조용한가)으로 재검토할 만하다는 점을 docstring 이나 plan 트래커에 남겨 두면 다음 사람이 "왜 여긴 되고 저긴 안 됐지" 를 다시 조사하지 않아도 된다.

- **[INFO]** `resolveCacheHit` 라는 이름이 실제로 처리하는 첫 번째 분기(캐시 미스, `!cachedJson`)를 정확히 담지 못한다 — "hit" 은 캐시가 맞았을 때를 연상시키는데 메서드는 미스·손상·충돌·재현을 전부 포함한 7갈래 전체를 판정한다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:222` (`private resolveCacheHit(cachedJson, lookup): Observable<unknown>`)
  - 상세: docstring(196~221행)이 "캐시 조회 결과 한 건을 응답으로 판정한다" 라고 정확히 설명하고 있어 오독 위험은 낮지만, 이름만 보면 "캐시가 맞은 경우만 처리" 로 오해할 수 있다. `resolveCacheLookup`/`handleCacheLookupResult` 류가 조회 결과 전체(미스 포함)를 다룬다는 의도를 더 정확히 전달한다.
  - 제안: 이름 교체는 선택 사항(문서가 이미 보완). 다음 리네이밍 기회에 반영 고려.

- **[INFO]** `resolveCacheHit`/`CacheLookup` 의 JSDoc 이 특정 뮤테이션 실측 수치(13개, 4개, 2개)와 과거 리뷰 라운드 식별자(`23_24_08`, `23_36_13`, `16_29_45`, `00_20_20`)를 소스 코드 주석에 영구히 박아 둔다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:64-67`(13개), `:218-220`(4개/2개), `:208-209`(라운드 ID)
  - 상세: 이 값들은 "지금 시점의 spec 테스트 구성" 에 결속된 스냅샷이다. 향후 관련 테스트가 추가·삭제·리네이밍되면 이 숫자는 조용히 stale 해지고, 그 근거(리뷰 라운드 디렉터리)는 `review/` 아카이브 보존 정책에 따라 사라질 수 있어 미래 독자가 "13개" 를 검증할 방법이 없어진다. 다만 이 패턴은 이 파일 기존 클래스 docstring(97~119행, 라운드 ID·경로 개수 인용)에 이미 확립된 스타일이라 이번 diff 가 새로 도입한 결함은 아니다.
  - 제안: 새로 결함은 아니므로 즉시 조치 불요. 다만 숫자를 "정확한 개수" 대신 "복수 개(≥N)" 처럼 근사치로 적으면 향후 테스트 스위트 변화에 덜 취약해진다 — 이 파일 전반에 반복되는 패턴이라 한 번에 정책으로 정리할 만하다.

- **[INFO]** `resolveCacheHit` 는 순환 복잡도가 여전히 높다(문서화된 대로 7갈래) — 이번 추출로 `intercept()` 의 중첩·길이는 해소됐지만, 그 복잡도 자체는 옮겨졌을 뿐 줄지는 않았다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:222-294`
  - 상세: early return 위주라 중첩 깊이는 낮고(최대 2단계), 각 분기가 정확히 표(196~207행)로 문서화돼 있어 가독성 자체는 양호하다. 다만 "엔트리 파싱·형태 검증" (232~254행) 과 "충돌 판정→payload 파싱→재현" (256~293행) 은 개념적으로 두 단계로 더 쪼갤 수 있는 여지가 있다.
  - 제안: 지금 크기(약 35줄의 실질 로직 + 풍부한 방어 주석)는 임계치를 넘지 않는다고 판단한다. 여덟 번째 분기가 추가되는 시점이 재분리를 검토할 자연스러운 트리거가 될 것 — plan 트래커의 기존 관례(6→7 트리거)를 그대로 이어 "8번째 분기 발생 시 재검토" 로 남겨 두는 것을 권한다.

### 요약

`intercept()` 의 `switchMap` 콜백을 `resolveCacheHit()` 로 추출한 순수 구조 리팩터로, 유지보수성 관점에서는 명확한 개선이다. 이전 라운드가 조건부로 유예해 둔 "6번째(→실측 7번째) 분기 발생 시 재검토" 트리거를 정확히 이행했고, `intercept()` 는 "캐시를 쓸 수 있는 요청인가" 로 책임이 좁아져 짧고 읽기 쉬워졌으며, `resolveCacheHit()` 는 early-return 위주라 중첩이 얕고 7갈래 분기 전체가 표로 문서화돼 있다. `CacheLookup` 인터페이스는 인자 4개를 이름으로 묶어 호출부 실수(뮤테이션 실측 13건 RED)를 방지하는 데 실질적으로 기여한다. 남은 지적은 전부 INFO 수준의 스타일·표기 일관성 문제(파라미터 전달 방식이 클래스 내에서 갈리는 점, 메서드 이름이 "hit" 외 경로도 포함한다는 점, 소스 주석에 박힌 뮤테이션 실측 수치의 장기 stale 위험)이며, 블로킹할 결함은 없다.

### 위험도
LOW
