# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 차단 불필요

## 전체 위험도
**LOW** — 모든 발견 사항이 INFO 수준이며, 기능/계약 모순 없음. spec Rationale 텍스트 포인터 drift 및 문서 번호 역전 등 비차단 후속 정비 항목만 존재

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

_없음_

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | `SCHEMA_LOOKUP_HARD_STOP` 상수 소유 파일 이전 — spec Rationale 유지보수 체크리스트의 구 줄 번호(`L137–142`, `L459–462`) stale | `spec/3-workflow-editor/4-ai-assistant.md` Rationale "schemaCache 정책" | "서비스 L137–142 주석 + L459–462 inline 주석" 참조를 `assistant-tool-router.service.ts` 기준으로 교체 (project-planner 소관, 비차단) |
| 2 | Naming Collision | `SchemaCacheEntry` 인터페이스 소유권 이전 — spec Rationale의 `"workflow-assistant-stream.service.ts 의 턴 스코프"` 포인터가 실제 정의 위치(`assistant-tool-router.service.ts`)와 불일치 | `spec/3-workflow-editor/4-ai-assistant.md` Rationale §schemaCache 정책 L928 | spec Rationale의 해당 참조를 `assistant-tool-router.service.ts` 로 갱신 (INFO #1과 동일 수정 대상, 중복 통합) |
| 3 | Rationale Continuity | M-3 2·3단계에서 SSE 발행이 루프 바깥으로 이동하지 않도록 하는 §4.4 WebsocketService 단일 sink 정책이 plan 에 암묵적으로만 존재 | `plan/in-progress/refactor/02-architecture.md` §M-3 | M-3 항목에 "Guard/Persistence 협력 객체에서 직접 SSE 발행 금지 — SSE 조립은 streamMessage 루프에 잔류 (§4.4 단일 sink)" 문구 명시 |
| 4 | Convention Compliance | `3-execution.md` 섹션 번호 역전 (3.4 → 3.6 → 3.5 순서) | `spec/3-workflow-editor/3-execution.md` | §3.6 AI Agent Multi Turn 을 §3.5 로, 기존 §3.5 실행 실패를 §3.6 으로 재번호 |
| 5 | Cross-Spec | `4-ai-assistant.md` frontmatter `code:` 에 신규 파일 `assistant-tool-router.service.ts` 미등재 — glob 커버리지는 있으나 spec-coverage audit 오독 가능성 | `spec/3-workflow-editor/4-ai-assistant.md` frontmatter `code:` | project-planner 를 거쳐 명시적 경로 추가 또는 기존 glob(`**/*.ts`)으로 커버되므로 현행 유지 선택 가능 |
| 6 | Convention Compliance | `4-ai-assistant.md` frontmatter glob 중복 선언 (`*.ts` + `*.tsx` 별개 엔트리) | `spec/3-workflow-editor/4-ai-assistant.md` frontmatter `code:` | `*.{ts,tsx}` 한 줄로 통합 가능 (가드 통과 기준 문제 없음) |
| 7 | Rationale Continuity | `TOOL_KIND_BY_NAME` 의 `verify_workflow` 항목 주석에 spec 절 번호 참조 없음 | `codebase/backend/src/modules/workflow-assistant/tools/tool-definitions.ts` | `verify_workflow` 주석에 "spec §4.1 / §10 Phase 3" 참조 추가 |
| 8 | Naming Collision | `UNKNOWN_EXPLORE_TOOL` 에러 코드 spec 미등재 (내부 방어 경로 전용) | `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` | 내부 방어 코드이므로 현행 유지 가능. spec 에러 코드 목록 추가 여부는 planner 재량 |

> **중복 통합**: INFO #1(Rationale Continuity)과 #2(Naming Collision)는 동일 대상(`spec/3-workflow-editor/4-ai-assistant.md` Rationale schemaCache 정책)의 동일 수정을 가리킨다. 한 번의 spec 편집으로 해소.

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 모든 spec 계약(SSE data.kind discriminator, TOOL_KIND_BY_NAME, RBAC, 도구 목록) 보존 확인. 충돌 없음 |
| Rationale Continuity | LOW | schemaCache 정책 줄 번호 stale, M-3 후속 단계 §4.4 sink 정책 문서 사각, TOOL_KIND_BY_NAME spec 절 참조 누락. 모두 INFO |
| Convention Compliance | LOW | 3-execution.md 섹션 번호 역전(3.4→3.6→3.5), 4-ai-assistant.md glob 중복 선언. 모두 INFO |
| Plan Coherence | NONE | spec/3-workflow-editor 파일 변경 없음. pending_plans와 M-3 간 교차 없음. 2단계 착수 가능 상태 확인 |
| Naming Collision | LOW | 신규 식별자 전체(AssistantToolRouter, SchemaCacheEntry, ExploreDispatchContext, ExploreDispatchResult, asString, 에러 코드 2종) 충돌 없음. spec Rationale 텍스트 포인터 drift만 후속 정비 필요 |

## 권장 조치사항

1. **(비차단, 후속 정비 우선)** `spec/3-workflow-editor/4-ai-assistant.md` Rationale "schemaCache 정책" 단락에서 구 파일명·줄 번호 참조(`workflow-assistant-stream.service.ts L137–142, L459–462`)를 `assistant-tool-router.service.ts` 기준으로 갱신 — INFO #1/#2 동시 해소 (project-planner 소관)
2. **(비차단, 후속 정비)** `plan/in-progress/refactor/02-architecture.md` §M-3 에 §4.4 WebsocketService 단일 sink 불변 조건 명시 — 2·3단계 구현자에게 invariant 전달 (INFO #3)
3. **(비차단, 정리)** `spec/3-workflow-editor/3-execution.md` §3.6 ↔ §3.5 섹션 번호 순서 정정 (INFO #4)
4. **(선택)** `4-ai-assistant.md` frontmatter glob 중복 통합 및 `tool-definitions.ts` `verify_workflow` 주석에 spec 절 참조 추가 — 가독성·추적성 향상 (INFO #6/#7)