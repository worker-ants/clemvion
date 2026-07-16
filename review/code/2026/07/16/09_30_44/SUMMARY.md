# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실제 구현(`tool-payload-save-warning.ts`, `workflows.service.ts`)과 spec(`cross-node-warning-rules.md`) 서술은 line-level 로 정확히 일치하며 코드 fix 가 필요한 결함은 없음. 다만 두 reviewer 모두 `status: partial → implemented` 승격 시점에 `pending_plans` 대상 plan 파일이 여전히 `plan/in-progress/` 에 남아 있는 프로세스 정합성 이슈를 지적함(§3.1 문언과 엄밀 불일치, 자동 가드는 통과). `user_guide_sync` 는 status=success 로 보고됐으나 output_file 이 실제로 생성되지 않아 결과 확인 불가(재시도 필요).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / documentation | `status: partial → implemented` 승격 시 `pending_plans` 가 가리키던 `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 가 아직 `plan/complete/` 로 이동하지 않음(항목 B "resume 턴 timeoutMs+signal" 미완, PR 체크박스 미완). `spec/conventions/spec-impl-evidence.md` §3.1 은 "마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격"을 명시하나, 실제로는 plan 문서가 항목 A/B 를 함께 담고 있어 항목 A(이 spec 이 참조하는 부분)만 완료된 채 문서 전체는 in-progress 로 남음. 커밋 메시지(`7231f7006`)에 의도가 명시돼 있고 자동 가드(`spec-status-lifecycle.test.ts`, `spec-pending-plan-existence.test.ts`)는 필드 존재/실존만 검사하므로 통과함(실측 확인) — 코드 결함은 아니며 두 reviewer 모두 최종 위험도를 NONE 으로 판정함. | `spec/conventions/cross-node-warning-rules.md` frontmatter(`status`/`pending_plans`), 대상: `plan/in-progress/ai-agent-tool-payload-budget-followups.md` | project-planner 판단 사안. (a) §3.1에 "plan 문서가 여러 독립 항목을 다룰 때 해당 spec 이 참조하는 항목만 완료되면 그 spec 의 `pending_plans` 참조를 제거할 수 있다"는 예외 문구 추가, 또는 (b) 항목 A/B 를 별도 plan 파일로 분리해 "1 plan ↔ 1 완료 이동" 원칙 유지. 코드 revert 대상 아님. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | §8 표 신규 서술("`getGraphWarnings` append + `saveCanvas` severity `error` 시 차단")과 실제 구현이 line-level 로 정확히 일치 — `getGraphWarnings` 가 `toolBudgetResults` 를 `results` 배열에 spread, `saveCanvas` 가 `evaluateToolPayloadWarningsAndThrow` 호출해 `toolBudgetStrictSave()` on 시 error 를 `GRAPH_VALIDATION_FAILED` 로 throw. `severity = hardExceeded && toolBudgetStrictSave() ? 'error' : 'warning'` 로직도 §4.2/§10 서술과 일치 | `workflows.service.ts:408-470,565-608,645-685`, `tool-payload-save-warning.ts:184-234`; 유닛테스트 `workflows.service.spec.ts:931,962,984,1025` | 없음(확인 완료) |
| 2 | requirement | i18n `GRAPH_WARNING_KO['ai_agent:tool-payload-budget']` 의 `{{node}}/{{bytes}}/{{toolCount}}/{{budget}}` 보간 키가 구현 `params` 필드와 정확히 대응. `culprit` 은 optional 이라 KO 템플릿 미사용이나 §3 원칙과 정합 | `backend-labels.ts:634-645`, `backend-labels.test.ts:300-315`, `tool-payload-save-warning.ts:219-225` | 없음(확인 완료) |
| 3 | requirement | `1-ai-agent.md` frontmatter `status: partial` 잔존은 이 diff 범위 밖 — 다른 미구현 surface(`tool_call_not_implemented`) 때문에 타당 | `spec/4-nodes/3-ai/1-ai-agent.md:3` | 없음(참고용) |
| 4 | documentation | 표(§8) 서술과 구현 대조 — `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES`/`_HARD_BYTES`/`AI_AGENT_TOOL_BUDGET_STRICT_SAVE` 가 `.env.example` 에 문서화, KO 매핑·backend-only 목록 등록도 실존. "⚠ 구현 예정(Planned)" 문구 제거 타당 | `workflows.service.ts:443-455,565-608,645-680`, `codebase/backend/.env.example` | 없음(확인 완료) |
| 5 | documentation | `1-ai-agent.md` 의 `pending_plans` 는 이 followups plan 이 아닌 다른 plan(`ai-agent-tool-connection-rewrite.md`)만 참조 — 두 spec 간 정합성 교차 확인 완료 | `spec/4-nodes/3-ai/1-ai-agent.md` | 없음(확인 완료) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | NONE | §8 표/구현 line-level 일치, i18n params 계약 정합. `pending_plans`/plan lifecycle 시점 불일치는 WARNING 태깅했으나 프로세스 공백일 뿐 코드 결함 아님으로 최종 NONE 판정 |
| documentation | NONE | 동일 이슈(`pending_plans` vs plan in-progress 잔존)를 INFO 로 관찰, 실질 문제 아님으로 결론 |
| user_guide_sync | 재시도 필요 | status=success 로 보고되었으나 `user_guide_sync.md` output_file 이 디렉토리에 실제 존재하지 않음(FS-write flakiness) — 내용 확인 불가 |

## 발견 없는 에이전트

없음 (requirement/documentation 모두 관찰 사항 있음; user_guide_sync 는 재시도 필요로 별도 분류).

## 권장 조치사항

1. `user_guide_sync` reviewer 를 재실행하여 실제 산출물을 확보하고 결과를 확인한다(기존 output_file 부재 — 알려진 workflow FS-write 비결정성).
2. (선택, project-planner 사안) `spec/conventions/spec-impl-evidence.md` §3.1 에 "plan 문서가 복수 독립 항목을 담을 때 부분 완료 처리" 예외 규정을 명문화하거나, 향후 유사 케이스에서는 완료 항목을 별도 plan 파일로 분리해 `plan/complete/` 이동 원칙을 유지한다. 이번 diff 자체를 되돌릴 필요는 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `requirement`, `documentation`, `user_guide_sync` (3명)
  - **강제 포함(router_safety)**: `documentation`, `requirement`
  - **제외**: 아래 표 (11명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | security | router 판단상 본 변경(spec 문서 + 기존 구현 서술 반영)과 무관 |
  | performance | 코드 로직 변경 없음(spec 문서만 갱신) |
  | architecture | 아키텍처 영향 없음 |
  | scope | 해당 없음으로 판단 |
  | side_effect | 해당 없음으로 판단 |
  | maintainability | 해당 없음으로 판단 |
  | testing | 신규 테스트 코드 변경 없음(기존 테스트 대조만) |
  | dependency | 의존성 변경 없음 |
  | database | 데이터베이스 영향 없음 |
  | concurrency | 동시성 영향 없음 |
  | api_contract | API 계약 변경 없음 |