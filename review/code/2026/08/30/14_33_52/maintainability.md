# 유지보수성(Maintainability) Review

## 리뷰 범위

이번 라운드(`14_33_52`)는 `origin/main...HEAD` 누적 diff(63개 파일) 중 5라운드째 리뷰다.
유지보수성 관점 실질 검토 대상은 이전 네 라운드와 동일한 6개 코드/문서 파일이다:

- `codebase/backend/src/common/__test-utils__/source-scan.ts` — `countRawUpdateReturning`/`hasRawUpdateReturning`(변경 없음, 3라운드 이후 안정)
- `codebase/backend/src/common/__test-utils__/source-scan.spec.ts` — 이번 라운드 신규: 멀티라인 백틱 리터럴 양성 캐너리 1건 추가(양성 6→7)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — 이번 라운드 신규: `'허용목록의 선언 개수가 실측과 정확히 일치한다'` 테스트 + `ALLOWED` docstring 정정(상한 검사임을 명시)
- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` / `.spec.ts` — 변경 없음(1라운드 이후 안정)
- `plan/in-progress/update-returning-tuple-shape.md`, `CHANGELOG.md` — 문서(수치 정정, 보조 검토)

`review/code/2026/08/30/{12_41_15,13_15_58,13_46_53,14_11_02}/**`, `review/consistency/2026/08/30/12_17_21/**`(파일 8~63)는 이전 네 라운드가 생성한 워크플로 산출물(리포트 md/json)이라 애플리케이션 코드가 아니다 — 네 라운드의 동일 관점 리뷰어가 이미 같은 스코프 판단을 내렸고 이번 라운드도 그대로 따른다.

이번 라운드에 실제로 바뀐 코드는 직전 커밋(`1d606f7d0`) 하나뿐이며, 손댄 애플리케이션/테스트 파일은 `source-scan.spec.ts`(+9줄)와 `update-returning-rows.spec.ts`(+23/-4줄) 두 곳이다. 나머지(`source-scan.ts`, `kb-stats.helper.ts`, `kb-stats.helper.spec.ts`)는 1~4라운드에서 이미 정밀 검토된 상태 그대로 변경이 없어, 이번 라운드는 그 두 diff 에 집중하고 나머지는 회귀(변경 없음)만 확인했다.

저장소는 Read/Bash(읽기 전용)로만 조사했다 — 뮤테이션·쓰기 없음. `git status --short` 확인 결과 이 세션 산출 디렉터리(`review/code/2026/08/30/14_33_52/`) 외 변경 없음.

## 이전 라운드 대비 상태 — 직접 코드 대조로 재확인

4라운드(`14_11_02`)가 "developer SKILL §수렴 예외"로 명시 종결하며 남긴 WARNING 1건은 이번 라운드 이전(`1d606f7d0`)에 이미 반영됐다:

- **W1(4라운드 requirement)** — `ALLOWED` 의 선언 개수가 `discover()` 실측과 정확히 일치하는지 보는 신규 테스트(`update-returning-rows.spec.ts:287-302`)가 추가됐다. 코드를 직접 읽어 확인: `measured = new Map(discovered)` 로 실측 맵을 만들고 `ALLOWED` 각 항목의 선언값과 `!==` 비교한다 — 과다/미달 선언 양방향을 잡는다. `findUnguarded` 자체(:167-182)는 의도적으로 미변경 — "미가드 지점"과 "목록이 낡음"을 같은 배열로 보고하지 않기 위해 두 테스트로 축을 가른 설계 판단이 타당하다.
- **INFO(4라운드 testing, 멀티라인 축)** — `source-scan.spec.ts` 양성 `it.each` 에 멀티라인 백틱 리터럴 캐너리가 추가됐다(`:94-102`). 기존 6개 양성 케이스와 동일한 패턴(`_label`/`src` 튜플)을 그대로 따른다 — 일관성 이탈 없음.

3라운드 이전에 지적·해소된 매직넘버(`MIN_REASON_LENGTH`)·상수 재선언(`SRC` hoist)·반복 스캔(`discover()` 3회 → `beforeAll`)도 이번 라운드에서 회귀 없이 그대로 유지됨을 확인했다(`update-returning-rows.spec.ts:12,186,265-268`).

## 발견사항

이번 라운드의 신규 diff(두 파일, 총 +32/-4줄)에서 함수 길이·중첩 깊이·순환 복잡도·네이밍·매직넘버 관점의 새 결함은 발견되지 않았다. 신규 테스트(`:287-302`)는 기존 파일의 `it`/`expect(...).toEqual([])` 실패-메시지 생성 패턴을 그대로 따르고, 신규 캐너리(`source-scan.spec.ts:94-102`)도 기존 `it.each` 항목과 동일한 형태(주석으로 "왜 이 케이스가 필요한가" 명시)다.

- **[INFO]** 신규 테스트의 "왜 상한 검사인가" 설명이 두 곳에 사실상 동일한 문장으로 중복된다
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:194`-`202`(`ALLOWED` 위 docstring, "이 수가 실측과 같다는 보장은 `findUnguarded` 가 아니라 별도 테스트가 준다…") 와 `:288`-`294`(신규 `it` 내부 주석, "`findUnguarded` 는 `rawCount > allowedCount` 만 잡는다…")
  - 상세: 두 블록이 "`findUnguarded`는 상한 검사만 하고, 정확 일치는 별도 테스트가 담당한다"는 같은 사실을 각자 다른 위치(선언부 docstring / 테스트 본문)에서 거의 같은 논리로 두 번 설명한다. 이 저장소가 이미 확립한 "장문 배경 설명" 컨벤션(1~4라운드가 반복 확인한 `stripComments`/`countCalls`/`countRawUpdateReturning` 패턴)의 연장선이라 이례적이진 않지만, 순수 중복 관점에서는 한쪽이 다른 쪽을 참조("자세한 이유는 위 `ALLOWED` docstring 참조")하는 편이 한 문장을 짧게 줄인다.
  - 제안: 조치 불요(급하지 않음, 기능적 결함 아님). 다음에 이 설명을 손댈 일이 생기면 한쪽으로 합치거나 상호 참조로 축약을 고려.

- **[INFO]** (carry-forward, 신규 아님) `findUnguarded` 가 여전히 `source-scan.ts` 로 이관되지 않고 `update-returning-rows.spec.ts:167-182` 에만 정의돼 있다 — 3라운드(`13_46_53`)가 "두 번째 소비자(`assert-row-array.spec.ts` 발견형 확장) 등장 시점" 을 트리거로 조건부 유예했고, 4라운드가 재확인, 이번 라운드도 트리거 미발동 상태 그대로다. 새 결함 아님.

- **[INFO]** (carry-forward, 신규 아님) `hasRawUpdateReturning`(`source-scan.ts:136` 부근)은 여전히 자기 테스트 파일 외 소비자가 없다 — 2라운드가 "두 번째 소비자 등장 전까지 현행 유지" 로 이미 조치 불요 처분했고 변화 없다.

- **[정보 확인]** 함수 길이·중첩 깊이·순환 복잡도 — 신규 테스트 포함 전체 재확인 결과 이전 라운드 판정과 동일하게 양호
  - 신규 테스트(`update-returning-rows.spec.ts:287-302`)는 `beforeAll` 로 캐싱된 `discovered` 를 `Map` 으로 변환 후 `filter`+`map` 체이닝뿐이라 중첩 1단계, 순환 복잡도 1. 신규 캐너리(`source-scan.spec.ts:94-102`)는 기존 `it.each` 배열의 원소 추가일 뿐 함수 구조 변경이 없다.

## 요약

이번 라운드에서 실제로 바뀐 코드는 4라운드가 지적한 WARNING 1건(허용목록 선언값의 상한-검사 한계)과 INFO 1건(멀티라인 축의 소스 결합)을 해소하는 목적적 diff 두 곳뿐이며, 둘 다 기존 파일이 확립한 테스트 작성 패턴(`it.each` 캐너리, `filter`+`toEqual([])` 실패-메시지 스타일)을 그대로 따라 네이밍·함수 길이·중첩 깊이·순환 복잡도·일관성 모두 양호하다. 새로 관측한 것은 같은 설명이 docstring 과 테스트 본문 두 곳에 거의 동일한 문장으로 반복된다는 극히 사소한 INFO 하나뿐이며 기능적 결함이 아니다. `findUnguarded` 미이관·`hasRawUpdateReturning` 무소비 등 기존 INFO 는 이전 라운드가 이미 조건부 유예/조치 불요로 처분한 상태 그대로이고 이번 라운드에서 확대되지 않았다. 4라운드에 걸쳐 실질 WARNING(중첩 제네릭 미탐지·판정 축 테스트 부재·파일 단위 존재-only 판정·허용목록 파일 단위 전면 면제·검증 로직 부재·다중 unguarded 미검증·허용목록 선언값 미검증)이 모두 코드에 반영돼 해소됐고, 이번 라운드는 그 수렴 상태를 유지하며 새로운 구조적 결함을 추가하지 않았다.

## 위험도
LOW
