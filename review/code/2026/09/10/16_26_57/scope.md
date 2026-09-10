# 변경 범위(Scope) 리뷰 — 3라운드 (`64334e708`, 2라운드 지적 5건 반영)

## 검증 방법 요약

- `git log --oneline -- <3개 codebase 파일>` 로 이 캐너리의 커밋 계보 확인
  (`f71aa584e`→`c696ace07`→`64334e708`, 현재 `HEAD`=`64334e708`)
- `git diff --stat origin/main...HEAD -- 'codebase/**'` — `codebase/` 안 변경이 여전히 3개 신규
  파일뿐인지 재확인
- `git diff c696ace07..64334e708 -- <각 파일>` — **이번 라운드에서만** 바뀐 부분을 분리해 확인
  (2라운드까지의 변경은 전 라운드 scope 리뷰가 이미 NONE 판정)
- 헬퍼 `.ts`·self-spec `.spec.ts` 각각 `git show <rev>:<path>` 로 before/after 를 스크래치에
  떠서 주석(`//`, `/* */`, `*`)과 빈 줄을 제거한 뒤 정렬해 diff — **실행 코드 라인의 집합 동등성**을
  기계적으로 확인 (재배치·재배열이 "재배치에 국한"인지 판별하는 핵심 검증)
- `it('...')` 라벨을 before/after 전수 grep 해 케이스 12개가 그대로 12개인지, 제목이 유지됐는지 대조
- `plan/in-progress/harness-review-gate-followups.md` 의 §N 이 이번 라운드에 처음 추가됐는지
  (`git diff c696ace07..64334e708`)와 그 서술 근거(라운드 2 `requirement.md` 리포트)를 대조
- `codebase/backend/src/modules/triggers/triggers.service.ts` 를 `origin/main`·`HEAD` 양쪽에서
  `md5` — 뮤테이션 잔존 여부 바이트 단위 확인
- `codebase/backend` 패키지에서 `npx prettier@3.9.6 --check`(package.json 핀과 동일 버전)로 3개
  파일 재검증
- `git status --short` 로 저장소 잔여 뮤테이션/미커밋 파일 확인

## 발견사항

없음(CRITICAL/WARNING 없음). 아래는 참고용 INFO 두 건 — 둘 다 조치 불요, 판단 근거를 기록한다.

- **[INFO]** 헬퍼 `.ts` 의 "전면 재배치"와 self-spec `.spec.ts` 의 "전면 재배열"은 기계적으로
  **재배치·재배열에 정확히 국한**됐음을 확인했다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` (파일 전체) ·
    `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (파일 전체)
  - 상세: `.ts` 파일은 before(`c696ace07`)/after(`64334e708`)에서 주석·JSDoc·빈 줄을 모두 제거한
    실행 코드 라인 집합을 정렬해 `diff` 했더니 **완전히 동일**(exit 0)이었다 — import, 상수 선언,
    함수 시그니처, 가드 로직, `if`/`return` 분기, 어떤 `expect(...)` 라인도 한 글자도 안 바뀌었다.
    바뀐 것은 오직 (a) "왜 `test/helpers/` 가 아니라 여기인가" 절이 함수 JSDoc 안에서 파일 최상단
    `//` 註로 이동한 것, (b) `TRIGGER_SECRET_COLUMNS`/`WORKFLOW_REF_KEYS` 선언이 그 `//` 註 바로
    뒤·함수 JSDoc 앞으로 옮겨진 것뿐이다(커밋 메시지가 "고아 JSDoc" 정리로 설명한 그대로).
    `.spec.ts` 는 같은 방법으로 대조하면 `it()` 라벨 12개가 before/after 모두 **정확히 12개**이고
    11개는 제목·본문 불변, 나머지 1개(`id` 가 문자열이 아니면 실패한다)는 **fixture 를 `id: 42` →
    `{ id: { toString: () => WF_ID }, name: 'W' } }` 로 교체**한 것 하나만 실질 변경이다 — 이는
    커밋 메시지·docstring·이전 라운드(`15_52_06` testing W1)가 명시적으로 밝힌 의도된 수정이지
    재배열에 편승한 은닉 변경이 아니다. 케이스 소실·조용한 내용 변경은 0건.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/harness-review-gate-followups.md` 에 신규 추가된 §N 은 이 작업
  범위에 속한다고 판단했다.
  - 위치: `plan/in-progress/harness-review-gate-followups.md` §N (문서 끝, 이번 라운드
    `c696ace07..64334e708` diff 에서 처음 등장 — 2라운드까지는 없었다)
  - 상세: §N 은 *"리뷰어 뮤테이션 종결 문구가 실제 계약(2절 구조)보다 넓다"* 는 관측을 적은
    것으로, 저자 주장대로 **2라운드 `/ai-review` 세션 자체가 만든 부산물**이다 — 실제로 라운드
    2(`15_52_06`)의 `requirement.md` 리포트 상단에 `## ⚠️ 관측된 저장소 이상 상태 — 다른
    reviewer 의 미원복 뮤테이션으로 추정` 절이 있어 §N 이 지어낸 서사가 아니라 그 리포트를 그대로
    가리킴을 확인했다. `plan/in-progress/**` 는 `CLAUDE.md` 가 명시한 developer 쓰기 권한
    영역이고, 직전 라운드(`15_52_06/scope.md`)가 같은 문서의 §M(같은 성격 — "이 세션 자신의 게이트
    실행이 만든 부산물")을 정확히 이 논리로 in-scope 판정한 선례가 있다. §N 은 §M 과 같은 클래스라
    같은 결론이 타당하다. 코드(`codebase/**`) 변경은 동반하지 않았다.
  - 제안: 조치 불요.

## 점검 관점별 결과

1. **의도 이상의 변경**: 없음. `git diff --stat origin/main...HEAD -- 'codebase/**'` 는 여전히
   3개 파일(총 599 insertions, deletions 0)뿐이다. `c696ace07..64334e708` 구간만 떼어 봐도 세 파일
   diff 는 위에서 확인한 재배치·1건의 명시적 fixture 교체·주석 정정(`/api/` 경로 오기, 근거 문장
   축약)뿐이며 커밋 메시지가 나열한 "나머지 4건" 지적과 1:1 대응한다.
2. **불필요한 리팩토링**: 없음. `.ts` 파일 재배치는 "현재 작업과 무관한 정리"가 아니라 직전 라운드
   `maintainability` W1(고아 JSDoc)에 대한 직접 수정이고, 실행 코드는 위에서 확인한 대로 완전히
   불변이다.
3. **기능 확장**: 없음. 신규 로직·신규 옵션·신규 export 없음. 변경은 fixture 교체 1건과 주석/구조
   정리뿐이다.
4. **무관한 수정**: 없음. `spec/**`·설정 파일(`package.json`/`tsconfig*`/`.eslintrc*`/
   `.prettierrc*`/`jest*`) 에 diff 없음. `triggers.service.ts` 는 `origin/main`과 `HEAD` 양쪽
   md5 가 `f1377a76ef26dde2a12d0be65370d773` 로 완전 일치 — 뮤테이션 잔존 없음.
5. **포맷팅 변경**: 없음. `codebase/backend` 패키지에서 `npx prettier@3.9.6 --check`(package.json
   핀과 동일 버전)로 3개 파일 전부 통과 확인.
6. **주석 변경**: 이번 라운드 diff 의 대다수가 주석/JSDoc 재배치·정정이다. 전부 커밋 메시지·2라운드
   리뷰 지적과 1:1 대응하며(고아 JSDoc 분리, 근거 중복 축약, `/api/` 경로 오기 정정, 가드 순서 규약
   명시), 장식적·무관한 주석 추가는 없다.
7. **임포트 변경**: 세 파일 모두 import 목록에 diff 없음(`c696ace07..64334e708` 구간 기준).
8. **설정 변경**: 없음.

## 뮤테이션 잔존물 확인

- `triggers.service.ts` — `origin/main` md5 = `HEAD` md5 (`f1377a76ef26dde2a12d0be65370d773`),
  `git diff origin/main -- <그 파일>` 빈 결과. 1·2·3라운드 어느 시점의 실험 흔적도 없다.
- `git status --short` 는 이 리뷰 세션 자신이 쓰기 시작한
  `review/code/2026/09/10/16_26_57/`(본 세션 출력) 외에는 아무것도 보고하지 않는다 — 다른
  reviewer 의 뮤테이션·백업 잔존물 없음. (본 리뷰는 저장소를 mutate 하지 않았다 — 뮤테이션 검증은
  전부 `git show`/`md5`/`diff` 등 읽기 전용 명령으로 수행했고, 스크래치 산출물은 저장소 밖
  `/private/tmp/claude-501/.../scratchpad` 에만 썼다.)

## 요약

이번 라운드(`c696ace07..64334e708`)의 두 "전면" 변경 — 헬퍼 파일 docstring 재배치, self-spec
케이스 재배열 — 은 기계적 대조(주석 제거 후 실행 라인 diff, `it()` 라벨 전수 대조) 결과 **재배치·
재배열에 정확히 국한**됐다. 유일한 실질 내용 변경은 fixture 1건 교체이며 이는 커밋 메시지·docstring·
2라운드 리뷰가 명시적으로 밝힌 의도된 수정이고 케이스 소실이나 조용한 내용 변경은 없었다.
`harness-review-gate-followups.md` §N 은 2라운드 리뷰 세션 자체가 만든 관측을 기록한 것으로,
같은 문서의 §M 에 대해 직전 라운드가 세운 "게이트 부산물은 in-scope" 선례와 같은 클래스라 범위
안으로 판단한다. `codebase/` 변경은 여전히 정확히 3개 파일이고 backend 핀 prettier(3.9.6)로 재검증
통과해 포맷 노이즈가 없으며, `triggers.service.ts` 는 `origin/main`과 바이트 단위로 동일해 뮤테이션
실험 잔존물도 없다. 범위 이탈 징후 없음.

## 위험도

NONE
