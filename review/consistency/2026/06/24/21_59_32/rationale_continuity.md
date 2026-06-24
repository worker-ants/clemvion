# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-c1m7-publish-failfast.md`
관련 spec: `spec/5-system/4-execution-engine.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/2-api-convention.md`

---

## 발견사항

### 1. [INFO] `§1.5` 섹션 intro 수정 — 합의 표현 완화는 기존 Rationale 과 정합

- **target 위치**: `3-error-handling.md §1.5` intro 라인 수정 (편집 2a)
- **과거 결정 출처**: `3-error-handling.md §1.5` 기존 본문 — "WebSocket ack 응답 전용이며 REST API 에는 적용되지 않는다"
- **상세**: `SERVER_SHUTTING_DOWN` 은 `§11` 명시("HTTP 진입점은 503 으로 표기")에 의해 이미 REST 표면이 있다. 기존 intro 가 "전용" 로 단언하는 것이 사실상 사내 inconsistency 였고, target 은 이를 "주로 WS 전용, 일부 코드는 REST 503 으로도 표기"로 완화한다. 이는 기각된 대안의 재도입이 아니며 기존 §11 결정과의 정합화다.
- **제안**: 이상 없음. 단, intro 정정과 함께 §1.5 에 "일부 코드가 REST 표면을 가지는 설계 원칙은 4-execution-engine.md §Rationale 의 SERVER_SHUTTING_DOWN 선례를 따른다"는 한 줄 cross-link 를 추가하면 향후 검토자의 혼선을 줄일 수 있다.

---

### 2. [INFO] HTTP 503 행 신설 — 기존 HTTP 상태 코드 표의 암묵적 갭 메움

- **target 위치**: `2-api-convention.md §6` 500 행 아래 503 행 추가 (편집 1)
- **과거 결정 출처**: `2-api-convention.md §6` HTTP 상태 코드 표 (현재 500 이 마지막이며 503 없음) + `4-execution-engine.md §11` (SERVER_SHUTTING_DOWN 503 선례 명시)
- **상세**: `§11` 과 동 Rationale "Durable Continuation & Graceful Shutdown" 에서 이미 503 이 REST 표면으로 사용되고 있으나 §6 표에는 503 행이 없었다. 이는 표와 본문 간의 드리프트다. target 이 이를 추가한다. 기각된 대안을 재도입하거나 원칙을 위반하지 않는다.
- **제안**: 이상 없음. 다만 503 셀의 예시 텍스트가 길어지므로, 실제 편집 시 표 컬럼 폭 가독성을 확인 권장.

---

### 3. [INFO] `EXECUTION_ENQUEUE_FAILED` 신규 코드 — `§1.5` 등재 시 `RESUME_*` 비동기 원칙과의 경계 명시 필요

- **target 위치**: `3-error-handling.md §1.5` EXECUTION_INTERNAL_ERROR 행 아래 EXECUTION_ENQUEUE_FAILED 추가 (편집 2b)
- **과거 결정 출처**: `4-execution-engine.md §7.5.1` 및 `§Rationale "`RESUME_*` 동기 ack 노출 폐기"` — 동기 ack 는 publisher 측 사전 검증(`INVALID_EXECUTION_STATE`)만 담고, enqueue 후 실패는 비동기 `execution.cancelled` 이벤트로 통지된다는 합의 원칙.
- **상세**: target 의 `EXECUTION_ENQUEUE_FAILED` 는 `cancelWaitingExecution` 의 BullMQ enqueue 실패(`queued:false`)를 REST `POST /executions/:id/stop` 의 동기 응답으로 surface 하는 것이다. 이는 "enqueue 후 비동기 통지" 원칙과 경계가 닿아 보이지만, 실질적으로 다른 범주다: cancel 경로에서 publish 실패가 enqueue 시도 자체가 실패(Redis 장애로 queue.add 가 `queued:false` 반환)하는 시점, 즉 "enqueue 에 진입하지도 않은" 케이스를 동기 surface 하는 것이다. 기존 Rationale 이 기각한 것은 "enqueue 후 worker 측 실패를 동기 ack 로 돌려보내는 것"이었으므로 직접 충돌은 아니다. 단, §1.5 등재 설명이 이 차이("publish 시도 자체 실패 = enqueue 전 실패")를 명시하지 않으면 `RESUME_*` 비동기 원칙과의 혼동 위험이 있다.
- **제안**: §1.5 의 EXECUTION_ENQUEUE_FAILED 행 설명에 "enqueue 자체가 실패(Redis 장애 — queue.add 반환 `queued:false`)한 경우의 동기 surface. worker 측 비동기 실패(`RESUME_*`)와는 달리 enqueue 미진입 케이스"임을 명시해 `§Rationale "`RESUME_*` 동기 ack 노출 폐기"` 원칙과의 경계를 문서화한다.

---

### 4. [INFO] `exec:cont:seq` fail-fast vs `exec:seq` in-memory degraded fallback 비대칭 — 신규 Rationale 에 명시, 정합

- **target 위치**: `4-execution-engine.md §9.2` exec:cont:seq 행 추가분 + `## Rationale` 신규 subsection (편집 3, 5)
- **과거 결정 출처**: `4-execution-engine.md §9.2` — `exec:seq` 는 "Redis 미가용 시 in-memory per-instance degraded fallback (분산 monotonic 미보장 — 수용된 trade-off)" 명시. `exec:cont:seq` 는 기존에 fallback 미정의.
- **상세**: target 의 M-7 Rationale 신규 subsection 은 두 seq 의 비대칭을 명시적으로 서술한다 — `exec:seq`(emit-event)는 분산 monotonic 을 수용하고 in-memory degraded fallback 을 가지는 반면, `exec:cont:seq`(continuation seq)는 jobId dedup 계약 보존이 가용성보다 우선이라 fail-fast 를 채택. 이는 기존 §9.2 의 `exec:seq` fallback 결정을 번복하거나 기각하는 것이 아니라, 새로운 M-7 결정에 대해 그 비대칭의 근거를 새 Rationale 로 기록하는 것이다. 기존 합의 원칙과 충돌 없음.
- **제안**: 이상 없음.

---

### 5. [INFO] `§7.4` 신규 bullet — "WS §4.2 queued 계약 준용" 표현이 선례 계보와 약간 어긋남

- **target 위치**: `4-execution-engine.md §7.4` line 894 bullet 직후 추가 (편집 4)
- **과거 결정 출처**: `4-execution-engine.md §11` SERVER_SHUTTING_DOWN 503 선례 및 동 Rationale "Durable Continuation & Graceful Shutdown". WS §4.2 의 `queued` 신호는 WS 평면 ack 맥락의 개념.
- **상세**: target 은 REST stop() 의 WAITING cancel 경로에서 `queued:false` 를 503 으로 surface 하는 것을 "WS §4.2 queued 재시도 계약 준용"으로 표현한다. WS §4.2 의 `queued` 개념은 WS 평면 ack 맥락이고, 본 편집은 REST 진입점의 HTTP 503 이다. "준용"이라는 표현이 WS 계약이 REST 에도 직접 적용된다는 오해를 줄 수 있다. 실질적으로는 SERVER_SHUTTING_DOWN 503 선례(upstream 의존성 장애)가 더 직접적인 선례다. 기각된 대안 재도입이나 invariant 위반은 아니나 표현 정확성 문제다.
- **제안**: bullet 내 "WS §4.2 queued 재시도 계약 준용" 표현을 "SERVER_SHUTTING_DOWN 503 선례(upstream 의존성 장애 → 503 + 재시도 권장, `§11`)와 동형"으로 수정하면 기존 Rationale 계보와 더 명확히 정합된다. WS §4.2 `queued` 참조는 개념 설명 보조 역할로 parenthetical 처리 권장.

---

## 요약

target spec-draft 가 도입하는 변경(C-1 cancelWaitingExecution void→Promise 패턴 통일, M-7 nextSeq random fallback 제거→fail-fast)은 기존 spec `## Rationale` 에서 명시적으로 기각된 대안을 재도입하거나 합의된 불변식을 우회하는 사례가 발견되지 않았다. 신규 `## Rationale` subsection(편집 5)이 M-7 결정의 배경·비대칭 이유·대안 기각 근거를 완비하고 있어 결정의 무근거 번복에도 해당하지 않는다. 세 가지 INFO 사항이 있다: (1) `EXECUTION_ENQUEUE_FAILED` 의 §1.5 등재 설명이 `RESUME_*` 비동기 원칙과의 경계("enqueue 미진입 케이스")를 명시하면 향후 혼동을 예방한다. (2) REST stop() bullet 의 "WS §4.2 queued 계약 준용" 표현이 SERVER_SHUTTING_DOWN §11 선례로 교체되면 Rationale 계보가 더 명확해진다. (3) §1.5 intro 완화 후 cross-link 보강 권장. 전체적으로 impl-first additive sync 목적에 부합하며 Rationale 연속성 위반 없음.

---

## 위험도

LOW
