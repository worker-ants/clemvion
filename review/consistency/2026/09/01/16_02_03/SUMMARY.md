# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — CRITICAL 없음. `_product-overview.md`(NF-OB-07)의 "resource_type 실측 12종" 주장이 코드 전수 확인 결과 실제로는 10종으로, 4개 문서에 동일 오기산이 전파되어 있다(WARNING). 나머지 관점(데이터 모델·요구사항 ID·RBAC·계층 책임·Rationale 연속성·명명 충돌·plan 정합성)은 전부 NONE.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | "resource_type 실측 12종" 주장이 실제 값(10종)과 불일치 — `AuditLogsService.record()`/`recordAudit()` 호출부는 12개 **파일**이지만 distinct `resourceType` 값은 10개(`user`/`trigger`/`workflow`/`schedule`/`member`/`workspace`/`integration`/`model_config`/`auth_config`/`execution`). 파일 수와 라벨 distinct 값 수를 혼동한 것으로 보임 | `spec/5-system/_product-overview.md` §5 NF-OB-07 카탈로그 표, `clemvion.audit.write_failed` 행 | `spec/conventions/audit-actions.md` §3 레지스트리 표(10개), `spec/5-system/1-auth.md §4.1` 표(동일 10개) — 두 정식 카탈로그 모두 10을 가리킴 | "실측 12종"→"실측 10종"으로 정정. 같은 오기산이 반복된 3곳(`business-metrics.service.ts:174` JSDoc, `plan/in-progress/spec-sync-auth-gaps.md`, `plan/complete/spec-draft-audit-write-failed-metric.md:48,122`)도 함께 정정하고, 카운트 근거(10종 목록)를 각주로 남겨 재발 방지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `plan/in-progress/spec-sync-auth-gaps.md` 의 "17개 감사 producer"와 spec 의 "실측 12(→실제 10)종"은 서로 다른 단위(호출 지점 수 vs distinct resourceType 값 수)라 형식상 모순은 아니지만 혼동 소지가 있음 | `plan/in-progress/spec-sync-auth-gaps.md` | 비차단. 정정 작업(WARNING #1) 시 단위 혼동 방지용 각주를 함께 고려 |
| 2 | plan_coherence | 신설된 `repo-guards/__tests__/audit-action-binding-{guard,fixture}.ts` 로 `*-guard.ts` 패턴이 6쌍으로 누적(기존 5쌍+1). 소유 규약 문서 신설 검토는 `plan/in-progress/spec-conventions-engine-error-code-surface.md` 가 이미 "독립·별도 결정"으로 명시 분리해 둔 사안 | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-*.ts` | 이번 PR 조치 불요. 해당 plan 담당자가 카운트만 실측 갱신하면 됨 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터 모델(12→실제 10종 라벨 서술은 별개 checker가 지적)·요구사항 ID·RBAC·계층 책임·상태 전이 전 관점에서 모순 없음. plan 단위 혼동 1건만 참고 기록 |
| rationale_continuity | NONE | 직전 `--spec` 라운드 WARNING(원칙-예외 교차 참조 누락)이 이번 diff 로 실제 해소됨을 확인. swallow 계약·action union 강제 원칙 모두 유지·강화 방향, 무근거 번복 없음 |
| convention_compliance | LOW | "실측 12종" 주장이 실제 10종과 불일치(WARNING). 명명·포맷·API 문서·금지 항목 규약은 전부 준수 |
| plan_coherence | LOW | `spec-sync-auth-gaps.md` 항목과 이번 PR 이 정합적으로 동기화됨. repo-guard 패턴 누적 카운트 갱신 필요성만 INFO로 기록(비차단) |
| naming_collision | NONE | 신규 식별자(메트릭명·라벨·TS 심볼·파일 경로) 전수 grep, 기존 사용처와 의미 충돌 없음 |

## 권장 조치사항
1. `spec/5-system/_product-overview.md` NF-OB-07 표의 "resource_type 실측 12종"을 "실측 10종"으로 정정 (근거: `user`/`trigger`/`workflow`/`schedule`/`member`/`workspace`/`integration`/`model_config`/`auth_config`/`execution` 10개 distinct 값 — `audit-actions.md` §3, `1-auth.md §4.1` 레지스트리와도 일치)
2. 동일 오기산이 전파된 3곳도 함께 정정: `codebase/backend/src/modules/metrics/business-metrics.service.ts:174`(JSDoc), `plan/in-progress/spec-sync-auth-gaps.md`, `plan/complete/spec-draft-audit-write-failed-metric.md:48,122`
3. (선택, 비차단) `plan/in-progress/spec-conventions-engine-error-code-surface.md` 의 repo-guard 패턴 누적 카운트("5쌍")를 이번에 추가된 `audit-action-binding-*` 세트를 반영해 "6쌍"으로 갱신 — 담당자 재량, 이번 PR 범위 아님
4. (선택, 비차단) `plan/in-progress/spec-sync-auth-gaps.md` 의 "17개 감사 producer" 표현에 단위(호출 파일 수 ≠ distinct resourceType 값 수) 각주 추가 고려
