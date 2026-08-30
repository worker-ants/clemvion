# 유지보수성(Maintainability) Review

## 스코프 메모

이번 diff 는 대부분 이전 라운드(`17_36_15` 코드 리뷰·`17_49_59` consistency-check)가 이미 처리를
마친 결과물(RESOLUTION 반영, CHANGELOG 소급 정정, plan 체크박스, spec 각주 보강)을 함께 커밋한
것이다. 실제 프로덕션 코드 변경은 `execution-engine.service.ts` / `.spec.ts` 두 파일에 국한되고,
`CHANGELOG.md`·`plan/**`·`spec/**` 는 산문(prose) 문서라 유지보수성(가독성/네이밍/함수 길이/중첩/
매직넘버/중복/복잡도) 관점의 대상이 아니므로 코드 두 파일에 집중했다. `review/code/**`,
`review/consistency/**` 하위 신규 파일(7~27번)은 이전 라운드가 생성한 리포트 스냅샷이라 리뷰
대상 코드가 아니다.

## 발견사항

- **[INFO]** `updateExecutionStatus` 함수가 여전히 169줄(단일 책임 함수치고 길다)이고, 성격이
  다른 두 트랜잭션 블록(`linkedNodeExec` 짝 전이 / else 분기 guarded UPDATE)을 한 함수 안에
  나란히 담고 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8573`~`8741` (`updateExecutionStatus`)
  - 상세: 이전 라운드(`17_36_15`)는 이 항목을 "INFO 9 함수 길이 — 조치 불요(W2 헬퍼 추출로
    완화됨)"로 처분했다. 그런데 실측해 보면 `finishStatusTransition` 추출(W2)이 줄인 것은
    두 분기가 손으로 복제하던 4줄짜리 epilogue(세그먼트 기록+메트릭 발행+return)뿐이고, 그
    자리는 각 분기에서 6줄짜리 헬퍼 호출로 대체되어 함수 실측 길이는 거의 줄지 않았다
    (168→169줄, 오히려 이번 트랜잭션 래핑으로 +1). 즉 W2 는 **중복(drift 위험) 제거**가
    목적이었지 **함수 길이 축소**가 목적이 아니었으므로, "완화됨" 이라는 이전 처분 근거는
    함수 길이 축에 대해서는 성립하지 않는다. 다만 실질 위험도는 낮다 — 길이의 상당 부분이
    과거 버그(짝 전이 lost-update, WARNING #9 세그먼트 유령 항목, 튜플 오인 등)를 설명하는
    필수 이력 주석이고, 순환 복잡도 자체는 분기당 얕다(각 트랜잭션 콜백 내부 1단 조건문
    수준).
  - 제안: 급한 조치는 아니다. 다음에 이 함수를 다시 손질할 기회가 있으면 `linkedNodeExec`
    분기 트랜잭션 본문과 else 분기 트랜잭션 본문을 각각 `private` 메서드로 추출해
    `updateExecutionStatus` 를 얇은 dispatcher 로 남기는 편이 "함수 길이" 축에서 실질적으로
    효과가 있다. 이전 처분 근거를 재사용할 때는 "무엇을 줄였는지" 축을 구분해서 인용할 것.

- **[INFO]** 신규 회귀 테스트 2건이 거의 동일한 준비 코드(`svcAny` 캐스팅 + `updateExecutionStatus`
  호출 + `mockTxManagerQuery.mock.calls` 를 같은 정규식으로 필터링)를 반복한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4812`~`4864` (두 개의 신규 `it()`)
  - 상세: 두 테스트는 의도적으로 분리되어 있어야 하는 축(롤백 전제조건 vs 공허하지 않음
    확인)이라 통합은 부적절하지만, "트랜잭션 manager 를 경유한 UPDATE 호출 수를 센다" 는
    보조 로직 자체는 두 곳에 그대로 복제돼 있다.
  - 제안: 급하지 않음. `getTxUpdateCalls(mockTxManagerQuery)` 같은 짧은 로컬 헬퍼로 추출하면
    두 테스트가 "무엇을 검증하는가" 에 더 집중해 읽힌다.

- **[INFO]** `beforeEach` 의 `mockTxManagerQuery` 가 SQL 문자열을 `/UPDATE execution/` 정규식으로
  라우팅해 실제 UPDATE 호출인지 판별한다. 이 정규식 리터럴은 파일 전역에 22곳 산재한
  기존 관용구를 그대로 따른 것으로, 이번 diff 가 새로 만든 중복은 아니다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:289` (신설), 그 외 파일 전역
  - 상세: 이미 이전 라운드에서 "INFO 10 — 이번 diff 범위 밖(기존 관용구), 조치 불요" 로
    처분된 항목과 동일 축이다. SQL prefix 가 바뀌면 22곳을 전수 grep 해야 하는 구조적
    취약점은 여전하지만, 새 결함은 아니다.
  - 제안: 신규 조치 불요. 별도 작업에서 공유 상수(`UPDATE_EXECUTION_SQL_RE`)로 통합하는
    쪽이 좋다는 이전 권고를 재확인한다.

- **[INFO]** `updateExecutionStatus` 의 JSDoc(약 28줄, `:8544`~`8571`)이 반환값 의미론(부분 실패 시
  `false`)·호출 제약(자신의 트랜잭션 밖에서만 호출)·소비 현황(3곳/4곳 미소비) 세 가지 서로
  다른 관심사를 한 블록에 담고 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8544`~`8571`
  - 상세: 정보 밀도가 높아 처음 읽는 사람이 "이 함수를 호출하려면 무엇을 알아야 하는가"
    를 한 번에 파악하기 부담스러울 수 있다. 다만 이 파일은 반복적으로 형제 분기 drift·
    self-deadlock 류 결함을 겪어 왔고, 이 주석들이 바로 그 재발 방지 장치라 실용적
    트레이드오프로 판단된다.
  - 제안: 필수 아님. 굳이 나눈다면 `@returns` 절과 "호출 제약" 문단을 별도 하위 리스트로
    시각적으로 더 분리해도 좋다.

## 요약

핵심 프로덕션 변경(`updateExecutionStatus` else 분기를 `dataSource.transaction` 으로 감싸고,
두 분기의 공통 종결부를 `finishStatusTransition` 으로 추출)은 이미 직전 라운드(`17_36_15`)
9개 reviewer 전원의 검토와 WARNING 2건(코드 중복·CHANGELOG)·SPEC-DRIFT 1건을 거쳐 반영된
상태였고, 이번 diff 는 그 반영분 + 문서 정합 후속을 함께 커밋한 것이다. 코드 자체는 명확한
네이밍, 형제 분기 간 대칭적 구조, 그리고 과거 결함을 설명하는 밀도 높은 이력 주석을 갖추고
있어 가독성·일관성 면에서 양호하다. 새로 발견된 유지보수성 결함은 없고, 남은 항목은 전부
이전 라운드가 이미 인지·의도적으로 유예한 것들의 재확인(INFO)이며, 그중 하나(`updateExecutionStatus`
함수 길이에 대한 이전 처분 근거)는 실측 기준으로 다소 과장돼 있었다는 점만 짚어 둔다 — 조치를
요구할 정도는 아니다.

## 위험도

LOW
