# 요구사항(Requirement) Review — EIA idempotency 런타임 fail-open fix (3라운드 째 재검증, `15_04_25`)

## 검토 방법

프롬프트 스냅샷을 신뢰하지 않고 작업 트리를 직접 열어 독립 재검증했다(전전 라운드
`14_27_02` documentation 리뷰어가 병렬 세션의 공유 워크트리 뮤테이션으로 CRITICAL 오탐을
낸 전례가 있어, 동일 클래스의 race 를 배제하기 위함 — 어떤 뮤테이션도 가하지 않고 `Read`/
`grep`/`git`/`jest`/`eslint` 만 사용):

- `Read codebase/backend/.../idempotency.interceptor.ts` 전문 — `catchError` 107행,
  `switchMap` 113행. **소스 기준 순서 정확**(뒤집힌 상태 아님).
- `git status --porcelain` (대상 4파일 한정) → 변경 없음(clean). `git diff HEAD -- ...ts` →
  빈 출력.
- `git log --oneline origin/main..HEAD` → 3커밋(`5d79dc123` 원 fix, `f933f2cf6` WARNING 3건
  조치, `1fb233eca` 기록 정정+헤더 docstring 반영) — 프롬프트가 나열한 리뷰 대상과 일치.
- `cd codebase/backend && npx jest idempotency.interceptor.spec.ts` → **16/16 통과** (직접
  실행, 로그에 GET/SET fail-open warn 3회 출력 확인 — mock 이 실제로 reject 경로를 탔다는
  증거).
- `npx eslint idempotency.interceptor.ts idempotency.interceptor.spec.ts` → 0 errors/0
  warnings.
- `grep -n "TODO\|FIXME\|HACK\|XXX"` 대상 2파일 → 0건.
- `spec/data-flow/15-external-interaction.md:308,333` 원문 직접 열람 → "Redis … blacklist ·
  idempotency · seq · BullMQ. 전 경로 fail-open (warn) — 가용성 우선" / "토큰 blacklist·
  idempotency·jti 추적·notification enqueue 모두 Redis/DB 미가용 시 fail-open" — 코드
  docstring(`:62-65`)·CHANGELOG·`catchError` 인라인 주석 인용과 line-level 정확히 일치.
- `spec/5-system/14-external-interaction-api.md:81`(EIA-IN-11), `:140`(EIA-RL-02), `:346`
  (`409 IDEMPOTENCY_KEY_CONFLICT`), `:1053-1055`(R8) 직접 열람 → 코드 구현·주석 인용 정확
  (에러 코드 문자열 `IDEMPOTENCY_KEY_CONFLICT` 포함).
- `grep -n "bodyHashOf"` → 정의 1건(`:94`), 참조 6건 — 모듈 최상단 단일 정의로 통합돼 있고
  중복 재선언 없음(전 라운드 maintainability WARNING #3 실제 반영 확인).
- `plan/in-progress/backend-lint-gate-broken-on-main.md:498`(`[x]`)·`:524`(`[ ]`, concurrency
  관측 백로그) 직접 열람 — 체크박스가 실제 코드 상태·문서 상태와 일치.
- `git show 1fb233eca -- idempotency.interceptor.spec.ts` → 헤더 docstring 에 세 번째
  describe 한 줄 실제 반영 확인 (RESOLUTION.md 의 "정정" 주장과 diff 가 일치).

## 요약 결론

전전 라운드(`14_27_02`) documentation 리뷰어가 보고한 CRITICAL("`catchError` 가
`switchMap` 뒤에 있어 `ConflictException` 이 삼켜진다")은 이번 라운드 독립 재검증에서도
**재현되지 않는다** — 소스는 `catchError`(107) < `switchMap`(113)이고 캐너리 테스트
("fail-open 이 409 충돌까지 삼키지 않는다")가 실제로 GREEN 이다. `RESOLUTION.md`/`SUMMARY.md`/
`14_50_36/requirement.md` 가 공통으로 지목한 원인(병렬 리뷰 세션의 공유 워크트리 뮤테이션)과
일치하며, 이 세션에서 세 번째로 동일 결론에 도달했다.

기능 자체는 spec(`spec/data-flow/15-external-interaction.md` §외부 의존 "전 경로 fail-open —
가용성 우선")이 요구하는 대로 Redis `get()` 런타임 reject 를 캐시 미스로 강등해, 종전에
생성자 시점 null 체크에만 걸려 있던 fail-open 보장을 조회 실패 경로까지 정확히 확장한다.
`catchError` 위치(`switchMap` 앞)는 멱등성 충돌 검출(409)을 삼키지 않도록 정확히 설계돼
있고 그 사실을 캐너리 테스트로 고정했다. 클래스 docstring 이 주장하는 "세 경로 모두
fail-open"(생성자 null·조회 실패·적재 실패)이 이제 테스트 세 갈래(기존 null passthrough·
신규 `get()` reject·신규 `set()` reject·신규 non-Error reject)로 전부 뒷받침된다. 트레이드
오프(Redis 장애 지속 구간 동안 `Idempotency-Key` 중복 억제 무력화)는 코드로 되돌리지 않고
CHANGELOG·클래스 docstring·plan 백로그(관측 지표 검토)에 정직하게 명시했으며, 이는 spec 이
가용성을 우선한 명시적 결정이므로 타당한 처분이다.

## 발견사항

- **[INFO]** 순수 확인 — 전전 라운드 documentation CRITICAL 오탐이 이번 라운드에서도
  재현되지 않음(위 검토 방법 참고). 코드 결함 아님.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:107,113`

- **[INFO]** spec fidelity 정합 확인 — `catchError` 인라인 주석·클래스 docstring·CHANGELOG
  세 곳의 spec 인용이 `spec/data-flow/15-external-interaction.md:308,333` 원문과 line-level
  로 정확히 일치한다. 괴리 없음.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:51-73`

- **[INFO]** 에러 코드 정합 확인 — `409 Conflict` 시 던지는 `IDEMPOTENCY_KEY_CONFLICT` 가
  `spec/5-system/14-external-interaction-api.md:346` 과 문자열까지 정확히 일치(이 diff 가
  건드리지 않은 자리지만 캐너리 테스트가 이 경로를 통과하므로 회귀 없음을 재확인).
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:124-131`

- **[INFO]** 엣지 케이스 커버리지 확인 — 비-`Error` reject(`String(err)` else 분기), `set()`
  reject(warn 로그까지 단언), 손상된 캐시 JSON(`try/catch` fallback) 모두 테스트로 고정돼
  있고 16/16 직접 실행으로 GREEN 확인.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:355-469`

- **[INFO]** `bodyHashOf` 중복(전 라운드 maintainability WARNING #3) 실제 통합 확인 — 정의
  1건, 참조 6건, 재선언 없음.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:94`

- **[INFO]** R8 캐시 제외 범위(`statusCode >= 400` 이 409·410 까지 떨구는 선재 결함) — 이번
  diff 의 변경 대상 아니며 `plan/in-progress/backend-lint-gate-broken-on-main.md:531-533`
  에 여전히 미해결로 정확히 추적 중. 은폐·확대 없음.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:157-161`

- **[INFO]** concurrency WARNING(fail-open 지속 구간 중복 억제 무력화)에 대한 "코드는 안
  고치고 문서화+백로그"라는 처분이 근거와 함께 정직하게 남아 있다 — 과대·과소 주장 없음
  (plan 체크박스가 의도적으로 `[ ]`).
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:524-530`

CRITICAL/WARNING 급 신규 발견사항 없음.

## 점검 관점별 확인

1. **기능 완전성** — `get()` 런타임 reject → 캐시 미스 강등(fail-open) 구현·문서화·테스트
   3축 모두 완결. 세 fail-open 경로(생성자 null·조회 실패·적재 실패) 전부 테스트로 커버.
2. **엣지 케이스** — 비-`Error` reject, 손상된 캐시 JSON, `status` typeof 가드, `set()` 실패
   모두 커버 확인(직접 jest 실행).
3. **TODO/FIXME** — 신규 코드에 없음(grep 0건). R8 선재 결함은 docstring+캐너리 테스트+plan
   백로그로 근거 있게 추적.
4. **의도-구현 괴리** — 클래스 docstring "세 경로 모두 fail-open" 주장이 실제 코드·테스트
   범위와 정확히 일치.
5. **에러 시나리오** — GET 실패·SET 실패·비-Error reject 모두 fail-open + warn 로그로 정의,
   전부 테스트로 고정, 직접 실행 GREEN.
6. **데이터 유효성** — 해당 없음(입력 검증 로직 변경 없음, `readKey`/`hashBody` 미변경).
7. **비즈니스 로직** — spec 의 가용성 우선 원칙이 정확히 반영. fail-open 중 중복 억제
   무력화 트레이드오프도 CHANGELOG·docstring·plan 백로그에 정직하게 명시.
8. **반환값** — `intercept()` 모든 분기가 `Observable<unknown>` 반환, 누락 없음(변경 없음
   확인).
9. **spec fidelity** — `spec/data-flow/15-external-interaction.md:308,333`, `spec/5-system/
   14-external-interaction-api.md:81,140,346,1053-1055` 전부 직접 대조, line-level 일치.
   spec 본문 자체의 결함 의심 없음. SPEC-DRIFT 없음.

## 요약

이번 라운드는 이미 두 차례(`14_27_02`, `14_50_36`) 독립 검증을 통과한 fix(3커밋: 원 수정 →
WARNING 3건 조치 → 기록 정정+헤더 반영)에 대한 세 번째 독립 재확인이다. 직접 `Read`/`grep`/
`git diff`/`jest`/`eslint` 로 재검증한 결과 코드는 spec(`spec/data-flow/15-external-
interaction.md` "전 경로 fail-open — 가용성 우선")이 요구하는 동작을 정확히 구현하며,
`catchError`/`switchMap` 순서(멱등성 충돌 검출 보존)·엣지 케이스(비-Error reject, `set()`
실패)·spec 인용 정합·plan 체크리스트 상태 모두 일치한다. 전전 라운드의 CRITICAL 오탐(공유
워크트리 뮤테이션 아티팩트)은 이번에도 재현되지 않아 최종적으로 코드 결함이 아님이 재확인됐다.
신규 CRITICAL/WARNING 없음.

## 위험도

NONE
