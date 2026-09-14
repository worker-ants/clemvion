# 변경 범위(Scope) 리뷰 — trigger-canary-hardening (라운드 3)

## 검토 방법

`plan/in-progress/trigger-canary-hardening.md` 가 선언한 4개 항목(① 트리거 비밀 컬럼 3중 사본
repo-guard, ② `TriggerDto.workflow`(schedule) 양성 커버리지, ③ 캐너리 두 파일 주석 정리, ④ e2e
teardown 근거 정정)을 기준으로, `origin/main...HEAD` 전체(3개 커밋 `efb0e4b36`→`4c1a49b30`→
`3f5e451b3`, 56개 파일 `+3891/-27`)와 이번 라운드에 새로 얹힌 델타(`3f5e451b3`, 23개 파일)를
각각 `git show --stat`/`git show -- <path>` 로 원본 diff 를 직접 열어 1:1 대조했다. 프롬프트에서
잘린 파일(7·8·10·11·15·19·26·30 등)은 워킹트리에서 `Read`/`git show` 로 보완했다.

```
$ git diff --stat origin/main...HEAD -- ':!plan/**' ':!review/**'
 .../trigger-secret-columns-guard.ts      | 123 +++++++
 .../trigger-secret-columns.spec.ts       | 174 +++++++++++
 .../trigger-workflow-ref.spec.ts         |  36 ++---
 .../chat-channel-trigger-create.e2e-spec.ts |   4 +
 .../schedule-trigger.e2e-spec.ts         |  22 +++
 .../trigger-workflow-ref.e2e-spec.ts     |  21 +-
 6 files changed, 357 insertions(+), 23 deletions(-)
```

## 발견사항

- **[INFO]** 실질 코드 diff(전 3커밋 누적)는 정확히 6개 파일이고, 전부 4개 선언 항목 중 하나에만
  대응한다 — 범위 이탈 없음.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`(신규,
    항목①), `.../trigger-secret-columns.spec.ts`(신규, 항목①),
    `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`(항목③, 헤더 docstring +
    케이스 헤딩 하나에 국한, `it` 본문 무편집), `codebase/backend/test/schedule-trigger.e2e-spec.ts`
    (항목②, `expectTriggerWorkflowRef` 3곳 — C-2/G/H), `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`
    및 `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`(항목④, `afterAll` 상단 JSDoc 만 —
    `git show`로 `afterAll` 실행부 diff 없음을 확인).
  - 상세: 마지막 커밋 `3f5e451b3`(라운드 2 fix)가 손댄 코드는 `trigger-secret-columns.spec.ts`
    단 하나이고, 그 변경은 (a) 라운드 1 fix 가 남긴 불필요한 중첩 템플릿 리터럴
    `` `${rel}: ${'…'}` `` → `` `${rel}: …` `` 로 단순화, (b) `existsSync` 방어 분기가 spec
    삭제에도 GREEN 을 유지하던 회귀(`/ai-review` `11_52_13` testing WARNING#2) 를 잡는 대조군
    `it()` 신설(`.toThrow(/옮겨졌거나 이름이 바뀌었다/)`) 두 가지뿐이다. 새 파일·새 call site·
    프로덕션 코드 변경은 없다. `package.json`·`tsconfig*`·`.eslintrc`·CI 워크플로 등 설정 파일도
    3커밋 전체에서 0건 변경(`git diff --stat` 로 확인).
  - 판단: 범위 이탈 없음.

- **[INFO]** 3개 커밋 각각이 "코드 fix + 그 fix 를 유발한 직전 라운드 리뷰/컨시스턴시 산출물 +
  plan 갱신"을 함께 커밋하는 패턴이 반복되지만, 이는 이 프로젝트의 강제 review-fix 루프
  (`CLAUDE.md` "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무") 산출물이며 새로운 관행이
  아니다.
  - 위치: `4c1a49b30`(코드 fix 2파일 + `review/code/11_27_40/**` + `review/consistency/11_27_47/**`),
    `3f5e451b3`(코드 fix 1파일 + `review/code/11_52_13/**` + `review/consistency/11_52_23/**`)
  - 상세: 각 커밋이 "그 직전 세션(`/ai-review`+`--impl-done`)의 지적사항을 고치는 동시에, **그
    지적사항 자체가 담긴 리뷰 산출물**을 같은 커밋에 실은 것"이라 코드 diff 와 harness 산출물이
    섞여 있다. 다만 이 저장소는 두 게이트가 번갈아 stale 되는 구조라(기록된
    `feedback_review_fix_stale_loop.md`) 라운드마다 산출물을 그때그때 커밋하는 편이 실무적으로
    맞고, 실제로 코드 변경 자체는 매 라운드 산출물이 지목한 자리에만 국한됐다(위 항목 참고). 세
    커밋 모두 `codebase/**` 수정이 그 라운드 리뷰가 지목한 결함 하나(또는 소수)로 좁혀져 있어
    "의도 이상의 변경"으로 보기 어렵다.
  - 판단: 범위 이탈 아님(강제 워크플로 산출물). 다만 최종 병합 전 리뷰-only 커밋으로 한 번 더
    정리하는 관례("코드 커밋 → 세션 → SUMMARY → 리뷰-only 커밋")를 따를지는 merge 단계 판단.

- **[INFO]** plan 문서 갱신(`trigger-canary-hardening.md`, `spec-draft-nullable-notation-followups.md`)
  의 이번 라운드 diff는 라운드 2 리뷰가 지목한 자리(등재 수치 오류 3건, `secret-store.md §R4` 오기)
  로만 국한되고, 그 중 하나(`_overview.md` frontmatter 미비 주장)는 **false positive 로 철회**됐다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 항목이 삭제되고
    "§7.1 상호참조 한 줄" 로 축소), `plan/in-progress/trigger-canary-hardening.md` §라운드 2 기록
  - 상세: `spec/**` 는 여전히 한 글자도 편집하지 않았고(delta 0, `git diff --stat` 확인), 잘못
    등재했던 항목을 지우고 더 좁은 진짜 갭으로 대체한 것은 오히려 트래커 위생을 개선하는 방향이다.
    "고치고 싶은 유혹"에 spec 을 직접 건드리는 대신 등재로만 처리한 권한 경계 준수도 라운드 1·2와
    동일하게 유지된다.
  - 판단: 범위 이탈 없음.

포맷팅·주석 전용 변경이 실질 로직 변경과 섞인 사례, 요청받지 않은 기능 확장(예: 단건 조회
schedule `workflow` 커버리지 — 별도 backlog 항목으로만 등재하고 실제 구현하지 않음), 무관한 파일·
설정 변경은 이번 라운드에서도 발견되지 않았다.

## 요약

3개 커밋 누적 diff(56파일, +3891/-27) 중 실질 코드 변경은 정확히 6개 파일(+357/-23)이며, 그
전부가 plan 이 스스로 선언한 4개 항목 중 하나에 대응한다. 이번 라운드에 새로 얹힌 델타
(`3f5e451b3`)는 직전 `/ai-review`·`--impl-done` 세션이 지목한 결함(중첩 템플릿 리터럴 잔재,
`existsSync` 방어 분기의 vacuous 회귀 방지 부재, 트래커 등재 수치·false positive 3건)만 고치는
좁은 범위이고, 새 파일·새 프로덕션 로직·설정 변경은 없다. 각 커밋이 "코드 fix + 해당 라운드
리뷰 산출물 + plan 갱신"을 함께 싣는 패턴은 반복되지만 이는 이 저장소가 강제하는 review-fix
루프의 산출물이지 임의의 범위 확장이 아니다. `spec/**` 편집은 여전히 0건이고, spec 결함(등재
오류 포함)은 직접 고치는 대신 트래커 등재/철회로만 처리해 developer 권한 경계를 지켰다. 범위
이탈·불필요한 리팩토링·기능 확장·무관한 수정·포맷팅 뒤섞임·불필요한 주석/임포트/설정 변경
어느 것도 관측되지 않았다.

## 위험도

NONE
