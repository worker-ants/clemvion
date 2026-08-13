# 보안(Security) 코드 리뷰 — `01_40_25`

## 대상

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 의 `rawKey` null 판정(`!rawKey` → `rawKey === null`), `isIdempotencyEntry()` 의 `statusCode` 검사(`typeof === 'number'` → 신설 `isHttpStatusCode()`, 정수+100~599 범위)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — `readKey`/`hashBody` 경계값 테스트(선언 9 / `it.each` 전개 후 실행 15) + `makeContext()` 헬퍼의 `body` mock 정규화 변경
- `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` — 문서/plan 갱신, 실행 코드 아님
- `review/code/2026/08/{12,13}/**`, `review/consistency/2026/08/{12,13}/**` — 이전 리뷰·consistency-check 라운드(`23_48_38`·`00_54_18`·`01_10_52`·`01_31_17`·`01_10_53`)의 정규 산출물이 신규/삭제 파일로 함께 커밋됨. 마크다운/JSON 보고서이며 실행 경로 없음

이번 라운드(`01_40_25`)는 앞선 세 차례 독립 라운드(`00_54_18`→`01_10_52`→`01_31_17`)가 모두 security 관점 **NONE** 으로 수렴한 뒤의 최종 확인이다. 프로덕션 파일(`idempotency.interceptor.ts`)을 `Read` 로 직접 열어 현재 상태를 재검증했다.

## 발견사항

- **[INFO]** 캐시 엔트리 `statusCode` 유효 범위 검사(100–599)가 실제 캐시 대상(2xx/409/410)보다 넓다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:397-403` (`isHttpStatusCode`, `MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` 는 `:25-26`)
  - 상세: `Number.isInteger(value) && value >= 100 && value <= 599` 는 `1xx`·`3xx`·`4xx`(예 `404`) 처럼 [Spec EIA §R8] 의 닫힌 목록(`2xx`/`409`/`410`) 밖의 값도 "손상 아님"으로 통과시킨다. 다만 이 값의 유일한 출처는 `storeEntry()`(`:314-341`)가 이전에 Redis 에 적재한 엔트리이고, `storeEntry()` 호출은 `cacheTapped()`(`:263-303`)를 거쳐 `2xx` 성공 채널 또는 `isErrorStatusCacheable()`(`:355-357`, `409`/`410` 만 허용)를 통과한 에러 채널로만 이뤄진다 — 즉 공격자가 직접 주입할 수 있는 사용자 입력 경로가 아니라, 서버 자신이 쓴 값을 되읽을 때의 2차 방어(express `RangeError`→500 방지)다. 이번 diff 는 종전(`typeof === 'number'` 만 검사, `-1`/`0`/`600`/`200.5` 까지 통과)보다 범위를 **좁힌** 방향이라 회귀가 아니라 개선이며, 닫힌 목록 자체는 `isErrorStatusCacheable()` 이 여전히 별도로 강제한다(관심사 분리 유지).
  - 제안: 급한 조치 불필요. 이미 3개 라운드(`security`/`requirement`/`rationale_continuity`)가 동일 결론(회색지대, INFO)에 도달했다. 필요하면 하한을 `200` 근처로 더 좁히는 것을 고려할 수 있으나 우선순위 낮음.

- **[INFO]** 손상 캐시 엔트리 로그가 원본 payload 값이 아니라 형태(type)만 남기도록 설계됨 — 긍정 관찰
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:405-410` (`describeShape()`, "손상 로그용 — 값 자체를 찍지 않는다")
  - 상세: `discardCorruptEntry()`(`:241-250`)가 남기는 warn 로그는 `describeShape(parsed)`(`typeof`/`'array'`/`'null'`)만 사용하고 캐시된 payload 원문(이전 요청/응답 body 를 포함할 수 있는 값)을 로그로 출력하지 않는다. 로그를 통한 민감정보 노출(§7 에러 처리) 관점에서 올바른 설계이며 이번 diff 로 변경되지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 이번 diff 의 프로덕션 코드 변경 2건은 모두 검증을 좁히거나 명시화하는 방향 — 새 공격 표면 없음
  - 위치: `idempotency.interceptor.ts:113` (`if (rawKey === null || !this.redis)`), `:397-403` (`isHttpStatusCode`)
  - 상세: `!rawKey` → `rawKey === null` 전환은 `readKey()`(`:423-428`)가 non-string·trim 후 빈 문자열·`MAX_KEY_LENGTH`(200) 초과 세 사유 모두를 `null` 로만 반환하도록 이미 구현돼 있어 런타임 분기 결과를 바꾸지 않는 순수 리팩터다(판정 책임을 `readKey` 로 명시적으로 모음). `isHttpStatusCode()` 신설은 손상된 `statusCode` 가 `res.status()`/`new HttpException(_, statusCode)` 로 흘러가 express 가 전송 시점에 `RangeError`(가용성 결함, 500)를 내는 경로를 막는다. 두 변경 모두 인젝션·인증 우회·비밀정보 노출로 이어지는 새 문자열 조립이나 외부 입력 신뢰 확장을 만들지 않는다.
  - 제안: 없음.

- **[INFO]** Redis 키 조립은 이번 diff 의 변경 대상이 아니며, 인젝션 벡터가 아님을 재확인
  - 위치: `idempotency.interceptor.ts:140` (`` `${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}` ``)
  - 상세: `rawKey` 는 `readKey()` 를 거쳐 문자열/trim/길이(≤200) 검증을 통과한 값만 들어오고, `executionId`(`:119`)는 `InteractionGuard` 가 토큰 검증 후 합성한 값이라 클라이언트가 직접 조작할 수 없다. Redis 는 키를 커맨드로 파싱하지 않으므로(콜론 포함 여부와 무관) `rawKey` 안에 콜론이 섞여도 접두사(`executionId:route:`)를 앞지르지 못해 다른 execution 의 캐시 엔트리로 충돌·오버라이트할 수 없다. 이 축은 이번 diff 로 변경되지 않았다.
  - 제안: 없음.

## 그 외 점검 결과 (해당 없음)

- **인젝션(SQL/XSS/커맨드/경로탐색)**: 이번 diff 는 문자열을 SQL 쿼리·셸 커맨드·파일 경로로 사용하지 않는다. 새로 열린 문자열 조립 지점 없음.
- **하드코딩된 시크릿**: 없음 — 테스트 파일도 jest mock(`makeRedis`/`makeContext`/`makeCallHandler`)뿐이며 실 자격증명·API 키·토큰 없음. `CHANGELOG.md`/`plan/**`/`review/**` 신규 파일 전수를 `password|secret|api[_-]?key|token|credential|BEGIN (RSA|EC|OPENSSH)|AKIA…` 패턴으로 grep 했고, 매치는 전부 이 diff 와 무관한 기존 CHANGELOG 본문(다른 기능의 토큰 회전/redaction 서술)과 `plan/**` 의 다른 항목(secret-store)뿐이었다.
- **인증/인가**: `InteractionGuard` 이후 실행되는 캐시 계층 내부 판정만 다루며, 인증/인가 로직 자체는 변경되지 않았다.
- **입력 검증**: `readKey()`(문자열 타입·trim·길이 상한)와 `isHttpStatusCode()`(정수·범위)가 이번 diff 로 각각 테스트로 고정·강화됨 — 방향은 항상 "좁힘"이다.
- **암호화**: `hashBody()`(`:430-435`)의 SHA-256 은 무결성 비교(같은 키 재요청 시 body 일치 확인) 목적이고 비밀정보 보호가 목적이 아니며 변경 없음. 평문 전송 이슈 없음(전송 계층은 이 파일의 관심사 밖).
- **에러 처리**: `describeShape()` 로 민감정보 미노출 유지(위 긍정 관찰 참고). warn 로그들(`:151-153`, `:246-248`, `:329-330`, `:337-339`)은 `err.message`/설명 문자열만 남기고 원본 캐시 payload 나 요청 body 를 찍지 않는다.
- **의존성 보안**: 이번 diff 는 `package.json`/lockfile 변경을 포함하지 않는다.
- **plan/CHANGELOG/review 산출물(md/json)**: 실행 코드가 아니며 보안 관점의 신규 공격 표면 없음. 절대경로가 다수 노출되지만(로컬 워크트리 경로) 통상적 리뷰 아티팩트 관행이며 자격증명이 아니다.

## 요약

이번 diff 는 `IdempotencyInterceptor` 의 기존 방어(키 유효성 판정, 캐시 엔트리 형태 검사)를 명시화·정밀화하는 하드닝과 그 경계값을 고정하는 테스트 15건(선언 9) 추가가 핵심이며, 여기에 CHANGELOG·plan 문서 갱신과 세 차례 선행 리뷰/consistency-check 라운드의 산출물이 신규 파일로 함께 커밋됐다. 프로덕션 코드 변경 2건(`rawKey === null` 명시 비교, `isHttpStatusCode()` 범위 검사)은 모두 기존보다 검증을 좁히는 방향이라 새로운 인젝션·인증 우회·시크릿 노출·안전하지 않은 암호화 표면을 열지 않는다는 것을 소스를 직접 읽어 재확인했다. 유일하게 짚을 만한 점(`statusCode` 100~599 허용 범위가 실제 캐시 대상보다 넓음)은 그 값의 유일한 출처가 서버 자신이 적재한 캐시이고 별도 함수(`isErrorStatusCacheable`)가 실질 화이트리스트를 담당하므로 공격자가 제어 가능한 입력 경로가 아니라 INFO 수준에 그치며, 이미 세 라운드가 동일 결론에 도달했다. Redis 키 조립·하드코딩 시크릿·에러 처리 민감정보 노출 등 다른 점검 항목에서도 신규 결함은 발견되지 않았다.

## 위험도

NONE
