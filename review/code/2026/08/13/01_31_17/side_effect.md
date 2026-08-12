# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 신규 모듈 상수 `MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` — 전역 가변 상태 아님
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:25-26`
  - 상세: 모듈 최상단에 `const` 로 추가됐고 export 되지 않으며 재할당도 없다. 같은 파일의 기존 `MAX_KEY_LENGTH`/`TTL_SEC`/`REDIS_KEY_PREFIX` 와 동일한 패턴이라 side-effect 관점의 "전역 변수" 위험(공유 가변 상태)에 해당하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `isIdempotencyEntry()` 의 `statusCode` 판정이 `typeof === 'number'` → `isHttpStatusCode()` 로 좁혀져, 캐시 hit 이 캐시 miss(신규 처리)로 강등되는 경로가 새로 생긴다 — 의도된 동작 변경
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:383`(`isIdempotencyEntry` 내부 호출), `:397-403`(`isHttpStatusCode` 정의)
  - 상세: 종전에는 `-1`·`0`·`600`·`200.5` 같은 `statusCode` 를 가진 엔트리도 "유효"로 판정해 그대로 `res.status(...)`/`new HttpException(_, statusCode)` 로 흘려보냈다(express 가 전송 시점에 `RangeError`→500). 변경 후엔 이런 엔트리가 `discardCorruptEntry()` 경로로 재분류돼 `logger.warn()` 을 새로 emit 하고 캐시를 버린 뒤 `next.handle()` 로 재처리한다 — "이벤트/콜백" 관점에서 새 warn 이벤트 발생 경로가 늘었고, 다운스트림 핸들러가 (종전엔 안 불렸을 상황에) 실제로 다시 호출된다. 이 API 자체가 100~599 밖 `statusCode` 를 생성하지 않으므로(클래스 docstring·CHANGELOG 양쪽에 명시) 정상 운영 경로에서는 관측되지 않지만, Redis 에 우연히 그런 손상 엔트리가 이미 떠 있었다면 배포 시점에 그 키에 한해 1회성 "캐시 miss + 재실행" 이 발생할 수 있다.
  - 제안: 조치 불요 — CHANGELOG(`CHANGELOG.md` 신규 Unreleased 항목)에 클라이언트 영향이 이미 명시돼 있다.

- **[INFO]** `if (!rawKey || …)` → `if (rawKey === null || …)` 전환은 현재는 순수 리팩터이지만, `readKey()` 의 "빈 문자열을 반환하지 않는다"는 암묵적 계약에 호출부가 새로 의존하게 됐다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:112-113`(호출부 `rawKey === null` 판정), `:423-428`(`readKey` 구현)
  - 상세: `readKey()` 는 non-string → `null`, trim 후 빈 문자열 → `null`, `MAX_KEY_LENGTH` 초과 → `null` 세 사유만 `null` 을 반환하고 그 외엔 항상 "trim 된 비어있지 않은 문자열"을 반환하므로, 현재 코드 기준으로는 `!rawKey` 와 `rawKey === null` 이 완전히 동일한 분기 결과를 낸다. 다만 이 전환으로 "빈 문자열을 캐시 skip 조건으로 잡아 주던 이중 방어"가 단일 지점(`readKey`)으로 좁혀졌다 — 향후 `readKey` 가 실수로 `''` 를 반환하는 경로를 추가하면, 호출부는 더 이상 그것을 걸러내지 못하고 키 세그먼트가 빈 Redis 키(`` `${REDIS_KEY_PREFIX}${executionId}:${route}:` ``)가 그대로 쓰인다. 지금 시점엔 실제 위험 없음 — `readKey` JSDoc(gate 412-422)이 반환 계약을 명시한다.
  - 제안: 조치 불요. 향후 `readKey` 를 수정할 때 "빈 문자열 미반환" 불변식을 깨지 않는지만 유의.

- **[INFO]** 공유 테스트 헬퍼 `makeContext()` 의 `body` 정규화 규약 변경 — 파일 전체 호출부(약 40여 곳)에 영향 범위지만 회귀 없음 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — `makeContext()` 함수 정의 (`body: 'body' in opts ? opts.body : {}` 부분, `req` 객체 리터럴 안)
  - 상세: `body: opts.body ?? {}` → `body: 'body' in opts ? opts.body : {}` 로 바뀌었다. `makeContext()` 는 파일 내 모든 `describe` 블록이 공유하는 헬퍼라, `body` 키를 생략한 호출은 여전히 `{}` 로 정규화되지만 `body: undefined`/`body: null` 을 **명시**한 호출은 이제 그대로 전달된다. 이 파일의 `makeContext(` 호출부를 직접 확인한 결과 기존 호출은 전부 리터럴 객체 또는 항상 초기화된 변수만 넘기고 `body` 키 자체를 생략한 호출도 동일하게 `{}` 로 귀결돼, 조용히 깨지는 기존 테스트는 없다. 프로덕션 코드·공개 시그니처에는 영향 없는 test-only 변경이다.
  - 제안: 조치 불요 — 향후 동적 `body` 값을 넘기는 신규 호출부를 추가할 때 "키 생략"과 "값이 명시적 undefined"를 혼동하지 않도록만 유의.

- **[INFO]** `review/code/2026/08/13/{00_54_18,01_10_52}/**`, `review/consistency/2026/08/1{2/23_36_14,3/01_10_53}/**` 등 신규 파일 다수(리뷰 산출물) — 런타임 코드가 아니라 리뷰 워크플로가 만든 정상 아카이빙
  - 위치: 해당 각 디렉토리 아래 `RESOLUTION.md`/`SUMMARY.md`/`_retry_state.json`/`meta.json`/개별 reviewer `.md`
  - 상세: `CLAUDE.md` 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`", "일관성 검토 산출물 → `review/consistency/...`" 저장 규약에 정확히 부합하는 파일이며, 이 diff 가 심사 대상으로 삼는 인터셉터/스펙/plan 코드 실행이 만든 파일시스템 부작용이 아니다.
  - 제안: 조치 불요.

전역 변수의 **가변** 도입, 예상치 못한 파일시스템 생성/수정/삭제, 환경 변수 읽기/쓰기, 의도치 않은 네트워크 호출, 공개 인터페이스(생성자·`intercept()` 시그니처) 변경은 이번 diff 범위에서 발견되지 않았다. Redis I/O(`get`/`set`)는 기존 로직 그대로이고 새로 추가된 호출은 없다(`storeEntry`/`cacheTapped`/`discardCorruptEntry` 배선은 이번 diff 밖). 신규 `Logger.prototype.warn` 스파이 테스트(`statusCode` 경계값 `it.each` 블록)는 `try { … } finally { warnSpy.mockRestore(); }` 로 파일 전역 관행을 그대로 따라, 테스트 간 mock 누수 위험이 없다. `intercept()`/`readKey()`/`isIdempotencyEntry()` 등 모든 함수 시그니처는 변경 전과 동일하고, `isHttpStatusCode()` 는 module-private 신설 함수라 외부 호출자에 영향이 없다.

## 요약

이번 diff(`idempotency.interceptor.ts` 의 `statusCode` 유효성 판정 강화(`isHttpStatusCode()`) + `rawKey` null 판정 명시화, `idempotency.interceptor.spec.ts` 의 경계값 테스트 신설, `CHANGELOG.md`/plan 문서 갱신, 그리고 이전 리뷰 라운드 산출물 아카이빙)은 side-effect 관점에서 위험한 변경을 도입하지 않는다. 공개 인터페이스(생성자·`intercept()` 시그니처)는 불변이고, 신규 모듈 상수는 재할당 없는 불변 스코프 상수이며, 파일시스템·환경변수·네트워크 호출은 이번 diff 로 새로 생기거나 바뀌지 않았다. `isHttpStatusCode()` 판정 강화로 손상 엔트리가 caches-miss 로 강등돼 `logger.warn()` 을 새로 emit 하는 것은 CHANGELOG 에 명시된 의도된 변경이다. 유일하게 주시할 지점은 (1) 공유 테스트 헬퍼 `makeContext()` 의 `body` 정규화 규약 변경(전 호출부 grep 으로 회귀 없음 확인됨)과 (2) `rawKey === null` 전환이 `readKey()` 의 "빈 문자열 미반환" 불변식에 암묵적으로 의존하게 된 점인데, 둘 다 현재 코드 기준으로는 안전하고 각각 주석·JSDoc 으로 문서화돼 있다. review/ 아래 신규 파일들은 코드 실행이 만든 부작용이 아니라 프로젝트가 정한 저장 위치 규약에 따른 정상 산출물이다. CRITICAL/WARNING 급 side-effect 발견사항 없음.

## 위험도

NONE
