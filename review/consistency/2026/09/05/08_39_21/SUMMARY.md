# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건)

target: `plan/in-progress/spec-draft-numeric-wire-convention.md`
spec_impact: `spec/1-data-model.md`, `spec/conventions/swagger.md`

## 전체 위험도
**LOW** — Critical/충돌 없음. WARNING 2건(모두 "근거·의무를 문서에 명시하라"는 보완 성격)과 INFO 2건만 존재.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 신설 규칙 2건(§1-6, §3 JSDoc 문단)의 설계 근거("가드 대신 규약이 명시 변환 갈래를 담당하는 이유")가 `swagger.md` 자신의 `## Rationale` 에 짝지어지지 않음 — CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 규약 및 `swagger.md` 자체가 §1-4/§5 등에서 반복해 온 "본문 규칙 + 하단 Rationale 절 + `> 근거:` 역링크" 패턴과 결이 다름 | draft §3 변경안(B), §4 변경안(C) | `spec/conventions/swagger.md` §1-4/§5 Rationale 짝짓기 패턴 | `swagger.md` 하단 `## Rationale` 에 "§1-6 numeric/decimal wire 타입 — 가드와 규약의 책임 분리" 절 신설 + 본문에 `> 근거: [...]` 역링크 추가 (draft 의 "기각한 대안 — 가드를 명시 변환 경로까지 넓히기" 문단을 그대로 옮기면 저비용). 의도적으로 인라인 근거만으로 충분하다 판단했다면 그 판단을 draft `## Rationale` 에 한 줄 남길 것 |
| 2 | plan_coherence | 소스 plan(`spec-draft-nullable-notation-followups.md`)의 대응 체크박스 3건에 대한 backport(체크 갱신) 의무가 target 문서에 명시돼 있지 않음. 소스 plan 은 "미체크 체크박스가 단일 진실"이라는 자체 경고문까지 갖고 있어 체크박스 동기화 누락이 이 프로젝트에서 반복 지점임이 이미 기록됨 | target 문서 전체 (종결 조건/체크리스트 갱신 지시 부재) | `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 후속` 섹션 미체크 3건(swagger.md numeric 불변식 성문화 / 1-data-model.md:873 threshold 라벨 정정 / swagger.md JSDoc 분리 가이드) | target 적용 완료 시 소스 plan 의 해당 3개 체크박스를 `[x]` 로 갱신하고 target 커밋을 근거로 남길 것을 target 문서(또는 적용 커밋)에 명시. 두 문서가 같은 worktree(`plan-in-progress-items-b0c80b`)라 실무 리스크는 낮으나 세션이 갈릴 경우 누락 가능 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 신설 JSDoc 분리 규칙(변경안 C)의 소급 적용 범위 미명시 — `swagger.md` 는 새 DTO 분류 규칙 도입 시 "기존 필드를 일괄 소급 재선언하지 않는다"를 §1-4 신설 등에서 매번 명시해 온 관행이 있음 | draft §4 변경안(C) — `swagger.md §3` 신설 문단 | (C) 문단 또는 Rationale 항에 "기존 DTO 는 소급 정리 대상 아님(§1-4 와 동일 원칙)" 한 줄 추가, 또는 의도적으로 소급 대상이라면 근거 명시 |
| 2 | convention_compliance | 신규 인용 enforcement 파일(`swagger-dto-contract-guard.ts`)이 `swagger.md` frontmatter `code:` 글롭(4개) 어디와도 매칭되지 않음 — 이 문서에서 처음으로 `code:` 밖 파일을 본문에서 지목하는 사례. build guard 는 글롭 중 하나 이상 매칭만 요구해 차단 사유는 아님 | draft §3 변경안(B) — "가드" 인용 문단 | `swagger.md` frontmatter `code:` 에 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts` 항목 추가 검토 (선택적, 필수 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 실측(마이그레이션 grep, 서비스 코드, DTO/가드 코드, 삽입 위치) 전수 재현·대조 완료, 다른 spec 영역과 충돌 없음. 동명이인 `threshold`(RAG 검색 tool 인자, `5-system/9-rag-search.md`)는 별개 도메인으로 오탐 배제 확인 |
| rationale_continuity | NONE | 기존 Rationale 위반·번복 없음. draft 자신이 새 결정 3건에 Rationale 을 동반. `threshold: Float` 은 채택된 결정이 아닌 오표기였으므로 정정은 번복이 아님. INFO 1건(소급 적용 범위) |
| convention_compliance | LOW | 파일명·frontmatter·삽입 위치·앵커 슬러그·인용 근거 전부 규약 부합, 코드 사실 전수 재확인 일치. WARNING 1건(Rationale 짝짓기 누락) + INFO 1건(`code:` 글롭) |
| plan_coherence | LOW | plan 전역에 충돌하는 미해결 결정·미해소 선행조건 없음. spec 현재 상태와 정합(stale draft 아님). WARNING 1건(소스 plan 체크박스 backport 의무 미명시) |
| naming_collision | NONE | 신규 요구사항 ID·엔티티/DTO명·endpoint·이벤트명·ENV/config key 도입 없음. 신설 `### 1-6` 섹션 번호는 실측상 빈 자리로 선점 충돌 없음 |

## 권장 조치사항

1. (WARNING #1) `swagger.md` 편집 시 §1-6/§3 신설 문단에 대응하는 `## Rationale` 절 + `> 근거:` 역링크를 함께 삽입한다 — draft 의 "기각한 대안" 문단을 재사용하면 비용이 낮다.
2. (WARNING #2) target 적용 완료 시 `spec-draft-nullable-notation-followups.md` `## 후속` 의 대응 체크박스 3건을 `[x]` 로 갱신한다.
3. (INFO #1) §3 JSDoc 문단에 "기존 DTO 소급 정리 대상 아님(§1-4 원칙과 동일)" 한 줄을 추가한다.
4. (INFO #2, 선택) `swagger.md` frontmatter `code:` 에 `swagger-dto-contract*.ts` 글롭 추가를 검토한다.

BLOCK 사유가 없으므로 위 조치는 target 채택을 막지 않는 개선 권고이며, 특히 1·2는 다음 세션의 중복 작업·문서 추적성 손실을 예방하는 저비용 조치다.
