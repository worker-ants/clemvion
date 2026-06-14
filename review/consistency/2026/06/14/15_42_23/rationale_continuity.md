# Rationale 연속성 검토 결과

## 검토 대상
- **Target**: `spec/5-system/14-external-interaction-api.md`
- **검토 모드**: spec draft 검토 (--spec)
- **기준 Rationale 출처**: 동일 파일 `## Rationale` (R1~R15) 및 `spec/5-system/4-execution-engine.md §4.4`

---

## 발견사항

### [INFO] `403 SCOPE_MISMATCH` → `401 TOKEN_SCOPE_MISMATCH` 번복 — Rationale 병기로 적절히 처리됨

- **target 위치**: §5.1 에러 표 (`403 Forbidden` 행 삭제, `401 TOKEN_SCOPE_MISMATCH`·`TOKEN_AUDIENCE_MISMATCH` 신규 추가) + §5.1 하단 주석 블록 + `## Rationale R14` 신설
- **과거 결정 출처**: 이전 spec §5.1 표의 `403 Forbidden | SCOPE_MISMATCH` 행 (main 브랜치 기준)
- **상세**: 과거 spec 은 scope 불일치를 `403 Forbidden + SCOPE_MISMATCH` 로 표기했으나, 구현(`interaction.guard.ts` `deny()`)은 이미 `401 UnauthorizedException` 을 사용해 drift 가 있었다. target 은 구현에 맞게 `401 TOKEN_SCOPE_MISMATCH` 로 정합하면서 **R14 를 명시적으로 신설**해 번복 근거를 기술했다. 번복의 동기(보안 정보 노출 최소화·§8.2 algorithm-leak 차단 정신·e2e 회귀 위험)가 충분히 서술되어 Rationale 연속성 관점에서 적정 처리다.
- **제안**: 현 상태로 충분. 다만 R14 의 "과거 spec §5.1 의 `403 SCOPE_MISMATCH` 표기는 … drift 였으며" 문장은 번복 사실을 독자에게 명확히 알리므로 향후 유사 개정 시에도 이 패턴을 참조하도록 컨벤션에 기록하면 좋다.

---

### [INFO] `§3.3.1 타입 분리` — "v2 권고" 에서 "v1 구현 완료"로 격상 — Rationale 업데이트 없으나 충돌 없음

- **target 위치**: §3.3.1 (타입 분리 구현됨 — `interaction.guard.ts`)
- **과거 결정 출처**: 이전 spec §3.3.1 — "**타입 분리 권고 (v2 이후)**" 절: `InteractionRequestContext.scope?: InteractionScope` 단일 optional 타입을 v2 에서 union 으로 바꾸도록 권고
- **상세**: 이전 spec 은 union 타입 분리를 "v2 이후 권고" 로 표시했다. target 에서는 이를 "v1 구현 완료" 로 격상했다. 구현이 앞당겨진 것이므로 기각된 대안의 재도입도 아니고, 합의된 원칙 위반도 아니다. 다만 Rationale 에 "v2 이후" 라는 명시가 있었는데 그 타임라인을 변경하면서 별도 Rationale 항이 추가되지는 않았다.
- **제안**: 기능 및 안전성 개선이므로 차단 사안 아님. 필요하다면 Rationale 에 "v1 에서 조기 구현한 이유" 한 줄 추가를 검토할 수 있다.

---

### [INFO] `§7.3 InteractionToken` — "별도 테이블 불필요" 에서 `execution_token` 테이블 도입으로 변경 — R15 로 충분히 정당화

- **target 위치**: §7.3 (`InteractionToken` 섹션 전체 재작성) + `## Rationale R15` 신설
- **과거 결정 출처**: 이전 spec §7.3 — "별도 테이블을 만들지 않고 JWT 자체에 모든 정보를 담는다. Revoke 는 jti 의 Redis blacklist 로 처리."
- **상세**: 이전 spec 은 stateless JWT + Redis blacklist 만으로 revoke 를 처리하는 단순 모델이었고 "별도 테이블을 만들지 않는다"는 결정이 명시돼 있었다. target 은 `execution_token` 테이블(V060)을 도입해 jti 를 영속 추적하며, 이를 통해 `revokeAllForExecution` (at-least-once EIA-RL-06)를 구현한다. 이는 이전 "별도 테이블 불필요" 결정의 번복이다. 그러나 R15 는 번복 이유를 명시한다: (a) process 재시작/크래시 시 in-flight revoke 소실 위험, (b) `execution_token` 이 이미 발급 토큰을 durable 추적하므로 그 자체가 outbox 역할 수행. 대안 검토(전용 outbox 테이블 → dual-write 사유로 기각, TTL 단축 → 기각)도 포함되어 있어 Rationale 연속성 관점에서 적정 처리다.
- **제안**: 현 R15 에 과거 결정 ("별도 테이블 불필요" 방침이 이전 스냅샷에 있었음)을 one-liner 로 언급하면 독자가 번복 맥락을 더 빠르게 파악할 수 있다. 필수 수정은 아님.

---

### [INFO] `EIA-RL-06` 신설 — 이전 EIA-RL-05 까지였던 신뢰성 요구사항 확장

- **target 위치**: §3.4 신뢰성·일관성 표 (EIA-RL-06 행 추가)
- **과거 결정 출처**: 이전 spec §3.4 는 EIA-RL-01~05 까지 정의. EIA-RL-06 은 이전에 없던 신규 항목
- **상세**: EIA-RL-06 은 이전에 기각되거나 결정된 대안을 재도입하는 것이 아니라 순수 신규 요구사항 추가다. §9.3·R15 와 정합.
- **제안**: 추가 의견 없음.

---

### [INFO] `§5 전송 봉투` — `§5.1` 의 `202 Accepted no-content` 정책 번복 — Rationale 미추가

- **target 위치**: §5 서두 주석 블록 (예외 2 삭제, `§5.1·§5.4` 가 ack body 를 반환한다는 내용으로 교체)
- **과거 결정 출처**: 이전 spec §5 서두 — "**예외 2**: §5.1(`interact`)는 성공 시 `202 Accepted` + body 없음(no-content path)"
- **상세**: 이전 spec 은 `/interact` 가 no-content 로 응답한다고 명시했다. target 은 `InteractAckDto` `{ executionId, accepted, currentStatus }` 를 body 로 반환하고 `{ data: {...} }` 로 래핑된다고 변경했다. 이는 이전 결정의 번복이지만 본문과 실제 구현이 일치하고 있어 실질 위험은 낮다. 다만 **이 번복에 대한 명시적 Rationale 항이 없다** — "왜 no-content 에서 ack body 로 바꿨는가"가 R1~R15 어디에도 기술되지 않았다.
- **제안**: Rationale 에 짧은 항 추가 권장 (예: "§5.1 interact/§5.4 cancel 응답 — no-content 에서 ack body 로: 클라이언트가 명령 수신 여부와 currentStatus 를 즉시 알 수 있어 SSE 의존도 감소"). 중요도 낮아 INFO 로 분류.

---

### [INFO] `execution.node.cancelled` SSE 이벤트 추가 — 기존 이벤트 목록 확장

- **target 위치**: §5.2 이벤트 종류 목록 + §11 WS 이벤트↔SSE 매핑 표
- **과거 결정 출처**: 이전 spec §5.2 이벤트 목록 — `execution.node.cancelled` 누락
- **상세**: 이전 spec 이 해당 이벤트를 명시하지 않은 것이 누락이었으며, target 이 `abortSignal`/`AbortError` (실행 엔진 §1.2) 연계와 함께 추가했다. 기각된 대안 재도입이나 원칙 위반 아님.
- **제안**: 추가 의견 없음.

---

## 요약

target 문서(`spec/5-system/14-external-interaction-api.md`)는 Rationale 연속성 관점에서 전반적으로 양호하다. 주요 번복 사항(403 → 401 통일, "별도 테이블 불필요" → `execution_token` 도입, "v2 이후 권고" → "v1 구현 완료")은 모두 신규 Rationale 항(R14·R15)을 함께 추가하여 근거를 명시했다. 명시적으로 기각된 대안을 근거 없이 재도입하거나 합의된 invariant 를 우회하는 설계는 발견되지 않았다. 유일하게 Rationale 가 빠진 번복은 `§5.1 interact`·`§5.4 cancel` 의 no-content → ack body 전환이지만, 본문과 실제 구현이 일치하고 있어 실질 위험은 낮다.

## 위험도

LOW
