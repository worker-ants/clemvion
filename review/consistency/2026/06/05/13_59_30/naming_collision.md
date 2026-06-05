# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
대상 범위: `spec/5-system/`

---

## 발견사항

### [WARNING] `pendingContinuations` 식별자 — Phase B 제거 예고와 하위 문서 기술 불일치

- **target 신규 식별자**: `spec/5-system/4-execution-engine.md` §7.4 Worker 동작 행 및 §4.x 구현 메모에서 Phase B 완료 기준으로 "`pendingContinuations` Map(worker-side fast-path) 제거됨"을 기술
- **기존 사용처**:
  - `spec/data-flow/3-execution.md` L111 — Mermaid 시퀀스 다이어그램 `alt` 분기에 `로컬 pendingContinuations hit (fast path)` 가 여전히 **활성 경로**로 기술됨
  - `spec/data-flow/3-execution.md` L52 — `worker 가 자기 인스턴스의 in-memory resolver 보유 시 즉시 resolve` 로 fast-path 동작을 현재 시제로 기술
  - `spec/4-nodes/6-presentation/0-common.md` L413 — `pendingContinuations 에 이미 등록된 resolve 가 button_click payload 로 호출될 수 있으나` 문장이 현재 구현 기술로 작성됨
- **상세**: `4-execution-engine.md §7.4` 는 "park 시 코루틴을 즉시 해제하므로(Phase B) in-process resolver(`pendingContinuations`)가 존재하지 않는다 — worker-side fast-path 는 제거됐고 재개 경로는 slow-path 로 일원화된다"고 확정 기술한다. 그러나 `data-flow/3-execution.md` 의 다이어그램은 fast-path / slow-path 이원화를 여전히 현재 모델로 묘사하고 있어, Phase B 구현자가 두 문서 중 어느 것이 현행 설계인지 혼동할 수 있다. Phase B 는 미구현(plan 체크박스 미완)이므로 코드는 아직 `pendingContinuations` 를 보유(`execution-engine.service.ts` L715)하나 spec 은 이미 제거 완료로 서술한다.
- **제안**: `spec/data-flow/3-execution.md` §1.3 다이어그램의 `alt 로컬 pendingContinuations hit (fast path)` 분기와 L52 주석을 Phase B 상태(slow-path 단일 경로)로 갱신하거나, "Phase B 이전 현행 / Phase B 이후 목표" 두 버전 표기로 전환. 구현 착수 시 혼선 방지를 위해 Phase B PR 과 동기 갱신 의무 기재 권장.

---

### [WARNING] `exec:seq:<id>` Redis 키 — `exec:cont:seq:` 와 동일 `exec:*:seq:` 네임스페이스, §9.2 키 테이블 누락

- **target 신규 식별자**: `spec/5-system/4-execution-engine.md §9.2` Redis 키 테이블이 `exec:cont:seq:<executionId>`, `exec:run:seq:<executionId>` 를 등록
- **기존 사용처**: `spec/5-system/14-external-interaction-api.md` L885 에 `exec:seq:<id>` (WS event envelope / SSE seq counter, `execution-seq-allocator.service.ts` `SEQ_KEY_PREFIX = 'exec:seq:'`)가 별도 정의됨. 해당 키는 `4-execution-engine.md §9.2` 테이블에 **미등재**.
- **상세**: 세 키 패턴 — `exec:seq:`, `exec:cont:seq:`, `exec:run:seq:` — 이 `exec:*:seq:*` 형태로 유사 네임스페이스를 공유하면서 `§9.2` 캐노니컬 테이블에는 뒤 두 개만 있다. 충돌·덮어쓰기 위험은 없으나(prefix 차이로 실제 키 충돌 없음), 새 기여자가 §9.2 만 보고 `exec:seq:` 의 존재를 모른 채 유사 패턴을 재도입할 위험이 있다. `execution-seq-allocator.service.ts` 주석에는 "continuation-bus 와 별개 네임스페이스"라고 명시되어 있어 인지는 있으나 spec 레벨에서 교차 참조가 없다.
- **제안**: `spec/5-system/4-execution-engine.md §9.2` 테이블에 `exec:seq:<executionId>` 행 추가 — "WS event envelope / SSE `id:` / Notification seq (전역, `ExecutionSeqAllocatorService`), 상세 [§14](./14-external-interaction-api.md#구현-전제)" 형태로 cross-link.

---

### [INFO] `data-flow/3-execution.md` §1.3 다이어그램 — Phase B 에서 제거될 `applyContinuation` fast-path 내부 로직 기술

- **target 신규 식별자**: Phase B 가 제거하는 `Eng->>Eng: resolver 호출 → waitForX await 풀림` 분기 (data-flow L112-113)
- **기존 사용처**: `spec/data-flow/3-execution.md` L111-116
- **상세**: WARNING 항목(첫 번째)의 연장선상. `Eng->>Eng: waitForX 직접 invoke + setImmediate 로 resolver fire` (L115) 구현 메모도 Phase B 에서 의미가 달라진다. 단 "구현 착수 전" 관점에서 Phase B 코드 작성 시 이 다이어그램이 "오래된 시도" 인지 "여전히 유효" 인지 불명확하다.
- **제안**: Phase B 구현 PR 에서 `data-flow/3-execution.md §1.3` 다이어그램을 slow-path 단일 분기로 단순화. 중간 과도기에는 `> Note: Phase B 이전 fast-path 경로는 §4.x / §Rationale "park 즉시 해제"` 주석 추가로 역사 컨텍스트 보존.

---

## 요약

`spec/5-system/` 에 도입된 신규 식별자들(`Execution.conversation_thread`, `Execution.user_variables`, `CHECKPOINT_SCHEMA_VERSION`, `exec:cont:seq:`, `CONTINUATION_SEQ_TTL_SECONDS`, `CHECKPOINT_SCHEMA_VERSION`)은 기존 코드베이스 내 다른 의미로 사용 중인 식별자와 충돌하지 않는다. 마이그레이션 번호 V084/V085 도 기존 파일과 중복 없이 순서를 따른다. 주요 위험은 식별자 자체의 충돌이 아니라 **Phase B 목표 상태(fast-path 제거·slow-path 일원화)를 서술한 `4-execution-engine.md` 와 구 fast-path 이원화 모델을 현재 시제로 기술하는 `data-flow/3-execution.md` 사이의 설계 설명 불일치**다. 이는 Phase B 구현자가 참조 문서를 잘못 선택할 경우 의도치 않은 fast-path 코드를 유지·재작성하는 위험으로 이어질 수 있다. `exec:seq:` 키의 §9.2 테이블 누락은 독립적인 일관성 보완 사항이다.

## 위험도

LOW
