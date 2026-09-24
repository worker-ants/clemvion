# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보(디스크 파일 크기까지 인라인과 일치 확인), CRITICAL/WARNING 0건.

## 전체 위험도
**LOW** — 코드 전용 PR(`WorkspacesService.removeMember()` 인가 판정 순서 재배치)이 `spec/5-system`·`spec/data-flow`·`spec/conventions` 어느 것과도 모순되지 않으며, 발견된 것은 전부 INFO(이미 planner 트래커에 등재된 spec 서술 drift·기존 상태 carry-forward)뿐이다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 CRITICAL 이 없어 인계 표가 필요한 상황 자체가 없다. 다만 아래 INFO #1·#2 는 이미 developer 가 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소유 항목으로 정확히 이관해 두었다는 점을 5개 checker 전원(cross_spec·rationale_continuity·convention_compliance·plan_coherence)이 교차 확인했다.

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance, plan_coherence | `removeMember()` 판정 순서 재배치로 에러 카탈로그의 **발행 경로 서술** 3줄이 낡음(코드/상태값·최종 계약 자체는 불변) | `spec/5-system/3-error-handling.md:46`(`ADMIN_REQUIRED` 발행처를 `assertAdmin()` 단수로 서술) · `:49`(`NOT_A_MEMBER` 발행 경로 열거에 `removeMember` 누락) · `spec/5-system/1-auth.md:551`(§3.2 정정 노트가 이제 사라진 `assertAdmin(...)` 호출을 근거로 인용) | 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md`(~L4974-4990)에 planner 항목으로 이미 등재됨(자기-반증형 소정정 조건1 미충족을 확인 후 정확히 라우팅). 다음 planner 턴에서 세 줄만 국소 정정 |
| 2 | cross_spec, plan_coherence | 경로-파라미터로 워크스페이스를 받는 라우트 13개(`removeMember` 포함)가 가드 계층(`@WorkspaceId()`/`@Roles()` 미사용) 보호를 못 받는 구조적 갭 — 이번 diff 는 그중 `removeMember` 한 곳만 서비스 계층에서 메움 | `codebase/backend/src/modules/workspaces/workspaces.controller.ts`(13개 라우트) / `spec/data-flow/12-workspace.md` §"멤버십 검증은 가드 1곳에서(2026-08-08)" | 조치 불요 — 별도 축으로 이미 분리 등재(`spec-draft-nullable-notation-followups.md`), "구조적 해법 우선 검토" 조건이 명시돼 2026-08-08 기각된 "라우트별 opt-in 마커" 패턴 재도입을 선언적으로 차단. 착수 시 그 조건 준수만 확인 |
| 3 | cross_spec | 신규 코드 시퀀스(비-admin 이 owner 지목 시 `CANNOT_REMOVE_OWNER` 대신 `ADMIN_REQUIRED`)가 기존 spec 서술과 모순되지 않음을 교차 확인 | `1-auth.md` §3.2 각주 · `12-workspace.md` §1.6 · `9-user-profile.md` §4.1/§6.1 | 없음(정보성 확인) |
| 4 | convention_compliance | (이번 diff 와 무관, carry-forward) `spec/5-system` 4개 파일이 `## Overview` 정식 표제 대신 `## 1. 개요` 또는 표제 자체 생략 | `11-mcp-client.md`·`5-expression-language.md`·`7-llm-client.md`·`16-system-status-api.md` | 조치 불요(이번 PR 스코프 밖). 별도 문서 정리 세션에서 표제 보충 |
| 5 | plan_coherence | `member-auth-order.md` 완료(`complete/` 이동) 시 `spec_impact: none` 표기가 이 PR 이 유발한 spec staleness(INFO #1)와 얼핏 어긋나 보일 수 있음 | `plan/in-progress/member-auth-order.md` frontmatter | 저장소 선례(`auth-guard-reflection-hardening.md` — 동일하게 developer 권한 밖 spec drift 를 planner 위임하며 `spec_impact: none` 유지)를 근거로 남기면 재질문 방지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec/5-system diff 0. 코드 재배치가 기존 RBAC 계약과 모순되지 않음. 카탈로그 인용 경로 3줄 drift 는 planner 이관 확인 |
| rationale_continuity | LOW | 직전 impl-prep WARNING 1건(기각된 opt-in 패턴 재도입 우려)이 plan §B-2 의 3단 반박으로 실측상 해소됨을 확인 |
| convention_compliance | LOW | 명명·에러 응답 봉투·API 문서·금지항목(감사 액션) 전부 준수. INFO 2건(카탈로그 서술 drift, 기존 Overview 표제 누락)만 |
| plan_coherence | NONE | 후속 항목(3줄 정정·13-라우트 축) 전부 트래커 등재 확인, 다른 in-progress plan 과 충돌 없음 |
| naming_collision | NONE | spec 델타 0, 신규 식별자 없음 — 기존 4개 에러 코드 재사용 재배치만 |

## 권장 조치사항
1. (BLOCK 대상 아님) 다음 planner 턴에서 `spec/5-system/3-error-handling.md:46,49`, `spec/5-system/1-auth.md:551` 세 줄을 실제 코드(`removeMember()` 가 이제 `assertAdmin()` 을 직접 호출하지 않음)에 맞게 국소 정정 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재된 항목을 그대로 실행
2. 13-라우트 가드 커버리지 축 착수 시 "구조적 해법(가드/reflection 확장) 우선 검토, 불가 시에만 라우트별 수동 체크 승인" 조건 준수 확인
3. `member-auth-order.md` 를 `complete/` 로 이동하는 커밋에서 `spec_impact: none` 근거로 `auth-guard-reflection-hardening.md` 선례 인용
4. (별도 세션, 낮은 우선순위) `spec/5-system` 4개 파일에 `## Overview` 표제 보충