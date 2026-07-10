# Consistency Check 통합 보고서

**BLOCK: NO** — 확보된 결과 범위 내 Critical 없음. 단, 아래 "재시도 필요" 항목으로 인해 **이 판정은 잠정적(provisional)** 이다.

## 전체 위험도
**MEDIUM** — `__` prefix 예약 네임스페이스가 문서상 보장일 뿐 노드 레벨에서 강제되지 않는 WARNING 1건(cross_spec) 존재. 나머지 3개 checker(rationale_continuity/convention_compliance/plan_coherence)는 status=success 로 보고됐으나 output_file 이 디스크에 실제 생성되지 않아(known FS-write flakiness — `_prompts/` 하위에는 프롬프트 파일만 존재하고 실제 출력이 없음) 내용을 확인할 수 없음 — 재시도 필요.

## Critical 위배 (BLOCK 사유)

없음.

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `원칙 5` 가 주장하는 `variables.__*` "예약 네임스페이스 — 사용자 변수와 충돌하지 않는다" 가 Variable Declaration/Modification 노드 spec·구현으로 보장되지 않음. 사용자가 `variable: "__workspaceId"` 등을 Variable Modification 노드 대상으로 지정하면 핸들러가 검증 없이 `context.variables["__workspaceId"]` 를 덮어쓸 수 있고, 역으로 `__` prefix 사용자 변수는 `filterUserVariables`(park 영속)가 무조건 drop 해 재개 후 silent 소실 가능 | `spec/conventions/execution-context.md` §원칙 5, L63-69 (특히 L65) | `spec/4-nodes/1-logic/4-variable-declaration.md`(prefix 제한 없음) · `spec/4-nodes/1-logic/5-variable-modification.md`(prefix 제한 없음) · `codebase/backend/src/nodes/logic/variable-modification/variable-modification.handler.ts`(이름 검증 없이 직접 대입) · `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7559`(`filterUserVariables` 가 `__`-prefix 키 무조건 제외) | (a) Variable Declaration/Modification 스키마에 `__` prefix 이름 거부 가드 추가 + 두 노드 spec 에 "예약 prefix — 사용 불가" 명문화 (`1-carousel.md:368` 의 `button.id` `__item_` prefix schema-level reject 가 선례), 또는 (b) 가드 미추가 시 `execution-context.md` §원칙 5 의 "충돌하지 않는다" 문구를 "노드 레벨에서 강제되지 않는 컨벤션(잔여 리스크)" 으로 하향. 두 방향 중 하나로 execution-context.md ↔ variable-declaration.md/variable-modification.md 정합 필요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec + naming_collision | `원칙 5` "선례" 목록이 실제 코드 SoT(`node-handler.interface.ts` L64-79 JSDoc, `__workspaceId`/`__workspaceName`/`__workspaceTimezone`/`__dryRun` 4개) 대비 `__workspaceId`/`__workspaceTimezone` 2개만 나열해 불완전(직접 모순은 아님 — 원칙 자체가 exhaustive 를 주장하지 않음). naming_collision 도 동일하게 `__workspaceName` 누락을 "충돌 아님, 완결성 메모"로 별도 확인 | `spec/conventions/execution-context.md` §원칙 5, L67 | 선례 목록에 `__workspaceName`(System Context Prefix `workspace` 섹션 이름 해소) · `__dryRun`(Re-run dry-run 모드, `spec/5-system/13-replay-rerun.md` §7.2) 두 항목 추가 |
| 2 | (재시도 필요) rationale_continuity | status=success 로 보고됐으나 `review/consistency/2026/07/10/10_56_04/rationale_continuity.md` 가 디스크에 생성되지 않음(`_prompts/` 하위 프롬프트 파일만 존재, 실제 출력 없음) | N/A | 해당 checker Agent 재실행 후 통합 보고서 갱신 |
| 3 | (재시도 필요) convention_compliance | 동일 사유로 `convention_compliance.md` 미생성 | N/A | 해당 checker Agent 재실행 후 통합 보고서 갱신 |
| 4 | (재시도 필요) plan_coherence | 동일 사유로 `plan_coherence.md` 미생성 | N/A | 해당 checker Agent 재실행 후 통합 보고서 갱신 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `__` prefix 예약 네임스페이스가 Variable Declaration/Modification 노드에서 강제되지 않음(WARNING) + 선례 목록 불완전(INFO) |
| naming_collision | NONE | target 이 인용하는 `__workspaceId`/`__workspaceTimezone` 은 신규 식별자가 아니라 `node-handler.interface.ts`/`execution-engine.service.ts`/`spec/5-system/4-execution-engine.md` 등에 이미 확립된 기존 식별자의 소급 문서화 — 경쟁 사용처 없음, 신규 ID/타입/endpoint/이벤트/ENV key/파일 경로 충돌 없음 |
| rationale_continuity | 재시도 필요 | output_file 미생성 (status=success 오보 가능성, known FS-write flakiness) |
| convention_compliance | 재시도 필요 | output_file 미생성 (status=success 오보 가능성, known FS-write flakiness) |
| plan_coherence | 재시도 필요 | output_file 미생성 (status=success 오보 가능성, known FS-write flakiness) |

## 권장 조치사항
1. **[최우선]** rationale_continuity / convention_compliance / plan_coherence 3개 checker 를 Agent tool 로 직접 재실행하고 output_file 생성 여부를 `ls` 로 대조 확인한 뒤, 이번 SUMMARY 를 갱신해 BLOCK 판정을 전수 결과 기준으로 재확정할 것 (해당 3개는 아직 실질 검토가 이루어지지 않았을 가능성이 있음).
2. `spec/conventions/execution-context.md` §원칙 5 의 "`__*` 는 사용자 변수와 충돌하지 않는다" 주장을 `spec/4-nodes/1-logic/4-variable-declaration.md`/`5-variable-modification.md` 및 구현(`variable-modification.handler.ts`, `execution-engine.service.ts:7559`)과 정합시킬 것 — 스키마 가드 추가 또는 문구 하향 중 택일.
3. (선택, 낮은 우선순위) §원칙 5 선례 목록에 `__workspaceName`·`__dryRun` 추가해 `node-handler.interface.ts` JSDoc 과 exhaustive 하게 맞출 것.