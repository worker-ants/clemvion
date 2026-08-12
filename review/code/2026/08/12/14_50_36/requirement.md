# 요구사항(Requirement) Review — EIA idempotency fail-open fix (재검증 라운드, `14_50_36`)

## 검토 방법

프롬프트 스냅샷을 그대로 신뢰하지 않고 작업 트리를 직접 열어 재검증했다(전 라운드 `14_27_02`
문서화 리뷰어가 병렬 세션의 워크트리 뮤테이션으로 CRITICAL 오탐을 낸 전례가 있어, 같은 클래스의
race 를 배제하기 위함):

- `grep -n "catchError\|switchMap" idempotency.interceptor.ts` → `catchError` 107행 <
  `switchMap` 113행. **현재 committed 상태 기준 순서 정확**.
- `git status --porcelain` → `review/code/2026/08/12/14_50_36/` 외 변경 없음(clean).
- `npx jest idempotency.interceptor.spec.ts` → **16/16 통과** (전 라운드 14/14 + 신설 2건:
  `set()` 실패 fail-open, 비-Error reject 분기).
- `npx eslint idempotency.interceptor.ts idempotency.interceptor.spec.ts` → 0 errors/0 warnings.
- `spec/data-flow/15-external-interaction.md:308,333` 원문 직접 열람 → 코드 docstring·
  CHANGELOG·테스트 주석의 인용이 정확히 일치.
- `spec/5-system/14-external-interaction-api.md:1053-1055`(R8), `:81`(EIA-IN-11), `:140`
  (EIA-RL-02) 직접 열람 → 코드·테스트 인용 정확.
- `plan/in-progress/backend-lint-gate-broken-on-main.md:534-548` → R8 초과 항목이 여전히
  `- [ ]`(미해결)로 남아 백로그 추적 중임을 확인 — 이번 diff 가 R8 범위를 건드리지 않았다는
  주장과 일치.
- `bodyHashOf` 정의 개수(`grep -n "bodyHashOf ="`) → 1건(90행). 전 라운드 WARNING(중복 헬퍼)이
  실제로 통합됐다.

## 요약 결론

전 라운드(`14_27_02`) 리뷰에서 나온 CRITICAL 0 / WARNING 3(concurrency 문서화·CHANGELOG 누락·
`bodyHashOf` 중복) 은 `RESOLUTION.md` 가 주장한 대로 전부 조치됐고, 위 재검증으로 그 주장이
사실임을 독립적으로 확인했다. 이번 diff(코드 자체는 전 라운드와 동일, 추가된 것은 CHANGELOG
항목·`bodyHashOf` 통합·`set()` 실패/비-Error 테스트 2건·plan 체크박스 갱신)는 spec 이 요구하는
"Redis 전 경로 fail-open — 가용성 우선" 을 `get()` 런타임 reject 경로까지 정확히 확장했고,
`catchError` 삽입 위치(`switchMap` 앞)는 `ConflictException`(409) 을 삼키지 않도록 정확히
설계돼 있으며 캐너리 테스트로 고정돼 있다.

## 발견사항

- **[INFO]** `[SPEC-DRIFT]` 아님, 순수 확인 — `spec/data-flow/15-external-interaction.md`
  §외부 의존(:308) "Redis … 전 경로 fail-open (warn) — 가용성 우선" 요구와 코드 docstring
  (`idempotency.interceptor.ts:61-72`)·CHANGELOG 항목·`catchError` 인라인 주석(`:100-106`)
  세 곳의 인용이 원문과 line-level 로 정확히 일치한다. 괴리 없음.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:61-72`

- **[INFO]** 전 라운드 documentation 리뷰어의 CRITICAL("`catchError` 가 `switchMap` 뒤에 있어
  409 검출이 죽는다")은 이번 라운드 재검증 결과 **여전히 오탐으로 확정**된다 — 직접 소스를
  읽고(`catchError` 107행 < `switchMap` 113행) 16/16 테스트를 실행해 확인했다. `RESOLUTION.md`
  §documentation 절의 원인 분석(병렬 리뷰 세션의 공유 워크트리 뮤테이션)과 일치하며 코드
  결함이 아니다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:107,113`

- **[INFO]** 클래스 docstring 이 주장하는 "fail-open 세 경로 모두(생성자 null·조회 실패·적재
  실패)"가 이제 테스트로 전부 뒷받침된다 — `set()` reject 테스트(`spec.ts:414-447`, warn 로그
  까지 단언)와 비-Error reject 테스트(`spec.ts:449-464`)가 전 라운드 testing/INFO 4·5 를 정확히
  해소했다. 두 테스트 모두 실행 확인(16/16 GREEN).
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:414-464`

- **[INFO]** `bodyHashOf` 중복(전 라운드 maintainability WARNING #3)이 실제로 모듈 최상단
  단일 정의(`spec.ts:90-93`)로 통합됐고, 캐시 히트 describe 블록의 로컬 재정의가 삭제됐다
  (diff `@@ -159,11 +165,6 @@` 에서 제거 확인). 주장과 실제 diff 가 일치.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:89-93`

- **[INFO]** CHANGELOG 항목(전 라운드 documentation WARNING #2)이 실제로 추가됐고, 내용이
  구현 동작·spec 인용과 정확히 일치한다 — "세 경로 모두 규약대로 열리게 했다" 는 서술이 조회
  경로만 이번 diff 로 신규 수정되고 나머지 두 경로는 기존에 이미 fail-open 이었다는 사실과
  모순 없이 읽힌다("이번 fix 로 세 경로가 함께 성립하게 됐다"는 결과 서술이지 "세 경로 모두
  이번에 고쳤다"는 주장이 아님). 운영 유의점(중복 억제 무력화, `EIA-RL-02` 는 정상 경로
  계약)도 concurrency 리뷰어 지적과 정합한다.
  - 위치: `CHANGELOG.md:3-18`

- **[INFO]** R8(캐시 제외 범위 `>= 400` 이 409·410 까지 떨구는 선재 결함) 은 이번 diff 의
  변경 대상이 아니며, `plan/in-progress/backend-lint-gate-broken-on-main.md:534-548` 에
  여전히 미해결(`- [ ]`)로 정확히 추적되고 있다. 은폐·회귀 없음.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:159-161`

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md:498` 체크박스가 `[ ]` →
  `[x]` 로 갱신됐고, 그 근거(spec 인용·무수정 프로브 실증·뮤테이션 실측 4건 RED)가 본문에
  구체적으로 남아 있어 "체크박스=실제 상태" 관례(plan lifecycle 규약)를 충족한다. 새로 추가된
  concurrency 항목(`:524`)은 의도적으로 `[ ]`(미해결, 관측 지표 백로그)로 남아 과대 주장이
  없다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:498,524`

## 점검 관점별 확인

1. **기능 완전성** — `get()` 런타임 reject → 캐시 미스 강등(fail-open) 이 구현·문서화·테스트
   3축 모두에서 완결. 세 fail-open 경로(생성자 null·조회 실패·적재 실패) 전부 테스트로 커버됨
   (전 라운드는 조회 실패만).
2. **엣지 케이스** — 비-Error reject(`String(err)` else 분기), 손상된 캐시 JSON, 캐시 히트 시
   `status` typeof 가드 모두 커버.
3. **TODO/FIXME** — 신규 코드에 없음. R8 선재 결함은 docstring + 캐너리 테스트 + plan 백로그로
   정상 추적(TODO 주석이 아니라 근거 있는 문서화).
4. **의도-구현 괴리** — 클래스 docstring "세 경로 모두 fail-open" 주장이 이제 실제 코드·테스트
   범위와 정확히 일치(전 라운드에 지적된 괴리가 이번 라운드에 해소됨).
5. **에러 시나리오** — GET 실패·SET 실패·비-Error reject 모두 fail-open + warn 로그로 정의,
   전부 테스트로 고정.
6. **데이터 유효성** — 해당 없음(입력 검증 변경 없음, `readKey`/`hashBody` 미변경).
7. **비즈니스 로직** — spec 의 가용성 우선 원칙이 정확히 반영. fail-open 중 중복 억제
   무력화라는 트레이드오프도 CHANGELOG·docstring·plan 백로그에 정직하게 명시.
8. **반환값** — `intercept()` 모든 분기가 `Observable<unknown>` 반환, 누락 없음(변경 없음).
9. **spec fidelity** — `spec/data-flow/15-external-interaction.md:308,333`, `spec/5-system/
   14-external-interaction-api.md:81,140,1053-1055` 전부 직접 대조, line-level 일치. spec
   본문 자체의 결함 의심 없음.

## 위험도

NONE
