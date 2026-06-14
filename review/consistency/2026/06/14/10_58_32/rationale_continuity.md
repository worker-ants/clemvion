# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md` (refactor-04-a1-typed-errors-156e87 worktree)
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

### 발견사항 없음 — Rationale 연속성 위반 없음

이번 diff 에서 target 이 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 원칙을 위반하는 사례는 발견되지 않았다. 아래에 각 점검 관점별 근거를 기록한다.

---

### 점검 관점 1: 기각된 대안의 재도입

**[INFO]** `EXEC_*` prefix 기각과 `EXECUTION_*` 확장 선택 — Rationale 정합

- target 위치: `spec/5-system/4-execution-engine.md §7.5.2` 본문 + `## Rationale "Continuation ack client-safe typed error"`
- 과거 결정 출처: 없음 (신규 결정). 관련 원칙으로 `conventions/error-codes.md` 의 명명 안정성 정책 및 `§7.5.1`의 `INVALID_EXECUTION_STATE` 기존 패턴.
- 상세: 신규 `EXEC_*` prefix 는 기존 `EXECUTION_*` 과의 이중 표기 이유로 기각됐으며(Rationale 항목 1), 이는 error-codes.md 의 기존 코드 rename 금지·명명 안정성 원칙과 정합한다. 기각 이유가 명시돼 있다.
- 제안: 이상 없음.

**[INFO]** `_continuationCheckpoint` 컬럼 신설 기각 원칙과 신규 §7.5.2 의 관계

- target 위치: `spec/5-system/4-execution-engine.md §6.2` 저장 전략 (기존) + §7.5.2 (신규)
- 과거 결정 출처: 기존 Rationale "Multi-turn 재시작 재개 — `_resumeCheckpoint` 보존" 항의 "별도 `_continuationCheckpoint` 컬럼 신설 기각" 항목 및 "exec-park D6 — `_continuationCheckpoint` 컬럼 신설 기각과 다른 범주" 설명.
- 상세: §7.5.2 는 컬럼 신설이 아닌 ack 빌더의 에러 분기 로직 변경이므로, 기각된 대안(`_continuationCheckpoint` 컬럼 신설)의 재도입이 아니다. 기각 결정과 직교한 범주다.
- 제안: 이상 없음.

---

### 점검 관점 2: 합의된 원칙 위반

**[INFO]** `WebsocketService` 단일 sink 정책(§4.4) — 영향 없음

- target 위치: 신규 §7.5.2 는 WS ack 빌더의 에러 변환 정책이다.
- 과거 결정 출처: `§4.4 이벤트 발행 sink — WebsocketService 단일 sink 정책` Rationale.
- 상세: §7.5.2 는 sink 추상화(IExecutionEventEmitter 등)를 도입하지 않는다. WebsocketService 경유 단일 emit 원칙을 변경하지 않는다.
- 제안: 이상 없음.

**[INFO]** always-enqueue 원칙("항상 BullMQ enqueue") — 영향 없음

- target 위치: 신규 §7.5.2 는 동기 ack 빌더의 에러 표면 분기에 관한 것이다.
- 과거 결정 출처: `§Rationale "Durable Continuation & Graceful Shutdown" "Sticky fast-path 제거 — 항상 publish 원칙 보존"` 및 Websocket-protocol Rationale `"resumed 의미 재정의"`.
- 상세: §7.5.2 의 typed/plain Error 분기는 ack payload 필드 값 결정에 국한되며, publish 경로 자체(항상 BullMQ enqueue)를 변경하지 않는다. 동기 ack 는 enqueue 수락 신호일 뿐이고 `RESUME_*` 비동기 실패 경로는 별도라고 명시되어 있어 직교 원칙이 보존된다.
- 제안: 이상 없음.

**[INFO]** backend i18n 레이어 신설 기각 — 선행 결정 없으나 원칙 정합

- target 위치: Rationale 항목 2 "backend i18n 레이어 신설은 인프라 부재·비용으로 기각".
- 과거 결정 출처: 기존 Rationale 에 backend i18n 에 대한 명시적 선행 결정 없음. 단, integration-error-codes 패턴(`code → i18n key` frontend 처리)은 타 도메인에서 사용 중인 기정 패턴이다.
- 상세: frontend i18n 위임은 기존 선례(`integration-error-codes`)를 일반화한 것이다. 번복이 아닌 원칙 확장 적용.
- 제안: 이상 없음.

---

### 점검 관점 3: 결정의 무근거 번복

없음. 추가된 Rationale 항목("Continuation ack client-safe typed error — 내부 메시지 누출 차단 (§7.5.2, 2026-06-14 결정)")은 신규 결정으로, 과거 결정을 번복하지 않는다. 기각된 대안(전수 전환, `EXEC_*` prefix 신설, backend i18n 레이어) 모두 이유와 함께 명시됐다.

---

### 점검 관점 4: 암묵적 가정 충돌

**[INFO]** `worker 측 RESUME_*` 비동기 실패 경로와의 분리 — 명시됨

- target 위치: §7.5.2 본문 마지막 callout 및 Rationale "선례 정합" 항목.
- 과거 결정 출처: `§Rationale "RESUME_* 동기 ack 노출 폐기 — 후행 execution.cancelled 이벤트로 일원화"`.
- 상세: §7.5.2 는 "worker 측 비동기 실패(`RESUME_*`, §7.5.1)는 본 동기 ack 변환 경로 밖이다"라고 명시해 §7.5.1/§Rationale 의 동기/비동기 직교 분류 invariant 를 침해하지 않음을 선언했다. "동일 누출 차단 원칙은 그 이벤트 빌더에도 적용된다(별도 경로라 본 변경 범위 밖, 후속 점검 항목)"는 미완료 후속 과제를 남겼으나 이는 invariant 위반이 아닌 scope 한정 기술이며, 후속 점검 필요성을 인지하고 명시한 상태다.
- 제안: 이상 없음. 단 `RESUME_*` worker 실패 경로의 이벤트 빌더에도 동일 누출 차단 원칙을 적용하는 후속 Rationale 항목 추가를 권장한다.

---

## 요약

이번 diff(`spec/5-system/4-execution-engine.md`)가 도입한 변경은 신규 §7.5.2 본문(continuation ack typed `ExecutionError` 계약 정의) 및 대응 Rationale 항목(2026-06-14 결정 기록) 추가가 전부다. 신규 결정은 기존 Rationale 에서 명시적으로 기각된 대안(per-node task queue, `_continuationCheckpoint` 컬럼, waiting_for_retry 신규 상태, sticky fast-path 등)을 재도입하지 않으며, 합의된 설계 원칙(단일 sink 정책, always-enqueue 원칙, 동기/비동기 직교 분류, error-codes 명명 안정성)을 모두 준수한다. 기각 이유 4점이 Rationale 에 명시돼 있어 결정의 근거 없는 번복도 없다. 유일한 미완료 사항은 worker 측 `RESUME_*` 이벤트 빌더에 동일 누출 차단 원칙 적용 여부를 "후속 점검"으로 defer 한 것이나, 이는 현재 범위 밖임을 명시한 의도적 scope 결정이다.

---

## 위험도

NONE
