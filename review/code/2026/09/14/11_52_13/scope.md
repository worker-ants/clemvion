# 변경 범위(Scope) 리뷰 — trigger-canary-hardening (라운드 2)

## 검토 방법

`plan/in-progress/trigger-canary-hardening.md` 가 선언한 4개 항목(① 트리거 비밀 컬럼 3중 사본
repo-guard, ② `TriggerDto.workflow`(schedule) 양성 커버리지, ③ 캐너리 두 파일 주석 정리, ④ e2e
teardown 근거 정정)을 기준으로, `git diff origin/main...HEAD --stat`(36개 파일, +2260/-27,
커밋 `efb0e4b36`+`4c1a49b30` 2개)의 각 파일·hunk 가 그 4개 항목 또는 라운드 1 `/ai-review`·
`--impl-done` 지적 처분 중 어디에 대응하는지 1:1로 대조했다. 두 커밋을 각각 `git show --stat`/
`git show -- <path>` 로 열어 실제 diff 본문을 직접 확인했다(프롬프트 요약이 아니라 원본 대조).

## 발견사항

- **[INFO]** 코드 diff(파일 1~6, `efb0e4b36`+`4c1a49b30` 누적)는 전부 4개 항목 중 정확히
  하나에 대응하고, 그 밖의 파일·영역을 건드리지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`(신규,
    항목①), `.../trigger-secret-columns.spec.ts`(신규, 항목①),
    `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`(항목③ — 원문자→아라비아
    숫자 통일 + 자기수정 이력 문단 삭제 + 의역 표기 추가, `## 가드` 헤딩 및 헤더 docstring
    범위에 국한), `codebase/backend/test/schedule-trigger.e2e-spec.ts`(항목②,
    `expectTriggerWorkflowRef` 3곳 신규 삽입 — C-2/G/H), `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`
    및 `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`(항목④, `afterAll` 상단 JSDoc
    정정만 — `git show`로 `afterAll` 실행부 diff 없음을 확인).
  - 상세: 라운드 2(`4c1a49b30`)에서 추가된 diff 도 전부 라운드 1 리뷰(`review/code/2026/09/14/11_27_40`)가
    지적한 자리에만 국한된다 — `trigger-secret-columns.spec.ts`(WARNING#2 vacuous 삼항식 →
    `if (value === null) throw` 로 교체), `trigger-secret-columns-guard.ts`(INFO#1 감시범위 한계
    JSDoc 한 문단, INFO#5 파일 부재 방어 `fs.existsSync` 블록), `schedule-trigger.e2e-spec.ts`
    헤더(INFO#3 신규 축 한 줄). 새로운 로직·새로운 파일·새로운 call site 는 추가되지 않았다.
  - 판단: 범위 이탈 없음.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 diff(신규 5항목
  등재 + 기존 4항목 `[x]` 체크 및 해소 각주)는 5,000줄 넘는 트래커 문서 중 해당 4개 원 항목 +
  라운드 1/2 리뷰가 낸 신규 지적(§3 `code:` 갭, repo-guard 등재 관례, 단건 조회 갭, 번들 절단,
  `_overview.md` frontmatter, `__` 표기)에 대응하는 구간에만 국한됐다 — `git diff`로 직접 확인,
  트래커의 다른 구간(다른 날짜 항목들)은 무편집.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 판단: 범위 이탈 없음. `spec/` 자체는 전혀 건드리지 않았고, consistency-check 가 지적한
    spec 결함(`_overview.md` frontmatter 결여·`__` 표기 미문서화)을 직접 고치는 대신 developer
    권한 경계에 맞춰 새 트래커 항목으로만 등재한 것도 확인됨(§자기-반증형 소정정 5조건에
    해당하지 않는 사안이라 등재가 맞는 처분).

- **[INFO]** `review/code/2026/09/14/11_27_40/*`(9개 파일)·`review/consistency/2026/09/14/10_44_37/*`(8개)·
  `review/consistency/2026/09/14/11_27_47/*`(9개) 커밋분은 코드 변경이 아니라 `/ai-review`·
  `/consistency-check --impl-prep`·`--impl-done` 실행이 남긴 harness 의무 산출물이다.
  - 위치: `review/code/2026/09/14/11_27_40/`, `review/consistency/2026/09/14/{10_44_37,11_27_47}/`
  - 상세: CLAUDE.md 는 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`",
    "일관성 검토 산출물 → `review/consistency/...`" 로 저장 위치를 못박고, developer 워크플로는
    "구현 착수 직전 `--impl-prep` 의무" + "`/ai-review`+critical/warning fix 는 상시 승인된
    강제 의무"를 규정한다. 이 파일들은 그 의무 이행 산출물을 정해진 위치에 그대로 커밋한
    것이라 "의도 이상의 변경"이 아니다. 다만 라운드 2 커밋(`4c1a49b30`)이 **코드 수정
    3개 파일 + 트래커 갱신 2개 파일 + harness 산출물 25개 파일을 한 커밋에 함께 묶었다** —
    저장소 MEMORY(`feedback_review_fix_stale_loop.md`)가 권장하는 순서는 "코드 커밋 → 그 뒤
    세션 → SUMMARY → **리뷰-only 커밋(분리)** → push" 인데, 이번엔 리뷰 산출물이 fix 커밋과
    합쳐졌다. 내용 충돌이나 은폐는 없고(커밋 메시지가 두 리뷰 결과를 명시적으로 인용) 이
    저장소가 실제로 매 라운드 분리 커밋을 강제하는 하드 룰인지는 문서상 "권장 순서"로만
    확인되어 CRITICAL/WARNING 으로 올리지 않는다.
  - 판단: 범위 이탈 아님(harness 의무 산출물, 지정 위치 준수). 커밋 분리 방식은 참고용 INFO.

- **[INFO]** `trigger-workflow-ref.spec.ts` 의 원문자(①②③…)→아라비아 숫자 치환은 표기 변경이지만
  plan 항목③이 명시적으로 선언한 "정리 3건" 중 하나(①)이며, 같은 hunk 안에서 실질 테스트 로직
  (`it` 블록 본문)은 무편집이다 — 포맷팅과 실질 변경이 뒤섞인 사례가 아니라 포맷팅 자체가
  선언된 작업 항목이다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (헤더 docstring +
    `## 가드 3·5` 헤딩)
  - 판단: 범위 이탈 없음.

포맷팅·주석 전용 변경이 실질 로직 변경과 부적절하게 섞인 사례, 요청받지 않은 기능 확장,
무관한 파일 수정, 사용하지 않는 임포트, 의도하지 않은 설정 변경은 발견되지 않았다.
`schedule-trigger.e2e-spec.ts` 의 신규 `import { expectTriggerWorkflowRef }` 는 3개 신규
호출 지점에서 실사용된다(미사용 임포트 아님, `git show` 로 확인).

## 요약

diff 36개 파일 전부가 plan 문서가 스스로 선언한 4개 항목 중 정확히 하나, 혹은 라운드 1
`/ai-review`·`--impl-done` 이 낸 지적의 직접 처분(코드 3곳 수정 + 트래커 등재 5건)에
대응하며, 각 파일의 hunk 범위도 그 대응 관계가 요구하는 최소 표면을 벗어나지 않는다.
라운드 2 커밋(`4c1a49b30`)은 새 로직·새 파일을 추가하지 않고 라운드 1 리뷰가 지적한 자리만
정확히 고쳤다. `spec/` 은 전혀 건드리지 않았고, consistency-check 가 지적한 spec 결함은
권한 경계에 맞게 트래커 등재로만 처리했다. `review/code/**`·`review/consistency/**` 산출물
커밋은 코드가 아니라 harness 의무 이행 산출물이며 지정된 저장 위치 규약을 따른다 — 다만
코드 fix 와 리뷰 산출물이 한 커밋에 합쳐진 점은 이 저장소 MEMORY 가 권장하는 "리뷰-only 커밋
분리" 관례와 다소 어긋나 참고용으로 기록했다(블로킹 아님). 스코프 이탈·불필요한 리팩토링·
기능 확장·무관한 수정·포맷팅 뒤섞임·불필요한 주석/임포트/설정 변경 중 어느 것도 관측되지
않았다.

## 위험도

NONE
