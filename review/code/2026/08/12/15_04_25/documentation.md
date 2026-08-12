# 문서화(Documentation) Review — EIA idempotency fixes (3라운드, `15_04_25`)

## 검증 방법

이 diff 는 이전 두 리뷰 라운드(`14_27_02`, `14_50_36`)의 산출물 24개 파일을 포함해 통째로
누적된 변경분이다. 직전 라운드에서 "documentation 리뷰어가 CRITICAL(오탐)을 낸 것이 공유
worktree 뮤테이션 때문" 이었다는 전례가 있어(`review/code/2026/08/12/14_27_02/RESOLUTION.md`),
프롬프트에 실린 diff/텍스트를 그대로 신뢰하지 않고 실제 작업 트리를 직접 열어 재검증했다:

- `git log --oneline -3 -- .../idempotency.interceptor.spec.ts` → `1fb233eca`(헤더 정정) →
  `f933f2cf6`(WARNING 3건 조치) → `5d79dc123`(원본 fix), `git status --porcelain` → 이 세션
  디렉터리 외 변경 없음(clean).
- `grep -n "catchError\|switchMap" idempotency.interceptor.ts` → `catchError` **107행** <
  `switchMap` **113행** — 코드 자신의 주석("위치 주의 — switchMap 앞이어야 한다")과 일치.
  직전 두 라운드에서 반복 지적된 "순서 역전" CRITICAL 은 이번에도 재현되지 않는다(worktree
  뮤테이션 아티팩트였다는 기존 판정과 일치).
- `Read` 로 `idempotency.interceptor.spec.ts:1-18` 직접 확인 → 파일 헤더 docstring 이 이제
  세 번째 describe(Redis 런타임 장애 fail-open: 조회 실패·적재 실패·비-Error reject·409
  캐너리)를 명시한다. `14_50_36` 라운드에서 "RESOLUTION 이 '헤더 갱신함'이라 적었지만 실제로는
  안 고쳤다"고 잡았던 WARNING이 이번엔 실제로 반영돼 있다.
- `Read` 로 `CHANGELOG.md:1-18` 확인 → `## Unreleased — Redis 런타임 장애가 External
  Interaction API 를 500 으로 무너뜨리던 결함 수정` 섹션이 spec 인용·운영상 유의점(중복 억제
  무력화, `EIA-RL-02` 는 정상 경로 계약)까지 포함해 정확히 존재한다.
- `grep -n "bodyHashOf ="` → 정의 1곳(spec.ts:94, 모듈 최상단)뿐 — 중복 제거 확인.
- `npx jest idempotency.interceptor.spec.ts --silent` → **16/16 통과**.
- `plan/in-progress/backend-lint-gate-broken-on-main.md:498,524` 직접 열람 → 완료 항목은
  `[x]`, 관측/중복 억제 백로그는 `[ ]` 로 실제 상태와 정확히 일치.

## 발견사항

- **[INFO]** 세 번째 `describe` 블록의 지역 docstring이 블록 내 5개 테스트 중 일부만 서술한다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:343-352`
    (`describe('IdempotencyInterceptor (Redis 런타임 장애 fail-open)', ...)` 바로 위 블록 docstring)
  - 상세: 이 지역 docstring은 "왜 이 블록이 필요한가"(생성자 null 체크만 있고 런타임 `get()`
    reject 는 fail-closed 였다는 결함 서사)는 상세히 설명하지만, 블록이 실제로 담는 5개
    테스트(통과·캐시 미스 강등·409 캐너리·`set()` 실패·비-Error reject) 전부를 나열하지는
    않는다. 다만 파일 최상단 헤더(`:15-17`)가 "조회 실패 · 적재 실패 · 비-Error reject ·
    409 캐너리"를 이미 정확히 요약하고 있고, 각 `it()` 자체에도 근거를 설명하는 인라인 주석이
    충실히 달려 있어 실질적인 정보 손실은 거의 없다. 코드 결함이 아니고 이전 두 라운드에서도
    이미 이 수준의 완전성 문제가 INFO 로 다뤄져 왔다.
  - 제안: 필수 아님. 여유가 되면 지역 docstring에 "이 블록은 조회 실패 강등·409 캐너리·적재
    실패·비-Error reject 4가지를 함께 고정한다" 한 줄만 추가하면 완전해진다.

## 이전 라운드 대비 확인된 정정 사항 (재발 없음)

- **CHANGELOG 누락 (`14_27_02` documentation WARNING)** → 해소 확인. 내용이 코드·spec 인용과
  정확히 일치.
- **`bodyHashOf` 헬퍼 중복 (`14_27_02` maintainability WARNING)** → 해소 확인. 모듈 최상단
  단일 정의.
- **테스트 파일 헤더 docstring이 3번째 describe 미반영 + `RESOLUTION.md`의 "헤더는 갱신함"
  기록이 거짓이었던 것 (`14_50_36` documentation/testing/maintainability WARNING·INFO)** →
  해소 확인. 헤더가 실제로 갱신됐고, `14_27_02/RESOLUTION.md`/`14_50_36/RESOLUTION.md` 양쪽에
  경위(무엇을 착각해서 거짓 기록을 남겼는지)가 투명하게 남아 있다 — 후속 세션이 "이미
  처리됨"으로 오판할 근거가 사라졌다.
- **`catchError`/`switchMap` 순서 역전 (`14_27_02` documentation CRITICAL, `14_50_36`
  8개 리뷰어 재확인)** → 이번 라운드에서도 독립적으로 재검증한 결과 코드에 그 결함은
  존재하지 않는다(현재 committed 상태 기준 `catchError` 107행 < `switchMap` 113행).

## 문서화 우수 사례 (참고)

- 클래스 docstring(`idempotency.interceptor.ts:51-73`)이 "fail-open 은 세 경로 모두"라고
  주장하는 범위와 실제 구현(생성자 null·`catchError`·`cacheTapped().catch()`)·테스트
  (16/16, 5개 신규 케이스)가 정확히 1:1로 대응한다.
- `RESOLUTION.md` 두 건이 스스로의 처분 기록 오류("헤더 갱신함"이 거짓이었음)를 지우지 않고
  정정으로 남기며 그 이유("`review/**`는 SoT 아니지만 후속 세션이 처분 기록으로 판단하므로
  거짓 완료 기록은 그 판단을 오염시킨다")까지 명시한 점은 이 프로젝트의 plan/review 위생
  관례를 모범적으로 따른다.

## 요약

3라운드에 걸친 이 fix 의 문서화 상태를 프롬프트 텍스트가 아니라 작업 트리를 직접 열어
재검증했다. 이전 두 라운드가 지적한 CHANGELOG 누락·`bodyHashOf` 중복·테스트 헤더 docstring
미반영·(오탐이었던) `catchError` 순서 역전 CRITICAL 은 전부 현재 커밋 상태에서 해소·재확인됐고,
남은 것은 아주 사소한 INFO 1건(블록 지역 docstring이 파일 헤더만큼 상세하지 않음)뿐이다.
클래스 docstring·CHANGELOG·plan 체크리스트·테스트가 서로 정확히 정합해, 문서화 관점에서 이
diff 를 막을 사안은 없다.

## 위험도

NONE
