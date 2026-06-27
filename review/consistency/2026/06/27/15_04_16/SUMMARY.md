# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**LOW** — WARNING 1건(plan stale 표기), INFO 7건. 의미적 모순·API 계약 충돌 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `refactor/02-architecture.md` C-2 cluster 4 항목이 "PR 대기"로 표기돼 있으나 PR #714·#716 이 이미 `origin/main` 에 반영된 stale 상태 | `plan/in-progress/refactor/02-architecture.md` §C-2 cluster 4 | PR #714 (`000d8963`)·#716 (`3e102ed3`) 머지 완료 커밋 | C-2 cluster 4 항목을 "✅ 완료 (PR #714·#716 머지됨)"으로 갱신. 02-architecture.md 전체 완료 여부 점검 후 `plan/complete/` 이동 검토 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `PATCH set-default`·`DELETE :id` 행에 `(Editor+)` 어노테이션 누락 (도입부 포괄 규정으로 의미 정합) | `spec/2-navigation/6-config.md §3` | 두 행에 `**(Editor+)**` 명기 (선택) |
| 2 | Cross-Spec | `POST :id/test` 권한이 6-config.md(SoT)·7-llm-client.md(포인터)에 분산 — 정합 | — | 현 구조 유지 |
| 3 | Rationale Continuity | R-1 범위 선언("Chat 탭에만")이 실제(Chat+Embedding)보다 좁음 | `§Rationale R-1` | 범위 갱신 (선택, pre-existing) |
| 4 | Rationale Continuity | LLM Client SSRF 가드가 `ALLOW_PRIVATE_HOST_TARGETS` 가 아닌 코드 레벨 provider 예외 — 문서화 미비 | `§R-4` | 보완 설명 (선택, pre-existing) |
| 5 | Convention Compliance | `id: config` basename prefix 생략 (권장 규약, 강제 아님) | frontmatter | 현 상태 유지 |
| 6 | Naming Collision | R-7 번호가 여러 spec 에 로컬 존재 (앵커 스코프, 충돌 없음) | — | 변경 불필요 |
| 7 | Naming Collision | `testConnection` 메서드명이 두 도메인에 존재 (경로 prefix 상이, 충돌 없음) | — | 변경 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 모순 없음. 표 어노테이션 불완전 INFO 2 |
| Rationale Continuity | LOW | 재도입·invariant 위반 없음. INFO 2(pre-existing) |
| Convention Compliance | NONE | 규약 준수. id prefix INFO 1 |
| Plan Coherence | LOW | C-2 cluster 4 "PR 대기" stale WARNING 1 |
| Naming Collision | NONE | 충돌 없음. INFO 2 |

## 권장 조치사항
1. **(WARNING)** `02-architecture.md` C-2 cluster 4 항목을 "✅ 완료 (PR #714·#716 머지됨)"으로 갱신 → 본 PR 에 B3 으로 반영.
2. (INFO, 선택) set-default·delete 행 (Editor+) 어노테이션, R-1 범위, R-4 SSRF 문서화 — pre-existing, 별건 defer.
