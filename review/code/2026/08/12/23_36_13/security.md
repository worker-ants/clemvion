# Security Review — IdempotencyInterceptor 캐시 엔트리/`responseJson` 손상 방어 통합 + WARNING 후속 조치

## 리뷰 범위

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — 바깥 엔트리 JSON
  손상과 안쪽 `responseJson` 손상 처리를 `discardCorruptEntry()` 로 통합, 파싱 순서를 `bodyHash`
  판정 뒤로 고정, warn 로그 추가(이 diff 의 핵심 변경).
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — 위 방어에
  대한 회귀 테스트(엔트리/`payload` 손상 warn, 판정 순서 캐너리, 에러 재현 분기 자매) + docstring 보강.
- `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` — 문서 갱신(코드 변경 없음).
- `review/code/2026/08/12/23_24_08/*` — 직전 리뷰 라운드(`23_24_08`)의 산출물(SUMMARY/RESOLUTION/
  각 리뷰어 `.md`/`_retry_state.json`/`meta.json`)이 이번 diff 로 신규 커밋됨. 정적 텍스트 산출물이며
  코드 실행 경로가 아니다. 시크릿·자격증명 패턴 grep(`password|secret|api[_-]?key|token|BEGIN ...`)
  전수 조회 결과 히트 없음.

이번 diff 는 직전 리뷰 라운드(`23_24_08`)의 security WARNING 없음 판정(위험도 NONE)을 그대로 이어받는
성격의 후속 커밋이다 — 프로덕션 로직 변경은 이미 그 라운드에서 검토된 것과 동일하고, 이번 라운드는
그 라운드의 WARNING #1~#3(테스트 단언 보강·docstring 갱신·CHANGELOG 추가)을 반영한 산출물이다.
독립적으로 재검토했다.

## 발견사항

- **[INFO]** 손상 캐시 항목 처리 시 원본 예외 메시지를 로그에 그대로 삽입 (이론적 log-injection, 실효 위험 낮음)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:224-226`
    (`discardCorruptEntry` — `this.logger.warn(\`IdempotencyInterceptor cache ${what} 손상 …
    ${err instanceof Error ? err.message : String(err)}\`)`), 동일 패턴이 `:307-309`(`storeEntry`
    직렬화 실패)·`:315-317`(`storeEntry` SET 실패)에도 기존재.
  - 상세: `err.message` 를 새니타이징 없이 템플릿 리터럴로 조립해 `Logger.warn` 에 넘긴다. 이 값의
    출처는 이 서비스가 `storeEntry()`(`idempotency.interceptor.ts:308-318`)로만 직접 기록한 Redis
    엔트리의 파싱 실패(`SyntaxError.message`) 뿐이다. 공격자가 이 메시지 내용을 조작하려면 Redis
    쓰기 권한(이미 인프라 침해 전제)이 필요해 신뢰 경계가 넓어지지 않는다. NestJS `Logger` 가 개행을
    이스케이프하지 않아 로그 위조(CRLF log forging) 가능성 자체는 이론상 남지만, 이번 diff 가 새로
    만든 표면이 아니라 이 파일의 기존 warn 로깅 패턴을 손상-엔트리 경로로 확장한 것뿐이다.
  - 제안: 조치 불요(risk 낮음). 구조화 로깅으로 전환하면 위생이 개선되나 파일 전체의 기존 관례이지
    이 diff 의 결함이 아니다.

- **[INFO]** `JSON.parse` 결과에 런타임 스키마 검증 없이 캐스팅
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:159`
    (`cached = JSON.parse(cachedJson) as IdempotencyEntry`), `:183`
    (`cachedPayload = JSON.parse(cached.responseJson)`), `:195`
    (`cachedPayload as Record<string, unknown>`, `HttpException` 재현 분기).
  - 상세: 바깥 JSON 캐스팅은 기존 패턴이고, 이번 diff 는 안쪽 `responseJson` 파싱에 `try/catch` 방어를
    추가했을 뿐(§요지) zod 등 스키마 검증까지는 도입하지 않았다. `cached.bodyHash`/`statusCode`/
    `cachedPayload` 필드가 없거나 타입이 달라도 런타임에서 조용히 통과한다 — 다만 `bodyHash` 가
    `undefined` 면 항상 실제 요청의 `bodyHash` 와 불일치해 `409` 로 처리되므로(:167) fail-safe 방향이다.
    데이터의 신뢰 경계는 "이 서비스 자신이 쓴 Redis 값" 이고, 이번 변경이 그 경계를 넓히지 않는다
    (원 요청 body/`Idempotency-Key` 헤더 자체는 여전히 `readKey`(:337-341)로 검증되고 `bodyHash` 로만
    해시되어 코드에 직접 삽입되지 않는다 — 인젝션 표면 아님).
  - 제안: 조치 불요. 스키마 검증을 원하면 바깥 JSON 포함 전체를 별도 후속으로.

- **[INFO]** 손상 파싱 실패가 이제 `500` 대신 fail-open 으로 처리됨 — 보안 관점에서는 정보 노출 축소(개선)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:176-186`
    (`discardCorruptEntry('payload', ...)` 신설 호출).
  - 상세: 종전에는 안쪽 `responseJson` 파싱이 맨몸으로 실행돼 `SyntaxError` 가 `GlobalExceptionFilter`
    까지 올라가 `500` 으로 마스킹됐다(스택트레이스 노출 여부는 그 필터의 프로덕션 설정에 따라 갈림).
    이번 변경은 그 예외 전파 경로 자체를 제거해 클라이언트로 예외 정보가 전달될 가능성을 줄인다 —
    새 취약점이 아니라 개선.
  - 제안: 없음.

- **[INFO]** 새로 추가된 커밋 `409`/`410` 재현 분기(`isErrorStatusCacheable`)의 payload 는 여전히
  이 서비스 자신이 기존에 캐시한 응답이며, 클라이언트가 직접 주입할 수 없다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:193-198`
    (`throw new HttpException(cachedPayload as Record<string, unknown>, cached.statusCode)`).
  - 상세: `cachedPayload` 는 이전 요청에 대한 `interaction.service.ts` 의 실제 응답을 `storeEntry()`
    가 직렬화해 저장한 값의 재현이다(§`cacheTapped`). 새 인젝션·권한 우회 표면이 생기지 않는다 —
    캐시 스코프(`executionId:route:key`, §R8)가 cross-execution 재생을 막는 다른 변경으로 이미
    분리돼 있고 이번 diff 는 그 스코프 로직을 건드리지 않는다.
  - 제안: 없음.

## 요약

이번 diff 는 `IdempotencyInterceptor` 가 캐시 엔트리 바깥 JSON만 방어하고 안쪽 `responseJson` 파싱은
맨몸으로 두어 손상 시 `500` 이 되던 선재 결함을 닫고, 두 자리 모두 `discardCorruptEntry()` 로 통합해
"무시하고 신규 처리 + warn" 로 일원화한 리팩터다. 사용자 입력(원 요청 body, `Idempotency-Key` 헤더)의
신뢰 경계는 바뀌지 않았고, 파싱 대상 데이터(`cached.*`, `cachedPayload`)는 이 서비스가 자신이 Redis에
기록한 값만 재-파싱하는 것이라 외부에서 직접 조작 가능한 입력이 아니다. `bodyHash` 충돌 판정을
payload 파싱보다 먼저 두는 순서 변경도 `409 IDEMPOTENCY_KEY_CONFLICT` 판정을 손상된 엔트리에서
누락시키지 않는 방향으로, 인증/인가·인젝션·시크릿 노출 관점에서 새 취약점을 만들지 않는다. 오히려
종전에 예외가 `GlobalExceptionFilter` 까지 새던 경로 하나를 없애 정보 노출 표면이 줄었다. 로그에 원본
`err.message` 를 그대로 넣는 것과 `JSON.parse` 결과의 런타임 스키마 미검증은 이 파일 전체의 기존
관례를 확장한 것일 뿐 이번 diff 가 새로 만든 위험이 아니며, 둘 다 "Redis 직접 쓰기 권한" 이라는 높은
신뢰 전제가 필요해 실효 위험이 낮다. `CHANGELOG.md`/plan 문서 변경, 그리고 이번에 함께 커밋되는 직전
라운드(`23_24_08`)의 리뷰 산출물(`review/code/2026/08/12/23_24_08/*`)은 정적 텍스트이며 시크릿·
자격증명 패턴 grep 결과 이상 없음 — 보안 관점에서 검토 대상 밖이다. 하드코딩된 시크릿, SQL/커맨드
인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘, 평문 전송은 발견되지 않았다.

## 위험도
NONE
