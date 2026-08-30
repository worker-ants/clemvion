# 변경 범위(Scope) 코드 리뷰

## 검증 방법

`git status --short` / `git diff --stat origin/main...HEAD` 로 저장소의 실제 diff(29파일,
1,363줄 추가/58줄 삭제)가 프롬프트에 제시된 29개 파일과 정확히 일치함을 확인했다. `git log
origin/main..HEAD` 로 두 커밋(`1a12088f2` 트랜잭션화 fix, `519671792` 리뷰 WARNING/SPEC-DRIFT
반영)으로 나뉘어 있음을, `git show --stat`으로 각 커밋의 파일 구성을 확인했다. 저장소에
뮤테이션은 가하지 않았다(`git status --short` 상 이번 리뷰 세션 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** 이번 diff 의 목적(else 분기 트랜잭션화)과 무관한 stale 체크박스("backend 전역
  raw-query 소비 지점 감사")가 같은 커밋에 동반 완료 처리됐다 — **직전 라운드(`17_36_15`
  scope.md)에서 이미 지적되고 NONE 등급으로 수용된 항목과 동일**하다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:1300` (게이트 숫자 기준,
    `- [ ]` → `- [x] backend 전역 raw-query 소비 지점 감사` 전환부, 커밋 `1a12088f2`)
  - 상세: 이 커밋의 diff 는 정확히 `updateExecutionStatus` else 분기를 `dataSource.transaction`
    으로 감싸는 fix(같은 파일 `:1316` "updateExecutionStatus else 분기 트랜잭션화" 체크박스)를
    목표로 한다. 그런데 같은 커밋 안에서 다른 plan(`update-returning-tuple-shape.md`)이 이미
    수행한 감사 결과를 근거로 이 plan 의 무관한 체크박스도 함께 완료 처리했다. 코드 변경은
    아니고 커밋 메시지("stale 백로그 항목 하나를 닫았다 — 끝난 감사를 다시 할 뻔했다")가 사유를
    투명하게 설명하므로 실질 위험은 낮다. `review/code/2026/08/30/17_36_15/SUMMARY.md` 의 참고
    항목 8·`RESOLUTION.md` 의 처분 표 8번도 같은 결론(문제 삼지 않되 향후엔 별도 커밋으로
    분리)에 도달해 있다.
  - 제안: 이미 수용된 처분이므로 추가 조치 불요. `RESOLUTION.md` 에 이미 "다음엔 별도 커밋으로
    가른다" 는 개선 약속이 기록돼 있어, 이번 라운드에서 재차 요구할 필요는 없다 — 다만 다음
    유사 상황에서 그 약속이 실제로 지켜지는지는 추적할 가치가 있다.

## 나머지 파일에 대한 판정

- **핵심 코드 변경**(`execution-engine.service.ts`, `execution-engine.service.spec.ts`)은
  else 분기 UPDATE 를 트랜잭션으로 감싸는 것과, 그로 인해 직접 파생되는 두 가지 후속(①
  `finishStatusTransition` 헬퍼 추출 — 직전 라운드 WARNING 2 의 지정된 fix, ② self-deadlock
  경고 JSDoc·테스트 제목 축소 — 직전 라운드 INFO 2/3 의 지정된 fix)에 국한된다. 새 import·
  설정 변경·무관 리팩토링은 없다.
- **`CHANGELOG.md`**: 이번 트랜잭션화를 다루는 소급 정정 addendum 하나뿐 — 직전 라운드
  WARNING 1(CHANGELOG 미갱신)에 대한 지정된 fix.
- **`spec/5-system/4-execution-engine.md`, `spec/data-flow/3-execution.md`**: 직전 라운드
  SPEC-DRIFT(requirement) 및 `17_49_59` consistency-check WARNING 3(cross_spec, §2.1 매핑
  표 비대칭)에 대한 지정된 fix. `developer` 자기-반증형 소정정 예외의 조건 미충족(각주가
  developer 저작 아님)을 이유로 `planner` 턴을 거쳤다는 점도 `RESOLUTION.md`·`SUMMARY.md`
  로 확인된다 — 우회 없음.
- **`plan/in-progress/*.md` 3건**: `spec_impact` 정정(consistency WARNING 1), `#12` 완료
  블록 역참조 추가(consistency WARNING 2), 트랜잭션화 완료 체크(원본 fix) — 전부 이번 diff
  가 발생시킨 리뷰/체크의 지정된 후속이다.
- **`review/code/2026/08/30/17_36_15/**` (13파일), `review/consistency/2026/08/30/17_49_59/**`
  (8파일)**: 새로 생성된 리뷰·consistency-check 산출물이며, `CLAUDE.md` 의 "코드 리뷰
  산출물 → `review/code/**`", "일관성 검토 산출물 → `review/consistency/**`" 규약에 따라
  커밋되는 것이 이 프로젝트의 표준 워크플로다 — 무관한 파일 혼입이 아니라 이번 작업(구현→
  리뷰→해소) 자체의 감사 기록.

## 요약

29개 파일, 2개 커밋으로 구성된 큰 diff이지만, 전부 단일 의도 체인("else 분기 guarded UPDATE
가 트랜잭션 밖이라 shape-위반 throw 시 실제 롤백을 못 하던 결함을 닫는다")과 그 결함을
검증한 리뷰 라운드(`17_36_15` 코드 리뷰·`17_49_59` consistency check)가 지정한 WARNING/
SPEC-DRIFT 후속 조치에 수렴한다. 리뷰·consistency 산출물이 코드와 같은 커밋에 대량 포함된
것은 이 저장소가 명시적으로 규약화한 위치(`review/code/**`, `review/consistency/**`)로의
정상 커밋이지 스코프 이탈이 아니다. 유일하게 핵심 의도와 직접 연결되지 않는 항목은 무관한
stale 체크박스 하나("backend 전역 raw-query 소비 지점 감사")인데, 이는 이번 라운드가 아니라
직전 라운드(`17_36_15`)에서 이미 지적·수용된 동일 항목이며 투명한 커밋 메시지와 함께 남아
있다. 포맷팅 전용 변경, 불필요 주석, 미사용 임포트, 의도치 않은 설정 변경, 요청 밖 기능
확장 징후는 발견되지 않았다.

## 위험도

NONE
