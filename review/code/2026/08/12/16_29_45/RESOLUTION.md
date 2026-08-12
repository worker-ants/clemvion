# RESOLUTION — `16_29_45`

리뷰 결과: **CRITICAL 1 / WARNING 5 / RISK CRITICAL**. reviewer 7명 실행, 강제 7명 전원 결과
확보(`forced_missing: []`, `unfinished: []`).

**CRITICAL 이 맞았다. 내 fix 는 dead code 였고, 내 테스트는 vacuous 했다.**

---

## CRITICAL #1 — 409/410 캐싱이 도달 불가능한 dead code

requirement·testing 두 reviewer 가 독립적으로 같은 것을 짚었다: `409`·`410` 은
`interaction.service.ts` 가 `ConflictException`/`GoneException` 으로 **throw** 하므로 RxJS
**error 채널**로 흐르는데, `cacheTapped()` 는 `tap({ next })` 뿐이라 그 채널을 보지 못한다.
게다가 컨트롤러가 `@HttpCode(202)` 라 성공 경로의 `res.statusCode` 는 202 로 선고정돼
`statusCode === 409` 가 성립할 수 없다.

### 액면가로 받지 않고 무수정 프로브로 확정했다

| 경로 | 결과 |
|---|---|
| 실제 예외(`throwError(() => new ConflictException(...))`) | `threw=true` **`redis.set=0`** |
| 대조군(성공 채널 202) | `redis.set=1` |

**리뷰어가 전적으로 옳다.** 내 조건식은 실행되지 않았고, 문서(CHANGELOG·plan·spec)는
"해소됐다" 고 말하고 있었다.

### 내 테스트가 왜 못 잡았나 — 이게 더 중요하다

성공 채널에 값을 흘리면서 `res.statusCode` 만 409 로 프리셋하는 mock 을 썼다. **실제로는
발생하지 않는 상태**를 검사한 것이다. 거기에 뮤테이션 표(`>= 400`/`=== 400` 각각 2 RED)까지
붙여 놓아 **검증된 것처럼 보였다** — 뮤테이션이 유효하려면 먼저 그 경로가 실제로 도는지가
전제인데, 그 전제를 확인하지 않았다.

> **교훈**: mock 이 "만들 수 있는 상태" 와 시스템이 "실제로 만드는 상태" 는 다르다. 상태코드를
> 손으로 세팅할 수 있다는 사실이 그 자리가 그 값을 갖는 경로가 있다는 뜻은 아니다.

### 조치 — 재설계

| 자리 | 변경 |
|---|---|
| 적재 | `tap({next})` 만 → **`tap({next})` + `catchError`**. 예외에서 `HttpException.getStatus()` 로 판정해 적재 후 **원 예외 재throw** |
| 재현 | 캐시 히트 시 `409`/`410` 이면 **`HttpException` 으로 재throw** — 성공 채널로 돌려주면 409 가 202 로 바뀐다(재현이 아니라 왜곡) |
| 판정 | `isErrorStatusCacheable()` named 함수로 추출 (INFO 12 도 함께 해소) |
| 테스트 | `makeThrowingHandler` 도입, 409·410·5xx·404 를 **전부 error 채널**로 행사 |

**뮤테이션 재실측** (이번엔 실제 경로 위에서):

| 뮤턴트 | RED |
|---|---|
| `catchError` 의 적재 블록 제거 | 409 · 410 |
| `isErrorStatusCacheable` → `>= 400` | 404 |

## WARNING #2·#3·#4 — 문서가 앞서갔다 → 사실에 맞춤

CHANGELOG 는 "재설계가 필요했다" 는 경위를 포함하도록 고쳤고, plan 은 **1차 시도가 실패였다는
사실과 그 원인**을 그대로 적었다(체크박스는 2차 완료 기준 유지). spec `data-flow/15` 의 갭
표기는 이제 진짜로 해소됐으므로 삭제 상태를 유지한다.

> WARNING #4 는 "caveat 삭제가 시기상조" 였는데, **2차 수정으로 전제가 바뀌어** 삭제가
> 맞게 됐다. 되돌리지 않고 유지하는 근거를 여기 남긴다.

## WARNING #5 — 3xx 조용한 축소 → 테스트 + 명시

`>= 400`(=3xx 캐시) → `2xx` 만으로 좁아진 것을 아무도 적지 않았다. `304` 회귀 테스트를
추가하고 코드 주석에 "이 API 는 3xx 를 내지 않는다" 를 명시했다.

## WARNING #6 — 테스트 파일 헤더 docstring stale → 갱신

"§R8 과 어긋난 현재 캐시 제외 범위를 고정하는 캐너리" 를 "**닫힌 목록을 고정하는 회귀
테스트**" 로 바꾸고, `409`·`410` 을 error 채널로 행사한다는 이유를 함께 적었다.

## INFO 처분

| # | 항목 | 처분 |
|---|---|---|
| 7·8 | 캐시 키가 execution/인증으로 미스코프(선재) | **유예** — 이번 PR 범위 밖. 다만 캐시 대상이 에러 응답까지 넓어졌으므로 후속 가치가 올라갔다 |
| 10 | `410` 테스트가 statusCode 미단언 | **조치** — `stored.statusCode` 단언 추가 |
| 11 | `401·404` 제목이 404 만 행사 | **조치** — 제목을 404 단독으로 좁힘 |
| 12 | `isCacheable` 인라인 | **조치** — `isErrorStatusCacheable()` named 함수 |
| 9·13·14·15 | 문서 일관성·셋업 반복·JSDoc 길이 | 조치 불요 |

## 남긴 것 — e2e

리뷰어 권고 2(`Idempotency-Key` e2e)는 **plan 에 등재**했다. 이번 CRITICAL 이 "단위 mock 이
실제 채널을 반영하지 못해" 생긴 것이므로 같은 클래스를 다시 놓치지 않으려면 e2e 가 맞는
층위다. 다만 docker 인프라가 필요하고 이 PR 은 이미 재설계로 커져 별 작업으로 분리한다.

## 검증

- eslint **0 errors / 0 warnings**
- ratchet **199건 / 38파일 baseline 일치**
- backend unit **418 suites / 8529 passed / 1 skipped**
