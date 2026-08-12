# RESOLUTION — `18_37_45`

리뷰 결과: **CRITICAL 0 / WARNING 4 / RISK MEDIUM**. reviewer 9명 실행, 강제 7명 전원 결과
확보(`forced_missing: []`, `unfinished: []`). **3건 조치 · 1건 유예(선재·기등재).**

---

## WARNING #1 (testing) — 형제 테스트의 패턴을 신규 2건만 안 따랐다 → 조치

`storeEntry` catch 의 `logger.warn` 을 지워도 **25/25 GREEN** 이었다(리뷰어 뮤테이션 실측).
같은 파일의 다른 fail-open 테스트(GET/SET 실패)는 전부 `jest.spyOn(Logger.prototype,'warn')`
로 로그-제거 회귀를 잡는데, 직전 라운드가 추가한 직렬화-실패 2건만 그 관행을 빠뜨렸다.

**조치**: 두 테스트 모두 warn 단언 추가(`cache 직렬화 실패`). 모듈 docstring 에도 "이 블록은
전부 warn 을 함께 단언한다 — fail-open 은 요청을 살리는 것과 장애를 보이게 하는 것이 한 쌍"
이라는 이유를 적어 다음에 추가되는 테스트가 같은 자리를 빠뜨리지 않게 했다.

## WARNING #2 (testing) — **내가 "기록하겠다" 고 처분해 놓고 안 적었다** → 조치

직전 RESOLUTION(`18_07_36`) INFO 1 처분란에 "`responseJson` 손상 무방비 → **plan 백로그에
기록**" 이라 써 놓고, 같은 커밋의 plan diff 에 그 항목이 **없었다.** 리뷰어가 그 불이행을
잡았다.

**이 세션에서 거짓 처분 기록이 두 번째다** ("헤더는 갱신함" → 이번). 둘 다 **"하겠다" 를 쓰고
그 턴에 실제로 하지 않은** 형태다. 처분표에 적는 순간 그 자리에서 하지 않으면, 다음 라운드가
잡지 않는 한 그대로 사라진다.

**조치**: `backend-lint-gate-broken-on-main.md` 에 항목을 실제로 추가했다 — 엔트리 **바깥**
JSON 은 `try/catch` 로 막으면서 **안쪽** `responseJson` 이 깨지면 그대로 throw(→ 500 마스킹)
된다는 사실과, `JSON.parse` 중복(4라운드 연속 유예된 maintainability 항목)을 한 번에 닫는
편이 낫다는 방향까지 적었다.

## WARNING #3 (documentation) — 테스트 모듈 docstring stale → 조치

세 번째 describe 요약이 직전 라운드에 추가된 직렬화-실패 테스트 2건을 반영하지 않았다.
WARNING #1 조치와 함께 갱신했다.

## WARNING #4 (security) — 캐시 키 미스코프 → **유예 (선재·기등재)**

`redisKey` 가 execution/인증으로 스코프되지 않아 이론상 cross-execution 재현이 가능하고,
이번 diff 가 캐시 대상을 409/410 까지 넓히며 표면이 커졌다. 리뷰어도 "직전 라운드에서 이미
발견·유예된 선재 갭이며 **신규 회귀 아님**" 으로 판정했다. plan 백로그 유지, 우선순위 상향은
`18_07_36` RESOLUTION 에 기록됨.

## INFO 처분

| # | 항목 | 처분 |
|---|---|---|
| 6 | `data-flow/15` mermaid 가 캐시 적재 주체를 `Svc` 로 표기(실제는 인터셉터) | **유예** — 선재 서술, 이번 diff 범위 밖. planner 항목 |
| 13 | `set()` fire-and-forget | 유예 확정(선행 라운드) |
| 14·15·16 | `JSON.parse` 중복 · 리터럴 인라인 · e2e 셋업 반복 | **유예 유지** (5라운드 연속) |
| 1~5·7~12·17~19 | 확인·정합성 기록 | 조치 불요 |

## 검증

- eslint **0 errors / 0 warnings**
- backend unit **418 suites / 8533 passed / 1 skipped** (테스트 수 불변 — 기존 2건에 단언
  추가라 신규 케이스 없음)
