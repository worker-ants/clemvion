# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 스코프 정정 메모 (5개 checker 전원 독립 관측 — 교차 확인됨)

prompt 의 `target_path` 는 `spec/5-system/` 로 지정돼 있으나, 실제 `git diff origin/main...HEAD`
는 `spec/5-system/` 를 전혀 건드리지 않는다. 실 변경분은:

- `spec/conventions/swagger.md` (§3 DTO `description` 길이 규칙: 강제 → 지향 재구성 + 보안·정책
  캐비엇 "예외" → "지시" 프레이밍 전환 + `## Rationale` 2개 절 신설)
- `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (`input` 필드에
  `deprecated: true` 추가)
- `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts` (회귀 가드 신설)
- `plan/in-progress/swagger-decisions.md` (신규) · `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  (트래커 3항목 `[ ]` → `[x]`)

5개 checker(`cross_spec`, `rationale_continuity`, `convention_compliance`, `plan_coherence`,
`naming_collision`) 전원이 이 scope 불일치를 각자 실측(`git diff --stat`)으로 독립 확인하고,
실제 diff 기준으로 보정해 검토를 수행했다 — 오케스트레이터/라우터의 target_path 산정 로직에
재현 가능한 갭이 있을 수 있으나, 이번 검토 결과 자체를 무효화하지 않는다(모든 checker 가 공허
판정을 피하고 실제 변경분을 기준으로 실질 검토를 완료했음).

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. `rationale_continuity` 가 INFO 1건(인접 컨벤션의 유사 기각
전례 미인용)을 보고했고, 나머지 4개 checker 는 전부 NONE.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `deprecated`-만 표기 대안이 `cafe24-api-metadata.md` 의 유사(도메인은 다름) 기각 전례를 인용하지 않음 — 방향을 뒤집을 필요는 없으나, 차후 "rule of three" 판단 시 이 전례를 빠뜨리고 카운트할 위험 | `spec/conventions/swagger.md` `## Rationale` → `### §3 DTO 길이는 왜 강제가 아닌가` 마지막 문단 | 한 문장 추가: "`cafe24-api-metadata.md` 의 `label` 필드는 같은 대안을 기각했으나 내부 메타데이터라 breaking 비용이 작았기 때문 — `ExecuteWorkflowDto.input` 은 공개 wire 필드라 제거 대안이 애초에 없다" |
| 2 | convention_compliance | 검토 scope 헤더(`target_path=spec/5-system/`)가 실제 diff 범위와 불일치 — 재현되는 오케스트레이터 스코핑 갭 | prompt `## Target 문서` 섹션 | 반복되면 라우터의 target_path 산정 로직(3건 사용자 결정 → 대표 spec 영역 매핑)을 project-planner/오케스트레이터 턴에서 점검 |
| 3 | plan_coherence / cross_spec / naming_collision | 동일 scope 불일치를 각자 독립 관측(중복 보고, #2 와 동일 근본 원인) | 상동 | 상동 — 별도 조치 불요, #2 로 통합 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 실제 diff(swagger.md §3 재구성 + DTO `deprecated`)는 다른 spec 영역(데이터 모델·API 계약·RBAC·계층 책임)과 충돌 없음. 선행 `--spec` 라운드(`11_59_11`) WARNING 2건 + INFO 1건 전부 최종본에 반영 확인 |
| rationale_continuity | LOW | 기각된 대안 재도입·설계 원칙 위반 없음. `cafe24-api-metadata.md` 유사 전례 미인용은 INFO(방향 유지) |
| convention_compliance | NONE | `spec/5-system/**` 의 swagger.md 인용 지점(§1-3/§1-4/§2-1/§2-5/§5/§6)은 이번 개정 대상 밖이라 깨진 앵커·stale 인용 없음. 변경된 DTO 필드는 갱신된 §1/§3 패턴에 정확히 부합 |
| plan_coherence | NONE | 실제 diff 는 정본 트래커(`spec-sync-external-interaction-api-gaps.md`) 3개 항목과 1:1 대응, 다른 6개 관련 plan 과 충돌 없음. 트래커 체크박스 동기화도 diff 에 반영됨 |
| naming_collision | NONE | 신규 식별자 도입 없음. `input` 필드 동명이의는 리네임 대신 `deprecated` 플래그로 완화하는 방향(기존 충돌 보고를 악화시키지 않고 오히려 완화) |

## 권장 조치사항

1. (선택, 비차단) `spec/conventions/swagger.md` Rationale 에 `cafe24-api-metadata.md` 유사 전례
   인용 한 문장 추가 — INFO #1.
2. (선택, 비차단) 재현되는 target_path 스코핑 갭은 project-planner/오케스트레이터 턴에서
   라우터 로직 점검 — INFO #2/#3. 이번 PR 의 실질 판정에는 영향 없음(모든 checker 가 실제 diff
   기준으로 보정 검토를 완료했으므로 재검토 불요).