# 보안(Security) 코드 리뷰

## 대상

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 의 `rawKey` null 판정을 `!rawKey` → `rawKey === null` 명시 비교로 전환, `isIdempotencyEntry()` 의 `statusCode` 형태 검사를 `typeof === 'number'` → 신설 `isHttpStatusCode()`(정수 + 100~599 범위)로 강화
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — `readKey`/`hashBody` 경계값 `describe` 블록(13개 케이스) 신설, `makeContext()` 헬퍼의 `body` 정규화를 `opts.body ?? {}` → `'body' in opts ? opts.body : {}` 로 변경
- `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` — 문서/plan 갱신 (실행 코드 아님)
- `review/code/2026/08/13/00_54_18/*` (RESOLUTION.md·SUMMARY.md·_retry_state.json·meta.json·각 reviewer md) — 직전 라운드 리뷰 산출물이 신규 파일로 커밋됨. 마크다운/JSON 보고서이며 실행 경로 없음

## 발견사항

- **[INFO]** 캐시 엔트리 `statusCode` 유효 범위 검사(100–599)가 `1xx` 정보성 코드까지 "손상 아님"으로 허용한다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:397` (`isHttpStatusCode`, `MIN_HTTP_STATUS_CODE = 100`)
  - 상세: `Number.isInteger(value) && value >= MIN_HTTP_STATUS_CODE && value <= MAX_HTTP_STATUS_CODE` 는 이론상 `100`(1xx) 도 통과시킨다. 하지만 이 값의 유일한 출처는 `storeEntry()`(`idempotency.interceptor.ts:314`)가 이전에 Redis 에 적재한 엔트리이고, `storeEntry()` 는 `cacheTapped()` 를 통해 `2xx`/`409`/`410` 인 경우에만 호출된다(`isErrorStatusCacheable()` 이 닫힌 목록을 별도로 강제). 즉 이 범위는 **사용자 입력을 직접 검증하는 경계가 아니라, 서버 자신이 쓴 값을 되읽을 때의 2차 방어**이며, 공격자가 이 값을 직접 주입하려면 이미 Redis 쓰기 권한이 필요하다(그 시점에는 이 검사와 무관하게 더 큰 문제). 이번 diff 는 오히려 종전(`typeof === 'number'` 만 검사, `-1`/`0`/`600`/`200.5` 까지 통과)보다 범위를 **좁힌** 방향이라 회귀가 아니라 개선이다.
  - 제안: 급한 조치 불필요. 필요하면 하한을 `200`(캐시 대상 최소 성공 코드)으로 더 좁히는 것을 고려할 수 있으나 우선순위 낮음 — `isErrorStatusCacheable()` 이 실질적 화이트리스트를 이미 담당하는 의도된 관심사 분리다.

- **[INFO]** 손상 캐시 엔트리 로그가 원본 값이 아니라 형태(type)만 남기도록 설계됨 — 긍정 관찰
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:406` (`describeShape()`, "손상 로그용 — 값 자체를 찍지 않는다")
  - 상세: `discardCorruptEntry()` 가 남기는 warn 로그는 `describeShape(parsed)`(`typeof`/`'array'`/`'null'`)만 사용하고 캐시된 payload 원문(잠재적으로 이전 요청·응답 body 를 포함할 수 있는 값)을 로그로 내보내지 않는다. 로그를 통한 민감정보 노출(§7 에러 처리) 관점에서 올바른 설계이며 이번 diff 로 변경되지 않았다(기존 동작 유지 확인).

- **[INFO]** 이번 diff 의 프로덕션 코드 변경 2건은 모두 검증을 좁히거나 명시화하는 방향 — 새 공격 표면 없음
  - 위치: `idempotency.interceptor.ts:113` (`if (rawKey === null || !this.redis)`), `:397-402` (`isHttpStatusCode`)
  - 상세: `!rawKey` → `rawKey === null` 전환은 `readKey()` 가 이미 빈 문자열/길이초과를 `null` 로 필터링하므로 런타임 분기 결과를 바꾸지 않는 순수 리팩터다(truthiness 대신 명시 비교로 판정 책임을 `readKey` 에 모으는 목적). `isHttpStatusCode()` 신설은 손상된 `statusCode` 가 `res.status()`/`new HttpException(_, statusCode)` 로 흘러가 express 가 전송 시점에 `RangeError`→500 을 내는 경로(정보 노출은 아니지만 가용성 결함)를 막는다. 두 변경 모두 인젝션·인증우회·비밀정보 노출로 이어지는 새 문자열 조립·외부 입력 신뢰 확장이 없다.

- **[INFO]** Redis 키 조립(`` `${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}` ``, `idempotency.interceptor.ts:140`)은 이번 diff 의 변경 대상이 아니며, `rawKey` 는 `readKey()` 를 거쳐 이미 문자열/trim/길이(≤200) 검증을 통과한 값만 들어온다. Redis 는 키를 커맨드로 파싱하지 않으므로(콜론 포함 여부와 무관) 인젝션 벡터가 아니다. `executionId` 는 `InteractionGuard` 가 토큰 검증 후 합성한 값이라 클라이언트가 직접 조작할 수 없다 — 조사 결과 이 축은 변경 없음을 확인.

## 그 외 점검 결과 (해당 없음)

- **인젝션(SQL/XSS/커맨드/경로탐색)**: 이번 diff 는 문자열을 SQL 쿼리·셸 커맨드·파일 경로로 사용하지 않는다. 새로 열린 문자열 조립 지점 없음.
- **하드코딩된 시크릿**: 없음 — 테스트 파일도 jest mock(`makeRedis`/`makeContext`/`makeCallHandler`)뿐이며 실 자격증명·API 키·토큰 없음. 신규 커밋된 리뷰 산출물(RESOLUTION.md 등)에도 시크릿 없음, 절대경로만 노출(로컬 워크트리 경로 — 통상적 리뷰 아티팩트 관행이며 자격증명 아님).
- **인증/인가**: `InteractionGuard` 이후 실행되는 캐시 계층 내부 판정만 다루며, 인증/인가 로직 자체는 변경되지 않았다.
- **입력 검증**: `readKey()`(문자열 타입·trim·길이 상한)와 `isHttpStatusCode()`(정수·범위)가 이번 diff 로 각각 테스트로 고정·강화됨 — 방향은 항상 "좁힘"이다.
- **암호화**: `hashBody()` 의 SHA-256 은 무결성 비교(같은 키 재요청 시 body 일치 확인) 목적이고 비밀정보 보호가 목적이 아니며 변경 없음. 평문 전송 이슈 없음(전송 계층은 이 파일의 관심사 밖).
- **에러 처리**: `describeShape()` 로 민감정보 미노출 유지(위 긍정 관찰 참고).
- **의존성 보안**: 이번 diff 는 `package.json`/lockfile 변경을 포함하지 않는다.
- **plan/CHANGELOG/review 산출물(md/json)**: 실행 코드가 아니며 보안 관점의 신규 공격 표면 없음.

## 요약

이번 diff 는 `IdempotencyInterceptor` 의 기존 방어(키 유효성 판정, 캐시 엔트리 형태 검사)를 명시화·정밀화하는 하드닝과 그 경계값을 고정하는 테스트 13건 추가가 핵심이며, 여기에 CHANGELOG·plan 문서 갱신과 직전 리뷰 라운드(`00_54_18`)의 산출물(RESOLUTION/SUMMARY/각 reviewer md, meta/재시도 상태 json)이 신규 파일로 함께 커밋됐다. 프로덕션 코드 변경 2건(`rawKey === null` 명시 비교, `isHttpStatusCode()` 범위 검사)은 모두 기존보다 검증을 좁히는 방향이라 새로운 인젝션·인증 우회·시크릿 노출·안전하지 않은 암호화 표면을 열지 않는다. 유일하게 짚을 만한 점(`statusCode` 100~599 허용 범위가 실제 캐시 대상인 2xx/409/410보다 넓음)은 그 값의 유일한 출처가 서버 자신이 적재한 캐시이고 별도 함수(`isErrorStatusCacheable`)가 실질 화이트리스트를 담당하므로 공격자가 제어 가능한 입력 경로가 아니라 INFO 수준에 그친다. 신규 커밋된 리뷰 산출물 md/json 파일들도 실행 코드가 아니며 시크릿·자격증명 노출이 없음을 확인했다.

## 위험도

NONE
