# Security Review — `IdempotencyInterceptor` responseJson/엔트리 손상 방어 완성 + 형태 가드 (누적 diff `origin/main..HEAD`)

## 리뷰 범위

이번 diff(`origin/main..HEAD`, 5커밋)는 실질적으로 다음으로 구성된다.

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — 캐시 엔트리 바깥
  JSON 손상과 안쪽 `responseJson` 손상을 `discardCorruptEntry()`로 통합, 파싱 순서를 `bodyHash`
  판정 뒤로 고정, 그리고 마지막 커밋(`86de12278`)에서 `isIdempotencyEntry()` 형태(shape) 가드 +
  `describeShape()` 로그 헬퍼 신설.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — 대응 회귀
  테스트 다수(엔트리/`payload` 손상 warn, 판정 순서 캐너리, `null`/`42`/`[]`/`"str"` 형태-불일치 fixture
  각각 개별 검증).
- `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` — 문서 갱신, 코드 실행 경로
  아님.
- `review/code/2026/08/12/{23_24_08,23_36_13,23_48_38}/**`, `review/consistency/2026/08/12/**` — 이
  저장소의 표준 관례에 따라 커밋되는 이전 리뷰 세션들의 감사 아티팩트(정적 텍스트, 코드 실행 경로
  아님). 시크릿·자격증명 패턴(`password|secret|api[_-]?key|token|BEGIN ... PRIVATE KEY|AKIA...`)
  전수 grep 결과 히트 없음 — 모두 규약(secret URI scheme 등)을 설명하는 문서 텍스트일 뿐 실제
  시크릿 값은 없음.

프로덕션 코드는 이미 이전 3라운드(`23_24_08`→`23_36_13`→`23_48_38`)에서 security 관점 위험도
NONE 으로 반복 확인됐고, 각 라운드가 이전 라운드 WARNING(테스트 단언 보강, docstring/CHANGELOG
정합)을 실제로 반영했는지도 코드에서 대조했다. 이번 리뷰는 최신 코드 전문(`idempotency.interceptor.ts`,
400줄)을 직접 읽고 독립적으로 재검토한 결과다.

## 발견사항

- **[INFO]** 신설된 `isIdempotencyEntry()` 형태 가드는 `bodyHash`/`responseJson` 이 `string`,
  `statusCode` 가 `number` 인지만 확인하고 `statusCode` 의 값 범위(유효 HTTP 상태코드인지)는
  검증하지 않는다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` —
    `isIdempotencyEntry` 함수 정의(`function isIdempotencyEntry(value: unknown): value is IdempotencyEntry`)
  - 상세: `cached.statusCode` 는 이후 `isErrorStatusCacheable(cached.statusCode)` 비교, 그리고
    통과 시 `res.status(cached.statusCode)` / `new HttpException(cachedPayload, cached.statusCode)`
    에 그대로 흘러간다. `typeof === 'number'` 는 `NaN`·`Infinity`·음수·0·비정수도 통과시킨다.
    다만 이 값의 출처는 이 서비스 자신이 `storeEntry()` 를 통해서만 쓴 Redis 엔트리이고
    (`storeEntry` 는 `statusCode` 를 `res.statusCode` 또는 `err.getStatus()` 에서만 받아 항상
    유효한 HTTP 상태코드다), 외부에서 직접 조작 가능한 입력이 아니다 — Redis 쓰기 권한을 가진
    공격자를 전제해야 하는 낮은 실효성의 경로이며, 이는 앞선 세 라운드가 이미 동일 신뢰 경계
    논리로 "런타임 스키마 미검증"을 INFO/유예 처리한 것과 같은 성격이다.
  - 제안: 조치 불요. 향후 Redis 신뢰 경계가 넓어지는 변경(예: 외부에서 캐시 엔트리를 직접
    주입할 수 있는 API 신설)이 생기면 그때 `statusCode` 범위 검증을 추가할 것.

- **[INFO]** 손상 로그에 원본 예외 메시지(`err.message`)를 새니타이징 없이 템플릿 리터럴로 삽입
  (이론적 log-injection/log-forging, 실효 위험 낮음) — 선재 패턴이며 이번 diff 로 새 표면이
  생기지 않음.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` —
    `discardCorruptEntry` 메서드의 `this.logger.warn(...)` 호출, 동일 패턴이 `storeEntry` 의
    직렬화 실패·SET 실패 warn 에도 기존재.
  - 상세: `detail instanceof Error ? detail.message : String(detail)` 을 그대로 로그에 넣는다.
    이 값의 출처는 (a) 이 서비스가 자신의 Redis 엔트리를 파싱하다 낸 `SyntaxError.message`, 또는
    (b) 신설된 형태-불일치 분기에서는 `describeShape(parsed)` — `'null'|'array'|typeof` 문자열만
    반환하도록 **의도적으로 제한**돼 있어(캐시 payload 원본 값이 로그로 새지 않도록 함수 docstring이
    명시) 오히려 이번 diff 가 로그 위생을 개선한 자리다. `SyntaxError.message` 쪽은 V8 구현상
    손상된 JSON 문자열의 일부 스니펫을 포함할 수 있으나, 그 문자열의 출처는 이 서비스 자신이
    `storeEntry()` 로만 쓴 Redis 값이라 클라이언트가 직접 주입할 수 있는 경로가 아니다. NestJS
    `Logger` 는 개행을 이스케이프하지 않아 로그 위조 가능성 자체는 이론상 남지만, 그 표면은
    diff 이전부터 이 파일에 존재했다.
  - 제안: 조치 불요(risk 낮음). 구조화 로깅(`{ err }` 필드 분리)으로 전환하면 파일 전체의 로그
    위생이 개선되나 이 diff 의 결함이 아니다.

- **[INFO]** `cachedPayload`(안쪽 `responseJson` 파싱 결과)는 여전히 런타임 스키마 검증 없이
  `Record<string, unknown>` 으로 캐스팅돼 `HttpException` 생성자에 그대로 전달된다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` —
    `cachedPayload = JSON.parse(cached.responseJson)`(`try/catch` 로 문법 오류만 방어), 그리고
    `throw new HttpException(cachedPayload as Record<string, unknown>, cached.statusCode)`.
  - 상세: 이번 diff 는 바깥 엔트리(`IdempotencyEntry`)에는 `isIdempotencyEntry()` 형태 가드를
    새로 추가했지만, 안쪽 `responseJson` 을 다시 파싱한 결과(`cachedPayload`)에는 문법 오류
    방어(`try/catch`)만 있고 형태 검사는 없다 — 예를 들어 `responseJson` 이 `'"just a string"'`
    이어도 통과해 `of(cachedPayload)` 로 그대로 클라이언트에 반환되거나 `HttpException` 의
    body 로 쓰인다. 다만 `cachedPayload` 는 원래 `interaction.service.ts` 가 던진/반환한 실제
    응답을 `storeEntry()` 가 그대로 직렬화한 재현일 뿐이라(§`cacheTapped`), 클라이언트가 직접
    조작할 수 있는 입력이 아니고 이번 변경이 이 신뢰 경계를 넓히지도 않는다. 비대칭(엔트리는
    형태 검사, payload는 문법 검사만)이 있지만 위험이 실제로 커지는 지점은 없다.
  - 제안: 조치 불요. 일관성을 원하면 `cachedPayload` 도 최소 `typeof === 'object'` 검사를
    추가할 수 있으나, 이는 스타일/방어적 코딩 개선이지 이번 diff 가 만든 결함이 아니다.

- **[INFO]** 손상 파싱 실패가 이제 `500` 이 아니라 fail-open 으로 처리됨 — 보안 관점에서는
  정보 노출 축소(개선), 새 취약점 아님.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` —
    `discardCorruptEntry` 호출 두 자리(엔트리 파싱 실패, 형태 불일치, payload 파싱 실패).
  - 상세: 종전에는 안쪽 `responseJson` 파싱이 무방비여서 `SyntaxError` 가 `GlobalExceptionFilter`
    까지 올라가 `500`(스택트레이스 노출 여부는 필터의 프로덕션 설정에 좌우)이 됐다. 이번
    변경(및 최종 커밋의 형태 가드)은 그 예외 전파 경로 자체를 없애 클라이언트로 내부 예외 정보가
    전달될 가능성을 줄인다.
  - 제안: 없음.

- **[INFO]** `readKey()`의 `MAX_KEY_LENGTH = 200` 상한과 `hashBody()`의 SHA-256 사용은 이번
  diff 로 변경되지 않았고, 여전히 적절한 방어(과도하게 긴 Redis key 로 인한 자원 소모 방지,
  요청 body 를 code 경로/로그에 직접 삽입하지 않고 해시로만 사용)를 유지한다. 인젝션 표면
  (SQL/커맨드/경로 탐색) 후보는 이 파일에 없다 — Redis 접근은 파라미터화된 `get`/`set` 호출뿐이고
  문자열 concat 으로 조립하는 `redisKey` 도 `executionId`(Guard 가 토큰 검증 후 합성, 클라이언트가
  임의 조작 불가) · `route`(핸들러명, 코드 상수) · `rawKey`(길이 제한된 trim 문자열) 세 값으로만
  구성돼 커맨드 인젝션이나 키 네임스페이스 탈출 여지가 없다.
  - 위치: 해당 없음(확인만, 신규 발견 아님).
  - 제안: 없음.

## 요약

이번 diff 의 핵심 프로덕션 변경은 `IdempotencyInterceptor` 가 캐시 엔트리 바깥/안쪽 JSON 을
파싱할 때 문법 오류(`try/catch`)만이 아니라 **형태**(`isIdempotencyEntry` 신설)까지 검사하도록
완성한 것이다. 신규 사용자 입력 경로나 신뢰 경계 확장은 없다 — `cached.*`/`cachedPayload` 는
전부 이 서비스 자신이 Redis 에 기록한 값을 재현할 뿐이며, 원 요청 body/`Idempotency-Key` 헤더는
여전히 `readKey`(길이 제한) → `hashBody`(SHA-256) 로만 처리돼 코드 경로에 직접 삽입되지 않는다.
하드코딩된 시크릿, SQL/커맨드/경로 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘, 평문 전송은
발견되지 않았다. 로그에 원본 예외 메시지를 그대로 넣는 관례와 `cachedPayload` 의 런타임 스키마
미검증은 이 파일의 기존 패턴을 확장한 것일 뿐 새 위험이 아니며, 둘 다 "Redis 쓰기 권한"이라는
높은 전제를 요구해 실효 위험이 낮다. 오히려 이번 변경은 손상된 캐시가 `500`(예외 전파)으로
새던 경로를 없애 정보 노출 표면을 줄이는 방향이다. `review/**` 에 새로 커밋된 이전 리뷰
세션 아티팩트(RESOLUTION/SUMMARY/각 리뷰어 `.md`/`meta.json`/`_retry_state.json`)는 정적
텍스트 산출물로 시크릿 패턴 grep 결과 히트 없이 깨끗하며, `plan/in-progress/*.md`·`CHANGELOG.md`
변경은 문서 갱신뿐이라 보안 관점 검토 대상이 아니다. Critical/Warning 급 발견사항 없음 — 전부
INFO(기존 관례 확인 또는 개선 관찰).

## 위험도

NONE
