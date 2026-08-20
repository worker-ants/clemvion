# Consistency Check 통합 보고서

**BLOCK: YES** — `status: implemented`(또는 `partial`이지만 무관한 `pending_plans`) spec 문서 다수가, 아직 코드에 없는 `Execution.inputData` egress 마스킹·프런트 마커 가드를 "이미 완료(2026-08-20)"로 단정 — `rationale_continuity`·`convention_compliance` 양쪽 checker 가 각각 독립적으로 CRITICAL 판정.

## 전체 위험도
**HIGH** — 구조적 파괴(엔드포인트/상태머신/RBAC 변경)는 없고 spec 서술 내용의 정합 문제로 국한되지만, 위반 대상이 보안 민감 주제(자격증명 egress 마스킹)이고 `spec-impl-evidence.md` §R-5 가 명시적으로 막으려던 "책임지는 plan 없는 새 약속" 패턴을 그대로 재현해 CRITICAL 로 유지.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, convention_compliance | `status: implemented` 문서 4곳(`12-webhook.md`, `13-replay-rerun.md`, `4-nodes/1-logic/12-background.md`, `3-workflow-editor/3-execution.md`, `pending_plans:` 없음) + `14-external-interaction-api.md`(§R17 "닫는 조건 충족됐다")·`6-websocket-protocol.md`(§4.1)가 "2026-08-20 부로 egress 마스킹/Re-run 제출 차단/에디터 Run 비활성이 이미 동작한다"고 현재완료로 단언하지만, 실측(`executions.service.ts:1044` `MASKED_INPUT_DATA_REASON` 카브아웃 그대로, `toResponseExecution:1108-1114` inputData 마스킹 미적용, `rerun-modal.tsx`/`editor-toolbar.tsx` 에 마커 감지 로직 grep 0건)상 전혀 구현되지 않음. `plan/in-progress/eia-inputdata-marker-guard.md` 체크리스트 자신도 해당 항목 전부 `[ ]` | `spec/5-system/12-webhook.md:326`, `13-replay-rerun.md:358`, `14-external-interaction-api.md:1564-1569`, `6-websocket-protocol.md:205`, `spec/1-data-model.md:471,550`, `spec/4-nodes/1-logic/12-background.md:246`, `spec/3-workflow-editor/3-execution.md:91` | `spec/conventions/spec-impl-evidence.md` §3 status 라이프사이클 + Rationale R-5(`status: partial` 의 `pending_plans:` 의무화) | 위 4개 `implemented` 문서를 `status: partial` + `pending_plans: [plan/in-progress/eia-inputdata-marker-guard.md]` 로 임시 하향(또는 `6-websocket-protocol.md` 선례대로 "(2026-08-20, 미구현·Planned)" 캐비엇 명시) — **단, 이 fallback 은 spec/ 쓰기라 planner 권한**. developer 권한 내 1순위 조치는 **이번 세션에서 plan 의 남은 체크리스트(Re-run 모달 마커 가드·에디터 히스토리 로드 마커 가드·backend egress 마스킹 전환)를 push 전에 구현해 코드-스펙 정합을 실제로 맞추는 것** — plan_coherence checker 가 확인한 "spec-먼저-구현-나중" 착지 순서가 바로 이 경로를 전제로 설계됨 |

## planner 인계 (권한 밖 Critical)

`(없음)` — 위 Critical #1 의 근본 원인은 spec/ 자체의 오류(내용 오류)가 아니라 "코드가 아직 spec 을 따라잡지 못한 상태를 나타내는 메타데이터(`status`/`pending_plans`) 미기입"이며, **developer 권한 내 정상 경로(codebase/·plan/ 쓰기로 이번 세션에 구현을 완료)로 해소 가능**하다 — plan_coherence checker 가 이를 "spec-먼저-구현-나중" 이라는 이 작업(`eia-inputdata-marker-guard`) 고유의 설계된 착지 순서로 확인했다. 따라서 "여기서 developer 가 할 수 있는 일이 없다"는 planner 인계 조건에 해당하지 않는다. 다만 **이번 세션 안에 구현을 끝내지 못하고 턴을 종료해야 하는 경우**에는, spec status 메타데이터 하향(`status: partial` + `pending_plans:`)이 유일한 잔여 해소 경로이며 이는 spec/ 쓰기이므로 planner 턴이 필요하다 — 그 경우에만 아래를 인계 사유로 채택할 것.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (조건부, 미착수 시에만) | 구현을 이번 세션에 끝내지 못하면 잔여 해소책(status 메타데이터 하향)은 spec/ 쓰기로 developer 권한 밖 | project-planner | `spec/5-system/12-webhook.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·`6-websocket-protocol.md`·`spec/4-nodes/1-logic/12-background.md`·`spec/3-workflow-editor/3-execution.md` frontmatter `status`/`pending_plans` | `plan/in-progress/eia-inputdata-marker-guard.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:281`(관련 체크박스 미완) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/3-workflow-editor/3-execution.md` "inputData 데이터 흐름" 절(§10.6.1 하위, target 의 §2.2 미러 목록 밖)이 "WS 이벤트에는 inputData 가 없다"고 단정 — target 이 새로 세운 "WS `input` 필드가 REST 와 같은 store 슬롯을 채워 flip-flop 이 생긴다"는 전제(§R17 잔여② 처방 근거)와 정반대. 실측(`execution-engine.service.ts:6112-6124` emit, `use-execution-events.ts:744,794`, `execution-store.ts:644` 병합)상 target 쪽 서술이 맞고 이 절이 2026-04 이후 미갱신 stale 서술 | `spec/3-workflow-editor/3-execution.md:541-544`(§10.6.1 "Input" 탭 행 포함) | `spec/5-system/6-websocket-protocol.md:193,200`, `spec/5-system/14-external-interaction-api.md:1631` | "WS emit 이 `input` 필드로 inputData 를 실어 나르고(값-패턴 마스킹 적용) REST 폴링이 같은 슬롯을 후행 갱신한다"로 정정, WS §4.1/§R17 상호 링크. 이번 작업(`eia-inputdata-marker-guard`) 스코프에 포함해 함께 갱신 권장 |
| 2 | convention_compliance | R17 "적용 범위는 열거다" 목록에 `inputData` 를 추가하며 "종결됐다"고 적었으나, 같은 열거의 다른 5항목("실제로 코드가 하는 일")과 달리 이 항목은 "아직 코드가 하지 않는 일" — 열거 내부에 "이미 참"과 "아직 거짓"이 구분 없이 섞임(Critical #1 과 같은 근본 원인, 다른 각도) | `spec/5-system/14-external-interaction-api.md:1518-1525` | 문서 자신의 "열거는 실측 갱신" 선례(과거 "4곳→6곳" 교훈) | Critical #1 수정과 함께, 이 불릿에도 "(구현 대기 — `eia-inputdata-marker-guard` plan)" 상태 마커 부기 또는 구현 완료 후 병합 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "폼 프리필(`DynamicFormUI`) 마커 가드"가 §R17 표에만 등재되고 폼 노드/Presentation 공통 spec 에는 미러 서술 없음 | `spec/5-system/14-external-interaction-api.md:1569` vs `spec/4-nodes/6-presentation/{4-form,0-common}.md` | 필드 렌더링 절에 "defaultValue 가 마스킹 마커면 프리필하지 않고 재입력 안내" 한 줄 추가, 또는 §R17 표에 "presentation 공통 spec 미기재, §R17 이 유일 SoT" 명시 |
| 2 | rationale_continuity | `spec-sync-external-interaction-api-gaps.md` 의 `inputData` 카브아웃 항목(L281)이 target 의 "잔여② 해소" 서술을 반영하지 않아 stale (다만 developer plan 체크리스트가 "트래커 항목 종결"을 이미 계획해 실질 리스크 낮음) | `spec/5-system/14-external-interaction-api.md` frontmatter `pending_plans:` | 코드 구현 완료 시 tracker 항목에 취소선 + "해소(날짜)" 갱신 |
| 3 | plan_coherence | `spec-sync-external-interaction-api-gaps.md:6067` 체크박스가 여전히 `- [ ]` — 결함 아니라 "spec 먼저, 구현·트래커 정리는 같은 PR 후속 커밋"이라는 이 작업의 명시된 착지 순서에 부합하는 정상 상태 | 위와 동일 | 조치 불요 — 같은 PR 착지 시 함께 닫기 |
| 4 | plan_coherence | 번들 예산 절단으로 `spec-sync-websocket-protocol-gaps.md` 등 3개 관련 plan 본문이 생략됨(직접 재조회 결과 이번 세션엔 충돌 없음 확인, 구조적 갭은 잔존) | `_prompts/plan_coherence.md` | 조치 불요(이번 세션) — `feedback_consistency_spec_mode_budget` 계열 구조적 갭으로 별도 추적 |
| 5 | naming_collision | `editor-toolbar.tsx` 가 `14-external-interaction-api.md` `code:` 에만 등재되고 `13-replay-rerun.md` 에는 없어 "히스토리 로드 마커 가드" SoT 소유가 비대칭 | `spec/5-system/13-replay-rerun.md` frontmatter `code:`, §10.2 | 대칭을 위해 `13-replay-rerun.md` 에도 `editor-toolbar.tsx` 등재 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `3-execution.md` "inputData 데이터 흐름" 절이 target 의 WS 마스킹 전제와 정반대 서술(stale, 2026-04 이후 미갱신) |
| rationale_continuity | HIGH | 5개 문서가 `status: implemented` 유지한 채 미구현 마스킹/가드를 현재완료로 단정 — R-5 위반 |
| convention_compliance | CRITICAL | 동일 근본 문제를 6개 위치·`spec-impl-evidence.md` R-5 정면 위반으로 판정 + R17 열거 자기모순 WARNING |
| plan_coherence | NONE | spec-먼저-구현-나중 착지 순서 정상, 미러 7곳 전수 정합 확인 |
| naming_collision | NONE | 신규 식별자 충돌 없음, `editor-toolbar.tsx` 등재 비대칭만 INFO |

## 권장 조치사항
1. (BLOCK 해소 우선) **이번 세션에서 plan 의 남은 구현 체크리스트를 push 전에 완료**: (a) backend `toExecutionDto`/`toResponseExecution` 의 `Execution.inputData`/`NodeExecution.inputData` egress 값-패턴 마스킹 적용(`MASKED_INPUT_DATA_REASON` 카브아웃 제거), (b) `rerun-modal.tsx` 마커 감지 + 프리필 스킵 + 제출 차단, (c) `editor-toolbar.tsx` 히스토리 로드 마커 감지 + Run 비활성. 완료되면 5개 문서의 "이미 완료" 서술이 사실과 일치해 Critical #1 이 자연 해소된다.
2. 이번 세션에 (1) 을 끝내지 못하고 턴을 종료해야 한다면, planner 턴으로 4개 `status: implemented` 문서(`12-webhook.md`·`13-replay-rerun.md`·`4-nodes/1-logic/12-background.md`·`3-workflow-editor/3-execution.md`)를 `status: partial` + `pending_plans: [plan/in-progress/eia-inputdata-marker-guard.md]` 로 임시 하향하고, `14-external-interaction-api.md`/`6-websocket-protocol.md` 의 관련 서술에도 "(미구현·Planned)" 캐비엇을 붙인다.
3. `spec/3-workflow-editor/3-execution.md` §10.6.1 "inputData 데이터 흐름" 절을 WS `input` 필드 마스킹 현실에 맞춰 정정(WARNING #1) — 이번 작업 스코프에 포함 권장.
4. R17 "적용 표면 열거" 목록의 `inputData` 항목에 구현 대기 상태 마커 부기(WARNING #2, Critical #1 과 동시 해소).
5. 여유 시 INFO #1(폼 프리필 가드 미러), #5(`editor-toolbar.tsx` 등재 비대칭) 반영.