# 보안(Security) 코드 리뷰

## 대상

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 의 `rawKey` null 판정을 `!rawKey` → `rawKey === null` 명시 비교로 전환, `isIdempotencyEntry()` 의 `statusCode` 형태 검사를 `typeof === 'number'` → 신설 `isHttpStatusCode()`(정수 + `MIN_HTTP_STATUS_CODE`~`MAX_HTTP_STATUS_CODE`, 100~599)로 강화
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — `readKey`/`hashBody` 경계값 `describe` 블록 신설(길이 상한 양쪽 · 공백뿐인 키 · trim · 배열 헤더 · 중복 헤더 조인 문자열 · 키 순서 · body nullish 동치 · statusCode 무효/유효 경계), `makeContext()` 헬퍼의 `body` 정규화를 `opts.body ?? {}` → `'body' in opts ? opts.body : {}` 로 변경
- `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` — 문서/plan 갱신 (실행 코드 아님)
- `review/code/2026/08/13/{00_54_18,01_10_52}/**`, `review/consistency/2026/08/13/01_10_53/**`, `review/consistency/2026/08/12/23_36_14/**`(삭제) — 이전 리뷰/일관성 검토 라운드의 정규 산출물(마크다운/JSON 보고서, 저장 규약 `review/code|consistency/<Y>/<M>/<D>/<hh_mm_ss>/` 부합). 실행 경로 없음.

## 검증 방법

- `idempotency.interceptor.ts` 전체 파일을 직접 `Read` 하여 diff 로 보이지 않는 주변 컨텍스트(Redis 키 조립, `InteractionGuard` 이후 실행 순서, `storeEntry`/`cacheTapped` 배선)까지 확인.
- `idempotency.interceptor.spec.ts` 의 신규 `describe('IdempotencyInterceptor — readKey / hashBody 경계값', …)` 블록 전문을 직접 `Read` — `eval`/원격 소켓 오픈/실 자격증명 등 위험 패턴 부재를 확인. `grep` 으로 `net.createServer`/`http.createServer`/`require(` 등 네트워크·동적 코드 실행 패턴이 테스트 본문에 없음을 확인(주석의 "raw socket 프로브"는 조사 과정의 수기 실험 기록이지 커밋된 테스트가 아님).
- 이 changeset 은 같은 프로덕션 코드에 대해 이미 두 차례 독립 보안 리뷰(`review/code/2026/08/13/00_54_18/security.md`, `review/code/2026/08/13/01_10_52/security.md`)를 거쳤고 둘 다 위험도 NONE — 이번 라운드는 그 결론에 기대지 않고 파일을 재대조해 독립적으로 재확인했다.

## 발견사항

- **[INFO]** 캐시 엔트리 `statusCode` 범위 검사(100–599)가 `1xx` 정보성 코드까지 "손상 아님"으로 허용한다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:397-403`(`isHttpStatusCode`), 상수 `:25-26`(`MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE`)
  - 상세: `Number.isInteger(value) && value >= 100 && value <= 599` 는 이론상 `100`(1xx) 도 통과시킨다. 이 값의 유일한 출처는 `storeEntry()`(같은 파일, `cacheTapped()` 를 통해서만 호출)가 이전에 Redis 에 적재한 엔트리이고, `storeEntry()` 는 성공 채널(`2xx`)이거나 `isErrorStatusCacheable()`(`409`/`410` 닫힌 목록)을 통과한 경우에만 호출된다 — 즉 정상 운영에서 100~199·404 같은 값이 캐시에 적재될 경로 자체가 없다. 공격자가 이 값을 직접 주입하려면 Redis 쓰기 권한이 필요하고, 그 시점에는 이 검사와 무관하게 훨씬 큰 문제(캐시 저장소 자체 침해)가 된다. 종전(`typeof === 'number'` 만 검사, `-1`/`0`/`600`/`200.5` 까지 통과 → express 전송 시점 `RangeError`→500)보다 범위를 **좁힌** 방향이라 회귀가 아니라 순수 개선이다.
  - 제안: 급한 조치 불필요. `isErrorStatusCacheable()` 이 실제 캐시 대상(§EIA R8 닫힌 목록)의 화이트리스트를 별도로 담당하는 의도된 관심사 분리이므로, 이 함수의 역할은 "express `RangeError` 방지" 로 한정해도 무방하다.

- **[INFO]** 손상 캐시 엔트리 로그가 원본 값이 아니라 형태(shape)만 남기도록 설계됨 — 긍정 관찰, 변경 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:406-410`(`describeShape()`, "손상 로그용 — 값 자체를 찍지 않는다")
  - 상세: `discardCorruptEntry()` 가 남기는 warn 로그는 `describeShape(parsed)`(`'null'`/`'array'`/`typeof`)만 사용하고, 캐시된 payload 원문(이전 요청/응답 body 를 포함할 수 있는 값)을 로그로 내보내지 않는다. 이번 diff 는 이 동작을 유지·확장할 뿐 변경하지 않았다. 로그를 통한 민감정보 노출(§7 에러 처리) 관점에서 올바른 설계.
  - 제안: 없음.

- **[INFO]** 이번 diff 의 프로덕션 코드 변경 2건은 모두 검증을 좁히거나 명시화하는 방향 — 새 공격 표면 없음
  - 위치: `idempotency.interceptor.ts:113`(`if (rawKey === null || !this.redis)`), `:397-403`(`isHttpStatusCode`)
  - 상세: `!rawKey` → `rawKey === null` 전환은 `readKey()` 가 이미 non-string/trim 후 빈 문자열/길이초과 세 경우 모두 `null` 만 반환하도록 구현돼 있어(`readKey` 본문 확인, `:423-428`) 런타임 분기 결과를 바꾸지 않는 순수 리팩터다. `isHttpStatusCode()` 신설은 손상된 `statusCode` 가 `res.status()`/`new HttpException(_, statusCode)` 로 흘러가 `RangeError`→500 을 유발하던 경로(가용성 결함)를 막는다. 둘 다 인젝션·인증우회·비밀정보 노출로 이어지는 새 문자열 조립·외부 입력 신뢰 확장이 없다.
  - 제안: 없음.

- **[INFO]** Redis 키 조립은 이번 diff 의 변경 대상이 아니며, 클라이언트 제어 부분(`rawKey`)이 이미 형태 제한을 통과한 값만 들어온다 — 확인, 신규 인젝션 벡터 아님
  - 위치: `idempotency.interceptor.ts:140`(`` `${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}` ``)
  - 상세: `executionId` 는 `InteractionGuard` 가 토큰 검증 후 합성한 값(클라이언트가 URL/헤더로 직접 주입 불가), `route` 는 `context.getHandler().name`(서버 코드가 결정), `rawKey` 는 `readKey()` 를 거쳐 문자열·trim·길이(≤200) 검증을 통과한 값만 들어온다. 신규 boundary 테스트가 확인한 대로 `rawKey` 에 콜론이나 임의 문자가 들어가도 항상 마지막 세그먼트에 붙을 뿐이라, `executionId` 축을 위조해 다른 execution 의 캐시를 조회/오염시킬 수 없다(스코프는 `executionId`·`route` 가 앞에서 고정). Redis 는 키를 커맨드로 파싱하지 않으므로 콜론 포함 여부와 무관하게 인젝션 벡터가 아니다.
  - 제안: 없음.

## 그 외 점검 결과 (해당 없음)

- **인젝션(SQL/XSS/커맨드/경로탐색)**: 이번 diff 는 문자열을 SQL 쿼리·셸 커맨드·파일 경로로 사용하지 않는다. 신규 테스트도 `eval`/동적 `require`/실제 소켓 오픈 없음(grep 확인).
- **하드코딩된 시크릿**: 없음 — 테스트 파일은 jest mock(`makeRedis`/`makeContext`/`makeCallHandler`)뿐이며 실 자격증명·API 키·토큰 없음. 신규 커밋된 리뷰 산출물(`review/code/**`, `review/consistency/**`)에도 시크릿 없음 — 로컬 워크트리 절대경로가 노출되나 이는 이 프로젝트의 통상적 리뷰 아티팩트 관행이며 자격증명이 아니다.
- **인증/인가**: `InteractionGuard` 이후 실행되는 캐시 계층 내부 판정만 다루며, 인증/인가 로직·실행 순서 자체는 변경되지 않았다.
- **입력 검증**: `readKey()`(문자열 타입·trim·길이 상한)와 `isHttpStatusCode()`(정수·범위)가 이번 diff 로 각각 테스트 신설·강화됨 — 방향은 항상 검증을 "좁히는" 쪽이다.
- **OWASP Top 10**: 신규 wire 계약·엔드포인트·DTO·권한 로직 변경이 없어 해당 축의 신규 노출 표면 없음.
- **암호화**: `hashBody()` 의 SHA-256 은 무결성 비교(같은 키 재요청 시 body 일치 확인) 목적이며 비밀정보 보호 목적이 아니고, 이번 diff 로 변경되지 않았다. 평문 전송 이슈 없음(전송 계층은 이 파일의 관심사 밖).
- **에러 처리**: `describeShape()` 로 민감정보 미노출 유지(위 긍정 관찰 참고). `discardCorruptEntry`/`storeEntry` 의 warn 로그 문자열은 `err.message`/`describeShape()` 만 사용해 캐시 payload 원문을 담지 않는다.
- **의존성 보안**: 이번 diff 는 `package.json`/lockfile 변경을 포함하지 않는다.
- **plan/CHANGELOG/review 산출물(md/json)**: 실행 코드가 아니며 보안 관점의 신규 공격 표면 없음.

## 요약

이번 changeset 의 실질 코드 변경은 `IdempotencyInterceptor` 의 기존 방어(키 유효성 판정, 캐시 엔트리 형태 검사)를 명시화·정밀화하는 하드닝과 그 경계값을 고정하는 테스트 신설이 전부이며, 여기에 CHANGELOG·plan 문서 갱신과 두 차례 선행 리뷰 라운드(`00_54_18`, `01_10_52`)의 산출물(RESOLUTION/SUMMARY/각 reviewer md, meta/재시도 상태 json, consistency 산출물)이 프로젝트 저장 규약에 맞게 함께 커밋됐다. 프로덕션 코드 변경 2건(`rawKey === null` 명시 비교, `isHttpStatusCode()` 범위 검사)은 모두 기존보다 검증을 좁히는 방향이라 새로운 인젝션·인증 우회·시크릿 노출·안전하지 않은 암호화 표면을 열지 않는다. Redis 키 조립 축(`executionId:route:rawKey`)도 이번 diff 의 변경 대상이 아니며 클라이언트 제어 값(`rawKey`)은 이미 형태 제한을 통과한 값만 사용돼 인젝션 벡터가 아님을 재확인했다. 유일하게 짚을 만한 점(`isHttpStatusCode()` 의 100~599 허용 범위가 실제 캐시 대상인 2xx/409/410 보다 넓음)은 그 값의 유일한 출처가 서버 자신이 적재한 캐시이고 별도 함수(`isErrorStatusCacheable`)가 실질 화이트리스트를 담당하므로 공격자가 제어 가능한 입력 경로가 아니라 INFO 수준에 그친다. 신규 커밋된 리뷰 산출물 md/json 파일들도 실행 코드가 아니며 시크릿·자격증명 노출이 없음을 확인했다. 이는 같은 코드를 대상으로 한 두 차례 선행 보안 리뷰(모두 NONE)와 일치하는 독립 재확인 결과다.

## 위험도

NONE
