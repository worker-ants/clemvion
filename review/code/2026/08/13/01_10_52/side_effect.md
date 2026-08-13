# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 신규 모듈 상수 `MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` 도입 — 문제 되는 "전역 변수"는 아님
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:25-26`
  - 상세: `const MIN_HTTP_STATUS_CODE = 100; const MAX_HTTP_STATUS_CODE = 599;` 가 모듈 최상단에 추가됐다. module-scope 상수이고 export 되지 않으며 재할당도 없어, 같은 파일의 기존 `MAX_KEY_LENGTH`/`TTL_SEC`/`REDIS_KEY_PREFIX` 와 동일한 패턴이다. 공유 가변 상태가 아니므로 side-effect 관점의 "전역 변수" 위험에 해당하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `isIdempotencyEntry()` 의 `statusCode` 검증이 `typeof === 'number'` → `isHttpStatusCode()` 로 좁혀짐 — 캐시 엔트리 처리 경로가 바뀌는 의도된 동작 변경
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:383`(`isIdempotencyEntry` 내부 호출), `:397-403`(`isHttpStatusCode` 정의)
  - 상세: 종전에는 `-1`·`0`·`600`·`200.5` 같은 `statusCode` 를 가진 엔트리도 "유효"로 판정해 `res.status(...)`/`new HttpException(_, statusCode)` 로 흘려보냈다(express 가 전송 시점 `RangeError`→500). 변경 후에는 이런 엔트리가 "손상"으로 재분류되어 `discardCorruptEntry()` 를 거쳐 캐시를 버리고 `next.handle()` 로 재처리된다 — 캐시 hit 이 캐시 miss 로 강등되는 동작 변화다. 의도된 버그 수정이고, 이 API 자체가 100~599 밖 `statusCode` 를 생성하지 않으므로(파일 docstring·CHANGELOG 양쪽에 명시) 정상 운영 경로에서는 관측되지 않는다. Redis 에 우연히 그런 손상 엔트리가 이미 있었다면 배포 시점에 그 키에 한해 1회성으로 "캐시 miss + 재실행" 이 발생할 수 있다는 점만 기록해 둔다.
  - 제안: 조치 불요 — CHANGELOG(`CHANGELOG.md:3-18`)에 이미 클라이언트 영향이 명시돼 있다.

- **[INFO]** `if (!rawKey || …)` → `if (rawKey === null || …)` 전환은 현재는 순수 리팩터이지만, `readKey()` 의 "빈 문자열을 반환하지 않는다" 계약에 암묵적으로 의존하게 됐다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:112-113`(호출부), `:423-427`(`readKey` 구현)
  - 상세: `readKey()` 는 non-string → `null`, trim 후 빈 문자열 → `null`, `MAX_KEY_LENGTH` 초과 → `null` 세 사유만 `null` 을 반환하고 그 외에는 항상 "trim 된 비어있지 않은 문자열" 을 반환하도록 구현돼 있어, 현재 코드 기준으로는 `!rawKey` 와 `rawKey === null` 이 완전히 동일한 분기 결과를 낸다(diff 주석·plan 완료 노트가 뮤테이션으로 이를 검증했다고 기록). 다만 이 전환으로 "빈 문자열을 캐시 skip 조건으로 잡아 주던 이중 방어" 가 단일 지점(`readKey`)으로 좁혀졌다 — 앞으로 `readKey` 에 새 반환 경로가 추가되면서 실수로 `''` 를 반환하는 경우가 생기면, 호출부는 더 이상 그것을 걸러내지 못하고 `` `${REDIS_KEY_PREFIX}${executionId}:${route}:` `` 형태의(키 부분이 빈) Redis 키가 그대로 사용된다. 지금 시점에는 실제 위험이 없고 설계 의도(책임 분리)도 문서화돼 있어 결함은 아니다.
  - 제안: 조치 불요 — 회귀 방지용으로 이미 `readKey` JSDoc 에 반환 계약이 명시돼 있다(`idempotency.interceptor.ts:412-422`). 향후 `readKey` 를 수정할 때 "빈 문자열을 반환하지 않는다" 불변식을 깨지 않는지만 유의하면 된다.

- **[INFO]** 공유 테스트 헬퍼 `makeContext()` 의 `body` 정규화 규약 변경 — 파일 전체 호출부에 영향 범위지만 회귀 없음을 grep 으로 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:137`(변경된 줄), `:1360-1372`(신규 동등성 테스트가 이 변경을 요구하는 지점)
  - 상세: `body: opts.body ?? {}` → `body: 'body' in opts ? opts.body : {}`. `makeContext()` 는 파일 내 모든 `describe` 블록이 공유하는 헬퍼라, `body` 키를 생략한 호출은 여전히 `{}` 로 정규화되지만 `body: undefined`/`body: null` 을 **명시**한 호출은 이제 그대로 전달된다. 파일 전체 `makeContext(` 호출부를 확인한 결과 기존 호출은 전부 리터럴 객체 또는 항상 초기화된 변수만 넘기고, `body` 키 자체를 생략한 호출도 동일하게 `{}` 로 귀결되어 조용히 깨지는 기존 테스트는 없다. 프로덕션 코드·시그니처에는 영향 없는 test-only 변경이다.
  - 제안: 조치 불요 — 동적 `body` 값을 넘기는 신규 호출부를 추가할 때 "키 생략"과 "값이 undefined" 를 혼동하지 않도록만 유의.

- **[INFO]** `review/code/2026/08/13/00_54_18/**` 신규 파일 11개(리뷰 산출물) 커밋 포함 — 코드 실행이 만든 부작용이 아니라 프로젝트 관행에 따른 의도된 아카이빙
  - 위치: `review/code/2026/08/13/00_54_18/{RESOLUTION.md,SUMMARY.md,_retry_state.json,meta.json,documentation.md,maintainability.md,requirement.md,scope.md,security.md,side_effect.md,testing.md}`
  - 상세: 전부 이전 리뷰 라운드의 산출 문서/상태 파일이며, `CLAUDE.md` 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 규약에 정확히 부합한다. 런타임 코드(인터셉터)가 파일시스템에 쓰기를 하는 것이 아니라 리뷰 워크플로 자체의 정상 출력이다.
  - 제안: 조치 불요.

전역 변수의 **가변** 도입, 예상치 못한 파일시스템 생성/수정/삭제, 환경 변수 읽기/쓰기, 의도치 않은 네트워크 호출, 공개 인터페이스(생성자·`intercept()` 시그니처) 변경은 이번 diff 범위에서 발견되지 않았다. Redis I/O(`get`/`set`)는 기존 로직 그대로이고 새로 추가된 호출은 없다. `cacheTapped()` 의 `tap`/`catchError` 콜백 배선도 이번 diff 에서 변경되지 않았다(이미 이전 라운드에 확정된 코드로, 전체 파일 컨텍스트에는 보이지만 diff hunk 밖이다). 신규 `Logger.prototype.warn` 스파이 테스트(`idempotency.interceptor.spec.ts:1396-1424`)는 `try/finally { warnSpy.mockRestore() }` 로 기존 파일 패턴을 그대로 따라, 테스트 간 전역 mock 누수 위험도 없다.

## 요약

이번 diff(원 구현 + `00_54_18` 라운드 RESOLUTION 반영분)는 `idempotency.interceptor.ts` 의 `statusCode` 유효성 판정 강화(`isHttpStatusCode()`)와 `rawKey` null 판정의 명시화, 그리고 그에 대응하는 테스트 13건 신설이 전부다. 공개 인터페이스(생성자·`intercept()` 시그니처)는 변하지 않았고, 신규 모듈 상수는 불변 스코프 상수라 위험한 전역 상태가 아니며, 파일시스템·환경변수·네트워크·이벤트/콜백 배선에도 의도치 않은 변경이 없다. 유일하게 주시할 지점은 (1) 공유 테스트 헬퍼 `makeContext()` 의 `body` 정규화 규약 변경(회귀 없음을 grep 으로 확인됨)과 (2) `rawKey === null` 전환이 `readKey()` 의 "빈 문자열 미반환" 불변식에 암묵적으로 의존하게 된 점인데, 둘 다 현재 코드 기준으로는 안전하고 각각 주석·JSDoc 으로 문서화돼 있다. `review/code/2026/08/13/00_54_18/**` 아래 신규 리뷰 산출물 파일들은 코드가 만드는 부작용이 아니라 프로젝트가 명시적으로 정한 저장 위치 규약에 따른 정상 아카이빙이다.

## 위험도

NONE
