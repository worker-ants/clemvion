# RESOLUTION — `00_20_20`

리뷰 결과: **CRITICAL 0 / WARNING 2 / RISK MEDIUM**. reviewer 8명 실행, 강제 7명 전원 결과
확보 (`forced_missing: []`, `unfinished: []`). **WARNING 2건 + INFO 2건 조치.**

두 WARNING 다 문서 drift — documentation 리뷰어 표현대로 **이 PR 안에서 같은 근본 원인의
4번째 재발**이다. 코드는 security/scope/side_effect 전 축에서 NONE~LOW.

---

## WARNING #1 (documentation) — 테스트 docstring 이 형태 검증 축을 반영 못 함 → 조치

직전 커밋이 추가한 형태 검증 테스트 9건과 `isIdempotencyEntry()` 신설이 모듈 docstring·블록
docstring 어디에도 없었다.

**조치**: 두 자리에 형태 검증 축을 추가하고, **왜 별도 축인지**(= `JSON.parse` 는 문법 오류에만
던지므로 `'null'` 은 통과한 뒤 `TypeError` 를 냈다)까지 적었다. 블록 docstring 에는 **fixture 가
조건을 하나씩만 위반해야 하는 이유**도 남겼다 — 그게 이번에 실측으로 배운 것이고, 다음 사람이
fixture 를 추가할 때 같은 함정을 피하려면 그 자리에 있어야 한다.

## WARNING #2 (documentation/requirement 공동) — plan 완료 노트가 후속 수정을 누락 → 조치

"완료" 선언 뒤에 `isIdempotencyEntry` 형태 가드가 추가됐는데 노트가 그대로였다. requirement 는
"체크리스트가 실제보다 좁게 완료된 것처럼 읽힌다" 로, documentation 은 "완료 선언 이후 후속이
없다" 로 같은 결함을 지적했다.

**조치**: **"위 '완료' 는 절반이었다"** 로 시작하는 후속 문단을 추가했다. 프로브 실측값과,
가드를 뮤테이션으로 두 번 간 경위(하중 없는 절 제거 → fixture 격리)까지 적었다.

---

## INFO 조치 2건

### INFO 3 — `describeShape()` 가 하중을 받지 않는다 (리뷰어 뮤테이션 실측)

함수 본문을 상수로 치환해도 41/41 그대로 통과했다. 내가 방금 "관측 가능한 동작이 없는 절은
두지 않는다" 며 가드에서 두 절을 걷어냈는데, **같은 커밋에서 만든 헬퍼가 같은 상태**였다.

**조치**: 걷어내는 대신 **단언을 붙였다.** 이 문자열은 캐시 payload 를 로그에 싣지 않는다는
방침 아래 운영이 원인을 좁히는 **유일한 단서**라 값 자체가 계약이다. `it.each` 8건 전부가
기대 형태(`null`·`number`·`array`·`string`·`object`)를 단언한다.

### INFO 4 — `switchMap` 분기 7개, 내가 세운 유예 트리거가 발동했다

두 라운드가 "6번째 분기가 추가되면 재검토" 로 유예했는데 이번에 7개가 됐다.

**조치**: **plan 항목으로 꺼냈다.** 조건부 유예를 조용히 연장하지 않기 위해서다 — 이 세션에서
"하겠다고 쓰고 안 함" 이 반복됐고, 트리거가 발동한 유예는 더 이상 유예가 아니다.
이 PR 에서 하지 않는 이유(순수 구조 변경 → 리뷰 라운드 추가 요구 / 남은 발견이 전부 문서·테스트
층위라 수렴 중)도 함께 적었다.

## 나머지 INFO 처분

| # | 항목 | 처분 |
|---|---|---|
| 1 | `statusCode` 값 범위 미검증 | **다음 PR 로 이관 등재** — `readKey`/`hashBody` 경계 항목에 붙였다(성격이 같다). 등재하며 실측 하나를 더 적었다: `NaN`·`Infinity` 는 **JSON 리터럴이 아니라** `JSON.parse` 로 도달 불가하므로 실제 표면은 음수·비정상 정수뿐이다 |
| 2 | `data-flow/15` fail-open 문면 SPEC-DRIFT | **이미 등재됨** — `23_48_39` 에서 planner 인계로 올렸고 `00_20_21` 이 재확인 |
| 8 | `discardCorruptEntry` 2번째 파라미터가 예외/문자열 겸용 | **유예** — 3번째 호출부 생기면 `Error \| string` 명시화 |
| 5·6·7·9·10 | 확인 기록 | 조치 불요 |

## 검증

- eslint **0/0**(수정 중 prettier 1건이 게이트에 걸려 손으로 고쳤다)
- backend unit **418 suites / 8549 passed** · 인터셉터 **41/41**
- e2e **47 suites / 269 passed** (형태 가드 반영 후 실행)
- 이번 조치는 docstring·테스트 단언·plan — **프로덕션 동작 무변경**
