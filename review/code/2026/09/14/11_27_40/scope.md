# 변경 범위(Scope) 리뷰 — trigger-canary-hardening

## 검토 방법

`plan/in-progress/trigger-canary-hardening.md` 가 선언한 4개 항목(① 트리거 비밀 컬럼 3중 사본
repo-guard, ② `TriggerDto.workflow`(schedule) 양성 커버리지, ③ 캐너리 두 파일 주석 정리, ④ e2e
teardown 근거 정정)을 기준으로, 실제 diff(`git diff --stat origin/main...`, 16개 파일, +998/-27)의
각 파일·hunk 가 그 4개 항목 중 어디에 대응하는지 1:1로 대조했다.

## 발견사항

- **[INFO]** 정합 확인 — 코드 diff(파일 1~6)는 전부 4개 항목 중 정확히 하나에 대응하고, 그 밖의
  파일·영역을 건드리지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`(신규, 항목①),
    `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts`(신규, 항목①),
    `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`(항목③, 원문자→아라비아
    숫자 치환 + 자기수정 이력 문단 삭제 + 의역 표기 추가 — 세 지적 전부 커버),
    `codebase/backend/test/schedule-trigger.e2e-spec.ts`(항목②, `expectTriggerWorkflowRef` 3곳),
    `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` 및
    `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`(항목④, `afterAll` 주석 정정).
  - 상세: `schedule-trigger.e2e-spec.ts` 의 import 추가(`expectTriggerWorkflowRef`)는 3개 신규 호출
    지점에서 실사용되어 미사용 임포트가 아니다. `trigger-workflow-ref.spec.ts` 의 두 hunk 는 헤더
    docstring 과 케이스 헤딩 하나에 국한되며 나머지 테스트 로직(`it` 블록 본문)은 무편집이다.
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 diff(6개 hunk)도 전부
    L3932~L4104 사이 해당 4항목 구간에만 집중돼 있고, 5,000줄 넘는 트래커 문서의 다른 구간은
    건드리지 않았다.
  - 판단: 범위 이탈 없음.

- **[INFO]** `review/consistency/2026/09/14/10_44_37/*`(파일 9~16, `SUMMARY.md`·`_retry_state.json`·
  `meta.json`·5개 checker 리포트) 커밋은 코드 변경이 아니라 `/consistency-check --impl-prep` 실행
  산출물이다.
  - 위치: `review/consistency/2026/09/14/10_44_37/`
  - 상세: CLAUDE.md 는 "일관성 검토 산출물 → `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`"
    로 저장 위치를 명시하고, developer 워크플로는 "구현 착수 직전 `consistency-check --impl-prep`
    의무"를 규정한다. 이 커밋은 그 의무 이행의 산출물을 정해진 위치에 그대로 커밋한 것이라 "의도
    이상의 변경"이 아니다. 다만 코드 리뷰(scope) 관점에서 "코드 변경"과 "harness 프로세스 산출물"이
    같은 커밋/diff 안에 섞여 있다는 점은 기록해 둔다 — 내용 자체(checker 5개가 모두 CRITICAL 0·
    BLOCK:NO 를 보고)는 이 plan 의 범위 판단과 상충하지 않는다.
  - 판단: 범위 이탈 아님(harness 의무 산출물). 조치 불필요.

- **[INFO]** plan 문서 두 건(`trigger-canary-hardening.md` 신규, `spec-draft-nullable-notation-followups.md`
  갱신)에서 consistency-check 가 지적한 `spec/conventions/cafe24-api-catalog/_overview.md` frontmatter
  결여·`__` 표기 미문서화(W2·W3) 는 **직접 수정하지 않고** 새 트래커 항목으로만 등재했다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(신규 3항목, W1·W2·W3 각주)
  - 상세: `spec/**` 편집은 developer 권한 밖이라는 CLAUDE.md 경계를 정확히 지킨 처리다 —
    "고치고 싶은 유혹"에 넘어가 `spec/` 을 건드렸다면 그것이 범위 이탈이었을 텐데, 그렇게 하지
    않고 등재만 했다.
  - 판단: 범위 이탈 없음(오히려 경계 준수의 근거로 기록).

포맷팅·주석 전용 변경(임포트/설정 변경 포함)이 실질 로직 변경과 섞인 사례, 요청받지 않은 기능
확장, 무관한 파일 수정은 발견되지 않았다.

## 요약

diff 16개 파일 전부가 plan 문서가 스스로 선언한 4개 항목 중 정확히 하나에 대응하며, 각 파일의
hunk 범위도 그 항목이 요구하는 최소 표면(guard 신설 2파일·e2e 3파일 주석/단언 추가·트래커 갱신)에
그친다. 파일 7(트래커)의 편집도 5,000줄 넘는 문서 중 해당 구간에만 국한됐고, `spec/` 은 전혀
건드리지 않았으며 consistency-check 가 지적한 spec 결함은 직접 고치는 대신 권한 경계에 맞게
새 항목으로만 등재했다. `review/consistency/**` 산출물 커밋은 코드가 아니라 harness 의무 이행
산출물이며 지정된 저장 위치 규약을 따른다. 스코프 이탈·불필요한 리팩토링·기능 확장·무관한
수정·포맷팅 뒤섞임·불필요한 주석/임포트/설정 변경 어느 것도 관측되지 않았다.

## 위험도

NONE
