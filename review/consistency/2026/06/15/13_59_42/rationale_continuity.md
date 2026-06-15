# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`
대상 구현: `execution §1.3 single-node execution`
검토 기준 spec:
- `spec/5-system/13-replay-rerun.md` — §15 C3 Rationale 포함
- `spec/3-workflow-editor/3-execution.md` — §1.3 "v1 surface 아님" 노트 포함
- `spec/1-data-model.md` — §2.13 Execution 엔티티

---

## 발견사항

### [INFO] C3 deferral 사유 3건 모두 구현 설계에서 명시적으로 해소됨

- **target 위치**: `plan/in-progress/exec-single-node.md` 구현 체크리스트
- **과거 결정 출처**: `spec/5-system/13-replay-rerun.md §15` C3 행 — "입력 데이터 격리, downstream 미진행, 표현식 컨텍스트 mock"
- **상세**: §15 C3 는 세 가지를 차단 사유로 명시하고 "디버그 도구 plan 으로 분리" 했다. 이번 구현 설계는 각각을 아래와 같이 정합적으로 대응한다.
  - **입력 데이터 격리** → `previousExecutionId` 의 predecessor `NodeExecution.output_data` 를 `nodeOutputCache` 에 pre-seed 하는 방식으로 실제 predecessor 출력을 격리 공급. 미전달 시 `body.input` override.
  - **downstream 미진행** → `runExecution()` single-node 분기에서 대상 노드 실행 직후 `break` (propagate/back-edge/container/parallel 미진행). §1.2 `Run-from-Selected`(downstream 진행)와 명확히 구분.
  - **표현식 컨텍스트 mock** → `contextService.setNodeOutput` 으로 predecessor 출력을 `structuredOutputCache` 에 동기화해 표현식 resolve 가 이전 실행 값을 참조 가능하게 구성. 별도 mock 레이어 없이 실제 데이터로 resolve 컨텍스트를 채움.
- **평가**: C3 의 차단 사유가 "우리가 해결하지 못하는 문제" 가 아니라 "별도 plan 으로 분리" 였음을 plan 제목("gap-closure 잔여 슬라이스")이 뒷받침한다. 새 plan 이 해소 방식을 명시했으므로 무근거 번복이 아닌 예정된 진화.

### [INFO] §1.3 "v1 surface 아님" 노트 제거 시 Rationale 섹션 신설 필요

- **target 위치**: `spec/3-workflow-editor/3-execution.md §1.3`
- **과거 결정 출처**: 동 파일 §1.3 주석 — "설계 참고용으로 남기되 v1 surface 가 아니다"
- **상세**: 현재 §1.3 은 `_(계획·미구현)_` 마커와 "v1 surface 아님" 명시를 담고 있다. 구현 계획(exec-single-node.md)은 이 섹션을 v1 승격 + 메커니즘 기술 + §9 API 행 추가로 업데이트할 것을 명시한다. 이 과정에서 "왜 v1 판단이 변경됐는가" 에 대한 새 Rationale(또는 명시적 근거 문단)이 §1.3 또는 별도 `R-1.3` 항으로 추가되지 않으면, 현재 "v1 아님" 결정이 무근거 번복처럼 보일 수 있다.
- **제안**: `spec/3-workflow-editor/3-execution.md §1.3` 승격 시 Rationale 섹션에 `### R-1.3 단일 노드 실행 v1 승격 근거` 항을 추가한다. 핵심 내용: (a) C3 차단 사유 3건 해소 방식, (b) 전용 엔드포인트(`POST /api/workflows/:id/execute-node`)가 §1.2 `Run-from-Selected` 와 겹치지 않는 이유(downstream 미진행 vs 진행), (c) `previousExecutionId` pre-seed 메커니즘이 "이전 실행의 해당 노드 입력 데이터" 라는 §1.3 원래 표에서의 약속을 어떻게 구현하는지.

### [INFO] §15 C3 행 상태 갱신 필요

- **target 위치**: `spec/5-system/13-replay-rerun.md §15`
- **과거 결정 출처**: 동 파일 §15 C3 행 — "차단 사유: 입력 데이터 격리, downstream 미진행, 표현식 컨텍스트 mock — 디버그 도구 plan 으로 분리"
- **상세**: exec-single-node.md 는 `replay-rerun §15 C3 재조정 (본 엔드포인트로 구현됨)` 을 체크리스트 항목으로 명시하고 있다. 이 갱신이 완료되어야 §15 표와 실제 구현 상태가 일치한다. 갱신 시 C3 행을 삭제하거나, "구현됨 — `POST /api/workflows/:id/execute-node`, spec §1.3" 로 상태 변경하고 차단 사유를 해소 방식으로 교체해야 한다.
- **제안**: C3 행을 "§15 향후 확장" 표에서 제거하고 §14 (관련 설계 맥락 절) 또는 새 §14.5 에 단일 노드 실행과의 관계를 한 문단으로 기록하는 것을 권장한다. 이렇게 하면 §15 가 "아직 미해결인 확장"만 나열하는 의도를 유지한다.

### [INFO] Execution 엔티티 신규 컬럼 2종의 invariant 위반 없음 (확인)

- **target 위치**: `plan/in-progress/exec-single-node.md` Backend 체크리스트 — `single_node_id uuid null`, `previous_execution_id uuid null`
- **과거 결정 출처**: `spec/1-data-model.md §2.13` Execution 엔티티 및 Rationale
- **상세**: 신규 두 컬럼은 모두 nullable 이며, 기존 Rationale 에 기록된 `re_run_of`/`chain_id` 추가 선례와 동일한 패턴(nullable, no NOT NULL DEFAULT, 기존 row 회귀 없음)을 따른다. 1-data-model Rationale 에 명시된 어떠한 invariant(executionPath→ExecutionNodeLog 전환, install_token 형식 등)와도 직접 충돌하지 않는다. V098 마이그레이션 신설도 기존 Vxxx 번호 체계를 따른다(V097 이후).
- **제안**: 구현 완료 후 `spec/1-data-model.md §2.13` Execution 엔티티 표에 두 컬럼과 설명을 추가하고, exec-single-node.md 의 `spec_impact` 에 명시된 대로 §2.13 을 갱신한다.

---

## 요약

Rationale 연속성 관점에서 이번 구현 계획은 **기각된 대안의 재도입이 아닌, 명시적으로 "별도 plan 으로 분리" 하겠다고 예고한 C3 슬라이스의 정합적 착수**다. `spec/5-system/13-replay-rerun.md §15` 의 C3 차단 사유 세 가지(입력 데이터 격리, downstream 미진행, 표현식 컨텍스트 mock)는 구현 설계에서 각각 `previousExecutionId` pre-seed, `break`-after-target-node, `structuredOutputCache` 동기화로 대응된다. 합의된 설계 원칙(`RR-PL-03`: v1은 전체 워크플로만 — Re-run 맥락)을 위반하지 않는다. 이번 기능은 Re-run 의 서브셋이 아니라 **별도 엔드포인트**(`POST /api/workflows/:id/execute-node`)로 Re-run 흐름과 명확히 분리되어 있어 `RR-PL-03` 과 직교한다. 발견사항은 모두 INFO 등급으로, 구현 완료 후 spec 갱신 시 Rationale 섹션 신설과 §15 C3 행 정리가 필요하다는 보완 제안이다.

---

## 위험도

LOW
