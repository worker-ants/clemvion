# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 현재 작업(C·D·E 그룹) 구현 착수 차단 없음.

---

## 전체 위험도
**MEDIUM** — Critical 없음. WARNING 6건 중 B그룹 착수 전 spec Rationale 충돌 해소가 필요하며, 에러 코드 귀속 방향(WARNING #1)은 구현 전 결정이 권장됨.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | cross_spec | `pending_install` 사용 시 에러 코드 3방향 불일치 (`INTEGRATION_INCOMPLETE` vs `INTEGRATION_NOT_CONNECTED`) | `spec/2-navigation/4-integration.md §6` 주석 | `spec/4-nodes/4-integration/4-cafe24.md §4 step 3`, `§14.1` 에러 vocabulary | (a) `getForExecution` 이 `pending_install` → `INTEGRATION_INCOMPLETE` 분기 있다면 Cafe24 노드 spec §4에 명시, 또는 (b) §6를 `INTEGRATION_NOT_CONNECTED`로 정정 + §14.1에 `pending_install` 케이스 추가 — **착수 전 방향 결정 필수** |
| 2 | cross_spec | `cafe24_operator_id` 필수(✓) 선언 vs. INTEGRATION_INCOMPLETE 검증 목록 미포함 | `spec/2-navigation/4-integration.md §5.8` | `spec/4-nodes/4-integration/4-cafe24.md §4 step 4` | (a) Cafe24 노드 spec §4 step 4 검증 목록에 `cafe24_operator_id` 추가, 또는 (b) §5.8에 "runtime 직접 미사용 메타 필드" 주석 + INTEGRATION_INCOMPLETE 제외 명시 |
| 3 | plan_coherence | plan frontmatter `worktree` 필드 불일치 | `plan/in-progress/cafe24-pending-polish-followup.md` frontmatter `worktree: (none)` | 현재 작업 중인 worktree `cafe24-followup-legacy-mask-0ad56a` | frontmatter를 `worktree: cafe24-followup-legacy-mask-0ad56a`로 즉시 갱신 |
| 4 | plan_coherence | B그룹 TTL 기준 분리 착수 전 project-planner 위임 범위 불명확 | `plan/in-progress/cafe24-pending-polish-followup.md` 그룹 B | `spec/2-navigation/4-integration.md §6`, `spec/1-data-model.md §2.10`, `spec/data-flow/integration.md §1.4` | B그룹 착수 전 plan에 갱신 대상 spec 섹션 3곳 명시 후 project-planner 위임 |
| 5 | plan_coherence | B그룹 TOCTOU advisory lock 선택 시 spec Rationale 번복 미처리 | `spec/2-navigation/4-integration.md` Rationale §"CAFE24_PRIVATE_APP_ALREADY_CONNECTED의 mall_id 비교 경로" | `plan/in-progress/cafe24-pending-polish-followup.md` 그룹 B | B그룹 착수 시 Rationale 개정을 project-planner에 함께 요청 (advisory lock 또는 plain 컬럼 결정에 따라) |
| 6 | plan_coherence | `cafe24-pending-polish.md` 변경 1 미체크 항목 추적 공백 (Public timeout, useQuery, lastError UI) | `plan/in-progress/cafe24-pending-polish.md` 변경 1 | `plan/in-progress/cafe24-pending-polish-followup.md` 전 그룹 | 완료 항목은 체크, drop 항목은 ~~취소선~~ 또는 "(scope 외, drop)" 처리, 미구현 항목은 follow-up plan 해당 그룹에 편입 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | `CAFE24_INSTALL_MISSING_PARAMS(400)` — 코드에 구현됐으나 spec §10 미등재 | `spec/2-navigation/4-integration.md §10` | §10 에러 목록에 `CAFE24_INSTALL_MISSING_PARAMS (400) — mall_id/timestamp/hmac 중 하나 이상 누락` 1행 추가 |
| 2 | cross_spec + plan_coherence | §13 데이터 모델 영향 요약에 `install_token` 컬럼 및 부분 인덱스 누락 | `spec/2-navigation/4-integration.md §13` | §13에 `install_token` 필드 + `(install_token) WHERE install_token IS NOT NULL` 인덱스 1행 추가 (F그룹 착수 시) |
| 3 | plan_coherence | §6 mermaid callback 실패 루프에 `install_token` 보존 정책 미명시 | `spec/2-navigation/4-integration.md §6` | callback 실패 루프 항목에 "install_token 유지 → 재시도 가능" 문구 추가 (F그룹) |
| 4 | rationale_continuity | `markIntegrationCallbackError` — `connected` 행 state 에러 시 `status_reason` 미갱신 | `backend/src/modules/integrations/integration-oauth.service.ts:611-622` | spec §10.4 "state mismatch/expired" 행에 "모든 status 행에 적용" 명시 추가, 또는 `else` 분기에 state 에러코드 패턴 매칭 추가 검토 |
| 5 | cross_spec | `(현행 in-memory 100건 스캔 대체)` 스테일 parenthetical | `spec/2-navigation/4-integration.md §3.2 step 4`, `spec/4-nodes/4-integration/4-cafe24.md §9.4 step 4` | 두 spec 모두에서 해당 괄호 전체 제거 (설계 배경은 Rationale에 이미 기술됨) |
| 6 | cross_spec | §2.2 내부 cross-reference 오류 `§4.2` → 실제 정의는 `§4.3` | `spec/2-navigation/4-integration.md §2.2` | `"§4.2 Reauthorize 행 참조"` → `"§4.3 Reauthorize 상세 조건 참조"` 로 직접 수정 |
| 7 | cross_spec | §3.2 `§9.5 참조` dangling reference (§9.5 미존재) | `spec/2-navigation/4-integration.md §3.2 step 3` | `§9.5 참조` → `[Cafe24 노드 spec §9.8](../4-nodes/4-integration/4-cafe24.md#...) 참조` 로 수정 |
| 8 | convention_compliance | `swagger.md §2-4` 참조 유효성 — 검토 스코프 외였으나 plan_coherence에서 실재 확인됨 | `spec/2-navigation/4-integration.md §9.4` | 조치 불필요. F그룹에서 "§2-4 실재 확인" 항목 완료 처리 가능 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 2건 (에러 코드 3방향 불일치, `cafe24_operator_id` 검증 누락) + INFO 4건 (스테일 참조, broken link 2건, §13 누락) |
| Rationale Continuity | LOW | `connected` 행 state 에러 `status_reason` 미갱신 1건 (INFO) — Rationale 연속성 자체는 건전 |
| Convention Compliance | LOW | CRITICAL/WARNING 없음. INFO 2건 (Overview 부재 허용 케이스, swagger 참조) |
| Plan Coherence | MEDIUM | WARNING 4건 — worktree 필드 불일치(즉시 조치), B그룹 착수 조건 2건, 변경 1 추적 공백. B그룹 전 spec 위임 필요 |
| Naming Collision | LOW | `CAFE24_INSTALL_MISSING_PARAMS` spec 미등재 1건 (INFO). 명명 충돌 없음 |

---

## 권장 조치사항

1. **[즉시 — 5분]** `plan/in-progress/cafe24-pending-polish-followup.md` frontmatter `worktree` 필드를 `cafe24-followup-legacy-mask-0ad56a`로 갱신 (WARNING #3)
2. **[착수 전 결정 필수]** `pending_install` 에러 코드 귀속 방향 확정 — `INTEGRATION_INCOMPLETE` 유지 시 Cafe24 노드 spec §4에 반영, `INTEGRATION_NOT_CONNECTED` 변경 시 §14.1 갱신 (WARNING #1)
3. **[착수 전 결정 필수]** `cafe24_operator_id` INTEGRATION_INCOMPLETE 검증 포함 여부 결정 + 해당 spec 정합화 (WARNING #2)
4. **[C·D·E 그룹 진행 중 병행]** `cafe24-pending-polish.md` 변경 1 미체크 항목 상태 정리 — 완료/drop/편입 분류 (WARNING #6)
5. **[B그룹 착수 전]** plan에 갱신 대상 spec 섹션 3곳 명시 후 project-planner 위임 + Rationale 개정 요청 동시 포함 (WARNING #4, #5)
6. **[F그룹 착수 시 일괄]** §13 `install_token` 추가, §6 보존 정책 명시, §10 `CAFE24_INSTALL_MISSING_PARAMS` 추가, 스테일 parenthetical 제거, broken link 2건 수정 (INFO #1–#3, #5–#7)