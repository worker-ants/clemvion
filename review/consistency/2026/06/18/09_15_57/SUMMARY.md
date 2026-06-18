# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**CRITICAL** — plan frontmatter 의 필수 필드 `started:` 누락으로 build guard 위반 (convention_compliance). 나머지 checker 는 모두 NONE~LOW.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `plan/in-progress/spec-update-engine-split.md` frontmatter 에 `started:` 필드 누락 — `created: 2026-06-18` 로 대체돼 있음. `plan-frontmatter.test.ts` build guard 직접 위반 | `plan/in-progress/spec-update-engine-split.md` L1–L7 frontmatter | `.claude/docs/plan-lifecycle.md §4` (worktree·started·owner 세 필드 필수) | frontmatter 에 `started: 2026-06-18` 추가 (`created:` 유지 허용이나 `started:` 필수) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `worktree:` 값이 full path(`.claude/worktrees/engine-split`)로 기재 — 스키마 권장 형식(디렉토리 이름만)과 불일치 | `plan/in-progress/spec-update-engine-split.md` frontmatter | `.claude/docs/plan-lifecycle.md §4` (`worktree: engine-split` 단축 형식이 표준) | `worktree: engine-split` 으로 수정. build 차단은 없으나 plan-stale-audit.sh 등 운용 도구 오매칭 위험 |
| 2 | cross_spec | `spec/data-flow/15-external-interaction.md` L108 의 `ExecutionEngineService.continueAiConversation` dispatch 매핑이 draft 변경 범위에서 누락 — 다른 spec 파일들은 C-1 분할 후 `AiTurnOrchestrator` 위임 경로를 이미 기술 | `spec/data-flow/15-external-interaction.md` L108 | `spec/5-system/4-execution-engine.md`, `spec/conventions/interaction-type-registry.md` 등 (C-1 위임 경로 기술 완료) | `spec/data-flow/15-external-interaction.md` L108 `submit_message` 행 비고에 "엔진 facade → `AiTurnOrchestrator.processAiResumeTurn` 위임 (C-1 분할)" 추가. draft 변경 범위에 본 파일 포함 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | draft 가 "신설/갱신"으로 기술한 변경 항목 6개 중 5개가 이미 현재 spec 에 반영 완료 — 중복 적용 시 중복 서술 위험 | `plan/in-progress/spec-update-engine-split.md` §변경 목록 전체 | 실물 diff 기반으로 진정 잔여 항목만 선별 적용 |
| 2 | cross_spec | `spec/data-flow/3-execution.md` actor 갱신 제안이 현재 spec 의 "actor 는 `Eng` 로 유지한다" 명시 의도와 방향이 다를 수 있음 | `spec/data-flow/3-execution.md` L172 | draft 적용 시 L172 prose 노트와 정합성 확인. actor 분리를 선택하면 "actor 는 Eng 로 유지한다" 주석 동시 삭제/조정 필요 |
| 3 | cross_spec | draft §Rationale 신설 항과 현재 spec Rationale 내용 간 미세한 라인 카운트 차이 (기능 의미 충돌 없음) | `spec/5-system/4-execution-engine.md` L1456–L1467 | draft 적용 시 숫자를 현재 spec 실측 값으로 통일 |
| 4 | rationale_continuity | 모든 Rationale 연속성 항목 정합 확인 — EngineDriver in-process 전제, WorkflowExecutor 재사용 기각, ExecutionEventEmitter 직접 주입 유지, previousOutput Phase 3 예외, button_continue optional 필드 모두 기존 결정과 완전 일치 | `spec/5-system/4-execution-engine.md`, `spec/conventions/node-output.md` | 추가 조치 불요 |
| 5 | plan_coherence | 선행 조건(4 PR impl-done BLOCK:NO) 충족 확인. 미해결 결정(C-2, G1/G2, ai-agent-tool TBD)과 충돌 없음. c1-engine-split.md §spec 갱신 phase 위임 항목 전부 반영 확인 | `plan/in-progress/spec-update-engine-split.md`, `plan/in-progress/refactor/c1-engine-split.md` | 추가 조치 불요 |
| 6 | naming_collision | 신규 식별자(서비스명·토큰명·메서드 소속 포인터·frontmatter 경로) 의미 충돌 없음. 대부분 항목이 이미 spec 에 반영돼 있어 no-op 처리 권장 | `spec/5-system/4-execution-engine.md`, `spec/4-nodes/**`, `spec/conventions/**` | planner 실물 diff 확인 후 진정 신규 항목만 반영 |
| 7 | convention_compliance | `parent:` 비표준 frontmatter 필드 사용 — build guard 검증 대상 아님, 기능 문제 없음 | `plan/in-progress/spec-update-engine-split.md` frontmatter | 현재대로 유지 가능 |
| 8 | convention_compliance | `spec/conventions/interaction-type-registry.md` frontmatter `code:` 갱신 지시 항목이 이미 반영 완료 상태 | `spec/conventions/interaction-type-registry.md` L7–L8 | plan 실행 시 no-op 확인 후 체크 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | draft 변경 항목 대부분 이미 반영 완료; `15-external-interaction.md` L108 포인터만 변경 범위 누락 (WARNING) |
| rationale_continuity | NONE | 모든 Rationale 항목이 기존 결정과 완전 정합 |
| convention_compliance | CRITICAL | `started:` 필수 필드 누락으로 plan-frontmatter build guard 직접 위반; worktree full-path 형식 WARNING |
| plan_coherence | NONE | 선행 조건 충족, 미해결 결정 충돌 없음, 위임 항목 전부 반영 |
| naming_collision | NONE | 신규 식별자 의미 충돌 없음, 대부분 이미 spec 반영 완료 |

## 권장 조치사항

1. **(BLOCK 해소 — 필수)** `plan/in-progress/spec-update-engine-split.md` frontmatter 에 `started: 2026-06-18` 추가. `created:` 키는 제거하거나 병기 가능하나 `started:` 는 반드시 존재해야 plan-frontmatter.test.ts 가 통과함.
2. **(WARNING 해소 — 권장)** 동일 파일 frontmatter 의 `worktree:` 값을 `.claude/worktrees/engine-split` → `engine-split` 으로 단축.
3. **(WARNING 해소 — 권장)** `spec/data-flow/15-external-interaction.md` L108 `submit_message` 행 비고에 "엔진 facade → `AiTurnOrchestrator.processAiResumeTurn` 위임 (C-1 분할)" 추가 또는 포인터 직접 갱신. draft 변경 범위에 해당 파일 포함.
4. **(INFO — 선택)** spec 실물 diff 기반으로 이미 반영된 항목을 no-op 으로 분류한 뒤, 진정 잔여 항목(있다면 `data-flow/3-execution.md` actor 라인)만 선별 적용해 중복 서술 방지.

---

## 처분 (planner, 2026-06-18)

- **Critical #1 (started 누락)** → 해소: `plan/in-progress/spec-update-engine-split.md` frontmatter 에 `started: 2026-06-18` 추가. (#627 이 도입한 latent build-guard 위반 — 본 PR 이 동반 수정.)
- **Warning #1 (worktree full-path)** → 해소: `worktree: engine-split` 단축.
- **Warning #2 (15-external-interaction L108)** → 해소(정정): `continueAiConversation` 은 **엔진 잔류**(이동 아님, bus publish 진입점 — execution-engine.service.ts:3916, "PR2 가 엔진에 남김")로 L108 표 자체는 정확. 표 뒤에 "C-1 분할 후 위임 경로" 노트 추가 — 진입점은 엔진 잔류, 다운스트림 turn 처리(`processAiResumeTurn`)만 `AiTurnOrchestrator` 위임임을 명시.
- **INFO #1/#6/#8 (이미 반영됨)** → apply-first-then-check 아티팩트: checker 가 working-tree 의 적용 완료분을 읽어 "이미 반영" 으로 보고. no-op 확인.
- **INFO #2 (data-flow actor)** → actor 는 `Eng` 유지 선택 + 설명 노트 추가로 정합 (L172 노트와 일치).
- **INFO #3 (라인 카운트)** → 실측 7,035 사용 (draft 의 7,033 대신).
- 재검토(re-run) 로 `BLOCK: NO` 확인 후 spec 확정 + plan 완료이동.
