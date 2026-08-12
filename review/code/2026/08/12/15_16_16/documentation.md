# 문서화(Documentation) Review — EIA idempotency fixes (4라운드 누적, `15_16_16`)

## 검증 방법

이 diff 는 `5d79dc123`(원 fix) → `f933f2cf6`(라운드1 review-fix) → `1fb233eca`(라운드2
기록 정정) → `7072a1ac0`(라운드3 GET warn 대칭 보강) 4개 커밋과, 그 사이 3회 리뷰 라운드
(`14_27_02`/`14_50_36`/`15_04_25`)의 산출물을 누적 포함한다. 과거 라운드에서 "documentation
리뷰어가 병렬 세션의 공유 워크트리 뮤테이션으로 CRITICAL 오탐을 냈다"는 전례가 있어
(`review/code/2026/08/12/14_27_02/RESOLUTION.md`), 프롬프트에 실린 diff 텍스트를 그대로
신뢰하지 않고 실제 작업 트리를 직접 `Read`/`grep` 으로 열어 재검증했다.

- `git status --porcelain -- codebase/backend/... CHANGELOG.md plan/in-progress/...` → clean.
  이 세션의 관측 시점에 다른 프로세스의 뮤테이션 흔적 없음.
- `idempotency.interceptor.ts` 전체 열람 → `catchError` **107행** < `switchMap` **113행**.
  코드 자신의 인라인 주석("위치 주의 — `switchMap` 앞이어야 한다")과 실제 배치가 일치한다.
  과거 라운드에서 반복 지적된 "순서 역전" CRITICAL 은 이번 독립 재확인에서도 재현되지 않는다
  — 그 판정(공유 워크트리 뮤테이션 아티팩트)이 여전히 유효하다.
- `idempotency.interceptor.spec.ts` 전체 열람 → 파일 헤더 docstring(11-17행)이 이제 세 번째
  `describe` 블록(Redis 런타임 장애 fail-open)을 명시적으로 나열한다. `get()` reject 테스트
  (355-383행)가 `Logger.prototype.warn` 스파이로 `cache GET 실패` 문자열까지 단언해, `set()`
  reject 테스트(430-463행)와 대칭을 이룬다.
- `spec/data-flow/15-external-interaction.md:308` 직접 열람 → `Redis | 내부 | blacklist ·
  idempotency · seq · BullMQ. 전 경로 fail-open (warn) — 가용성 우선` — 클래스 docstring·
  CHANGELOG·테스트 주석이 인용하는 문구와 line-level 로 정확히 일치.
- `CHANGELOG.md:1-18` 직접 열람 → 신규 섹션이 결함 서사·spec 인용·운영상 유의점(중복 억제
  무력화, `EIA-RL-02` 는 정상 경로 계약)을 저장소 기존 `## Unreleased — <제목>` 톤으로 담고
  있으며 실제 구현과 정합한다.
- `bodyHashOf` 정의 개수(`grep -n "bodyHashOf ="`) → 1건(94행, 모듈 최상단). 중복 해소 확인.
- `plan/in-progress/backend-lint-gate-broken-on-main.md:498,524` → 완료 항목은 `[x]`, 관측/
  중복 억제 백로그는 `[ ]` 로 실제 상태와 정확히 대응.

## 발견사항

- **[INFO]** 세 번째 `describe` 블록의 지역 docstring 이 블록 내 5개 테스트를 전부 나열하지
  않는다 (3라운드 연속 이월된 저우선순위 항목, 재확인만)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:343-353`
    (`describe('IdempotencyInterceptor (Redis 런타임 장애 fail-open)', ...)` 바로 위 블록 docstring)
  - 상세: 이 지역 docstring 은 "왜 이 블록이 필요한가"(생성자 null 체크만 있고 런타임 `get()`
    reject 는 fail-closed 였다는 결함 서사)를 상세히 설명하지만, 블록이 실제로 담는 5개 테스트
    (조회 실패+warn·조회 실패 시 캐시 미스 적재·409 캐너리·적재 실패+warn·비-`Error` reject)를
    항목별로 나열하지는 않는다. 다만 파일 최상단 헤더(15-17행)가 "조회 실패 · 적재 실패 ·
    비-`Error` reject · 409 캐너리"를 이미 요약하고 있고, 각 `it()` 자체에 근거를 설명하는
    인라인 주석이 충실히 달려 있어 실질적 정보 손실은 거의 없다. `15_04_25` 라운드에서 이미
    같은 항목이 INFO 로 지적·검토됐고 "필수 아님" 으로 유예됐으며, 이번 라운드(`7072a1ac0`)의
    유일한 변경은 GET 테스트에 `warn` 단언을 추가한 것뿐이라 이 지역 docstring 자체는 손대지
    않았다 — 재발이 아니라 미해결 상태가 그대로 이월된 것.
  - 제안: 필수 아님. 여유가 되면 지역 docstring 에 "이 블록은 조회 실패(+warn)·409 캐너리·
    적재 실패(+warn)·비-`Error` reject 4가지를 함께 고정한다" 한 줄만 추가하면 완전해진다.

## 확인했지만 문제 없음 (과거 라운드 지적사항의 최종 상태 재검증)

- **CHANGELOG 누락 (`14_27_02` WARNING)** → 해소. 내용이 코드·spec 인용과 정확히 일치.
- **`bodyHashOf` 헬퍼 중복 (`14_27_02` WARNING)** → 해소. 모듈 최상단 단일 정의.
- **테스트 파일 헤더 docstring 이 3번째 describe 미반영 + `RESOLUTION.md` 의 "헤더는 갱신함"
  기록이 거짓이었던 것 (`14_50_36` WARNING/INFO)** → 해소. 헤더가 실제로 갱신됐고, 두 라운드의
  `RESOLUTION.md` 가 그 착오("직전 PR 라운드의 헤더 갱신을 이번 것으로 착각")를 지우지 않고
  정정으로 남겨 후속 세션이 "이미 처리됨"으로 오판할 근거를 없앴다 — `review/**` 는 SoT 가
  아니지만 처분 기록의 정확성이 후속 판단을 오염시키지 않도록 한 처리 방식이 이 저장소의
  plan/review 위생 관례(정정 남기기, 삭제하지 않기)를 그대로 따른다.
- **GET reject 테스트가 `logger.warn` 을 단언하지 않아 SET 경로와 비대칭 (`15_04_25` INFO)**
  → 해소. `7072a1ac0` 가 GET 테스트에도 `warnSpy` 단언을 추가해 대칭을 맞췄고, 커밋 메시지가
  "SET 쪽만 고치고 GET 쪽은 반쪽만 고친 상태였다"는 경위까지 투명하게 남겼다.
- **`catchError`/`switchMap` 순서 역전 (`14_27_02` documentation CRITICAL, 이후 두 라운드
  8개 리뷰어 재확인)** → 이번 라운드에서도 독립적으로 재검증한 결과 코드에 그 결함은 존재하지
  않는다(committed 상태 기준 `catchError` 107행 < `switchMap` 113행). 원인이 병렬 세션의 공유
  워크트리 뮤테이션이었다는 판정이 4라운드째 일관되게 유지된다.
- **`review/code/2026/08/12/{14_27_02,14_50_36,15_04_25}/*` 산출물이 diff 에 통째로 포함**
  → `_prompts/` 하위는 `.gitignore:38`(`review/**/_prompts/`)로 실제 커밋에서 제외돼 있음을
  `git check-ignore`/`git status --ignored` 로 직접 확인. 나머지(`RESOLUTION.md`·`SUMMARY.md`·
  개별 reviewer `.md`·`meta.json`·`_retry_state.json`)는 프로젝트 규약상 커밋 대상인 감사
  기록이라 문서화 관점의 결함이 아니다.

## 문서화 우수 사례 (참고)

- 클래스 docstring(`idempotency.interceptor.ts:51-73`)이 "fail-open 은 세 경로 모두"라고
  주장하는 범위와 실제 구현(생성자 null·`catchError`·`cacheTapped().catch()`)·테스트(16/16,
  5개 신규 케이스)가 4라운드를 거치며 정확히 1:1로 수렴했다 — 과거 이 저장소에서 반복됐던
  "문서한 보장이 구현보다 넓다" 결함 클래스가 이번엔 라운드를 거듭하며 좁혀져 닫혔다.
- `catchError` 바로 위 인라인 주석이 위치 제약("`switchMap` 앞이어야 한다")과 그 근거를
  명시하고, 전용 캐너리 테스트가 그 주장을 뮤테이션 실측(위치를 뒤로 옮기면 4건 RED)으로
  고정한다 — 코드-주석-테스트 삼각 정합의 모범 사례.
- `RESOLUTION.md` 두 건이 자신의 처분 기록 오류("헤더 갱신함"이 거짓이었음)를 지우지 않고
  정정으로 남기며 그 이유까지 명시한 점은 이 저장소가 반복 강조해온 "처분 기록 = 실제 상태"
  원칙을 스스로 위반했을 때 은폐가 아니라 투명한 정정으로 대응한 좋은 선례다.

## 요약

4라운드에 걸쳐 누적된 이 fix 의 문서화 상태를 프롬프트 텍스트가 아니라 작업 트리를 직접 열어
재검증했다. 이전 라운드들이 지적한 CHANGELOG 누락·`bodyHashOf` 중복·테스트 헤더 docstring
미반영(및 그에 대한 거짓 처분 기록)·GET/SET warn 단언 비대칭·(오탐이었던) `catchError` 순서
역전 CRITICAL 은 전부 현재 커밋 상태에서 해소·재확인됐다. 남은 것은 3라운드째 이월된 아주
사소한 INFO 1건(3번째 describe 블록의 지역 docstring 이 파일 헤더만큼 테스트를 낱낱이 나열하지
않음)뿐이며, 이는 실질적 정보 손실이 없고 이전 라운드에서 이미 "필수 아님"으로 저우선순위
판정된 항목의 재확인이다. 클래스 docstring·CHANGELOG·spec 인용·plan 체크리스트·테스트가 서로
정확히 정합해, 문서화 관점에서 이 diff 를 막을 사안은 없다.

## 위험도

NONE
