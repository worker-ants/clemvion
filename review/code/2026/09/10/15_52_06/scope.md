# 변경 범위(Scope) 리뷰 — 2라운드 (`c696ace07`, 리뷰 지적 13건 반영 + plan/review 문서 갱신)

## 검증 방법 요약

- `git show --stat c696ace07` / `git diff --stat f71aa584e c696ace07` — 이번 라운드(1라운드 이후)
  실제로 바뀐 29개 파일 전수 확인
- `git diff origin/main...HEAD -- 'codebase/**'` — `codebase/` 안 변경이 여전히 3개 신규 파일뿐인지
  재확인 (1라운드부터 지금까지 누적)
- `git diff origin/main -- codebase/backend/src/modules/triggers/triggers.service.ts` +
  `git show origin/main:… | md5` vs `git show HEAD:… | md5` — 뮤테이션 잔존 여부 바이트 단위 확인
- `git diff origin/main...HEAD -- 'spec/**'`, `-- '**/package.json' '**/tsconfig*.json' …` —
  spec/설정 파일 diff 0건 확인
- `codebase/backend`에서 `npx prettier --check`(3.9.6, 핀 버전)로 3개 변경 파일 재검증
- `plan/in-progress/harness-review-gate-followups.md`, `spec-draft-nullable-notation-followups.md`,
  `plan/complete/trigger-workflow-ref-canary.md` (rename 포함) 전체 diff 열람 — 신규 등재 항목이
  실제로 이 세션의 review/consistency 산출물에서 나왔는지 원문 대조
- `git log -3 -- plan/in-progress/harness-review-gate-followups.md` +
  `git show f71aa584e:… | grep`로 "승격은 됐는데 굶는다" 섹션이 **이번 커밋 이전에 이미 존재**했는지
  확인 (다른 세션이 그날 오전에 등재한 것인지 판별)
- `git status --short` — 리뷰 세션 자신의 untracked 산출물 외 잔존물 없음 확인 (본 리뷰는 저장소를
  전혀 mutate 하지 않았음 — 별도 뮤테이션 실험 불요, 이미 다른 reviewer 산출물로 검증된 내용을
  git 명령으로 재확인만 함)

## 발견사항

없음(CRITICAL/WARNING 없음). 아래는 참고용 INFO 한 건.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`에 이번 라운드에서
  추가된 분량이 매우 크다(221줄, 커밋 전체 diff 중 약 7%).
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (`TriggerDto.workflow`
    캐너리 항목 및 그 아래 신규 `- [ ]` 블록들)
  - 상세: 분량 자체는 "의도 이상의 변경"이 아니라 `RESOLUTION.md`에 적힌 Critical 2건·후속
    이관 4건·planner 후속 2건을 트래커에 전부 옮겨 적은 결과다. 항목 하나하나를
    `review/code/2026/09/10/14_34_18`의 특정 reviewer 지적(`api_contract` ④/⑤,
    `maintainability` W1, `side_effect` W1/W2, `testing` INFO)에 대조했고 전부 일치했다 — 임의로
    지어낸 신규 작업이 아니다. 이 저장소의 관례(발견한 이슈를 그 턴에 기록하지 않으면 잃어버린다,
    memory `feedback_review_fix_stale_loop`)에 부합하는 방어적 문서화로 판단.
  - 제안: 조치 불요. 분량 자체가 스코프 위반의 신호는 아님을 참고용으로 남김.

## 점검 관점별 결과

1. **의도 이상의 변경**: 없음. `codebase/` 안 diff는 여전히 정확히 3개 파일(`trigger-workflow-ref.ts`,
   `.spec.ts`, `test/trigger-workflow-ref.e2e-spec.ts`)뿐이고, 이번 라운드에서 그 3개 파일에 가해진
   수정 각각을 `RESOLUTION.md`의 "코드 수정 12건 + 13번째"표와 1:1 대조했다 — 표에 없는 diff hunk가
   없다(`isUuidShaped` import·`expectedWorkflowId`·최상위 `null` 거부·라벨 `1~5→A~E`·타임아웃 상수
   분리·`secret_store` 주석·R-CC-10 경고 docstring, 전부 표에 등재된 항목과 정확히 일치).
2. **불필요한 리팩토링**: 없음. 손으로 짠 UUID 정규식을 정본 `isUuidShaped`로 교체한 것은
   "리팩토링"이 아니라 `maintainability` W2 지적에 대한 직접 수정이고, 그 함수는 이미 존재하는
   정본을 그대로 가져다 쓴 것뿐이다(신규 유틸 작성 없음). 다른 기존 파일에는 리팩토링성 diff가
   전혀 없다.
3. **기능 확장(over-engineering)**: 없음. `expectedWorkflowId` 옵션 추가는 리뷰가 지적한 실제
   구멍(shape만 보면 엉뚱한 relation이 통과)을 막는 최소 수정이고, self-spec 4건 추가도 각각
   특정 사각지대(비-문자열 `name`/`id`, 최상위 `null`, identity 불일치) 하나씩을 정확히 겨냥한다.
   방어 범위를 임의로 넓힌 흔적 없음.
4. **무관한 수정**: 없음. `spec/**` diff 0건(`origin/main...HEAD` 전체 기준), 설정 파일
   (`package.json`/`tsconfig*`/`.eslintrc*`/`.prettierrc*`/`jest*`) diff 0건. `triggers.service.ts`는
   `origin/main`과 md5 완전 일치 — 저자가 이번 라운드에도 수행했다는 `relations` 뮤테이션 실험은
   흔적 없이 원복됐다.
5. **포맷팅 변경**: 없음. backend 패키지 핀 버전(prettier 3.9.6)으로 3개 변경 파일을 재검증해
   전부 통과. drive-by 리포맷 대상이 될 다른 파일 diff 자체가 없다.
6. **주석 변경**: 이번 라운드 diff 대부분이 JSDoc/인라인 주석 보강(과장된 근거 문장 정정,
   `expectedWorkflowId`/최상위 `null` 처리 이유 설명, R-CC-10 우회 경고 등)인데, 전부
   `RESOLUTION.md`가 명시한 "내가 쓴 근거 문장 셋이 반증됐다" 정정과 13번째 수정(코드 참조 부재)에
   해당한다. 코드 동작과 무관한 장식적 주석 추가는 없음. 13번째 수정(e2e case E docstring)은
   `git diff`로 확인한 대로 단언·요청 바디·기대값을 전혀 바꾸지 않은 순수 주석 diff임을 재확인했다.
7. **임포트 변경**: `trigger-workflow-ref.ts`에 `isUuidShaped` import 1건 추가 — 실사용 확인,
   미사용 import 없음. e2e-spec.ts는 기존 import 목록 그대로(diff에 import 라인 변경 없음),
   `workflowId` 변수는 이미 `beforeAll`에서 선언·할당되던 것을 새로 `expectedWorkflowId`에 넘기는
   용도로 재사용한 것뿐이라 신규 심볼 도입이 아니다.
8. **설정 변경**: 없음(위 5·확인 명령 참고).

## 뮤테이션 잔존물 확인 (1라운드 + 2라운드 누적)

- `codebase/backend/src/modules/triggers/triggers.service.ts` — `origin/main`과 **md5 완전
  일치**(`f1377a76ef26dde2a12d0be65370d773`), `git diff origin/main -- <그 파일>` 빈 결과.
  1라운드(`relations: ['workflow']` 제거)·2라운드(같은 파일, `RESOLUTION.md`가 서술한 재실험)
  뮤테이션 모두 흔적 없이 원복됨.
- `git status --short`는 이 리뷰 세션 자신이 쓰기 시작한
  `review/code/2026/09/10/15_52_06/`(본 세션 출력 디렉터리) 외에는 아무것도 보고하지 않는다 —
  다른 잔존 뮤테이션·백업 파일 없음.
- `trigger-workflow-ref.ts`/`.spec.ts` 자체는 2라운드 커밋으로 **의도된 최종 상태**로 바뀐 것이지
  뮤테이션 잔존이 아니다(diff가 RESOLUTION.md 서술과 정확히 일치함을 위에서 확인).

## `plan/in-progress/harness-review-gate-followups.md` 편집이 이 작업 범위에 속하는가

**속한다.** 두 부분으로 나눠 확인했다.

- **§M 신규 섹션(전체)**: 이 세션(`trigger-workflow-ref-canary`) 자신의
  `--impl-done`(`review/consistency/2026/09/10/15_23_41`)에서 `naming_collision`과
  `rationale_continuity` 두 checker가 **독립적으로** 지적한 하네스 결함(번들 diff가 커밋 기준인데
  preamble은 워킹트리를 SoT라 선언)을 등재한 것이다. `plan/in-progress/**`는 `CLAUDE.md`가 명시한
  developer 쓰기 권한 범위(`codebase/**, plan/**, review/**`)이고, `.claude/**` 거버넌스 문서가
  아니므로 권한 문제도 없다. 이 세션 밖에서 발견한 내용을 끼워 넣은 것이 아니라 **이 세션 자신의
  게이트 실행이 만든 부산물**이다.
- **"현재 상태" 요약 문단 재작성 + "승격은 됐는데 굶는다" 불릿 추가**: `git show f71aa584e:…`로
  확인한 결과 "승격은 됐는데 굶는다" 섹션 본문(문서 끝, `## 승격은 됐는데 굶는다 …`)은 **이번
  커밋 이전에 이미 존재**했다(같은 날 오전 별도 세션이 등재, 커밋 `c7ccdb9c7`). 이번 라운드는 그
  섹션을 새로 쓴 것이 아니라, 요약 문단이 "남는 이유는 둘이다"라는 **개수 단정**을 반복적으로
  낡게 만든다는 문제(문서 자신이 각주에 "두 번 낡았다"고 적음)를 발견하고 개수 단정을 성격 목록
  방식으로 바꾸면서 그 기존 섹션을 목록에 반영한 것 — 스코프 밖 콘텐츠를 새로 저작한 것이 아니라
  **이 라운드가 실제로 건드린 같은 문서의 요약 정확성을 고치는 부수 작업**이다.

## 요약

`codebase/`에서는 1라운드부터 선언된 3개 파일 외 diff가 여전히 0건이고, 이번 라운드의 모든 hunk를
`RESOLUTION.md`의 13개 수정 항목과 1:1 대조해 표에 없는 변경이 없음을 확인했다. `spec/`·설정
파일 diff는 이번에도 0건이며 뮤테이션 대상이었던 `triggers.service.ts`는 `origin/main`과 md5까지
완전히 일치해 저자가 서술한 재실험(2라운드에서도 같은 파일을 다시 건드렸다는 서술)이 흔적 없이
원복됐음을 실측으로 확인했다. `plan/in-progress/harness-review-gate-followups.md` 편집은 이
세션 자신의 `--impl-done`이 만든 신규 하네스 결함 등재(§M)와, 같은 문서의 기존 stale 요약
정정(사전 존재 섹션을 목록에 반영)으로 구성돼 있어 이 작업 범위 밖의 drive-by 편집이 아니다.
`spec-draft-nullable-notation-followups.md`의 대량 추가도 전부 이번 라운드 리뷰가 낸 특정
지적사항에 1:1 대응한다. Prettier 재검증 통과, 미사용 임포트 없음, 포맷팅·주석·설정 노이즈 없음.
종합적으로 이 2라운드 커밋은 원 changeset 자신의 결함 수정 + 그 과정에서 나온 문서 기록에
정확히 국한되며 범위 이탈 징후가 없다.

## 위험도

NONE
