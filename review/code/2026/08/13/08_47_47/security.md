# 보안(Security) 코드 리뷰

## 대상

이번 라운드(`08_47_47`)의 실제 코드(`codebase/**`) 변경은 `git diff origin/main...HEAD -- codebase/`
로 직접 확인한 결과 다음 2개 파일로 한정된다(다른 62개 파일은 `CHANGELOG.md`·`plan/**`·
`review/**` 문서/리뷰 산출물이며 실행 코드가 아니다):

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`

전체 파일을 `Read` 로 직접 열어(프롬프트에 전체 컨텍스트가 실리지 않아) 대조했다.

## 발견사항

- **[INFO]** 캐시 엔트리 `statusCode` 유효 범위(100–599)가 이 인터셉터가 실제로 쓰는 상태코드
  (2xx/409/410)보다 넓다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:397-402`
    (`isHttpStatusCode`)
  - 상세: `Number.isInteger(value) && value >= MIN_HTTP_STATUS_CODE(100) && value <= MAX_HTTP_STATUS_CODE(599)`.
    `1xx` 정보성 코드처럼 이 API 가 결코 만들지 않는 값도 "유효"로 통과해, 만약 캐시에 그런
    값이 적재돼 있다면 `res.status(cached.statusCode)` 로 그대로 재현된다. 다만 이 값의 유일한
    쓰기 경로는 `storeEntry()`(코드 314-341행)이고, 그 호출부는 성공 채널의 2xx(`cacheTapped`,
    272-278행)와 `isErrorStatusCacheable()` 이 허용한 409/410(286-297행) 뿐이라 **외부 입력이
    도달할 수 없는 서버 전용 쓰기 경로**다. Redis 자체도 클라이언트에 노출되지 않는다. 즉 신규
    취약점이 아니라 방어 범위의 이론적 여백이며, 이 함수의 문서화된 목적(`express RangeError`
    → 500 방지)은 정확히 달성된다.
  - 제안: 급한 조치 불필요. 필요하면 `value >= 200`(실제 캐시 대상이 2xx/409/410 뿐이므로)으로
    하한을 좁힐 수 있으나, `isErrorStatusCacheable()` 이 이미 닫힌 목록을 별도로 담당하므로
    관심사 분리를 유지하는 현재 설계도 타당하다.

- **[INFO]** `isHttpStatusCode()` 신설 + `rawKey === null` 명시 비교 전환은 취약점 도입이 아니라
  입력 검증 강화
  - 위치: `idempotency.interceptor.ts:113`(`if (rawKey === null || !this.redis)`),
    `:397-402`(`isHttpStatusCode`), `:377-385`(`isIdempotencyEntry`)
  - 상세: 종전 `typeof e.statusCode === 'number'` 는 `-1`/`0`/`600`/`200.5` 를 "유효한 엔트리"로
    오인해 `res.status(-1)`/`new HttpException(payload, -1)` 로 흘려보내 express `RangeError`
    →500 을 유발했다(캐시 손상 하나가 요청 실패가 되는, fail-open 원칙 위반). `isHttpStatusCode()`
    는 정수+범위 검사로 이를 막고, 손상으로 판정된 엔트리는 `discardCorruptEntry()` 를 거쳐
    신규 처리로 강등된다(무한 루프·크래시 없음, warn 로그만 남김). `!rawKey` → `rawKey === null`
    전환은 `readKey()` 가 항상 `null` 또는 trim 후 1~200자 비어있지 않은 문자열만 반환하도록
    보장돼 있어(423-428행) 실제 분기 결과를 바꾸지 않는 리팩터다. 두 변경 모두 입력을 더 엄격히
    거부하는 방향이며, 인증 우회·권한 상승·정보 노출 등 새 공격 표면을 열지 않는다.
  - 제안: 없음.

- **[INFO]** Redis 키 조립(`${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}`, 140행)에 새로운
  인젝션 표면 없음
  - 위치: `idempotency.interceptor.ts:140`
  - 상세: `executionId` 는 `InteractionGuard` 가 토큰 검증 후 합성한 서버측 값(118행 주석),
    `route` 는 `context.getHandler().name`(138행)으로 둘 다 클라이언트가 직접 제어할 수 없다.
    `rawKey` 만 클라이언트 입력이며 `readKey()` 가 문자열 타입·비어있지 않음·200자 이하로
    제한한다(423-428행). ioredis 는 키를 opaque 문자열 인자로 다루므로(Lua/EVAL 조립이 아님)
    콜론 포함 여부와 무관하게 Redis 커맨드 인젝션 표면이 없다. `rawKey` 에 `:` 를 섞어도
    영향받는 네임스페이스는 여전히 같은 `executionId` 범위 안이라(Guard 가 검증한 자신의
    실행 컨텍스트) 타 사용자 데이터 충돌·크로스 테넌트 유출 경로가 되지 않는다. 이번 diff 로
    새로 열린 표면 없음.

- **[INFO]** 손상 로그가 캐시 payload 값이 아니라 형태(`typeof`/`array`/`null`)만 기록 — 긍정 관찰,
  변경 없음
  - 위치: `idempotency.interceptor.ts:405-410`(`describeShape`), `:246-249`(`discardCorruptEntry`
    의 `logger.warn` 호출)
  - 상세: `/** 손상 로그용 — 값 자체를 찍지 않는다(캐시 payload 가 로그로 새지 않도록) */` 주석대로
    실제 로그 문자열에는 캐시 엔트리의 원본 내용이 포함되지 않는다. 캐시된 응답 body 가 민감
    정보를 담을 수 있는 상황에서 로그를 통한 정보 노출(§7 에러 처리 관점)을 원천 차단하는
    설계로, 이번 diff 도 이 관행을 그대로 유지한다.

## 그 외 점검 결과 (해당 없음/변경 없음)

- **인젝션(SQL/XSS/커맨드/경로탐색)**: 해당 diff 는 SQL·셸·파일 경로 조립을 하지 않는다. 위
  Redis 키 조립 항목 참고.
- **하드코딩된 시크릿**: `git diff origin/main...HEAD` 전체(64개 파일)를
  `password|secret|api[_-]?key|token|credential|BEGIN (RSA|EC|OPENSSH)` 패턴으로 grep —
  매치는 전부 `idempotency-key`/`IDEMPOTENCY_HEADER` 같은 무관한 식별자와 기존 문서 서술뿐이며
  실 자격증명·키·토큰은 없음.
- **인증/인가**: `InteractionGuard` 이후 실행되는 캐시 계층 내부 판정만 다루며, 이번 diff 는
  가드·인증 로직 자체를 건드리지 않는다.
- **암호화**: `hashBody()` 의 SHA-256 은 무결성 비교(멱등 키 충돌 판정) 용도이며 비밀정보 보호
  목적이 아니다 — 변경 없음, 용도에 적합.
- **의존성 보안**: 이번 diff 는 `package.json`/lockfile 변경을 포함하지 않는다. import 목록도
  기존과 동일(`@nestjs/common`, `rxjs`, `crypto`, `ioredis` 타입).
- 나머지 62개 파일(`CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md`,
  `review/code/**`, `review/consistency/**`)은 순수 문서/리뷰 산출물이며 실행 코드·설정·시크릿을
  포함하지 않아 보안 검토 대상 표면이 아니다(모두 열람해 확인).

## 요약

이번 라운드에서 실제로 실행되는 코드 변경은 `idempotency.interceptor.ts`/`.spec.ts` 두 파일뿐이며,
성격은 순수 하드닝이다 — 캐시 엔트리 `statusCode` 형태 검증을 `typeof === 'number'` 에서 정수+
유효범위(100–599) 검사로 강화해 손상 엔트리가 `RangeError`→500 을 유발하던 결함을 막고, 키 존재
판정을 truthiness 에서 명시적 `null` 비교로 좁혀 판정 책임을 한 곳(`readKey`)으로 모았다. 두
변경 모두 입력을 더 엄격히 거부하는 방향이고 새로운 인젝션·인증 우회·시크릿 노출·역직렬화 공격
표면을 만들지 않는다. Redis 키 조립에 쓰이는 세 요소 중 둘(`executionId`/`route`)은 서버 전용
값이고 나머지(`rawKey`)는 타입·길이·비어있음이 이미 제한돼 있어 커맨드 인젝션이나 크로스 테넌트
충돌 경로가 없다. 유일하게 짚어 둘 점(`isHttpStatusCode` 의 허용 범위가 이 인터셉터의 실제 쓰기
경로보다 넓다)도 그 값이 전적으로 서버 자신이 적재한 캐시에서만 오므로 공격자가 제어할 수 있는
입력 경로가 아니다. CHANGELOG·plan·review 산출물 등 나머지 62개 파일은 전부 비실행 문서이며
시크릿 스캔 결과도 깨끗하다. Critical/Warning 없음.

## 위험도

NONE
