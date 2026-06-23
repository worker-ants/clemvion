# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — spec 내부 `shouldSkipReview` 조건 목록 불일치(동일 문서 내 두 절 간 모순) 및 `MIN_EDITS_FOR_VERIFY` drift 가 WARNING 수준으로 존재하나, 구현 동작은 올바르며 차단 사유 없음

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec / Rationale Continuity / Convention Compliance (통합) | `shouldSkipReview` skip 조건 목록에 `state.finishBlockCount > 0` 이 여전히 기재됨 — 같은 문서 내 §10 §5 "Review guard 항상 발동"(line 1072–1088)에서 해당 조건을 제거했음을 선언하고 구현도 이를 따르나, line 958 목록이 구식 상태로 잔류 | `spec/3-workflow-editor/4-ai-assistant.md` line 958 | 동일 파일 line 1072–1088 및 구현 `AssistantFinishGuard.shouldSkipReview` | line 958의 `state.finishBlockCount > 0 …` 항목 삭제 또는 취소선 처리. line 1084–1088 "남은 skip 조건" 목록을 authoritative list 로 명시 |
| W-2 | Convention Compliance | spec이 `MIN_EDITS_FOR_VERIFY` 를 `WORKFLOW_VERIFY_REQUIRED` 발동 조건으로 기술하나, 구현(`assistant-finish-guard.service.ts`)에는 해당 상수가 존재하지 않고 non-trigger 노드 수(`MIN_NONTRIGGER_NODES_FOR_VERIFY`) 만으로 판정 — 구현 주석이 edit 수 기준을 의도적으로 배제함을 명시 | `spec/3-workflow-editor/4-ai-assistant.md` line 680, 945 | 구현 `assistant-finish-guard.service.ts` line 419–426 | spec line 680·945에서 "`MIN_EDITS_FOR_VERIFY` 이상이고" 조건을 제거하고 "non-trigger 노드 수 ≥ `MIN_NONTRIGGER_NODES_FOR_VERIFY`(=3)" 만을 기술 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `AssistantFinishGuard` 클래스 분리가 spec §10 평가 흐름 서술에 미기재 | `spec/3-workflow-editor/4-ai-assistant.md` §10 Part B | 필수 아님. spec Rationale에 "M-3 2단계: 가드 로직이 `AssistantFinishGuard` collaborator 로 추출됨" 한 줄 추가 권장(project-planner 위임) |
| I-2 | Cross-Spec | `isPlanPendingApproval` 이 `workflow-assistant-stream.service.ts` 에서 `active-plan-context.ts` 로 이동 — 동작 변경 없으나 spec §10 §6 설명이 이전 위치를 암시 | `spec/3-workflow-editor/4-ai-assistant.md` Rationale §6 | 동작 변경 없음. spec 수정 불필요 |
| I-3 | Rationale Continuity | M-3 2단계(`AssistantFinishGuard` 추출) 결정의 spec Rationale 갱신 부재 — plan 문서(02-architecture.md M-3 옵션 A 채택)에는 기록됨 | `spec/3-workflow-editor/4-ai-assistant.md` Rationale 전체 | spec Rationale Part B 에 M-3 2단계 결정 단락 간략 추가 권장(project-planner 위임) |
| I-4 | Rationale Continuity | `collect-pending-user-config.ts` 분리 결정이 spec follow-up 목록에 미기재 | `spec/3-workflow-editor/4-ai-assistant.md` Rationale follow-up | spec follow-up에 완료 표기 추가 권장(project-planner 위임) |
| I-5 | Convention Compliance | `code:` frontmatter 글로브(`workflow-assistant/**/*.ts`)가 신규 파일을 이미 커버하므로 가드 통과. 신규 핵심 파일을 명시적 별도 항목으로 추가하면 coverage audit 정확도 향상 | `spec/3-workflow-editor/4-ai-assistant.md` frontmatter | 필수 아님. 명시적 항목 추가 또는 글로브 수준 유지 결정을 Rationale에 한 줄 기재 |
| I-6 | Plan Coherence | M-3 3단계(`AssistantTurnPersistenceService`) 미착수 — 정상 후속 항목 | `plan/in-progress/refactor/02-architecture.md` §M-3 3단계 | 현재 구현과 충돌 없음. 별도 PR 대상으로 추적 유지 |
| I-7 | Plan Coherence | `ai-agent-tool-connection-rewrite.md` 가 동일 spec 파일을 참조하나 전면 미착수(도구 연결 모델 TBD)이며 직교 사안 | `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 | 충돌 없음. 향후 진행 시 AssistantFinishGuard 분해가 spec에 미반영임을 인지 |
| I-8 | Naming Collision | `collectPendingUserConfig` — `review-workflow.ts` 인터페이스 필드명과 동일 이름이나 의도적 연결(함수가 필드에 주입)이므로 충돌 아님 | `codebase/backend/src/modules/workflow-assistant/tools/collect-pending-user-config.ts` | 이상 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec 내부 `shouldSkipReview` 목록 구식(W-1). 다른 spec 영역과의 교차 충돌 없음 |
| Rationale Continuity | LOW | `finishBlockCount > 0` 이중 기재(W-1과 동일 이슈). M-3 추출 결정 Rationale 미기재(INFO) |
| Convention Compliance | LOW | W-1(skip 조건 불일치) + W-2(`MIN_EDITS_FOR_VERIFY` drift). 빌드 가드·frontmatter 의무 모두 통과 |
| Plan Coherence | NONE | Critical/Warning 없음. M-3 2단계 plan 정확 완료 기록. 진행 중 타 plan과 충돌 없음 |
| Naming Collision | NONE | 신규 식별자 모두 충돌 없음. 중복 선언 완전 제거 확인 |

## 권장 조치사항

1. **(WARNING 해소 — spec 수정, project-planner 위임)** `spec/3-workflow-editor/4-ai-assistant.md` line 958의 `state.finishBlockCount > 0 …` 항목을 삭제하고, line 1084–1088 "남은 skip 조건" 목록을 canonical authoritative list 로 명시 (W-1).
2. **(WARNING 해소 — spec 수정, project-planner 위임)** `spec/3-workflow-editor/4-ai-assistant.md` line 680·945에서 `MIN_EDITS_FOR_VERIFY` 조건 제거, `MIN_NONTRIGGER_NODES_FOR_VERIFY`(=3) 단일 조건으로 정정 (W-2).
3. **(INFO 권장)** spec Rationale에 M-3 2단계(`AssistantFinishGuard` 추출·옵션 B 기각 근거) 단락 간략 추가 — project-planner 위임 (I-3).
4. **(INFO 권장)** spec follow-up 목록에 `collectPendingUserConfig` 독립 함수 분리 완료 표기 추가 — project-planner 위임 (I-4).