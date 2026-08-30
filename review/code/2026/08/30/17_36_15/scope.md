# 변경 범위(Scope) 리뷰

## 검증 방법

`git show --stat 1a12088f2` / `git diff --stat origin/main...HEAD` 로 커밋에 포함된 전체 파일
목록(4개)이 프롬프트에 제시된 4개 파일과 정확히 일치함을 확인했다. 각 파일의 `git show` 전체
diff 를 프롬프트의 unified diff 와 대조해 hunk 개수·범위가 일치함을 확인했다(추가 hunk·숨은
변경 없음). 저장소에 뮤테이션은 가하지 않았다(`git status --short` 상 리뷰 산출물 디렉터리
외 변경 없음).

## 발견사항

- **[INFO]** 트랜잭션화와 무관한 stale 체크박스(전역 raw-query 감사) 정정이 같은 파일 diff 에
  동반됐다
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:1295` (게이트 숫자 기준,
    "backend 전역 raw-query 소비 지점 감사" 항목 `[ ]`→`[x]`)
  - 상세: 이 커밋의 본 목적은 `updateExecutionStatus` else 분기 UPDATE 를 트랜잭션으로
    감싸는 것이다(`execution-engine.service.ts`, `1308`행의 "`updateExecutionStatus` else
    분기 트랜잭션화" 체크박스가 정확히 이 항목). 그런데 같은 파일의 **다른 무관한 항목**
    ("전역 raw-query 소비 지점 감사")도 같은 diff 안에서 완료로 체크됐다. 코드 변경은 아니고
    두 항목 모두 `plan/` 문서 그루밍이며, 커밋 메시지("stale 백로그 항목 하나를 닫았다")가
    이 정정을 투명하게 설명하고 근거(`update-returning-tuple-shape.md` 의 41곳 감사 결과)도
    함께 제시하므로 실질 위험은 낮다. 다만 "이 커밋이 하는 일" 을 diff 만으로 파악하려는
    사람에게는 두 개의 독립된 관심사(신규 fix + 과거 감사 완료 인정)가 한 파일 diff 에
    섞여 보인다.
  - 제안: 현재 수준(투명한 커밋 메시지 설명)이면 문제 삼지 않아도 되나, 앞으로 유사 상황에서는
    무관한 plan 그루밍은 별도 커밋으로 분리하는 편이 diff 최소성 원칙에 더 부합한다.

- **[INFO]** 테스트 mock 이 프로덕션 배선 변경(`executionRepository.query` →
  `manager.query`)을 흡수하기 위해 `mockTxManagerQuery` 시그니처와 위임 로직을 확장했다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:275-291`
  - 상세: `beforeEach` 안의 mock 이 `(sql: unknown)` → `(sql: unknown, ...rest: unknown[])` 로
    바뀌고, `UPDATE execution` 매칭 시 기존 `mockExecutionRepo.query` 로 위임하는 분기가
    추가됐다. 이는 리팩토링처럼 보일 수 있으나, 실제로는 프로덕션 코드가 `this.executionRepository.query`
    대신 `manager.query` 를 타도록 바뀐 데 대한 **필수 대응**이다(안 하면 기존 수십 개
    단언이 깨진다) — 커밋 메시지에도 "배선이 바뀌면서 기존 단언 33건이 깨졌다" 로 명시돼
    있고, 목적 없는 test 정리가 아니라 동작 변경에 종속된 수정이다. 범위 이탈 아님.

## 요약

리뷰 대상 4개 파일(서비스·스펙·plan 트래커 2개) 전부가 "`updateExecutionStatus` else 분기의
guarded UPDATE 를 트랜잭션으로 감싸 롤백을 보장한다"는 단일 의도에 수렴한다. 서비스 코드
diff 는 정확히 그 UPDATE 문을 `this.dataSource.transaction(...)` 콜백 안으로 옮기는 91줄
변경 하나뿐이고(새 import·설정·불필요 리팩토링 없음, `dataSource` 는 같은 클래스의 기존
필드), 스펙 파일 변경은 그 배선 변경으로 인해 필연적으로 필요한 mock 위임 로직 추가와 회귀
테스트 2건(롤백 축 + 공허 방지 축) 추가로 국한된다. 두 plan 파일의 체크박스 갱신도 이
작업을 추적하던 트래커 항목을 실제 완료로 반영한 것으로, 프로젝트 관례("plan 체크박스 =
실제 상태")에 부합한다. 유일한 잡음은 `backend-lint-gate-broken-on-main.md` 에서 이 작업과
무관한 다른 stale 체크박스(전역 감사)도 같은 diff 에 함께 체크된 점인데, 커밋 메시지가
그 사유를 투명하게 설명하고 있어 실질 위험은 없다. 포맷팅·불필요 주석·미사용 임포트·설정
변경·기능 확장 징후는 발견되지 않았다.

## 위험도

NONE
