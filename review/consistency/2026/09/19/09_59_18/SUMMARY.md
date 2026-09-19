# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 전 checker(5/5) 전문 확보, 재시도 필요 항목 없음.

## 전체 위험도
**LOW** — Critical 없음. WARNING 1건(두 checker 가 같은 결함을 다른 각도로 지적, 중복 통합)이 최고 등급이며 문구 한 줄 보강으로 해소 가능한 사실 정정 PR.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec + plan_coherence (중복 통합) | 신규 등재되는 `NodeExecution.parent_node_execution_id` §2.14 설명이 "Sub-Workflow 노드 / 인라인 서브 워크플로우"만 언급 — 코드상 이 컬럼의 두 번째(세 번째) 독립 생산 경로인 Background 노드 서브그래프 실행(`background-execution.processor.ts`/`executeBackgroundSubgraph`)을 배제. 같은 문서 §3 인덱스 표는 이미 "sub-workflow/loop 등"으로 열려 있어 신규 §2 서술이 §3 보다도 좁고, 활성 plan `node-output-redesign/background.md`(94행)이 이미 Background 의미를 기정사실로 전제 | `## 변경 — spec/1-data-model.md` §C, §2.14 NodeExecution `parent_node_execution_id` 행 추가문 | `spec/4-nodes/1-logic/12-background.md`(`ND-BG-04`, 88·164·241·246행), `spec/4-nodes/_product-overview.md`, `spec/5-system/4-execution-engine.md`(393행), 같은 문서 §3 인덱스 표, `plan/in-progress/node-output-redesign/background.md`(94행) | 설명 칸에 "Sub-Workflow 노드 또는 Background 노드" 병기(예: "…인라인 서브 워크플로우 · Background 서브그래프가 만든 자식 행에 찍혀…") 또는 §3 표처럼 "등"으로 열어 둠. `12-background.md#4-실행-로직` 근거 링크 추가 권장. `background.md` plan 은 갱신 불요(이미 정확) — target §C 만 넓히면 됨 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | §11.2 정정·§3 Workspace 행 추가는 새 충돌이 아니라 `4-integration.md`/`1-data-model.md §3` 이 `data-flow/5-integration.md`·`8-notifications.md`·`12-workspace.md` 와 이미 갖고 있던 편차·누락을 해소 | `## 변경 — spec/2-navigation/4-integration.md` §11.2, `## 변경 — spec/1-data-model.md` §E | 조치 불요 (확인 기록) |
| 2 | cross_spec | §2.13 `re_run_of` FK 테이블명 정정(`executions`→`execution`)은 `spec/5-system/13-replay-rerun.md` §9.1(이미 정확)과 정합시키는 정정 | `## 변경 — spec/1-data-model.md` §B | 조치 불요 |
| 3 | cross_spec | §2.22 `finish_reason` 값 확장은 `spec/data-flow/11-workflow.md` §3.3 본문과 정합(4-ai-assistant.md §6.0 의 "동일 목록" 표현이 요약이라 오해 소지만 있음) | `## 변경 — spec/1-data-model.md` §D | 이번 PR 범위 밖 — `4-ai-assistant.md` §6.0 표현 정밀화는 별도 기회 |
| 4 | rationale_continuity | "§2 FK → 행 77개" 집계가 26+49=75 와 산술 불일치 — 이 문서가 그대로 spec Rationale 에 편입될 서술이라 다음 사람이 나머지 2 를 추적해야 함 | `plan/in-progress/spec-draft-data-model-fk-actions.md` `## 방법` 절 | merge 전 77 구성 재검산 또는 한 줄 보충 |
| 5 | rationale_continuity | 표기 4종(`(CASCADE)`/`(ON DELETE CASCADE)`/`(cascade 삭제)`/`**SET NULL**—`) 불통일을 의도적으로 남긴 결정에 대한 근거가 `spec/1-data-model.md ## Rationale` 에는 아직 없음 | `## 비대상` "표기 통일" 항 | 병합 시 이 비대상 결정 문장을 `1-data-model.md ## Rationale` 에도 옮겨 향후 재작업 방지(draft 자체에 이미 그 의도로 작성돼 있어 실질적으로는 충분) |
| 6 | convention_compliance | §A 표 431·448행이 target 스스로 선언한 "괄호 앞쪽에 동작 삽입" 규칙과 다르게 뒤쪽(`(FK → DocumentChunk · SET NULL)`)에 삽입 — 정식 규약 위반은 아닌 자기-일관성 지적 | `## 변경 — spec/1-data-model.md` §A 표, 431·448행 | "방법" 절에 "단, `FK →` 가 괄호 안에 오는 431·448 은 괄호 끝에 붙인다" 한 줄 보충 |
| 7 | convention_compliance | FK 삭제 동작 표기 규약이 `spec/conventions/**` 에 아직 없음 — 이번으로 75행·4가지 형으로 확대, `audit-actions.md` 선례와 같은 궤적 | `## 비대상` 첫 항목 | 후속 plan 항목으로 "FK 삭제 동작 표기 conventions 승격 여부"를 트래커에 등재(강제 아님) |
| 8 | plan_coherence | `spec-update-node-cancellation-shutdown-classification.md` 348·431행의 `spec/1-data-model.md:546` 절대 줄번호 인용이 이미 stale(실제 557행) — target 이 §2.14 바로 아래 신규 행을 추가하면 오프셋이 한 줄 더 벌어짐(target 원인은 아님) | 대상 plan 348·431행 | 같은 절 편집 기회에 그 plan 의 인용을 §2.14 절 제목 기반으로 전환 |
| 9 | plan_coherence | `spec/1-data-model.md`(현재 82,740자)가 `--spec` corpus 예산을 독식하는 기존 harness 미해결 항목(`harness-review-gate-followups.md` 1194행)과 상호작용 — target 이 55개 이상 신규 행 + Rationale 로 문서를 더 키움 | 해당 harness plan 항목 | PR 자체는 무관하나, 사실-정정 PR 마다 문서가 계속 커지는 추세를 트래커에 부기 |
| 10 | plan_coherence | 트래커의 "선택" 하위질문 중 `entity-schema-declarations.e2e-spec.ts` 를 `code:` 에 등재할지 여부를 target 이 명시적으로 보류하되, 새 백로그 항목으로 재등재하지 않음 — draft 가 `plan/complete/` 로 이동하면 이 보류 사실 자체가 트래커에서 소실 | `spec-draft-nullable-notation-followups.md` 4684~4686행 관련 보류 | in-progress 트래커에 "code: 등재는 게이트 범위 결정, 별도 planner 턴 필요" 한 줄 등재 |
| 11 | naming_collision | §3 인덱스 전략 표에 신규 삽입되는 Workspace 행 위치가 "WorkspaceMember 행 아래"로 지시돼, §2 선언 순서 관례(Workspace §2.2 가 WorkspaceMember §2.3 보다 앞)와 유일하게 어긋남 — 식별자 충돌은 아닌 정렬 관례 문제 | `## 변경 — spec/1-data-model.md` §E, §3 표 | Workspace 행을 표 첫 행(WorkspaceMember 위)으로 옮기거나, Rationale 에 "삽입 순서는 §2 선언 순이 아니라 우연"이라는 한 줄 부기 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `parent_node_execution_id` 신규 설명이 Background 생산 경로 누락(WARNING). 나머지는 기존 편차 해소 확인(INFO) |
| rationale_continuity | NONE | Rationale 원칙(닫힌 enum·User FK 게이트·삭제 연쇄 사실) 위반 없음. 산술 오차·Rationale 이관 제안만(INFO) |
| convention_compliance | NONE | `spec/conventions/**` 위반 없음. 자기-일관성 표기·향후 규약 승격 제안만(INFO) |
| plan_coherence | LOW | 동일 `parent_node_execution_id` 결함을 활성 plan 관점에서 재확인(WARNING). 그 외 인용 drift·corpus 비대화·추적처 소실은 INFO |
| naming_collision | NONE | 신규 식별자 전부 기존 DB/코드/spec 과 정합, 충돌 없음. 표 삽입 순서만 INFO |

## 권장 조치사항
1. (BLOCK 해소 대상 없음 — 참고) §2.14 `parent_node_execution_id` 설명 칸에 "Sub-Workflow 노드 또는 Background 노드" 병기(cross_spec #1 / plan_coherence WARNING, 중복 통합 WARNING #1).
2. rationale_continuity #4 — 77 vs 26+49=75 산술 재검산 후 merge.
3. naming_collision #11 — §3 표 Workspace 행을 WorkspaceMember 위로 재배치하거나 순서 사유 한 줄 부기.
4. convention_compliance #6 — §A 표 431·448행 괄호 삽입 예외를 "방법" 절에 명문화.
5. plan_coherence #10 — `code:` 등재 게이트 범위 결정 보류를 in-progress 트래커에 별도 항목으로 남겨 `plan/complete/` 이동 시 유실 방지.
6. 그 외 INFO(#2·#3·#5·#7·#8·#9)는 이번 PR 비차단 — 후속 기회에 반영.
