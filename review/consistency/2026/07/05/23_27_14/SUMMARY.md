# Consistency Check 통합 보고서 (G-1-remaining 전체 — 18 resource field mirror)

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — Cafe24 API 카탈로그 field-set 미러링. 구조적 충돌 없음. `4-cafe24.md` 예시 문서의 필드명 drift(WARNING) 1건 + INFO 다수(대부분 무관/기왕결정).

## Critical 위배
없음.

## 경고 (WARNING)

| # | Checker | 위배 | target | 제안 | 조치 |
|---|---------|------|--------|------|------|
| 1 | cross_spec | `4-cafe24.md` 예시가 이번 PR 로 코드에서 교체된 broken alias(`category_no`,`since`)를 여전히 인용 | `spec/4-nodes/4-integration/4-cafe24.md` §2(62·64행)·§5.1(180행) | `category_no`→`category`, `since`→`created_start_date` 로 예시 갱신 | **planner 위임** (spec/ read-only for developer) — spawn_task 등록 |

## 참고 (INFO) — 전부 본 PR 무관/기왕결정
- #1 EMAIL_HOST_BLOCKED 분류표 미등재 = 2-navigation/4-integration.md Rationale 기왕 기각결정 (조치 불요).
- #2 http-request §7 "35자" vs 0-common §5 "40자" drift (본 PR 무관, 별도).
- #3 http-request §5.3.2 deprecated 필드 legacy 레지스트리 미등재 (조치 불요).
- #4 신규 상수 `CAFE24_DATE_FIELD_CREATED/UPDATED_START/END` = 기존 SINCE/UNTIL 과 의미 분리, 충돌 없음.
- #5 metadata `path:` diff 라인 = 기존 path 재포맷+필드 추가, 신규 endpoint 아님.
- #6 `product-fields.spec.ts` 명명 컨벤션 준수.

## Checker별 위험도
| Checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | LOW | 4-cafe24.md 예시 구 필드명 drift 1건(WARNING) |
| rationale_continuity | (write-block 미기록) | docs 미러는 기각 대안 재도입 없음 — rationale 보존 |
| convention_compliance | LOW | INFO 3건(전부 기왕결정/무관) |
| plan_coherence | NONE | plan 대응 정상 |
| naming_collision | NONE | 신규 상수 의미 구분, 신규 endpoint/DTO 없음 |

## 권장 조치
1. WARNING #1 → project-planner 가 `4-cafe24.md` §2·§5.1 예시 필드명 동기화 (spawn_task 등록).
2. rationale_continuity write-block: docs-SoT 미러라 기각 대안 재도입/합의 위반 없음 — 관점상 무위험으로 판단.
