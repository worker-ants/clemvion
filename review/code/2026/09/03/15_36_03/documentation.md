# 문서화(Documentation) 리뷰

## 맥락

이번 diff 는 `entity-nullable-column-type-mismatch` 배치 1(`null as unknown as X` 캐스트 8건
제거 + `User`/`Schedule` 컬럼 타입 `| null` 확장 + 회귀 가드 신설)의 **세 번째 리뷰 라운드**다.
프롬프트에 동봉된 `review/code/2026/09/03/14_44_15/*`·`review/code/2026/09/03/15_17_01/*`·
`review/consistency/2026/09/03/15_17_03/*` 는 앞선 두 코드 리뷰 라운드 + 1회 consistency-check
라운드의 산출물이며, 그 자체가 이번 diff 에 새로 추가되는 파일이다. 아래는 실제 소스(파일
1~15)를 대상으로 하되, 앞선 라운드가 이미 지적한 문서화 항목들이 이번 최종 상태에서 실제로
해소됐는지를 `Read`/`grep`으로 직접 재검증했다.

## 발견사항

- **[INFO]** `CHANGELOG.md`에 이번 배치(캐스트 8건 제거 + `type:` 4건 보강 + 회귀 가드 신설)가
  반영되지 않았다 — 두 라운드 연속으로 지적되고도 여전히 미기재
  - 위치: 저장소 루트 `CHANGELOG.md` (동일 클래스 선례: `:63` `Execution.error` 정정 문단)
  - 상세: 직접 확인한 결과 `CHANGELOG.md`에 `passwordHash`/`twoFactorSecret`/`lockedUntil` 등
    이번 배치가 건드린 필드명이나 `nullable-type-lie-cast` 가드에 대한 언급이 없다. 정확히 같은
    클래스(엔티티 `nullable: true` 컬럼 vs TS non-null 타입)의 이전 정정인 `Execution.error`는
    CHANGELOG에 "부수로" 문단으로 남아 있다. wire 응답 스키마·API 동작에 영향이 없는 순수 내부
    타입 정합화라는 점에서 저장소 관례상 필수는 아니라고 앞선 두 라운드가 이미 판단했고 그
    판단에 동의한다 — 다만 세 번째 라운드에도 여전히 미기재라는 사실 자체는 기록해 둔다.
  - 제안: 조치 불요(기존 판단 유지). 남기고 싶다면 한 줄("User/Schedule의 nullable 컬럼 타입
    8건을 정정하고 `null as unknown as X` 재발 방지 가드를 추가했다")로 충분하다.

- **[INFO]** `source-scan.ts`의 `countXxx`/`hasXxx` 인접 페어링 관례가 신규 함수 쌍 삽입으로
  여전히 깨진 상태다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:112-173`
    (`countRawUpdateReturning` 112 → 신규 `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`
    135-168 → 원래 짝 `hasRawUpdateReturning` 170)
  - 상세: 직접 읽어 확인 — `countRawUpdateReturning`과 그 래퍼 `hasRawUpdateReturning` 사이에
    무관한 새 쌍이 끼어 있다. 앞선 두 라운드가 이미 지적했고 "다음에 이 파일을 만질 때 파일
    끝으로 이동"으로 판단이 유지된 사안이라 이번 라운드의 새 결함은 아니다. 동작에는 영향이
    없다(문서 탐색성만의 문제).
  - 제안: 조치 불요(기존 판단 유지).

- **[정보 — 이미 해소됨]** 1R RESOLUTION이 "plan이 배치 2 후보로 추적한다"고 단언했던 두 항목이
  이번 라운드에서는 plan 본문에 실제로 이름으로 등재돼 있음을 확인했다
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:167-176` (`(d) Schedule.lastRunAt`,
    `(e) auth.service.spec.ts:58` 의 `lockedUntil` 캐스트)
  - 상세: 2R(`15_17_01`) documentation 리뷰가 WARNING으로 지적한 "RESOLUTION이 추적된다고
    썼는데 plan 본문에 이름이 없다"는 결함이 이번 최종 상태에서는 해소돼 있다 — 두 항목 모두
    plan의 "배치 2 후보" 목록에 `(d)`·`(e)`로 명시적으로 등재됐고, 왜 이렇게 이연했는지(리뷰가
    거짓 주장을 잡았다는 경위)까지 인용구(`> **(d)·(e)는 리뷰가 내 거짓 주장을 잡아 추가됐다**`)
    로 남아 있다. `auth.service.spec.ts:58`의 캐스트 자체는 아직 정리되지 않았지만(직접 확인:
    `lockedUntil: null as unknown as Date` 그대로 존재) 이는 의도적 이연이고 plan에 정확히
    그렇게 기록돼 있다.
  - 제안: 조치 불요 — 이미 해소된 항목을 기록용으로만 남긴다.

- **[정보 — 이미 해소됨]** 가드 docstring의 "spec fixture 캐스트 12건 전부 정당" 하드코딩 숫자가
  제거되고 재발 방지 설명으로 교체됐다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:29-31`
  - 상세: 1R documentation 리뷰가 지적한 "12건"이 같은 PR 안에서 12→24로 낡았던 문제(2R
    RESOLUTION이 실측)를 이번 최종본은 숫자를 아예 지우고 "검증되지 않는 숫자는 적지 않는다.
    지금 세고 싶으면 `grep -rn 'null as unknown as' --include='*.spec.ts'`" 로 대체했다. 직접
    읽어 확인 — 근본 원인(가드 자신의 spec이 fixture 문자열로 같은 패턴을 쓰는 것)까지 설명해
    "이런 종류의 숫자는 왜 낡는지"를 다음 사람에게 알려준다. 문서화 관점에서 모범적인 정정이다.
  - 제안: 조치 불요.

- **[정보 — 이미 해소됨]** `spec/1-data-model.md` §2.9의 `next_run_at` non-null 표기 간극은
  developer 권한 밖으로 정확히 식별돼 planner 턴 후속 항목으로 등재돼 있다
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:151-158`
  - 상세: consistency-check 라운드(`15_17_03`)가 WARNING으로 지적한 이 spec 표기 간극에 대해
    plan 문서는 "**developer 권한 밖**이다 — 내가 쓴 문장이 아니라 자기-반증형 소정정 예외에
    해당하지 않는다"고 정확한 판단 근거를 남기며 planner 턴 후속으로 이연했다(체크박스
    `- [ ] **후속(planner 턴)**`). `spec/data-flow/10-triggers.md §3.2` 보강 필요성도 함께
    적어 뒀다. CLAUDE.md의 자기-반증형 소정정 예외 5조건 중 1조건("developer 자신이 그 문장을
    썼다")이 충족되지 않는다는 판단이 맞다(`spec/1-data-model.md` §2.9는 developer가 이번 PR
    이전에 쓴 문장이 아니다).
  - 제안: 조치 불요 — 올바르게 범위를 인식하고 위임했다.

## 신규 코드 문서화 품질 (참고)

새로 추가된 `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`(`source-scan.ts`)와
`nullable-type-lie-cast-guard.ts`/`.spec.ts`의 JSDoc은 "왜 필요한가 · 왜 이 위치인가 · 무엇을
못 보는가"를 촘촘히 남기고 있고, 인용된 수치(`scripts/backend-typecheck-baseline.json` 37파일 중
비-spec **0개**, `secret-resolver.service.ts`의 정리 이력 주석 실재)를 직접 실측·대조해 모두
정확함을 확인했다. `schedule-response.dto.ts`의 `nextRunAt?: string | null`은 이미 nullable로
선언돼 있어 이번 entity 타입 정정과 API 응답 계약 사이에 새로운 불일치는 없다. 신규 테스트
(`auth.service.spec.ts`·`users-login-attempts.service.spec.ts`·`schedule-runner.service.spec.ts`·
`schedules.service.spec.ts`)의 블록 주석은 "왜 이 테스트가 필요한가(TypeORM `update()`가
`undefined` 필드를 SET 절에서 생략해 값이 남는다)"와 "`toBeNull()`이어야지 `toBeFalsy()`면 안
된다"는 이유를 매번 명시해 저장소 관례에 부합하는 고품질 문서화다.

## 요약

이 배치는 이미 두 번의 코드 리뷰 라운드와 한 번의 consistency-check 라운드를 거쳤고, 그 세
라운드가 지적한 문서화 관련 항목(RESOLUTION의 "추적된다"는 허위 주장, 가드 docstring의 낡은
"12건" 하드코딩, `spec/1-data-model.md` 간극)이 이번 최종 diff 상태에서 실제로 해소되었음을
`Read`/`grep`으로 직접 재검증했다 — plan 문서에 `(d)`·`(e)` 항목이 이름으로 등재됐고,
docstring의 하드코딩 숫자는 제거됐으며, spec 간극은 developer 권한 밖으로 정확히 식별돼 planner
턴 후속으로 넘어갔다. 남은 것은 세 라운드 내내 반복된 두 개의 저위험 INFO(`CHANGELOG.md` 미기재,
`source-scan.ts` 함수 페어링 인접성)뿐이며 둘 다 이미 "필수 아님 · 다음에 그 파일을 만질 때"로
판단이 유지돼 있다. 신규 함수·테스트의 JSDoc/블록 주석은 인용 수치까지 실측 대조해 정확함을
확인했고, API 문서(DTO)와의 불일치도 없다.

## 위험도

LOW
