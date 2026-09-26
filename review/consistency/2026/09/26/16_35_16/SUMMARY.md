# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 모두 Critical 없음. `--impl-prep` 대상 작업(`plan/in-progress/assistant-e2e-contract-gaps.md`, `spec_impact: none`, `codebase/backend/test/workflow-assistant.e2e-spec.ts` 세 칸 보강)의 착수를 막을 사유 없음.

## 전체 위험도
**LOW** — Critical/신규 충돌 없음. 번들 target(`spec/3-workflow-editor/4-ai-assistant.md`)이 안고 있던 **기존** 문서 완전성 갭 3건(WARNING, convention_compliance)만 발견됐으며 모두 이번 e2e-only 변경과 무관한 선행 상태.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance (cross_spec·rationale_continuity INFO 로 교차 확인, plan_coherence 는 이미 `spec-draft-nullable-notation-followups.md` 에 등재된 defer 항목이라 신규 아님이라 명시) | §6 REST API 표에 실제 구현된 `GET /sessions/latest` 누락, §Rationale 도 "REST API 5개" 로 실제 6개와 불일치 | `spec/3-workflow-editor/4-ai-assistant.md` §6 표 · §Rationale "REST API 5개" | `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:88` `@Get('sessions/latest')` (실제 구현), `plan/in-progress/spec-draft-nullable-notation-followups.md` 5154행 기존 등재 항목 | `project-planner` 트랙에서 §6 표에 `GET /workflow-assistant/sessions/latest — 최신 active 세션 단건({data:null} 가능)` 행 추가 + "REST API 5개"→"6개" 정정. 이번 developer e2e-only PR 범위 아님 |
| 2 | convention_compliance | §4.4 Shadow 검증 규칙 표에 실제 활성 에러코드 `PORT_NOT_FOUND` 없음 — `add_edge` 포트 존재성 검사가 노드 존재성 검사와 별도 규칙인데 표에 미등재 | `spec/3-workflow-editor/4-ai-assistant.md` §4.4 표 | 같은 문서 §Rationale(라인 987), §3.2, 라인 1492/1501/1503/1519/1531 이 `PORT_NOT_FOUND` 를 반복 참조 + `tool-call-badge.test.ts` 로 고정 | §4.4 표에 "`add_edge` 의 `source_port`/`target_port` 미존재 → `PORT_NOT_FOUND` + `portInfo.knownPorts`" 행 추가 (project-planner) |
| 3 | convention_compliance | §7 "(계획) 미구현 에러코드 — 다음 **두** 코드는" 이라는 전칭이 §12.2 의 세 번째 사례(`ASSISTANT_WORKFLOW_RUNNING`)로 반증됨 | `spec/3-workflow-editor/4-ai-assistant.md` §7 블록쿼트 vs §12.2 두 번째 불릿 | §12.2 "(계획) 실행 중 편집 도구를 shadow 단계에서 `ASSISTANT_WORKFLOW_RUNNING` 으로 거부 — 아직 미구현" | §7 에 `ASSISTANT_WORKFLOW_RUNNING` 을 ③ 항목으로 추가하거나 "다음 두 코드는" → "다음 코드들은" + §12.2 상호 참조 (project-planner) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `sessions/latest` 테스트 F 상태-코드 단언 좁히기(`toContain([200,204,404])`→`toBe(200)`)는 과거 합의 결정의 번복이 아니라 근거 없이 남아있던 방어적 tri-state 단언(도입 커밋 `ac61e64d1`, Rationale 없음)을 `swagger.md` §5-2 `ApiOkWrappedNullableResponse` 계약(200 고정)에 맞춘 정합화 | plan §처방2, `workflow-assistant.e2e-spec.ts` 테스트 F | 조치 불필요. plan 본문의 실측 인용을 유지해 향후 재론 방지 |
| 2 | rationale_continuity | §5.3.1 `tool_call.data` 필드 표가 실제 `AssistantToolCallDto` 보다 좁음 — `signature` 필드 미기재, `result` optional(`?`) 미표기 | `spec/3-workflow-editor/4-ai-assistant.md` §5.3.1 | 이번 plan 범위 밖(spec 불변). 향후 spec 갱신 시 `signature`·`result?` 를 표에 반영 |
| 3 | naming_collision | 엔티티 표기 drift — SoT(`spec/1-data-model.md` §2.20/§2.22) 는 `AssistantSession`/`AssistantMessage`, 실제 TypeORM 클래스는 `WorkflowAssistantSession`/`WorkflowAssistantMessage`. 대상 문서 자체도 초기 설계 절과 Follow-up 절에서 두 표기를 혼용. DTO/프론트 타입 레이어는 `Assistant*` 로 이미 일관 | `spec/1-data-model.md` §2.20/§2.22, entity 파일, `4-ai-assistant.md` 라인 596/825/836/840/1293/1302/1387/1389 | 이번 e2e 작업과 무관, 차단 사유 아님. 향후 data-model.md 손댈 때 엔티티명을 실 클래스명으로 갱신하거나 "entity 는 Workflow 접두, DTO/프론트는 생략" 을 Rationale 에 명시 |
| 4 | plan_coherence | `plan/in-progress/spec-draft-ed-ai-19-status.md` 가 이미 커밋(`802bd61d5`)된 변경을 기록한 채 `in-progress/` 에 남아 있고, 같은 worktree 를 공유하는 `spec-draft-nullable-notation-followups.md` 가 이를 `plan/complete/spec-draft-ed-ai-19-status.md` 로 선참조 중(경로 어긋남) | plan lifecycle (target 문서와 직접 충돌 아님) | 이 PR(또는 마무리 커밋)에서 해당 draft 를 `status: complete` + `plan/complete/` 이동 처리할 것 — 같은 worktree(`assistant-e2e-contract-gaps`) 마감 체크리스트에 추가 권장 |
| 5 | plan_coherence | `ai-agent-tool-connection-rewrite.md` 의 미결 설계 결정(도구 등록 모델 TBD)은 target 의 `cond_*`(조건 도구) 서술과 영역이 달라 충돌 없음 | `4-ai-assistant.md` §4.1 탐색 도구 표 vs 해당 plan §1/§3 71행 | 조치 불필요 — 해당 plan 자신의 체크리스트가 이미 추적 |
| 6 | cross_spec | `AssistantSession.tool_calls[].kind` 3값(`explore/plan/edit`, 영속 계층) vs SSE `tool_call.data.kind` 2값(`explore/edit`) 표면 어휘 차이 — 실측(`workflow-assistant-stream.service.ts`, `TOOL_CALL_KINDS`)으로 다른 계층을 기술함이 확인되어 충돌 아님 | `spec/1-data-model.md` §2.22 vs `4-ai-assistant.md` §5.3.1 | 조치 불필요 (정보성 기록) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | RBAC·데이터모델·container 전파(§11.2.1)·Re-run 비트리거(RR-PL-07)·딥링크·MCP selector 화이트리스트·I/O 규약·감사로그 예외 등 주요 교차참조 전부 정합. 유일한 INFO 는 §6 표의 `sessions/latest` 자기완결성 갭(cross-spec 충돌 아님) |
| rationale_continuity | NONE | 과거 Rationale 기각 대안 재도입·근거없는 결정 번복 없음. INFO 3건은 모두 참고용(방어적 미검증 단언의 정합화, DTO 표 좁음, 기존 갭 재확인) |
| convention_compliance | LOW | 이번 diff 자체의 위반은 0건. `4-ai-assistant.md` 의 **기존** 문서 완전성 갭 3건(WARNING) — §6 표 `sessions/latest` 누락, §4.4 표 `PORT_NOT_FOUND` 누락, §7 "두 코드" 전칭 반증. i18n·swagger·에러코드 명명 등 나머지 전부 준수 |
| plan_coherence | NONE | target 은 e2e-only 작업과 충돌 없음. 기존 결함은 `spec-draft-nullable-notation-followups.md` 에 이미 등재·defer. `spec-draft-ed-ai-19-status.md` 의 lifecycle 마감만 권고 |
| naming_collision | NONE | 이번 plan 은 신규 식별자 도입 없음(기존 필드 재사용). 발견된 엔티티 표기 drift(`AssistantSession` vs `WorkflowAssistantSession`)는 이번 작업과 무관한 기존 상태 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — Critical 없음) `assistant-e2e-contract-gaps` e2e 세 칸 보강은 그대로 진행 가능.
2. 이 PR 마무리 커밋에서 `plan/in-progress/spec-draft-ed-ai-19-status.md` 를 `status: complete` 로 표시하고 `plan/complete/` 로 이동 — 같은 worktree 를 공유하는 `spec-draft-nullable-notation-followups.md` 의 선참조 경로(`plan/complete/spec-draft-ed-ai-19-status.md`)와 실제 위치를 일치시킨다.
3. (별도 `project-planner` 트랙, 이번 PR 범위 아님) `spec/3-workflow-editor/4-ai-assistant.md` §6 REST API 표에 `GET /sessions/latest` 행 추가 + §Rationale "REST API 5개"→"6개" 정정.
4. (별도 `project-planner` 트랙) §4.4 Shadow 검증 규칙 표에 `PORT_NOT_FOUND` 행 추가, §7 "두 코드" 전칭에 `ASSISTANT_WORKFLOW_RUNNING` 반영 또는 문구 완화.
5. (여유 있을 때) `spec/1-data-model.md` 엔티티명(`AssistantSession`/`AssistantMessage`)과 실제 TypeORM 클래스명(`Workflow*`) 표기 차이를 통일하거나 Rationale 에 의도 명시.
