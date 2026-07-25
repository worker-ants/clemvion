# RESOLUTION — 2회차 (CRITICAL 0)

CRITICAL **0** / WARNING 5. 4건 조치, 1건은 범위 밖으로 명시.

## 조치 항목

| # | 판정 | 조치 |
|---|---|---|
| W1 | **위임** (SPEC-DRIFT) | spec §4 의 cascade 예시가 **이번에 고친 그 누수 패턴**이고 *"cleanup 의무는 fetch API 가 보장"* 서술도 틀렸다(성공 시 controller 는 abort 되지 않는다 — 실측·mutation 확인). **코드가 옳고 spec 이 낡은 경우**라 코드를 되돌리지 않고 planner 위임 문서에 §4 갱신을 추가했다. `http-request.handler.ts` 는 지금도 spec 원문 그대로라 **같은 누수가 살아있다**(선재) — 함께 위임 |
| W2 | 수용 | cafe24 주석의 `executeWithRetry` → 실제 메서드명 `executeWithRateLimit` |
| W3 | 수용 | 취소-vs-timeout 경계 테스트가 `toThrow()` 범용 단언이라 오분류 회귀를 놓칠 수 있었다 → `toBeInstanceOf(*TransportFailedError)` |
| W4 | 수용 | **근본 원인(재시도 재귀 누적) 회귀 테스트 신설**. 429 시퀀스로 두 attempt 의 signal 을 모두 캡처해, 완료 후 `upstream.abort()` 가 **어느 쪽도 건드리지 않음**을 단언. 예고된 "공용 헬퍼 추출" 리팩터가 setup 을 재귀 밖으로 올리면 이게 잡는다 |
| W5 | **범위 밖 명시** | 429 backoff sleep · 401 refresh 대기는 signal 을 보지 않아 취소 반영이 그만큼 지연된다. **유실은 아니다** — 대기 후 다음 attempt 의 §4 사전 체크가 즉시 건다. 둘 다 fetch 가 아니라 주입된 sleep·큐 대기라 각각 별도 검증 표면을 열고, signal-aware 화는 sleep 주입 계약·큐 취소 의미까지 함께 판단해야 한다. plan 에 근거와 함께 기재 |

INFO 반영: cafe24 fixture path `product` → `products` 통일(makeshop 복붙 흔적).

## 비-vacuity 검증

| 뮤턴트 | 결과 |
|---|---|
| `finally` 의 `removeEventListener` 제거 | **4 failed** (단일 호출 2 + 재시도 2) |

W4 를 넣기 전에는 같은 뮤턴트가 **2 failed** 였다 — 재시도 축이 비어 있었다는 뜻이고, 그게
리뷰어 지적의 요지였다.

## TEST 결과

- lint: **PASS**
- unit: **PASS** (14) / client 스위트 **91 passed**
- build: **PASS**
- e2e: **통과** (259 passed)

## 보류·후속 항목

- W1 §4 예시 갱신 + `http-request.handler.ts` 선재 누수 → planner 위임 문서.
- W5 대기 구간 signal 관측 → plan §W5.
- abort-cascade 3중 복제 → 공용 헬퍼(위 두 건과 함께 처리해야 의미 있음).
