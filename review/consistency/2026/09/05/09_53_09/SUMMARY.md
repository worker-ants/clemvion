# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 없음 (NONE/LOW), WARNING 1건 + INFO 4건만 존재.

## 전체 위험도
**LOW** — CRITICAL 0건. `review-citations.md` 신규 규약이 같은 날 등재된 `swagger.md` §3 과 표면이 겹치는데 상호 참조가 없어 잠재적 충돌 여지(WARNING) 1건, 그 외는 근거 출처·스코프 완결성 관련 INFO 4건.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `review-citations.md` §3 적용 범위("코드·테스트 주석")가 DTO JSDoc(공개 OpenAPI 노출)을 배제하지 않아, 같은 날 등재된 자매 규약과 상호 링크 없이 표면이 겹친다 — DTO JSDoc 에 리뷰 인용을 넣으면 두 규약이 동시에 만족/위반되는 잠재 충돌 | `spec/conventions/review-citations.md` §3 적용 범위 표 | `spec/conventions/swagger.md` §3 "JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다" | §3 표에 "DTO/컨트롤러 `/** */` JSDoc(OpenAPI 노출)은 대상 아님, swagger.md §3 에 따라 상단 `//` 주석에 적는다" 행 추가. 현재 실제 위반 사례(`alert-rule-response.dto.ts` 등)는 없음 — 잠재 충돌 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `review-citations.md` `code:` 필드가 spec-impl-evidence.md 의 "구현 경로" 정의를 벗어나 "준수 예시 파일"을 가리키는 재해석인데, 정당화가 `## Rationale` 이 아니라 `## Overview` 인용구에만 있음(코드 리뷰가 이미 인지·수용한 사안, 가드 통과에는 영향 없음) | `spec/conventions/review-citations.md` frontmatter `code:` + Overview | Overview 인용구를 `## Rationale`에 "R-1. `code:` 를 예시 파일로 쓰는 이유" 항목으로 옮기거나 복제 |
| 2 | rationale_continuity | §3 "`review/**` 는 사후 편집 대상 아님" 주장(사실은 맞음, `.claude/docs/plan-lifecycle.md:44` 로 확인됨)의 출처가 본문에 인용돼 있지 않음 | `spec/conventions/review-citations.md` §3 적용 범위 표, `review/**` 행 | 해당 셀에 `.claude/docs/plan-lifecycle.md:44` 링크 추가 |
| 3 | convention_compliance | §3 적용 범위 표가 이미 동일 패턴이 쓰이는 `scripts/**`(`check-pnpm-security-config.py`), `.github/**`(`deps-security-checks.yml`) 를 침묵으로 남김(현재 두 곳 다 우연히 이미 전체 경로 형태를 써서 위반 아님) | `spec/conventions/review-citations.md` §3 적용 대상 표 | 각주에 "`scripts/**`·`.github/**` 는 `codebase/` 밖이라 스코프 밖" 한 줄 명시(조치 불요, 예방적) |
| 4 | plan_coherence | `plan/in-progress/spec-draft-nullable-notation-followups.md:449-455` 가 "한 PR 이 단독으로 정할 일이 아니다"로 미뤄뒀던 인용 규약 결정을, 별도 전용 planner 문서(`plan/complete/spec-draft-migration-rerun-and-citations.md`, 실측+기각 대안 포함)로 정공법 처리했음을 확인 — 우회 아님 | `spec/conventions/review-citations.md` 전체 + 관련 plan | 조치 불요. 유사 유보 문구 해소 시 이 패턴(전용 plan 문서화) 유지 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 두 spec 문서(migrations.md 5줄, review-citations.md 신설) + README.md 54줄 델타 모두 데이터 모델·API 계약·요구사항 ID·RBAC 표면과 충돌 없음. 직전 라운드 INFO(원인 레이어 불일치)도 실구현에서 해소 확인 |
| rationale_continuity | LOW | INFO 2건(code: 필드 재해석 근거 위치, review/** 사후편집 관례 출처 미인용). V056/V106 선례 혼동 등 직전 라운드 지적 사항은 최종본에서 해소 확인 |
| convention_compliance | LOW | WARNING 1건(swagger.md §3 과 표면 겹침, 상호 링크 누락) + INFO 1건(스코프 표 완결성). frontmatter·문서 구조·경험적 수치는 전부 재현 검증 통과 |
| plan_coherence | NONE | target 변경 둘 다 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 추적하던 예정된 산출물. 인접 미해결 결정(mixed=true, bare 인용 8건)은 손대지 않고 보존 확인 |
| naming_collision | NONE | 신규 식별자(문서 ID `review-citations`, 파일 경로, 섹션명, README 하위 항목명) 6개 관점 전수 대조 결과 충돌 없음 |

## 권장 조치사항
1. `spec/conventions/review-citations.md` §3 적용 범위 표에 "DTO/컨트롤러 JSDoc(OpenAPI 노출)은 대상 아님 — swagger.md §3 참고" 행 추가 (WARNING #1 해소, 유일한 실행 우선 항목)
2. (선택) `code:` 필드의 "예시 파일" 재해석 근거를 `## Rationale`로 이동/복제 (INFO #1)
3. (선택) §3 표 `review/**` 행에 `.claude/docs/plan-lifecycle.md:44` 출처 링크 추가 (INFO #2)
4. (선택) §3 표 각주에 `scripts/**`·`.github/**` 스코프 밖 명시 (INFO #3)
