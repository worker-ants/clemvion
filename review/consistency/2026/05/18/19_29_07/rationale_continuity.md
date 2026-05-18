# Rationale 연속성 Check — rationale_continuity

검토 모드: 구현 착수 전 검토 (--impl-prep)
scope: `spec/2-navigation/4-integration.md` (변경 없음) + 구현 계획 `plan/in-progress/cafe24-jwt-exp-fix.md`

---

### 발견사항

- **[WARNING]** `short-circuit` guard skip — 기존 합의 원칙의 부분적 번복, 새 Rationale 부재 (spec 미반영)
  - target 위치: `plan/in-progress/cafe24-jwt-exp-fix.md` §작업 항목 코드 5번 · §Rationale "워커 short-circuit 차등 적용 (`reactive_401` source)"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` §Rationale "BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소 (2026-05-16)"
  - 상세: 기존 Rationale 은 Worker 가 "DB 재로드 + **재확인 short-circuit** 후 `refreshAccessToken` 호출" 하는 것을 핵심 설계로 명시하고, "모든 호출자가 `waitUntilFinished` 로 동일 worker 결과 공유" 를 invariant 로 기술한다. 구현 계획은 `source='reactive_401'` 일 때 short-circuit guard 를 **skip** 하도록 worker 를 분기시키는데, 이는 기존 Rationale 의 "단일 worker path" 를 암묵적으로 번복한다. 기존 Rationale 에는 "source 에 따른 분기" 가 전혀 언급되지 않았고, 이 변경이 멀티 인스턴스 dedup 보증(직렬화 불변)을 깨는지 여부를 설명하는 새 Rationale 이 없다.
  - 제안: spec §Rationale 에 "reactive_401 source 분기 — short-circuit skip 이유 (2026-05-18)" 항을 추가해 (a) short-circuit 이 존재한 이유(proactive thundering herd 방지), (b) reactive_401 에서 skip 이 안전한 이유(empirical 401 = DB expiresAt 신뢰 불가 신호이므로 short-circuit 이 유해), (c) 기존 dedup 보증이 여전히 유효한 이유(reactive_401 은 `waiting/active` 상태 dedup 으로 클러스터 내 단일 실행 보장은 유지) 를 명문화한다. 구현 PR 과 함께 `plan/in-progress/spec-update-cafe24-jwt-exp.md` 에서 spec §Rationale 갱신을 포함시킨다.

- **[WARNING]** `removeOnComplete: { age: 0 }` — jobId dedup 기존 설계의 암묵적 가정과의 충돌, 새 Rationale 부재
  - target 위치: `plan/in-progress/cafe24-jwt-exp-fix.md` §작업 항목 코드 7번 · §Rationale "`removeOnComplete: { age: 0 }` for reactive_401"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` §Rationale "BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소 (2026-05-16)" — "같은 통합에 대한 동시 enqueue 가 `Queue.add({ jobId: integrationId })` 의 dedup 로 단일 worker 실행으로 모임"
  - 상세: 기존 Rationale 은 jobId dedup 이 "동시 enqueue" 를 직렬화하는 메커니즘으로 기술하며, `age` 정책에 대한 언급이 없다. BullMQ 의 jobId dedup 은 `completed` 상태 잔존 job 도 동일 jobId 반환하는 동작이 있는데, `reactive_401` 에서만 `removeOnComplete: { age: 0 }` 을 적용하면 proactive/background 경로의 `completed` job 잔존(기본 60s) 이 직후 `reactive_401` add 를 stale completed job 으로 dedup 시키는 edge case 가 여전히 존재하는지, 반대로 `reactive_401` 가 먼저 add 되고 proactive 가 `age:0` completed 를 공유받는 동작이 달라지는지 등이 spec Rationale 에서 분석되지 않았다.
  - 제안: spec §Rationale 에 "reactive_401 removeOnComplete age:0 정책 (2026-05-18)" 항을 추가해 (a) BullMQ jobId dedup 의 `completed` 잔존 시 동작 (returned vs enqueued), (b) proactive/background 와 reactive_401 간 dedup 상호작용 분석, (c) `age:0` 가 기존 dedup 직렬화 보증을 깨지 않음을 명시한다.

- **[INFO]** JWT exp 기반 파싱 — 기존 Rationale "Cafe24 token 응답의 `expires_at` 처리 (2026-05-17)" 의 직접 번복, Rationale 갱신 필요
  - target 위치: `plan/in-progress/cafe24-jwt-exp-fix.md` §작업 항목 코드 2·3번 · §Rationale "왜 JWT exp 가 결정적"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` §Rationale "Cafe24 token 응답의 `expires_at` 처리 (2026-05-17)" — "(A) callback normalizer 보강 — `parseTokenExpiresAt` 가 `expires_in` 을 먼저 시도하고 cafe24 한정으로 `expires_at` ISO 문자열을 파싱한다 ... 둘 다 없으면 2h fallback"
  - 상세: 기존 Rationale 은 `expires_in` → `expires_at` ISO → 2h fallback 의 우선순위를 정식 결정으로 기술하고 있다. 구현 계획은 이를 **JWT exp → 표준 `expires_in` → `expires_at` ISO (KST 보정) → 2h fallback** 으로 변경하는데, 이는 기존 결정의 직접 번복이다. plan 의 §Rationale 에서 이유가 기술되어 있으나 spec 의 기존 Rationale 항이 갱신되지 않으면 이 두 문서가 상충된 결정을 동시에 기술하게 된다. 단, 구현 계획 자체에 충분한 근거("TZ 모호성 원천 제거", "JWT 자체에 issuer 서명으로 박힌 값")가 있으므로 CRITICAL 이 아니라 INFO 수준 — spec Rationale 동기화가 필요한 상태.
  - 제안: `plan/in-progress/spec-update-cafe24-jwt-exp.md` 에서 spec §Rationale "Cafe24 token 응답의 `expires_at` 처리 (2026-05-17)" 에 후속 갱신 항 "JWT exp 우선 파싱으로 개정 (2026-05-18)" 을 추가해 기존 결정을 명시적으로 상위호환하도록 처리한다. 기존 항의 "(A)" bullet 을 "현행 우선순위: JWT exp → expires_in → expires_at ISO (KST fallback) → 2h" 로 갱신하고 기각 대안에 "옛 `expires_in → expires_at → 2h` 순서 — TZ-less ISO 문자열의 timezone 모호성으로 인해 TZ 를 명시하지 않은 Cafe24 서버 환경에서 9h skew 발생 가능 (C1 결함 근거) 로 JWT exp 를 최우선으로 격상" 을 추가한다.

- **[INFO]** `TZ-less ISO → +09:00 보정` fallback — 암묵적 가정 신설, Rationale 부재
  - target 위치: `plan/in-progress/cafe24-jwt-exp-fix.md` §작업 항목 코드 2번 — "TZ designator 누락 시 `+09:00` 부여로 정규화"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` §Rationale "Cafe24 token 응답의 `expires_at` 처리 (2026-05-17)" — 기존 결정에서 TZ 처리에 관한 언급 없음.
  - 상세: `+09:00` 을 KST 기준으로 부여하는 것은 "Cafe24 서버가 KST 기반으로 ISO 를 발급한다" 는 새로운 시스템 가정이다. plan §Rationale 에 "TZ 보정 fallback(`+09:00`)의 위치" 로 기술되어 있으나 spec 에는 이 가정이 없고, 만약 Cafe24 가 UTC 기반 ISO 를 TZ 없이 발급하는 경우 반대 방향 skew 가 발생한다.
  - 제안: spec §Rationale 갱신 시 이 가정의 근거("Cafe24 본사 운영 기준 timezone 으로 합리적 추정", 단 "KST 부여는 JWT exp null인 경우의 safety net 에만 적용 — JWT 가 정상이면 이 분기는 실행되지 않음")를 명시해 향후 혼동을 방지한다.

---

### 요약

구현 계획(`plan/in-progress/cafe24-jwt-exp-fix.md`)의 핵심 변경 — JWT exp 기반 파싱 및 `reactive_401` source 를 통한 worker short-circuit 차등 적용 — 은 기존 spec Rationale 에서 결정된 원칙(BullMQ jobId dedup 단일 경로, `expires_at` ISO 파싱 우선순위)을 부분적으로 번복하거나 확장하는 결정이다. 변경 자체의 기술적 근거는 plan §Rationale 에 잘 기술되어 있으며 논리적 일관성이 있다. 다만 spec 의 기존 Rationale 항이 갱신되지 않으면 두 문서가 상충된 결정을 동시에 기술하게 되어 향후 구현자가 혼동을 겪을 수 있다. CRITICAL 이슈(명시적으로 기각된 대안의 재채택, invariant 직접 파괴)는 발견되지 않았으며, 이미 계획된 `plan/in-progress/spec-update-cafe24-jwt-exp.md` 를 통해 spec §Rationale 를 동기화하면 Rationale 연속성이 회복된다.

---

### 위험도

LOW
