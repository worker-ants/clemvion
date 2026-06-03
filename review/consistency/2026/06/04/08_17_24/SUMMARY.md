# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — active worktree(`ai-context-memory-9c7e6e`)가 이미 main에 머지된 수정을 되돌리는 변경을 보유한 채 동일 파일을 수정 중이며, 머지 시 CATALOG_FIELD_FILE 제외 로직이 삭제되어 444건 red가 재발할 위험이 있음.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `ai-context-memory-9c7e6e` 브랜치가 merge-base `66f4ffd9`(#449) 기준으로, 이후 머지된 PR #453(`e79956ad`)의 R-7·CATALOG_FIELD_FILE 제외 로직을 삭제하는 변경을 보유한 채 활성 상태. kb-quality 머지 후 이 브랜치가 `spec-impl-evidence.md`와 `spec-frontmatter-parse.ts`에서 3-way conflict를 일으키고, CATALOG_FIELD_FILE 제외 삭제로 444건 red가 재발 가능 | `spec/conventions/spec-impl-evidence.md` §1, frontmatter `code:`, §Rationale R-7 | `ai-context-memory-9c7e6e` 브랜치(plan: `ai-context-memory-auto.md`, PR 없음 — ACTIVE) | `ai-context-memory-9c7e6e` 브랜치를 최신 `origin/main`으로 rebase한 뒤 conflict 해소. 이미 머지된 R-7·CATALOG_FIELD_FILE 삭제 라인은 폐기. kb-quality PR 먼저 머지하는 경우 ai-context-memory PR 개설 전 반드시 최신 main 동기화 강제. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `spec-drift-gates.md`가 Gate C를 "보류" 마킹된 채 `in-progress`에 잔류. kb-quality가 Gate C·D를 구현 완료했으나 `spec-drift-gates.md` §C·§D 체크박스가 `[ ]` 상태로 남아 있음 | `spec-drift-gates.md` §C·§D | `plan/in-progress/knowledge-base-quality-improvements.md` §item 7 + 신규 `spec-plan-completion.test.ts` | kb-quality 머지 후 `spec-drift-gates.md` §C·§D 항목을 `[x]` 갱신하고 완료 조건 충족 시 `plan/complete/` 이동 처리. |
| 2 | Plan Coherence | `competitive-analysis-e0569b`(OPEN PR #454)가 `spec-impl-evidence.md` §1 제외 설명 3행을 축약 재작성. kb-quality와 순서 없이 머지 시 3-way conflict 발생 가능(의미 충돌 없음, 표현만) | `spec/conventions/spec-impl-evidence.md` §1 | PR #454 (`competitive-analysis-e0569b`) | 두 PR 중 하나를 먼저 머지한 뒤 나머지를 rebase. |
| 3 | Cross-Spec | `.claude/docs/plan-lifecycle.md`(main 기준)에 `(unstarted)` sentinel·Gate C(`spec_impact`)·`spec_impact` 필드 정의가 없음. `spec-impl-evidence.md §4.0`이 이를 SoT 참조 — 워크트리 내 plan-lifecycle.md는 갱신됐으나 이 PR의 diff에 해당 파일이 포함됐는지 확인 필요 | `spec/conventions/spec-impl-evidence.md §4.0` | `.claude/docs/plan-lifecycle.md §4`(main) | PR diff에 `.claude/docs/plan-lifecycle.md` 변경이 포함됐는지 재확인. 미포함 시 별도 갱신 PR 필요. |
| 4 | Rationale Continuity | Gate C 채택 근거(4→5 확장 결정, grandfathering cutoff=2026-06-04, `none`/`없음` sentinel 채택)가 Rationale에 없음. 설계 결정이 구현 코드에만 존재 | `spec/conventions/spec-impl-evidence.md §Rationale` (R-1~R-7) | 없음 (신규 결정 미기록) | `## Rationale`에 `### R-8. Gate C — plan 완료 시점 spec_impact 선언 의무화` 추가: (a) 4→5 확장 배경, (b) grandfathering cutoff 선정 이유, (c) `none`/`없음` sentinel 채택 vs 빈 문자열 기각, (d) 완료 plan 범위 결정. |
| 5 | Rationale Continuity | §4.0 지식저장소 무결성 가드 family 신설(3건+Gate D) 근거·기각 대안(별도 spec 문서 분리, plan-lifecycle.md 통합 등)이 Rationale에 없음 | `spec/conventions/spec-impl-evidence.md §4.0` + `§Rationale` | 없음 (신규 결정 미기록) | `## Rationale`에 `### R-9. §4.0 지식저장소 무결성 가드 — 별도 family 신설 근거` 추가: (a) 이 문서를 SoT로 택한 이유, (b) 세 가드를 묶은 카테고리 설정 근거, (c) Gate D advisory 채택 이유. |
| 6 | Convention Compliance | `### 4.0 지식저장소 무결성 가드`가 §4 본문 표 이후에 "zero-th subsection"으로 삽입되어 프로젝트 내 다른 spec의 섹션 번호 관례(1, 1.1, 1.2...)와 어긋남. 선례 없음 | `spec/conventions/spec-impl-evidence.md §4.0` | 프로젝트 전반 spec 섹션 번호 관례 | `### 4.0` → `## 5. 지식저장소 무결성 가드`(또는 `## 4.1`)로 격상. 기존 `### 4.1 가드와 다른 가드의 관계`는 순차 갱신. 문서 내부 anchor 참조(`§4.0`)도 함께 갱신. |
| 7 | Convention Compliance | Gate C(`spec-plan-completion.test.ts`)가 §4 "frontmatter-evidence" 표(spec frontmatter 검증 가드 묶음)에 포함되어 있으나, 실제로는 `plan/complete/*.md`의 `spec_impact`를 검증하는 plan frontmatter 가드 — 분류 불일관 | `spec/conventions/spec-impl-evidence.md §4` 표 마지막 행 | §4 표 제목·§4.0 표 분류 체계 | Gate C를 §4 표에서 빼고 §4.0(또는 격상된 §5) 표에 추가. §4 카운트를 "4건"으로 변경. |
| 8 | Convention Compliance | Gate D(`/spec-coverage --mode reverse`) — 미구현 플래그가 구체 인터페이스처럼 §4.0 표에 명기되어 오인 위험 | `spec/conventions/spec-impl-evidence.md §4.0 표` Gate D 행 | `.claude/docs/plan-lifecycle.md §6.2` / 기존 spec-coverage slash command spec | Gate D 설명에서 `--mode reverse` 플래그를 제거하거나 `(미구현 — 향후 플래그 설계 시 확정)` 괄호 주석 추가. 또는 Gate D 항목을 별도 "향후 계획" 블록으로 분리. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec-area-index.test.ts`의 `spec/conventions/` 면제가 코드·spec 설명 양쪽 일치 — 충돌 없음 | `spec/conventions/spec-impl-evidence.md §4.0` + 해당 test 파일 | 이슈 없음. 향후 `spec/conventions`에 index가 생길 경우 양쪽 동시 갱신 필요. |
| 2 | Cross-Spec | `GATE_C_CUTOFF = 2026-06-04`가 spec-impl-evidence.md·plan-lifecycle.md·test 코드 3곳에 각자 하드코딩 — 현재 값 일치 | 3곳 동시 | 이슈 없음. 날짜 변경 시 세 파일 동시 갱신 필요함을 Rationale에 명기하면 drift 예방 도움. |
| 3 | Rationale Continuity | §6 Rollout §3 항목이 "§4.0 지식저장소 무결성 가드 3건은 후속 kb-quality에서 확장"이라고 미래형 기술 — 본 PR에서 이미 구현 완료됨 | `spec/conventions/spec-impl-evidence.md §6 Rollout` | §6 항목 3을 "frontmatter-evidence 가드 5건 + §4.0 지식저장소 무결성 가드 3건(Gate C 포함) 동반 작성"으로 현재 시제 갱신. |
| 4 | Rationale Continuity | `plan-frontmatter.test.ts` 가드의 SoT 경계 불명확 — 가드 명세 변경 시 어느 문서를 먼저 수정해야 하는지 불명확 | `spec/conventions/spec-impl-evidence.md §4.0 표` plan-frontmatter.test.ts 행 | §4.0 비고에 "가드 규약 SoT = `.claude/docs/plan-lifecycle.md §4`, 본 절은 가드 파일 등재 위치만 선언"이라는 구분 명시. |
| 5 | Convention Compliance | §6 Rollout §3 항목의 인라인 이력 주석이 spec 본문 "latest-only 사실 기술" 원칙과 불일치 | `spec/conventions/spec-impl-evidence.md §6 Rollout` | §6 항목 3의 인라인 주석 제거 후 R-8에 이력 통합. |
| 6 | Plan Coherence | `plan/in-progress/fix-spec-frontmatter-catalog.md`의 follow-up 4건이 모두 non-blocking 문서 정비 — 특히 INFO#4는 PR #451 머지로 해소 가능 상태 | `plan/in-progress/fix-spec-frontmatter-catalog.md` | follow-up 상태 재확인 후 잔여 항목이 non-blocking이면 `plan/complete/`로 이동 처리. |
| 7 | Naming Collision | `repoRoot()` 함수가 `spec-frontmatter-parse.ts`와 `impl-anchor-parse.ts` 두 헬퍼에 독립 정의 — runtime 충돌 없음, 각자 명시 import로 분리 사용 | `codebase/frontend/src/lib/docs/__tests__/` | 즉시 수정 불필요. 향후 공유 유틸로 단일화 또는 re-export 리팩토링 가능. |
| 8 | Naming Collision | `Area` 인터페이스가 `spec-area-index.test.ts` 내 파일-로컬 비-export 타입 — 기존 i18n 문자열 값과 의미 충돌 없음 | `spec-area-index.test.ts` | 조치 불필요. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `plan-lifecycle.md` main 버전에 sentinel·Gate C 미반영 — PR diff 포함 여부 확인 필요(WARNING). 코드·spec 직접 충돌 없음. |
| Rationale Continuity | MEDIUM | Gate C 채택 근거·§4.0 family 신설 근거가 Rationale에 없음. 기존 결정과의 직접 충돌은 없으나 R-8·R-9 항목 추가 필요. |
| Convention Compliance | MEDIUM | §4.0 zero-th subsection 패턴, Gate C 분류 불일관, Gate D 미구현 플래그 구체 명기 — 구조·분류 수준 WARNING 3건. |
| Plan Coherence | HIGH | CRITICAL 1건(ai-context-memory-9c7e6e 활성 충돌), WARNING 2건(spec-drift-gates 체크박스 미갱신, competitive-analysis PR #454 머지 순서). |
| Naming Collision | NONE | 식별자·파일 경로·요구사항 ID 충돌 없음. INFO 2건(repoRoot 중복 정의, Area 파일-로컬 타입)은 runtime 무해. |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `ai-context-memory-9c7e6e` 브랜치를 최신 `origin/main`(`e79956ad` 이후)으로 rebase한 뒤, `spec-impl-evidence.md`의 R-7·`code:` 항목 삭제 및 `spec-frontmatter-parse.ts`의 CATALOG_FIELD_FILE 제외 로직 삭제를 폐기. kb-quality PR 먼저 머지하는 경우 ai-context-memory PR 개설 전 반드시 rebase 강제.
2. **(머지 순서 조율)** `competitive-analysis-e0569b`(PR #454)와 kb-quality 중 하나를 먼저 머지한 뒤 나머지를 rebase. §1 표현 충돌은 경미하나 3-way conflict 예방 필요.
3. **(PR diff 확인)** 이 PR의 diff에 `.claude/docs/plan-lifecycle.md` 변경이 포함됐는지 확인. 미포함 시 `(unstarted)` sentinel·Gate C·`spec_impact` 정의를 별도 갱신 PR로 추가.
4. **(Rationale 추가)** `spec/conventions/spec-impl-evidence.md §Rationale`에 R-8(Gate C 4→5 확장 배경, grandfathering cutoff 선정, sentinel 채택 근거), R-9(§4.0 별도 family 신설 근거, Gate D advisory 채택) 항목 추가.
5. **(구조 정리)** `### 4.0 지식저장소 무결성 가드` → `## 5. 지식저장소 무결성 가드`(또는 `## 4.1`)로 격상. Gate C를 §4 표에서 §5(§4.1)로 이동. §4 카운트 "4건"으로 정정. Gate D `--mode reverse` 플래그 미구현 명시.
6. **(머지 후 후속)** kb-quality 머지 후 `plan/in-progress/spec-drift-gates.md` §C·§D 항목 `[x]` 갱신 및 `plan/complete/` 이동. `fix-spec-frontmatter-catalog.md` follow-up 재확인 후 non-blocking 항목 소거 시 `plan/complete/` 이동.