# Rationale 연속성 검토 — spec/data-flow/ (EIA idempotency fail-open fix)

## 검토 범위

- target: `spec/data-flow/` (특히 `15-external-interaction.md`, `## Rationale` §"Fail-open 정책의 일관 표기")
- diff: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.{ts,spec.ts}` — `Idempotency-Key` 캐시의 Redis 런타임 장애(`get()`/`set()` reject) 시 fail-open 을 추가(기존엔 생성자 시점 null-client 만 fail-open, 런타임 reject 는 500 으로 흘러 fail-closed 였음)
- 대조한 과거 Rationale: `spec/data-flow/15-external-interaction.md` 본문(Rationale 포함), `spec/5-system/14-external-interaction-api.md` 의 `## Rationale`(R1~R19, R-outbound-flood, R-replay-unavailable) + 본문 §3.4 계약 표(EIA-RL-02 등), 그 외 번들에 포함된 data-flow/시스템 spec Rationale 전량(0-overview, 1-audit, 3-execution, 11-workflow, 12-workspace, 2-auth, 1-data-model, 2-navigation/1·2 등)

## 발견사항

### INFO — idempotency fail-open 의 신규 위험 서술이 spec 의 "잔여 위험" 카탈로그에는 아직 반영 안 됨
- target 위치: `spec/data-flow/15-external-interaction.md` `## Rationale` → `### Fail-open 정책의 일관 표기` (해당 spec 문서, diff 상으로는 미변경)
- 과거 결정 출처: 같은 절 — "본 문서는 각 표에 해당 정책을 명시해 운영자가 저하 모드의 잔여 위험 (blacklist 미적용 = exp 까지 토큰 유효 등) 을 추적할 수 있게 했다"
- 상세: 이번 diff(`idempotency.interceptor.ts`)의 신규 클래스 주석은 fail-open 의 대가를 이전보다 훨씬 구체적으로 명시한다 — "Redis 장애가 지속되는 동안에는 같은 `Idempotency-Key` 로 온 재요청이 전부 캐시 미스로 판정되므로 **중복 억제가 사실상 무력화**되고 다운스트림(execution 생성 등)이 중복 실행될 수 있다" 그리고 "`EIA-RL-02` 는 **정상 경로 계약**"이라는 스코프 한정. 이 서술 자체는 `spec/data-flow/15-external-interaction.md` §2.2 Redis 표의 "전 경로 fail-open (warn) — 가용성 우선"·`## Rationale`의 "Fail-open 정책의 일관 표기"와 **모순되지 않는다** — 오히려 그 정책을 코드가 뒤늦게 실제로 구현한 것(런타임 reject 경로가 이전엔 fail-closed 였던 spec-code drift 해소)이다. 다만 스펙의 "잔여 위험" 예시는 지금 "blacklist 미적용 = exp 까지 토큰 유효" 하나만 들고 있고, idempotency 저하가 "다운스트림 중복 실행"으로 이어질 수 있다는, 실질적으로 더 무거운(형식 재제출이 아닌 예: execution 재생성) 위험 예시는 spec Rationale 카탈로그에 없다. 즉 새 결정을 도입한 것은 아니지만, 코드 주석이 spec 보다 더 정밀한 위험 서술을 갖게 되어 두 곳의 "잔여 위험 목록"이 살짝 벌어졌다.
- 제안: 필수는 아니나, `spec/data-flow/15-external-interaction.md` `## Rationale` → "Fail-open 정책의 일관 표기" 절에 idempotency 저하 시의 "다운스트림 중복 실행 가능" 예시를 blacklist 예시와 나란히 추가하거나, `spec/5-system/14-external-interaction-api.md` §3.4 EIA-RL-02 행에 "Redis 미가용 시 best-effort 로 저하(§data-flow Fail-open 정책 참조)"라는 각주를 붙여, "필수"라는 라벨만 보고 무조건적 보장으로 오독하지 않도록 명시.

## 요약

이번 diff 는 `spec/data-flow/15-external-interaction.md` §2.2·`## Rationale`("Fail-open 정책의 일관 표기")가 이미 선언한 "Redis 전 경로 fail-open(가용성 우선)" 정책을 실제로 전 경로(런타임 GET/SET reject 포함)에 맞춰 구현한 버그 수정이며, `EIA-RL-02`(멱등 필수)·`R8`(400 VALIDATION_ERROR 캐시 제외)·`catchError`/`switchMap` 순서(409 충돌 검출 보존) 등 기존에 합의된 규칙을 건드리거나 번복하지 않는다. 과거 Rationale 에서 명시적으로 기각된 대안(예: DB row-level lock 대안 seq counter, 전용 outbox 테이블, 외부 WebSocket 신설 등)을 재도입하는 정황도 없다. 유일한 관찰은 코드 주석이 spec 의 "잔여 위험" 서술보다 한 발 더 구체적이어서 문서 간 위험 카탈로그가 약간 어긋난다는 INFO 수준 보완 제안뿐이다.

## 위험도
NONE
