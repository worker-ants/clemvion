# RESOLUTION — `18_00_11`

CRITICAL 0 / WARNING 1. **WARNING 조치 완료**, INFO 는 1건(#11 docstring) 추가 처리.

## WARNING 1 — 가드 4곳의 boilerplate 중복 (maintainability)

**조치: helper 추출 + 리뷰어가 든 근거를 실제로 막는 구조적 테스트 추가.**

리뷰어가 든 근거는 *"향후 5번째 `.query()` 지점 추가 시 가드 누락 위험"* 이다.
그런데 **helper 추출은 그 위험을 막지 못한다** — 호출을 잊는 것은 그대로 가능하다.
그래서 둘 다 했다:

1. `common/utils/assert-row-array.ts` — `assertRowArray(rows, detail): asserts rows is unknown[]`.
   **메시지는 호출부가 준다.** 왜 이 자리가 위험한지는 지점마다 다르고(롤백이 걸리는지,
   종결 이벤트가 유실되는지, 어떤 제한이 우회되는지) 그 설명이 진짜 값어치라, 헬퍼가
   일반 문구로 뭉개면 다음 사람이 차이를 못 본다.
2. `assert-row-array.spec.ts` §"자매 지점 전수 — 가드 누락 회귀 가드" — 두 서비스에서
   **반환값을 쓰는 `.query()` 호출 수 == `assertRowArray` 호출 수**를 assert 한다.
   (`17_15_21` testing INFO 8 이 제안한 것. INFO 였지만 WARNING 1 의 근거를 실제로
   해소하는 건 이쪽이다.)

## INFO #11 — docstring 확대

`computeChainDepth` · `lockNonTerminalExecutionRow` · `updateExecutionStatus` 는 헬퍼
호출부 바로 위 인라인 주석이 throw 사유를 지점별로 적고 있어, `admitExecutionOrDefer`
처럼 top-level docstring 까지 중복 서술하지 않았다. `assertRowArray` 의 docstring 이
공통 계약("배열이 아니면 throw")을 소유하고, 지점별 차이는 호출부 주석이 소유한다 —
같은 사실을 두 층에 적으면 이 PR 이 없애러 온 그 구조가 다시 생긴다.

## 검증 — 두 방향 다 뮤테이션

**구조적 가드가 목적을 달성하는지** (이게 핵심 — 기존 가드 삭제만 죽이면 목적 검증이 아니다):

| 뮤턴트 | 결과 |
|---|---|
| baseline | 8 passed |
| **M-A** 기존 가드 1개 삭제 (누락 재현) | **1 failed** → 사살 |
| **M-B** 가드 없는 **새 소비형 `.query()` 추가** (5번째 지점 신설 재현) | **1 failed** → 사살 |

**helper 추출 후 가드 4개가 여전히 각각 사살되는지** (리팩터가 형태를 바꿨으니 앞 라운드
결과를 재사용할 수 없다):

| 뮤턴트 | 결과 |
|---|---|
| baseline | engine 444 / rerun 17 passed |
| M1 admission 가드 제거 | **1 failed** → 사살 |
| M2 `lockNonTerminalExecutionRow` 가드 제거 | **1 failed** → 사살 |
| M3 `updateExecutionStatus` 가드 제거 | **1 failed** → 사살 |
| M4 `computeChainDepth` 가드 제거 | **1 failed** → 사살 |

6/6 사살. 원복 후 바이트 동일 확인.

그 외: `pnpm --filter backend lint --max-warnings 0` 통과(prettier 지적 1건 `--fix`
반영 후 재검증), `tsc --noEmit` **199** (baseline 동일), 관련 4 스위트 **497 passed**.

> 자잘한 정정: 구조적 테스트에서 처음 `assertRowArray(` 매치 수에 `- 1`(import 행 제외)을
> 뒀다가 실측하고 지웠다 — import 는 `assertRowArray }` 라 여는 괄호 패턴에 안 걸린다.
> 세어 보기 전에 뺀 것이었다.

## INFO 처분

| # | 처분 |
|---|---|
| 11 | **조치** — 위 참조(중복 서술 대신 소유 분리) |
| 1, 2, 6, 9, 14 | 리뷰어가 "조치 불요" 로 결론 — 동의 |
| 5 | 조치 불요. `TypeError` → `Error` 전환은 의도. 운영 알림 규칙이 있다면 문구 갱신은 별건 |
| 3, 4, 10, 13 | **직전 라운드들이 이미 의식적으로 유예**한 항목의 재확인. 뒤집을 새 근거 없음 |
| 7 | `executeSync` timeout catch 흡수 — 이번 diff 가 만든 회귀가 아니고, 그 catch 는 timeout 마감 자체를 실패시키지 않으려는 의도다. 후속 관찰 대상으로만 둔다 |
| 8 | **조치** — WARNING 1 과 함께 처리(위) |
| 12 | 지적이 맞다. 이번 RESOLUTION 은 4곳을 동질로 묶지 않고 `computeChainDepth` 를 fail-open 으로 따로 판정해 적었다 |
