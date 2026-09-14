# 변경 범위(Scope) 리뷰 — trigger-canary-hardening (라운드 5)

## 검토 방법

`plan/in-progress/trigger-canary-hardening.md` 가 선언한 4개 항목(① 트리거 비밀 컬럼 3중 사본
repo-guard, ② `TriggerDto.workflow`(schedule) 양성 커버리지, ③ 캐너리 두 파일 주석 정리, ④ e2e
teardown 근거 정정)을 기준으로, `git diff origin/main...HEAD` 전량(96개 파일, +7362/-27)을
`codebase/**`·`plan/**`·`review/**` 세 영역으로 나눠 각 파일·hunk 가 그 4개 항목 또는 harness
의무 산출물 중 어디에 대응하는지 1:1로 대조했다. 5개 커밋(`efb0e4b36` 최초 구현 +
`4c1a49b30`/`3f5e451b3`/`1a99f07a4`/`026fbb610` 4회 리뷰 fix)을 각각 `git show --stat`으로
분리 확인했다. 신설 파일 2개(`trigger-secret-columns-{guard.ts,spec.ts}`)는 최종 상태를 전량
`Read`했다.

## 발견사항

- **[INFO]** `codebase/**` 실질 코드 diff(6개 파일, `git diff --name-only`로 확인)는 전부 plan
  이 선언한 4개 항목 중 정확히 하나에 대응하고, 그 밖의 파일·영역(특히 `triggers.service.ts` 등
  프로덕션 서비스 코드)은 이번 브랜치에서 전혀 수정되지 않았다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`(신규,
    항목①), `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts`(신규
    +4회 fix, 항목①), `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`(항목③,
    docstring 2-hunk에 국한), `codebase/backend/test/schedule-trigger.e2e-spec.ts`(항목②,
    `expectTriggerWorkflowRef` 3곳: C-2 목록·G/H PATCH), `codebase/backend/test/chat-channel-
    trigger-create.e2e-spec.ts`·`codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`(항목④,
    `afterAll` JSDoc 정정 — 정리 로직 본문은 무편집).
  - 상세: `git diff --name-only origin/main...HEAD | grep -v '^review/'`로 확인한 비-리뷰
    파일은 정확히 이 6개 코드 파일 + `plan/in-progress/` 2개 문서뿐이다. 4회의 fix 커밋
    (`4c1a49b30`/`3f5e451b3`/`1a99f07a4`/`026fbb610`)도 `git show --stat`으로 개별 확인한 결과
    전부 `trigger-secret-columns.spec.ts` 단일 파일 내부(각각 vacuous 삼항식 분리, `existsSync`
    분기 대조군, 괄호 언랩 대조군, `null`/`[]` 경계 대조군 추가)에 그쳤다 — 항목① 밖으로 번진
    수정이 없다. `schedule-trigger.e2e-spec.ts`의 신규 import(`expectTriggerWorkflowRef`)는
    3개 호출부에서 실사용돼 미사용 임포트가 아니다.
  - 판단: 범위 이탈 없음.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`(5,000줄+ 트래커)의
  diff는 전부 이 4항목의 체크박스 전환(`[ ]`→`[x]`) + 실측 각주이거나, 리뷰 과정에서 새로
  발견된 항목을 **직접 고치지 않고 등재만** 한 부분이다(`secret-store.md §R4`의
  `delete()`→`remove()` 오기, `2-trigger-list.md` `code:` 갭, repo-guard `code:` 미등재 관례,
  단건 조회 커버리지, harness 번들 절단 등 — 전부 `planner`/`harness` owner로 등재, `spec/**`는
  건드리지 않음).
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 상세: `spec/**` 편집은 developer 권한 밖이라는 CLAUDE.md 경계를 그대로 지켰다. 유일하게
    직접 처분한 항목(`migrations/V063__secret_store.sql`의 `delete()` 오기)은 "**고치지 않는
    것이 정답**"이라는 결론(Flyway 체크섬 검증 대상이라 수정 시 회귀)까지 근거와 함께
    적어뒀다 — 이는 코드 변경이 아니라 판단의 등재다.
  - 판단: 범위 이탈 없음(오히려 권한 경계 준수의 근거).

- **[INFO]** `review/code/2026/09/14/{11_27_40,11_52_13,12_17_14,12_37_01}/**`(라운드 1~4
  `/ai-review` 산출물)와 `review/consistency/2026/09/14/{10_44_37,11_27_47,11_52_23,12_17_21,
  12_37_09}/**`(`--impl-prep`/`--impl-done` 5회 산출물) — 총 88개 파일 — 은 코드 변경이 아니라
  CLAUDE.md가 규정한 "구현 완료 후 자동 review/fix" 강제 의무의 산출물이며, 지정된 저장 위치
  규약(`review/code|consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)을 그대로 따른다.
  - 위치: `review/code/2026/09/14/**`, `review/consistency/2026/09/14/**`
  - 판단: 범위 이탈 아님. 내용상으로도 4회의 사이클이 실제 코드 결함(항목① 내부의 vacuous
    assertion·대조군 누락 4건)만 지적했고 지적 밖 파일로 fix가 번진 사례는 없다.

- **[INFO]** (기록 확인, 새 지적 아님) 4개 fix 커밋 각각이 코드 수정 + 해당 라운드의 plan
  체크리스트 갱신 + 그 라운드의 리뷰/컨시스턴시 산출물(신규 `review/**` 파일)을 **한 커밋에**
  담고 있다 — 이 저장소 MEMORY가 기록한 권장 순서("코드 커밋 → 세션 → SUMMARY →
  리뷰-only 커밋")와 다르다.
  - 위치: 커밋 `4c1a49b30`/`3f5e451b3`/`1a99f07a4`/`026fbb610` 각각의 `git show --stat`
  - 상세: 이 편차는 라운드 2 `RESOLUTION.md`(`review/code/2026/09/14/11_52_13/RESOLUTION.md`
    항목#6)에서 이미 "다음 **배치**에서 지킨다"로 자체 기록됐다 — "다음 배치"는 이번 PR
    내부의 다음 라운드가 아니라 향후 별개 작업을 가리키므로, 라운드 3·4가 같은 패턴을
    반복한 것이 그 자체 약속을 어긴 것은 아니다. 다만 코드 diff와 harness 산출물이 계속
    같은 커밋에 섞여 있다는 사실 자체는 스코프 리뷰 관점에서 기록해 둔다 — 실질 영향은
    없다(각 커밋의 코드 변경분은 여전히 항목①에만 국한).
  - 제안: 조치 불필요(이미 등재·설명된 사항). 향후 별개 작업에서 순서를 지킬 계획이라는
    점만 확인.

포맷팅·주석 전용 변경이 실질 로직 변경과 섞인 사례, 요청받지 않은 기능 확장(over-engineering),
무관한 파일·코드 영역 수정, 불필요한 리팩토링, 불필요한 임포트/설정 변경은 이번 라운드에서도
발견되지 않았다.

## 요약

라운드 5 시점의 누적 diff(96개 파일, +7362/-27)에서 `codebase/**` 실질 변경은 여전히 6개
파일뿐이며, 각각 plan `trigger-canary-hardening.md`가 선언한 4개 항목 중 정확히 하나에
1:1로 대응한다. 4회의 리뷰 fix 커밋도 전부 신설 repo-guard spec(`trigger-secret-columns.spec.ts`)
내부에서만 이뤄져 스코프가 번지지 않았고, 프로덕션 서비스 코드(`triggers.service.ts` 등)는
브랜치 전체에서 한 줄도 수정되지 않았다. 트래커 문서의 대량 diff는 해당 4항목의 완료 처리와
권한 밖 발견의 등재로만 구성돼 developer/planner 경계를 지켰고, 나머지 88개 파일은 전부
지정된 위치의 harness 의무 산출물(`review/code/**`·`review/consistency/**`)이다. 코드 fix
커밋에 리뷰 산출물·plan 갱신이 함께 담기는 패턴이 4라운드 내내 반복된 점은 기록해 두지만,
이는 이미 자체 인지·설명된 사항이고 각 커밋의 코드 변경 범위 자체에는 영향이 없다. 스코프
이탈·불필요한 리팩토링·기능 확장·무관한 수정·포맷팅 뒤섞임·불필요한 주석/임포트/설정 변경
어느 것도 관측되지 않았다.

## 위험도

NONE
