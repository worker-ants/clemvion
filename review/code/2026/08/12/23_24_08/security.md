# Security Review — IdempotencyInterceptor `responseJson` 손상 방어 + warn 로깅

## 리뷰 범위

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — 캐시 엔트리
  손상(`try/catch` 바깥 JSON) 및 내부 `responseJson` 손상을 `discardCorruptEntry()` 로 통합 처리,
  파싱 순서를 `bodyHash` 판정 뒤로 고정, warn 로그 추가.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — 위 방어에
  대한 회귀 테스트 다수 추가 (엔트리 손상 warn, 내부 payload 손상, 파싱 순서 캐너리, 409 재현 분기).
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — 체크박스 `[x]` 전환 + 완료 노트 추가
  (코드 변경 없음, 보안 관점 무관).

## 발견사항

- **[INFO]** 손상 캐시 항목 처리 시 원본 예외 메시지를 그대로 로그에 삽입 (이론적 log-injection, 실효 위험 낮음)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:207-209` (`discardCorruptEntry`), 같은 패턴이 `:298-300`(`storeEntry` SET 실패), `:290-292`(직렬화 실패)에도 기존 존재
  - 상세: `err instanceof Error ? err.message : String(err)` 를 템플릿 리터럴로 조립해 `this.logger.warn(...)` 에 그대로 넘긴다. 이 값은 원칙적으로 Redis 에 저장된 캐시 엔트리(`cachedJson`/`cached.responseJson`) 파싱 실패 시의 `SyntaxError.message` 다. 이 엔트리는 이 서비스 자신이 `storeEntry()` 로만 기록하므로, 공격자가 이 메시지를 조작하려면 Redis 에 직접 쓰기 권한이 필요하다 — 이미 인프라가 침해된 상태를 전제해야 하는 낮은 실효성의 경로다. NestJS `Logger` 는 개행을 별도로 이스케이프하지 않으므로 로그 위조(CRLF log forging) 가능성 자체는 이론상 남지만, 이번 diff 가 새로 만든 표면이 아니라 이 파일의 기존 warn 로깅 패턴을 손상-엔트리 경로로 확장한 것뿐이다.
  - 제안: 조치 불필요(risk 낮음). 구조화 로깅(예: `{ err }` 객체를 Logger 에 별도 필드로 전달)으로 전환하면 일반적인 로그 위생이 개선되지만 이는 이 파일 전체의 기존 관례이지 이 diff 의 결함이 아니다.

- **[INFO]** `JSON.parse` 결과에 런타임 스키마 검증 없이 캐스팅 (`as IdempotencyEntry`, `as Record<string, unknown>`)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:147`(`cached = JSON.parse(cachedJson) as IdempotencyEntry`), `:171`(`cachedPayload = JSON.parse(cached.responseJson)`), `:183`(`cachedPayload as Record<string, unknown>`)
  - 상세: 바깥 JSON 캐스팅은 기존 코드에 이미 있던 패턴이고, 이번 diff 는 안쪽 `responseJson` 파싱에도 같은 방어(`try/catch`)를 추가했을 뿐 스키마 검증(예: zod)까지 도입하지는 않았다. `cached.statusCode`/`cached.bodyHash`/`cachedPayload` 는 필드가 없거나 타입이 달라도 런타임에서 조용히 통과한다(예: `bodyHash` 가 `undefined` 면 항상 `!== bodyHash` 가 되어 409 로 처리 — fail-safe 방향이라 위험하지 않음). 이 데이터의 신뢰 경계는 "이 서비스 자신이 쓴 Redis 값" 이라 클라이언트가 직접 조작할 수 없고, 이번 변경이 그 신뢰 경계를 넓히지도 않는다.
  - 제안: 조치 불필요. 별도로 스키마 검증을 원한다면 기존 패턴 전체(바깥 JSON 포함)를 함께 개선하는 후속 항목으로 다룰 것.

- **[INFO]** 손상 파싱 실패가 이제 500 대신 fail-open 으로 처리됨 — 보안 관점에서는 개선
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:145-174` (`discardCorruptEntry` 호출 두 자리)
  - 상세: 종전에는 안쪽 `responseJson` 파싱이 맨몸으로 실행돼 `SyntaxError` 가 `GlobalExceptionFilter` 까지 올라가 500 으로 마스킹됐다. `GlobalExceptionFilter` 의 프로덕션 설정에 따라 stack trace 노출 여부가 갈리는데, 이번 변경은 그 경로 자체를 없애 예외가 클라이언트까지 전파되지 않게 한다 — 정보 노출 표면을 줄이는 방향의 변경이다. 새로운 취약점이 아니라 개선 사항으로 기록한다.

## 요약

이번 diff 는 `IdempotencyInterceptor` 의 캐시 엔트리/내부 payload 파싱 실패를 조용히 넘기던 선재 결함을 닫고, 손상 시 신규 처리로 강등 + warn 로그를 남기도록 리팩터링한 것이 핵심이다. 사용자 입력(원 요청 body, `Idempotency-Key` 헤더)의 신뢰 경계는 바뀌지 않았고, 하드코딩된 시크릿·SQL/커맨드 인젝션·인증 우회·안전하지 않은 암호화 알고리즘은 발견되지 않았다. `cached.statusCode`/`bodyHash`/`responseJson` 은 이 서비스 자신이 Redis 에 기록한 값만 읽으므로 외부에서 직접 조작 가능한 입력이 아니며, 파싱 실패 시 원 예외가 그대로 500 으로 새던 경로도 이번 변경으로 줄었다(정보 노출 감소). 로그에 원본 에러 메시지를 그대로 넣는 것과 `JSON.parse` 결과의 런타임 스키마 미검증은 이 파일의 기존 관례를 확장한 것일 뿐 새로 도입된 위험이 아니며, 둘 다 Redis 직접 쓰기 권한이라는 높은 전제를 요구해 실효 위험은 낮다. `plan/in-progress/backend-lint-gate-broken-on-main.md` 변경은 문서 갱신(체크박스 전환)뿐이라 보안 관점에서 검토 대상이 아니다.

## 위험도

NONE
