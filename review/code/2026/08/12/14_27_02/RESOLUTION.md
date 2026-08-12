# RESOLUTION — `14_27_02`

리뷰 결과: **CRITICAL 0 / WARNING 3 / RISK MEDIUM**. reviewer 8명 실행, 강제 7명 전원 결과
확보(`forced_missing: []`, `unfinished: []`). WARNING 3건 전부 조치, INFO 2건 추가 조치.

---

## documentation 의 CRITICAL — 오탐 확정, 원인은 리뷰어의 워크트리 뮤테이션

documentation 리뷰어가 "`catchError` 가 `switchMap` **뒤**에 있어 `ConflictException` 이
삼켜진다" 를 CRITICAL 로 보고했다. summary 가 오탐으로 판정했는데, 그 판정을 그대로 받지
않고 **직접 재검증**했다:

| 확인 | 결과 |
|---|---|
| `git status --porcelain` (tracked) | 변경 없음 |
| `git show HEAD:…/idempotency.interceptor.ts` | `catchError` **100행** < `switchMap` **106행** |

**커밋된 내용 기준으로 순서가 옳다.** 즉 리뷰어가 관측한 상태는 워킹 트리에 존재하지 않았다.

원인은 summary 가 짚은 대로 **병렬 리뷰어가 공유 워크트리를 뮤테이션**한 것이다 —
requirement·testing 리뷰어가 "catchError 위치 캐너리" 를 스스로 검증하려고 파일을 뮤테이션
했다가 되돌렸고, 그 창에 documentation 리뷰어가 파일을 읽었다. 이 저장소가 이미 아는 실패
클래스이며(메모리 `feedback_reviewer_mutates_shared_worktree`), **이번엔 그 오염이 다른
리뷰어의 CRITICAL 오탐을 만들었다**는 점이 새롭다. summary 의 재검증이 그것을 걸러냈다.

> 이번 fix 의 성격상 아이러니한 사고다 — "catchError 를 뒤로 옮기면 409 를 삼킨다" 는 것이
> 내가 캐너리로 고정한 바로 그 위험인데, 리뷰어들이 그 캐너리를 재현하다 서로를 오염시켰다.

---

## WARNING #1 (concurrency) — fail-open 이 중복 억제를 무력화한다 → **문서화**

Redis 장애가 **지속되는 동안** 같은 `Idempotency-Key` 재요청이 전부 캐시 미스로 판정돼
다운스트림이 중복 실행될 수 있다. 정상 시에도 GET→SET 이 원자적이지 않아 좁은 창은 있지만
장애 구간에서는 그 창이 구간 전체로 넓어진다.

**되돌리지 않는다** — spec 이 "가용성 우선" 으로 택한 트레이드오프다. 대신 그 대가를 클래스
docstring 과 CHANGELOG 에 명시했다: **멱등성은 장애 구간에서 보장이 아니라 best-effort** 이고
`EIA-RL-02` 는 정상 경로의 계약이라는 것. 관측 지표(Redis GET 실패율 알람)는 이 PR 범위 밖이라
plan 백로그로 넘긴다.

## WARNING #2 (documentation) — CHANGELOG 누락 → **추가**

리뷰어 근거("유사 규모 fix 45건 이상이 관례")를 실측했다: CHANGELOG 섹션 **71개**, 다만
최근 20 커밋 중 CHANGELOG 동반은 **2건(10%)** 이라 "매 커밋 관례" 는 아니다. 등재된 것들은
**운영자 가시 동작 변경**(Stop 버튼 결함, cross-tenant P0, 워크플로우 복제 결함 등)이고
이번 fix 가 정확히 그 부류다 — 근거 수치는 과장이었지만 **결론은 타당**해서 추가했다.

## WARNING #3 (maintainability) — `bodyHashOf` 중복 → **통합**

describe 블록마다 문자 단위로 복제돼 있던 것을 모듈 최상단으로 올렸다(`makeRedis`·
`makeInterceptor` 와 같은 위치). 2곳 → 1곳.

---

## INFO 조치 — 2건 (그중 하나에서 내 판정이 틀렸다)

### INFO 4 — `set()` 실패 경로 미검증

클래스 docstring 이 "**세 경로 모두** fail-open" 이라 주장하는데 적재 경로만 테스트가 없었다.
내가 이번 PR 에서 쓴 문장이라 **주장한 보장을 스스로 안 받친** 상태였다. 테스트를 추가했다.

> **여기서 한 번 틀렸고, 기록해 둔다.** 처음에 응답만 단언하는 테스트를 쓰고 `.catch()` 제거
> 뮤턴트를 돌렸더니 요약이 안 나오길래 **"생존 뮤턴트"로 판정**했다. 틀렸다 — 파이프로
> 실행해 **exit code 를 못 본 채 "요약 부재"를 통과로 오독**한 것이다. 실제로는 unhandled
> rejection 이 워커를 죽여 `exit 1` 이었다.
>
> 다시 재 보니 두 뮤턴트의 성격이 갈린다:
>
> | 뮤턴트 | 응답만 단언 | warn 까지 단언 |
> |---|---|---|
> | `.catch()` 통째 제거 | exit 1 (**요약 없이 워커 사망** — 진단 어려움) | 동일하게 잡힘 |
> | `.catch(() => {})` 조용히 삼키기 | **안 잡힘** | **1 failed / 15 passed** |
>
> 즉 warn 단언의 값은 "조용히 삼키는 변형" 을 잡는 데 있다. 처음 주석에 "응답만 단언하면
> GREEN(실측)" 이라고 적었던 것은 위 오독의 산물이라 정정했다.

### INFO 5 — 비-`Error` reject 분기 미실행

`err instanceof Error ? … : String(err)` 의 else 가 어느 테스트에서도 안 돌았다. ioredis 가
항상 `Error` 를 던진다는 보장이 없고 여기서 죽으면 fail-open 자체가 무너진다. 테스트 추가 후
뮤테이션(`String(err)` → `(err as Error).message.toUpperCase()`) → **1 RED** 로 판별력 확인.

## 유예 (plan 등재)

| INFO | 사유 |
|---|---|
| 1 (catchError 가 모든 예외 강등) | spec 의도. 관측 지표는 백로그 |
| 2 (GET/SET warn 이중 발생) | 운영 참고, 조치 불요 |
| 3 (`>= 400` R8 초과) | 선재, 이미 백로그 + 409 캐너리 |
| 6 (로그 포맷 중복, 헤더 docstring) | `warnCacheFailure` 추출은 2곳뿐이라 보류. **헤더 docstring 은 이 라운드에 안 고쳤다** — 아래 정정 참조 |
| 7 (GET→SET 비원자) | 선재 구조. `SET NX EX` 검토는 백로그 |
| 9 (캐시 미스 강등 테스트가 bodyHash 만 단언) | `bodyHash` 가 핵심 식별자라 충분하다고 봄 |

## 검증

- eslint **0 errors / 0 warnings**
- ratchet **199건 / 38파일 baseline 일치**
- backend unit **418 suites / 8524 passed / 1 skipped** (8522 → 8524, 정확히 신규 2건)

---

## 정정 (다음 라운드 `14_50_36` documentation WARNING #2)

위 INFO 6 처분에 **"헤더는 갱신함"** 이라고 적었는데 **거짓이었다.** 이 라운드에서 실제로
갱신한 것은 `idempotency.interceptor.ts` 의 **클래스 docstring** 이고, 지적 대상이던
`idempotency.interceptor.spec.ts` 의 **파일 최상단 헤더 docstring**(신규 3번째 describe 미언급)
은 그대로 뒀다. 직전 PR 라운드에서 헤더에 "두 번째 describe" 를 추가했던 일을 이번 것으로
착각해 쓴 기록이다.

다음 라운드에서 헤더에 세 번째 describe(Redis 런타임 장애 fail-open) 한 줄을 실제로 추가했다.

> **왜 이 줄을 지우지 않고 정정으로 남기는가** — `review/**` 는 SoT 가 아니지만 후속 세션이
> 처분 기록을 근거로 "이미 처리됨" 을 판단한다. 거짓 완료 기록은 그 판단을 오염시키고,
> 조용히 고쳐 두면 같은 착오가 반복돼도 흔적이 없다. 이 세션에서만 **"내가 쓴 기록이
> 실제와 다르다"** 가 세 번째다(§R8 오인용 · "캐시 히트 전체" 과장 · 본 건).
