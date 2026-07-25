# 테스트(Testing) 리뷰 — node-cancellation §4 cascade (Cafe24 / MakeShop)

## 발견사항

- **[WARNING]** 취소-vs-타임아웃 경계 테스트에서 실제 오류 타입을 검증하지 않는 약한 단언
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts:142` (`).rejects.toThrow();`), 동형 `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.spec.ts:141`
  - 상세: `'still counts a network failure when the LOCAL timeout aborted the call'` 테스트는 "이 경로는 진짜 transport 장애이므로 `Cafe24TransportFailedError`/`MakeshopTransportFailedError` 로 wrap 되어야 한다"는 정확히 그 경계를 검증하는 테스트인데, `.rejects.toThrow()` 라는 범용 단언만 쓴다. 같은 파일의 다른 `describe('transport failure', ...)` 블록(예: `MakeshopTransportFailedError` 테스트)은 이미 `.rejects.toBeInstanceOf(...)` 패턴을 쓰고 있어, 이 신규 테스트만 기준이 낮다. `upstream?.aborted` 분기가 실수로 뒤집히거나(`recordNetworkFailure`/wrap 을 건너뛰고 raw error 를 그대로 던지는 회귀) 발생해도 이 테스트는 여전히 통과한다.
  - 제안: `.rejects.toBeInstanceOf(Cafe24TransportFailedError)` / `.rejects.toBeInstanceOf(MakeshopTransportFailedError)` 로 강화.

- **[WARNING]** 이번 수정의 실제 근본 원인(429/401 재귀로 인한 리스너 누적)을 재현하는 회귀 테스트가 없음
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts:95` (`describe('abortSignal cascade (node-cancellation §4)', ...)`), 동형 `makeshop-api.client.spec.ts:94`. 재귀 지점은 실제 소스 확인 결과 `cafe24-api.client.ts:1291`(429 재시도)·`:1352`(401 재시도) — `executeWithRateLimit` 은 재시도마다 자기 자신을 재귀 호출하며, cascade 블록(`controller`/`upstream`/`onUpstreamAbort`)은 그 함수 최상단에서 매 호출마다 새로 만들어진다.
  - 상세: `RESOLUTION.md` 자체가 W1 원인을 "`executeWithRetry` 는 429/401 에 재귀하므로 재시도마다 [리스너가] 누적"이라고 명시한다. 그런데 신규 테스트 7건은 전부 **재시도 없는 단일 호출**(성공 1회 또는 즉시 실패 1회)만 mock 한다 — 429/401 재시도가 실제로 발생하면서 동시에 `signal` 이 전달되는 시나리오(예: 429 → retry → success, 그 사이 리스너가 add/remove 되어 누적되지 않는지)는 어디에도 없다. 현재 구현은 코드 검토상 구조적으로 맞아 보이지만(각 재귀 호출이 자기 `finally` 에서 자기 리스너만 정리), 이 테스트 세트는 "고쳤다고 주장하는 바로 그 결함 클래스"를 직접 고정하지 못한다. 특히 `RESOLUTION.md` 후속 항목에 "abort-cascade 3중 복제 → 공용 헬퍼 추출" 이 이미 예고돼 있는데, 그 리팩터링 과정에서 controller/listener 셋업을 함수 밖으로 끌어올리면(재귀 호출 밖 1회만 생성) 정확히 이 결함이 재발할 수 있고, 현재 테스트 스위트는 단일-호출 케이스만 다뤄 그 회귀를 잡지 못한다.
  - 제안: 429 (또는 401) 재시도가 실제로 일어나는 fetchMock 시퀀스에 `signal: upstream.signal` 을 얹어, 재시도 전 구간에 실린 `addEventListener`/`removeEventListener` 호출 균형(또는 최종 fetch 가 받은 signal 의 `aborted` 상태)을 단언하는 테스트 최소 1건 추가.

- **[INFO]** 토큰 refresh 구간은 cascade 대상 밖인데 이를 명시적으로 고정하는 테스트/문서가 없음
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:326`(`await this.ensureFreshToken(integration);`, `call()` 내부) → `refreshAccessToken()`(`:809` 부근 fetch, 확인함) / 동형 `makeshop-api.client.ts:283`→`refreshAccessToken()`
  - 상세: plan 문서(`node-cancellation-residual-signal-propagation.md`)는 "`rawPing()` 은 대상이 아니다"만 명시적으로 배제한다. 그러나 실제로 `call()` 이 매번 먼저 호출하는 `ensureFreshToken()`→`refreshAccessToken()` 의 토큰 refresh fetch 는 `opts.signal` 을 전혀 받지 않는다(자체 controller/timeout 조차 cascade 되지 않음, 확인함). 즉 토큰이 만료 임박이라 proactive refresh 가 도는 매 실제 노드 실행에서, 그 refresh 요청이 진행되는 동안 취소되어도 §4 의 "즉시 중단" 이 적용되지 않는다 — cascade 는 그 뒤의 본 API 호출에만 걸린다. best-effort 부분 구현이라는 이 저장소의 기존 방침과 부합할 수도 있으나(문서화된 결정이라면 문제 없음), 지금은 어디에도 이 경계가 테스트로 고정되거나 plan 에 "제외 사유"로 적혀 있지 않다 — `rawPing()` 은 명시했지만 `refreshAccessToken()` 은 언급이 없다.
  - 제안: 의도된 제외라면 plan 문서에 `rawPing()` 처럼 명시하고, 가능하면 "refresh 도중 abort 해도 refresh 자체는 멈추지 않는다"를 고정하는 테스트 1건 추가(범위를 문서화하는 pinning test).

- **[INFO]** "이미 aborted" 테스트가 fetch 호출 여부를 먼저 확인하지 않고 바로 역참조
  - 위치: `cafe24-api.client.spec.ts:238` (`expect(seen!.aborted).toBe(true);`), 동형 `makeshop-api.client.spec.ts:237`
  - 상세: 테스트 주석은 "클라이언트에 early return 이 없다"는 현재 구현 특성을 정확히 인지하고 있다. 하지만 단언은 `seen!.aborted` 로 non-null assertion 을 바로 걸어, 만약 향후 구현이 "이미 aborted 면 fetch 자체를 생략" 하도록 바뀌면 `seen` 이 `undefined` 로 남아 `TypeError: Cannot read properties of undefined` 라는 불분명한 실패로 나타난다(의도한 assertion 실패 메시지가 아님).
  - 제안: `expect(fetchMock).toHaveBeenCalledTimes(1);` 을 역참조 전에 추가해 실패 시 원인을 명확히 한다.

- **[INFO]** 같은 describe 블록 내에서 `path` 값이 `'products'`(테스트 1~3) / `'product'`(테스트 4~7) 로 불일치
  - 위치: `cafe24-api.client.spec.ts` 의 `describe('abortSignal cascade ...')` 블록 (96~248 gate 구간)
  - 상세: 기능적으로는 무해(fetchMock 이 mock 이라 경로 값을 검증하지 않음)하지만, makeshop 쪽 동일 블록은 시종 `'product'` 로 일관되어 있어 cafe24 파일에 복붙 과정에서 생긴 사소한 불일치로 보인다. 유지보수 시 두 파일을 나란히 놓고 비교하기 어렵게 만드는 요인.
  - 제안: `'product'` 로 통일(makeshop 과 대칭 유지).

## 요약

새로 추가된 abortSignal cascade 테스트(client 7건×2 + handler 2건×2 = 18건)는 §4 계약의 핵심 분기 — 취소 vs 로컬 타임아웃 구분, 성공 시 리스너 해제, in-flight abort, already-aborted, no-signal 회귀 — 를 의도가 분명한 이름과 주석으로 잘 커버하고, `RESOLUTION.md` 가 보여주듯 실제 mutation 검증까지 거쳤다(뮤턴트 무효화 사고도 스스로 발견·정정). 다만 두 가지 실질적 갭이 남는다: (1) 이번 수정이 고쳤다고 주장하는 바로 그 원인 — 429/401 재귀로 인한 리스너 누적 — 을 재현하는 테스트가 없어, 예고된 "공용 헬퍼 추출" 리팩터링이 같은 결함을 재도입해도 잡히지 않을 위험이 있고, (2) 취소-vs-타임아웃 경계 테스트 하나가 이 스위트의 다른 테스트들보다 약한 단언(`toThrow()` vs `toBeInstanceOf`)을 쓴다. 토큰 refresh 구간이 cascade 밖이라는 점은 기능 결함이라기보다 범위 경계가 테스트/문서로 고정되지 않은 문제다. Cafe24/MakeShop 두 구현이 거의 완전히 대칭이라 한쪽에서 발견한 이슈는 그대로 다른 쪽에도 적용된다.

## 위험도
MEDIUM
