# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 전문 확보, 재시도 필요 항목 없음)

## 전체 위험도
**LOW** — Critical 0, Warning 2(실질 1건 — plan sentinel 오기가 두 checker 에서 중복 지적), Info 2. 4라운드 `/ai-review` + 3라운드 `--spec`/`--impl-prep` 를 이미 거친 PR 로 수렴 상태에 가깝다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

> 해당 없음 — Critical 자체가 없다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| — | (없음) | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | OAuth 콜백 신규 "커밋 직전 인가 재판정" 분기(`assertRequesterStillAllowed`)가 관련 spec 두 곳에 미반영 | `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 의 `assertRequesterStillAllowed` (§8 판정 규칙 구현) | `spec/data-flow/5-integration.md §1.2` OAuth 연결 시퀀스 다이어그램·"callback 실패" 서술, `spec/2-navigation/4-integration.md §10.4` 에러 매핑 표 | 시퀀스 다이어그램에 재판정 단계+롤백 note 추가, §10.4 에 "커밋 직전 인가 재판정 실패(RESOURCE_NOT_FOUND/ADMIN_REQUIRED) → last_error 만 기록, status 보존" 행 추가. 동작은 안전하게 fallback 되므로 Critical 아님 |
| 2 | convention_compliance + plan_coherence (중복 지적, 통합) | 신규 plan 의 `worktree:` frontmatter 값이 정식 sentinel `(unstarted)` 대신 한국어 번역 `(미착수)` — CI 플레이스홀더 가드(`WORKTREE_PLACEHOLDER` 정규식)를 우회하는 silent violation | `plan/in-progress/integration-personal-owner-followup.md` frontmatter 5행 `worktree: (미착수)` | `.claude/docs/plan-lifecycle.md §4` sentinel 정의, 구현 SoT `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` `WORKTREE_SENTINEL = "(unstarted)"`, `.claude/tools/plan-stale-audit.sh` 정확 일치 분기 | `worktree: (unstarted)` (영문 리터럴)로 정정. 방치 시 `plan-stale-audit.sh` 가 이 plan 을 존재하지 않는 worktree(`MISSING`)로 오분류 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | RBAC §3.2 매트릭스("Integration (Personal): 자기 것" — Viewer 포함)와 §8 "아직 강제되지 않는 것"(Viewer 는 라우트 가드로 막힘)이 각주 없이 갈림. 이 PR 이전부터 있던 갭이며 이번 PR 이 만든 모순은 아님 | `spec/5-system/1-auth.md §3.2` Integration (Personal) 행 vs `spec/2-navigation/4-integration.md §8` | §3.2 에 §8 로의 상호 참조 각주 추가 검토(필수 아님, 재발견 비용 절감 목적) |
| 2 | convention_compliance | spec `status: implemented → partial` 역행 전이가 `spec-impl-evidence.md §3.1` 전이 규칙 목록(순방향만 명시)에 침묵 — 이번 사용 자체는 `partial` 정의(§3)에 부합 | `spec/conventions/spec-impl-evidence.md §3.1` | 규약 문서에 "이미 implemented 인 spec 이 새 미구현 약속을 얻어 partial 로 역행하는 경우"를 명시 추가할지 검토(target 위반 아님, 규약 사각지대) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | OAuth 콜백 인가 재판정 분기가 data-flow 시퀀스·에러 매핑 표에 미반영(WARNING); RBAC §3.2/§8 Viewer 각주 부재(INFO) |
| rationale_continuity | NONE | 선행 3라운드 지적 전부 코드·spec 반영 확인, 신규 위반 없음. 기각된 대안(advisory lock 등) 재도입 흔적 없음 |
| convention_compliance | LOW | plan `worktree:` sentinel 오기(WARNING, plan_coherence 와 동일 지적); spec partial 역행 전이 규약 사각지대(INFO) |
| plan_coherence | LOW | 동일 `worktree:` sentinel 오기(WARNING). spec↔plan↔draft 상호 링크, followup 4항목, `/ai-review` 잔여 트래커 등재 전부 정합 확인 |
| naming_collision | NONE | 신규 식별자(함수명·`ADMIN_REQUIRED` 재사용·§8 신설에 따른 §9 재번호 등) 6개 관점 전수 대조, 충돌·끊어진 참조 없음 |

## 권장 조치사항
1. `plan/in-progress/integration-personal-owner-followup.md` frontmatter `worktree: (미착수)` → `worktree: (unstarted)` 로 정정 (한 줄, WARNING #2 해소 — 두 checker 가 중복 지적한 유일한 실제 위반).
2. `spec/data-flow/5-integration.md §1.2` 시퀀스 다이어그램에 `assertRequesterStillAllowed` 재판정 단계 + 실패 시 롤백 note 추가, `spec/2-navigation/4-integration.md §10.4` 에러 매핑 표에 해당 실패 행 추가 (WARNING #1 해소).
3. (선택) `spec/5-system/1-auth.md §3.2` Integration (Personal) 행에 §8 로의 상호 참조 각주 추가 (INFO #1).
4. (선택) `spec/conventions/spec-impl-evidence.md §3.1` 에 `implemented → partial` 역행 전이 케이스 명시 (INFO #2).
