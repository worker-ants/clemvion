# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/` (impl-prep) — 구현 착수 전 Rationale 연속성 확인

---

## 발견사항

### 1. 발견 없음 — per-node task queue 기각 일관성

- **[INFO]** Rationale 연속성 최우선 관심사 확인 완료
  - target 위치: `plan/in-progress/exec-intake-queue-impl.md` "불변식" 항목, `spec/5-system/4-execution-engine.md §4.2`
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` — "per-node task queue → execution-level intake 큐 (§4 재정의, 2026-06-04 결정)"
  - 상세: 기각된 per-node task queue 대안이 구현 plan(`exec-intake-queue-impl.md`)에서 재도입되지 않았다. "한 세그먼트 내부 노드 dispatch 는 in-process — per-node task queue 도입 금지" 라는 불변식이 명문화돼 있으며, spec §4.2 도 동일 원칙을 반복 강조한다.
  - 제안: 현행 유지. 이미 충분히 명시됨.

### 2. 발견 없음 — heartbeat 별도 채널 기각 일관성

- **[INFO]** 별도 heartbeat 채널(워커 5초 emit + 중앙 검사) 기각 결정 추적 확인
  - target 위치: `plan/in-progress/exec-intake-queue-impl.md` PR4 항목, `spec/5-system/4-execution-engine.md §7.1`
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` — "§7.1 heartbeat → stalled-job 일원화 (2026-06-04 결정)"
  - 상세: 별도 heartbeat 채널 신설이 "BullMQ stalled 메커니즘과 기능 중복(YAGNI)"으로 기각됐음이 Rationale 에 명시됐다. 구현 plan 의 PR4("stalled-job 일원화 + 관측성")도 이 결정을 따른다. spec §9.1 의 Redis 키 목록에 `exec:{wsId}:worker:{workerId}:heartbeat` 항목이 여전히 남아있으나 이는 기존 레거시 항목으로, §7.1 및 Rationale 의 "신설하지 않는다" 와 충돌하는지 검토가 필요하다.
  - 제안: `spec/5-system/4-execution-engine.md §9.1` Redis 키 표에 `heartbeat` 항목이 현재 구현에서 실제로 사용 중인지, 아니면 폐기 예정인지 명시하면 오독을 방지할 수 있다(INFO 수준 — 구현 착수에 차단하지 않음).

### 3. 발견 없음 — `EXECUTION_TIMEOUT` vs `EXECUTION_TIME_LIMIT_EXCEEDED` 코드 분리

- **[INFO]** 에러 코드 분리 원칙 cross-spec 정합 확인
  - target 위치: `plan/in-progress/exec-intake-queue-impl.md` PR2 항목
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` — "타임아웃을 active-running 누적 기준으로 (§8 재정의)"; `spec/5-system/3-error-handling.md §1.4` — `EXECUTION_TIMEOUT` (Code 노드 한정)과 `EXECUTION_TIME_LIMIT_EXCEEDED` (엔진 누적) 명시적으로 분리
  - 상세: 에러 코드 분리 결정이 `3-error-handling.md`, `4-execution-engine.md`, `exec-intake-queue-impl.md` 세 곳에 일관되게 반영되어 있다. 충돌 없음.
  - 제안: 현행 유지.

### 4. 발견 없음 — wall-clock vs active-running 타임아웃

- **[INFO]** `waiting_for_input` 파크 시간 타임아웃 제외 원칙 정합성 확인
  - target 위치: `plan/in-progress/exec-intake-queue-impl.md` PR2, `spec/5-system/4-execution-engine.md §8`
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` — "타임아웃을 active-running 누적 기준으로" + "waiting_for_input 은 무기한 보존"
  - 상세: PR2 의 "누적 active-running 타임아웃 → EXECUTION_TIME_LIMIT_EXCEEDED(세그먼트 active 시간 합산, wait 제외)" 와 Rationale 의 "wall-clock 이면 사용자 입력을 며칠 기다리는 정상 워크플로를 timeout 으로 죽이게 된다" 가 완전히 정합한다. 충돌 없음.
  - 제안: 현행 유지.

### 5. 발견 없음 — auth/graph-rag/mcp-client Rationale

- **[INFO]** spec/5-system/ 내 나머지 문서 Rationale 간 충돌 없음
  - `1-auth.md`: WebAuthn 자동 무효화 금지(1.4.B), TOTP fallback 자동 노출 금지(1.4.D), credential 삭제 vs suspend(1.4.E) — 구현 plan 이 auth 영역을 건드리지 않으므로 이번 target 과 충돌 없음.
  - `10-graph-rag.md`: KB 모드 사후 변경 불가(생성 시 결정), LLM 추출 단일 경로(룰 기반 기각) — 이번 target 과 직교하는 결정. 충돌 없음.
  - `11-mcp-client.md`: stdio 미지원(멀티테넌트 보안), 세션 풀링 금지(실행 격리 단순화) — 이번 target 과 직교. 충돌 없음.

---

## 요약

`spec/5-system/` 전체(impl-prep 범위)에 걸쳐 Rationale 연속성 관점의 심각한 충돌은 발견되지 않았다. 가장 중요한 두 결정 — (1) per-node task queue 기각 및 execution-level intake 큐 채택, (2) 별도 heartbeat 채널 기각 및 BullMQ stalled-job 일원화 — 모두 spec Rationale, spec 본문, 구현 plan 세 곳에 일관되게 반영돼 있다. `EXECUTION_TIMEOUT`(Code 노드 한정)과 `EXECUTION_TIME_LIMIT_EXCEEDED`(엔진 누적) 코드 분리 원칙도 `3-error-handling.md` 와 `4-execution-engine.md` 를 통해 cross-spec 정합이 확인된다. 한 가지 소규모 정비 권고는 `§9.1` Redis 키 표의 legacy `heartbeat` 항목에 폐기 예정임을 명시하는 것이나, 이는 구현 착수를 차단하지 않는다.

---

## 위험도

NONE
