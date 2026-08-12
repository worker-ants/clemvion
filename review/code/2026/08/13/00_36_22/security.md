# Security Review — `IdempotencyInterceptor` responseJson 손상 방어 완성 + 형태 가드 강화 (누적 diff `origin/main..HEAD`)

## 리뷰 범위

`origin/main..HEAD`(6커밋)의 실질 변경은 다음으로 구성된다.

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — 캐시 엔트리 바깥
  JSON 손상과 안쪽 `responseJson` 손상을 `discardCorruptEntry()`로 통합, 파싱 순서를 `bodyHash`
  판정 뒤로 고정, `isIdempotencyEntry()` 형태(shape) 가드 + `describeShape()` 로그 헬퍼 신설. 이
  파일은 마지막 커밋(`c51809a0b`, 테스트 전용)에서는 변경되지 않았다 — 프로덕션 코드는
  `86de12278`(형태 가드 fix)이 최종.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — 대응 회귀
  테스트 다수(엔트리/`payload` 손상 warn, 판정 순서 캐너리, `null`/`42`/`[]`/`"str"`/필드-불일치
  형태 fixture 각각 개별 검증, 최종 커밋에서 `describeShape()` 반환값까지 단언 강화).
- `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` — 문서 갱신, 코드 실행
  경로 아님.
- `review/code/2026/08/12/{23_24_08,23_36_13,23_48_38}/**`, `review/code/2026/08/13/00_20_20/**`,
  `review/consistency/**` — 이 저장소의 표준 관례에 따라 커밋되는 이전 리뷰 세션들의 감사
  아티팩트(정적 텍스트, 코드 실행 경로 아님). 시크릿/자격증명 패턴
  (`password|secret|api[_-]?key|token|BEGIN ... PRIVATE KEY`) 전수 grep 결과 히트 없음 — 전부
  규약(secret URI scheme 등)을 설명하는 문서 텍스트일 뿐 실제 시크릿 값은 없음.

프로덕션 코드는 직전 네 라운드(`23_24_08`→`23_36_13`→`23_48_38`→`00_20_20`)에서 이미 security
관점 위험도 NONE 으로 반복 확인됐고, 각 라운드가 이전 WARNING(테스트 단언 보강, docstring/
CHANGELOG 정합)을 실제로 반영했는지도 코드 대조로 확인했다. 이번 라운드(`c51809a0b`)는 프로덕션
코드(`idempotency.interceptor.ts`) 변경이 없고 테스트/문서만 보강됐음을 `git show --stat` 로
확인했다 — 이번 리뷰는 최신 코드 전문을 직접 다시 읽고 독립적으로 재검토한 결과다.

## 발견사항

- **[INFO]** `cachedPayload`(안쪽 `responseJson` 재파싱 결과)는 여전히 런타임 스키마 검증 없이
  `Record<string, unknown>` 으로 캐스팅돼 `HttpException` 생성자·응답 본문에 그대로 전달된다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` —
    `intercept()` 내 `cachedPayload = JSON.parse(cached.responseJson)`(`try/catch` 로 문법 오류만
    방어), `throw new HttpException(cachedPayload as Record<string, unknown>, cached.statusCode)`.
  - 상세: 바깥 엔트리(`IdempotencyEntry`)에는 `isIdempotencyEntry()` 형태 가드가 있지만, 안쪽
    `responseJson` 재파싱 결과는 문법 오류 방어만 있고 형태 검사가 없다 — `responseJson` 이
    `'"just a string"'` 이어도 통과해 그대로 반환/재현된다. 다만 `cachedPayload` 는
    `interaction.service.ts` 가 던지거나 반환한 실제 응답을 `storeEntry()` 가 그대로 직렬화한
    재현일 뿐이라, 클라이언트가 직접 조작할 수 있는 입력이 아니고 이번 변경이 그 신뢰 경계를
    넓히지도 않는다. 비대칭(엔트리는 형태 검사, payload 는 문법 검사만)은 있으나 실질 위험이
    커지는 지점은 아니다.
  - 제안: 조치 불요. 일관성을 원하면 `cachedPayload` 에도 최소 `typeof === 'object'` 검사를
    추가할 수 있으나 이는 방어적 코딩 개선이지 이번 diff 의 결함이 아니다.

- **[INFO]** 손상 로그에 원본 예외 메시지(`err.message`)를 새니타이징 없이 템플릿 리터럴로 삽입
  (이론적 log-injection/log-forging, 실효 위험 낮음) — 선재 패턴이며 이번 diff 로 새 표면이
  생기지 않음.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` —
    `discardCorruptEntry` 메서드의 `this.logger.warn(...)` 호출, 동일 패턴이 `storeEntry` 의
    직렬화 실패·SET 실패 warn 에도 기존재.
  - 상세: `detail instanceof Error ? detail.message : String(detail)` 을 그대로 로그에 넣는다.
    형태-불일치 분기(`describeShape(parsed)`)는 `'null'|'array'|typeof` 문자열만 반환하도록
    의도적으로 제한돼 있어(캐시 payload 원본 값이 로그로 새지 않음, 최종 커밋에서 이 값을
    테스트로 고정까지 함) 오히려 로그 위생이 개선된 자리다. `SyntaxError.message` 쪽은 V8
    구현상 손상된 JSON 문자열의 일부 스니펫을 포함할 수 있으나, 그 문자열의 출처는 이 서비스
    자신이 `storeEntry()` 로만 쓴 Redis 값이라 클라이언트가 직접 주입할 수 있는 경로가 아니다.
    NestJS `Logger` 는 개행을 이스케이프하지 않아 로그 위조 가능성 자체는 이론상 남지만, 그
    표면은 diff 이전부터 이 파일에 존재했다.
  - 제안: 조치 불요(risk 낮음). 구조화 로깅(`{ err }` 필드 분리)으로 전환하면 파일 전체의 로그
    위생이 개선되나 이 diff 의 결함이 아니다.

- **[INFO]** `isIdempotencyEntry()` 형태 가드는 `bodyHash`/`responseJson` 이 `string`,
  `statusCode` 가 `number` 인지만 확인하고 `statusCode` 의 값 범위(유효 HTTP 상태코드인지)는
  검증하지 않는다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` —
    `isIdempotencyEntry` 함수 정의.
  - 상세: 이 값의 출처는 이 서비스 자신이 `storeEntry()` 를 통해서만 쓴 Redis 엔트리이고
    (`statusCode` 는 `res.statusCode` 또는 `err.getStatus()` 에서만 받아 항상 유효한 HTTP
    상태코드), 외부에서 직접 조작 가능한 입력이 아니다 — Redis 쓰기 권한을 가진 공격자를
    전제해야 하는 낮은 실효성의 경로. 직전 라운드(`00_20_20`)에서 이미 같은 근거로 INFO
    처리됐고, plan 문서(`backend-lint-gate-broken-on-main.md`)에 향후 재검토 트리거(분기 수
    증가 시)와 함께 명시적으로 이관돼 있음을 확인했다.
  - 제안: 조치 불요. Redis 신뢰 경계가 넓어지는 변경(외부에서 캐시 엔트리를 직접 주입할 수
    있는 API 신설 등)이 생기면 그때 재평가.

- **[INFO]** 손상 파싱 실패가 이제 `500`이 아니라 fail-open 으로 처리됨 — 보안 관점에서는
  정보 노출 축소(개선), 새 취약점 아님.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` —
    `discardCorruptEntry` 호출 세 자리(엔트리 파싱 실패, 형태 불일치, payload 파싱 실패).
  - 상세: 종전에는 안쪽 `responseJson` 파싱이 무방비여서 `SyntaxError` 가 `GlobalExceptionFilter`
    까지 올라가 `500`(프로덕션 설정에 따라 스택트레이스 노출 여부 갈림)이 됐다. 이번 변경은 그
    예외 전파 경로 자체를 없애 클라이언트로 내부 예외 정보가 전달될 가능성을 줄인다.
  - 제안: 없음.

- **[INFO]** `readKey()`의 `MAX_KEY_LENGTH = 200` 상한과 `hashBody()`의 SHA-256 사용은 이번
  diff 로 변경되지 않았고, 여전히 적절한 방어(과도하게 긴 Redis key 로 인한 자원 소모 방지,
  요청 body 를 로그/키에 직접 삽입하지 않고 해시로만 사용)를 유지한다. 인젝션 표면
  (SQL/커맨드/경로 탐색) 후보는 이 파일에 없다 — Redis 접근은 파라미터화된 `get`/`set` 호출뿐이고
  문자열 concat 으로 조립하는 `redisKey` 도 `executionId`(Guard 가 토큰 검증 후 합성, 클라이언트가
  임의 조작 불가) · `route`(핸들러명, 코드 상수) · `rawKey`(길이 제한된 trim 문자열) 세 값으로만
  구성돼 커맨드 인젝션이나 키 네임스페이스 탈출 여지가 없다.
  - 위치: 해당 없음(확인만, 신규 발견 아님).
  - 제안: 없음.

- **[INFO]** 테스트 파일(`idempotency.interceptor.spec.ts`)의 마지막 커밋 변경은 순수 단언
  강화(`describeShape()` 반환값 고정)와 docstring 갱신뿐 — 보안 관점 신규 표면 없음.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
    — `it.each` fixture 배열에 `expectedShape` 열 추가, `warnSpy` 단언에 형태 문자열 포함.
  - 상세: 프로덕션 코드는 이 커밋에서 변경되지 않았다(`git show c51809a0b --stat` 확인). 테스트
    데이터(`'null'`, `'42'`, `'[]'`, `'"str"'` 등)는 하드코딩된 mock JSON 문자열일 뿐 실제
    시크릿·자격증명이 아니다.
  - 제안: 없음.

## 요약

이번 diff 의 핵심 프로덕션 변경(`isIdempotencyEntry()` 형태 가드 + `discardCorruptEntry()` 통합
+ 파싱 순서 고정)은 신규 사용자 입력 경로나 신뢰 경계 확장을 만들지 않는다 — `cached.*`/
`cachedPayload` 는 전부 이 서비스 자신이 Redis 에 기록한 값을 재현할 뿐이며, 원 요청
body/`Idempotency-Key` 헤더는 여전히 `readKey`(길이 제한) → `hashBody`(SHA-256) 로만 처리돼
코드 경로에 직접 삽입되지 않는다. 하드코딩된 시크릿, SQL/커맨드/경로 인젝션, 인증 우회, 안전하지
않은 암호화 알고리즘, 평문 전송은 발견되지 않았다. 로그에 원본 예외 메시지를 그대로 넣는 관례와
`cachedPayload` 의 런타임 스키마 미검증은 이 파일의 기존 패턴을 확장한 것일 뿐 새 위험이 아니며,
둘 다 "Redis 쓰기 권한"이라는 높은 전제를 요구해 실효 위험이 낮다. 오히려 이번 변경은 손상된
캐시가 `500`(예외 전파)으로 새던 경로를 없애 정보 노출 표면을 줄이는 방향이다. 이번 라운드의
유일한 실질 변경(`c51809a0b`)은 프로덕션 코드를 건드리지 않는 테스트 단언 강화였다.
`review/**` 에 새로 커밋된 리뷰 세션 아티팩트(RESOLUTION/SUMMARY/각 리뷰어 `.md`/`meta.json`/
`_retry_state.json`)는 정적 텍스트 산출물로 시크릿 패턴 grep 결과 히트 없이 깨끗하며,
`plan/in-progress/*.md`·`CHANGELOG.md` 변경은 문서 갱신뿐이라 보안 관점 검토 대상이 아니다.
Critical/Warning 급 발견사항 없음 — 전부 INFO(기존 관례 확인 또는 개선 관찰), 대부분 직전
라운드에서 이미 동일 결론으로 확인된 항목의 재검증이다.

## 위험도

NONE
