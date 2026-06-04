# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 2건 존재 (convention_compliance 검토 결과)

## 전체 위험도
**HIGH** — `spec-impl-evidence.md` 자체 선언 invariant(단일 진실, `code:` 열거, §4 가드 표)가 이번 구현 diff 로 인해 2건 위반됨. Rationale 미갱신 WARNING 2건 추가.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec-impl-evidence.md` frontmatter `code:` 에 신규 구현 파일 5개 미등재. `status: implemented` 인 spec 이 "모든 구현 파일 열거" invariant 위반. | `spec/conventions/spec-impl-evidence.md` L4–L11 `code:` 목록 | `spec-impl-evidence.md §2.1` — `code:` ≥1 매치 의무 + `spec-code-paths.test.ts` 가드 | frontmatter `code:` 에 신규 5개 파일(`plan-frontmatter.test.ts`, `spec-area-index.test.ts`, `spec-link-integrity.test.ts`, `spec-links.ts`, `spec-plan-completion.test.ts`) 추가 |
| 2 | Convention Compliance | `spec-impl-evidence.md §4` 헤더 "Build-time 가드 (4건)" 표가 신규 가드 3~4개 미등재 — spec 이 "단일 진실" 선언한 가드 inventory 가 구현과 불일치 | `spec/conventions/spec-impl-evidence.md` L98–L112 `## 4. Build-time 가드 (4건)` | `spec-impl-evidence.md §4` 자체(단일 진실 선언, L17) | 헤더를 `## 4. Build-time 가드` 로 수정하고 표에 `plan-frontmatter`, `spec-area-index`, `spec-link-integrity`, `spec-plan-completion` 4행 추가. `spec-links.ts` 는 helper 라이브러리이므로 `code:` 만 추가 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | spec-impl-evidence.md 가 "4개 가드" 로 확정 선언한 목록에 신규 가드 4개 추가됐으나 Rationale 미갱신. 가드 수·목록·`code:` frontmatter·SoT 귀속이 구현과 불일치 | `spec/conventions/spec-impl-evidence.md §4` Overview·표·`code:` | 기존 확정 "4개 가드" SoT 선언 | §4 표 + `code:` frontmatter 갱신(CRITICAL 1·2 수정으로 해소), 각 가드의 SoT 귀속(plan-lifecycle §4/§5) 명시 |
| 2 | Rationale Continuity | `spec-plan-completion.test.ts` 가 plan-lifecycle §5 수동 자가 점검을 CI 자동 강제(build-time 차단)로 격상 — 이 결정 번복의 새 Rationale 이 어느 spec 에도 없음 | `spec-plan-completion.test.ts` L614–L617 SoT 주석; `plan-lifecycle.md §5` | `.claude/docs/plan-lifecycle.md §5` "이동 commit 자가 점검"(수동) vs `spec-plan-completion.test.ts`(자동 CI 차단) | `plan-lifecycle.md §5` 또는 `spec-impl-evidence.md §4` 에 "Gate C — 수동 체크리스트 → build-time 가드 격상" 근거 추가. `spec_impact` 필드 스키마도 `plan-lifecycle.md §4` (Frontmatter 스키마)에 등재 필요 |
| 3 | Convention Compliance | `spec-plan-completion.test.ts` SoT 인용이 `plan-lifecycle.md §5` 를 가리키나, 해당 절에 `spec_impact` 필드 정의나 Gate C 정책이 없어 존재하지 않는 내용을 SoT 로 인용 | `spec-plan-completion.test.ts` L614–L617 | `.claude/docs/plan-lifecycle.md §5` | (a) `plan-lifecycle.md §5` 에 Gate C + `spec_impact` 필드 정의 추가, 또는 (b) SoT 인용을 `spec-impl-evidence.md` 단독으로 수정하고 해당 문서에 Gate C 정책 기재 |
| 4 | Plan Coherence | `plan/in-progress/spec-drift-gates.md` 의 Gate C·D 가 "보류"(`[ ]`) 상태로 in-progress에 남아 있으나 target 이 이를 구현으로 해소 — plan 추적 갱신 누락 | `plan/in-progress/spec-drift-gates.md §C·§D` | `spec/conventions/spec-impl-evidence.md §4.2` (Gate C·D 구현 완료) | `spec-drift-gates.md` §C·§D 체크박스를 `[x]` 로 갱신, 완료 조건 체크, Gate C 구현 방식 변경(`spec_impact` 선언 방식, R-8 참조) 기록 후 `plan/complete/` 로 이동 |
| 5 | Cross-Spec | Gate C `spec_impact` 허용 sentinel 이 spec 문서(`none`/`없음`)와 구현 코드(`none`/`없음`/`n/a`/`na`) 간 불일치 | `spec/conventions/spec-impl-evidence.md §4.2` Gate C 행 및 R-8 | `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` L25 `NONE_VALUES` | spec §4.2·R-8을 `none`/`없음`/`n/a`/`na` 4값으로 동기화하거나, `NONE_VALUES` 를 `none`/`없음` 으로 좁히는 방향 중 결정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | `spec-area-index.test.ts` 가 `spec-impl-evidence.md` 를 SoT 로 명시하나 해당 컨벤션에 area index 강제 규약 없음 | `spec-area-index.test.ts` L167 | `spec-impl-evidence.md` 에 area index 규약 절 추가, 또는 `spec/conventions/spec-structure.md` 신설 후 SoT 수정 |
| 2 | Rationale Continuity | `spec-impl-evidence.md` frontmatter `code:` 신규 4개 파일 미포함 | `spec/conventions/spec-impl-evidence.md` frontmatter `code:` L1–L11 | CRITICAL 1 수정으로 함께 해소 |
| 3 | Convention Compliance | `plan-frontmatter.test.ts` 가 `plan-lifecycle.md §4` 를 SoT 로 올바르게 가리키나 `spec-impl-evidence.md §4` 에 미등재 | `spec-impl-evidence.md §4` 표 | CRITICAL 2 수정(§4 표 갱신) 시 함께 해소 |
| 4 | Cross-Spec | plan-frontmatter.test.ts·spec-area-index.test.ts·spec-link-integrity.test.ts 의 `code:` 위임 구조 및 면제 범위가 기존 가드와 일관됨 | `spec-impl-evidence.md §4.2` | 없음 (현 구조 적절) |
| 5 | Plan Coherence | stale 워크트리 6건(`fix-spec-frontmatter-catalog`, `fix-bg-context-followups`, `spec-drift-gates-b26bce` 등) — PR 모두 MERGED, 실제 경합 없음 | `.claude/worktrees/` | 불편하면 `./cleanup-worktree-all.sh --yes --force` 실행 |
| 6 | Naming Collision | 신규 식별자 전체(함수·인터페이스·타입·상수·파일경로·프론트매터 키·Gate 레이블) 충돌 없음 | `codebase/frontend/src/lib/docs/__tests__/` 신규 5파일 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Gate C sentinel 범위 불일치(WARNING 1건), 나머지 INFO 4건 충돌 없음 |
| Rationale Continuity | MEDIUM | "4개 가드" 확정 선언 후 4개 추가·Rationale 미갱신(WARNING 2건) |
| Convention Compliance | HIGH | `code:` 누락 5개·§4 가드 표 미갱신(CRITICAL 2건) + SoT 잘못된 인용(WARNING 1건) |
| Plan Coherence | LOW | Gate C·D 보류→구현 해소됐으나 plan 추적 미갱신(WARNING 1건) |
| Naming Collision | NONE | 충돌 없음 |

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 에 신규 파일 5개 추가: `plan-frontmatter.test.ts`, `spec-area-index.test.ts`, `spec-link-integrity.test.ts`, `spec-links.ts`, `spec-plan-completion.test.ts`.
2. **(BLOCK 해소 필수)** `spec/conventions/spec-impl-evidence.md §4` 헤더를 `## 4. Build-time 가드` 로 수정하고 표에 신규 가드 4행(`plan-frontmatter`, `spec-area-index`, `spec-link-integrity`, `spec-plan-completion`) 추가.
3. **(WARNING 해소)** `plan-lifecycle.md §5` 또는 `spec-impl-evidence.md §4` 에 "Gate C — 수동 체크리스트 → build-time 가드 격상" 근거와 `spec_impact` 필드 스키마 정식 기재.
4. **(WARNING 해소)** `spec-plan-completion.test.ts` L614–L617 SoT 주석을 실제 Gate C 정책이 기술된 문서·절로 수정 (3번 작업 후 해소).
5. **(WARNING 해소)** `plan/in-progress/spec-drift-gates.md` §C·§D 체크박스 `[x]` 갱신 + 완료 조건 체크 + Gate C 구현 방식 변경 기록 후 `plan/complete/` 이동.
6. **(WARNING 해소)** Gate C `spec_impact` sentinel 범위를 spec 문서와 `NONE_VALUES` 중 하나를 기준으로 동기화 (`none`/`없음`/`n/a`/`na` 4값 허용으로 통일 권장).
7. **(INFO)** `spec-area-index.test.ts` SoT 인용 근거(`spec-impl-evidence.md` 에 area index 규약 절 추가 또는 `spec/conventions/spec-structure.md` 신설)를 이번 spec 갱신 PR 에 포함.