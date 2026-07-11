# Plan 정합성 검토 — eia-command-waiting-surface-guard.md

검토 모드: --impl-done, scope=`spec/5-system/14-external-interaction-api.md`, diff-base=52f46f95f

## 발견사항

- **[WARNING]** F-1(nodeId 불일치 검사 미구현 gap)이 spec-sync 애그리게이터에 미러링 안 됨
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.1 `STATE_MISMATCH` 행 ("또는 다른 nodeId") — PR #228 이래 존재하는 기존 약속, 본 PR 이 새로 만든 drift 아님
  - 관련 plan:
    - `plan/in-progress/eia-command-waiting-surface-guard.md` §"후속 항목" F-1 (`assertNodeId` 실제 대기 nodeId 일치 검사 미구현, "지금 고칠 수 없다" — `hooks.service.ts` 의 `nodeId:'chat-channel'` placeholder 선행 교체 필요)
    - `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 바로 이 spec 파일(`14-external-interaction-api.md`)의 "spec 약속 대비 미구현 surface" 를 모으는 planner 소유 애그리게이터. 현재 목록에 F-1 이 없고, 말미 비고("핵심 surface … REST 명령 … 는 구현 완료")가 F-1 을 반영하면 더 이상 정확하지 않다.
  - 상세: F-1 은 EIA §5.1/`4-execution-engine.md §7.5.1` 이 이미 약속한 "nodeId 미일치 → STATE_MISMATCH" 를 코드가 아직 이행하지 않는 실제 spec-vs-code 갭이다(`resolveWaitingNodeExecutionId` 는 `execution_id + status` 만 보고 `nodeId` 는 비교하지 않음). 같은 애그리게이터 문서의 다른 두 항목(§"getStatus 일반 nodeOutput 키-allowlist", "host resetSession booting 중복 webhook 가드")은 정확히 동일한 성격의 갭이 **2026-07-10 plan-coherence 검토(W3)를 통해 이미 이 문서에 등재된 선례**가 있다. F-1 은 그 선례를 따르지 않고 `eia-command-waiting-surface-guard.md` 내부에만 남아 있어, 이 plan 이 향후 참조 없이 다뤄지거나(예: 별도 spec-coverage audit 이 F-1 을 재발견해 중복 항목을 만들 위험) 유실될 가능성이 있다. 단, 두 문서 모두 `plan/in-progress/` 안에 있고 lifecycle 규칙상 미해결 follow-up 이 있는 한 두 plan 모두 complete 로 이동할 수 없으므로 즉각적인 정보 유실 위험은 낮다 — discoverability 문제에 가깝다.
  - 제안: `spec-sync-external-interaction-api-gaps.md` "미구현 항목" 에 F-1 을 한 줄 추가(F-1 원본 링크 + 선행조건 요약)하거나, 최소한 말미 비고의 "REST 명령 … 구현 완료" 문구에 F-1 예외를 각주로 명시. planner 가 S-1 spec 동기 작업을 처리할 때 동시에 반영하면 충분(급하지 않음).

## 검토한 정합성 항목 (이상 없음)

- **체크리스트 ↔ 구현 상태**: `eia-command-waiting-surface-guard.md` 의 체크된 8개 항목(재현/impl-prep/테스트/구현/e2e/TEST WORKFLOW/ai-review) 모두 diff·`review/consistency/2026/07/10/23_19_34/`·`review/code/2026/07/11/00_03_25/`(RESOLUTION.md) 실물과 일치. 남은 2개(`--impl-done`, spec 동기)는 본 검토가 다루는 바로 그 단계라 미체크가 정확하다.
- **ai-review Warning 12건의 후속 매핑**: RESOLUTION.md 의 #7→F-3, #8→S-1, #9→F-2(범위를 buttons 까지 확장) 매핑이 plan 본문의 F-1/F-2/F-3/S-1 서술과 정확히 대응 — 이관 누락 없음.
- **미해결 결정과의 충돌**: target 문서(`14-external-interaction-api.md`)는 이번 diff 에서 전혀 수정되지 않았다(코드만 변경, spec 동기는 S-1 로 명시적으로 project-planner 에 위임된 상태) — plan 이 "결정 필요"로 남긴 항목을 코드가 일방적으로 확정한 사례 없음. 결정 테이블(표면→허용 명령)도 EIA-IN-13/§5.1 STATE_MISMATCH 행의 기존 계약 범위 안이며 신규 요구사항 ID·에러코드를 도입하지 않는다는 plan 의 선언과 코드가 일치.
- **선행 plan 미해소**: 이 PR 이 가정하는 사전조건(자매 게이트 `dispatchResumeTurn` fail-closed, `resumeTurnRegistry`/`parkEntryRegistry` 존재)은 이미 main 에 구현돼 있고 별도 in-progress plan 이 그 전제를 흔들고 있지 않음.
- **다른 in-progress plan 과의 코드 중복/충돌**: `execution-engine.service.ts`/`hooks.service.ts`/`waiting-surface-guard.ts`/`interaction.service.ts` 를 언급하는 다른 in-progress plan(`manual-trigger-default-param.md`, `resume-llm-usage-attribution.md` 등)을 확인했으나 모두 이미 완료 표기된 과거 작업의 라인 참조일 뿐, 이번 diff 의 함수(`resolveWaitingNodeExecutionId`/`assertCommandMatchesWaitingSurface`/`forwardToInteractionService`)와 겹치는 활성 작업 없음.
- **S-1 spec 동기 대상 섹션 선점 여부**: S-1 이 나열한 5개 spec 파일·섹션(`4-execution-engine.md §7.5.1`, `14-external-interaction-api.md §5.1/§6.2`, `4-nodes/6-presentation/0-common.md §10.9`, `3-workflow-editor/3-execution.md §9`, `conventions/interaction-type-registry.md`)을 동시에 편집 중인 다른 in-progress plan 없음(grep 전수 확인).
- **error-codes-catalog-sot.md**: 신규 에러 코드가 없다는 plan 의 선언과 일치 — 해당 카탈로그 plan 에 STATE_MISMATCH/INVALID_EXECUTION_STATE 관련 미해결 항목 없음, 충돌 없음.

## 요약

`eia-command-waiting-surface-guard.md` 의 체크리스트는 diff·리뷰 산출물과 정확히 정합하고, 남은 두 미체크 항목(`--impl-done`, spec 동기)은 이 검토가 다루는 단계 자체라 문제 없다. ai-review 의 잔여 Warning 4건이 F-1/F-2/F-3/S-1 로 정확히 이관됐고, target 문서(`14-external-interaction-api.md`)는 이번 PR 에서 미해결 결정을 우회하지 않았다(코드만 변경, spec 편집은 S-1 로 명시적 위임). 유일한 소음은 F-1(nodeId 불일치 검사 미구현, PR #228 부터 존재하던 spec 약속과의 오래된 gap)이 같은 spec 파일을 추적하는 애그리게이터 `spec-sync-external-interaction-api-gaps.md` 에 아직 미러링되지 않았다는 discoverability 성격의 WARNING 뿐이며, 두 plan 모두 in-progress 에 남아 있어 유실 위험은 낮다.

## 위험도

LOW
