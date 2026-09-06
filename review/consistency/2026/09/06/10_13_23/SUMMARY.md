# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 모두 CRITICAL 없음. 전문 확보 못 한 checker 없음(5/5 success, 인라인 전문 전부 확보 및 디스크 파일 기존 존재 확인).

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, "신규 응답-검증 가드 2건이 §5.4 검증 층 표/`code:` 글롭에 미등재"라는 동일 WARNING 을 5개 checker 중 4개(cross_spec·rationale_continuity·convention_compliance·plan_coherence)가 독립적으로 발견했고, plan_coherence 는 이것이 **하루 전 자매 plan 항목이 이미 겪고 명문화해 둔 바로 그 실패 모드의 재발**이며 실측(`fnmatch` 전수 대조, 4개 신규 파일 전부 매치 0)까지 첨부했다. 기능 저해나 계약 위반은 없어 BLOCK 사유는 아니지만, 방치 시 이 가드 파일이 나중에 약화·삭제돼도 spec 재검토 게이트가 걸리지 않는 실질적 사각지대가 이미 만들어졌다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — 이번 라운드는 CRITICAL 이 없어 인계 대상이 없다. 다만 아래 WARNING #1 은 developer 권한 밖(spec 쓰기)이라 다음 절 "권장 조치사항"에서 project-planner 턴을 명시한다.)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance, plan_coherence (4/5 중복 보고, 최강 등급 유지) | 신규 응답-노출 검증 가드 2건(`user-entity-exposure-guard.ts` — 구조/AST 축, `user-secret-absence.ts` — 이름 기반 값 축)이 §5.4 "검증 층" 표 + `code:` 글롭에 미등재. `_spec_linked_changes()` 실측상 4개 신규 파일 전부 어떤 spec `code:` 글롭에도 매치 0건 | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`, `user-entity-exposure.spec.ts`, `codebase/backend/src/shared/testing/user-secret-absence.ts`, `user-secret-absence.spec.ts` (전부 신규) | `spec/5-system/2-api-convention.md` §5.4 검증 층 표 + frontmatter `code:` (직전 커밋 `21182db02` 가 확정한 "양쪽 문서 등재" 관례), `spec/conventions/swagger.md` §5-1, 인접 후보 `spec/5-system/1-auth.md` §4 | §5.4 표에 두 행(구조 축/이름 축) 추가, 두 문서 `code:` 글롭에 신규 파일 패턴 등재. developer 권한 밖 — project-planner 턴 필요. 자매 plan 항목이 하루 전 동일 패턴을 이미 겪고 고쳤음(`response-contract.ts` 사례) — 같은 실수의 재발이므로 우선순위 높음 |
| 2 | convention_compliance | `User` 엔티티 민감 7컬럼(`USER_SECRET_KEYS`) 노출 금지 불변식이 어떤 spec 문서에도 정식 규약 문장으로 선언돼 있지 않음(코드가 유일한 SoT) — Trigger/AuthConfig 계열은 `secret-store.md §1.1` 에 이미 대응 문장을 갖췄으나 `User` 는 대응 절 없음 | `spec/1-data-model.md` §2.1 User (54~83행) | `spec/conventions/secret-store.md` §1.1 (선례 — 2026-09-05 신설된 동일 계열 문장) | `1-data-model.md §2.1` 또는 `secret-store.md §1.1` 에 `User` 7컬럼 노출 금지 문장 추가 + 위 가드 두 개를 그 절의 `code:`/본문 링크로 연결. project-planner 턴에서 처리 |
| 3 | naming_collision | e2e 테스트 케이스 레터 `F.` 가 `workspace-rbac.e2e-spec.ts` 한 파일 안에서 두 번 재사용(기존 "sole owner 는 leave 불가" 케이스와 신규 "멤버 목록에 User 비밀 컬럼 미노출" 케이스가 동일 레터). 이 레터 체계는 `plan/complete/**` 문서가 외부 추적 포인터로 인용 중 | `codebase/backend/test/workspace-rbac.e2e-spec.ts` (신규 `it('F. GET /:id/members...')`, ~287행) | 기존 `it('F. sole owner 는 leave 불가...')` (원래 326행, 신규 diff 후 382행) | 신규 케이스 레터를 미사용 `J.` 로 변경(현재 파일 마지막 레터가 `I.`) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `User` 컬럼 방어 결정(전수 열거 → 구조+이름 2축 검출 채택, `select:false`/전역 인터셉터 기각)의 근거가 spec `## Rationale` 이 아니라 `plan/in-progress/**`·`CHANGELOG.md` 에만 있음(SoT 배치 규약과 다소 어긋남). 위 WARNING #2 와 함께 처리하면 자연히 해소 | `plan/in-progress/spec-draft-nullable-notation-followups.md` "완료(2026-09-06)" 블록, `CHANGELOG.md` Unreleased 절 | `spec/1-data-model.md §2.1` 또는 `secret-store.md` `## Rationale` 에 결정 근거(전수 열거 수치·기각한 두 대안·채택 이유)를 옮겨 적기 |
| 2 | convention_compliance | `WorkspaceMemberDto.joinedAt` JSDoc "아직 수락 전이면 null" 서술이 현재 코드 경로상 도달 불가능한 시나리오를 근거로 듦(실측: 생성 경로 3곳 전부 `new Date()` 즉시 채움, 미가입 초대는 별도 `WorkspaceInvitation` 엔티티) | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:80-89` | JSDoc 을 "스키마상 nullable — 현재 모든 생성 경로가 즉시 채우지만 미래 경로 대비 방어적 선언"으로 정정(선택적, spec 변경 불요) |
| 3 | plan_coherence | §5.4 drift 배치 2단계 스윕 카운트("4→18개 DTO")가 이번 diff 의 `workspace-rbac.e2e-spec.ts` 신규 배선(`WorkspaceMemberDto`)으로 18→19 가 됐는데 기록에 미반영 | `plan/in-progress/spec-draft-nullable-notation-followups.md` "§5.4 drift 배치 — 2단계" 항목 | 심각하지 않음 — 스윕 2차 착수 시 실측으로 자연 해소. 지금 한 줄 메모만 남겨도 충분 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 신규 가드 2건 §5.4 미등재(WARNING). spec 정의(joinedAt, User 민감컬럼 7개, RBAC)와 정면 모순 없음 |
| rationale_continuity | LOW | "정확히 두 검증자" 경계 서술에 3번째 축 미반영(WARNING) + 결정 근거가 spec Rationale 대신 plan/CHANGELOG 에만 있음(INFO). 기존 secret-store.md 원칙과는 정합, 번복 없음 |
| convention_compliance | LOW | 가드 미등재(WARNING) + User 노출 금지 불변식 자체가 spec 미선언(WARNING) + joinedAt JSDoc 부정확(INFO). 명명·배치 컨벤션은 기존 형제 가드 패턴 그대로 준수 |
| plan_coherence | MEDIUM | 가드 미등재가 **하루 전 자매 항목이 이미 겪은 패턴의 재발**임을 실측(`fnmatch` 0/4)으로 확인(WARNING) + §5.4 스윕 카운트 경미한 stale(INFO). 결정 자체(전수열거→제3의 길)는 선행조건 충족, 기존 규약과 정합 |
| naming_collision | LOW | e2e 케이스 레터 `F.` 중복(WARNING, 유일 checker 발견). 그 외 신규 식별자(`USER_SECRET_KEYS` 등) 전수 확인 결과 충돌 없음, 엔티티 컬럼명과 1:1 일치 |

## 권장 조치사항
1. **(최우선, project-planner 턴)** `spec/5-system/2-api-convention.md` §5.4 검증 층 표 + frontmatter `code:` 및 `spec/conventions/swagger.md` §5-1 에 `user-entity-exposure-guard*.ts`(구조 축)·`user-secret-absence*.ts`(이름 축) 등재. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "완료" 노트에도 이 후속 항목을 위한 체크박스를 남겨 draft 종결 조건("`## 후속` 체크박스 전부 닫힘")이 조용히 거짓이 되지 않게 한다.
2. **(project-planner 턴, #1 과 병행 가능)** `spec/1-data-model.md §2.1` 또는 `spec/conventions/secret-store.md §1.1` 에 `User` 7개 민감 컬럼 노출 금지를 정식 규약 문장으로 추가하고 결정 근거(전수 열거 수치·기각한 대안)를 `## Rationale` 에 옮긴다.
3. **(developer, 즉시 가능·경미)** `codebase/backend/test/workspace-rbac.e2e-spec.ts` 신규 케이스의 레터를 `F.` → `J.` 로 변경.
4. (낮은 우선순위) `WorkspaceMemberDto.joinedAt` JSDoc 정정, §5.4 드리프트 스윕 카운트 한 줄 메모 — 둘 다 선택적.