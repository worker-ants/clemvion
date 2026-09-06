# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 성공 응답, Critical 발견 0건.

## 전체 위험도
**MEDIUM** — Critical 없음. 다만 이번 PR(User 엔티티 컬럼 노출 방어 신설)이 스스로 벌린 spec 문서 갭(신규 검증자 2종 미등재로 인한 spec-linked 게이트 커버리지 구멍)이 아직 미해소이며, 신규 타입명 충돌(WorkflowVersionDetail) 1건도 함께 남아 있어 단순 LOW 보다는 한 단계 위로 판정.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 자체가 없으므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | 신규 검증자 2종(`user-entity-exposure-guard.ts` 구조 축, `user-secret-absence.ts` 이름 축)이 `swagger.md §5-1` 콜아웃 및 `2-api-convention.md §5.4` 표의 "두 검증자" 완결형 목록·`code:` frontmatter glob 어디에도 미등재. rationale_continuity 는 이를 단순 문서 낡음이 아니라 **spec-impl-evidence.md §4 SPEC-CONSISTENCY 게이트가 이 두 가드의 향후 약화·삭제를 탐지하지 못하는 실질 커버리지 구멍**으로 지적(MEDIUM) | `spec/5-system/2-api-convention.md §5.4`, `spec/conventions/swagger.md §5-1` | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`, `codebase/backend/src/shared/testing/user-secret-absence.ts` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(375~424행)에 체크리스트로 등재됨 — 다음 planner 턴에서 (a) §5.4 표에 구조·이름 2행 추가, (b) 두 문서 `code:`에 신규 glob 등재, (c) "두 검증자" 개수고정 표현을 표 나열형으로 교체 |
| 2 | rationale_continuity | `User` 민감 7컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`) 응답 노출 금지 결정(`select: false` 기각 논리 포함)의 근거가 spec `## Rationale`이 아니라 코드 JSDoc/plan에만 존재 — `secret-store.md §1.1`이 이미 같은 논리를 다른 필드군에 대해 spec 문장으로 갖고 있는데도 역참조·통합이 안 됨 | `spec/1-data-model.md §2.1`(User), `spec/conventions/secret-store.md §1.1` | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts`(JSDoc), `codebase/backend/src/shared/testing/user-secret-absence.ts`(`USER_SECRET_KEYS`) | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(426~436행)에 등재됨 — 후속 planner 턴에서 `1-data-model.md §2.1` 또는 `secret-store.md §1.1`에 7컬럼 노출금지 규범 문장 + Rationale(전수 열거 수치·기각 대안·secret-store.md 선례 관계) 이관 |
| 3 | naming_collision | 신규 백엔드 타입 `WorkflowVersionDetail`(`workflow-versions.service.ts:47`)이 이 PR이 건드리지 않은 기존 프론트엔드 `codebase/frontend/src/lib/api/workflows.ts:109`의 동명 인터페이스와 완전히 같은 이름 — 같은 개념(버전 상세)의 계층 간 수렴이라 CRITICAL은 아니나, optionality가 이미 미묘하게 갈려(백엔드는 `creator` 전 필드 필수, 프론트는 옵셔널) 향후 drift를 grep으로 잡기 어려움. **이전 3라운드(11:55/12:28/12:53)가 전부 "유일 정의"로 오판**했던 것을 이번 라운드가 정정 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:47` | `codebase/frontend/src/lib/api/workflows.ts:109` | 급한 개명 불요(빌드 단위 분리로 컴파일 충돌 없음). JSDoc으로 "프론트 동명 인터페이스는 별도 선언, 수동 동기화 필요" 언급 추가 또는 리뷰 체크리스트에 동명 파일 쌍 기록 권장. 근본 해결(공유 타입 패키지)은 이 PR 범위 밖 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `WorkspaceMemberDto.joinedAt` 신규 필드가 §5.4 null-vs-키생략 규칙·데이터 모델(`Timestamp?`)과 정합 | `workspace-response.dto.ts` | 조치 불요, 확인 기록 |
| 2 | cross_spec | `WorkflowVersionsService.findOne` 투영 수정이 기존 `WorkflowVersionCreatorDto` 3필드 계약을 준수 상태로 되돌림(신규 충돌 아님). 단 그 DTO 필드가 `?`+`\| null` 동시 사용은 diff 밖이라 별도 트래킹 권장 | `workflow-version-response.dto.ts`(미변경) | 별도 트래킹 권장(이번 PR 범위 아님) |
| 3 | convention_compliance | 신규 검증자 3축 spec `code:` 미등재는 규약 위반이 아니라 developer→planner 권한 경계를 정확히 지켜 이월한 것(자기-반증형 소정정 조건 미해당, `spec/` 쓰기 권한 밖) | `spec/5-system/2-api-convention.md §5.4` | 새 지적 아님, 이미 올바르게 추적됨 |
| 4 | plan_coherence | 직전 라운드(12:53:29) WARNING("3축 중 JSDoc 축 등재 지시 누락")이 커밋 `0f689bb7e`로 해소됨(plan 제목 정정, 3행 표 신설, JSDoc 축 별도 draft로 선행 집행, CHANGELOG·자매 plan 동기화) | `plan/in-progress/spec-draft-nullable-notation-followups.md`, `spec-draft-review-citations-enforcement.md` | 조치 불요, 재발 없음 확인 |
| 5 | plan_coherence | `spec-draft-review-citations-enforcement.md` 마지막 종결 조건("--impl-done 재실행 확인")은 이번 라운드 스코프(`spec/5-system/`) 번들만으로는 검증 근거가 없음(대상 문서가 스코프 밖) — 워킹트리 직접 대조로 별도 확인함 | `plan/in-progress/spec-draft-review-citations-enforcement.md:134` | 체크박스를 닫을 때 이번 라운드 산출물이 아닌 직접 실측 또는 `spec/conventions` 포함 별도 `--impl-done` 근거 남길 것. 차단 사유 아님 |
| 6 | naming_collision | 12_53_29 라운드가 지적한 `isResponseDtoFile` 중복 정의가 재수출(`export { isResponseDtoFile } from './swagger-dto-contract-guard'`) 방식으로 이미 해소됨 | `dto-jsdoc-citation-guard.ts` | 재-flag 불요, 해소 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 신규 검증자 2종 SoT 미등재(WARNING) 외 신규 필드·투영 수정은 기존 계약과 정합 |
| rationale_continuity | MEDIUM | 신규 검증자가 spec `code:` 미매치 → SPEC-CONSISTENCY 게이트 커버리지 구멍(WARNING) + User 7컬럼 노출금지 근거가 spec Rationale 밖(WARNING). 둘 다 plan에 등재된 기지 갭 |
| convention_compliance | NONE | CRITICAL·WARNING 없음. 명명·Swagger·엔티티 노출 금지·JSDoc 인용 회피 전부 규약 충족 확인 |
| plan_coherence | NONE | 직전 WARNING 해소 확인, 남은 갭은 이미 plan이 정확히 추적 중인 후속 작업 |
| naming_collision | LOW | `WorkflowVersionDetail` 프론트/백엔드 동명 충돌 신규 포착(WARNING, 이전 3라운드 오판 정정) 외 나머지는 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 대상 없음 — Critical 0건) 다음 **planner 턴**에서 `plan/in-progress/spec-draft-nullable-notation-followups.md`의 남은 두 체크리스트 항목을 함께 집행: (a) `2-api-convention.md §5.4` 표에 구조·이름 축 2행 추가 + 두 문서 `code:`에 `user-entity-exposure-guard*.ts`/`user-secret-absence*.ts` 등재, (b) `1-data-model.md §2.1` 또는 `secret-store.md §1.1`에 User 7컬럼 노출금지 규범 문장 + Rationale 이관.
2. `WorkflowVersionDetail` 명칭 충돌 인지 — 백엔드 신규 타입에 JSDoc으로 프론트 동명 인터페이스 언급 추가하거나 리뷰 체크리스트에 기록(급한 개명 불요).
3. `spec-draft-review-citations-enforcement.md`의 마지막 체크박스는 이번 라운드 산출물을 근거로 닫지 말고 직접 실측 또는 `spec/conventions` 포함 별도 `--impl-done` 근거를 남길 것.
4. `spec-draft-api-convention-verifier-registration.md`(열린 체크박스 0건, PR #1289로 완료) → `plan/complete/` 이동은 별도 정리 커밋에서 처리.
