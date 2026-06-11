# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — 코드-spec 간 action 문자열 직접 불일치 2건(CRITICAL) 이 있으며, 감사 로그 조회 정합성에 영향을 줍니다.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C-1 | convention_compliance | `spec/data-flow/1-audit.md §1.1` 표가 구현과 불일치 — `re_run_initiated` 잔존. 이 표는 스스로 "현재 코드 action 의 SoT" 라고 선언함. | `spec/data-flow/1-audit.md §1.1` 8번째 row | `executions.service.ts` 의 `AUDIT_ACTIONS.EXECUTION_RE_RUN = 'execution.re_run'` | §1.1 표의 action 컬럼을 `execution.re_run` 으로 갱신. Rationale 의 `re_run_initiated` 예시 서술도 "이미 교정됨"으로 정정 |
| C-2 | convention_compliance | `spec/5-system/1-auth.md §4.1` 표가 구현 action 명과 불일치 — Integration 동사형 오류(`create/update/delete` vs 구현 `created/updated/deleted`) + `execution.re_run`, `integration.rotated`, `integration.scope_changed`, `integration.reauthorized`, `workspace.transfer_ownership` 누락 | `spec/5-system/1-auth.md §4.1` | `audit-action.const.ts` (구현 SoT) | §4.1 표를 "구현됨" / "Planned" 두 단으로 분리. Integration 동사형을 과거분사로 수정. 누락된 5개 action 을 구현됨 표에 추가 |
| C-3 | naming_collision | `AUDIT_ACTIONS.EXECUTION_RE_RUN = 'execution.re_run'` 이 spec 2개 파일의 `re_run_initiated` 와 직접 충돌. 불변 감사 로그 이력 조회 정합성 저하 | `codebase/backend/src/modules/audit-logs/audit-action.const.ts` | `spec/5-system/13-replay-rerun.md §11`, `spec/data-flow/1-audit.md §1.1` | spec 2개 파일(`spec/5-system/13-replay-rerun.md §11`, `spec/data-flow/1-audit.md §1.1`)을 `execution.re_run` 으로 갱신해 코드와 일치시킴 |

> **중복 통합 메모**: C-1(convention_compliance) 과 C-3(naming_collision) 은 동일 충돌(`re_run_initiated` vs `execution.re_run`)을 서로 다른 각도(규약 위반 / 식별자 충돌)에서 지적. 해소 방법은 동일하므로 함께 처리.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | convention_compliance | `audit-action.const.ts` JSDoc 이 §4.1 을 참조하나, §4.1 표기와 구현 명칭이 불일치하는 상황에서 개발자가 spec 을 신뢰하고 `integration.create` 를 사용하면 오삽입 위험 (union 타입 컴파일 에러로 런타임 차단되지만 spec 혼선 자체가 바람직하지 않음) | `audit-action.const.ts` JSDoc (line 48–51) | `spec/5-system/1-auth.md §4.1` | §4.1 표 갱신(C-2) 후 JSDoc 참조가 정확한 명칭을 가리키는지 확인. 필요 시 "spec §4.1 표기와 다를 경우 본 const 가 SoT" 명시 |
| W-2 | naming_collision | `integration.create/update/delete` (spec §4.1 현재형) vs `integration.created/updated/deleted` (구현 및 data-flow spec 과거분사형) — spec 내부 불일치 | `spec/5-system/1-auth.md §4.1` Integration 행 | `spec/data-flow/1-audit.md §1.1`, `spec/2-navigation/4-integration.md` (과거분사형 사용) | §4.1 Integration 행을 `integration.created, integration.updated, integration.deleted, integration.rotated, integration.scope_changed, integration.reauthorized` 로 갱신 (C-2 와 함께 해소됨) |
| W-3 | plan_coherence | `auth-config-webhook-followups.md §1` 이 추적 중인 `auth_config CRUD audit 미기록` 갭의 spec 표현(§4.1)이 본 PR 로 "구현됨/Planned" 구조로 개편됐으나 해당 plan 이 이 변경을 인식하지 못함 | `plan/in-progress/auth-config-webhook-followups.md §1` | `spec/5-system/1-auth.md §4.1` (본 PR 변경) | `auth-config-webhook-followups.md §1` 에 "spec/5-system/1-auth.md §4.1 이 audit-coverage-naming PR(2026-06-11)에서 구현됨/Planned 구조로 개편됨" 한 줄 노트 추가 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | cross_spec | Planned 액션 표의 verb form 이 과거분사로 정규화되지 않음 (`workspace.create` vs 구현된 `integration.created`) — 현재 미구현이므로 충돌 없으나 추후 삽입 시 혼재 위험 | `spec/5-system/1-auth.md §4.1` Planned 표 | Planned 표에 "구현 시 과거분사형으로 맞출 예정" 주석 추가 또는 미리 정규화 |
| I-2 | cross_spec | `workspace.transfer_ownership` 의 네이밍이 Planned 항목(`workspace.create` 등)과 verb-form 이 다름 — 실제 충돌은 아님 | `spec/5-system/1-auth.md §4.1` | 구현 시 형태 통일 결정을 spec 에 명시 |
| I-3 | cross_spec | `data-flow/1-audit.md §2.1` 필터 설명에 레거시 `re_run_initiated` row 와 신규 `execution.re_run` 의 이중 조회 필요 상황이 미언급 | `spec/data-flow/1-audit.md §2.1` | 필터 설명에 "레거시 `re_run_initiated` row 는 별도 쿼리 필요" 한 줄 추가 |
| I-4 | convention_compliance | `AuditLogDto` 의 `@ApiProperty({ example: 'integration.updated' })` 변경은 `spec/conventions/swagger.md §1-2` 에 부합 | `audit-log-response.dto.ts` | 추가 조치 불요 |
| I-5 | convention_compliance | `data-flow/1-audit.md` 에 frontmatter 부재 — 의무 대상 범위(`spec/data-flow/`) 에 해당 안 함, 위반 아님 | `spec/data-flow/1-audit.md` | 추가 조치 불요 |
| I-6 | plan_coherence | `spec-code-cross-audit-2026-06-10.md §2` G-01/G-02 항목이 본 PR 로 정상 완료 처리됨 — 계획된 방향과 일치 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` | 추가 조치 불요 |
| I-7 | plan_coherence | `spec-sync-auth-gaps.md` 는 LDAP/SAML 미구현만 추적하므로 본 PR 의 §4.1 개편과 직접 교차하지 않음 | `plan/in-progress/spec-sync-auth-gaps.md` | 추가 조치 불요 |
| I-8 | naming_collision | `AUDIT_ACTIONS` (exported const), `AuditAction` (exported type), `audit-action.const.ts` 파일명 — 기존 코드베이스 어디에도 동명 심볼 없음, 충돌 없음 | `audit-action.const.ts` | 추가 조치 불요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | INFO 3건 — Planned verb form 비정규화, 레거시 row 조회 미언급 |
| rationale_continuity | **재시도 필요** | output_file 부재(`rationale_continuity.md` 파일 없음) — 결과 미포함 |
| convention_compliance | HIGH | CRITICAL 2건(spec SoT 표 미갱신) + WARNING 1건 + INFO 2건 |
| plan_coherence | LOW | WARNING 1건(auth-config-webhook-followups.md 미반영) + INFO 3건 |
| naming_collision | HIGH | CRITICAL 1건(`execution.re_run` vs spec `re_run_initiated` 직접 충돌) + WARNING 1건 + INFO 1건 |

---

## 권장 조치사항

1. **(BLOCK 해소 — 최우선)** `spec/data-flow/1-audit.md §1.1` 표 8번째 row action 컬럼을 `re_run_initiated` → `execution.re_run` 으로 갱신. Rationale 의 `re_run_initiated` 예시 서술을 "이미 교정됨" 으로 정정. (C-1, C-3 공동 해소)
2. **(BLOCK 해소 — 최우선)** `spec/5-system/13-replay-rerun.md §11` 의 action 표 값 `re_run_initiated` → `execution.re_run` 으로 갱신. (C-3 추가 해소)
3. **(BLOCK 해소 — 최우선)** `spec/5-system/1-auth.md §4.1` 표를 "구현됨" / "Planned" 두 단으로 재구성. Integration 동사형을 `integration.created/updated/deleted` 로 수정. 누락된 action(`execution.re_run`, `integration.rotated`, `integration.scope_changed`, `integration.reauthorized`, `workspace.transfer_ownership`)을 구현됨 표에 추가. (C-2, W-2 공동 해소)
4. **(WARNING 해소)** `audit-action.const.ts` JSDoc 이 §4.1 갱신 후 올바른 명칭을 참조하는지 확인. (W-1 해소 — 3번 완료 후 자동 해소 가능)
5. **(WARNING 해소)** `plan/in-progress/auth-config-webhook-followups.md §1` 에 "spec/5-system/1-auth.md §4.1 이 audit-coverage-naming PR(2026-06-11)에서 구현됨/Planned 구조로 개편됨" 한 줄 노트 추가. (W-3 해소)
6. **(INFO — 권장)** `spec/data-flow/1-audit.md §2.1` 필터 설명에 레거시 `re_run_initiated` row 와 신규 `execution.re_run` 의 이중 조회 필요성 한 줄 추가. (I-3)
7. **(재시도 필요)** `rationale_continuity` checker 결과 파일이 존재하지 않아 해당 checker 를 평가하지 못함. 재실행 후 결과를 통합 보고서에 반영할 것.