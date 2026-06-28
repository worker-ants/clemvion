# Consistency Check 통합 보고서 (impl-prep)

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능. WARNING 2건은 아래 처리 방침 참조.

## 전체 위험도
**MEDIUM** — google `autoRefresh=true`(§9.1) vs §11.1 `isRefreshCapable` 누락 비대칭(기존 spec 정책 공백). backend 구현 방식(SQL 하드코딩) 선택 시 Rationale 위반 경로 존재.

## Critical 위배 (BLOCK 사유)
해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | 위치 | 처리 방침 |
|---|---------|------|------|-----------|
| W-1 | Cross-Spec | google `autoRefresh=true`(§9.1, UI 무음) vs `isRefreshCapable=false`(§11.1, 스캐너 알림·격하) 모순 | spec §9.1/§11.1/§11.4 | **본 PR 범위 밖 / project-planner 위임** — 기존 spec 간 정책 공백이며 본 변경이 신규 유발하지 않음. `computeStatus`(badge)가 이미 동일 `autoRefresh` 술어로 google 을 무음 처리 중이라, 본 변경은 attention 카운트를 badge 와 **정합**시킬 뿐 새 모순을 노출하지 않음. google 의 §9.1↔§11.1 분류 정합은 별도 spec 결정 |
| W-2 | Rationale Continuity | backend `service_type IN (...)` 리터럴 하드코딩 시 "왜 derived 필드인가" Rationale 위반 | service.ts L493-514 | **준수** — `SERVICE_REGISTRY` 의 `supportsTokenAutoRefresh===true` 동적 조회 → `NOT IN (:...autoRefreshTypes)` 파라미터 바인딩으로 구현 |

## 참고 (INFO) — 처리
- **I-2 / I-3 / I-7 (구현 범위 내, 본 PR 처리)**: subLabel `"Auto-renews · next in"` 정합(§4.1) + `needsAttention` 가드(`!autoRefresh`) + TODO 제거 + 관련 i18n/주석 일괄.
- **I-1 / I-4 / I-5 / I-6 (spec/ 문서, project-planner 위임)**: Rationale l.1194 stale(`makeshop` 누락), §4.1 i18n 키·KO 문구 미명시, §9.1↔§11.1 google 비대칭 SoT 명문화 — developer 가 spec/ 을 쓰지 않으므로 W-1 과 함께 후속 spec PR 로 이관.
- **I-8**: `supportsTokenAutoRefresh` 명명 충돌 없음 (변경 불필요).

## Checker별 위험도
| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | MEDIUM | google §9.1↔§11.1 비대칭 (W-1, 기존 공백) |
| Rationale Continuity | LOW | SQL 하드코딩 금지(W-2, 준수 예정); frontend/subLabel 방향 일치 |
| Convention Compliance | LOW | i18n 키 미명시·google 비대칭 INFO |
| Plan Coherence | LOW | 충돌 plan 없음 |
| Naming Collision | LOW | 신규 식별자 충돌 없음 |

## 결론
BLOCK: NO. 구현은 §2.3/§2.4/§9.1/§11.4 의 `autoRefresh` 술어를 충실히 반영(W-2 준수). W-1 및 spec 문서 INFO(I-1/I-4/I-5/I-6)는 본 PR(코드)과 분리해 project-planner 후속으로 이관.
