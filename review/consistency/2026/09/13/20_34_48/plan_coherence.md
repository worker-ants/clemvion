# Plan 정합성 검토 — error-code-emission-axis (impl-done 라운드 4, scope=spec/conventions/)

## 사전 확인

명목 target 은 `spec/conventions/`(diff-base `origin/main`)이지만, 절대경로로 직접 확인한 결과
이 스코프의 델타는 **0개 파일**이다(코드 전용 PR). 실제 diff(`git diff origin/main...HEAD
--name-only`, HEAD=`5778885ce`, base=`afaef5bef`)는 다음 4개 코드 파일뿐이다:

- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
- `codebase/frontend/src/content/docs/02-nodes/logic.mdx` / `logic.en.mdx`

`plan/**` 변경은 `plan/in-progress/error-code-emission-axis.md`(신규, 403줄)와
`plan/in-progress/spec-draft-nullable-notation-followups.md`(diff, +57/-1줄)뿐이다.

**직전 plan_coherence 라운드**(`review/consistency/2026/09/13/20_13_19/plan_coherence.md`,
검토 대상 `a4b98eda8`)와의 델타를 먼저 실측했다 — `git show --stat 5778885ce`로 확인한 결과
이번 라운드가 새로 다루는 커밋은 **`5778885ce`** 하나이고, 그것이 건드린 파일은
`guide-identifier-existence.test.ts`(+25/-6줄, `staleEntries` 대조군 보강) +
`plan/in-progress/error-code-emission-axis.md`(+62줄, §G 라운드 3 기록) + `review/**` 산출물
뿐이다. **`spec/**` 도 `spec-draft-nullable-notation-followups.md` 도 이 커밋에서 변경되지
않았다** — 즉 직전 라운드가 검증한 plan 정합성 영역은 이번 라운드에서 그대로 유지된다.

## 발견사항

- **[INFO]** `user-guide-evidence.md §2` 미등재 백로그가 누적 3라운드째 그대로 남아 있다 —
  developer 권한 밖이라 위반은 아니다
  - target 위치: `spec/conventions/user-guide-evidence.md §2`("Build-time 가드 (3건)" 표,
    직접 열람 확인 — `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 행 없음,
    frontmatter `code:` 목록에도 없음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3247-3273`
    ("`user-guide-evidence.md §2.1` 관계표에 신규 가드 2건이 빠져 있다", planner 등재·
    등재 위치 "(a) Overview 확장 vs (b) 신규 §6" 택일 대기)
  - 상세: 이 배치(라운드 1~3 누적)는 `guide-identifier-existence.test.ts`/
    `guide-identifier-scan.ts` 에 **발행(emission) 축**과 신규 예외 목록
    (`GUIDE_NON_EMITTED_VOCABULARY`)을 추가해, pending 항목이 원래 지목했던 시점보다
    가드 표면이 한 겹 더 넓어졌다. pending 항목의 서술("가이드가 적은 식별자(에러 코드+
    환경변수)가 실재하는가")은 이제 발행 축을 설명하지 못해 문면상 stale 하다. 다만
    `error-code-emission-axis.md` frontmatter `spec_impact: none` 은 정확하고
    `spec/conventions/**` 델타 0 과 일치하며, 이 gap 을 spec 에 반영하는 것 자체가
    developer 권한 밖(`spec/` 쓰기)이라 이번 PR 이 처리하지 않은 것은 정당하다.
    **"미해결 결정과의 충돌"·"선행 plan 미해소" 어느 쪽도 아니다** — pending 항목이 아직
    "등재 위치"조차 정하지 않은 상태라 이번 PR 이 무언가를 앞질러 결정한 것이 없다.
    라운드 2(`19_51_39`)·라운드 3(`20_13_19`) plan_coherence 가 이미 같은 관찰을 INFO 로
    냈고, 라운드 3→4 사이 `spec/**`·해당 plan 문단 어느 쪽도 변경되지 않아 판단이 바뀔
    근거가 없다.
  - 제안: 없음(조치 불요). pending 항목이 처리될 때 코드를 다시 읽으면 발행 축은 자동으로
    드러난다.

- **[INFO]** 트래커 L3404(`CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT`) 해소가
  라운드 3 이후에도 유효함 — 재확인
  - target 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx`/`.en.mdx` (직접
    diff 확인 — "메시지 앞에 붙어요 — 전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야
    해요" / "the failure **message is prefixed**... there is no dedicated error code")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3404-3414`
  - 상세: 라운드 1 WARNING → 라운드 2·3 에서 이미 확인·종결된 항목. 라운드 3→4 사이 커밋
    (`5778885ce`)이 이 plan 문단이나 guide mdx 를 건드리지 않았으므로 상태 변화 없음.
  - 제안: 없음.

- **[INFO]** 새로 등재된 두 planner 결정 항목(spec 6파일의 `CONTAINER_*` "코드" 서술 정정,
  `3-error-handling.md §1.4` 카탈로그 앵커 표기 택일)은 여전히 `spec/conventions/` 스코프
  밖이고 이번 라운드가 침범하지 않음
  - target 위치: 없음 (`spec/5-system/4-execution-engine.md`·`spec/3-workflow-editor/*`·
    `spec/4-nodes/1-logic/*` 소속 — `spec/conventions/` 밖)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3416-3459`
    ("어느 쪽이든 이 배치의 가드를 건드리므로 처분 시 함께 판정할 것" — 등록 2종이
    §1.4 backfill 시 불필요해질 수 있음을 스스로 명기)
  - 상세: 라운드 1~3 이 이미 "가드가 카탈로그를 요구조건이 아니라 탈출구로 쓰는 설계라
    어느 택일로 귀결돼도 깨지지 않는다"를 확인했다. 라운드 3→4 커밋은 이 plan 문단·
    대상 spec 파일 어느 쪽도 변경하지 않았으므로 결론 불변. 이 항목은 developer 가
    선제적으로 결정을 내린 것이 아니라 **`(a)`/`(b)` 둘 다 열어 둔 채** 가드를
    "택일 결과에 무관하게 깨지지 않도록" 설계했다고 스스로 명시하고 있어, "미해결 결정과의
    충돌"에 해당하지 않는다.
  - 제안: 없음.

## 요약

라운드 4 검토 대상 신규 커밋(`5778885ce`)은 가드 코드(`guide-identifier-existence.test.ts`
1파일)와 이 PR 자신의 plan 파일(`error-code-emission-axis.md` §G)만 수정했고 `spec/**`·
`spec-draft-nullable-notation-followups.md` 변경이 없다. 이 배치가 의존하는 두 개의 미해결
planner 결정(spec 6파일의 `CONTAINER_*` 서술 정정, `error-handling.md §1.4` 카탈로그 표기
택일)과 이미 등재된 `user-guide-evidence.md` 미등재 백로그를 절대경로로 직접 재확인한 결과,
라운드 2·3 의 결론에서 달라진 것이 없다 — "미해결 결정과의 충돌"·"선행 plan 미해소"·
"후속 항목 누락" 세 축 모두 이번 라운드에서 새로 발생한 위반이 없다. 세 INFO 항목은 모두
developer 권한 밖(spec 쓰기)이거나 이미 등재·확인된 상태의 재확인이다.

## 위험도

NONE
