# Consistency Check 통합 보고서

**모드**: `--impl-prep spec/2-navigation/` (session 00_21_55 의 payload 조립 오류 정정 재실행)
**대상 작업**: `plan/in-progress/user-guide-routing-loop-fix.md`

**BLOCK: NO** — Critical 위배 없음. 구현 착수 가능.

> **커버리지**: 5/5 전수 확보 완료. 1차 workflow 반환은 5개 checker 전원 `status=success`
> 였으나 `plan_coherence` · `naming_collision` 2개는 **output_file 이 디스크에 미생성**
> (알려진 비결정적 FS-write flakiness). `ls` 대조로 부재를 확인하고 2개를 직접 Agent
> 재호출해 확보했다(`plan_coherence` 는 1회 API 오류 후 재시도). 두 결과 모두 위험도 NONE.

## 전체 위험도
**LOW** — Critical 0건. WARNING 2건은 **본 수정과 무관한 기존 spec 표면 불일치**
(`spec/2-navigation` 영역 전체를 스캔하는 `--impl-prep` 특성상 함께 잡힌 것)이며,
본 라우팅 버그 수정 계획 자체에 대한 위배는 없다.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING) — 본 수정과 무관한 기존 spec 이슈

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `Workspace.timezone` 이 실제로는 `settings`(JSONB) nested 키(`settings.timezone`)인데 §6.2 생성 규칙표에 top-level 컬럼처럼 표기 — 다른 행(`name`/`slug`/`type`)과 같은 관례로 읽혀 구현자가 별도 컬럼으로 오인할 위험 | `spec/2-navigation/10-auth-flow.md` §6.2 | `spec/1-data-model.md` §2.2 Workspace 엔티티(NAV-SC-06) | 필드명을 `Workspace.settings.timezone` 으로 정정 + data-model §2.2 에 상호 참조 각주 |
| 2 | Convention Compliance | `GET /api/executions/workflow/:workflowId` 가 `api-convention.md` §2.2 의 `{resource}/{id}/{sub-resource}` 부모→자식 중첩 순서와 어긋남(예외 목록 미등재) | `spec/2-navigation/14-execution-history.md` §5 | `spec/5-system/2-api-convention.md` §2.2 | 기존 구현 정착 + 타 spec 재사용하는 광범위 패턴이라 target 수정 불요. `api-convention.md` §2.2 예외 목록 공식 등재 또는 기술부채 백로그 |

> **처분**: 두 건 모두 `spec/` 문서 수정이 필요해 developer 권한 밖이며, 본 PR 의 라우팅
> 수정과 인과관계가 없다. 범위 오염(scope creep) 방지를 위해 본 PR 에 포함하지 않고
> project-planner 위임 대상으로 남긴다.

## 참고 (INFO) — 본 수정 관련 항목만 발췌

| # | Checker | 항목 | 위치 | 처분 |
|---|---------|------|------|------|
| 3 | Rationale Continuity | `workspaceScoped`(`/docs` bare href) 도입은 기각된 대안의 재도입이 **아니라** 코드 버그(`sidebar.tsx:441` 무조건 `buildWorkspaceHref` 적용)의 정합화 — 문제 없음, 진행 | plan 결정 1 | ✅ 진행. `(main)/[...rest]/page.tsx` docstring 정정을 구현 커밋에 포함 |
| 4 | Rationale Continuity | catch-all terminal 화(notFound 이원화)는 00_21_55 세션에서 WARNING 이었으나, `11-error-empty-states.md §1.3` 기존 404 정책("존재하지 않는 라우트 접근 시 표시" + "사이드바 표시")과 **정합함이 재확인되어 INFO 로 하향** | plan 결정 §2 | ✅ 진행. 단 spec 보강 draft(checklist #10)는 본 PR 내 실제 작성 필수 |
| 5 | Rationale Continuity | `buildWorkspaceHref` 비-idempotent 유지 근거가 plan 에는 있으나 `href.ts` docstring 에 미반영 | `codebase/frontend/src/lib/workspace/href.ts` | ✅ 구현 시 docstring 에 근거 반영 |
| 6 | Rationale Continuity | 신규 catch-all forward 분기(`/w/<slug>` → `/w/<slug>/dashboard`)가 기존 query/hash 보존 패턴을 유지하는지 plan 에 명시 없음 | plan 결정 §2 | ✅ forward 분기에도 query/hash 보존 + **테스트 케이스로 명시** |

> 이 외 INFO 4건(Trigger manual 분류 사각지대, `1-workflow-list.md` §2.3 시제 모순,
> `ExportWorkflowDto` 위치, `dashboard` 단수 명사)은 본 수정과 무관한 기존 영역 이슈로
> project-planner 백로그 대상.

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `Workspace.timezone` 표기 불일치(WARNING, 무관) + INFO 2. 본 수정은 기존 spec("docs 는 slug 밖 유지")과 상충 없음 — 오히려 구현을 spec 대로 바로잡는 정합화 |
| Rationale Continuity | LOW | 핵심 축(slug=FE 라우팅 SoT, docs 예외) 존중. 이전 세션 WARNING 2건 모두 근거 기록·재검토로 INFO 하향 |
| Convention Compliance | LOW | 실행 목록 API 경로 규약 불일치(WARNING, 무관, 기존 정착 패턴). 신규 드리프트 아님 |
| Plan Coherence | NONE | (재실행 확보) target plan 의 spec 근거·코드 상태 일치, 다른 plan 과 정합. Critical/Warning 0. INFO 1건 — catch-all terminal 계약 spec 보강 draft(checklist #10) 완료 확인 권장 |
| Naming Collision | NONE | (재실행 확보) 신규 식별자 `workspaceScoped` 저장소 전수 검색 결과 충돌 없음. Critical/Warning/INFO 해당 없음 |

## 권장 조치사항 (본 PR 범위)
1. 구현 시 `(main)/[...rest]/page.tsx` docstring 의 반증된 가정("specific route 가 우선하므로 `/w/[slug]/...` 는 여기 오지 않는다") 정정 (INFO #3).
2. `href.ts` docstring 에 `buildWorkspaceHref` 비-idempotent 유지 근거 반영 (INFO #5).
3. catch-all forward 분기의 query/hash 보존을 테스트로 고정 (INFO #6).
4. `spec-update-catch-all-terminal-contract.md` draft 작성 → project-planner 위임 (INFO #4, plan checklist #10).

## 범위 밖 (project-planner 백로그)
- WARNING #1 `Workspace.settings.timezone` 표기 정정
- WARNING #2 `/api/executions/workflow/:workflowId` 규약 예외 등재
- INFO: Trigger manual 분류, `1-workflow-list.md` §2.3 시제 모순, `ExportWorkflowDto` 위치, `dashboard` 단수 명사 예외
