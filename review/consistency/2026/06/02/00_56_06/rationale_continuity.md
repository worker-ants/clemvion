# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
Target 영역: `spec/4-nodes/4-integration/`
플랜: `plan/in-progress/cafe24-install-ratelimit.md` (A-3 — install endpoint rate limiting 강화)

---

## 발견사항

- **[INFO]** install endpoint IP throttle이 spec에 미기록 상태로 구현 전 Rationale 공백
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 "보안 추가 조치" 끝
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 — 현재 ±5분 윈도우·HMAC·nonce cache 만 명시. pod별 메모리 `@Throttle({ limit: 30, ttl: 60_000 })` 은 코드에만 존재하고 spec에는 기록되지 않은 상태.
  - 상세: 플랜이 "현재는 pod별 메모리 IP throttle만 존재"라고 출발점을 명시하고 있으나, 그 기존 throttle 자체가 §9.8에 기재된 적이 없다. 플랜 spec 갱신(§9.8에 Redis 분산 throttle + 실패 페널티 테이블 추가)을 실행할 때 "기존 in-memory throttle → Redis 이전" 흐름이 Rationale에 서술되어야 한다. 그렇지 않으면 기존 결정이 무엇이었는지 알 수 없는 빈 공간에서 새 결정이 등장하는 형태가 된다.
  - 제안: §9.8 spec 갱신 시 다음을 Rationale에 포함: (a) 기존 `@Throttle({ limit: 30, ttl: 60_000 })` pod별 in-memory throttle이 출발점이었음, (b) 멀티 인스턴스 배포 시 pod별 독립 카운터로 인해 cluster 전역 quota 보장이 불가했던 문제, (c) Redis 분산 store로 이전하는 근거.

- **[INFO]** 실패 페널티 레이어(Layer 2)가 기존 "성공 302 redirect도 카운트하지 않는다" 제한에 대한 Rationale 부재
  - target 위치: `plan/in-progress/cafe24-install-ratelimit.md` 설계 Layer 2
  - 과거 결정 출처: 해당 없음 (기존 spec에 실패 페널티 관련 기각된 대안 없음)
  - 상세: 플랜 설계에서 "성공 302 redirect는 카운트하지 않는다"는 명시적 scope 제한을 두었으나, 이 결정의 근거("정상 사용자 무영향, enumeration만 정조준")가 플랜에는 있지만 spec Rationale에는 없다. 구현 후 spec §9.8에 추가될 때 이 판단 근거가 기록되어야 한다.
  - 제안: spec §9.8 갱신 시 실패 페널티의 "성공은 제외" 정책과 그 근거를 Rationale로 명시.

- **[INFO]** Redis graceful degradation 정책이 기존 nonce cache 패턴과 일관하는지 명시 필요
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 (신규 추가 예정 항목)
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 기존 nonce cache 항 — "Redis 미설정 / 통신 실패 시 graceful degradation — nonce 검사는 skip"
  - 상세: 플랜의 "Redis 미설정 시 graceful degradation — 기존 in-memory store로 fallback (nonce-cache 패턴 일치)"는 기존 nonce cache의 degradation 정책("검사 skip")과 다르다. nonce는 skip이고, throttle은 in-memory fallback으로 분기한다. 두 정책이 다른 이유가 명확하다(nonce skip은 보수적·안전 선택 vs throttle in-memory fallback은 기능 유지가 더 중요)면 이 차이가 spec에 기술되어야 한다. 동일 Redis를 공유하므로 Redis 장애 시 두 컴포넌트의 동작이 달라지는 점을 Rationale로 설명해야 혼란을 막는다.
  - 제안: spec §9.8 갱신 시 "Redis 미설정·장애 시 throttle은 in-memory fallback, nonce는 skip — 각 컴포넌트의 degradation 정책이 다른 이유(throttle 기능 보전 vs nonce 보안 우선)" 를 명시.

---

## 요약

`spec/4-nodes/4-integration/` 의 현재 Rationale에는 명시적으로 기각된 대안이나 invariant 위반이 없다. 플랜(`cafe24-install-ratelimit.md` A-3)이 추가하려는 Redis 분산 throttle + 실패 페널티 설계는 기존 결정과 직접 충돌하지 않는다. 다만 (1) 기존 pod별 in-memory throttle이 spec에 기록된 바 없어 "무에서 유로" 새 결정이 등장하는 Rationale 공백이 존재하고, (2) Redis graceful degradation 정책이 같은 §9.8의 nonce cache와 다르게 동작하므로 그 차이의 근거가 기술되지 않으면 향후 혼선을 일으킬 수 있다. 모두 spec 갱신 단계(플랜 step 4)에서 함께 채워야 할 INFO 수준 보완 사항이며, 구현 착수를 차단하는 CRITICAL/WARNING 사안은 없다.

## 위험도

LOW

STATUS: SUCCESS
