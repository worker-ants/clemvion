# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전부 CRITICAL 없음. 전문 확보 실패한 checker 없음(5/5 success, 인라인 전문 모두 확보).

## 전체 위험도
**LOW** — spec 변경 없는(`spec_impact: none`) 코드 전용 수정(`ModelConfigService.remove()` 동시 DELETE 중복 감사 제거, 형제 4건과 동일 패턴). CRITICAL/WARNING 급 충돌 없음. 유일한 WARNING 은 별도 트래커 문서의 위치 열거 갱신 누락(비차단, 실행 시점에 반영 예정).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 옴니버스 추적 항목("삭제 엔드포인트 spec 서술 누락")의 위치 열거가 이 fix 착지 뒤 stale 해짐 | `spec/2-navigation/6-config.md` §Model Config API (`DELETE /api/model-configs/:id`) | `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미해결 항목 위치 열거(현재 `6-config.md §A` auth-configs 행만 등재, model-configs 행 미등재) | `modelconfig-dup-delete.md` 체크리스트 집행 시 그 트래커 항목 열거에 `6-config.md §Model Config API (DELETE /api/model-configs/:id)` 추가. 형제 PR 5건이 매번 이 열거를 재확장해 온 것과 같은 절차 — 문서 본문 갱신 자체는 정책대로 계속 유예 가능, 열거 누락만 방지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "무락 삭제 + 원자적 DELETE affected 판정" 패턴이 8번째 반복 중인데 `spec/conventions/` 에 명문화되지 않음 | (부재, 해당 문서 없음) | 9번째(WebAuthn credential, plan 예고) 완료 후 `spec/conventions/` 에 짧은 패턴 문서화 검토. 이번 PR 범위 아님 |
| 2 | rationale_continuity | `MODEL_CONFIG_NOT_FOUND` 유지 결정(형제들의 `RESOURCE_NOT_FOUND` 미채택)이 `spec/5-system/3-error-handling.md` §1.9 기존 도메인 distinctive 코드 원칙과 정합 | `plan/in-progress/modelconfig-dup-delete.md` §C | 조치 불요. 커밋 메시지에 형제 패턴과 다른 이유 기록 계획 유지 |
| 3 | rationale_continuity | 진 쪽에서 `notifyInvalidated` 스킵은 캐시 무효화 발화 보장 계약이 애초에 spec 에 없어 위반 아님 | plan §B | 조치 불요 |
| 4 | convention_compliance | `14-execution-history.md:479` 날짜 없는 bare 리뷰 인용(`10_53_52`) — `review-citations.md` §2·§3 위반이나 §4 grandfather 조항으로 소급 정리 대상 아님, 이번 plan 도 그 파일 미변경 | `spec/2-navigation/14-execution-history.md:479` | 이번 PR 범위 밖. 다음에 그 절 인근 수정 시 날짜 채울 것 |
| 5 | convention_compliance | `6-config.md` 만 인라인 `## Overview (제품 정의)` 헤딩 보유 — 다중 파일 영역은 `_product-overview.md` 로 분리하는 게 정칙(SKILL.md), 형제 3파일은 미보유 | `spec/2-navigation/6-config.md:21` | 순수 표기 일관성 문제, 차단 사유 아님. 다음 편집 시 헤딩명 변경 또는 SKILL.md 예외 명문화 검토 |
| 6 | plan_coherence | `spec/5-system/8-embedding-pipeline.md` 의 `pending_plans`(`update-returning-tuple-shape.md`)가 같은 서비스 파일을 지목하지만 결함 클래스(raw `.query()` 튜플 오독 vs Repository `.delete().affected`)가 구조적으로 무관 | `spec/5-system/8-embedding-pipeline.md` frontmatter | 조치 불요. 실측 기록에 "이 fix 는 Repository API 를 쓰며 해당 plan 과 무관" 한 줄 남기면 향후 재확인 비용 감소 |
| 7 | naming_collision | 신규 식별자 도입 없음 — 재사용 4건(`MODEL_CONFIG_NOT_FOUND`·`model_config.delete`·`DELETE /api/model-configs/:id`·`notFound()`) 전부 기존 정의와 정확히 일치, 충돌 없음 | 다수(`spec/5-system/1-auth.md:433`, `spec/5-system/3-error-handling.md:85`, `spec/data-flow/1-audit.md:103`, `spec/2-navigation/6-config.md:284`) | 조치 불요 |
| 8 | naming_collision | 미생성 e2e 파일명(`model-config-delete-concurrency.e2e-spec.ts` 예상)이 형제 4건 명명 규칙 따르면 충돌 없음. 다만 형제 파일들처럼 어떤 spec 의 `code:` 에도 등재 안 될 기존 갭 반복(신규 충돌 아님) | `codebase/backend/test/` (미생성) | 파일명 그대로 진행 가능. `code:` 등재 갭은 별도 트래커 사안, 이 plan 책임 범위 밖 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 감사 액션명·404 코드·RBAC·FK cascade·락 설계 부재·캐시 무효화 계약 6항목 교차검증 전부 정합. INFO 1건(패턴 미문서화) |
| rationale_continuity | NONE | 기존 spec Rationale(§1.9 등)과 plan 결정(404 코드 유지, 캐시통지 스킵) 충돌 없음. INFO 2건 |
| convention_compliance | LOW | 명명·시크릿 마스킹·Swagger DTO·감사 액션 전부 준수. INFO 2건(둘 다 이번 스코프 밖 기존 상태) |
| plan_coherence | LOW | WARNING 1건(옴니버스 트래커 위치 열거 stale 화 예정 — 형제 5건이 매번 겪은 패턴), INFO 1건(무관 pending_plans) |
| naming_collision | NONE | 신규 식별자 없음, 전부 기존 정의 재사용 확인. INFO 2건 |

## 권장 조치사항
1. (비차단) `modelconfig-dup-delete.md` 체크리스트 실행 시 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 옴니버스 항목 위치 열거에 `spec/2-navigation/6-config.md §Model Config API (DELETE /api/model-configs/:id)` 추가 — 형제 PR 5건이 매번 반복해 온 재확장 절차.
2. (선택) 구현 커밋에 "이 fix 는 `DeleteResult.affected` 경로를 쓰며 `update-returning-tuple-shape.md` 의 raw `.query()` 튜플 결함 클래스와 무관" 한 줄 기록 — 향후 재확인 비용 절감.
3. (이번 PR 범위 아님) 반복되는 무락 삭제 패턴의 convention 문서화, `14-execution-history.md` bare 인용 날짜 보완, `6-config.md` Overview 헤딩 표기 정리는 각각 소유 트래커/다음 편집 시점으로 유예.
