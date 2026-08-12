# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `cachedJson` 이 문법적으로는 유효한 JSON 이지만 객체가 아닌 값(특히 `null`)일 때 — `discardCorruptEntry` 의 방어를 우회해 **처리되지 않은 `TypeError` 로 크래시**한다. 이 diff 가 명시적으로 없애려는 바로 그 실패 형태(캐시 손상 → 500)가, 이 diff 의 새 테스트 스위트가 커버하지 못하는 좁은 틈으로 여전히 살아 있다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:157-167` (엔트리 파싱 `try/catch` 직후, `if (cached.bodyHash !== bodyHash)`)
  - 상세: `try { cached = JSON.parse(cachedJson) } catch (err) { return this.discardCorruptEntry('엔트리', err, processFresh); }` 는 **JSON 문법 오류만** 잡는다. `cachedJson` 이 정확히 4바이트 문자열 `"null"` 이면 `JSON.parse` 는 예외 없이 성공하고(`cached === null`), catch 블록으로 가지 않는다. 바로 다음 줄 `cached.bodyHash !== bodyHash` 가 `null` 의 프로퍼티를 읽으려다 `TypeError: Cannot read properties of null (reading 'bodyHash')` 를 던진다 — 이 예외는 `try/catch` 밖이라 그대로 위로 전파돼 `GlobalExceptionFilter` 가 500 으로 마스킹한다. 즉 이번 diff 가 payload(`responseJson`) 쪽에서 고친 것과 **동형의 결함**이 엔트리 쪽 "구조" 단계에 여전히 남아 있다.
    실측(로컬 probe, 세션 종료 시 삭제됨 — `redis.get` 을 `'null'` 로 mock 하고 `intercept()` 를 호출):
    ```
    CAUGHT TYPE: TypeError MSG: Cannot read properties of null (reading 'bodyHash')
    ```
    다른 비-객체 값(배열 `"[]"`, 원시값 `"42"`, `'"str"'`)은 JS 오토박싱 덕에 `cached.bodyHash` 가 `undefined` 로 평가돼 크래시하지 않고 (의미상 부정확하지만) 409 로 fail-safe 하게 빠진다 — **`null` 만 유일하게 실제로 죽는다.**
    이 특정 sub-case 는 사전 라운드(`23_36_13` security INFO #2)가 "`JSON.parse` 캐스팅에 런타임 스키마 검증 없음... `bodyHash` undefined 시 fail-safe(409) 방향이라 위험 낮음" 이라고 판정한 근거를 무효화한다 — `null` 에 한해서는 fail-safe 가 아니라 **크래시**다.
  - 제안: (a) 코드: `discardCorruptEntry` 진입 조건에 `cached === null || typeof cached !== 'object'` 가드를 추가해 `엔트리` 손상으로 처리하거나, (b) 최소한 테스트: `redis.get.mockResolvedValue('null')` 케이스를 추가해 이 경로가 현재 무엇을 하는지(크래시) 고정하고 이번 PR 이 "엔트리 손상 방어" 라고 주장하는 범위에 이 sub-case 가 빠져 있음을 명시. 어느 쪽이든 최소 plan 백로그에 등재해 "선재 갭" 으로 추적할 것 — 이 클래스가 방금 "손상 시 fail-open" 을 다섯 경로 표로 계약화했는데, 이 자리는 그 표의 5번 행("캐시 엔트리·payload 손상 → 무시하고 신규 처리")이 실제로는 지키지 못하는 sub-case 다.

- **[INFO]** `엔트리` 손상(바깥 JSON) 테스트 하나가 `warnSpy` 를 `try/finally` 로 감싸지 않아, 같은 diff 가 새로 추가한 형제 테스트 세 개(`엔트리 손상은 조용히...`, `안쪽 responseJson 이 깨진...`, `안쪽이 깨진 409 엔트리도...`)와 격리 패턴이 다르다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:512` (`const warnSpy = jest.spyOn(...)`) ~ `:539` (`warnSpy.mockRestore();`) — 이번 diff 가 이 테스트에 `warnSpy` 를 **신규로** 추가하면서 `try/finally` 는 붙이지 않았다.
  - 상세: `:526`~`:538` 사이 어느 `expect` 가 실패하면 `mockRestore()`(`:539`) 가 실행되지 않고 spy 가 다음 테스트로 새어나간다. `jest.config.ts` 에 `restoreMocks`/`clearMocks` 전역 설정이 없어(직접 확인) 이 leak 을 자동으로 막아 주는 안전망도 없다. 실행 영향은 낮다 — 새어나간 spy 는 `Logger.warn` 을 계속 no-op 으로 만들 뿐 이후 테스트의 assertion 로직을 바꾸지 않는다(로그 노이즈 억제가 다음 테스트로 넘어가는 정도). 같은 사안이 직전 라운드(`23_36_13` side_effect INFO #6 / requirement INFO #12)에서 "낮은 우선순위" 로 이미 처분됐고, 이번 diff 는 그 지적에 응해 `warnSpy` 를 **추가는 했지만** 형제 테스트의 `try/finally` 패턴까지는 옮기지 않았다.
  - 제안: `warnSpy` 생성 이후 로직을 `try { ... } finally { warnSpy.mockRestore(); }` 로 감싸 형제 테스트 3개와 동형으로 맞춘다(선택, 급하지 않음).

- **[INFO]** 회귀 방지 관점에서는 이번 라운드가 매우 견고하다 — 직접 검증한 사실:
  - `npx jest idempotency.interceptor.spec.ts` 33/33 통과 (RESOLUTION.md 의 "33 total" 과 일치, 직접 재실행 확인).
  - `RESOLUTION.md` 가 주장하는 "payload warn 제거 뮤턴트가 1건→2건 사살" 은 `안쪽이 깨진 409 엔트리도... 같은 방어를 받는다` 테스트(`:636-684`)가 `warnSpy`+`redis.set`+저장값 단언을 형제(`:566-601`)와 동형으로 갖추도록 보강된 결과로, 코드 diff 상으로도 두 테스트의 단언 형태가 실제로 동일함을 확인했다.
  - `bodyHash` 판정 순서 캐너리(`안쪽이 깨졌어도 body 가 다르면 여전히 409`, `:603-634`)는 코드의 판정 순서(`ts:164-186`)를 정확히 겨냥하며, plan 파일(`plan/in-progress/backend-lint-gate-broken-on-main.md:628-631`)에 "뮤턴트를 처음엔 무효로 만들었다" 는 실측 경위까지 기록돼 있어 신뢰도가 높다.
  - `Logger.prototype.warn` mock 이 없는 기존 세 자리(GET 실패, catchError 캐너리, 비-Error reject)는 이번 diff 가 건드리지 않은 영역이라 스코프 밖 — 문제 없음.

## 요약

이번 diff(`IdempotencyInterceptor` 의 캐시 엔트리 내부 `responseJson` 손상 방어)는 테스트 관점에서 대체로 성숙하다 — 신규 테스트 4건이 손상 두 겹(엔트리/payload)·warn 가시성·판정 순서·에러 채널 자매까지 촘촘히 덮고, 직전 두 라운드의 리뷰 지적(형제 테스트 단언 비대칭·docstring stale 인용)도 실제로 반영돼 있으며 뮤테이션 실측으로 하중까지 검증했다. 다만 이번 방어 로직이 정확히 노리는 "엔트리 손상" 범주 안에 **문법적으로는 유효하지만 객체가 아닌 JSON**(전형적으로 `"null"`) 이라는 sub-case 가 빠져 있고, 이 값은 실제로 처리되지 않은 `TypeError` 로 크래시해 이 PR 이 없애려는 바로 그 500 마스킹을 재현한다(로컬 probe 로 실측 확인) — 이는 이전 라운드가 "fail-safe(409) 방향" 이라고 내린 위험 평가를 부분적으로 무효화하는 새 사실이다. 부수적으로 신규 테스트 하나가 형제들과 달리 `warnSpy` 를 `try/finally` 로 감싸지 않아 격리 일관성이 약간 떨어지지만 실질 위험은 낮다.

## 위험도
MEDIUM
