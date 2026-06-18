# Cross-Spec 일관성 검토 — `spec/5-system/4-execution-engine.md`

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상 범위: `spec/5-system/4-execution-engine.md` 현행 전체
비교 대상: `spec/1-data-model.md`, `spec/0-overview.md`, `spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, 기타 spec/**

---

## 발견사항

### [INFO] `pending_plans` frontmatter 에 `spec-sync-execution-engine-gaps.md` stale 참조

- target 위치: `spec/5-system/4-execution-engine.md` line 11 (frontmatter `pending_plans`) / line 1039 (본문 §8 banner)
- 충돌 대상: `plan/complete/spec-sync-execution-engine-gaps.md` (완료 이동됨)
- 상세: frontmatter `pending_plans` 목록 및 §8 구현 상태 banner 가 `plan/in-progress/spec-sync-execution-engine-gaps.md` 를 참조하나, 실제 파일은 `plan/complete/spec-sync-execution-engine-gaps.md` 로 이동 완료됐다. JSDoc 구현 착수 전 참조 경로가 깨져 있어 navigation 오류를 유발할 수 있다.
- 제안: frontmatter `pending_plans` 에서 해당 항목 제거(완료됨) 및 본문 §8 banner 의 path 참조를 `plan/complete/` 로 정정하거나 제거.

---

### [INFO] `Execution.status` 상태 집합 — data-model 과 execution-engine 간 완전 일치 확인

- target 위치: `spec/5-system/4-execution-engine.md` §1.1 상태 테이블
- 충돌 대상: `spec/1-data-model.md` line 459
- 상세: data-model `Execution.status` Enum = `pending / running / completed / failed / cancelled / waiting_for_input` (6개). execution-engine §1.1 상태 집합도 동일 6개. 충돌 없음 — 일치 확인.
- 제안: 해당 없음 (정상).

---

### [INFO] `NodeExecution.status` 상태 집합 — data-model 과 execution-engine 간 완전 일치 확인

- target 위치: `spec/5-system/4-execution-engine.md` §1.2 상태 테이블
- 충돌 대상: `spec/1-data-model.md` line 539
- 상세: data-model `NodeExecution.status` Enum = `pending / running / completed / failed / cancelled / skipped / waiting_for_input` (7개). execution-engine §1.2 상태 다이어그램 + 테이블도 동일 7개. `skipped` 가 NodeExecution 전용임을 양쪽이 일관되게 기술함. 충돌 없음.
- 제안: 해당 없음 (정상).

---

### [INFO] C-1 분할 서비스명 — ai-agent spec 과 execution-engine spec 의 표기 일치

- target 위치: `spec/5-system/4-execution-engine.md` §1.3 "구현 위치 (C-1 분할 후)" callout / §Rationale "C-1 god-class strangler-fig 분할"
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` (line 1099 등)
- 상세: 두 문서 모두 `AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService`, `EngineDriver` 를 동일하게 참조한다. `classifyLlmError` 의 구현 위치(`AiTurnOrchestrator.classifyLlmError`) 도 양측 일관 기술. 충돌 없음.
- 제안: 해당 없음 (정상).

---

### [INFO] `exec-park-durable-resume` 계획 — frontmatter `pending_plans` 에 잔류 여부 확인

- target 위치: `spec/5-system/4-execution-engine.md` line 13 (`pending_plans`)
- 충돌 대상: `plan/in-progress/exec-park-durable-resume.md` (still in-progress)
- 상세: `exec-park-durable-resume.md` 는 `plan/in-progress/` 에 여전히 존재하며, exec-park B2b(PR-B2b) 구현은 2026-06-06 완료로 본문에 기재돼 있으나 plan 파일 자체는 완료 이동이 되지 않은 상태. `execution-engine-residual-gaps.md` (G1/G2/G3)도 in-progress 잔류. `exec-intake-queue-impl.md` 도 in-progress 잔류. 이 plan 들이 in-progress 로 남아 있는 이유(미구현 PR2-4 잔여 작업 등)가 본문 banner 로 설명되므로 현 상태 자체는 data-model 이나 API 계약 충돌이 아님 — 단, `exec-park-durable-resume.md` 의 완료된 sub-tasks(B1~B2b)는 이미 반영됐고 spec 본문이 "구현 완료"로 기술하므로, frontmatter 유지 여부는 plan lifecycle 점검 필요.
- 제안: `exec-park-durable-resume.md` 가 완전 완료됐으면 `plan/complete/` 이동 검토. 미완 PR(예: PR3/PR4)이 남아 있다면 현 위치 유지 타당.

---

### [INFO] `Execution.dry_run` / `single_node_id` / `previous_execution_id` 컬럼 — data-model ↔ execution-engine 상호 참조 일관성

- target 위치: `spec/5-system/4-execution-engine.md` §6.1.1 `ExecuteOptions` 블록 주석
- 충돌 대상: `spec/1-data-model.md` §2.13 (`Execution` 엔티티 `dry_run`, `single_node_id`, `previous_execution_id` 컬럼 정의)
- 상세: execution-engine §6.1.1 은 `singleNodeId`/`previousExecutionId` 를 `ExecuteOptions` 안에서 언급하며 data-model §2.13 컬럼과 교차 참조한다. data-model 의 `single_node_id` (V098 추가) 와 `previous_execution_id` (V098 추가) 정의가 execution-engine spec 의 서술과 의미 일치. `dry_run` (V068) 도 마찬가지. 충돌 없음.
- 제안: 해당 없음 (정상).

---

### [INFO] BullMQ 큐 3종 — `spec/0-overview.md` §2.6 Data Layer 기술과 일치 확인

- target 위치: `spec/5-system/4-execution-engine.md` §9.3 BullMQ 큐 목록
- 충돌 대상: `spec/0-overview.md` §2.6 Redis 설명 ("BullMQ 큐 백엔드 (`execution-run` intake / `execution-continuation` / `background-execution`)")
- 상세: 0-overview §2.6 이 세 큐를 명시하고 execution-engine §9.3 도 동일 3개를 목록화. 완전 일치. 충돌 없음.
- 제안: 해당 없음 (정상).

---

### [INFO] `NodeHandlerOutput` 인터페이스 — `spec/conventions/node-output.md` SoT 참조

- target 위치: `spec/5-system/4-execution-engine.md` §5.1 (`NodeHandler` / `NodeHandlerOutput` 인터페이스 정의)
- 충돌 대상: `spec/conventions/node-output.md` (Principle 1.1 / 7 / etc.)
- 상세: execution-engine §5.1 은 `NodeHandlerOutput` 을 코드 블록으로 명시하고 "CONVENTIONS Principle" 을 cross-reference 한다. node-output.md 가 SoT. 인터페이스 필드(`config`, `output`, `meta`, `port`, `status`)가 양측에서 일관 기술됨. 충돌 없음.
- 제안: 해당 없음 (정상).

---

### [INFO] `spec/5-system/4-execution-engine.md` 의 `container_id` 제약 — data-model §2.6 Node 제약과 교차 확인

- target 위치: `spec/5-system/4-execution-engine.md` §3.2 "body 서브그래프 제약" (blocking 노드 금지)
- 충돌 대상: `spec/1-data-model.md` §2.6 Node `container_id` 설명 및 제약
- 상세: data-model §2.6 은 "Background 는 `container_id` 모델을 사용하지 않고 `background` 포트 엣지로 본문 식별" 을 기술하고, execution-engine §3.3 과 §2.2 도 동일하게 서술. 컨테이너 제약(`container_id` 참조 노드 type 은 `loop`/`foreach`/`map` 중 하나)도 양측 일관. 충돌 없음.
- 제안: 해당 없음 (정상).

---

## 요약

`spec/5-system/4-execution-engine.md` 와 다른 spec 영역 간의 교차 일관성은 전반적으로 양호하다. 상태 머신(`Execution.status` 6종, `NodeExecution.status` 7종)이 `spec/1-data-model.md` 와 완전 일치하고, BullMQ 큐 3종이 `spec/0-overview.md` §2.6 과 정합하며, C-1 분할 서비스명이 `spec/4-nodes/3-ai/1-ai-agent.md` 와 일관되게 기술됐다. 유일한 실질적 언급 가치 항목은 frontmatter `pending_plans` 의 `spec-sync-execution-engine-gaps.md` 가 `plan/complete/` 로 이동 완료됐음에도 `in-progress` 경로로 참조되는 stale link 다 — API 계약·데이터 모델·상태 전이에는 영향이 없으며 구현 착수를 차단할 충돌은 발견되지 않았다.

---

## 위험도

LOW

STATUS: SUCCESS
