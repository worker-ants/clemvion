# RESOLUTION — `23_48_38`

리뷰 결과: **CRITICAL 0 / WARNING 3 / RISK MEDIUM**. reviewer 8명 실행(router 가 6명 제외),
강제 7명 전원 결과 확보 (`forced_missing: []`, `unfinished: []`). **WARNING 3건 + INFO 1건 조치.**

---

## WARNING #1 (testing) — 이 PR 이 없애려던 실패 형태가 좁은 틈으로 살아 있었다 → 조치

`JSON.parse` 는 **문법 오류에만** 던진다. `'null'`·`'42'`·`'[]'` 는 전부 유효한 JSON 이라
`try/catch` 를 통과한 뒤 `cached.bodyHash` 에서 깨진다.

**리뷰어 주장을 그대로 받지 않고 무수정 프로브로 실측했다** (`it.each` 4값):

```
PROBE[null]  = THREW TypeError: Cannot read properties of null (reading 'bodyHash')
PROBE[42]    = THREW ConflictException
PROBE[[]]    = THREW ConflictException
PROBE["str"] = THREW ConflictException
```

리뷰어의 값별 분석까지 정확했다 — `'null'` 만 `TypeError`(→ `GlobalExceptionFilter` 가 **500**
마스킹)이고 나머지는 오토박싱으로 `undefined` 비교가 되어 409 로 fail-safe 한다.

**즉 "캐시 손상이 요청 실패가 되지 않게 한다" 는 이 PR 의 주장이 실제보다 넓었다.**
`isIdempotencyEntry()` 타입 가드를 추가해 문법이 아니라 **형태**를 검사한다.

### 가드의 모든 절이 하중을 받는지 — 뮤테이션으로 두 번 갈았다

**1차**: `Array.isArray` 절만 제거해도 죽는 테스트가 0건이었다. JSON 배열은 문자열 키를 가질 수
없어 필드 검사가 이미 배제하기 때문 — **관측 가능한 동작이 없는 절**이었다. 걷어냈다.

**2차**: 그러자 `typeof !== 'object'` 도 같은 이유로 생존했고, **세 필드 검사도 각각 생존**했다.
원인은 가드가 아니라 **내 fixture** 였다 — 전부 여러 조건을 동시에 위반해서, 하나를 지워도
나머지가 대신 잡았다. 조건을 **하나씩만** 위반하는 fixture 3건을 추가했다.

최종 상태 — 남은 절 전부가 각각 정확히 1건씩 죽인다:

| 뮤턴트 | 결과 |
|---|---|
| `null` 절 제거 | RED (1건) |
| `bodyHash` 검사 제거 | RED (1건) |
| `responseJson` 검사 제거 | RED (1건) |
| `statusCode` 검사 제거 | RED (1건) |

> **교훈**: 방어를 늘리는 것과 방어가 검증되는 것은 별개다. `typeof`·`Array.isArray` 는 방어처럼
> 보이지만 실행되지 않는 절이었고, 그런 조건은 다음 사람에게 "여기는 검사된다" 는 **거짓 신호**를
> 준다. 그리고 매트릭스가 채워져 보여도 **각 항은 별도 표면**이다 — fixture 가 여러 조건을
> 한꺼번에 위반하면 아무 항도 고정되지 않는다.

## WARNING #2 (documentation) — 같은 diff 안에서 CHANGELOG 와 docstring 이 서로 모순 → 조치

CHANGELOG 는 "다섯 경로(생성자 `null` 포함)가 **모두** warn 을 남긴다" 고 적고, 같은 diff 가
신설한 docstring 표는 "경로 1 은 warn 대상 아님" 이라고 적는다. **둘 다 내가 썼다** — 앞 커밋에서
CHANGELOG 를 쓰고, 다음 커밋에서 docstring 을 정정하면서 CHANGELOG 가 거짓이 됐다.

**조치**: "다섯 경로 중 **넷**이 warn 을 남기고, 기동 시 미주입은 장애가 아니라 설정 상태라
warn 대상이 아니다" 로 정정.

## WARNING #3 (testing/side_effect) — `warnSpy` 가 `try/finally` 밖에 있었다 → 조치

같은 diff 가 바로 옆에 추가한 신규 테스트 3건은 이미 그 패턴인데 이 자리만 빠졌다. 단언이
실패하면 `mockRestore()` 가 안 돌아 mock 이 뒤 테스트로 샌다(`jest.config.ts` 에 `restoreMocks`
안전망 없음 — 확인함).

## INFO #10 — "수용" 이라 써 놓고 제목을 안 고쳤다 → 조치

직전 RESOLUTION 이 scope 리뷰어의 "plan 표제가 실제보다 좁다" 를 **수용**으로 처분해 놓고
제목은 그대로 뒀다. 이 세션에서 반복된 **"하겠다고 쓰고 안 함"** 형태다. 제목을
"캐시 엔트리 **손상 처리 전체**가 불완전하다" 로 넓히고 원제를 병기했다.

---

## 나머지 INFO 처분

| # | 항목 | 처분 |
|---|---|---|
| 1·2 | 로그 인젝션 / 런타임 스키마 미검증 | **부분 해소** — 이번 타입 가드가 엔트리 쪽 스키마 검증을 실제로 도입했다. 로그 인젝션은 유예(서비스 자신이 쓴 값) |
| 6·7·8 | 제네릭 단형성 · `formatErr` 중복 · 판별 파라미터가 로그 문구 겸용 | **유예 유지**(3라운드 연속). 조건부 트리거를 각각 명시해 뒀다 |
| 13 | 손상 지속 시 warn 볼륨 증가 | **수용** — 관측성 개선의 의도된 대가. 알림 임계값 운용 시 참고 |
| 3·4·5·9·11·12·14·15 | 확인·개선 기록 | 조치 불요 |

## 검증

- eslint **0/0**(수정 중 prettier 3건이 게이트에 걸려 손으로 고쳤다)
- ratchet **199건 / 38파일**(불변) · backend unit **418 suites / 8549 passed**
- 인터셉터 단위 **41/41**(신규 8건 — 형태 fixture 5 + 격리 fixture 3)
