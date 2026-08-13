STATUS=success rationale_continuity review complete — no CRITICAL/WARNING found

===REPORT_MARKDOWN_BELOW===

### 발견사항

- **[INFO]** 캐시 엔트리 손상(형태·payload) 방어가 target spec `## Rationale` "Fail-open 정책의 일관 표기" 에 명시적으로 나열되어 있지 않음
  - target 위치: `spec/data-flow/15-external-interaction.md` `## Rationale` → "Fail-open 정책의 일관 표기" (원문 라인 375-388 부근)
  - 과거 결정 출처: 동일 target 문서의 같은 Rationale 절 — "토큰 blacklist·idempotency·jti 추적·notification enqueue 모두 Redis/DB 미가용 시 **fail-open**" / "idempotency 저하 = 같은 `Idempotency-Key` 재요청이 전부 캐시 미스로 판정돼 다운스트림 중복 실행 가능"
  - 상세: 구현 diff(`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`)는 fail-open 경로를 기존 "세 경로"에서 "다섯 경로"로 확장하고(엔트리 JSON 손상·payload JSON 손상 추가), 새 경로들도 전부 `warn` 로그를 남기도록 `discardCorruptEntry()` 를 신설했다. 이 자체는 target Rationale 이 서술하는 "Redis/DB 미가용 시 fail-open + warn" 원칙과 **정합**하며 번복이 아니다 — 단, target Rationale 은 "Redis/DB 미가용" 시나리오(GET/SET 실패)만 명시적으로 열거하고 "저장된 캐시 값 자체의 손상"(형태 불일치·내부 JSON 파싱 실패)이라는 별도 실패 클래스는 언급하지 않는다. 코드 docstring 은 이를 5-경로 표로 상세히 문서화했지만 spec 쪽 Rationale 은 여전히 상위 추상 수준 서술에 머물러 있어, 코드가 spec 보다 더 정밀한 실패 분류를 갖게 됐다.
  - 제안: 필수는 아니나, target Rationale "Fail-open 정책의 일관 표기" 문단에 "Redis/DB 인프라 장애"뿐 아니라 "적재된 캐시 엔트리 자체의 손상(형태 불일치·내부 payload 파싱 실패)도 같은 fail-open + warn 원칙을 따른다"는 한 줄을 추가하면 코드 docstring 과 spec Rationale 의 서술 정밀도가 맞춰진다.

### 요약
검토한 diff(`idempotency.interceptor.ts` / `.spec.ts`)는 [Spec EIA §R8](spec/5-system/14-external-interaction-api.md) 의 세 핵심 결정 — (1) 캐시 대상 닫힌 목록(`2xx`/`409`/`410`, `isErrorStatusCacheable` 는 diff 밖 그대로 유지), (2) 캐시 키 스코프(`executionId`+`route`, `req.interaction` 부재 시 전역 fallback 금지 로직도 diff 밖에서 불변), (3) Redis/DB 미가용 시 전 경로 fail-open+warn — 을 전혀 재도입·번복하지 않고 그대로 보존한 채, "저장된 캐시 값 자체의 손상"이라는 새 방어 축(엔트리 형태 검증 `isIdempotencyEntry`/`isHttpStatusCode`, 내부 payload 파싱 방어)만 추가한 순수 하드닝이다. `isHttpStatusCode` 가 쓰는 100-599 범위 비교는 "무엇을 캐시할지" 결정(R8 닫힌 목록)과는 별개로 "이미 캐시된 값이 그럴듯한 HTTP 코드인지" 검증하는 용도라 R8 이 금지한 "단일 비교로의 닫힌 목록 축약"과 충돌하지 않는다. target 문서(`15-external-interaction.md`)의 5개 Rationale 항목(문서 분리 이유/단일 sink/fail-open 표기/§1.5 갭 해소/SSE 버퍼) 중 어느 것도 위반·재도입되지 않았고, 관련 spec(`4-execution-engine.md`, `15-chat-channel.md`, `0-overview.md` 등)의 Rationale 도 이 diff 의 범위(idempotency 인터셉터 내부) 밖이라 저촉되지 않는다. 유일한 관찰점은 spec Rationale 의 서술 정밀도가 코드 docstring 을 따라가지 못하는 INFO 수준 보완 여지다.

### 위험도
NONE
