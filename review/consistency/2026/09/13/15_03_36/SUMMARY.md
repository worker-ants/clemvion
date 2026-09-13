# Consistency Check 통합 보고서

**BLOCK: YES** — `convention_compliance` checker 가 CRITICAL 로 판정한 `review-citations.md §2` 위반(bare `hh_mm_ss` 인용) 1건이 있어 하향 없이 그대로 반영.

## 전체 위험도
**HIGH** — Critical 1건은 코드 주석 한 줄 교체로 해소 가능(권한 밖 아님)이나, 규약 위반 그 자체는 명시 금지 조항을 새로 어긴 것이라 등급을 낮추지 않음. 그 외에는 `spec/conventions/**` 델타 0(정상 코드 전용 PR)이며 구조적 위험은 낮음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 신규 코드 주석에 `spec/conventions/review-citations.md §2` 가 명시 금지한 **bare `hh_mm_ss`** 리뷰 세션 인용을 새로 추가(`14_41_14`, 날짜 없음). 같은 diff 의 다른 파일(`guide-identifier-scan.ts:73`)은 같은 세션을 규약대로 전체 경로로 정확히 인용해 표기가 갈림 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:98` | `spec/conventions/review-citations.md §2`("bare `hh_mm_ss` 는 쓰지 않는다") + §3 적용범위표(`codebase/**` 코드·테스트 주석 — 적용) | `14_41_14` → `review/code/2026/09/13/14_41_14` (전체 경로)로 교체. 예: `` (`/ai-review`(`review/code/2026/09/13/14_41_14`) testing WARNING#6). `` |

## planner 인계 (권한 밖 Critical)

> (없음) — 위 Critical 은 `codebase/frontend/**` 코드 주석 한 줄 수정으로 developer 권한 내에서 즉시 해소 가능하며, `spec/**` 변경이 필요하지 않다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | `#1330`(`plan/complete/guide-error-code-truth.md §D`)이 세운 "허용목록 없음" 설계 원칙을 이번 구현이 실측 근거(뮤테이션 7건 중 RED 6, `GUIDE_EXTERNAL_VOCABULARY` 4강제)로 명시 번복했으나, 그 근거가 CLAUDE.md 가 정한 자리(`spec/conventions/user-guide-evidence.md` 의 `## Rationale`)로 아직 승격되지 않음. developer 는 절차대로(spec 쓰기 권한 없음) `plan/in-progress/spec-draft-nullable-notation-followups.md:3247` 에 완결된 초안을 이미 위임해 둔 상태 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 상단 주석 · `plan/in-progress/guide-identifier-existence.md §C` | `spec/conventions/user-guide-evidence.md`(§2 표 + `## Rationale` 미등재) | planner 턴에서 §2 표에 3개 가드 파일 행 추가 + frontmatter `code:` 갱신 + `## Rationale` 신규 항목(① 왜 허용목록 없음 원칙을 유지 못 했는가, ② 왜 이번 허용목록은 `#1330`이 기각한 것과 다른가)을 **한 번에** 반영. 초안은 `spec-draft-nullable-notation-followups.md` 해당 항목에 이미 있음 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, convention_compliance, naming_collision (3-checker 수렴) | 이 가드 가족의 자칭 SoT(`user-guide-evidence.md §2`)가 실제로는 이 가드를 열거하지 않음. `#1330` 부터 있던 선재 gap 이며 이번 PR 이 새로 만든 회귀 아님 | `guide-identifier-scan.ts` 상단 주석 / `guide-identifier-existence.test.ts:25` | 위 WARNING#1 처분과 같은 planner 턴에서 함께 처리(중복 등재 불필요, 이미 `guide-identifier-existence.md §D`·트래커에 등재됨) |
| 2 | cross_spec | `cafe24-api-metadata.md §4` 가 `i18n-userguide.md` "Principle 7" 으로 오인용(실제 Principle 0) — 이번 diff 와 무관한 선재 결함 | `spec/conventions/cafe24-api-metadata.md §4` | 이미 `guide-identifier-existence.md §D 항목 4`로 등재됨, 추가 조치·중복 등재 불필요 |
| 3 | rationale_continuity | 이번 구현은 `#1330` 이 기각한 대안(전수 열거+허용목록) 중 "frontend 자기증명 오염" 축은 그대로 보존(frontend 소스 기준집합 미포함) — 부분 재도입이며 완전한 원칙 폐기가 아님 | `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` | WARNING#1 의 Rationale 신설 시 "무엇을 뒤집고 무엇을 보존했는지" 한 문장 포함 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `spec/conventions/**` 델타 0. 신규 cross-spec 모순 없음. SoT 미등재는 선재·이미 추적 중 |
| rationale_continuity | MEDIUM | "허용목록 없음" 원칙 번복이 실측 근거는 있으나 spec `## Rationale` 로 미승격(WARNING) |
| convention_compliance | MEDIUM (CRITICAL 1건 포함) | `review-citations.md §2` bare `hh_mm_ss` 신규 위반 1건. 그 외 규약 대체로 준수 |
| plan_coherence | NONE | 주도 plan 이 impl-prep 지적 4건 전부 처분 완료, orphan 참조 없음 |
| naming_collision | NONE | 신규 spec 식별자 없음. 코드 레벨 이름(리네임·axis·상수)도 전수 grep 상 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선) `guide-identifier-existence.test.ts:98` 의 `14_41_14` 를 `review/code/2026/09/13/14_41_14` 전체 경로 인용으로 교체 — developer 권한 내, codebase 파일 1줄 수정.
2. 수정 후 영향받은 파일(`guide-identifier-existence.test.ts`)이 포함되는 scope 로 `--impl-done` 재실행하여 fix 반영 확인.
3. (별도 트랙, 이미 위임됨) planner 턴에서 `spec/conventions/user-guide-evidence.md` §2 표 + frontmatter + `## Rationale` 을 한 번에 갱신 — WARNING#1·INFO#1·INFO#3 을 함께 해소. `cafe24-api-metadata.md §4` 오인용(INFO#2)도 같은 트래커에서 처리 가능하면 동반 처리.