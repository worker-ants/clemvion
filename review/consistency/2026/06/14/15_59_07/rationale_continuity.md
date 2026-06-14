# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/14-external-interaction-api.md`
검토 모드: spec draft 검토 (--spec)
기준 브랜치: main

---

## 발견사항

### 1. [INFO] §7.3 "별도 테이블을 만들지 않고" 결정 번복 — R15 로 근거 제공됨

- **target 위치**: §7.3 InteractionToken — 헤더 및 본문 전체 교체
- **과거 결정 출처**: main 브랜치 §7.3 본문 "별도 테이블을 만들지 않고 JWT 자체에 모든 정보를 담는다"
- **상세**: 과거 §7.3 은 `per_execution` 토큰을 stateless JWT + Redis blacklist 만으로 처리하며 별도 DB 테이블을 두지 않겠다고 명시했다. 이번 변경은 `execution_token` 테이블(V060)을 신설해 jti 를 영속 추적하는 구조로 번복한다. 번복 이유(durable outbox 필요, dual-write 없는 reconciliation source)는 신규 R15 에서 충분히 설명되어 있고 기각 대안 항목도 명시됐다.
- **평가**: 번복에 필요한 새 Rationale(R15)이 함께 작성되었으므로 Rationale 연속성 위반이 아니다.
- **제안**: 없음 — 처리 완료.

---

### 2. [INFO] §3.3.1 타입 분리 "v2 권고" → "v1 구현됨" 전환

- **target 위치**: §3.3.1 Implementation Note — "타입 분리 권고 (v2 이후)" 헤더 및 본문
- **과거 결정 출처**: main 브랜치 §3.3.1 — "현재 `InteractionRequestContext.scope?` optional 필드 단일 타입은 위 invariant 를 컴파일러로 강제하지 못한다. v2 에서는 다음 분리를 권고"
- **상세**: 과거 버전은 union 타입 분리를 "v2 이후 권고"로 deferral 했다. 이번 변경은 동일 구조가 v1 에서 이미 구현됐다고 선언하며 헤더를 "구현됨 — `interaction.guard.ts`"로 바꾼다. "권고"는 Rationale 에 기록된 기각 결정이 아니라 구현 준비 상태 표기이므로, 구현 완료에 따른 문서 업데이트로 볼 수 있다. Rationale 에 "v2 까지 포함 금지"라는 명시적 기각 선언이 없으므로 Rationale 연속성 위반이 아니다.
- **제안**: 없음 — 처리 완료.

---

### 3. [INFO] `403 SCOPE_MISMATCH` → `401 TOKEN_SCOPE_MISMATCH` 번복 — R14 로 근거 제공됨

- **target 위치**: §5.1 에러 응답 표 — 기존 `403 Forbidden | SCOPE_MISMATCH` 행 제거, `401 | TOKEN_SCOPE_MISMATCH` / `TOKEN_AUDIENCE_MISMATCH` 추가
- **과거 결정 출처**: main 브랜치 §5.1 에러 표 "403 Forbidden | SCOPE_MISMATCH"
- **상세**: HTTP 시맨틱 관점에서 scope 불일치를 `403`(인가 실패)으로 표기하는 것이 과거 spec 표기였다. 이번 변경은 이를 `401`로 통일하는 대안을 채택한다. R14 는 이 번복의 근거를 명시하며, 구현(`interaction.guard.ts` `deny()` = UnauthorizedException)이 이미 401 이라 spec-impl drift 해소임을 명시한다. §8.2 algorithm-leak 차단 정신과의 정합도 설명되어 있다.
- **평가**: 번복에 필요한 R14 가 함께 작성됐으므로 Rationale 연속성 위반이 아니다.
- **제안**: 없음 — 처리 완료.

---

### 4. [INFO] `VALIDATION_FAILED` → `VALIDATION_ERROR` 코드명 변경 — R8 동기화됨

- **target 위치**: §3.2 EIA-IN-10, §5.1 에러 표, §9.1 처리 흐름 Step 11d, Rationale R8
- **과거 결정 출처**: main 브랜치 R8 — "`400 VALIDATION_FAILED` 만 idempotency cache 에서 제외"
- **상세**: 에러 코드명이 `VALIDATION_FAILED` 에서 `VALIDATION_ERROR` 로 변경됐다. R8 도 동일하게 업데이트되어 내부적으로 일관성이 있다. API 규약 §5.3 의 표준 코드명(`VALIDATION_ERROR`)과의 정합이 목적이며, 본문과 Rationale 이 동기화되어 있다.
- **평가**: 과거 R8 에서 "VALIDATION_FAILED 를 사용해야 한다"는 원칙이 기각 사유로 명시된 게 아니라 단순 기술이었으므로, Rationale 연속성 위반이 아니다.
- **제안**: 없음 — 처리 완료.

---

### 5. [WARNING] §5.1/§5.4 `202 Accepted` no-content → ack body 전환 — Rationale 항목 부재

- **target 위치**: §5 도입부 전송 봉투 주석 — "예외 2: §5.1(`interact`)는 성공 시 `202 Accepted` + body 없음(no-content path)" 구절 제거, 대신 "§5.1 `interact`·§5.4 `cancel` 는 비동기라 `202 Accepted` 로 응답하지만 no-content 가 아니다"로 대체
- **과거 결정 출처**: main 브랜치 §5 도입부 — "예외 2: §5.1(`interact`)는 성공 시 `202 Accepted` + body 없음(no-content path) — 클라이언트는 body 를 소비하지 않으므로 봉투 언랩 해당 없음"
- **상세**: 과거 버전은 `/interact`(§5.1)와 `/cancel`(§5.4)의 `202` 응답을 no-content 로 명시했다. 이번 변경은 두 엔드포인트가 `InteractAckDto { executionId, accepted, currentStatus }` / `{ executionId, status }` 를 담은 응답 body 를 반환한다고 번복한다. 단, 이 번복에 대한 별도 Rationale 항목이 신설되지 않았다. 신규 R13·R14·R15 는 모두 다른 주제를 다루며, no-content → body-present 전환의 설계 근거가 Rationale 에 기록되어 있지 않다.
- **제안**: Rationale 에 no-content 에서 ack body 제공으로 전환한 이유를 기록하는 항목을 추가한다 (예: R16). 근거 후보: 클라이언트가 `currentStatus` 를 즉시 확인해 SSE 연결 없이도 기본 흐름을 처리할 수 있다는 점, 구현 현실 반영(현재 `interaction.controller.ts` 가 body 를 반환함) 등.

---

### 6. [INFO] EIA-RL-06 신설 요구사항 + §9.3 Terminal revoke 절 신설

- **target 위치**: §3.4 신뢰성·일관성 표 EIA-RL-06 신규 행, §9.3 Terminal token revoke 절 신설
- **과거 결정 출처**: 해당 없음 (신규 요구사항)
- **상세**: EIA-RL-06 (terminal revoke at-least-once)는 신규 요구사항으로 기존 Rationale 에서 기각된 대안이 아니다. R15 에 채택·기각·잔여 위험이 상세히 기술되어 있다.
- **평가**: 신규 추가이며 기존 기각 결정과 충돌 없음.
- **제안**: 없음.

---

## 요약

이번 변경은 `spec/5-system/14-external-interaction-api.md` 에 (1) terminal token revoke at-least-once(EIA-RL-06 + R15), (2) execution_token 영속 테이블 신설(§7.3 + R15), (3) 토큰 실패 status 전면 401 통일(§5.1 + R14), (4) WS/EIA 에러 코드 매핑 원칙(R13), (5) 타입 분리 v1 구현 선언(§3.3.1) 을 포함한 대규모 업데이트를 적용한다. 각 번복·신설에는 해당 Rationale 항목(R13·R14·R15)이 동반 작성되어 있어 대부분의 연속성 위반이 충족 해소됐다. 예외로 §5.1·§5.4 의 `202` no-content → ack body 전환이 과거 본문 명시("body 없음(no-content path)")와 배치되는데, 이에 대한 Rationale 항목이 신설되지 않았다. 위험도는 낮으나 Rationale 공백이므로 항목 추가를 권고한다.

## 위험도

LOW
