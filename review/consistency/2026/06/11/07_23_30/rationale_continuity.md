# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/db-pool-creds-pubsub.md`
검토 모드: spec draft (--spec)
검토일: 2026-06-11

---

## 발견사항

발견된 CRITICAL 또는 WARNING 항목 없음.

---

### [INFO] target 설계가 spec Rationale 와 완전 정합

- target 위치: `plan/in-progress/db-pool-creds-pubsub.md` 전체 설계 섹션
- 과거 결정 출처: `spec/4-nodes/4-integration/2-database-query.md ## Rationale § 풀 캐시 멀티 인스턴스 무효화 — Redis pub/sub broadcast`
- 상세: target 의 설계가 해당 spec Rationale 와 아래 모든 축에서 일치한다.
  1. **채택 결정(옵션 A)**: target 은 `IntegrationCacheBus` + Redis pub/sub 채널 `integration:cache:invalidate` broadcast 방식을 채택 — spec Rationale "채택 — Redis pub/sub broadcast (옵션 A)" 와 동일.
  2. **기각 결정(옵션 B) 미재도입**: target 은 `POOL_IDLE_TIMEOUT_MS` 하향(시간 기반 완화)을 언급하지 않으며, spec이 기각한 이 대안을 재채택하지 않는다.
  3. **fail-safe 원칙**: target 의 "fail-safe: Redis 미가용 시 pub/sub 에러를 삼키고 degrade" 는 spec Rationale 의 "pub/sub 가 미가용(Redis 순단)이어도 credsHash 비교 evict 가 다음 실행에서 stale 풀을 교체하므로 정합성은 깨지지 않는다 (안전 degrade)" 와 일치.
  4. **Redis 연결 아키텍처**: target 의 "SUBSCRIBE 는 전용 duplicate 연결 필요" + "PUBLISH 는 command 라 공유 연결 가능" 분리 설계는 spec Rationale 의 "기존 공유 Redis 연결은 command-only(SUBSCRIBE 미사용)라 단일 연결 multiplexing 안전성을 위해 그대로 두고, 구독은 전용 duplicate 연결로 분리한다. PUBLISH 는 일반 command 라 공유 연결로 보낸다." 와 일치. `plan/complete/redis-client-factory.md` 에 기록된 공유 연결(command-only, 8→1 통합) invariant 도 위반하지 않는다.
  5. **채널 generic 원칙**: target 의 "bus 는 generic 설계 → email 은 후속 1줄(별 항목)" 은 spec Rationale 의 "채널은 integration-generic 이라 다른 인스턴스-로컬 자격증명 캐시(예: Send Email transport)도 같은 메커니즘에 구독 등록할 수 있다" 와 일치.
  6. **payload 형식**: target 의 `payload = integrationId (평문 문자열)` 은 spec 의 "채널 payload 는 integrationId 평문 문자열" 과 일치.
- 제안: 별도 수정 불필요.

---

### [INFO] spec Rationale 기각 항목의 plan 미기재 — 참조 보완 가능

- target 위치: `plan/in-progress/db-pool-creds-pubsub.md §Rationale`
- 과거 결정 출처: `spec/4-nodes/4-integration/2-database-query.md ## Rationale § 풀 캐시 멀티 인스턴스 무효화` "기각 — 옵션 B" 항
- 상세: plan 의 `## Rationale` 에 "옵션 A(pub/sub 전파) 확정 — 침해 대응 맥락이라 시간 기반 완화(B: idle timeout 하향)로는 SLA 보장 불가" 라고 기각 이유가 명시돼 있어 spec 과 정합하다. plan Rationale 가 충분히 기각 근거를 포함하므로 충돌 없음. 필요하다면 plan Rationale 에 `spec/4-nodes/4-integration/2-database-query.md ## Rationale` 를 교차 참조로 추가하면 추적성이 강화되지만 필수는 아님.
- 제안: 선택 사항 — plan Rationale 말미에 `(spec Rationale 상세: spec/4-nodes/4-integration/2-database-query.md § 풀 캐시 멀티 인스턴스 무효화)` 한 줄 추가.

---

## 요약

target 문서 `plan/in-progress/db-pool-creds-pubsub.md` 는 `spec/4-nodes/4-integration/2-database-query.md ## Rationale` 에 기록된 모든 설계 결정(옵션 A 채택, 옵션 B 기각, fail-safe degrade, command-only 공유 연결 불변식, duplicate 구독 연결 분리, 채널 generic, payload 평문 문자열)을 준수한다. 기각된 대안을 재도입하거나 합의된 invariant 를 우회하는 설계가 없으며, `plan/complete/redis-client-factory.md` 에 확립된 "공유 연결은 command-only, 구독은 duplicate 연결 분리" 원칙도 위반하지 않는다. Rationale 연속성 관점에서 이 plan 은 안전하다.

## 위험도

NONE
