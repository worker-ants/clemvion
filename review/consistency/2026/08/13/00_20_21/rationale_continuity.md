# Rationale 연속성 검토 — EIA idempotency 캐시 손상 하드닝

## 검토 대상

diff 는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 및 그 spec 테스트
두 파일뿐이다 (spec/*.md 변경 없음). 변경 내용: 캐시 엔트리(바깥 JSON)뿐 아니라 엔트리 안쪽
`responseJson` payload 손상까지 방어(`discardCorruptEntry`)하고, docstring 의 fail-open 경로 표를
"세 경로" → "다섯 경로"로 정정.

## 발견사항

- **[INFO]** system spec R8 / data-flow Rationale 의 fail-open 경로 열거가 코드 docstring 의 5경로 표와 아직 안 맞음
  - target 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 클래스 docstring (diff 상단, 신설 5행 표) 및 `discardCorruptEntry`
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` `## Rationale` § R8 "캐시 키 스코프" 단락 — "이 인터셉터의 다른 실패 경로(Redis 미주입·GET/SET 실패·직렬화 실패)가 모두 멱등성을 포기하고 요청은 통과인 것과 일관된다"; `spec/data-flow/15-external-interaction.md` `## Rationale` § "Fail-open 정책의 일관 표기" — "토큰 blacklist·idempotency·jti 추적·notification enqueue 모두 Redis/DB 미가용 시 fail-open"
  - 상세: 이번 diff 는 코드 docstring 표를 3경로→5경로(신규 5번째 = "캐시 엔트리·payload 손상")로 정정하면서, 정확히 이 PR 이 스스로 지적하는 문제("종전에는 세 경로라고 적혀 있었는데 실제로는 직렬화 실패가 이미 빠져 있었고, 손상 경로가 더해지며 둘이 더 어긋났다 — 경로를 늘릴 때 이 표를 함께 갱신하지 않으면 다음 사람이 방어의 범위를 실제보다 좁게 읽는다")를 spec 문서 쪽에는 아직 적용하지 않았다. system spec R8 은 여전히 "Redis 미주입·GET/SET 실패·직렬화 실패" 세 항목만 예시하고 "캐시 손상"(데이터는 있으나 형태가 깨진 경우 — Redis 가용성과는 다른 실패 축)은 언급이 없다. 다만 `spec/data-flow/15-external-interaction.md` §2.2 표와 §4 "외부 의존" 표는 이미 "전 경로 fail-open (warn)" 으로 포괄적으로 서술해 두어 이 표현 자체가 틀리지는 않는다 — 즉 이것은 원칙 위반이 아니라 system spec 쪽 예시 열거의 완결성 보완 사안이다. 기각된 대안의 재도입도, 무근거 번복도 아니다: 오히려 이 diff 는 fail-open 원칙을 더 철저히 지키는 방향(캐시 손상이 500 으로 마스킹되던 결함을 없앰)이라 Rationale 의 취지를 강화한다.
  - 제안: 후속(선택) 으로 `spec/5-system/14-external-interaction-api.md` R8 "캐시 키 스코프" 단락의 괄호 예시를 "Redis 미주입·GET/SET 실패·직렬화 실패·**캐시 엔트리/payload 손상**"으로 갱신해 코드 docstring 과 예시 열거를 동기화. 필수 차단 사유는 아님 — spec 의 포괄 서술("전 경로 fail-open")이 이미 정확하므로 devs 판단에 맡겨도 무방.

## 정합성 확인 (문제 없음으로 판정한 항목)

- **R8 "닫힌 목록"(2xx/409/410 만 캐시)**: `isErrorStatusCacheable` 은 diff 에서 변경 없음 (`409 || 410`). 유지됨.
- **R8 "409·410 은 예외로 재현"**: 정상 엔트리 경로는 그대로 유지 — `discardCorruptEntry` 는 엔트리/payload 가 **파싱 불가**할 때만 개입하며, 이 경우 애초에 "재현"할 데이터 자체가 없으므로 fresh 처리로 강등하는 것이 fail-open 원칙(§ 아래)과 일관된다.
- **R8 "bodyHash 판정이 payload 파싱보다 우선"**: diff 의 순서(엔트리 형태검사 → bodyHash 비교 → payload 파싱)가 이 요구를 그대로 지킨다 — 새로 추가된 "안쪽이 깨졌어도 body 다르면 여전히 409" 테스트가 이를 회귀 고정한다.
- **§2.2 Redis 스키마 표의 `{bodyHash, responseJson, statusCode}` 형태**: `isIdempotencyEntry` 가 검사하는 세 필드와 정확히 일치 — 캐시 스키마 계약과 어긋나지 않음.
- **§4 외부 의존 "Redis … 전 경로 fail-open (warn) — 가용성 우선"**: 신규 손상-처리 경로도 이 서술 범위에 포섭됨. 위반 없음.
- **캐시 키 스코프 (executionId + route)**: 이번 diff 는 스코프 로직(`readKey`, 키 조립부) 을 건드리지 않음 — R8 이 명시적으로 기각한 "헤더 값 단독 키"·"토큰 식별자 스코프"·"조용한 전역 fallback" 이 재도입된 흔적 없음.

## 요약

이번 변경은 `spec/data-flow/15-external-interaction.md` 및 `spec/5-system/14-external-interaction-api.md` §R8 에 기록된 idempotency 캐시의 핵심 계약(닫힌 캐시 대상 목록, bodyHash 우선 판정, execution+route 스코프, "전 경로 fail-open") 을 전혀 흔들지 않으며, 오히려 캐시 손상이 500 으로 새는 기존 결함(=fail-open 원칙의 실질 위반)을 제거해 그 Rationale 의 취지를 더 충실히 구현한다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 어느 것도 발견되지 않았다. 유일한 보완 여지는 system spec R8 의 예시 열거("세 실패 경로")가 코드 docstring 의 최신 5-경로 표와 문구 수준에서 아직 어긋나 있다는 점인데, 이는 spec 의 포괄 서술이 이미 정확하므로 차단 사유가 아닌 INFO 로 남긴다.

## 위험도

NONE
