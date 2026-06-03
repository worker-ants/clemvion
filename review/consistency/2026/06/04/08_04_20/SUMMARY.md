# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — `spec/conventions/spec-impl-evidence.md` 의 `code:` 목록 및 §4 가드 표가 이번 구현 diff 와 동기화되지 않아 spec `implemented` invariant 가 깨진 상태입니다.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec-impl-evidence.md` frontmatter `code:` 에 신규 구현 파일 4건 누락 (`plan-frontmatter.test.ts`, `spec-area-index.test.ts`, `spec-link-integrity.test.ts`, `spec-links.ts`) — `status: implemented` 인 spec 의 `code: ≥1 매치` 의무 위반 | `spec/conventions/spec-impl-evidence.md` frontmatter L4–11 | `spec-impl-evidence.md §3` + `spec-code-paths.test.ts` 가드 | `code:` 목록에 4개 파일 추가 (상세 목록은 아래 §권장 조치 1번 참고) |
| 2 | Convention Compliance | §4 가드 표가 "4건" 고정 표기를 유지하며 신규 가드 4건 (`plan-frontmatter.test.ts`, `spec-area-index.test.ts`, `spec-link-integrity.test.ts`, `spec-plan-completion.test.ts`) 미등재 — 동 §4 도입부의 "단일 진실" invariant 위반 | `spec/conventions/spec-impl-evidence.md` §4 표 (L98–108) | `spec-impl-evidence.md §4` 도입부 | §4 표 갱신 + 제목 "4건" → "Build-time 가드" 또는 실제 건수로 수정 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | Overview(L30) 및 §6 Rollout(L184–185) 의 "4개" 가드 카운트가 §4 헤딩 갱신("5건") 과 불일치 — 문서 내 숫자 일관성 깨짐 | `spec/conventions/spec-impl-evidence.md` L30, L184–185 | 동 문서 §4 (5건으로 갱신) | L30 수정; §6 Rollout 은 "초기 rollout 완료 기록" 절로 전환하거나 현행 카운트로 갱신 |
| 2 | Convention Compliance | `spec_impact` 필드가 어떤 공식 spec/convention 에도 정의되어 있지 않음 — plan frontmatter 스키마 SoT(`plan-lifecycle.md §4`)에 부재 | `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` L618–770 | `.claude/docs/plan-lifecycle.md §4` | `plan-lifecycle.md §4` 에 `spec_impact` 필드 스키마 추가 또는 §4.1/§5.1 별도 절 신설 |
| 3 | Convention Compliance | `spec-area-index.test.ts` / `spec-link-integrity.test.ts` 가 SoT 로 `spec-impl-evidence.md` 를 가리키나 해당 문서에 두 가드의 규약 절이 없음 | `spec/conventions/spec-impl-evidence.md` §4 (area-index·link-integrity 규약 부재) | `spec-area-index.test.ts` L166, `spec-link-integrity.test.ts` L268 | `spec-impl-evidence.md §4` 또는 별도 §5 "확장 가드" 에 두 가드의 규약(대상 패턴, 예외) 추가 |
| 4 | Plan Coherence | `plan/in-progress/spec-drift-gates.md` §C 가 Gate C 를 `[ ]` 보류로 열어둔 상태에서 kb-quality 가 Gate C 를 독립 완료 — §C 미완료 마커가 stale | `plan/in-progress/spec-drift-gates.md` §C | `plan/in-progress/knowledge-base-quality-improvements.md` §item 7 | kb-quality PR 머지 후 `spec-drift-gates.md` §C 를 `[x]` 로 갱신; 설계 변경(코드 변경 연동 → `spec_impact` + cutoff 방식)도 주석 기록 |
| 5 | Plan Coherence | Gate C 설계 방식이 spec-drift-gates §C 기술(코드 변경 연동)과 실제 구현(`spec_impact` + cutoff date)이 다름 — plan 에 설계 변경 미기록 | `plan/in-progress/spec-drift-gates.md` §C | `spec-plan-completion.test.ts` 구현 | `spec-drift-gates.md` §C 에 설계 변경 사유 주석 추가 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | `§4.0` 인접 가드 3건이 frontmatter `code:` 에 누락 — 의도적 SoT 분리라면 Rationale 에 근거 명시 필요 | `spec/conventions/spec-impl-evidence.md` frontmatter `code:` L5–11 및 §4.0 L113–120 | (a) `code:` 에 3건 추가 또는 (b) Rationale R-8 로 분리 근거 명문화 |
| 2 | Rationale Continuity | §6 Rollout 절 내용이 초기 rollout 역사 기록과 현행 절차가 혼재, latest-only 원칙과 어긋남 | `spec/conventions/spec-impl-evidence.md` §6 L174–185 | §6 을 "초기 rollout 완료 기록" 으로 전환하거나 현행 절차로 재작성 |
| 3 | Convention Compliance | `(unstarted)` 센티넬이 `plan-lifecycle.md §4` 공식 스키마에 미정의 — 사용자가 인지 못하면 TBD 등 legacy placeholder 사용 위험 | `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` L58 | `plan-lifecycle.md §4` 에 `worktree: (unstarted)` 센티넬 정의 추가 |
| 4 | Plan Coherence | Gate D도 spec-drift-gates §D 가 `[ ]` 보류인 상태에서 kb-quality 가 advisory 완료 — 동일하게 stale | `plan/in-progress/spec-drift-gates.md` §D | kb-quality PR 머지 후 §D 도 `[x]` 갱신 및 plan 완료 이동 조건 재판단 |
| 5 | Plan Coherence | fix-spec-frontmatter-catalog plan 의 follow-up 중 "WARNING#2 명확화" 가 kb-quality 변경으로 부분 해소됐을 가능성 | `plan/in-progress/fix-spec-frontmatter-catalog.md` | kb-quality 머지 후 해소 여부 점검 |
| 6 | Naming Collision | `spec-links.ts` 의 `slugify` 함수명이 일반 명칭으로 향후 확장 시 혼동 가능 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` L40 | 현재 변경 불필요; 프로덕션 승격 시 `slugifyHeading` 또는 `githubSlugify` 로 명확화 권장 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 데이터 모델·API·RBAC·계층 책임 충돌 없음 |
| Rationale Continuity | LOW | 문서 내 가드 카운트 불일치(4개↔5건) — WARNING 1건, INFO 2건 |
| Convention Compliance | HIGH | `code:` 누락 CRITICAL + §4 표 미갱신 CRITICAL + WARNING 2건 + INFO 1건 |
| Plan Coherence | LOW | spec-drift-gates §C/§D stale — WARNING 2건, INFO 3건; 능동 차단 없음 |
| Naming Collision | NONE | 파일·타입·함수·상수·frontmatter 키 충돌 없음 |

---

## 권장 조치사항

1. **(BLOCK 해소 — 필수)** `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 에 다음 4개 파일 추가:
   - `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
   - `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts`
   - `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`
   - `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`

2. **(BLOCK 해소 — 필수)** `spec/conventions/spec-impl-evidence.md` §4 표에 신규 가드 4건 등재 및 제목 "4건" → 실제 건수(또는 "Build-time 가드")로 수정.

3. **(WARNING 해소 — 권장)** `spec/conventions/spec-impl-evidence.md` Overview(L30) 의 "4개 build-time 가드" 카운트를 §4 현황과 일치하도록 수정.

4. **(WARNING 해소 — 권장)** `.claude/docs/plan-lifecycle.md §4` 에 `spec_impact` 필드 스키마와 `(unstarted)` 센티넬 정의 추가.

5. **(WARNING 해소 — 권장)** `spec/conventions/spec-impl-evidence.md §4` 또는 별도 §5 에 `spec-area-index` / `spec-link-integrity` 가드 규약(대상 패턴, 예외) 추가.

6. **(kb-quality PR 머지 후 후속)** `plan/in-progress/spec-drift-gates.md` §C·§D 를 `[x]` 로 갱신하고, §C 설계 변경(코드 변경 연동 → `spec_impact` + cutoff date) 주석 추가. plan 완료 이동 조건 재판단.