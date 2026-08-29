# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 이번 diff(`spec/conventions/` 대상 `--impl-done`)는 실제로 `spec/**` 를 전혀 건드리지 않았고(`git diff --stat origin/main -- spec/` 0 라인), 실 변경은 `spec-links.ts`/`spec-links.test.ts` 멀티라인 링크 버그 수정 + plan 트래커 갱신에 한정된다. 5개 checker 전원이 Critical 없음(NONE~LOW)으로 판정했으며, `convention_compliance` 가 지적한 2건의 WARNING 은 이번 diff 가 만든 문제가 아니라 `swagger.md` 자체의 기존(standing) 내부 불일치다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `swagger.md` §2-2 canonical 예제가 같은 문서 §5·§6 이 명시적으로 금지한 "빈 껍데기" 인라인 스키마 패턴(`schema: { type:'object', properties:{ data:{ type:'object' } } }`)을 그대로 사용 | `spec/conventions/swagger.md` §2) Controller 패턴 → 2-2 | 같은 문서 §5(DTO+공용 래퍼 헬퍼 사용) / §6(레거시 패턴 제거) | §2-2 예제를 `ApiCreatedWrappedResponse(WorkflowDto)` 형태로 교체하거나 "레거시 예시 — §5 참고" 로 명시 표시 |
| 2 | convention_compliance | `swagger.md` §2 canonical 예제 3건(create/findOne/findAll)이 같은 문서 §3 이 "강제"로 규정한 `summary`(10~20자)/`description`(50~150자, 필수) 규칙을 위반(하한 미달 또는 필드 자체 누락) | `spec/conventions/swagger.md` §2-2, §2-3 | 같은 문서 §3) 주석/설명 톤 표 | §3 규칙(2026-08-23 신설)에 맞춰 §2 예제 3건의 summary/description 길이·존재 여부 갱신, 또는 "규칙 도입 이전 레거시 예시" 각주 처리 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 링크 추출기 AST 파서 전환 보류 결정이 spec 문서의 정식 `## Rationale` 이 아니라 코드 JSDoc + plan 항목에만 문서화됨 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (`extractLinks` JSDoc), `plan/in-progress/harness-review-gate-followups.md` | AST 전환 여부가 확정되는 시점에 `spec-impl-evidence.md` 또는 관련 spec 의 `## Rationale` 에도 한 줄 반영 |
| 2 | convention_compliance | `spec/conventions/*.md` 상단 H1 제목 형식이 파일마다 4가지로 제각각 (`CONVENTION:` 대문자 / `Convention:` 혼용 / 접두 없음 / `(Conventions)` 괄호 접미) | `secret-store.md`, `spec-impl-evidence.md`, `swagger.md`, `audit-actions.md`, `cafe24-api-catalog/_overview.md` | 우선순위 낮음. 후속 정리 시 `# CONVENTION: <Name>` 단일 포맷 통일 검토 |
| 3 | convention_compliance | `## Overview` 섹션 유무·라벨이 문서마다 다름(권장 사항, 강제 아님) | 위 5개 문서 동일 | 강제 조치 불요, 후속 정리 후보로만 기록 |
| 4 | plan_coherence | `harness-review-gate-followups.md` frontmatter `worktree` 필드가 실제 작업 워크트리(`eslint10-upgrade-5e3cf9`)와 다른 워크트리(`harness-review-ci-backstop-91f379`)를 선언 | `plan/in-progress/harness-review-gate-followups.md` frontmatter | `worktree:` 를 실제 작업 워크트리로 갱신하거나 "다른 워크트리에서 대신 처리했다"는 한 줄 메모 추가. 동반 plan(`deps-peer-gating-and-eslint10.md`)이 올바른 worktree 를 선언하고 있어 게이트는 막히지 않음(비차단) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/conventions/` diff 0 라인 — 평가할 신규 target 서술 없음 |
| rationale_continuity | NONE | 기각된 대안 재도입·원칙 위반·무근거 번복·암묵적 가정 충돌 전부 없음. AST 전환 보류 결정의 spec Rationale 미반영만 INFO |
| convention_compliance | LOW | `swagger.md` §2 canonical 예제가 같은 문서 §5/§6/§3 최근 개정 규칙을 자체 위반(WARNING 2건). 제목·Overview 형식 편차는 INFO |
| plan_coherence | LOW | diff 는 plan 이 추적하던 항목을 정확히 해소, 미해결 결정 우회·선행 미해소·후속 누락 없음. `worktree` frontmatter drift 만 INFO |
| naming_collision | NONE | 신규 식별자(`MaskedDoc`/`buildMaskedDoc`/`lineForOffset`) 전부 파일-로컬 unexported, 충돌 없음 |

## 권장 조치사항
1. (선택, 비차단) `spec/conventions/swagger.md` §2-2/§2-3 canonical 예제를 같은 문서 §3(summary/description 길이)·§5(DTO 래퍼)·§6(레거시 패턴 금지) 최신 규칙에 맞게 갱신 — 개발자가 그대로 복붙할 위험이 있는 문서 자체 결함.
2. (선택, 비차단) `plan/in-progress/harness-review-gate-followups.md` frontmatter `worktree` 필드를 실제 작업 워크트리로 정정.
3. (선택, 비차단) AST 파서 전환 여부가 확정되면 그 결정을 spec 문서의 `## Rationale` 에도 반영.
