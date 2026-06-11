# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 4건은 spec 갱신으로 해소 가능하며 구현 차단 사유 없음.

## 전체 위험도
**LOW** — G-01/G-02 구현은 기존 Rationale 결정과 완전 정합. 두 spec 문서의 action 목록/시제 불일치(사전 존재 포함) 4건이 WARNING으로 잔존하나 코드 작동을 막지 않음.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `spec/2-navigation/4-integration.md §14.3` 감사 로그 액션 목록에서 `integration.updated` 누락 | `integrations.service.ts` — `AUDIT_ACTIONS.INTEGRATION_UPDATED` emit | `spec/2-navigation/4-integration.md §14.3` (5종 열거, `integration.updated` 없음) | `§14.3` 목록에 `integration.updated` 추가해 SoT(`spec/5-system/1-auth.md §4.1`)와 동기화 |
| W-2 | Cross-Spec | `spec/data-flow/5-integration.md` cross-ref에서 `integration.scope_changed` 누락 | `integrations.service.ts` — `AUDIT_ACTIONS.INTEGRATION_SCOPE_CHANGED` emit | `spec/data-flow/5-integration.md` 행 406 | cross-ref를 전체 6종(`integration.created/updated/deleted/rotated/scope_changed/reauthorized`)으로 갱신 |
| W-3 | Convention Compliance | G-02 rename이 `spec/data-flow/1-audit.md §1.1` SoT 표에 미반영 (`re_run_initiated` 잔존) | diff에 `spec/data-flow/1-audit.md` 변경 없음 | `spec/data-flow/1-audit.md §1.1` ("이 표가 현재 코드에서 실제로 기록되는 action의 SoT") | `§1.1` 표의 `re_run_initiated` 행을 `execution.re_run`으로 교체 + G-02 rename 근거 비고 추가 (project-planner 범위) |
| W-4 | Convention Compliance | `spec/5-system/1-auth.md §4.1` 표가 동사 원형(`integration.create/update/delete`)을 사용하나 구현은 과거분사(`integration.created/updated/deleted`) 사용 — 본 diff 이전부터 존재, 미해소 | `audit-action.const.ts` AUDIT_ACTIONS 값 | `spec/5-system/1-auth.md §4.1` 표 | (a) spec §4.1을 과거분사형으로 갱신 + `execution.re_run` 행 추가, 또는 (b) §4.1에 "data-flow §1.1이 구현 현황 SoT" 주석 추가 — 어느 쪽이든 project-planner 위임 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `re_run_initiated` 레거시 명칭이 spec Rationale 내 역사적 언급으로만 잔존 — 의도된 역사 주석 | `spec/data-flow/1-audit.md` Rationale 절 행 196–200 | 갱신 불필요 |
| I-2 | Cross-Spec | `spec/5-system/13-replay-rerun.md §11` 및 `spec/5-system/1-auth.md §4.1`이 `execution.re_run`을 구현 완료 액션으로 기록 — 구현과 일치 | 없음 | 없음 |
| I-3 | Rationale Continuity | G-01/G-02 모두 기존 Rationale 결정의 직접 이행 — 기각 대안 재도입 없음 | `spec/data-flow/1-audit.md`, `spec/5-system/1-auth.md §4.1`, `spec/5-system/13-replay-rerun.md §11` | 없음 |
| I-4 | Convention Compliance | `AuditLogDto.action` 응답 DTO가 여전히 `string` 타입 — 기능상 무해 | `audit-log-response.dto.ts` | 별도 과제로 `@ApiProperty({ enum: Object.values(AUDIT_ACTIONS) })` 추가 권장 |
| I-5 | Convention Compliance | `audit-action.const.ts` 파일명·위치·export 명명 모두 NestJS 규약 준수 | `codebase/backend/src/modules/audit-logs/audit-action.const.ts` | 없음 |
| I-6 | Plan Coherence | `spec-code-cross-audit-2026-06-10.md` G-01·G-02 항목 이미 완료 체크 — target diff와 정합 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` | 없음 |
| I-7 | Plan Coherence | `auth-config-webhook-followups.md §1`이 AUDIT_ACTIONS union을 선결 조건으로 올바르게 참조 | `plan/in-progress/auth-config-webhook-followups.md §1` | 없음 |
| I-8 | Plan Coherence | stale worktree `spec-sync-audit-998544` — PR #516 MERGED로 stale skip 처리 | `.claude/worktrees/spec-sync-audit-998544` | `cleanup-worktree-all.sh --yes --force` 실행 권장 |
| I-9 | Naming Collision | `AUDIT_ACTIONS` 상수 9개 + `AuditAction` 타입 + `audit-action.const.ts` — origin/main에 동명 선행 정의 없음 | `audit-action.const.ts` | 없음 |
| I-10 | Naming Collision | `execution.re_run` 신규 row와 DB 레거시 `re_run_initiated` row 병존 — spec 승인된 append-only 상황 | `spec/data-flow/1-audit.md §Rationale`, `spec/5-system/13-replay-rerun.md §11` | 조회 API에서 두 값 OR 결합 필요함을 운영 주석으로 보존 (이미 Rationale에 기재됨) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec 내부 부분 목록 불일치 2건(WARNING) — 구현 SoT와 어긋나는 파생 문서 |
| Rationale Continuity | NONE | G-01/G-02 모두 기존 Rationale 결정의 이행 — 신규 결정 없음 |
| Convention Compliance | MEDIUM | SoT 표 미갱신(W-3) + 동사 시제 불일치 사전 존재(W-4) — 코드 재작업 불필요, spec 갱신으로 해소 |
| Plan Coherence | NONE | 진행 plan과 완전 정합, 선행 미해소 항목 없음 |
| Naming Collision | NONE | 신규 식별자 충돌 없음 |

## 권장 조치사항

1. **(spec 동기화 — W-3 해소)** `spec/data-flow/1-audit.md §1.1` 표의 `re_run_initiated` 행을 `execution.re_run`으로 교체하고 G-02 rename 근거 비고 추가. project-planner 범위.
2. **(spec 동기화 — W-4 해소)** `spec/5-system/1-auth.md §4.1` 표의 동사 원형(`integration.create/update/delete`)을 과거분사형(`integration.created/updated/deleted`)으로 갱신하고 `execution.re_run` 행 추가 — 또는 §4.1에 "구현 현황 SoT는 data-flow §1.1" 주석 추가. project-planner 범위.
3. **(spec 동기화 — W-1/W-2 해소)** `spec/2-navigation/4-integration.md §14.3` + `spec/data-flow/5-integration.md §406 cross-ref` 감사 액션 목록을 전체 6종으로 갱신. project-planner 범위.
4. **(INFO — 선택)** `AuditLogDto.action` 응답 DTO에 `@ApiProperty({ enum: Object.values(AUDIT_ACTIONS) })` 추가해 Swagger 소비자 친화성 향상.
5. **(운영)** stale worktree `spec-sync-audit-998544` 정리 권장.