# Plan 정합성 검토 — plan-lifecycle-gates (impl-done, scope=spec/conventions/, 재검토)

## 방법 노트

prompt 번들에 diff 섹션이 없어(알려진 결함) 워킹트리 절대경로에서 직접 확인했다:
`git diff origin/main...HEAD --stat -- plan/ spec/conventions/` 로 이번 라운드가 건드린 파일을
추리고, 관련 plan 문서(`plan/in-progress/docs-guard-walker-dedup.md`,
`plan/in-progress/harness-env-value-subpattern-dedup.md`,
`plan/in-progress/webchat-command-failure-is-not-termination.md`,
`plan/complete/spec-draft-secret-store-verification-footnote.md`)와
target(`spec/conventions/spec-impl-evidence.md`) + 그 evidence 코드
(`plan-scan.ts`/`spec-links.ts`)를 절대경로로 대조했다.

이번 라운드는 직전 검토(`review/consistency/2026/08/10/01_09_04/plan_coherence.md`)가 지적한
WARNING 2건 + INFO 1건에 대한 재검토다. 세 건 모두 **반영 확인**:

1. **이관 되돌림** — `harness-env-value-subpattern-dedup.md`에서 walker 중복 관련 후속
   2건을 빼고 신규 `plan/in-progress/docs-guard-walker-dedup.md`를 만들었다. frontmatter
   (`title`/`worktree`/`started`/`owner`/`status`/`priority`/`spec_impact`)는 동시대 다른
   plan(`deps-guard-hardening.md`, `deps-peer-gating-and-eslint10.md` 등)과 동일한 스키마이고
   `plan-lifecycle.md §4` 필수 3필드(`worktree`/`started`/`owner`)를 모두 충족한다. 원 plan에는
   포인터("## 함께 볼 것 — 같은 'DRY vs 안전성' 축의 다른 plan")와 **왜 편입하지 않았는지**
   (코드베이스·언어·실패 모드가 다름)를 남겼고, 양방향 상호 참조가 일관된다. 새 plan이 언급하는
   함수명(`walkPlanMarkdown`/`collectSpecMarkdown`/`collectCodebaseSources`/`collectCompletePlans`/
   `SpecMdFile`/`PlanMdFile`)은 워킹트리의 실제 구현과 대조해 정확함을 확인했다.
2. **측정 주장 정정** — `spec-links.ts`의 `findBrokenPlanLinks()` JSDoc과
   `plan/complete/spec-draft-secret-store-verification-footnote.md` §후속 양쪽이 이제
   "가드가 보는 8건(이동 7 + stale 앵커 1) + 손으로 고친 1건(펜스 안, 스캔 밖)"으로 숫자·범주가
   일치한다.
3. `webchat-command-failure-is-not-termination.md` §선행/참조의 "이동할" → "이동한" 정정 확인.

## 발견사항

- **[WARNING]** 이번 라운드의 plan 재편(이관 되돌림)이 코드 주석의 plan 포인터에는 반영되지 않음
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:21`
    (`walkPlanMarkdown` 위 "스캔 소스가 하나여야 하는 이유" 블록 — 신규 파일, 이번 diff로
    처음 추가됨)
    ```
    // 실측), 그 통합은 `harness-env-value-subpattern-dedup.md` 에 등재했다. "네 벌을 하나로
    ```
  - 관련 plan: `plan/in-progress/docs-guard-walker-dedup.md` §"함께 볼 것 — Gate C 의 4번째
    walker" (Gate C `collectCompletePlans` 재사용 판정 항목이 **실제로 등재된 자리**) vs
    `plan/in-progress/harness-env-value-subpattern-dedup.md` (코드 주석이 가리키는, 지금은
    틀린 자리 — 이 파일을 전문 대조했으나 `collectCompletePlans`/Gate C/walker 언급이 전혀 없음)
  - 상세: 이 코드 주석은 "Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans`는
    아직 독립 구현으로 남아 있고, 그 통합은 `harness-env-value-subpattern-dedup.md`에 등재했다"
    라고 말한다. 이 서술은 `review/code/2026/08/10/00_39_31/RESOLUTION.md`(주석이 작성된 시점)
    에서는 참이었다 — 그때는 walker 후속 2건이 실제로 `harness-env-value-subpattern-dedup.md`에
    있었다. 그런데 이번 재검토가 반영한 "이관 되돌림"(발견사항 1번)으로 그 항목은
    `docs-guard-walker-dedup.md`로 옮겨졌고, 코드 주석은 갱신되지 않았다. 전체 코드베이스에서
    `docs-guard-walker-dedup`을 참조하는 `.ts`/`.tsx` 파일이 0건임을 확인했다 — 즉 이 항목을
    "코드가 가리키는 plan"으로 찾아가는 유일한 경로(`plan-scan.ts` 주석)가 지금 **없어진
    항목을 가리킨다.** `docs-guard-walker-dedup.md` 자신의 Rationale이 정확히 이 실패 시나리오
    ("그 자리에 두면 …찾는 사람이 발견하지 못한다")를 경계해 신설된 것이라, 코드 쪽 포인터가
    그 경계를 정면으로 재현하고 있다는 점에서 아이러니하다. `review/**`의 같은 취지 언급
    (예: `review/code/2026/08/10/00_53_35/RESOLUTION.md` INFO#4)은 시점 기록 문서라
    `plan-lifecycle.md §3`에 따라 옛 경로 유지가 정상이지만, `plan-scan.ts`는 살아있는 소스
    코드이므로 같은 예외가 적용되지 않는다.
  - 제안: `plan-scan.ts:21`의 `harness-env-value-subpattern-dedup.md` 참조를
    `docs-guard-walker-dedup.md`로 정정. 코드 변경 없이 주석 한 줄만 고치면 되므로 다음
    편집 시 함께 반영 권장(현재 빌드 가드는 이 주석 내용을 검증하지 않으므로 build 차단
    사유는 아님).

## 요약

직전 라운드가 지적한 3건(이관 자리, 숫자/범주 불일치, 시제)은 plan 문서 레벨에서 모두
정확히 반영됐고, 신규 `docs-guard-walker-dedup.md`는 frontmatter 스키마·상호 참조·기술적
서술 모두 정합하다. 다만 그 재편(이관 되돌림) 자체가 코드 주석(`plan-scan.ts:21`)의
plan 포인터까지는 전파되지 않아, 코드에서 해당 후속 항목을 추적하려는 사람은 여전히 옛
(이제는 무관한) plan 파일로 안내된다 — 정확히 이번 재편이 막으려던 "발견 불가" 실패
시나리오가 코드 쪽에서 재발한 형태다. 새로 내려진 결정이 미해결 항목과 충돌하거나
선행 plan을 우회하는 CRITICAL급 문제는 발견되지 않았다.

## 위험도

LOW
