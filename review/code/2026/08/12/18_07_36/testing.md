# 테스트(Testing) Review

## 발견사항

- **[WARNING]** `storeEntry()` 의 직렬화 실패 방어(`try/catch`)가 어떤 테스트로도 검증되지 않는다 — 이 메서드 자체의 docstring 이 그 방어가 왜 결정적인지 명시하고 있는데도.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:214-241` (특히 `catch (err)` 블록 228-233행)
  - 상세: `storeEntry()` docstring(205-213행)은 "이 메서드는 `catchError` 셀렉터 안에서도 불리는데, 거기서 throw 하면 그 새 에러가 원래 409/410 예외를 대체해 클라이언트가 500 을 받는다" 고 명시적으로 이 try/catch 의 존재 이유를 적어 놨다. 그런데 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 전체를 뒤져도 순환 참조 등 `JSON.stringify` 가 던지는 payload 로 이 분기를 행사하는 테스트가 하나도 없다(`grep -n "직렬화\|circular\|storeEntry"` 결과 0건). diff 이전 원본 코드를 확인해 보면 `next` 콜백(2xx 성공 경로)에도 이 방어가 아예 없었다 — `JSON.stringify(value ?? null)` 를 try/catch 없이 인라인으로 호출했다. 즉 이번 diff 가 **두 채널(2xx 성공/409·410 error) 모두에 새로 추가한 보호 로직**인데, 두 채널 다 실측 테스트가 없다. 이 프로젝트가 같은 파일에서 이미 4라운드에 걸쳐 반복한 결함 클래스("mock 이 만든 상태 ≠ 시스템이 실제로 만드는 상태" · "문서한 보장이 구현/테스트보다 넓다")와 정확히 같은 모양이다 — 방어 코드는 존재하고 정확하지만, 그것을 지키는 회귀 테스트가 없어 향후 리팩터가 이 try/catch 를 지워도 아무 테스트도 RED 가 되지 않는다.
  - 제안: `idempotency.interceptor.spec.ts` 에 순환 참조 payload 로 `makeThrowingHandler(new ConflictException(circular))` 를 던지는 테스트를 추가해 (1) 원 예외(`ConflictException`)가 그대로 전파되고 (2) `redis.set` 이 호출되지 않음을 단언한다. 가능하면 2xx 성공 채널(`makeCallHandler`)에서도 같은 payload 로 동일 계약(응답이 그대로 나가고 `redis.set` 미호출)을 단언해 두 채널 모두를 커버한다.

- **[WARNING]** 새 e2e 테스트(`I-1`/`I-2`)가 `409` 캐싱·재현만 실 파이프라인에서 검증하고, 같은 `isErrorStatusCacheable()` 분기를 공유하는 `410`(GoneException/EXECUTION_TERMINATED) 은 e2e 레벨에서 전혀 행사되지 않는다.
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:371` (I-1 테스트 시작) — `I-2`(446행) 다음에 대칭 `410` 테스트("I-3")가 없다.
  - 상세: 이 e2e 블록을 도입한 이유 자체가 "단위 mock 이 네 라운드 연속 실제로 발생하지 않는 상태를 검사했다" 는 교훈이고, 주석도 "409·410 은 서비스가 throw 하고 컨트롤러는 `@HttpCode(202)`" 라고 **둘을 같은 문장으로** 묶어 설명한다(362-369행). 그런데 실제로 e2e 로 내려간 것은 409 뿐이다. `interaction.service.ts:253,431` 에서 `GoneException`(`EXECUTION_TERMINATED`)이 실제로 throw 되는 것은 확인했고, 다른 e2e 파일(`app.e2e-spec.ts:153`, `webhook-trigger.e2e-spec.ts:261`)에 410 자체를 만드는 시나리오는 있지만 `Idempotency-Key` 캐시와 결합해 검증하는 곳은 없다. `idempotency.interceptor.spec.ts` 의 410 유닛 테스트(297-321, 352-381행)는 여전히 `makeThrowingHandler(new GoneException(...))` 로 손수 만든 예외를 쓰는데, 이는 이번 CRITICAL 이 정확히 지적했던 "mock 이 만들 수 있는 상태가 실제로 발생하는 상태와 같다는 보장이 없다" 는 그 패턴이다 — 코드 경로는 409와 공유되므로 위험도는 낮지만, "자매 자리를 두 번 더 놓쳤다" 는 이 PR 자신의 plan 교훈(`plan/in-progress/backend-lint-gate-broken-on-main.md` 626-635행)이 이 자리에도 그대로 적용된다.
  - 제안: `I-1` 과 대칭인 `I-3` e2e 테스트를 추가해, 실제로 종료된 execution 에 `Idempotency-Key` 를 달아 재요청하면 410 이 캐시에서 재현되는지(엔트리 존재 + 재요청 시 동일 상태코드/에러코드) 확인한다. 별도 PR/후속 항목으로 미룬다면 그 사실을 plan 백로그에 명시적으로 남긴다.

- **[INFO]** 캐시된 error 엔트리의 `responseJson` 이 손상된 경우(내부 JSON 파싱 실패)에 대한 방어·테스트가 없다 — `intercept()` 의 최상위 `try/catch`(캐시 엔트리 전체 파싱)와 달리 내부 `responseJson` 파싱에는 방어가 없고, 새로 추가된 예외-재현 분기도 이 갭을 물려받았다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:137`(신규 예외 재현 분기의 `JSON.parse(cached.responseJson)`), `143`(기존 성공 재현 분기의 동일 패턴)
  - 상세: `switchMap` 콜백 상단(112-121행)의 `try { JSON.parse(cachedJson) } catch` 는 엔트리 **전체**(bodyHash/responseJson/statusCode 를 감싼 바깥 JSON) 파싱만 방어한다. `cached.responseJson` 자체가 유효하지 않은 JSON 문자열이면(Redis 값 부분 손상 등 저확률 시나리오) 137행·143행의 `JSON.parse` 가 방어 없이 동기적으로 throw 해 예외가 그대로 관측되지 않은 형태로 전파된다. 이 갭은 diff 이전에도 143행에 존재했던 선재 패턴이라 이번 diff 의 회귀는 아니지만, 새로 추가된 137행(409/410 재현)도 같은 무방비를 그대로 물려받았다. `idempotency.interceptor.spec.ts:453` 의 "손상된 캐시 JSON" 테스트는 바깥쪽 손상만 다루고 이 안쪽 손상은 다루지 않는다.
  - 제안: 이번 PR 스코프 밖(선재 갭)이므로 필수는 아니나, plan 백로그(`readKey`/`hashBody` 경계값 항목 옆)에 "캐시 엔트리 내부 `responseJson` 손상" 케이스를 함께 적어 두면 다음에 이 자리를 만지는 사람이 스코프를 알 수 있다.

- **[INFO]** `storeEntry()` 의 Redis `SET` 이 fire-and-forget(`void this.redis.set(...)`)이라, 신규 e2e 테스트(`I-1`)가 HTTP 응답을 받은 직후 곧바로 `redis.get()` 으로 캐시 엔트리 존재를 확인하는 방식과 이론적으로 레이스 가능성이 있다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:234-240` (`storeEntry` 의 `void this.redis.set(...)`), `codebase/backend/test/external-interaction.e2e-spec.ts:371-444` (I-1 이 `first` 응답 직후 바로 `redis.get` 단언)
  - 상세: HTTP 응답 전송과 Redis `SET` 완료는 서로 다른 비동기 I/O 라 순서가 언어 차원에서 보장되지 않는다. 다만 이 fire-and-forget 패턴은 diff 이전부터 2xx 캐싱에 이미 존재했고(이번 diff 는 같은 패턴을 error 채널로 확장한 것뿐), 인터셉터가 `SET` 을 호출하는 시점이 응답을 클라이언트로 내보내는 예외 필터 처리보다 먼저이므로 실제 flaky 로 관측될 가능성은 낮다(plan 문서의 "266 passed" 실측과 부합). 그래도 CI 환경의 부하·네트워크 지연에 따라 드물게 흔들릴 수 있는 잠재 요인이다.
  - 제안: 현재로선 조치 불필요. 만약 이 e2e 가 향후 CI 에서 간헐적으로 실패하면 이 fire-and-forget 특성을 먼저 의심하고, 필요 시 `redis.get()` 을 짧은 폴링/재시도로 감싸는 것을 고려한다.

## 요약

이번 diff 의 핵심 — 409/410 을 error 채널에서 잡아 캐시하고 캐시 히트 시 예외로 재현하는 재설계 — 는 단위 테스트(`makeThrowingHandler` 를 통한 실제 채널 재현) 와 신규 e2e(`I-1`/`I-2`)로 충실히 검증됐고, 회귀 테이블에 없던 3xx 축소·404/5xx 우회 검증 갭도 함께 메워졌다. 다만 이번 diff 가 새로 도입한 방어 로직 중 하나 — `storeEntry()` 의 직렬화 실패 try/catch — 는 그 자체 docstring 이 "안 지키면 원래 409/410 예외가 500 으로 바뀐다" 고 명시할 만큼 결정적인데도 이를 행사하는 테스트가 전혀 없어, 이 PR 이 이미 네 라운드 겪은 "문서화된 보장 vs 미검증" 결함 클래스가 새 코드에 다시 잠재해 있다. 또한 e2e 승격의 취지(mock 상태 vs 실제 상태 괴리 방지)가 409 에만 적용되고 대칭인 410 에는 적용되지 않아, 그 취지가 노린 위험이 410 자리에는 여전히 남아 있다. 두 항목 모두 코드 결함이 아니라 커버리지 갭이므로 병합을 막을 필요는 없지만, 후속 조치로 반드시 남겨야 한다.

## 위험도

MEDIUM
