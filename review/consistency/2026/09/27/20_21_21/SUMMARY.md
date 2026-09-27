# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건. 근본 원인이 `spec/` 문서 내용이라 호출자(developer, `--impl-prep`) 권한 밖 → 아래 §planner 인계 참고. 등급 하향 없이 BLOCK 유지.

## 전체 위험도
**HIGH** — 신규 서술 표면이 `pending_plans` 미등재 + 존재하지 않는 완료 plan 경로를 완료형으로 인용(실제로는 미구현). 그 외 축은 LOW~NONE.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance (plan_coherence 가 동일 근본 원인을 WARNING 으로 교차 지적, 강한 등급으로 통합) | 새로 서술한 폴더/워크플로 생성 소속 검사(`folderId`/`parentId` 400 `VALIDATION_ERROR`)가 실제로는 전혀 미구현(`workflows.service.ts` create/update 는 `folderId` 검증 없이 저장, `folders.service.ts` `getDepth` 는 타 워크스페이스 부모를 "없음"으로 읽어 통과)인데, frontmatter `pending_plans:` 에 책임 plan 이 없고 Rationale 이 존재하지 않는 `plan/complete/cross-workspace-refs.md` 를 "더했다"(완료형)로 인용해 이미 고쳐진 것처럼 서술 | `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` + §3 Rationale "(2026-09-27 정정)" 문단 | `spec/conventions/spec-impl-evidence.md` §2.1/R-5 (status: partial 문서의 미구현 surface 는 반드시 `pending_plans` 로 추적) + 실제 코드(위 경로) | `pending_plans:` 에 `plan/in-progress/cross-workspace-refs.md` 추가. Rationale 의 경로를 `plan/in-progress/cross-workspace-refs.md` 로 정정하고 시제를 "더한다"/"추가할 예정" 등 미완료형으로 낮추거나, 구현·`--impl-done` 통과 후 확정 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 `spec/2-navigation/1-workflow-list.md` 본문·frontmatter 를 직접 고쳐야 해소되는데, `spec/**` 쓰기는 project-planner 전속 권한이다. 자기-반증형 소정정 예외(§CLAUDE.md)도 조건 1(대상 문장을 developer 자신이 그 문서에 썼음)을 충족하지 못한다 — 해당 문장은 planner 턴 커밋 `a8bfd1492`(docs(spec))이 작성했다. 등급은 CRITICAL, `BLOCK: YES` 그대로 유지된다 — 아래는 우회가 아니라 다음 행동 지정이다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | 대상 문장이 `spec/2-navigation/1-workflow-list.md` frontmatter·본문(§3 Rationale)에 있고, `spec/**` 는 project-planner 전속 쓰기 권한. developer 자기-반증 예외 조건1 미충족(그 문장을 developer 가 쓰지 않음 — planner 턴 커밋 `a8bfd1492` 작성) | project-planner | (1) frontmatter `pending_plans:` 에 `plan/in-progress/cross-workspace-refs.md` 추가. (2) §3 Rationale "(2026-09-27 정정)" 문단의 `` `plan/complete/cross-workspace-refs.md` `` → `` `plan/in-progress/cross-workspace-refs.md` `` 로 경로 정정 + "더했다"(완료형)를 미완료 시제로 낮추거나 구현 완료 후 확정. (3) 가능하면 같은 턴에 §3/§3.1 신규 서술에 기존 "(Planned)" 라벨 관례(§2.1/§2.7/§3.2) 부기(WARNING #1과 동일 근본) | `plan/in-progress/cross-workspace-refs.md` (구현 트래커, 체크리스트 미완료) · `review/consistency/2026/09/27/20_21_21/convention_compliance.md` · `plan_coherence.md` |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 신규 서술(§3/§3.1 folderId/parentId 소속 검사)이 같은 문서가 이미 쓰고 있는 "**미구현 (Planned)**" 라벨 관례를 따르지 않음 | `spec/2-navigation/1-workflow-list.md` §3 `POST/PATCH /api/workflows` 행, §3.1 `POST /api/folders` 행 | 같은 문서 §2.1·§2.7·§3.2 기존 "Planned" 라벨 관례 | "(Planned — `plan/in-progress/cross-workspace-refs.md`)" 라벨 부기, 또는 spec 갱신과 코드 구현을 같은 커밋으로 묶기. Critical #1 처리 시 planner 가 함께 반영 권장 |
| 2 | convention_compliance | `details[].field='parentId' (생성과 같은 형태)` 서술이 실제 구현과 불일치 — POST 는 검사 자체 없음, PATCH(`validateParentChange`)는 검사는 있으나 `details` 미포함 | `spec/2-navigation/1-workflow-list.md` §3.1 `PATCH /api/folders/:id` 행 | `spec/1-data-model.md` §1.1 (SoT 응답 형태) vs `codebase/backend/src/modules/folders/folders.service.ts` `validateParentChange` | 구현 plan 에 "PATCH 의 기존 `validateParentChange` 도 `details: [{ field: 'parentId', message, code: 'INVALID_FIELD' }]` 형태로 함께 갱신" 을 명시 |
| 3 | cross_spec | plan 이 스스로 최우선(X)으로 분류한 트리거·스케줄 `workflowId` 소속 검사가 `2-trigger-list.md`/`3-schedule.md` 본문에 반영되지 않았고 plan `spec_impact` 목록에도 없음 | `spec/2-navigation/2-trigger-list.md` §3·§2.5, `spec/2-navigation/3-schedule.md` §4·§2.2 | `spec/1-data-model.md` §1.1, §2.8, §2.9 | `1-workflow-list.md` 의 `folderId` 서술과 동일 패턴("같은 워크스페이스의 워크플로만 — 아니면 400 `VALIDATION_ERROR`, [데이터 모델 §1.1]") 추가, 또는 최소 `plan/in-progress/cross-workspace-refs.md` `spec_impact` 에 두 파일 등재 |
| 4 | plan_coherence | Critical #1 과 같은 오기(존재하지 않는 `plan/complete/cross-workspace-refs.md`)를 트래커가 "닫음"으로 인용 — `plan/**` 이라 developer 가 직접 수정 가능(planner 인계 불필요) | `plan/in-progress/spec-draft-nullable-notation-followups.md:1483,1489` | 실제 plan `plan/in-progress/cross-workspace-refs.md` (구현 미완료) | 경로를 `plan/in-progress/cross-workspace-refs.md` 로 정정하고, 실제 구현·리뷰·`--impl-done` 통과 후에 "닫음"으로 표시(그 전엔 "진행 중" 정도로) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `9-user-profile.md` 알림 규칙 `POST /api/alerts` 의 `workflowId?` (plan "(D) 끊긴 참조" 목록)도 §1.1 소속 검사 서술이 아직 없음 | `spec/2-navigation/9-user-profile.md` | WARNING #3 과 같은 패턴의 후속 동기화 대상으로 묶어 처리 |
| 2 | convention_compliance | Critical #1 의 plan 경로 인용이 backtick 코드 텍스트일 뿐 실제 마크다운 링크가 아니어서 `spec-link-integrity.test.ts` 가드가 존재하지 않는 경로를 못 잡음 | `1-workflow-list.md` §3 Rationale | `[plan/in-progress/cross-workspace-refs.md](../../plan/in-progress/cross-workspace-refs.md)` 형태의 실제 링크로 전환하면 향후 drift 를 build 가드가 잡음 |
| 3 | rationale_continuity | `--impl-prep` 번들이 `4-integration.md`(168KB) 하나에 예산을 소진해 `6-config.md`·`5-knowledge-base.md`·`9-user-profile.md` 등 §1.1 이 직접 언급하는 파일 포함 15개가 생략(저장소 기존 교훈 `feedback_consistency_spec_mode_budget` 과 동일 부류 재발). 이번 세션은 직접 Read 로 보완해 충돌 없음을 확인 | `_prompts/rationale_continuity.md` 조립 결과 | `--spec`/`--impl-prep` 번들 예산 산정 시 target 의 `spec_impact` 나열 경로 우선 포함, 또는 파일별 상한 검토(파이프라인 개선 과제, 비차단) |
| 4 | convention_compliance | 에러 코드(`VALIDATION_ERROR`/`INVALID_FIELD`/`MODEL_CONFIG_NOT_FOUND`/`AUTH_CONFIG_NOT_FOUND`) 명명·재사용, `details[].field=` 배열 표기는 규약(`spec/conventions/error-codes.md`) 준수 확인 | 다수 | 조치 불요 (긍정 확인) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 직전 라운드 Critical 2건은 `spec/1-data-model.md` §1.1 신설로 해소. 신규 WARNING: 트리거·스케줄 `workflowId` 소속 검사가 nav 문서에 미반영 |
| rationale_continuity | NONE | 위반 사례 없음. 번들 예산이 인접 파일을 떨구는 문제 재발(INFO, 직접 보완해 충돌 없음 확인) |
| convention_compliance | HIGH | CRITICAL: `pending_plans` 미등재 + 존재하지 않는 완료 plan 경로를 완료형으로 인용(실제 미구현). WARNING 2건(Planned 라벨 누락, details 형태 불일치) |
| plan_coherence | MEDIUM | 동일 dead plan path 인용이 spec(Critical #1 과 병합)과 tracker(WARNING #4, developer 직접 수정 가능) 양쪽에 존재 |
| naming_collision | NONE | 신규 식별자·엔드포인트·에러코드 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소, planner 턴 필요) `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` 에 `plan/in-progress/cross-workspace-refs.md` 추가 + §3 Rationale "(2026-09-27 정정)" 문단의 `plan/complete/cross-workspace-refs.md` → `plan/in-progress/cross-workspace-refs.md` 로 경로 정정, 완료 시제("더했다")를 미완료 시제로 낮추거나 구현 완료 후 확정.
2. (같은 planner 턴에 병행 권장) §3/§3.1 신규 서술에 기존 "(Planned)" 라벨 부기, `details[].field='parentId'` 서술이 실제 구현(PATCH `validateParentChange`)과 맞도록 구현 plan 에 명시.
3. (developer 즉시 가능, planner 불요) `plan/in-progress/spec-draft-nullable-notation-followups.md:1483,1489` 트래커의 "닫음" 인용 경로를 `plan/in-progress/cross-workspace-refs.md` 로 정정하고, 실제 구현·리뷰·`--impl-done` 통과 후 재표시.
4. (구현 plan 확장) 트리거·스케줄 `workflowId` 소속 검사를 `2-trigger-list.md`/`3-schedule.md` 에 반영하거나, 최소 `plan/in-progress/cross-workspace-refs.md` 의 `spec_impact` 에 두 파일 등재.
5. (경미) Rationale 의 plan 경로 인용을 실제 마크다운 링크로 전환해 `spec-link-integrity.test.ts` 가드 적용을 받게 할 것.