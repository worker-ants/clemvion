# Cross-Spec 일관성 검토 — exec-single-node §1.3

**모드**: 구현 착수 전 검토 (--impl-prep)
**대상**: `spec/3-workflow-editor/3-execution.md §1.3·§9·R`, `spec/1-data-model.md §2.13`, `spec/5-system/13-replay-rerun.md §15 C3`
**검토일**: 2026-06-15

---

## 발견사항

### [WARNING] Graceful Shutdown Gate spec 에 신규 엔드포인트 미언급

- target 위치: `plan/in-progress/exec-single-node.md` 체크리스트 "503 shutdown gate 동일"
- 충돌 대상: `spec/5-system/4-execution-engine.md §11` (Graceful Shutdown), 현재 spec 본문 line 1186–1188
- 상세: §11 #1 은 "새 Execution 시작 거부" 게이트 대상 진입점으로 `POST /api/workflows/:id/execute` 만 명시한다. 구현 체크리스트는 "503 shutdown gate 동일" 이라고만 기술하고 있으나, 신규 엔드포인트 `POST /api/workflows/:id/execute-node` 가 §11 에 병렬 나열되지 않으면 spec 독자가 해당 엔드포인트를 gate 대상에서 제외하는 오독이 생긴다. Phase 1 구현 범위 주석(line 1188)에도 "HTTP 진입점 (`POST /api/workflows/:id/execute`) gate 만 구현됨" 이라고 단수로 명시되어 있어, 신규 엔드포인트가 자동으로 포함되지 않는다.
- 제안: `spec/5-system/4-execution-engine.md §11` #1 문장에 `POST /api/workflows/:id/execute-node` 를 gate 대상에 추가 명시. 또는 spec §11 을 "새 Execution 을 시작하는 모든 HTTP 진입점" 으로 일반화 표현으로 갱신.

---

### [WARNING] ExecuteOptions 확장이 `4-execution-engine.md §6.1` 의 선언 타입과 불일치

- target 위치: `plan/in-progress/exec-single-node.md` — "`ExecuteOptions` executedBy variant 에 `singleNodeId?` / `previousExecutionId?` 추가"
- 충돌 대상: `spec/5-system/4-execution-engine.md §6.1` (line 733–738), 타입 정의 블록
- 상세: `4-execution-engine.md §6.1` 에는 `ExecuteOptions` 타입이 `executedBy?: string` / `triggerId?: string` 두 필드만 기술된 코드 블록으로 정의된다. 신규 `singleNodeId?` / `previousExecutionId?` 필드가 추가되면 spec 의 타입 선언과 실제 구현이 diverge 된다. `3-execution.md §9 API` 행 추가와 `1-data-model.md §2.13` 갱신은 계획됐으나, `4-execution-engine.md §6.1` 의 `ExecuteOptions` 타입 블록 갱신은 plan 체크리스트에 누락되어 있다.
- 제안: spec 동기화 체크리스트에 `spec/5-system/4-execution-engine.md §6.1 ExecuteOptions` 갱신 항목 추가. 또는 `4-execution-engine.md` 의 `ExecuteOptions` 를 "공통 옵션만" 으로 범위를 좁히는 note 를 추가해 단일 노드 변형은 `3-execution.md §9` SoT 로 위임.

---

### [WARNING] `spec/5-system/13-replay-rerun.md §15 C3` 재조정 — "차단 사유" 텍스트 노출 위험

- target 위치: `plan/in-progress/exec-single-node.md` — "replay-rerun §15 C3 재조정 (본 엔드포인트로 구현됨)"
- 충돌 대상: `spec/5-system/13-replay-rerun.md §15 C3` (line 465)
- 상세: 현재 C3 행은 "차단 사유: 입력 데이터 격리, downstream 미진행, 표현식 컨텍스트 mock — 디버그 도구 plan 으로 분리" 로 기술된다. 본 구현은 C3 를 "구현됨"으로 재조정하되 "표현식 컨텍스트 mock" 은 미포함(predecessor 출력 pre-seed 로 대체)이다. 단순히 "구현됨" 으로 표기하면 C3 원래 설명의 "표현식 컨텍스트 mock" 이 함께 구현된 것으로 독자가 오독할 수 있다. §15 는 "Re-run Phase 2 후속" 이라는 섹션 컨텍스트에 있으므로, C3 를 해당 섹션에서 제거하고 "구현됨" 참조(`3-execution.md §1.3` 링크)를 §10 향후 확장 연결고리로 대체하는 편이 의미상 더 정합적이다.
- 제안: §15 C3 행을 제거하고, `13-replay-rerun.md §10` (향후 확장 — 현재 §10 에 Re-run 외 확장이 정의돼 있다면) 또는 spec 내 별도 cross-reference 로 "단일 노드 실행은 `3-execution.md §1.3` 참조" 안내 추가. Re-run 의 C3 와 단일 노드 테스트(`§1.3`)는 다른 진입점·다른 use-case(Re-run chain vs 독립 단일 실행)임을 명시해야 혼동이 없다.

---

### [INFO] `spec/1-data-model.md §2.13` 인덱스 전략 §3 갱신 미언급

- target 위치: `plan/in-progress/exec-single-node.md` — "1-data-model §2.13 Execution 컬럼 2종"
- 충돌 대상: `spec/1-data-model.md §3` (인덱스 전략 표)
- 상세: `single_node_id` / `previous_execution_id` 두 컬럼이 추가되면 Execution 인덱스 전략 §3 에 인덱스 필요 여부를 명시해야 할 수 있다. 현재 §3 의 Execution 인덱스 목록(`re_run_of`, `chain_id`, `trigger_id`, `status`, `workflow_id`) 과 함께 `single_node_id` 에 대한 조회 패턴(예: 단일 노드 실행 이력 필터)이 추후 필요해질 경우 누락 인덱스가 된다. V097 의 `WorkflowTestDataset` 도 같은 방식으로 §3 에 인덱스 행이 추가됐다.
- 제안: 구현 체크리스트에 "§3 인덱스 전략 — `single_node_id` 인덱스 필요 여부 검토 후 추가 또는 미추가 근거 기재" 항목 추가. 단순 디버그 도구라 조회 패턴이 없다면 "인덱스 없음, 디버그 전용" 을 §2.13 Rationale 에 1행 명시하면 충분하다.

---

### [INFO] `spec/0-overview.md §6.1` 구현 완료 상태 표 동기화

- target 위치: `spec/3-workflow-editor/3-execution.md §1.3` v1 승격
- 충돌 대상: `spec/0-overview.md §6.1 워크플로우 에디터` 행 — "캔버스 기반 노드 편집, 엣지 연결, 실행·디버깅, 버전 히스토리"
- 상세: §1.3 이 "계획·미구현" 에서 v1 구현으로 승격되면 0-overview §6.1 의 "실행·디버깅" 기술이 단일 노드 실행 포함으로 확장됐음을 명확히 해야 한다. 현재 표 기술은 포괄적이라 자동 포함될 수 있으나, §6.3 "로드맵/미구현" 에 §1.3 관련 항목이 없는지 확인이 필요하다. 현재 §6.3 에는 단일 노드 테스트가 별도 나열되어 있지 않으므로 0-overview 갱신 없이도 논리적 모순은 없지만, 명시적 신호로 추가하면 좋다.
- 제안: 필수 아님. `spec/3-workflow-editor/3-execution.md` frontmatter 의 `status: partial → partial` 유지 가능(§2.2·§7 등 여전히 미구현)하므로 0-overview 동기화보다 `pending_plans` 항목 정리가 우선이다.

---

### [INFO] Re-run `dry_run` 컬럼과 `single_node_id` 컬럼의 상호작용 미정의

- target 위치: `plan/in-progress/exec-single-node.md`, `spec/1-data-model.md §2.13` (신규 컬럼)
- 충돌 대상: `spec/1-data-model.md §2.13 dry_run` 컬럼 설명 / `spec/5-system/13-replay-rerun.md §7.2`
- 상세: `dry_run=true` Re-run 과 `single_node_id IS NOT NULL` 인 단일 노드 실행의 조합 시나리오(예: dry-run Re-run 중 단일 노드 실행)가 spec 어디에도 정의되지 않는다. 현재 구현 계획은 두 기능이 독립적으로 동작하도록 설계하고 있으나, 단일 노드 실행 시 `dry_run` 컬럼의 의미(항상 false? 상속 불가?) 를 명시해야 한다.
- 제안: `spec/1-data-model.md §2.13` 신규 컬럼 기술 시 "단일 노드 실행(`single_node_id IS NOT NULL`)은 `dry_run = false` 로 고정 — dry-run 와 조합 불가" 또는 "독립 설정 가능" 중 결정 후 1행 명시.

---

## 요약

이번 구현(단일 노드 실행 §1.3 v1 승격)은 기존 spec 과 직접 모순되는 CRITICAL 충돌은 없다. 핵심 충돌 위험은 두 가지 WARNING 수준이다: (1) Graceful Shutdown gate(`spec/5-system/4-execution-engine.md §11`)가 신규 엔드포인트 `POST /api/workflows/:id/execute-node` 를 명시적으로 포함하지 않아 구현자가 gate 를 빠뜨릴 수 있는 점, (2) `ExecuteOptions` 타입 선언(`4-execution-engine.md §6.1`)이 신규 필드를 반영하지 않아 spec·코드 diverge 가 생기는 점. `13-replay-rerun.md §15 C3` 재조정 시 "표현식 컨텍스트 mock" 포함 여부가 모호하게 남을 수 있어 재조정 문구를 신중하게 작성해야 한다. INFO 수준으로는 data-model 인덱스 전략 §3 갱신 누락 가능성과 `dry_run` 컬럼과의 상호작용 미정의가 있으나 차단 수준은 아니다. 전반적으로 WARNING 2건 조치 후 구현 착수가 적합하다.

## 위험도

MEDIUM
