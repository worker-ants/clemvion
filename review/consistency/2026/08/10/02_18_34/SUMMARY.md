# Consistency Check 통합 보고서

**BLOCK: NO** — 5종 checker 전원 Critical 0 · WARNING 0 · 위험도 NONE

## 이 라운드의 성격

`spec/conventions/` 에 대한 **4차(종결) 라운드**다. 3차(`01_53_28`)가 이미 5종 전원 NONE
이었고, 그 뒤 코드 리뷰(`review/code/2026/08/10/02_06_01`)가 낸 WARNING 1건을 반영하느라
spec-linked 파일을 한 번 더 건드려 신선도가 깨졌다. 본 라운드는 **그 정정 하나의 파급만**
확인한다.

| 라운드 | 세션 | 코드 수정을 유발한 발견 |
|---|---|---|
| 1차 | `01_09_04` | **9건** |
| 2차 | `01_37_01` | **1건** (3종 checker 가 같은 항목으로 수렴) |
| 3차 | `01_53_28` | **0건** (5/5 NONE) |
| 4차 | 본 세션 | **0건** (5/5 NONE) |

## 확인 대상 — 단일 정정

`f5f454844` — `plan-frontmatter.test.ts` 헤더 주석의 정본 포인터를
`spec-links.ts` → **`plan-scan.ts`** 로 정정. 실행 로직 변경 없음.

추출(`ebb6f9598`) 이후 정본이 옮겨갔는데 주석만 남아, 같은 PR 이 갱신한
`spec-impl-evidence.md §4.2`("판정 로직은 `plan-scan.ts` 소관")와 **정면으로 어긋난** 상태
였다.

## 5종 판정

| Checker | 위험도 | 핵심 |
|---|---|---|
| cross_spec | NONE | 네 층(`PROJECT.md:277` · `spec-impl-evidence §2.2/§4.2`+`code:` · `plan-lifecycle §4/§5` · 가드 코드) 정합 재확인. `grep -rn "단일 구현"` 전역으로 잔여 stale 서술 0건 |
| convention_compliance | NONE | 정정이 코드 사실과 일치(`spec-links.ts:17` import → `:304` re-export). 겉보기 모순인 자매 주석(145행 "스캐너는 `spec-links.ts` 의 `findBrokenPlanLinks` 를 쓴다")과도 **층위가 달라 양립**함을 확인 |
| naming_collision | NONE | `git grep` 전수 — `collectLivePlanMarkdown` 은 `plan-scan.ts` 단일 정의 + `spec-links.ts` re-export. 폐기 참조 0건 |
| plan_coherence | NONE | `git log --since` 로 3차 이후 커밋이 정확히 2건(주석 1줄 + 리뷰 산출물 1줄)임을 실측. plan 문서 무변경, 새 충돌 없음 |
| rationale_continuity | NONE | **결정의 번복이 아니라 사실 동기화**임을 확인 — 되살릴 "기각된 대안" 자체가 채택된 적 없는 stale 서술이었다. R-9 도메인 분리 원칙과 정합 |

## 알려진 프롬프트 결함 (네 라운드 공통)

`## 구현 변경 사항` diff 섹션이 번들 예산에 밀려 **네 라운드 모두 프롬프트에 없었다.**
1·2차에는 target 문서(`spec-impl-evidence.md`)마저 빠졌다. 전 checker 가 워킹트리 절대경로
에서 `git diff`/`git grep`/직접 `Read` 로 재구성해 판정했다 — **판정 근거는 번들이 아니라
직접 확인이다.** 이 한계를 다음 사람이 알아야 한다.

번들 예산 문제는 [`harness-review-gate-followups.md`](../../../../plan/in-progress/harness-review-gate-followups.md)
에 등재돼 있다(같은 문서의 `--impl-done` 타이밍 함정 항목과 함께).

## Critical / WARNING

없음.

## 참고

3차가 남긴 INFO 2건(코드 주석 속 평문 plan 경로 stale 1건 — `.claude/tests/test_review_changeset_warning.py:10`,
이 PR 이전부터 존재 / `plan-scan.test.ts` 의 `code:` 미등재 — 기존 비대칭 패턴)은 그대로
미조치다. 둘 다 이 PR 이 만든 결함이 아니며 게이트 비차단이다.

## 권장 조치사항

**조치 불요.** 본 라운드는 종결 라운드이며 push gate 는 이 SUMMARY 의 `BLOCK: NO` 를 근거로
통과 가능하다.
