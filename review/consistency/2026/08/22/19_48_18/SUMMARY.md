# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 5개 checker 전원 실행/전문 확보 완료(CRITICAL 0건). `convention_compliance` 가 `re-run.dto.ts` Swagger description 의 SoT 링크 누락을 WARNING 1건으로 지적했고, 나머지 4개 checker(`cross_spec`/`rationale_continuity`/`plan_coherence`/`naming_collision`)는 전부 NONE.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `inputOverride` Swagger description 이 304자(~6문장)로 확장되면서 `spec/conventions/swagger.md` §3 "보안·정책 캐비엇 예외" 형식(요약 1~2문장 + SoT 링크)을 따르지 않음. 같은 diff 안의 `trigger-parameter.types.ts`/`resolve-trigger-parameters.ts` JSDoc 은 정확히 SoT 링크를 붙였는데 이 파일만 누락돼 같은 PR 내에서도 비일관 | `codebase/backend/src/modules/executions/dto/re-run.dto.ts` L18-26 | `spec/conventions/swagger.md` §3; 선례 `execution-response.dto.ts`, `spec/3-workflow-editor/3-execution.md` L90 | description 을 1~2문장 요약으로 줄이고 끝에 `SoT: spec/4-nodes/7-trigger/1-manual-trigger.md §6, spec/5-system/14-external-interaction-api.md §R17` 링크 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | 같은 catch 블록 인접 주석의 언어가 diff 이후에도 혼재(한국어 신규 vs 영어 잔존, 정식 규약 위반 아님) | `codebase/backend/src/modules/workflows/workflows.controller.ts` L314-335 | 필수는 아니나 잔여 영어 주석도 한국어화하면 diff 취지(cosmetic consistency)와 더 정합 |
| 2 | plan_coherence | 트래커 "마커 리터럴 산문 재기술 3곳" 항목이 미머지 PR #1194(`egress-masking.md` 신설)를 흡수처로 전제한 폴백 조건부 서술 상태 — 조치 불요, 참고 기록 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L825-834 | #1194 병합 여부와 무관하게 트래커 서술은 현재 정합 유지 중이므로 별도 조치 불요, 후속 라운드에서 #1194 머지 여부만 재확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | target(주석/JSDoc 한글화 + frontmatter 1줄)이 EIA §R17·데이터 모델·API 규약·webhook·error-handling 등 교차 spec 과 모순 없음. 실질 계약은 이전 PR(#1188~#1191)에서 이미 확정 |
| rationale_continuity | NONE | 4개 diff 파일 모두 기존 확립된 EIA §R17·manual-trigger.md §6 Rationale 을 코드 주석에 재진술할 뿐 새 결정·대안 재도입 없음 |
| convention_compliance | LOW | 에러 코드/마커 명명은 규약과 정확히 일치. `re-run.dto.ts` Swagger description 이 SoT-링크 예외 형식 미준수(WARNING 1건) + 주석 언어 국소 혼재(INFO 1건) |
| plan_coherence | NONE | target 이 정본 트래커가 이월해 온 코스메틱 4항목과 1:1 대응, 실측(diff/grep/git merge-base) 으로 뒷받침됨. 완료 plan ↔ in-progress 트래커 드리프트 없음 |
| naming_collision | NONE | 신규 식별자 도입 전무(주석/Swagger 설명/frontmatter cross-link 한 줄만 변경). 인용된 식별자(`MASKED_VALUE_RESUBMITTED` 등)는 origin/main 에 이미 존재함을 `git grep` 으로 확인 |

## 권장 조치사항
1. `re-run.dto.ts` 의 `inputOverride` Swagger description 을 1~2문장 요약 + SoT 링크(`spec/4-nodes/7-trigger/1-manual-trigger.md §6`, `spec/5-system/14-external-interaction-api.md §R17`) 형태로 축약 — `spec/conventions/swagger.md` §3 예외 형식 준수 및 같은 PR 내 일관성 확보.
2. (선택) `workflows.controller.ts` 의 잔여 영어 인라인 주석(L332-335)도 한국어화해 이번 cosmetic followup 취지를 완결.