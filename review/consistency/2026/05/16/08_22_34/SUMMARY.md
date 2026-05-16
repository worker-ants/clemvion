BLOCK: NO

# Consistency Check 통합 보고서

검토 세션: `review/consistency/2026/05/16/08_22_34`
검토 모드: 구현 착수 전 검토 (`--impl-prep`)
대상: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/conversation-thread.md`

호출자: developer (user-guide-sync-4af69c worktree)

---

## 결론

**Critical 없음. 구현 착수 가능.** 발견된 4건의 Warning 및 13건의 Info 는 본 user-guide-sync 작업이 직접 영향을 받지 않는 spec 본문 측 항목으로, `project-planner` 후속 위임 대상.

본 plan(`plan/in-progress/user-guide-sync-2026-05-16.md`)이 보강하려는 4개 MDX 변경(AI Agent contextScope 필드, integrations.mdx Cafe24 섹션, overview.mdx 카테고리 한 줄, variables-and-context.mdx `$thread` 행)은 W/I 어느 항목과도 직접 충돌하지 않는다.

---

## 본 작업과의 관련성

| 항목 | 본 MDX 작업 충돌? | 비고 |
|---|---|---|
| W1 `{{ $now.iso }}` (cafe24 spec 예시) | 무관 | MDX 의 예시에서 `$now.iso` 표현식을 신규로 추가하지 않는다 — `$now` 만 사용 |
| W2 `$schedule` 변수 누락 | 무관 | 본 작업은 `$thread` 변수만 추가, `$schedule` 는 spec 갱신 사항 |
| W3 cafe24 install_token 회복 분기 | 무관 | cafe24 통합은 06-... 페이지 deep-link 만 추가, 회복 로직 본문 미기재 |
| W4 cafe24 §5 섹션 번호 불연속 | 무관 | 사용자 가이드는 spec 의 섹션 번호를 그대로 노출하지 않음 |
| I3 `contextScope` 표 중복(0-common §10 ↔ conversation-thread §5) | 정보성 | 본 MDX 는 `conversation-thread §5` 를 1차 소스로 frontmatter 의 `spec` 에 명시 |
| I11 plan stale 위험 | 처리됨 | 본 plan 의 "후속(spec 갱신 위임)" 섹션에 cafe24 install_token spec 후속 영향 노트 |

---

## 후속(spec 갱신 위임)

본 SUMMARY 의 W1~W4·I1~I13 중 spec 본문 수정이 필요한 항목은 `developer` 권한 밖이므로 다음과 같이 위임:

- W1, W3, W4 → `spec/4-nodes/4-integration/4-cafe24.md` 본문 수정. `project-planner` 호출.
- W2 → `spec/5-system/5-expression-language.md` §4.1 에 `$schedule` 추가. `project-planner` 호출.
- I3, I7, I8, I9, I10 → spec 정합·구조 정리. `project-planner` 호출.

이 노트는 본 plan 의 "후속(spec 갱신 위임)" 섹션에 추가로 반영.

---

## Checker 산출물

- `cross_spec/review.md` — 5 issues, MEDIUM
- `rationale_continuity/review.md` — 4 issues, LOW
- `convention_compliance/review.md` — 6 issues, LOW
- `plan_coherence/review.md` — 3 issues, LOW
- `naming_collision/review.md` — 2 issues, NONE

총 17건 (Critical 0 / Warning 4 / Info 13).
