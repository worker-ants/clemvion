# Consistency Check 통합 보고서 (--impl-done, 최종 코드 `c82b4a03`)

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 구현 자체는 spec 과 직접 모순 없음. 발견된 항목은 모두 선행 단계(M-1 1·2단계)부터 누적된 spec 드리프트(문서 참조 포인터 stale, frontmatter 코드 목록 미갱신) 및 가독성 경고 1건. 런타임·API 계약·상태 전이에 영향 없음.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING) — 전부 비차단

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 | developer 판정 |
|---|---------|------|-------------|-----------|------|------|
| 1 | Cross-Spec | `meta.turnDebug[].toolCalls` shape — `1-ai-agent.md §7` 각주에 `startedAt?`/`finishedAt?` 미반영(WS spec 상충, 구현은 이미 WS spec 따름) | `1-ai-agent.md` line 530 | `6-websocket-protocol.md §4.4` | planner 가 shape 갱신 (spec 문서만 교정) | **planner 위임** — developer spec read-only. pre-existing(본 refactor 무관). |
| 2 | Cross-Spec | `classifyToolCalls` 구현 포인터가 `§6.1 3a` 에서 stale 위치(`ai-agent.handler.ts`) 지목 | `1-ai-agent.md` line 370 | `ai-turn-executor.ts`(`AiTurnExecutor.executeSingleTurn`/`executeMultiTurn`) | planner 가 괄호 주석 교정 | **planner 위임** — plan §M-1 후속 SPEC-DRIFT 일괄. |
| 3 | Naming Collision | `AiTurnExecutor` vs `AiTurnOrchestrator` — `AiTurn*` 접두어 공유로 레이어 혼동 가능성 (기능 충돌 아님, 의도적 명명) | `ai-turn-executor.ts:512` | `ai-turn-orchestrator.service.ts:73` | 각 파일 JSDoc 에 레이어·책임 구분 1줄. **차단 아님 · `ai-agent.handler.ts:187` 에 이미 `ai-turn-orchestrator` 참조 있어 최소 보완으로 충분** | **비차단 잔존** — executor JSDoc 이 이미 node-레이어 turn 실행 + handler facade 위임을 명시. 엔진 레이어 `AiTurnOrchestrator` 대비 1줄 보완은 planner spec-sync(rec #5, §6 서두 계층 주석)와 함께 처리 권장. |

## Developer 판정 (BLOCK:NO 비차단 근거)

본 작업은 **behavior-preserving refactor**(M-1 3단계 `AiTurnExecutor` 추출). 위 WARNING 3건 전부 비차단:
- **#1·#2**: spec 문서 포인터/shape drift — developer **spec read-only** 권한 밖, plan §M-1 "planner 후속(비차단 SPEC-DRIFT)" 일괄 위임 항목. 구현 변경 불필요(구현은 이미 정합).
- **#3**: 가독성 명명 — checker 가 명시적으로 "차단 아님 · 최소 보완으로 충분"(handler:187 기존 참조). 별도 spec-sync 시 §6 계층 주석과 함께 보완.
- Rationale-Continuity **NONE** — behavior-preserving 확인(§12.9~12.14 불변식·polymorphic 계약·co-location 준수). Convention-Compliance **NONE**(핵심 규약 전부 준수).

## 참고 (INFO)

| # | Checker | 항목 | 제안 |
|---|---------|------|------|
| 1 | Cross-Spec | `1-ai-agent.md` frontmatter `code:` 에 3개 신설 파일 미등재 | M-1 전체 완료 시 planner 일괄 추가 (plan 예약) |
| 2 | Cross-Spec | `execution-engine.md §1.3` 에 `AiTurnExecutor` 계층 미언급(직접 모순 아님) | planner 가 `1-ai-agent.md §6` 서두 계층 주석 추가 |
| 3 | Convention | `interaction-type-registry.md` frontmatter `code:` 에 `ai-turn-executor.ts` 미등재 | planner 경로 추가(낮은 우선순위) |
| 4 | Convention | `ToolCallTrace` JSDoc spec §7.1 교차 참조 없음 | 선택적 |
| 5 | Convention | `RawAiAgentMultiTurnConfig` JSDoc Principle 7 참조 없음 | 선택적 |
| 6 | Convention | `FORM_SUBMITTED_*` 이동 → spec §12.6 SoT 참조가 구 파일 지목 | planner 갱신(운영 영향 없음) |
| 7 | Plan | M-1 planner 후속 SPEC-DRIFT 목록에 `ai-turn-executor.ts` 추가 등록 | 02-architecture.md M-1 후속 메모에 명시 (**본 PR plan 갱신에 반영**) |
| 8 | Plan | `exec-park-durable-resume.md` 착수 시 §7.4~7.5 정합 검토 | 해당 plan 착수 전 |
| 9 | Naming | `RagDiagnostics` backend 비공개 재정의 vs frontend export 형상 차이(선행 drift, 범위 밖) | 별도 추적 |
| 10 | Naming | `ToolCallTrace` handler re-export 없이 이동(현재 외부 소비자 0건, 파손 없음) | 향후 소비 시 처리 |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | LOW | §7 각주 shape·§6.1 3a 포인터 stale (선행 드리프트, 구현은 정합) |
| Rationale Continuity | NONE | behavior-preserving 확인 — 기각 대안 재도입·번복 없음 |
| Convention Compliance | NONE | 핵심 규약 준수. 발견 전부 INFO(이동 후 참조 추적) |
| Plan Coherence | LOW | 실질 충돌 없음. M-1 후속 목록에 `ai-turn-executor.ts` 추가(본 PR 반영) |
| Naming Collision | LOW | `AiTurnExecutor`/`AiTurnOrchestrator` 가독성 WARNING 1(비차단), 나머지 INFO |

## 권장 조치사항

1. **(BLOCK 없음)** M-1 3단계 PR 진행 가능.
2~3. **(WARNING #1·#2 — planner)** `1-ai-agent.md` §7 각주 shape + §6.1 3a 포인터 교정.
4. **(WARNING #3 — 비차단)** executor JSDoc 레이어 구분 1줄 보완(planner §6 계층 주석과 함께).
5. **(INFO 일괄 — M-1 전체 완료 후 planner)** frontmatter `code:` 3파일 + `interaction-type-registry.md` 경로 갱신. **plan §M-1 후속 메모에 `ai-turn-executor.ts` 추가 (본 PR plan 갱신에 반영).**
