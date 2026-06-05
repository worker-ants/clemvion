# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — Cross-Spec 1건 Critical (에러 코드 이중 정의 split-brain), Rationale Continuity 1건 Critical (미확인 큐를 구현 완료로 spec 등재하여 "두 큐 전용" invariant 번복). 나머지 checker 는 WARNING/INFO 수준.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C-1 | Cross-Spec | `EXECUTION_TIME_LIMIT_EXCEEDED` 를 EIA §6.4 에만 추가하고 에러 코드 SoT(`spec/5-system/3-error-handling.md §1.4`) 를 갱신하지 않으면 `EXECUTION_TIMEOUT`(엔진 타임아웃으로 등재)과 동시에 공존하여 split-brain 발생 | `plan/in-progress/spec-update-pr2a-timeout.md` §제안 변경 1·3 | `spec/5-system/3-error-handling.md §1.4` (EXECUTION_TIMEOUT 엔진 수준 등재), `spec/conventions/chat-channel-adapter.md` line 387 (EXECUTION_TIMEOUT(engine) 분류 행) | `3-error-handling.md §1.4` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 신규 행 추가 + `EXECUTION_TIMEOUT` 설명을 "Code 노드 스크립트 타임아웃(노드 수준)" 으로 축소. `chat-channel-adapter.md` 분류표에 `EXECUTION_TIME_LIMIT_EXCEEDED` 행 추가(또는 `EXECUTION_TIMEOUT(engine)` 행 통합 갱신). 이 두 갱신을 draft 변경 범위에 포함시켜야 차단 해소. |
| C-2 | Rationale Continuity | `execution-run` intake 큐를 codebase/spec 미확인 상태로 "구현 완료" 로 카탈로그에 등재 — `spec/5-system/4-execution-engine.md §9.3` 및 Rationale 이 "두 큐 전용(`background-execution` + `execution-continuation`)" 을 확정 invariant 로 명시하고 있으며, codebase 검색 결과 0건 | `plan/in-progress/spec-update-pr2a-timeout.md` §제안 변경 2 | `spec/5-system/4-execution-engine.md §9.3` 각주("두 큐뿐") + Rationale "Phase 2 cont 후속 정리" 항목 1, `spec/0-overview.md §Rationale "실행 엔진"` | `execution-run` 큐가 실제 코드에 구현·머지됐는지 먼저 확인. 확인되면 `§9.3` "두 큐 전용" 각주 및 Rationale 을 함께 갱신하는 작업을 draft 변경 범위에 추가. 구현 미확인 시 §제안 변경 2(큐 카탈로그 추가) 적용 보류. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `spec/0-overview.md §2.6` Redis 큐 목록(`execution-continuation`, `background-execution` 만 열거)이 draft 범위에 포함되지 않아 세 번째 누락처 잔존 | `spec-update-pr2a-timeout.md` §제안 변경 2 | `spec/0-overview.md §2.6` line 243 | draft 적용 시 `spec/0-overview.md §2.6` Redis 큐 목록에 `execution-run` (intake) 도 추가하거나 "실행 태스크" 설명을 큐 이름으로 명시화 |
| W-2 | Cross-Spec | §4 BullMQ 큐 카탈로그 표에서 `execution-run` 삽입 위치를 "첫 행"으로만 명시 — 적용자가 위치를 확정하기 어려움 | `spec-update-pr2a-timeout.md` §제안 변경 2 After | `spec/data-flow/0-overview.md §4` | "첫 행" 대신 "`background-execution` 행 바로 앞(intake → 재개 순서)" 으로 위치 명확화 |
| W-3 | Rationale Continuity | §8 "설정 위치" 를 `Workflow.settings` → env 상수로 변경하고 1단계/2단계를 분리한 결정의 Rationale 이 변경 대상 spec 어디에도 기록되지 않음 | `spec-update-pr2a-timeout.md` §제안 변경 1 | `spec/5-system/4-execution-engine.md §Rationale` | `§Rationale` 에 "§8 타임아웃 — 1단계 env 상수/2단계 per-workflow 분리 이유" 항목 추가 |
| W-4 | Rationale Continuity | `EXECUTION_TIMEOUT` → `EXECUTION_TIME_LIMIT_EXCEEDED` 코드명 변경 근거가 plan 본문에만 있고 변경 대상 spec 문서 Rationale 에 기록되지 않음 | `spec-update-pr2a-timeout.md` §제안 변경 1·3 | `spec/5-system/4-execution-engine.md §Rationale`, `spec/5-system/3-error-handling.md` | §Rationale 에 "EXECUTION_TIME_LIMIT_EXCEEDED vs EXECUTION_TIMEOUT 코드 분리" 소절 추가; W-3 항목과 병합 가능 |
| W-5 | Convention Compliance | plan 파일명 prefix 가 SKILL.md 권장 `spec-draft-` 와 다름 (`spec-update-` 사용) | `plan/in-progress/spec-update-pr2a-timeout.md` 파일명 | `.claude/skills/project-planner/SKILL.md §작업 워크플로` step 3 | 파일을 `spec-draft-exec-timeout-pr2a.md` 로 rename 하거나, 동 worktree 선례(`spec-update-execution-context-options-bag.md`) 기준으로 SKILL.md 에 `spec-update-` 허용 예외를 명시 |
| W-6 | Convention Compliance | plan draft 에 `## Rationale` 섹션 없음 | `plan/in-progress/spec-update-pr2a-timeout.md` 전체 구조 | `.claude/skills/project-planner/SKILL.md §작업 워크플로` step 3 | 문서 끝에 `## Rationale` 섹션 추가 (PR2a SPEC-DRIFT 확인 근거, 2단계 분리 이유 등). 또는 SKILL.md 에 SPEC-DRIFT 분류 plan 은 분류 항으로 대체 가능 예외 명시 |
| W-7 | Naming Collision | `EXECUTION_TIME_LIMIT_EXCEEDED` 도입 후 EIA §6.4 에 `EXECUTION_TIMEOUT` 이 제거되지 않아 두 코드가 병기 — "엔진 레벨 실행 시간 초과" 코드가 무엇인지 혼동 잔존 | `spec/5-system/14-external-interaction-api.md §6.4` | `spec/5-system/3-error-handling.md §1.4` (분리 정의) | EIA §6.4 의 `EXECUTION_TIMEOUT` 주석에 `(Code 노드 스크립트 타임아웃)`, `EXECUTION_TIME_LIMIT_EXCEEDED` 에 `(엔진 레벨 누적 active-running 타임아웃)` 구분 표기. `chat-channel-adapter.md §3.1` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 행 추가 검토 |
| W-8 | Plan Coherence | `spec-sync-execution-engine-gaps.md §8` 미구현 항목이 PR2a 부분 해소 후에도 갱신되지 않으면 사실과 어긋난 채 잔존 | `plan/in-progress/spec-sync-execution-engine-gaps.md §8` | PR2a(`impl-exec-concurrency-cap`) active-running 타임아웃 구현 완료 | target 적용 시 §8 항목을 "(1단계) active-running 타임아웃 — PR2a 완료" / "(2단계) 워크스페이스 cap·큐 대기 cancel — Planned" 로 분리 갱신 |
| W-9 | Plan Coherence | `spec/data-flow/0-overview.md` 의 현행 main 상태(stale worktree 변경 미반영 가능성)를 재확인하지 않으면 After 텍스트가 실제 파일과 불일치할 수 있음 | `spec-update-pr2a-timeout.md` §제안 변경 2 After | `spec/data-flow/0-overview.md` line 93 (main 현재 상태) | 적용 전 해당 파일 line 93 및 §4 표의 실제 상태를 확인하여 After 텍스트를 현행 main 기준으로 조정 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `spec/5-system/4-execution-engine.md §9.3` BullMQ 큐 목록에 `execution-run` 누락 — draft 가 `data-flow/0-overview.md §4` 만 커버 | `spec/5-system/4-execution-engine.md §9.3` | draft 적용 시 §9.3 에도 `execution-run` 행 추가(`execution-continuation` 행 위, intake 큐로) |
| I-2 | Cross-Spec | draft §8 Before/After 텍스트가 현행 spec 의 `aspirational` 표현과 미묘하게 다름 — 적용자가 실제 라인 확인 필요 | `spec/5-system/4-execution-engine.md §8` | 적용 시 현행 spec 실제 텍스트와 대조해 diff 정밀 적용 |
| I-3 | Rationale Continuity | 인라인 큐 열거(`execution-run` 삽입 위치)와 §4 표 순서 기준이 달라 minor 비일관성 | `spec/data-flow/0-overview.md` line 93, §4 표 | 구현 확인 후 인라인과 표 순서를 동일 기준(알파벳순 또는 생성 시점순)으로 통일 |
| I-4 | Convention Compliance | `EXECUTION_TIME_LIMIT_EXCEEDED` 신규 코드 도입 시 `spec/conventions/error-codes.md §1·§2` 준수 여부를 draft 에 명시하지 않음 | `spec-update-pr2a-timeout.md` §제안 변경 3 | §제안 변경 3 또는 Rationale 에 "error-codes.md §1·§2 준수 확인 — 의미 분리 신설, rename 아님" 한 줄 추가 |
| I-5 | Convention Compliance | `spec/5-system/14-external-interaction-api.md` frontmatter `pending_plans` 갱신 여부 불명 | `spec/5-system/14-external-interaction-api.md` frontmatter | 대상 spec 파일 frontmatter `status` 확인 후 `partial` 이면 `pending_plans:` 에 본 plan 경로 추가 여부 명시 |
| I-6 | Naming Collision | `EXECUTION_MAX_ACTIVE_RUNNING_MS` env 변수가 §8 표에만 등장하고 §11 ENV 목록에 누락됨 | `spec/5-system/4-execution-engine.md §11` | §11 ENV 목록에 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 행 추가 여부 확인 |
| I-7 | Naming Collision | EIA §6.4 주석 "정본은 3-error-handling.md" 참조가 `3-error-handling.md` 갱신과 동시 커밋이어야 올바른 참조가 됨 | `spec/5-system/14-external-interaction-api.md §6.4` | 본 spec update 커밋에 `3-error-handling.md §1.4` 변경 포함 여부 확인 |
| I-8 | Plan Coherence | `spec-fix-eia-token-error-codes.md`(TBD)와 target 이 동일 파일 다른 섹션을 수정 — 현재 직접 충돌 없음 | `spec/5-system/14-external-interaction-api.md §5.1` vs §6.4 | target 적용 시 `3-error-handling.md §엔진 수준 에러` 목록에 `EXECUTION_TIME_LIMIT_EXCEEDED` 포함 여부 확인 (C-1 해소 시 자동 해결) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | CRITICAL 1건: 에러 코드 SoT(`3-error-handling.md §1.4`) 미갱신으로 `EXECUTION_TIMEOUT`/`EXECUTION_TIME_LIMIT_EXCEEDED` split-brain. WARNING 2건: `0-overview.md §2.6` 큐 목록 누락, 삽입 위치 불명확 |
| Rationale Continuity | HIGH | CRITICAL 1건: `execution-run` 큐 구현 미확인 상태로 "두 큐 전용" 확정 invariant 번복. WARNING 2건: 설정 위치 변경 Rationale 미작성, 코드명 변경 근거 spec 미기록 |
| Convention Compliance | LOW | WARNING 2건: plan 파일명 prefix 불일치(`spec-update-` vs `spec-draft-`), Rationale 섹션 누락. INFO 3건: 에러 코드 규약 준수 확인 명시 권장 등 |
| Plan Coherence | LOW | WARNING 2건: `spec-sync-execution-engine-gaps.md §8` 부분 해소 미갱신, `data-flow/0-overview.md` main 현재 상태 재확인 필요 |
| Naming Collision | MEDIUM | WARNING 2건: EIA §6.4 에 `EXECUTION_TIMEOUT` 잔존으로 두 코드 병기 혼동, `execution-run` 미등재(target이 올바르게 타겟팅). INFO 2건: ENV §11 목록 누락, EIA 주석 참조 동기화 |

---

## 권장 조치사항

1. **(BLOCK 해소 — C-1)** `spec/5-system/3-error-handling.md §1.4` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 신규 행으로 추가하고, `EXECUTION_TIMEOUT` 설명을 "Code 노드 스크립트 타임아웃(노드 수준)" 으로 좁혀 draft 변경 범위에 포함한다. `spec/conventions/chat-channel-adapter.md` 분류표에 `EXECUTION_TIME_LIMIT_EXCEEDED` 행을 추가(또는 `EXECUTION_TIMEOUT(engine)` 통합 갱신)한다.
2. **(BLOCK 해소 — C-2)** `execution-run` 큐의 실제 구현 여부를 codebase 에서 확인한다. 구현이 확인되면 `spec/5-system/4-execution-engine.md §9.3` "두 큐 전용" 각주와 Rationale 을 함께 갱신하는 작업을 draft 에 추가한다. 구현 미확인 시 §제안 변경 2 적용을 보류한다.
3. **(W-3/W-4 해소)** `spec/5-system/4-execution-engine.md §Rationale` 에 "§8 타임아웃 — 1단계 env 상수/2단계 per-workflow 분리 이유" 및 "`EXECUTION_TIME_LIMIT_EXCEEDED` vs `EXECUTION_TIMEOUT` 코드 분리" 항목을 추가(두 항목 병합 가능).
4. **(W-7 해소)** EIA §6.4 에 두 에러 코드의 의미를 인라인 주석으로 구분 표기하고, `chat-channel-adapter.md §3.1` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 행 추가를 검토한다.
5. **(W-8 해소)** `plan/in-progress/spec-sync-execution-engine-gaps.md §8` 미구현 항목을 "(1단계) active-running 타임아웃 — PR2a 완료" / "(2단계) Planned" 로 분리 갱신한다.
6. **(W-9)** `spec/data-flow/0-overview.md` line 93 및 §4 표의 현행 main 상태를 실제 파일로 재확인한 뒤 After 텍스트를 조정한다.
7. **(I-1)** `spec/5-system/4-execution-engine.md §9.3` 에도 `execution-run` 행을 추가한다 (C-2 해소 이후).
8. **(I-6)** `spec/5-system/4-execution-engine.md §11` ENV 목록에 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 행 추가 여부를 확인한다.
9. **(W-5/W-6 — 낮은 우선순위)** SKILL.md 에 `spec-update-` prefix 및 SPEC-DRIFT 분류 plan 의 Rationale 섹션 대체 규칙을 추가해 관행을 정식화한다.