# RESOLUTION — `18_07_36`

리뷰 결과: **CRITICAL 0 / WARNING 4 / RISK MEDIUM**. reviewer 7명 실행, 강제 7명 전원 결과
확보(`forced_missing: []`, `unfinished: []`). **WARNING 3건 조치 · 1건 유예(선재·기등재).**

---

## WARNING #1 (testing) — 방어를 만들고 테스트를 안 붙였다 → 조치

직전 라운드에서 `storeEntry` 의 `JSON.stringify` 를 `try/catch` 로 감쌌는데(원 409/410 예외가
500 으로 대체되는 것을 막는 방어) **그 분기를 행사하는 테스트를 안 붙였다.** docstring 이
"안 지키면 무슨 일이 나는지" 까지 적어 두고 검증은 비운 셈이다.

**조치**: 순환 참조 payload 로 두 채널 모두 고정 — error 채널(원 예외 그대로 전파 +
`redis.set` 미호출), 성공 채널(정상 응답이 사라지지 않음). 후자는 리뷰어가 "2xx 도 동일 갭"
이라 짚어 준 **자매 자리**다.

**뮤테이션 실측**: `try/catch` 제거 → **2 RED**(두 채널 각 1건).

## WARNING #2 (testing) — 410 이 e2e 밖에 남았다 → 조치

`IDEM-1` 이 409 만 덮어, **같은 `isErrorStatusCacheable` 분기를 공유하는 410 이 실 파이프라인
검증 밖**에 있었다. e2e 를 들여온 이유(단위 mock 이 실제 경로를 못 반영)가 410 자리에는
적용되지 않은 것이다.

**조치**: `IDEM-3` 추가 — terminal execution 에 `cancel` → 410 `EXECUTION_TERMINATED` 가
Redis 에 적재되고 재요청 시 재현되는지. e2e **266 → 267 passed**.

> **자매 자리 누락이 이 세션에서 네 번째다** (409/410 성공채널 mock → 400 만 옛 mock →
> 5xx 가드 우회·410 replay → 410 e2e). 매번 "이번엔 다 닫았다" 고 쓴 뒤 다음 라운드가
> 형제를 하나 더 찾았다. plan 에 "한 케이스를 고쳤으면 그 순간 형제를 전수로 세라" 를
> 적어 뒀지만, 그것을 **e2e 층위에도 적용해야** 한다는 것이 이번 발견이다.

## WARNING #3 (maintainability) — 테스트 ID 충돌 → 조치

신규 e2e `I-2` 가 같은 파일 617행의 기존 `I-2`(`getStatus wire`)와 **중복**이었다. 실측 확인
(`grep "it('I-"` → `I-2` 2건). `IDEM-1`/`IDEM-2`/`IDEM-3` 로 바꿔 파일 내 `A~J` 순차 관행과도
충돌하지 않게 했고, plan 인용도 함께 갱신했다.

## WARNING #4 (security) — 캐시 키 미스코프 → **유예 (기등재)**

`redisKey` 가 `executionId`/인증 컨텍스트로 스코프되지 않는 **선재 설계**다. 이번 diff 로
409/410 캐싱이 dead code 에서 실제 도달 가능 경로가 되며 **노출 표면이 실질적으로 넓어졌다** —
서로 다른 execution 이 같은 `Idempotency-Key` + 같은 body 를 쓰면 캐시된 409(내부 상태 enum
포함)가 교차 재생될 수 있다.

이번 PR 은 §R8 **캐시 대상 정합화**이지 키 스코핑 재설계가 아니라 유예하되, plan 백로그의
우선순위가 이번 변경으로 올라갔음을 명시한다. 리뷰어도 "이번 PR 스코프 밖 · 신규 항목 불요"
로 판정했다.

## INFO 처분

| # | 항목 | 처분 |
|---|---|---|
| 1 | 캐시 엔트리 내부 `responseJson` 손상 무방비(선재) | **유예** — plan 백로그에 기록 |
| 2 | `set()` fire-and-forget 과 e2e 즉시 조회의 이론적 레이스 | 조치 불요 — 실 flaky 미관측. CI 간헐 실패 시 폴링 |
| 7·8·20 | docstring 문구 · CHANGELOG 미언급 · plan 잔재 | 조치 불요(경미) |
| 16·17·18 | `JSON.parse` 중복 · `intercept()` 길이 · e2e 셋업 반복 | **유예 유지** (4라운드 연속 선택 사항) |
| 3·4·5·6·9~15·19·21 | 확인·정합성 기록 | 조치 불요 |

## 검증

- eslint **0 errors / 0 warnings**
- ratchet **199건 / 38파일 baseline 일치**
- backend unit **418 suites / 8533 passed / 1 skipped** (8531 → 8533, 신규 2건)
- **e2e 47 suites / 267 passed** (266 → 267, `IDEM-3` 신규)
