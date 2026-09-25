# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, 전문 확보 완료)

## 전체 위험도
**LOW** — 신규 결정(경로 파라미터 워크스페이스 가드 + 가드 거부 오류 코드)은 기존 규약·spec·plan 과 정확히 정렬돼 있고, 발견된 것은 모두 "이미 착지한 결정의 전파 누락"류 WARNING/INFO 다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `9-user-profile.md` §3 "backend 인가 모델은 불변"이 target 이 신설한 카브아웃(경로 파라미터 워크스페이스 라우트는 예외)을 반영하지 않음 | `spec/data-flow/12-workspace.md` §Rationale "URL slug = FE 라우팅 SoT" (2026-09-25 갱신) | `spec/2-navigation/9-user-profile.md` §3 (159행, 미수정) — 같은 취지를 인용해 반복 서술 | 159행에 카브아웃 한 문장 미러링(앵커 포함). `developer` 는 `spec/` 직접 수정 권한이 없으므로(예고·트리거 문장 아님 — 제품 정의 카브아웃) 별도 `project-planner` 턴 필요 |
| 2 | rationale_continuity | `1-auth.md` §부트 캐너리 (b) 결론 문장("호출부에 아무것도 요구하지 않는다")이 같은 절 (a)와 달리 정정 없이 그대로 유지 | `spec/5-system/1-auth.md` §부트 캐너리 (b) 마지막 문장 | 같은 문서 (a)의 2026-09-25 갱신 및 `12-workspace.md` "`@WorkspaceParam`은 재기각된 «opt-in 마커»가 아니다" 문단의 "비대칭은 남는다" 인정 | (b) 끝에 `12-workspace.md`에서 이미 2회 실천한 각주 관행과 동형으로 "(2026-09-25 한정) 경로 파라미터 워크스페이스 라우트는 예외" 역방향 각주 추가 |
| 3 | convention_compliance | 신규 저장소 가드 `workspace-param-binding` 이 어떤 spec 의 `code:` frontmatter 에도 등재 계획이 없음 | `spec/data-flow/12-workspace.md` §Rationale + `plan/in-progress/workspace-path-guard-impl.md` 구현 요구 4 | `spec/conventions/spec-impl-evidence.md` §2.1/§4 (`spec-code-paths.test.ts`는 glob 매치 "존재"만 검사 — stale/미등재 glob 은 검출 못함) | 구현 PR 에서 가드 파일 경로를 `1-auth.md` `code:` 리스트에 추가. plan 체크리스트에 "frontmatter `code:` 등재" 항목 명시 |
| 4 | plan_coherence | `spec_impact` 가 같은 커밋(`e2e257707`)이 실제 변경한 9개 spec 중 3개만 등재 — `13-replay-rerun.md`·`swagger.md`·`error-codes.md`·`2-api-convention.md`·`6-config.md`·`9-user-profile.md` 6개 누락 | `plan/in-progress/workspace-path-guard-impl.md` frontmatter `spec_impact` | `git show e2e257707 --stat` 실측 — 특히 `13-replay-rerun.md` 회귀 잠금 표가 이미 갱신됨 | `spec_impact` 에 최소 `13-replay-rerun.md`·`swagger.md` 추가하거나, `--impl-done` 을 그 파일들이 포함되는 scope 로 별도 실행하도록 plan 체크리스트에 명시 |
| 5 | naming_collision | 신규 repo-guard 명 `workspace-param-binding` 이 같은 디렉터리 기존 `workspace-roles-attachment.spec.ts` 와 이름이 근접 — 의미공간(workspace + RolesGuard reflection)이 겹쳐 혼동 소지 | `plan/in-progress/workspace-path-guard-impl.md` 구현 요구 4 / `plan/complete/spec-draft-workspace-path-guard.md:271` | `codebase/backend/src/repo-guards/__tests__/workspace-roles-attachment.spec.ts` (기존) | 신규 파일 상단 docstring 에 두 가드의 경계 명시, 또는 더 구분되는 이름(예: `workspace-path-param-name-guard`) 검토 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `error-codes.md` §5 가 다루는 "rename 이력" 범위 기준(발행 이력 없는 spec-drift 항목은 §5 대상 아님)이 §5 서술에 명문화돼 있지 않음 | `spec/conventions/error-codes.md` §3(`forbidden` 제거)·§5 | §5 머리말에 "실제 발행 이력 없이 §3 에만 잘못 등재됐던 항목은 §5 대상이 아니다"는 한 줄 추가해 선례로 남김 |
| 2 | convention_compliance | 이번 `_prompts/convention_compliance.md` 번들이 `spec/conventions/**` 대부분(20여개)을 예산 초과로 절단 — 저장소 원본 직접 대조로 보완했으나 harness 레벨 관찰 | N/A (harness 조립 산출물) | 대상 외 — orchestrator/harness 조립 로직 조정 사안 |
| 3 | plan_coherence | `nestjs-v12-coordinated-upgrade.md` §C 캐너리 기준값(142)이 이 구현(`@WorkspaceParam` 소비를 캐너리 집합에 추가)으로 곧 stale — 갱신 책임은 이미 이 plan 요구 1 에 있음 | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C | `workspace-path-guard-impl.md` 착지 시 §C 표의 142 를 실측치로 실제 갱신 (결정 충돌 아님, 이행 여부만 확인) |
| 4 | naming_collision | 가드 레벨 에러 코드(`NOT_A_MEMBER`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)가 기존 서비스 레이어와 같은 의미로 재사용됨을 확인 — 의도된 통합이지 충돌 아님. 가드/서비스 이중 발행 경로는 이미 plan 요구 7 에 e2e 고정 명시됨 | `spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드" | 없음 — 기록 목적 확인만 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `9-user-profile.md` §3 가 신규 카브아웃 미반영(WARNING 1건). RBAC 역할 분배·오류 코드 카탈로그·앵커는 실코드와 정확히 일치 |
| rationale_continuity | LOW | `1-auth.md` §부트 캐너리 (b) 가 (a)와 달리 정정 안 됨(WARNING 1건) + `error-codes.md` §5 경계 미문서화(INFO). 3라운드 `--spec` 을 거친 핵심 우려(opt-in 마커 재기각)는 이미 해소됨 |
| convention_compliance | LOW | `workspace-param-binding` 가드 미등재(WARNING 1건, spec-impl-evidence.md 위반) + 번들 conventions 절단(INFO). 명명·출력포맷·swagger 체크리스트는 규약 정렬 |
| plan_coherence | LOW | `spec_impact` 가 실제 변경 9개 중 6개 누락(WARNING 1건) + nestjs-v12 캐너리 기준값 stale 예정(INFO). 진행 중 plan 과의 결정 충돌은 없음 |
| naming_collision | LOW | 신규 repo-guard 명이 기존 가드와 근접(WARNING 1건). 신규 식별자(`@WorkspaceParam`·`EDITOR_REQUIRED`) 전수 grep 결과 실질 충돌 없음 |

## 권장 조치사항

1. `plan/in-progress/workspace-path-guard-impl.md` `spec_impact` 에 `spec/5-system/13-replay-rerun.md`·`spec/conventions/swagger.md` 를 추가하거나, `--impl-done` scope 에 명시 (plan_coherence #4).
2. 구현 PR 에서 `workspace-param-binding` 가드 파일을 `1-auth.md` `code:` frontmatter 에 등재 (convention_compliance #3).
3. `project-planner` 턴에서 `9-user-profile.md` §3 에 카브아웃 미러링 각주 + `1-auth.md` §부트 캐너리 (b)에 역방향 각주 추가 (cross_spec #1, rationale_continuity #2) — 두 항목 모두 `spec/` 수정이 필요해 한 planner 턴에 묶어 처리 가능.
4. 신규 repo-guard 파일에 `workspace-roles-attachment.spec.ts` 와의 경계를 명시하는 docstring 추가, 또는 더 구분되는 이름 채택 (naming_collision #5).
5. (선택) `workspace-path-guard-impl.md` 착지 시 `nestjs-v12-coordinated-upgrade.md` §C 캐너리 기준값 142 를 실측 갱신 (plan_coherence INFO #3, 이미 plan 책임에 포함).
