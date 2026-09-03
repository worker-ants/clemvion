# 변경 범위(Scope) 리뷰

## 검증 방법

`git diff origin/main...HEAD` 로 실제 변경 파일 9개(코드 8 + plan 1)를 전수 확인했고, 프롬프트에서
크기 제한으로 생략된 diff(`source-scan.spec.ts`, `nullable-type-lie-cast-guard.ts`,
`nullable-type-lie-cast.spec.ts`)도 `git diff` 로 직접 열어 대조했다. `review/code/**` 하위
48개 파일(1~57번 중 코드 9개를 제외한 나머지)은 이전 리뷰 라운드(01:48~02:57)의 산출물이 누적
커밋된 것으로, 이 저장소 관례(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에 맞는 정상 위치이며
내용도 자기 라운드 시각의 SUMMARY/RESOLUTION/개별 리뷰 md 뿐이다 — scope 관점의 이상 없음.
`git diff origin/main...HEAD --stat` 로 `review/code/` 밖에서 바뀐 파일이 정확히 9개(선언된
두 후속 항목에 속한 파일)뿐임을 확인했고, 다른 무관 파일·설정 파일 변경은 없다. 저장소 트리에
쓰기는 하지 않았다(`git status --short` 는 이 라운드 자신의 출력 디렉터리만 untracked 로 표시).

## 발견사항

- **[INFO]** plan 문서에 "완료 마킹" 범위를 넘는 두 개의 회고성 섹션이 함께 커밋됐다
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:289-313` (`## 한 자리만
    고치는 버릇 — 이 plan 에서 네 번 반복했다` ~ `### 숫자를 어디에 쓸 수 있나 — 코드와 plan
    의 선이 다르다`)
  - 상세: 이 diff 가 처리하는 항목은 plan 에 이미 등재돼 있던 두 개의 구체적 체크박스(①
    `repo-guards/__tests__/` walker 통합(W5), ② 넓혀진 필드를 겨눈 낡은 `.spec.ts` 캐스트
    가드)뿐이다. 그런데 같은 커밋에 이 PR 자체의 리뷰 라운드 4회에 걸쳐 반복된 "한 자리만
    고치는 버릇"에 대한 회고 테이블과, "숫자를 코드 docstring 대 plan/커밋 메시지 중 어디에
    쓸 수 있는가"를 규정하는 일반 컨벤션 문단이 함께 들어갔다 — 이 둘은 위 두 체크박스
    항목의 완료 근거가 아니라 이 plan 파일 자체의 집필 관행에 대한 메타 서술이다. 다만 이
    저장소는 plan 파일에 "결정의 배경·근거"와 반복 실수의 교훈을 직접 축적하는 것이 확립된
    관례이고(직전 커밋 이력 `docs(plan): 배치 3 리뷰 2R — 코드는 고치고 그 위에 쓴 서술은 안
    고쳤다` 등), 이번 회고 테이블도 바로 이 plan 안에서 실제로 일어난 사건(리뷰 1R~4R)만
    다루므로 완전히 무관한 내용은 아니다. scope 위반으로 판정하지 않는다.
  - 제안: 조치 불필요(정보성 기록). 다음에 이 plan 파일을 훑는 사람이 "이 회고가 왜 이
    커밋에 있나"를 궁금해하지 않도록, 필요하면 커밋 메시지에 "이 라운드에서 겪은 반복
    실수를 plan 에도 반영" 한 줄을 남기는 정도면 충분하다.

- **[INFO]** `collectTsFiles` 통합이 5개 walker 중 가장 느슨했던 `masked-reject-callers-guard.ts`
  의 `listSourceFiles` 에는 순수 추출을 살짝 넘어 필터를 새로 얹는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:47-52`
    (`listSourceFiles`, `return collectTsFiles(rootDir, { includeSpec: true });`)
  - 상세: 리팩터 전 이 walker(diff 삭제분)는 `.ts` 로 끝나기만 하면 담았다 — `.d.ts` 배제도
    `sort()` 도 없었다. 새 `collectTsFiles`로 교체하며 `.d.ts` 배제와 정렬이 **덤으로**
    따라붙는다. `source-scan.ts` 의 "다섯 사본의 차이" 표와 plan 문서(게이트 244-262)가 이
    축을 실측(`.d.ts` 0개, `node_modules`/`dist` 스캔 루트 밖)으로 근거를 남겨 뒀고 하위
    호출부가 결과를 다시 `.sort()` 하므로 실질 영향은 없다고 확인돼 있다 — 그래서 scope
    위반은 아니다. 다만 "walker 추출 = 순수 동작 불변"이라는 절대적 읽기를 하면 이 한 지점
    (5개 중 1개)만은 필터가 실제로 넓어졌다는 사실이 diff 표면만 봐서는 드러나지 않으므로
    기록해 둔다. (동일 관찰이 이전 라운드 scope 리뷰(`review/code/2026/09/04/01_49_18/scope.md`)
    에도 이미 있었고, 이번 라운드 diff 에서 이 지점이 달라지지 않았음을 재확인했다.)
  - 제안: 조치 불필요. 이미 근거가 문서화돼 있다.

## 요약

이 diff 가 건드리는 비-`review/` 파일은 정확히 9개이고, 전부 plan 에 사전 등재돼 있던 두 후속
항목(① `repo-guards/__tests__/` 5개 walker 사본을 `common/__test-utils__/source-scan.ts` 의
`collectTsFiles(root, { includeSpec })` 로 통합, ② `.spec.ts` 안의 넓혀진(nullable 화된) 엔티티
필드를 겨눈 낡은 `null as unknown as` 캐스트를 잡는 `widenedEntityFields`/`findStaleSpecCasts`
신설)에 직접 결속돼 있다. `stripComments` 의 export 전환과 `stripLiterals` 신설은 두 번째 항목이
첫 번째 항목의 주석 스트리핑 유틸을 재사용해야 해서 필요한 변경이고, 각 소비 가드 4곳의 import
정리(불필요해진 `fs` 제거·필요해진 `collectTsFiles` 추가)도 실제 사용 여부와 정확히 일치한다.
포맷팅만의 변경, 무관한 설정 파일 변경, 관련 없는 리팩터링은 발견되지 않았다. `review/code/**`
아래 누적된 48개 파일은 이 프로젝트의 자동 코드 리뷰 워크플로가 라운드마다 커밋하는 표준 산출물
(SUMMARY/RESOLUTION/개별 리뷰 md)로, 정해진 경로 규약을 따르고 있어 scope 이상이 아니다. 유일하게
기록할 만한 두 지점 — plan 문서에 실린 두 개의 회고성 메타 섹션과, `masked-reject-callers-guard.ts`
walker 가 부수적으로 필터를 넓힌 것 — 은 둘 다 이 저장소 관례에 부합하거나 이미 근거가 문서화돼
있어 INFO 로만 기록하며 조치가 필요하지 않다.

## 위험도

NONE
