### 발견사항

- **[INFO]** 손상 엔트리 read-path 의 `statusCode` 범위 검사(100–599)가 §R8 "닫힌 목록"보다 넓다
  - target 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — 신규 `isHttpStatusCode()` (읽기 경로, `isIdempotencyEntry()` 가 호출)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` `## Rationale` → **R8. Idempotency-Key 와 `submit_form` 검증 실패의 관계** — "캐시 대상은 닫힌 목록이다: 위에 열거한 `2xx`·`409`·`410` 이 전부다 … 구현이 이 목록을 조건으로 옮길 때 단일 비교로 축약하면 안 된다"
  - 상세: 쓰기 경로(`cacheTapped`/`storeEntry`)는 여전히 R8 이 요구하는 닫힌 목록(`2xx` 성공 채널, `isErrorStatusCacheable`=`409`/`410` 에러 채널)만 적재하도록 **변경 없이 유지**되어 있어 R8 자체는 위반되지 않는다. 다만 신규로 추가된 읽기 경로 방어 `isHttpStatusCode()` 는 "이 시스템이 실제로 쓸 수 있었던 값(2xx/409/410)" 이 아니라 "RangeError 를 안 내는 정수 범위(100–599)"를 기준으로 삼는다. 그 결과, (정상 경로에서는 발생하지 않지만) `statusCode` 필드가 예컨대 `404`처럼 범위 안이지만 닫힌 목록 밖인 값으로 손상된 엔트리는 `isIdempotencyEntry()` 를 통과하고, 이어서 `isErrorStatusCacheable(404)` 가 `false` 이므로 "손상"이 아니라 **성공 채널 replay**(`res.status(404)` + `of(cachedPayload)`)로 처리된다 — `discardCorruptEntry`/warn 경로를 타지 않는다.
  - 제안: rationale continuity 관점에서는 R8 위반이 아니라(쓰기 경로가 그대로 닫힌 목록을 지킴) 별개의 방어 범위 논의이므로 CRITICAL/WARNING 대상은 아니다. 다만 "손상 방어" 라는 목적 자체를 §R8 의 닫힌 목록과 정합시키고 싶다면 `isHttpStatusCode` 대신(또는 추가로) `value === 200 || value === 202 || isErrorStatusCacheable(value)` 형태로 좁히는 것을 고려할 수 있다 — 이 경우 새 Rationale 문구(왜 read-path 검증을 닫힌 목록에 맞췄는지)를 R8 하단에 짧게 추가하면 됨. 현행 그대로 유지한다면(코멘트가 이미 "express RangeError 방지"라는 별도 목적을 명시하고 있어 의도적으로 보임) 추가 조치 불필요.

### 요약

이번 diff(`idempotency.interceptor.ts`/`.spec.ts`)는 `spec/5-system/14-external-interaction-api.md` §R8 이 확정한 세 가지 결정 — (1) 캐시 대상 닫힌 목록(`2xx`/`409`/`410`, 열거 그대로 유지 — `isErrorStatusCacheable` 조건문 미변경), (2) 캐시 키 스코프(`executionId:route:key`, `req.interaction` 부재 시 전역 키로 fallback 하지 않고 skip — 로직 미변경), (3) Redis/캐시 손상 시 fail-open + warn — 을 전부 그대로 보존한 채, 기존에 빠져 있던 손상 방어(엔트리 형태 검증·내부 payload 파싱 실패·상태코드 범위)를 추가하는 **순수 하드닝**이다. `spec/data-flow/15-external-interaction.md` `## Rationale` 의 "Fail-open 정책의 일관 표기"(전 경로 fail-open + warn 로그 요구)와도 코드 상단 독스트링의 5-경로 표가 정합한다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 등 CRITICAL/WARNING 급 Rationale 연속성 문제는 발견되지 않았다. 유일하게 짚을 점은 신규 read-path 손상 검증(`isHttpStatusCode`, 100–599)이 R8 의 닫힌 목록보다 넓은 기준을 쓴다는 것인데, 이는 R8 이 규율하는 "무엇을 적재하는가"가 아니라 "읽은 값이 안전하게 다룰 수 있는 형태인가"라는 별개 관심사라 INFO 수준으로만 기록한다.

### 위험도
NONE
