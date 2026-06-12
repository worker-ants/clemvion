# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
대상 범위: `spec/4-nodes/4-integration/`
diff-base: origin/main

---

## 발견사항

### 1. [INFO] `DB_HOST_BLOCKED` 도입은 기존 SSRF Rationale 과 완전 정합

- target 위치: `spec/4-nodes/4-integration/2-database-query.md §4 SSRF 가드 callout` 및 `§6.2 Runtime 에러 코드 표`
- 과거 결정 출처:
  - `spec/4-nodes/4-integration/1-http-request.md §8.2 Rationale` — SSRF 가드를 전 인증 방식 공통으로 적용하는 결정 (기각된 대안: `none` 전용 별도 host allowlist env 또는 현상 유지)
  - `spec/2-navigation/4-integration.md Rationale "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일"` — 통합 노드 전반이 단일 플래그 공유
- 상세: `DB_HOST_BLOCKED` 는 HTTP 의 `HTTP_BLOCKED`, Email 의 `EMAIL_HOST_BLOCKED` 와 대칭 코드를 도입한다. 이는 통합 노드 전반의 secure-by-default posture 를 `ALLOW_PRIVATE_HOST_TARGETS` 단일 플래그로 통일하는 기존 합의 원칙을 그대로 따른 확장이다. 플래그 이원화(기각된 대안 B)를 재도입하거나 `none` 무가드 정당화(기각된 대안 C)를 재도입하는 요소가 없다.
- 제안: 현행 spec 이 기존 Rationale 결정을 일관되게 준수하므로 수정 불필요. 보완 제안으로 `2-database-query.md` 의 SSRF 가드 callout 본문이 `1-http-request.md §8.2 Rationale` 를 명시적으로 교차 참조하면 추적성이 향상된다 (현재 `[HTTP Request §4]` 링크는 있으나 해당 섹션이 §8.2 Rationale 임은 직접 언급하지 않음).

---

### 2. [INFO] Redis pub/sub 캐시 무효화 채널 — "at-most-once 폐기" 결정과 충돌 없음

- target 위치: `spec/4-nodes/4-integration/2-database-query.md §4.2 풀 캐시 · 멀티 인스턴스 무효화 (Redis pub/sub)` 및 `## Rationale 풀 캐시 멀티 인스턴스 무효화` 항
- 과거 결정 출처: `spec/0-overview.md Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"` — `execution:continuation` (at-most-once pub/sub) 을 BullMQ 영속 큐로 교체한 결정
- 상세: target spec 의 Rationale 은 "`execution:continuation` 채널 폐기와의 구분" 항을 명시 포함하여, 본 채널이 "유실 시 실행이 멈추는 내구성 필요 사용처" 와 "유실돼도 credsHash evict 로 정합성이 보장되는 best-effort 사용처" 의 허용 의미론 차이를 정확히 기술하고 있다. 실행 엔진 Rationale 에서 기각된 "Redis pub/sub at-most-once" 패턴을 동일 목적으로 재도입하는 것이 아닌, 별도 목적(캐시 무효화 MTTR)에 best-effort 로 사용하는 것이라 원칙 위반이 아니다.
- 제안: 수정 불필요.

---

### 3. [INFO] `authentication='none'`/`'custom'` SSRF 가드 적용 — 기각된 대안 재도입 없음

- target 위치: `spec/4-nodes/4-integration/1-http-request.md §4 step 8`, `§8.2 Rationale`
- 과거 결정 출처: `§8.2 Rationale "SSRF 가드 전 인증 방식 적용 — none/custom 무가드 폐지 (2026-06-11)"` — 기각된 대안 (B) `none` 전용 별도 host allowlist env, (C) 현상 유지 + "none 은 의도적 무가드" 명문화가 명시적으로 기록됨
- 상세: target spec 의 §4 본문 및 `ALLOW_PRIVATE_HOST_TARGETS` callout 이 "전 인증 방식 공통" 을 반복 명시하며, §8.2 Rationale 에서 기각된 두 대안의 재도입이 없다. opt-out 플래그 이원화 없이 단일 `ALLOW_PRIVATE_HOST_TARGETS` 가 HTTP/DB/Email 전체를 통제한다는 invariant 가 보존되고 있다.
- 제안: 수정 불필요.

---

### 4. [INFO] `meta.duration` → `meta.durationMs` 명명 통일 — 합의된 원칙 준수

- target 위치: `spec/4-nodes/4-integration/0-common.md §6.1`, `§3 공통 출력 구조`
- 과거 결정 출처: `spec/conventions/node-output.md` Principle 2 (meta 는 실행 메트릭만) 및 Principle 11 (undefined 필드 생략). 시스템 spec 의 다른 문서들이 `meta.durationMs` 를 이미 사용 중임을 §6.1 이 명시.
- 상세: `http_request` 의 `meta.duration` → `meta.durationMs` 전환이 breaking change 임을 §6.1 에서 명시하고 있으며, 기존 합의된 명명 규약으로의 수렴이다. 기각된 대안(명명 유지)을 재도입하거나 원칙을 위반하는 요소가 없다.
- 제안: 수정 불필요.

---

### 5. [INFO] D4 결정 — throw → `port:'error'` 라우팅 전환 기록

- target 위치: `spec/4-nodes/4-integration/0-common.md §4.2 D4 결정`, 각 노드 `§5.8`
- 과거 결정 출처: `spec/conventions/node-output.md` Principle 3 계열 (runtime 실패는 `port:'error'` + `output.error`)
- 상세: D4 결정은 "`IntegrationError` throw → 노드 실행 실패" 경로를 폐기하고 모든 실패를 `port:'error'` + `output.error.*` 로 수렴시키는 것으로, CONVENTIONS Principle 3 계열과 완전 정합한다. 폐기된 "throw → 노드 실패" 경로가 재도입된 요소가 없다.
- 제안: 수정 불필요.

---

## 요약

`spec/4-nodes/4-integration/` 대상 범위의 Rationale 연속성 검토 결과, 명시적으로 기각된 대안의 재도입, 합의된 invariant 위반, 또는 무근거 번복에 해당하는 항목은 발견되지 않았다. `DB_HOST_BLOCKED` 신설은 HTTP Request `§8.2` 및 통합 관리 spec 의 SSRF 통일 Rationale 을 그대로 따른 대칭 확장이며, Redis pub/sub 캐시 무효화 채널은 실행 엔진에서 at-most-once pub/sub 를 폐기한 결정과 목적 분리가 target spec 의 Rationale 절에 명시돼 있어 충돌이 없다. `none`/`custom` SSRF 가드 적용(기각된 대안 B/C 미재도입), `meta.durationMs` 통일, D4 라우팅 패턴 모두 과거 합의 원칙을 충실히 준수한다. INFO 수준 보완 제안으로 `2-database-query.md` SSRF callout 에 `1-http-request.md §8.2` Rationale 를 명시적으로 교차 참조하는 링크를 추가하면 추적성이 향상된다.

## 위험도

NONE
