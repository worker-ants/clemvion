# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — Critical 1건(plan frontmatter 누락, CI build guard 위반) + Warning 1건(spec-impl-evidence 적용 범위 불일치) + 복수 INFO

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `plan/in-progress/` 파일 필수 frontmatter(`worktree`/`started`/`owner`) 전체 누락 — `plan-frontmatter.test.ts` build guard CI 차단 유발 | `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md` 첫 줄 | `.claude/docs/plan-lifecycle.md §4` + 동일 경로 다른 spec-draft 파일 관례 | 파일 상단에 `---\nworktree: audit-user-actions-5a037b\nstarted: 2026-06-13\nowner: planner\n---` 추가 (착수 전이면 `worktree: (unstarted)` sentinel 사용) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/data-flow/1-audit.md`가 `spec-impl-evidence.md §1` frontmatter-evidence 적용 범위(`spec/2-navigation/**`, `spec/3-workflow-editor/**`, `spec/4-nodes/**`, `spec/5-system/**`, `spec/7-channel-web-chat/**`, `spec/conventions/**`) 외부 경로 — draft가 이 파일을 수정 대상으로 지목하나 frontmatter 가드 적용 안 됨 | B-1 섹션 — "대상 spec: `spec/data-flow/1-audit.md`" | `spec/conventions/spec-impl-evidence.md §1` 적용 범위 열거 | (a) `spec-impl-evidence.md §1`에 `spec/data-flow/**` 추가 후 `1-audit.md`에 frontmatter 부여, 또는 (b) data-flow 폴더가 설계상 비대상이라면 draft 문서에 해당 사실을 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | `spec/data-flow/1-audit.md §1.2` `session_revoked` 행 설명이 이번 spec 변경 범위에 미포함 — auth.md §4.3 확장과 동기화 필요 | 변경 2 (`§4.3 login_history session_revoked` 행 설명 확장) | draft "변경 2" 범위에 `spec/data-flow/1-audit.md §1.2` 병기 갱신 대상으로 추가하거나, Rationale에 "별도 커밋 예정" 명시 |
| 2 | Rationale Continuity | `reset-password` 전체 revoke(§1.1.A)와 `change-password` 현재 세션 제외 revoke(§2.3.C)의 위협 모델 차이가 명시되지 않아 독자 혼동 가능 | 변경 3 — 신규 Rationale §2.3.C | §2.3.C에 "무인증 reset-password(§1.1.A)는 비밀번호 상실 계정 탈취 시나리오라 전체 revoke 원칙이 다르게 적용된다" 한 문장 추가 |
| 3 | Convention Compliance | draft 문서 자체 구조 — `## Overview` 해당 섹션 없고 목적·배경이 blockquote로만 표현 | 파일 전체 구조 | plan 문서 강제 사항 아님. 상단 blockquote를 `## 배경` 섹션으로 격상하면 가독성 개선 (선택) |
| 4 | Convention Compliance | B-1 내 spec 링크 `../5-system/1-auth.md`가 plan/ 기준 상대경로로 끊긴 경로 — `spec-link-integrity.test.ts` 검사 범위(spec/*.md) 밖이라 build 차단 없으나 링크 무효 | B-1 본문 링크 | `spec/5-system/1-auth.md` (루트 기준 절대) 또는 `../../spec/5-system/1-auth.md` (올바른 상대경로)로 수정 |
| 5 | Plan Coherence | B-1(`spec/data-flow/1-audit.md §1.1` user.* 행 `ipAddress 동반` 주석)이 현재 active worktree `claude/audit-user-actions`가 건드린 동일 표 인접 영역과 겹침 — 병렬 적용 시 병합 충돌 가능 | B-1 §변경 4 | `claude/audit-user-actions` 머지 완료 후 B-1 적용; 또는 동일 worktree 내 연속 커밋으로 포함 |
| 6 | Plan Coherence | stale worktree 3건(`audit-coverage-naming`, `unified-model-mgmt-5af7ee`, `spec-sync-audit-998544`) 모두 MERGED — cleanup 권장 | `.claude/worktrees/` | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |
| 7 | Naming Collision | `Rationale §2.3.C` 신규 섹션 번호 — 기존 2.3.A·2.3.B 다음 순차 번호, 충돌 없음 | `spec/5-system/1-auth.md` | 추가 조치 불요 |
| 8 | Naming Collision | `session_revoked` + `familyId=null` — 기존 enum 값의 의미 확장, 신규 충돌 없음 | `spec/5-system/1-auth.md §4.3`, `spec/data-flow/1-audit.md` | spec §4.3 갱신 시 `family_id=null`이 `login_history.family_id UUID?` nullable과 일치하는지 data-flow §2에서 함께 확인 |
| 9 | Naming Collision | `ipAddress` 동반 표기 확장 — 이미 optional 필드로 정의된 기존 식별자 재사용, 충돌 없음 | `spec/data-flow/1-audit.md §1.1` | 추가 조치 불요 |
| 10 | Naming Collision | `SessionsService.revokeOtherFamilies` — spec 내 식별자 충돌 없으나 codebase 메서드 실재 여부는 구현 착수 시 확인 필요 | Rationale §2.3.C 참조 | 구현 착수 시 `SessionsService`에 해당 메서드 실재 여부 점검 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | 재시도 필요 | output_file 미생성 — manifest에 success로 기록됐으나 파일 없음 |
| Rationale Continuity | LOW | data-flow/1-audit.md §1.2 session_revoked 행 동기화 누락(INFO), reset-password vs change-password 위협 모델 미명시(INFO) |
| Convention Compliance | HIGH | plan frontmatter 전체 누락(CRITICAL), spec-impl-evidence 범위 외 파일 참조(WARNING) |
| Plan Coherence | LOW | B-1과 active worktree 인접 영역 겹침 — 병합 충돌 가능(INFO), stale worktree 3건(INFO) |
| Naming Collision | NONE | 모든 신규 식별자 기존 네임스페이스와 안전하게 공존 |

## 권장 조치사항
1. **(BLOCK 해소 필수)** `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md` 상단에 YAML frontmatter 추가 — `worktree: audit-user-actions-5a037b`, `started: 2026-06-13`, `owner: planner` 세 필드 필수. 이것이 유일한 CI 차단 사유.
2. **(WARNING 해소 권장)** `spec/conventions/spec-impl-evidence.md §1` 적용 범위에 `spec/data-flow/**` 추가 여부를 결정하고, 추가한다면 `spec/data-flow/1-audit.md`에 frontmatter 부여. 추가하지 않는다면 draft 문서에 "data-flow 폴더는 frontmatter-evidence 비대상" 주석 명시.
3. **(INFO 보강 권장)** draft "변경 2" 범위 또는 Rationale에 `spec/data-flow/1-audit.md §1.2` `session_revoked` 행 동기화 계획을 명시.
4. **(INFO 보강 권장)** Rationale §2.3.C에 reset-password(§1.1.A)와 change-password의 상이한 위협 모델을 한 문장으로 대조 명시.
5. **(Cross-Spec 재시도)** `cross_spec` checker output 파일이 생성되지 않았음 — cross-spec 검토를 별도로 재실행하거나 수동으로 spec 간 참조 일관성을 확인할 것.
6. **(병합 순서)** B-1 spec 반영은 `claude/audit-user-actions` worktree 머지 완료 후 착수.
