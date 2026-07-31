# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건 발견 (RBAC 요약표의 Viewer 워크플로우 실행 권한 오기재). 근본 수정 대상이 `spec/` 파일이라 본 developer 세션(`--impl-done`, target=`spec/data-flow/`) 권한 밖 — 아래 §planner 인계 참고. (5개 checker 전원 인라인 전문 확보 — 재시도 필요 checker 없음)

## 전체 위험도
**HIGH** — CRITICAL 1건(spec 자기모순 + 실제 코드와 불일치)이 유일한 차단 사유이나, 이번 세션의 실제 diff(`workflows.service.ts`/`.controller.ts` — 변수 리네임·`edge.condition` 참조 격리·Swagger 포맷)와는 무관하게 target 폴더(`spec/data-flow/`) 전수 점검 중 발견된 기존 spec 결함이다(5개 checker 모두 이번 diff 자체는 spec 미변경임을 확인). 그 외에는 WARNING 4건(2건은 이번 세션 내 plan 갱신으로 즉시 해소 가능, 2건은 낮은 우선순위 spec 표기 개선)과 INFO 다수뿐이다. 참고: `rationale_continuity` 는 컨텍스트 예산 초과로 `spec/data-flow/` 16개 중 8개(external-interaction·auth·file-storage·integration·knowledge-base·llm-usage·notifications·observability)를 이번 통독 대상에서 제외했다고 명시했다 — 이번 diff 와는 무관하지만 향후 동일 target 재검토 시 커버리지 한계로 남는다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Viewer 의 "워크플로우 수동 실행" 권한이 RBAC 요약표에서 `✓ (수동 실행 only)` 로 서술되나, 표 자신이 "정식"이라 지목한 매트릭스·타 화면 매트릭스·실제 RBAC 가드 코드 셋 다 "불가(✗)"에 합의 | `spec/data-flow/12-workspace.md` §3.2 (viewer 행 "실행" 열) | `spec/5-system/1-auth.md` §3.2, `spec/2-navigation/9-user-profile.md` §4.2, `codebase/backend/src/modules/workflows/workflows.controller.ts`(`POST :id/execute` `@Roles('editor')`) + `codebase/backend/src/common/guards/roles.guard.ts`(`ROLE_HIERARCHY`, viewer=1 < editor=2) | viewer 행 "실행" 셀을 `✗` 로 정정(다른 `✗` 셀·표 자체의 "요약" 프레이밍과 통일). spec/ 쓰기 필요 → planner 턴 |

## planner 인계 (권한 밖 Critical)

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | 수정 대상이 `spec/data-flow/12-workspace.md`(spec 파일) — 본 세션은 developer 턴(`--impl-done`)이라 `spec/` read-only, 쓰기는 `project-planner` 전속 | project-planner | `spec/data-flow/12-workspace.md` §3.2 RBAC 요약표 viewer 행 "실행" 열 셀 1개를 `✓ (수동 실행 only)` → `✗` 로 정정 (표 각주 "정식 권한 매트릭스는 1-auth.md §3.2, 본 표는 요약" 과 실제 내용을 합치시킴). `1-auth.md`·`9-user-profile.md` 는 이미 정확하므로 그쪽은 갱신 불요 | 본 SUMMARY Critical #1; `review/consistency/2026/07/31/19_20_50/cross_spec.md` |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 같은 RBAC 요약표의 "LLM Config / Integration" 병합 열이 Editor 의 Model Config 전권(CRUD)을 `view` 로 축소 서술 — Critical #1 과 동일 표의 인접 리스크 | `spec/data-flow/12-workspace.md` §3.2 (editor 행) | `spec/5-system/1-auth.md` §3.2(`Model Config: CRUD`), `codebase/backend/src/modules/model-config/model-config.controller.ts`(`POST /`·`PATCH :id`·`PATCH :id/set-default`·`DELETE :id` 모두 `@Roles('editor')`) | 열을 "LLM Config"/"Integration" 로 분리하거나 각주로 리소스별 값 명시. Critical #1 정정과 같은 planner 턴에서 함께 처리 권장 |
| 2 | cross_spec + convention_compliance (교차 확인) | `0-overview.md` §4 가 선언한 "카탈로그 먼저 갱신 → `MONITORED_QUEUES` 동기화" 계약이 문자 그대로는 깨져 있음(`agent-memory-extraction` 큐 미등재, 총 18개 중 17개만 모니터링). 단 convention_compliance 가 코드·타 spec 대조로 확인한 바, 이 갭은 신규/은닉이 아니라 `spec/5-system/16-system-status-api.md §1`("⚠ 구현 갭 ... V-15 추적")과 `.claude/config/doc-sync-matrix.json` 에 이미 등재된 기존 추적 항목 | `spec/data-flow/0-overview.md` §1.2/§4 | `codebase/backend/src/modules/system-status/system-status.constants.ts`(`MONITORED_QUEUES`, 17건, `AGENT_MEMORY_EXTRACTION_QUEUE` 부재) | (택1) `MONITORED_QUEUES` 에 큐 추가해 V-15 갭 자체를 해소, 또는 (택2) `0-overview.md §4` 불변식 문장에 "현재 V-15 로 추적 중인 예외 있음" 각주 추가. 논블로킹 |
| 3 | plan_coherence | `spec/data-flow/1-audit.md` §1.1 이 확정한 "workflow/trigger/schedule/model_config 감사 로깅 미구현" 갭(코드 재확인: `AuditLogsService` 참조 0건)을, `1-auth.md` 의 유일한 `pending_plans` 소유 plan `spec-sync-auth-gaps.md` 가 추적하지 못함 — 오히려 "비고"에 "모두 구현 확인됨" 이라는 상반된 서술 보유(plan 작성 2026-06-03 이후 2026-06-11/12 에 spec 이 이 4개 갭을 추가했으나 plan 미동기화) | `spec/data-flow/1-audit.md:82-85`(상호참조: `spec/5-system/1-auth.md:429-438`) | `plan/in-progress/spec-sync-auth-gaps.md:9-19` | "미구현 항목"에 4개 카테고리 추가 + "비고"의 "모두 구현됨" 서술 정정. LDAP/SAML 만 닫혀도 이 항목 남아있는 한 `1-auth.md` `status: implemented` 오승격 금지. `plan/**` 는 developer 쓰기 가능 — 이번 세션에서 처리 가능 |
| 4 | plan_coherence | 현재 작업 plan(`review-info-followups.md`, 코드 리뷰 보류 INFO 10건 처분)과 그 출처 plan(`workflow-duplicate-nodes-edges.md`)이 서로를 참조하지 않음 — `review-info-followups.md` 가 먼저 `plan/complete/` 로 이동하면 `workflow-duplicate-nodes-edges.md:193` 체크박스가 미체크로 방치되어 후속 grooming 이 이미 끝난 조사를 반복할 위험 | (간접) `spec/data-flow/11-workflow.md` §1.5 | `plan/in-progress/workflow-duplicate-nodes-edges.md:193` ↔ `plan/in-progress/review-info-followups.md` | 먼저 완료되는 쪽에서 `workflow-duplicate-nodes-edges.md:193` 체크박스 체크 + 근거로 `review-info-followups.md`(또는 완료 후 경로) 남기기. push 전 반영 권장. `plan/**` 는 developer 쓰기 가능 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `1-data-model.md` §2.6 제약조건의 "(Background는 도입 시 추가)" 괄호가 같은 문서·`data-flow/11-workflow.md` Rationale 의 "Background 는 container_id 미사용 확정" 서술과 stale 하게 불일치 | `spec/1-data-model.md` §2.6 | 괄호 제거 또는 "(background 포트 엣지로 별도 식별 — container_id 미사용, 확정)" 로 갱신. 부수 문서 동기화 수준, planner 턴 없이도 처리 가능 |
| 2 | rationale_continuity | `11-workflow.md` Rationale 한 문단 내 "Manual Trigger" 가 노드-타입(§1.1 자동생성 시작 노드)과 Trigger 엔티티(§1.5 복제 범위 밖)를 순차로 지칭해 오독 여지(결정 충돌 아님, 추론 자체는 정확) | `spec/data-flow/11-workflow.md` Rationale "복제가 버전 이력·트리거·데이터셋을 승계하지 않는 이유" | "Manual Trigger **노드**를 `create()`처럼 자동 생성" 으로 명시하거나 각주로 두 용례 구분 |
| 3 | rationale_continuity | (확인 완료, 조치 불요) "duplicate 는 캔버스 전체 복제" Rationale 이 인용하는 `NAV-WF-04`·`1-workflow-list.md §2.6`·`3-execution.md R-2.2` 를 직접 대조 — 근거 조작·과장 없음, 기각된 대안 서술도 실제 이력과 일치 | `spec/data-flow/11-workflow.md` Rationale | 조치 불요. 감사 기록 목적 기재 |
| 4 | convention_compliance | `12-workspace.md` §1.7 시퀀스 다이어그램만 응답 wrapper(`{ data: workspace }`)를 표기, 나머지 15개 data-flow 파일은 wrapper 생략 — 기능 영향 없는 표기 스타일 차이 | `spec/data-flow/12-workspace.md` §1.7 | 다른 15개 파일과 동일하게 wrapper 생략(`200 { workspace }`)하거나 전 파일 통일. 우선순위 낮음 |
| 5 | naming_collision | `workflows.service.ts` 의 `nodeEntities`/`edgeEntities` → `nodeRows`/`edgeRows` 리네임은 신규 도입이 아니라 같은 파일 `duplicate()` 가 이미 쓰던 이름으로의 수렴 — 충돌·dangling reference 없음(전수 grep 확인) | `codebase/backend/src/modules/workflows/workflows.service.ts` | 조치 불요. 향후 TypeORM 엔티티 배열과 동명으로 재사용하지 않도록만 유의 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | CRITICAL 1건(Viewer 워크플로우 실행 권한 RBAC 요약표 오기재) + WARNING 2건(Editor LLM Config 축소 서술, BullMQ SoT 계약) + INFO 1건 |
| rationale_continuity | NONE | 이번 diff 는 spec 미변경, target 8개 파일(컨텍스트 예산 내) Rationale 전수 통독 결과 충돌 없음. INFO 1건(용어 중의성) + 확인성 기재 1건 |
| convention_compliance | NONE | 명명·출력포맷·문서구조·API문서·금지패턴 5관점 정합 확인, 링크 무결성 ~90개 확인. INFO 2건(표기 스타일, BullMQ 카운트 오탐 배제) |
| plan_coherence | MEDIUM | plan drift WARNING 2건(spec-sync-auth-gaps 갭 미추적+상반 서술, 후속 항목 상호참조 누락). 이번 diff 자체는 target 과 정합 |
| naming_collision | NONE | spec 변경 없어 신규 식별자 후보 자체 없음. 리네임 1건 INFO(충돌 아님) |

## 권장 조치사항

1. **(BLOCK 해소 — planner 턴 필요)** `spec/data-flow/12-workspace.md` §3.2 RBAC 요약표 viewer "실행" 셀 `✓`→`✗` 정정. 이번 developer 세션은 spec/ 쓰기 불가 — §planner 인계 표 참고.
2. **(같은 planner 턴에서 함께 처리 권장)** 위 정정과 동일 표의 "LLM Config / Integration" 병합 열을 분리하거나 리소스별 각주 추가 (WARNING #1).
3. **(이번 세션에서 즉시 처리 가능 — `plan/**` developer 쓰기 권한)** `plan/in-progress/spec-sync-auth-gaps.md` 의 "미구현 항목"에 workflow/trigger/schedule/model_config 감사 로깅 갭 추가 + "비고"의 상반된 "모두 구현됨" 서술 정정 (WARNING #3).
4. **(이번 세션에서 즉시 처리 가능)** `plan/in-progress/workflow-duplicate-nodes-edges.md:193` 체크박스와 `review-info-followups.md` 상호 참조 반영, push 전 완료 권장 (WARNING #4).
5. **(논블로킹, 우선순위 낮음)** `system-status.constants.ts` `MONITORED_QUEUES` 에 `agent-memory-extraction` 추가하거나 `0-overview.md §4` 에 V-15 추적 각주 추가 (WARNING #2).
6. **(INFO, 선택)** `1-data-model.md §2.6` stale 괄호 정정, `11-workflow.md` Rationale 용어 명확화, `12-workspace.md §1.7` 표기 통일.