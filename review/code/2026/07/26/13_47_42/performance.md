# 성능(Performance) 리뷰 — linear-cancel-mechanism (2026-07-26 13:47:42)

본 라운드는 직전 라운드에서 낸 **W10**("`assertExecutionNotCancelled` 의 컨테이너 아이템-경계
호출부가 아이템 수에 선형 비례하는 순차 DB 라운드트립을 추가한다")이 이번 diff 의 시간 기반
스로틀(250ms)로 실제 해소됐는지 정량 검증하는 데 집중했다. 결론부터: **해소 확인**. 이하 근거와
잔여 관찰사항.

## W10 정량 검증

### 코드 확인

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:540` — 스로틀 상태
  `containerCancelCheckedAtMs: Map<executionId, lastCheckedAtMs>` (인스턴스 필드, 싱글턴 서비스
  — `@Injectable()` 기본 스코프, `execution-engine.service.ts:485`).
- `execution-engine.service.ts:550` — `CONTAINER_CANCEL_CHECK_THROTTLE_MS = 250`(ms).
- `execution-engine.service.ts:7904-7932` — `assertExecutionNotCancelled(executionId, { throttle })`:
  `throttle:true` 이고 `Date.now() - lastCheckedAt < 250` 이면 실제 `findOne` 을 생략하고 즉시
  반환(직전 "취소 안 됨" 결과 재사용). 아니면 실제 `findOne({select:{id,status}})` 를 수행하고
  타임스탬프를 갱신.
- `execution-engine.service.ts:6515` — `executeContainerBody`(ForEach/Loop/Map 이 **아이템마다 정확히
  1회** 호출하는 지점, 내부 노드 수와 무관)가 `{ throttle: true }` 로 호출. 반면 노드 경계 호출부
  4곳(`runNodeDispatchLoop` 계열 3곳: `:1663`,`:3752`,`:4284`, `executeParallelBranchBody:7155`)은
  스로틀 없이 매번 실제 조회 — 설계상 의도(노드 경계는 이미 NodeExecution INSERT + Execution
  UPDATE + 이벤트 emit 이 동반돼 SELECT 1건의 상대 비용이 무시할 만함).

### 1만 건 ForEach 기준 조회 횟수 상한

핵심 성질: 스로틀은 **아이템 수 기준이 아니라 경과 시간(wall-clock) 기준**으로 실제 DB 조회를
게이팅한다. 따라서 실제 `findOne` 호출 횟수의 상한은

```
실제 조회 횟수 ≈ ceil(ForEach 전체 실행 시간(ms) / 250) + 1
```

이며, **아이템 수 N 과 독립적**이다(정확히는 N 에 대해 O(N) 이 아니라 O(총 실행시간) 이고, 총
실행시간 자체가 N 에 비례하더라도 나눗셈 상수가 250ms 라 실질적으로 완만해진다). 구체적 시나리오:

- **아이템당 처리가 빠른 경우** (JSDoc 이 명시하듯 컨테이너 아이템 경계에도 이미 NodeExecution
  INSERT + Execution UPDATE + WS emit 이 동반되므로 실무에서 아이템당 수 ms 는 일반적):
  아이템당 5ms 라면 1만 건 전체 실행시간 ≈ 50s → 실제 취소-체크 조회는 `50,000/250 ≈ 200회`.
  스로틀 이전(=매 아이템 1회, 10,000회) 대비 **약 50배 감소**.
- **극단적으로 빠른 아이템**(순수 인메모리 변환 등, sub-ms): 1만 건 전체가 250ms 안에 끝나면
  실제 조회는 **1회**(진입 시 baseline 1회) — N 에 대해 사실상 O(1). 이는 스로틀이 없을 때의
  10,000회 대비 4자리수 감소.
- **아이템당 처리가 250ms 이상으로 느린 경우**(외부 HTTP 호출 등): 이 경우 스로틀의 상대적
  이득은 작아져 사실상 매 아이템 실제 조회에 수렴한다 — 그러나 이때는 아이템 자체의 I/O 지연이
  이미 지배적이므로 취소-체크 SELECT 1건 추가는 상대적으로 무시할 만하다(스로틀이 필요했던
  "빠른 아이템 × 대량 N" 시나리오와 정확히 반대 극단이라 문제가 되지 않음).

따라서 "1만 건 ForEach 기준 조회 횟수가 실제로 상한되는가" — **그렇다, 그리고 그 상한은 N 이
아니라 250ms 스로틀 창과 실행 시간에 의해 결정되므로 N 을 훨씬 더 키워도(10만·100만 건) 조회
횟수는 실행시간에 비례해서만 늘어난다** (스로틀이 없었다면 정확히 N 에 선형 비례했을 것).

중첩 컨테이너(ForEach 안의 ForEach 등)도 `executionId` 하나로 스로틀 상태를 공유하므로, 이전
JSDoc 이 우려했던 "중첩 컨테이너는 곱셈적" 문제까지 함께 닫힌다 — 중첩 깊이와 무관하게 동일한
250ms 창 하나로 게이팅된다.

### 회귀 테스트로 확인되는 정도

- `execution-engine.service.spec.ts:10224` (`'짧은 간격 내 아이템 경계 반복은 실제 DB 조회를
  1회로 스로틀한다 (W10)'`) — `itemCount=10` 에 대해 `mockExecutionRepo.findOne.mock.calls.length`
  가 `itemCount` 미만임을 단언. 실제 스로틀 동작을 포착하는 유효한 회귀 가드이지만, 단언 자체는
  느슨하다(`toBeLessThan(itemCount)` — 예: 실제 조회가 9회로 줄어도 통과). 위에서 유도한 정량
  상한(`ceil(wallclock/250)+1`)을 직접 단언하지는 않는다. **런타임 동작 자체(스로틀이 실제로 시간
  기준으로 게이팅됨)는 별도로 `Date.now` 스파이를 쓰는 `:10006` 테스트(C3, 250ms 창을 명시적으로
  넘겨 재조회를 유도)가 검증**하므로, 두 테스트를 합쳐 보면 정성적으로는 충분히 뒷받침된다.
  다만 "N=10,000 에서도 조회 횟수가 O(1)~O(wallclock) 로 유지된다"는 대규모 회귀는 코드 분석
  (위 절)에 의존하며 테스트 스위트에 대규모 N 픽스처는 없다 — 필수는 아니나 있으면 더 강한
  안전망이 된다.

### 스로틀 Map 조회 오버헤드

`Map.get(string)`(문자열 executionId 키, 해시 조회) + `Date.now()` 1~2회 + 정수 비교 — 아이템마다
반드시 실행되는 고정 오버헤드다. 이는:
- 절약되는 DB 라운드트립(로컬이라도 ms 단위, 매니지드 Postgres 라면 수 ms~수십 ms)에 비해
  수 자릿수 작다(V8 의 `Map.get`/`Date.now()` 는 각각 마이크로초 미만~수십 나노초 수준).
- 1만 회 반복 총합도 밀리초 미만으로, "무시할 만하다"는 JSDoc 주장(`:7887` 근처)이 성립한다.

**결론: W10 은 정량적으로 해소됐다.** 조회 횟수가 N 에서 분리돼 wall-clock 시간 기반으로
상한되고, 스로틀 자체의 오버헤드는 절약분 대비 무시 가능하다.

### 스로틀 값(250ms) 적절성 평가

- 범위: 스로틀은 **최대 실제 조회율을 ~4회/초로 고정**한다(N·아이템 속도와 무관). 아이템이
  빨라도 조회가 몰아치지 않고, 아이템이 느려도 상한선 이상으로 조회가 늘지 않는다 — "과함"도
  "부족함"도 아닌 자기-제한적 설계.
- 근거: `spec/conventions/node-cancellation.md` §5 가 취소 전파를 **best-effort** 로 명시하고
  "수백 ms 지연은 무해"라고 규정 — 250ms 는 문서가 언급한 200~300ms 권장 범위의 중앙값으로
  스펙과 정합적이다. 노드 경계(선형/Parallel 브랜치)는 스로틀을 적용하지 않아 그 계약의 "노드
  사이" 관측 지연은 이번 변경으로 늘지 않았다는 점도 코드로 확인(`:1663`,`:3752`,`:4284`,`:7155`).
- 추가 제안(INFO, 필수 아님): 값이 하드코드 상수라 운영 중 튜닝이 필요해지면(예: 매우 빠른
  아이템이 지배적인 워크로드에서 취소 반응성을 더 좁히고 싶은 경우) 재배포가 필요하다. env var화는
  optional 개선이며 현재 값이 spec 의 tolerance 범위 안에 있어 시급하지 않다.

## 부차 관찰 (INFO, 신규 결함 아님)

- **[INFO]** 동시 브랜치 간 스로틀 타임스탬프 갱신 레이스
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7908-7923`
  - 상세: `containerCancelCheckedAtMs.set(...)` 은 `await findOne(...)` 이 완료된 **이후**에
    갱신된다. 동일 `executionId` 를 공유하는 두 비동기 흐름(예: Parallel 브랜치 안에 각각 ForEach
    가 있고 두 브랜치가 동시에 진행되는 경우)이 스로틀 창 만료 시점 부근에서 거의 동시에
    `assertExecutionNotCancelled` 를 호출하면, 둘 다 "만료됨"을 관측하고 타임스탬프 갱신 전에
    각자 실제 조회를 발행할 수 있다. 결과는 기대보다 살짝 잦은 실제 조회(브랜치 수만큼의 중복)일
    뿐 correctness 문제는 없고, 빈도도 스로틀 창 경계 부근의 좁은 시간대에서만 발생해 영향은
    미미하다.
  - 제안: 별도 조치 불필요. 만약 향후 동시성이 크게 늘어(예: 수십 개 병렬 브랜치가 각각 대량
    ForEach 를 도는 워크로드) 중복이 눈에 띄면, `set()` 을 조회 시작 직전으로 당기는 정도로 충분.

- **[INFO]** 스로틀 Map 누수 방지 확인
  - 위치: `execution-engine.service.ts:2664-2670`(`finalizeRehydrationCleanup`), `:4537-4545`
    (`runExecution` finally)
  - 상세: 두 종결 경로 모두에서 `containerCancelCheckedAtMs.delete(executionId)` 를 호출해 Map 이
    실행 종료 후 무한정 누적되지 않음을 확인했다(기존 `segmentStartMs`/`contextService` 캐시와
    동일 패턴). 별도 조치 불필요 — 검증 목적으로 기재.

## 그 외 diff 범위 스캔

이번 diff 의 나머지 변경(§2.3 가드 확장에 따른 `errorPolicy` 우회 재throw 3곳 — foreach-executor.ts,
parallel-executor.ts, workflow.handler.ts / `ExecutionCancelledError` 생성자에 optional `message`
매개변수 추가 / `finalizeCancelledExecution` 공용 헬퍼 추출 / CHANGELOG, 각 `*.spec.ts`)는 전부
O(1) 수준의 조건 분기·재throw·필드 대입이며 반복문 안에서 새로운 DB 호출이나 O(N) 이상 연산을
추가하지 않는다. 성능 관점에서 신규로 지적할 사항은 없다.

## 요약

직전 라운드 W10(ForEach/Loop/Map 아이템 경계 cancel 체크가 아이템 수에 선형 비례하는 순차 DB
라운드트립을 유발)은 이번 diff 의 250ms 시간 기반 스로틀로 실질적으로 해소됐다. 실제 DB 조회
횟수는 더 이상 아이템 수 N 에 선형 비례하지 않고 wall-clock 실행 시간에 의해 상한되며(빠른
아이템·대량 N 시나리오에서는 사실상 O(1)에 수렴), 스로틀 자체(Map 조회 + `Date.now()`)의 오버헤드는
절약되는 DB 라운드트립 대비 무시할 만하다. 스로틀 값(250ms)은 spec 이 명시한 best-effort
tolerance 범위 안에 있고 조회율을 ~4회/초로 자기-제한하므로 과하거나 부족하지 않다. 발견된 잔여
사항은 전부 INFO 등급(동시성 하에서의 드문 중복 조회 — correctness 무영향, 누수 방지 재확인)이며
diff 의 나머지 부분에서 새로운 성능 이슈는 발견되지 않았다.

## 위험도

NONE
