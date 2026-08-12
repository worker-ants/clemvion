# 테스트(Testing) 리뷰 — `14_27_02` WARNING 3건 + INFO 2건 조치(resolution) 재검증

## 검증 방법 (직접 실행, 무수정 관측 아님)

- `npx jest idempotency.interceptor.spec.ts --silent` → **16/16 통과**(기존 14 + 신규 2,
  RESOLUTION.md 가 주장한 "8522 → 8524, 정확히 신규 2건"과 파일 단위로 정합).
- INFO 4 ("`set()` 실패 경로 warn 로그" 테스트)의 load-bearing 여부를 직접 뮤테이션해 재현:
  `cacheTapped()` 의 `.catch((err) => this.logger.warn(...))` 를 `.catch(() => {})` 로 치환
  → **1 failed / 15 passed**(RESOLUTION.md 의 주장과 정확히 일치). 검증 후 원본으로 복원,
  `git status --porcelain`/`git diff` 로 clean 확인.
- INFO 5 ("비-Error reject" 테스트)도 동일하게 재현: `catchError` 의
  `err instanceof Error ? err.message : String(err)` 의 `else` 분기를
  `(err as Error).message.toUpperCase()` 로 치환 → **1 failed / 15 passed**
  (`TypeError: Cannot read properties of undefined (reading 'toUpperCase')`, RESOLUTION.md
  claim 과 일치). 원본 복원·clean 확인 완료.
- `bodyHashOf` 중복 해소(WARNING #3) 확인: `grep -n "bodyHashOf"` → 정의는 파일 최상단
  1곳(:90)뿐이고 나머지는 전부 호출부. 두 describe 블록이 공유하는 형태로 정상 통합됨.
- `catchError`/`switchMap` 순서(이전 라운드 documentation 리뷰어의 CRITICAL 오탐 대상) 재확인:
  현재 소스에서 `catchError` 는 `switchMap` **앞**(107행 < 113행)에 위치 — SUMMARY.md/
  RESOLUTION.md 의 재검증 결과와 일치, 회귀 없음.

## 발견사항

- **[INFO]** 테스트 파일 헤더 docstring 이 신규 3번째 describe 블록을 여전히 반영하지 않는다 —
  RESOLUTION.md 의 disposition 기록("헤더는 갱신함")과 실제 변경 파일이 어긋난다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1-14`
  - 상세: 이전 라운드(`14_27_02`) SUMMARY.md INFO #6 은 "테스트 파일 헤더 docstring 이 신규
    3번째 describe 블록을 나열하지 않음"(`idempotency.interceptor.spec.ts:1-14`)을 지적했고,
    제안은 "헤더에 3번째 describe 한 줄 추가(선택)"였다. `RESOLUTION.md` 는 이를
    "헤더는 갱신함. `warnCacheFailure` 추출은 2곳뿐이라 보류"로 처리 완료 표기했다.
    그런데 `git diff 5d79dc123 f933f2cf6 -- .../idempotency.interceptor.ts` 로 직접 대조한
    결과, 이 resolution 커밋이 실제로 갱신한 "헤더"는 `idempotency.interceptor.ts` 의
    **클래스 docstring**(fail-open 대가 문단 추가, `:66-72`)뿐이었다. `idempotency.interceptor.spec.ts`
    파일 최상단 헤더(1~14행, "아래 두 번째 describe 는 …")는 이번 resolution 커밋에서
    `git diff 5d79dc123 f933f2cf6 -- .../idempotency.interceptor.spec.ts` 상 **손대지
    않았다** — 실제로 지금도 "두 번째 describe" 까지만 설명하고, 세 번째 describe
    (`IdempotencyInterceptor (Redis 런타임 장애 fail-open)`, `set()` 실패·non-Error reject
    테스트 2건이 새로 이 라운드에서 추가된 곳)는 문서화돼 있지 않다.
    기능적 영향은 없지만(테스트는 16/16 통과), 파일을 처음 읽는 사람이 헤더만 보고 "이 파일은
    두 describe 만 담는다"고 오인할 수 있고, disposition 기록이 실제로 손대지 않은 위치를
    "갱신함"으로 표기한 것은 이 INFO 항목이 재조사 없이 영구히 닫힌 것으로 취급될 위험이 있다.
  - 제안: 헤더에 "세 번째 describe 는 Redis 런타임 장애 fail-open(조회 실패 강등·적재 실패
    warn·non-Error reject) 을 담는다" 한 줄 추가. 또는 RESOLUTION 기록의 문구를
    "인터셉터 클래스 docstring만 갱신, 스펙 파일 헤더는 미반영(잔여)"으로 정정해 실제 상태와
    맞춘다.

## 신규 테스트 2건 (INFO 4·INFO 5 조치) 품질 평가

- **`set()` 이 reject 해도 응답 정상 + warn 로그` (spec.ts, `IdempotencyInterceptor (Redis 런타임
  장애 fail-open)` describe 내):** `jest.spyOn(Logger.prototype, 'warn').mockImplementation()` 을
  `try/finally` 로 감싸 `mockRestore()` 를 보장 — spy 유출로 인한 후속 테스트 오염 위험 없음(격리
  양호). 응답 단언만으로는 `.catch(() => {})` 조용한 삼킴을 못 잡는다는 RESOLUTION 의 분석을
  직접 뮤테이션으로 재확인했고(1 failed), warn 메시지 내용(`cache SET 실패` 포함)까지 단언해
  실제로 판별력이 있다.
- **`비-Error 값으로 reject 해도 로그 조립이 죽지 않는다`:** `err instanceof Error ? … :
  String(err)` 의 else 분기가 실제로 실행되는지 검증 — mutation(`.toUpperCase()` 삽입)으로
  재확인(1 failed, `TypeError`). 응답만 단언하고 로그 내용은 단언하지 않지만, 테스트의 목적이
  "로그 조립 중 예외로 파이프라인이 죽지 않는다"이므로 응답이 정상 반환된다는 사실 자체가 그
  분기가 예외 없이 실행됐다는 것의 충분한 증거다 — 설계가 적절하다.

## 회귀·기존 테스트 유효성

- 기존 14건(W-4 4건 + 캐시 히트/응답 형태 방어 7건 + 이전 라운드 fail-open 3건)은 이번 diff로
  로직 변경이 없고 전부 그대로 통과한다. `bodyHashOf` 를 로컬 정의에서 모듈 최상단 공유로 옮긴
  변경은 순수 함수 이동이라 동작에 영향 없음(직접 확인).
- `catchError` 가 `switchMap` 앞에 위치한다는 이전 라운드의 핵심 회귀 방지 캐너리는 이번 diff로
  건드리지 않았고, 현재도 정상 순서를 유지한다(직접 확인, 위 검증 방법 참고).

## Mock 적절성 · 테스트 격리

- `RedisStub` 최소 mock(`get`/`set` 두 메서드)이 이번 신규 2건에도 그대로 재사용되어 실제 사용
  표면과 일치. `warnSpy` 는 전역 `Logger.prototype` 을 패치하지만 `finally` 블록으로 매 테스트
  종료 시 즉시 복원해 다른 테스트로의 누출이 없다 — 격리 양호.

## 요약

resolution 커밋(`f933f2cf6`)이 이전 라운드(`14_27_02`)의 WARNING #3(`bodyHashOf` 중복)과
INFO 4·5(`set()` 실패·non-Error reject 미검증)를 테스트 관점에서 실질적으로 해소했음을 직접
재현(뮤테이션 2건 모두 정확히 1 failed/15 passed로 재현, 16/16 GREEN 확인, `bodyHashOf` 단일
정의 확인)으로 검증했다. 새로 추가된 테스트 2건은 응답만 단언하는 얕은 형태가 아니라 실제
판별력을 갖췄고, mock 격리도 양호하다. 유일한 잔여 갭은 스펙 파일 헤더 docstring 이 신규
3번째 describe 를 여전히 반영하지 않는다는 INFO 수준 항목인데, RESOLUTION.md 의 disposition
기록("헤더는 갱신함")이 실제로는 다른 파일(interceptor.ts 클래스 docstring)의 갱신을 가리키고
있어 이 항목이 잘못 닫힌 것으로 표기됐다는 점을 함께 지적한다. 코드 결함은 없으며 머지를 막을
사안도 아니다.

## 위험도

LOW
