# Plan 정합성 검토 — `plan/in-progress/spec-draft-data-model-fk-actions.md`

## 발견사항

- **[WARNING]** §2.14 `parent_node_execution_id` 신규 서술이 다른 in-progress plan 이 이미 전제하는 두 번째 생산자(Background 노드)를 배제한다
  - target 위치: `## 변경 — spec/1-data-model.md` §C, `§2.14 NodeExecution` `parent_node_execution_id` 행 추가문 — "이 행을 만든 **Sub-Workflow 노드**의 NodeExecution — **인라인 서브 워크플로우**가 만든 자식 행에 찍혀 …"
  - 관련 plan: `plan/in-progress/node-output-redesign/background.md` 94행 — "본문 컨텍스트의 노드들은 자체 NodeExecution 레코드를 가지며 `parentNodeExecutionId` 로 Background 그룹에 묶임" — 이 in-progress plan 은 이미 이 컬럼의 Background 의미를 "잔여 권고 없음(기정 사실)" 으로 전제하고 있다. 같은 컬럼에 target 이 넣는 §2 표의 **최초 설명**이 Background 경로를 언급하지 않으면, 이 plan 이 나중에 spec 을 인용/갱신할 때 §2 쪽 서술이 자기 것보다 좁다는 것을 다시 발견해야 한다.
  - 상세: `grep -rn parentNodeExecutionId codebase/backend/src/modules/execution-engine/` 로 직접 확인하면 이 필드는 (1) `workflow.handler.ts` 인라인 Sub-Workflow, (2) `background-execution.processor.ts`/`execution-engine.service.ts` 의 `executeBackgroundSubgraph`(Background 노드), (3) `execution-engine.service.ts:7870~7881` 의 branch/AI-turn 컨텍스트(`branchParentContext`, 주석 "mirrors the Background node's parentNodeExecutionId stamping") 최소 세 생산 경로에서 채워진다. 같은 문서 §3 인덱스 표(수정 대상 아님)의 같은 컬럼 행은 이미 "sub-workflow/loop **등**" 으로 열어 두고 있어, target 이 §2 에 새로 쓰는 문장이 **같은 문서 안에서 §3 보다도 좁다**. (cross_spec 리포트가 spec-대-spec 관점에서 같은 결함을 WARNING 으로 별도 지적 — 여기서는 활성 plan 의존 관점만 추가.)
  - 제안: §2.14 설명 칸에 최소 "Sub-Workflow 노드 또는 Background 노드" 로 병기하거나, §3 표처럼 "sub-workflow 등" 으로 열어 둔다. `node-output-redesign/background.md` 는 갱신 대상이 아니다(이미 정확한 서술) — target 쪽만 넓히면 된다.

## 그 외 확인 — 문제 없음 / 참고

- **트래커 두 항목과 정합**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 4680행(Workspace `owner_id`)·4688행(`threshold_key`) 두 항목 모두 이미 "정할 것" 없이 방향이 정해진 사실-정정 지시였고, target 은 그 지시를 그대로 수행 + 근거(26 대 49 실측)로 스코프를 §2 FK 행 전부로 정당하게 넓혔다 — 트래커가 열어 둔 결정을 일방적으로 뒤집는 부분은 없다.
- **트래커의 "선택" 하위질문(§3 Workspace 행 추가 · `code:` 등재 여부, 4684~4686행) 처리**: target 은 전자를 수행(§E)하고 후자는 "비대상"에서 근거(이 문서 `code:` 가 이미 엔티티·마이그레이션 glob 뿐이고 이를 지키는 e2e 가 이미 셋이라 게이트 범위 결정이 필요)와 함께 명시적으로 보류한다. 트래커의 "결정 필요" 항목을 우회하지 않고 별도 결정으로 남긴다는 점을 밝혔으므로 CRITICAL 은 아니다. 다만 이 보류가 트래커에 새 항목으로 재등재되지 않는다 — target 의 draft 는 `plan/complete/` 로 이동될 예정이라, 이 "게이트 범위 결정" 자체를 추적할 곳이 사라진다. 낮은 우선순위이므로 INFO 로만 남긴다(아래).
- **"user 참조 FK 13개 재처분" 게이트와 무충돌**: `spec/1-data-model.md` 기존 Rationale "쓸 인덱스가 없는 FK 서른하나의 처분"(1064~1065행)이 "user 를 가리키는 13개(NO ACTION 여섯)… 사용자 삭제를 더하는 변경은 이 13개의 처분부터 다시 정해야 한다" 고 이미 결정해 둔 게이트를, target 은 그 사실을 §2 표에 서술로만 채울 뿐 재처분을 시도하지 않는다(draft 본문이 스스로 "같은 사실" 이라 명시) — 정합.
- **관련 in-progress plan 전수 스윕**: `re_run_of`·`parent_node_execution_id`·`document_chunk.knowledge_base_id`·`finish_reason`/`auto_resume_*`·`threshold_key`/`integration_expiry_dispatch` 키워드로 `plan/in-progress/**` 를 훑었을 때 target 외 유일한 교차는 위 Background 건과, 이미 자체 해소된 것으로 확인된 두 건뿐이다: `eia-terminal-payload.md`(§2.14 `Execution.error` nullable `nodeId` — 같은 문서 132행 "이미 답이 있었다(해소)" + 체크리스트 309행 완료 처리)와 `spec-draft-eia-62-waiting-payload.md`(같은 항목, 체크리스트 394행 "spec 반영 7항목 전부" 완료) — 둘 다 target 의 편집 대상(§2.14 `node_id` 행 아래 신규 삽입)과 겹치지 않는 다른 하위 표("Execution.error ↔ NodeExecution.error 관계" 서브테이블)라 실질 충돌 없음.

## INFO

- **줄 번호 인용 추가 drift**: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 348·431행이 `spec/1-data-model.md:546`(NodeExecution.status 행)을 절대 줄번호로 인용하는데, 그 인용은 이미 stale 하다(현재 실제 위치는 557행 — 이 draft 이전에 이미 11행 밀려 있었다). target 의 §C 가 `§2.14 NodeExecution` `node_id` 행 바로 아래(556행)에 새 행을 추가하면 그 오프셋이 12행으로 한 줄 더 벌어진다. target 의 책임으로 새로 생긴 drift 는 아니지만(원인은 그 사이의 다른 변경들), 같은 절을 편집하는 이번 기회에 그 plan 의 인용을 절 제목(§2.14) 기반으로 바꾸도록 곁들이면 재발을 막는다.
- **`spec/1-data-model.md` corpus 크기 문제와 상호작용**: `plan/in-progress/harness-review-gate-followups.md` 1194행 "`prioritize_bundle_files` 가 승격한 파일의 *생존*을 보장하는 층이 없다" 는 아직 미해결(`- [ ]`)이며, 그 실측 사례가 정확히 이 파일(`spec/1-data-model.md`, 현재 82,740자)이 `--spec` corpus 예산을 독식해 같은 tier 의 다른 target 파일을 0자로 굶기는 현상이었다. target 은 이 파일에 새 행 55개 이상 + Rationale 문장을 추가해 크기를 더 키운다 — 이 PR 자체가 막히는 것은 아니지만, 데이터 모델 문서가 이런 사실-정정 PR 마다 계속 커지는 한 그 harness 항목의 재현 빈도도 함께 는다는 점을 트래커에 부기할 가치가 있다.
- **트래커 "code: 등재" 하위질문의 추적처 소실**: 위에서 언급한 대로, target 이 이 하위질문을 "이 PR 에서 정할 일이 아니다"로 명시적으로 보류하면서도 새 백로그 항목으로 재등재하지 않는다. draft 자체가 `plan/complete/` 로 이동하면 이 결정 보류 사실이 in-progress 트래커에서 사라진다 — 사소하지만, 트래커에 한 줄(예: "`entity-schema-declarations.e2e-spec.ts` 를 `1-data-model.md` `code:` 에 넣을지는 게이트 범위 결정이라 별도 planner 턴 필요")을 남기면 유실을 막는다.

## 요약

Plan 정합성 관점에서 target 은 트래커(`spec-draft-nullable-notation-followups.md`)가 이미 방향을 정해 둔 두 항목을 그대로 수행하고, 실측으로 스코프를 넓힌 근거도 명시했으며, 기존 spec Rationale 이 걸어 둔 "user 참조 FK 재처분" 게이트도 건드리지 않는다 — 미해결 결정을 우회하는 CRITICAL 은 없다. 유일한 실질 WARNING 은 §2.14 신규 `parent_node_execution_id` 서술이 인라인 Sub-Workflow만 언급해, 이미 이 컬럼의 Background 의미를 기정사실로 전제하는 활성 plan(`node-output-redesign/background.md`)과 같은 문서 §3 표보다도 좁다는 점이다 — 문구 한 줄 확장으로 해소 가능하다. 그 외에는 트래커의 "선택" 하위질문 보류가 추적처를 잃는 점, 그리고 이 문서의 계속되는 몸집 증가가 이미 등재된 harness corpus-예산 문제를 키운다는 점을 INFO로 남긴다.

## 위험도

LOW
