# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 핵심 코드(발견형 raw UPDATE/DELETE…RETURNING 가드, `kb-stats.helper.ts` 타입 정정)는 3라운드 하드닝을 거쳐 안전하나, `CHANGELOG.md`와 plan 완료 배너가 2·3라운드의 실질 변경(허용목록 파일 단위→개수 단위, `findUnguarded` 추출, blind spot 캐너리 2건)을 반영하지 못해 **사실과 다른 수치**(음성 테스트 5→실제 7)를 담고 있다. 그 외 `findUnguarded`의 다중 파일 보고 판별 입력 부재, `countRawUpdateReturning`의 CTE 접두 blind spot 미공개도 남아 있다. 모든 forced reviewer(7명) 결과가 인라인 전문으로 확보되어 강제 화이트리스트 미이행은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `CHANGELOG.md`의 Unreleased 항목이 1라운드(`dd273828f`) 시점에 작성된 뒤 갱신되지 않아, 2·3라운드 하드닝(허용목록 파일 단위 전면 면제 → 개수 상한 `a2ab29e2c`, `findUnguarded` 순수 함수 추출+합성 테스트, blind spot 캐너리 2건 `030e9a825`)을 반영하지 못함. "판정 축(양성 6·음성 5)" 서술은 지금 소스 대조 결과 **음성이 실제로 7개**라 사실과 다름(testing 리뷰어도 독립적으로 동일 불일치 발견) | `CHANGELOG.md:3-23` (특히 `:21`), 대조 대상 `codebase/backend/src/common/__test-utils__/source-scan.spec.ts` 음성 `it.each`(7개) | CHANGELOG 항목을 최신 코드로 재대조해 (a) 음성 테스트 개수를 7로 정정, (b) 허용목록이 이제 지점 개수 단위로 면제된다는 문장 추가 |
| 2 | Documentation | `plan/in-progress/update-returning-tuple-shape.md`의 "완료" 배너(체크박스 `- [x]`의 근거)가 1라운드 뮤테이션 표(3행)만 싣고, 2·3라운드가 이 가드 자신에게서 찾아 고친 두 겹의 후속 결함(허용목록 파일 단위 면제, 판정 로직 미검증 구조, 스캐너 blind spot 2건)을 소급 반영하지 않음 — 배너만 읽으면 허용목록이 여전히 파일 단위 전면 면제라고 오해 가능 | `plan/in-progress/update-returning-tuple-shape.md:313-348` | 배너 하단에 "후속 하드닝(2·3라운드)" 문단 추가 또는 `review/code/2026/08/30/13_15_58/RESOLUTION.md` 링크 |
| 3 | Testing | 이 PR의 핵심 하드닝인 `findUnguarded()`를 검증하는 합성 테스트 5개가 전부 `discovered` 배열 원소를 **1개**만 사용 — 여러 unguarded 파일을 루프가 전부 순회·보고하는지 가르는 판별 입력이 없음. scratch 뮤테이션(첫 unguarded 발견 시 `break`)으로 실증: 기존 5개 테스트 전부 GREEN(뮤턴트 생존), 다중 원소 입력(`[['a.ts',2],['b.ts',2]]`)에서는 원본·뮤턴트 결과가 실제로 갈림 | `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 함수 `findUnguarded`(167-182행), 테스트 블록 306-351행 | 합성 `describe`에 `discovered` 원소 2개 이상이 모두 unguarded인 케이스 추가(예: `[['a.ts',2],['b.ts',2]]` + `guardCountOf`가 둘 다 1 반환 → `unguarded === ['a.ts','b.ts']`) |
| 4 | Requirement | `countRawUpdateReturning`의 "선두 키워드" 판정(`/^\s*(UPDATE\|DELETE)\b/i`)이 **CTE(`WITH ...`)로 시작하는 top-level UPDATE/DELETE...RETURNING**을 여전히 놓침 — SQL 리터럴 첫 단어가 `WITH`라 정규식이 `count=0`으로 오판. 이 항목은 1라운드 리뷰(`review/code/2026/08/30/12_41_15/requirement.md:15`)가 `.query(sqlVar)`와 "같은 범주"로 이미 언급했으나 SUMMARY 합성 과정에서 누락돼 2·3라운드 모두 조치되지 못함. 오늘 저장소에 CTE+top-level UPDATE...RETURNING 실 사용처는 없어(직접 확인) 활성 버그는 아니나, docstring이 "이 축이 안 보는 것"을 두 항목만 나열해 완전한 목록처럼 읽힘 | `codebase/backend/src/common/__test-utils__/source-scan.ts` `countRawUpdateReturning` 판정부 | docstring "이 축이 안 보는 것" 절에 CTE 접두 케이스 명시 추가 + `source-scan.spec.ts` 음성 케이스에 `'WITH x AS (SELECT 1) UPDATE t SET a=1 RETURNING id'` → `hasRawUpdateReturning === false` 캐너리 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | `findUnguarded`가 `source-scan.ts`의 "세 번째 가드가 생겨도 여기만 고치면 되도록 계산을 모은다"는 자신의 공유 원칙을 아직 따르지 않고 `update-returning-rows.spec.ts` 안에만 정의됨 — `assert-row-array.spec.ts`가 향후 발견형 판정으로 확장되면 복제(재사용 아님) 위험 | `update-returning-rows.spec.ts:167-182`, plan `plan/in-progress/update-returning-tuple-shape.md:280-290`(같은 클래스의 `CONSUMING` 정규식 복제 항목 이미 기록) | 급하지 않음. `assert-row-array.spec.ts`가 발견형 판정을 필요로 하는 시점에 `source-scan.ts`(또는 신규 공유 모듈)로 이관 |
| 2 | Maintainability | `[string, number]` 튜플 shape이 이름 없이 세 곳(`EXPECTED`, `findUnguarded` 매개변수, `discover()` 반환)에서 구조적으로만 동일 — 의미가 다른데 컴파일러가 혼동을 못 잡음 | `update-returning-rows.spec.ts:64, 167-168, 247` | 급하지 않음. 라벨 있는 튜플 타입 별칭 고려 |
| 3 | Scope | `update-returning-rows.spec.ts`의 `SRC` 상수를 두 `describe` 블록의 로컬 선언에서 파일 상단으로 hoist — 새 블록이 공유해야 해서 나온 결과이며 이전 라운드(`13_15_58` maintainability) 발견을 정정한 것, 근거 명확 | `update-returning-rows.spec.ts` 상단 | 조치 불요 |
| 4 | Scope/Side Effect | `kb-stats.helper.ts`의 `.query<>()` 제네릭 타입 인자 정정(`{...}[]` → `[{...}[], number]`)은 SQL·바인딩·반환값 소비 여부 불변인 순수 컴파일타임 변경 — 새 발견형 스캐너가 이 파일을 잡아내자 allowlist 면제 대신 타입 자체를 정정한 것이며 이전 두 라운드에서 이미 승인·기록됨, 확대 없음 | `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` `refresh()` | 조치 불요 |
| 5 | Security | 신설 정적 스캐너(`countRawUpdateReturning`/`hasRawUpdateReturning`)와 `discover()`/`listSources()` 재귀 파일시스템 스캔은 전부 저장소 자신의 1st-party 소스만 읽는 읽기 전용 테스트 인프라 — 외부 입력이 경로·정규식 구성에 개입하지 않아 인젝션/경로탐색/ReDoS 해당 없음. CALL 정규식은 병리적 입력으로 직접 벤치마크(scratch, 저장소 무변경)해 선형 시간 확인 | `source-scan.ts`, `update-returning-rows.spec.ts` | 조치 불요 |
| 6 | Requirement | raw UPDATE/DELETE…RETURNING → `updateReturningRows` 불변식이 `spec/conventions/`에 여전히 미문서화(전수 grep 0건) — 이미 `plan/in-progress/update-returning-tuple-shape.md:409`가 planner 위임을 명시했고 developer 권한 밖, 이번 코드 PR의 조치 대상 아님 | `plan/in-progress/update-returning-tuple-shape.md:409` | 조치 불요(추적 중) |
| 7 | Documentation | 핵심 신규 코드(JSDoc/인라인 주석)는 코드와 직접 대조 결과 서술이 정확하고 "왜 필요한가"·"판정 축"·"이 축이 안 보는 것"을 충실히 남김 — 새 결함 없음 | `source-scan.ts`, `kb-stats.helper.ts`/`.spec.ts` | 조치 불요 |
| 8 | Side Effect/Scope | `review/code/2026/08/30/{12_41_15,13_15_58}/**`, `review/consistency/2026/08/30/12_17_21/**` 33개 신규 파일은 전부 CLAUDE.md가 정한 경로 규약과 일치하는 정상 워크플로 산출물, 기존 파일 미수정 — 스코프 이탈 아님 | `review/code/**`, `review/consistency/**` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 하드코딩 시크릿·인젝션·경로탐색·ReDoS 전부 실측(벤치마크 포함)으로 확인 없음. 이전 두 라운드와 결론 일치 |
| requirement | LOW | CTE 접두 UPDATE/DELETE…RETURNING blind spot 미공개(WARNING). 핵심 하드닝 3라운드는 정확히 검증됨(51 테스트 GREEN, allowlist 개수 재계산 일치) |
| scope | NONE | 41개 파일 전수 대조 결과 스코프 이탈 없음. `SRC` hoist·`kb-stats.helper.ts` 타입 정정은 근거 있는 경계 사례 |
| side_effect | LOW | 전역상태·환경변수·네트워크·이벤트 변경 없음. 유일한 FS 접근은 읽기 전용, 이전 라운드 대비 오히려 부작용 표면 축소 |
| maintainability | LOW | `findUnguarded` 미이관(향후 복제 위험), 튜플 타입 무명 — 둘 다 INFO. 직전 라운드 지적 사항(매직넘버·상수 재선언·중복호출) 전부 해소 확인 |
| testing | LOW | `findUnguarded` 다중 파일 보고 판별 입력 부재(WARNING, 뮤테이션으로 실증). CHANGELOG 테스트 개수 서술 불일치(INFO, documentation과 교차검증). 43/43 GREEN 재확인 |
| documentation | MEDIUM | `CHANGELOG.md`·plan 완료 배너 둘 다 1라운드 시점에 고정된 뒤 2·3라운드 하드닝 미반영, CHANGELOG 수치가 사실과 다름(WARNING 2건) |

## 발견 없는 에이전트

security, scope — 실질 WARNING/CRITICAL 없이 "문제 없음" 확인만 보고(위 참고 표에 근거 기록).

## 권장 조치사항

1. `CHANGELOG.md`의 Unreleased 항목을 최신 코드로 재대조해 음성 테스트 개수(5→7)를 정정하고, 허용목록이 파일 단위가 아닌 지점 개수 단위 면제로 바뀐 사실을 추가한다.
2. `plan/in-progress/update-returning-tuple-shape.md` 완료 배너에 2·3라운드 후속 하드닝(허용목록 3-tuple화, `findUnguarded` 추출, blind spot 캐너리 2건) 요약 문단을 추가한다.
3. `update-returning-rows.spec.ts`의 `findUnguarded` 합성 테스트에 다중 unguarded 파일을 모두 보고하는지 가르는 케이스를 추가한다.
4. `source-scan.ts`의 docstring "이 축이 안 보는 것" 절에 CTE 접두(`WITH ... UPDATE/DELETE ... RETURNING`) blind spot을 명시하고 대응 음성 캐너리를 추가한다.
5. (급하지 않음) `findUnguarded`를 `source-scan.ts`(또는 신규 공유 판정 모듈)로 이관해 `assert-row-array.spec.ts`가 발견형 판정으로 확장될 때 재사용 가능하게 한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (전원, 7명) — forced 전원 결과 인라인 전문으로 확보됨. 강제 화이트리스트 미이행 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |
