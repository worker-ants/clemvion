# Consistency Check 통합 보고서

**BLOCK: NO**

## 전체 위험도
**LOW** — 5개 checker 전원이 CRITICAL/WARNING 급 위반 없음으로 판정. INFO 등급 관찰 7건만 존재하며 전부 비차단.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "멤버 관리" 용어가 두 RBAC 표에서 다른 스코프(목록조회 vs mutation 액션)로 재사용되어 표만 diff 하면 R↔❌ 충돌로 오독 가능 | `spec/5-system/1-auth.md §3.2` ↔ `spec/2-navigation/9-user-profile.md §4.2` | 다음 편집 시 `9-user-profile.md §4.2` 행 레이블을 "멤버 관리 (초대/역할변경/제거)" 로 좁히거나 `1-auth.md §3.2` 에 각주 추가. 지금 당장 필수 아님 |
| 2 | convention_compliance | bare `hh_mm_ss` 리뷰 인용(날짜 없음) — `review-citations.md §2` 위반이나 §4 grandfather 조항 대상 | `spec/5-system/1-auth.md` L545 (`#1245`) · `3-error-handling.md` L598 (`#1247`) | 다음에 해당 Rationale 블록을 건드릴 때 날짜 특정 또는 전체 `review/**` 경로로 승격. 소급 수정 불요 |
| 3 | convention_compliance | `## Overview` 헤딩이 폴더 내 다른 문서(`## Overview (제품 정의)`)와 표기 불일치 | `spec/5-system/1-auth.md` L27, `3-error-handling.md` L19 (`4-execution-engine.md`도 동일) | 다음에 해당 섹션 편집 시 `## Overview (제품 정의)` 로 통일. 강제 아님 |
| 4 | convention_compliance | `2-api-convention.md §5.4` 가 인용하는 `swagger.md §1-3` 이 실제 근거(닫힌 union `null` vs 키-생략 판정 예시)가 있는 §1-4 보다 한 단계 앞을 가리킴 | `spec/5-system/2-api-convention.md §5.4` → `spec/conventions/swagger.md#1-3` | 인용을 `#1-4-nested--enum--union` 로 갱신(또는 §1-3·§1-4 병기) |
| 5 | rationale_continuity | B-4(`listMembers` 쿼리 레벨 투영)는 `data-model.md` Rationale 이 기각한 "엔티티 전역 `select:false`" 와 범위가 다름을 커밋/PR 본문에 명시 권장 | `plan/in-progress/spec-followups-batch-b.md` B-4 / `workspaces.service.ts listMembers` | 구현 커밋 메시지에 "쿼리 레벨 투영 ≠ 엔티티 전역 select:false" 구분을 한 줄 남겨 다음 사람의 오독 방지 |
| 6 | naming_collision | B-6/B-7(트리거 `endpointPath` AST 가드, 409 e2e)의 신규 파일명이 아직 미확정 | `plan/in-progress/spec-followups-batch-b.md` B-6/B-7 | 구현 시 가드는 `src/repo-guards/__tests__/*-guard.ts`, e2e 는 기존 `*-trigger*.e2e-spec.ts` 군과 구분되는 이름(예: `trigger-endpoint-path-conflict.e2e-spec.ts`) 사용 |
| 7 | plan_coherence | (확인용 메모, 조치 불요) B-1~B-8이 `spec-draft-nullable-notation-followups.md`의 developer/harness 8항목과 1:1 대응하며 선행조건(§5.4/§5.3/§1.10)이 이미 충족됨을 확인 | `plan/in-progress/spec-followups-batch-b.md` ↔ `spec-draft-nullable-notation-followups.md` | 조치 불요 — 정합 확인 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | RBAC/에러 카탈로그/데이터 모델 앵커/상태 토글 패턴 전부 정합. "멤버 관리" 용어 중복 스코프 INFO 1건 |
| rationale_continuity | NONE | B-1~B-8 전부 5-system Rationale과 충돌 없음. B-4/B-6/B-7은 기존 결정의 연장, B-3은 뒤집을 선행 Rationale 부재, B-8은 기존 선례와 같은 결 |
| convention_compliance | LOW | error-codes/node-output/swagger/audit-actions 규약 고밀도 준수. bare 인용(grandfathered)·Overview 헤딩 표기·§5.4 인용 정밀도 INFO 3건 |
| plan_coherence | NONE | target과 진행 plan(B-1~B-8) 간 미해결 결정 충돌·선행 plan 미해소·후속 누락 없음 |
| naming_collision | NONE | 신규 spec 식별자 도입 없음. B-8 개명은 기존 문서화된 충돌 해소 방향. B-6/B-7 파일명 미확정 INFO 1건 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — BLOCK: NO)
2. B-4 구현 커밋 본문에 "쿼리 레벨 투영 ≠ 엔티티 전역 select:false" 구분을 한 줄 명시 (rationale_continuity INFO #5)
3. B-6/B-7 신규 파일 작성 시 기존 트리거 e2e/가드 네이밍 컨벤션과 구분되는 이름 사용 (naming_collision INFO #6)
4. 다음에 `1-auth.md`/`3-error-handling.md`/`9-user-profile.md` 해당 섹션을 편집할 기회가 있을 때 위 INFO #1~#4 (용어 스코프 명확화·bare 인용 날짜 특정·Overview 헤딩 통일·swagger.md 인용 절 번호)를 함께 정리 — 지금 이 배치의 필수 선행조건은 아님
