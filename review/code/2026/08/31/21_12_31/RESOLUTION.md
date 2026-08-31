# RESOLUTION — `21_12_31` (4라운드, 종결)

- 결과: **Critical 0 · Warning 1 · INFO 11**, reviewer **7/7**, 위험도 **LOW**
- Warning 1건 + testing INFO 2건 반영.

## W1 — 같은 사실의 **세 번째 미러**를 빠뜨렸다

2라운드 fix(`RESUME_*` 앵커 추가)를 3라운드에서 `error-codes.ts` JSDoc 과 `CHANGELOG.md`
두 곳에 반영했는데, **`plan/complete/exec-intake-followups.md` ④ 단락**은 그대로였다.
같은 사실이 세 곳에 있는데 지적받은 둘만 고친 것이다.

**미러가 셋이면 셋을 다 세야 한다** — 지적받은 자리만 고치면 남은 자리가 다음 라운드에
그대로 나온다. 실제로 그렇게 됐고, 그 경위를 plan 문단 안에 인용 블록으로 남겼다(다음
사람이 "왜 여기만 세 번 고쳐졌나" 를 역산하지 않도록).

세 카테고리를 (a)(b)(c) 로 번호를 붙여 나열하고, `RESUME_FAILED` 가 왜 (c) 에 없는지
(일반 메서드 인자 = 스캔 표면 밖)도 함께 적었다.

## testing INFO 3 — 내가 만든 설계의 전제가 검증되고 있지 않았다

*"파일은 하나, const 는 둘"* 설계의 전제는 **두 const 가 겹치지 않는다**는 것이다. 겹치면
"레이어를 타입으로 가른다" 는 주장이 무너지고, 앵커 가드도 그 값을 어느 쪽 근거로
통과시킨 것인지 말할 수 없게 된다. 그런데 그 전제를 아무도 검사하지 않고 있었다.

`error-codes.spec.ts` 에 키 교집합이 빈 집합인지 단언하는 테스트를 넣었다.

- **뮤테이션 (예측 / 실측)**: `EngineErrorCode` 에 `LLM_TIMEOUT`(이미 `ErrorCode` 에 있음)
  추가 → RED / **RED**. 원복 GREEN.
- 공허 방지: `Object.keys(EngineErrorCode).length > 0` 을 함께 단언했다 — const 가 비면
  교집합도 비어 위 단언이 조용히 통과한다.

## testing INFO 2 — 형제 대칭

`ErrorCode` 는 `key === value` + UPPER_SNAKE 형식 검사를 받는데 신설 `EngineErrorCode` 만
안 받고 있었다. 같은 검사를 추가했다.

## 미조치 (사유)

| INFO | 사유 |
|---|---|
| 1 (`ANCHORED_ELSEWHERE` 사유 문자열 반복) | 신규 지적이나 그룹별 상수 추출은 **사유를 값에서 떼어 놓는다** — 지금은 각 항목 옆에 사유가 붙어 있어 읽는 사람이 바로 본다. 항목이 더 늘면 그때 재판정 |
| 4 (`StringLiteral` 만 인정 — 템플릿 리터럴 우회) | **의도된 축소**다. 에러 코드를 템플릿 리터럴로 조립하는 것 자체가 규약 위반이고, 그건 이 가드가 아니라 코드 리뷰가 잡는다. 형태 추격을 여기서 재개하지 않는다(2R 에서 이미 여섯 번째 형태에서 멈추기로 했다) |
| 7 (`record()`/`NewExpression` 중복) · 6 (mutable export) | "3번째 소비처" 기준 일관 적용. 소비처 변화 없음 |
| 8~11 | 확인 기록·기존 트레이드오프 재확인 |

## 수렴

4라운드 전부 **Critical 0**. 발견 축의 이동:

  1R  CHANGELOG 누락 + lint 브레이커     문서 부재 · 빌드
  2R  가드 보장 > 구현                    문서 정밀도 · 설계 경계
  3R  fix 가 상위 산문에 미반영            문서 동기화 (2/3 미러)
  4R  세 번째 미러 + 설계 전제 미검증      문서 동기화 (3/3) · 테스트 보강

동작 결함 0이 네 라운드 유지됐고, 남은 INFO 는 전부 "지금 손대면 오히려 나빠지거나 트리거
미충족" 이다.

## 검증 — CI 범위 전부

  npm run lint (--max-warnings 0)   통과
  prettier --check                   통과
  tsc --noEmit (변경 파일)            0 에러
  backend jest 전수                  437 suites / 9114 passed, 1 skipped
  키 충돌 뮤테이션                    RED / 원복 GREEN
