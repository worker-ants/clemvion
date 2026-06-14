# Plan 정합성 검토 결과

## 발견사항

### **[WARNING]** C-2 체크박스 미갱신 — 구현·spec 갱신 완료됐으나 plan 항목이 미완료로 남음

- **target 위치**: `spec/5-system/13-replay-rerun.md §9.1:281` (commit `1cf359de`, `spec/data-flow/3-execution.md` 미직접 변경)
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/refactor/05-database.md` C-2 항목 (`- [ ] 결정 대기`)
- **상세**: C-2 는 plan 에서 `- [ ] 결정 대기 — (spec 1줄 동행 갱신 필요)` 이며 "사용자 보고 대상" 으로 표기된 ⚠️ 항목이다. 이 항목에 대해 구현 커밋(`1cf359de perf(executions): computeChainDepth 직렬 SELECT walk → 재귀 CTE 단일 쿼리`) 과 spec 갱신(13-replay-rerun.md §9.1:281 1줄)이 실제로 완료됐으나, plan 체크박스는 `[ ]` 미체크 상태로 남아 있다. 이는 plan-checkbox=실제상태 원칙(MEMORY.md) 위반이며, 통합/완료 판정 시점에 이 항목이 미착수로 오인될 수 있다. "결정 대기" 레이블이 사용자 사전 합의를 전제로 붙어 있었는데 — plan 의 C-2 Rationale 은 "재귀 CTE 로 바꿔도 의도 위반 아님" 이라 명시해 구현 자체는 spec 의도 내(위반 없음)이나, 체크박스가 미갱신된 상태는 plan 과 실제 상태 간 불일치다.
- **제안**: plan `/Volumes/project/private/clemvion/plan/in-progress/refactor/05-database.md` C-2 항목의 `- [ ] 결정 대기` 를 `- [x] 완료 (재귀 CTE 단일 쿼리, 2026-06-14)` 로 갱신하고, spec 갱신 사실(13-replay-rerun.md §9.1:281 `walk → 재귀 CTE` 1줄)을 기록한다.

---

### **[INFO]** C-3 spec 갱신 — plan 이 "(planner)" 역할 지정했으나 developer 가 직접 수행

- **target 위치**: `spec/1-data-model.md §3` (V095 partial 인덱스 행 추가 + V012/V034/V047/V048 stale 누락분 일괄), `spec/data-flow/3-execution.md` (V095 언급 추가)
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/refactor/05-database.md` C-3 항목 — "spec 갱신: `1-data-model.md §3` 행 추가 + `data-flow/3-execution.md` 동기화 (stale 누락분 V012/V034/V047/V048 일괄 — **planner**)"
- **상세**: plan 은 C-3 spec 갱신을 "planner" 역할에 귀속시켰다. 실제 구현에서는 developer 가 해당 spec 행 추가를 직접 수행했다(commit `4c0bdcab`). CLAUDE.md 상 developer 는 `spec/` read-only 이므로 worktree hook 이 차단했어야 하는데, 실제로 반영된 것이라면 해당 변경의 권한 모델 위반 여부를 확인해야 한다. spec 내용 자체는 인덱스 표 사실 동기화이며 결정 사항이 아닌 사실 기록이라 내용상 정합성 이슈는 없다. plan 의 역할 메모가 실제 진행과 다른 추적 불일치 수준이므로 INFO 로 분류한다.
- **제안**: 해당 spec 변경이 이미 반영됐으므로 추가 조치는 불요. 단, 향후 plan 이 "(planner)" 로 귀속한 spec 갱신은 developer가 직접 수행하지 않도록 워크플로 준수를 확인한다. plan C-3 체크박스(`- [ ] 미착수`)도 완료로 갱신 필요.

---

### **[INFO]** m-3 spec 갱신 완료 — plan 체크박스 미갱신

- **target 위치**: `spec/3-workflow-editor/5-version-history.md §7.1` (snapshot 제외 명시, commits `d80f5026`, `653be05f`)
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/refactor/05-database.md` m-3 항목 (`- [ ] 미착수`)
- **상세**: m-3 의 spec 갱신("§7.1 에 'snapshot 비포함' 1줄 권고 — planner")이 실제로 구현됐다. plan 체크박스는 미갱신 상태.
- **제안**: plan m-3 항목을 `- [x] 완료` 로 갱신.

---

### **[INFO]** `migration-tooling-evaluation.md` — Flyway 도구 교체 결정 미결 상태에서 V095 마이그레이션 추가

- **target 위치**: `spec/1-data-model.md §3` (V095 언급), `spec/data-flow/3-execution.md` (V095 언급), 코드베이스 `V095__node_execution_exec_status_partial_index.sql` (추정)
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/migration-tooling-evaluation.md` §8 다음 단계 (`- [ ] 사용자/리뷰 결정: 6.A 먼저 진행 vs 6.B Sqitch PoC 병행`)
- **상세**: `migration-tooling-evaluation.md` 는 마이그레이션 도구 전환(Flyway → Sqitch) 결정이 미결 상태이며 6.A(Flyway 보강) vs 6.B(Sqitch PoC) 선택을 사용자 결정 대기로 남겨 뒀다. 이 결정의 미결이 refactor-05-database 의 V095 마이그레이션 추가를 막지는 않는다 — 도구 결정과 무관하게 Flyway V-번호 마이그레이션 파일을 추가하는 것은 현행 규약(SoT: Flyway)에 부합한다. 이 INFO 는 두 plan 의 관계를 추적 메모하는 것이며 충돌이 아니다. Sqitch 전환이 나중에 채택되더라도 V095 자체는 Sqitch baseline 인입 대상이 될 뿐이다.
- **제안**: 추가 조치 불요. 추적 메모 수준.

---

## 요약

이번 target(spec/ 변경, refactor-05-database 작업)에서 CRITICAL 급 미해결 결정 우회는 발견되지 않았다. 주된 이슈는 **C-2 plan 체크박스 미갱신** — 구현과 spec 1줄 갱신이 모두 완료됐음에도 plan 항목이 `- [ ] 결정 대기` 로 남아 있어 실제 상태와 불일치한다(WARNING). C-3·m-3 항목도 동일하게 plan 체크박스가 미갱신 상태다(INFO). spec 내용 자체의 정합성(인덱스 표 추가, snapshot 제외 명시, computeChainDepth CTE 기술)은 각 plan 항목의 개선 방안·spec 갱신 지침과 일치하며 결정 우회나 선행 미해소 문제가 없다. 후속 항목 무효화도 없다.

## 위험도

LOW
