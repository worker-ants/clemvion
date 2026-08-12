# RESOLUTION — `21_02_30`

리뷰 결과: **CRITICAL 0 / WARNING 3 / RISK LOW**. reviewer 9명 실행(router 가 5명 제외),
강제 7명 전원 결과 확보 (`forced_missing: []`, `unfinished: []`). **WARNING 3건 전부 조치.**

---

## WARNING #1 (maintainability) — 테스트 키 헬퍼 두 개의 인자 순서가 반대 → 조치

`scopedKey(rawKey, executionId, route)` vs e2e 의 `idempotencyCacheKey(executionId, rawKey, route)`.
세 인자가 전부 `string` 이라 뒤집어도 타입이 안 잡는다. 한쪽을 보고 다른 쪽을 쓰면 **조용히
틀린 키를 단언**하게 된다.

**조치**: `scopedKey` 를 e2e 와 같은 `(executionId, rawKey, route)` 로 통일. 호출부 6자리 갱신.
헬퍼 docstring 에 "왜 순서를 맞췄는가" 를 남겼다 — 다음 사람이 편의로 되돌리지 않도록.

## WARNING #2 (testing) — docstring 이 "GET·SET 둘 다 단언" 이라 적고 route 축은 GET 만 봤다 → 조치

**문서한 보장이 실제 단언보다 넓은 상태**였다. execution 축 테스트에는 지켜졌고 route 축에만
빠져 있었다.

**조치**: route 축 테스트에 `redis.set` 키 단언 추가.

**장식이 아닌지 뮤테이션으로 확인했다.** GET 은 스코프 키, **SET 만 전역 키**가 되는 뮤턴트
(`cacheTapped` 인자를 `${PREFIX}${rawKey}` 로 치환, 2자리)를 만들어 돌렸다:

```
● execution 축 — 다른 executionId 는 같은 키를 써도 다른 엔트리를 본다
● route 축 — 같은 execution 이라도 interact 와 cancel 은 분리된다
Tests: 2 failed, 27 passed, 29 total
```

이 뮤턴트는 **GET 키가 여전히 옳다** — 즉 단언 추가 전이라면 route 축 테스트는 **통과했을**
형태다. 리뷰어가 "실제 위험은 낮다(GET/SET 이 같은 지역변수 공유)" 고 판단했지만, 그 공유를
푸는 리팩터가 정확히 이 회귀를 만들고 그때 이 단언이 유일한 방어가 된다.

## WARNING #3 (documentation) — 모듈 docstring 이 신규 4번째 describe 를 색인하지 않음 → 조치

**조치**: 상단 docstring에 4번째 describe 문단 추가(두 축 · GET·SET 양쪽 · ctx 부재 skip).
함께 **이 블록의 한계**도 적었다 — mock 이 만든 `getHandler()` 라 실 파이프라인의 route 이름은
검증 못 하며 그 자리는 e2e `IDEM-5` 다. 색인만 늘리면 다음 사람이 이 블록을 과신한다.

---

## INFO 처분

| # | 항목 | 처분 |
|---|---|---|
| 1 | `getHandler().name` 리플렉션 의존 (5개 reviewer 중복) | **부분 조치** — 리뷰어는 "조치 불필요" 였으나, 성립 근거(`nest build`=순수 tsc, minifier 없음)가 **암묵 전제**로만 있었다. 코드 주석에 전제와 붕괴 조건, 그리고 붕괴 시 `IDEM-5` 가 RED 로 알린다는 점을 명시 |
| 2 | 배포 시 구-포맷 엔트리 고아화 | **반영** — CHANGELOG 에 전환기 창 문단 추가(24h TTL 자연 소멸, 재요청 1회 캐시 미스, 데이터 오염 없음) |
| 3 | 키 포맷이 프로덕션 1 + 테스트 2 자리에 독립 하드코딩 | **유예** — 블랙박스 회귀로서 의도된 재구현이다(구현 상수를 import 하면 포맷 변경이 테스트를 자동 통과시킨다). 리뷰어도 "세 번째 변경 시 재검토" 로 동의 |
| 4 | `intercept()` 길이 증가 (~19줄) | **유예** — early-return 가드라 중첩은 얕다. 축이 하나 더 생기면 `resolveScopedKey()` 분리 |
| 5 | CHANGELOG 제목에 보안 라벨 부재 | **반영** — `(보안)` + "cross-execution 응답 재생 차단" 으로 개제. 인접 항목의 표기 관례와 맞췄다 |
| 6 | `DEFAULT_ROUTE` 가 컨트롤러 메서드명과 컴파일 타임 결속 없음 | **유예** — 리네임 탐지는 `IDEM-5` 가 한다. 단위에서 결속하려면 컨트롤러를 import 해야 해 단위의 격리를 깬다 |
| 7 | ctx 부재 warn 이 매 요청 발생 가능 | **유예** — 두 route 모두 Guard 선행이라 현재 도달 불가. Guard 없는 route 에 재사용할 때의 조건부 위험 |

## 검증

- eslint **0 errors / 0 warnings** — 수정 중 prettier 1건이 실제로 게이트에 걸렸고 손으로 고쳤다
  (`lint` 에서 `--fix` 를 뺀 설계가 의도대로 동작)
- backend unit **418 suites / 8537 passed**
- 뮤테이션: GET/SET 분리 뮤턴트 **사살**(위 WARNING #2)
- 이번 조치는 테스트·주석·CHANGELOG — **프로덕션 동작 무변경**(인터셉터 diff 는 주석 6줄뿐)
