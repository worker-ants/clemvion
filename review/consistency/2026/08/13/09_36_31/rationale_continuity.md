# Rationale 연속성 검토 — NF-OB-07 메트릭 카탈로그 `clemvion.redis.fail_open` 등재

## 검토 대상
- target: `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`
- spec_impact: `spec/5-system/_product-overview.md` (§5 NF-OB-07 표), `spec/data-flow/9-observability.md` (미러 문장)

## 대조한 Rationale
- `spec/5-system/14-external-interaction-api.md` R8 (Idempotency-Key 캐시 스코프·fail-open 잔여 위험)
- `spec/data-flow/15-external-interaction.md` "Fail-open 정책의 일관 표기" ("idempotency 저하" 잔여 위험 서술, "Redis 실패율 관측" 필요성 명시)
- `spec/5-system/15-chat-channel.md` R-CC-19 (rate-limit Redis 미가용 시 fail-open — chat-channel 계열의 동일 정책 선례)
- `spec/data-flow/9-observability.md` 자체 Rationale (liveness/readiness 분리, 최소 표본 가드 등 — 직접 충돌 항목 없음)
- 코드: `business-metrics.service.ts` (`RedisFailOpenComponent`/`RedisFailOpenReason` 닫힌 유니온), `idempotency.interceptor.ts` (5개 fail-open 경로 전량 계측 확인)

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** target 이 기존 Rationale 이 요구해온 관측 갭을 정확히 메운다
  - target 위치: target "왜" 섹션 + `spec/5-system/_product-overview.md` §NF-OB-07 표 추가행
  - 과거 결정 출처: `spec/data-flow/15-external-interaction.md` "Fail-open 정책의 일관 표기" — "운영자는 이 구간을 인지할 수단(Redis 실패율 관측)이 필요하다"
  - 상세: 위 Rationale 은 idempotency fail-open 의 잔여 위험(캐시 미스로 인한 다운스트림 중복 실행)을 서술하면서 "Redis 실패율 관측" 수단의 부재를 명시적으로 지적해 두었다. target 이 등재하려는 `clemvion.redis.fail_open` 카운터(`component=idempotency`)는 정확히 그 관측 수단의 구현물이다. 신규 대안 채택이 아니라 기존 Rationale 이 요구한 것을 코드가 먼저 충족했고 spec 카탈로그만 뒤처진 상태 — target 은 그 뒤처짐만 해소한다.
  - 제안: 특별한 수정 불요. 원한다면 `_product-overview.md` §NF-OB-07 표 추가행 또는 `data-flow/15-external-interaction.md` 쪽에 상호 cross-link ("Redis 실패율 관측 → `clemvion.redis.fail_open` 참조")를 남기면 두 문서 간 정합이 더 명시적으로 드러나지만 필수는 아니다.

- **[INFO]** "문서가 구현보다 넓어지면 안 된다" 원칙과의 정합 확인
  - target 위치: target "판단이 필요한 지점" 섹션
  - 과거 결정 출처: 프로젝트 전반에 걸쳐 반복 확인된 원칙(예: EIA R19 "회수 대상은 provably un-continuable" 류의 좁은 확장 패턴, chat-channel R-CC-13 "provider 한계는 provider spec 에" 식의 스코프 최소주의) — 명시적 단일 Rationale 항목은 아니나 다수 Rationale 이 공유하는 설계 습관
  - 상세: target 은 `component` 유니온을 `idempotency` 하나로만 한정하고 "chat-channel 계열(`ChatChannelDedupService`·`ChatChannelRateLimiterService`·`PublicWebhookQuotaService`)도 같은 fail-open 정책을 쓰지만 아직 이 카운터에 배선돼 있지 않다"를 비목표로 명시했다. 이는 코드 구현 범위와 spec 서술 범위를 정확히 일치시키는 결정으로, 위 습관적 원칙과 정합한다. 위반 아님 — 오히려 모범 사례.
  - 제안: 조치 불요.

## 요약
target 은 새로운 제품 결정이 아니라 이미 구현·리뷰된 사실(코드의 6번째 OTel instrument)을 SoT 표에 등재하는 순수 문서 동기화 작업이다. 관련 Rationale(EIA R8, data-flow "Fail-open 정책의 일관 표기", chat-channel R-CC-19)을 전수 대조한 결과 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다. 오히려 target 이 등재하려는 메트릭은 data-flow Rationale 이 명시적으로 요청해 둔 "Redis 실패율 관측" 요구를 충족하는 관측 수단이며, `component` 유니온을 구현 범위(`idempotency` 단일)로 좁게 유지한 판단은 "spec 이 구현보다 넓어지면 안 된다"는 프로젝트의 반복된 설계 습관과 정합한다. `RedisFailOpenComponent`/`RedisFailOpenReason` 닫힌 유니온과 5개 fail-open 경로 전량 계측도 코드에서 실측 확인했다.

## 위험도
NONE
