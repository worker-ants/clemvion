# 변경 범위(Scope) 리뷰

## 발견사항

없음.

두 대상 파일(`codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`,
`codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts`)의 내용을 검토했고,
직전 커밋(`d1b622084` "4R W1 INFO4 — 마지막 무관측 분기 관측 + 주석 정정, W2 W3 는 이관")
의 실제 diff 도 대조했다. 변경은 다음 두 가지로 좁게 한정된다.

1. `plan-scan.test.ts`: `findNonTerminalCompletedPlans` 의
   `typeof status !== "string"` 분기(빈 값/`no`/숫자/배열)를 실행하는 fixture 4개와
   테스트 2개(`skips a non-string status...`, `` `status: no` is a STRING... ``) 추가.
   기존 "reports exactly the three planted violations" 단언도 새 위반 1건
   (`status-yamlish.md`)을 포함하도록 갱신. 이는 이전 라운드 리뷰가 지적한
   "무관측 분기"(WARNING)를 정확히 해소하는 범위이며, 무관한 기능·리팩터링이 섞이지
   않았다.
2. `plan-scan.ts`: `isLifecyclePlan` 위 JSDoc 이 "예전부터 면제해 온 규칙" 이라고
   잘못 서술했던 것을 "완료-plan status 검사는 이번에 처음 이 면제를 갖는다" 로 정정.
   순수 주석 수정이며 동작 변경은 없다. 커밋 메시지의 "주석 정정" 과 일치한다.

같은 커밋에서 `plan/in-progress/harness-env-value-subpattern-dedup.md` 에 "함께 볼 것"
섹션을 추가해, 리뷰가 함께 제안한 더 넓은 리팩터링(walker 3벌 통합·`SpecMdFile` 이름
분리)을 **이 PR 범위 밖으로 명시적으로 이관**했다. 이는 스코프 크립을 만드는 대신
막는 행위이므로 감점 요인이 아니다 — 오히려 이 리뷰 관점이 권장하는 패턴이다.
(단, `harness-env-value-subpattern-dedup.md` 자체는 이번 리뷰 대상 파일 목록에
없어 상세 평가 대상은 아니다.)

임포트·포맷팅·설정 파일 변경 없음. 두 파일 모두 plan-lifecycle-gates 작업(완료 plan
status 검사 + 스캐너 단일화)의 직접 산출물이며, 그 밖의 영역을 건드리지 않았다.

## 요약

리뷰 대상 두 파일의 변경은 이전 리뷰 라운드가 지적한 미관측 분기(non-string `status`)
를 fixture 로 관측시키고 부정확했던 JSDoc 문구를 정정하는 것으로, 요청된 수정 범위에
정확히 부합한다. 관련이지만 더 넓은 리팩터링 제안(walker 통합 등)은 별도 plan 문서로
이관해 이번 PR 에 섞이지 않도록 했다. 포맷팅·불필요한 리팩토링·기능 확장·무관한
파일 수정 등 스코프 이탈 징후는 발견되지 않았다.

## 위험도
NONE
