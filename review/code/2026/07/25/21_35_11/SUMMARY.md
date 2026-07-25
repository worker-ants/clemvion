# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없음. 다만 (1) `spec/conventions/node-cancellation.md` §4 의 cascade 예시 코드가 이번 diff 가 실측으로 고친 리스너 누수 버그를 여전히 정답 패턴으로 보여주고 있고(`requirement`·`documentation` 두 reviewer 가 독립적으로 지적, `[SPEC-DRIFT]`), (2) 이번 수정의 실제 근본 원인(429/401 재귀로 인한 리스너 누적)을 직접 재현하는 회귀 테스트가 없으며, (3) 429 backoff sleep·401 reactive-refresh 대기 구간은 cascade 된 `abortSignal` 을 전혀 관측하지 않아 그 구간에서는 "취소 즉시 반영" 보장이 적용되지 않는다. 셋 다 기능 정합성보다는 spec 신뢰성·회귀 안전망·계약 완전성에 관한 문제로, 즉시 차단할 결함은 아니지만 방치 시 다음 구현자가 낡은 spec 예시를 베끼거나 후속 리팩터링(공용 헬퍼 추출)이 같은 버그를 재도입해도 잡지 못할 실질적 경로가 있다.

라우터 관련 특이사항 없음 — `forced`(router_safety 강제 포함) 7개 reviewer 전원 결과가 확보되었고, `skipped` 된 `performance` 는 강제 목록에 없어 절차상 문제 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/conventions/node-cancellation.md` §4 의 cascade 예시 코드·서술("cleanup 의무는 fetch API 가 보장")이 이번 세션이 실측(mutation)으로 반증한 리스너 누수 버그 패턴을 여전히 정답으로 제시한다. 성공 경로에서 `controller.signal` 의 abort 이벤트가 발화하지 않아 upstream 리스너가 해제되지 않는 것이 실제 버그였고, 이 diff 의 cafe24/makeshop client 는 `finally` 기반 정리로 (올바르게) spec 예시를 벗어났다. `http-request.handler.ts` 는 지금도 spec 원문 그대로라 같은 누수가 살아있다. 이 §4 결함은 기존 spec 위임 문서(`spec-update-node-cancellation-shutdown-classification.md`)의 갱신 목록에 아직 없다. | `spec/conventions/node-cancellation.md` §4 (~84-101행) vs `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1213-1227`, `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:842-856` | 코드는 유지(현재 구현이 옳음). `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 위임 목록에 "§4 예시를 finally 기반 cleanup 으로 교체 + 관련 서술 정정" 항목을 신규 추가하고, `http-request.handler.ts` 의 동일 선재 누수도 함께 추적할 것 (project-planner 위임) |
| 2 | Requirement | 주석에 복사된 메서드명이 실제 구현과 다름 — `executeWithRetry` 는 makeshop 쪽 메서드명이고, cafe24 파일의 실제 429/401 재귀 메서드는 `executeWithRateLimit` | `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1216` | 주석의 `executeWithRetry` → `executeWithRateLimit` 로 정정 |
| 3 | Testing | 취소-vs-로컬타임아웃 경계를 검증하는 테스트가 `.rejects.toThrow()` 라는 범용 단언만 사용 — 같은 파일의 다른 transport-failure 테스트는 `.rejects.toBeInstanceOf(...)` 를 쓰는데 이 테스트만 기준이 낮아, `upstream?.aborted` 분기 회귀(오분류)가 발생해도 통과할 수 있음 | `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts:142`, `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.spec.ts:141` | `.rejects.toBeInstanceOf(Cafe24TransportFailedError)` / `MakeshopTransportFailedError` 로 강화 |
| 4 | Testing | 이번 수정의 실제 근본 원인(429/401 재시도 재귀로 인한 upstream 리스너 누적, `RESOLUTION.md` W1)을 직접 재현하는 회귀 테스트가 없음 — 신규 테스트 7건 전부 재시도 없는 단일 호출만 다룬다. 예고된 "cascade 공용 헬퍼 추출" 리팩터링이 controller/listener 셋업을 재귀 호출 밖으로 끌어올리면 같은 결함이 재발해도 현재 스위트는 잡지 못함 | `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts:95` (describe 블록), 재귀 지점 `cafe24-api.client.ts:1291`(429)·`:1352`(401); makeshop 대칭 `makeshop-api.client.spec.ts:94` | 429(또는 401) 재시도가 실제 발생하는 fetchMock 시퀀스에 `signal` 을 얹어, 재시도 구간 전체의 리스너 add/remove 균형 또는 최종 fetch 의 `aborted` 상태를 단언하는 테스트 최소 1건 추가 |
| 5 | Concurrency | 429 backoff sleep(`sleepImpl`)과 401 reactive-refresh 대기(BullMQ `waitUntilFinished` 또는 DB row lock)는 cascade 된 `abortSignal` 을 전혀 참조하지 않음 — execution 이 이 두 대기 구간 도중 취소돼도 코드는 대기를 끝까지 마친 뒤 **다음 재귀 호출 진입 시점에야** 취소를 반영한다. §4 가 명시한 "cancelled execution 이 즉시 멈춘다"는 보장이 이 두 구간에는 적용되지 않음 | `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1290`(sleep), `:1339`(`performAuthRefresh`); makeshop 대칭 `makeshop-api.client.ts:908`, `:939` | (a) sleep 을 signal-aware 로 바꾸거나(`Promise.race`), (b) 범위 밖임을 plan 의 best-effort 각주에 이 두 구간을 구체적으로 명시할 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability / Scope | Cafe24/MakeShop 두 client 의 cascade 로직(리스너 설치·AbortError 재throw·`finally` 정리)이 라인 단위로 거의 동일하게 3중 복제(`http-request.handler.ts` 포함)됨 | `cafe24-api.client.ts:1218-1227,1250-1256,1261-1263`, `makeshop-api.client.ts:847-856,875-881,886-888` | 이미 `plan`/`RESOLUTION.md` 에 공용 헬퍼 추출 후속으로 추적·defer 됨 — 저장소의 기존 미러 설계 결정과도 부합, 조치 불요(우선순위 낮게 유지) |
| 2 | Testing / Maintainability | 신규 테스트 fixture 의 `path` 값이 같은 describe 블록 안에서 `'products'`(cafe24 앞 3건)/`'product'`(뒤 4건, makeshop 복붙 흔적)로 불일치 — 기능 영향 없음 | `cafe24-api.client.spec.ts:188,210,234,244` | 파일 전체 컨벤션(`'products'`)에 맞춰 통일 |
| 3 | Testing | 토큰 refresh 구간(`ensureFreshToken`→`refreshAccessToken`)은 `opts.signal` 을 전혀 받지 않아 cascade 대상 밖인데, plan 은 `rawPing()` 만 명시적으로 제외 대상으로 적어두었고 이 구간은 언급이 없음 | `cafe24-api.client.ts:326`→refresh fetch, `makeshop-api.client.ts:283`→동형 | 의도된 제외라면 plan 에 `rawPing()` 과 같은 방식으로 명시하고, 가능하면 pinning 테스트 1건 추가 |
| 4 | Concurrency | per-integration in-process mutex(`withIntegrationLock`)가 같은 integration 에 대한 다른 실행의 잔여 실행시간만큼 취소 반영을 지연시킬 수 있음(사전 존재 인프라, 이번 diff 대상 아님) | `cafe24-api.client.ts:251-269,321`; makeshop 대칭 `:226`대 | 신규 결함 아님, §4 계약 완전성 관점에서만 후속 인지 |
| 5 | Security / Requirement / Concurrency | `err.name === 'AbortError' && upstream?.aborted` 판별은 인과관계가 아닌 catch 시점의 상태 스냅샷에 의존 — 로컬 timeout 만료 직후 극히 좁은 race 에서 이론상 진짜 타임아웃 실패가 취소로 오분류돼 `consecutiveNetworkFailures` 가 과소 집계될 가능성(발생 확률·피해 모두 경미, 저장소 전반의 기존 best-effort 패턴과 동일) | `cafe24-api.client.ts:1250-1256`, `makeshop-api.client.ts:875-881` | 즉시 조치 불요. 향후 유사 클래스 재검토 시 `AbortSignal.any`/reason 전달 등으로 인과관계 명시화 고려 |
| 6 | Testing | "이미 aborted" 테스트가 `fetchMock` 호출 여부를 먼저 확인하지 않고 `seen!.aborted` 로 바로 non-null 역참조 — 향후 구현이 early-return 을 도입하면 불명확한 `TypeError` 로 실패 | `cafe24-api.client.spec.ts:238`, `makeshop-api.client.spec.ts:237` | 역참조 전에 `expect(fetchMock).toHaveBeenCalledTimes(1);` 추가 |
| 7 | Documentation | 이 저장소는 버그 수정에 대해 `CHANGELOG.md` 서술형 항목을 남기는 관행인데, 이번 정합성 버그 수정(취소의 네트워크 실패 오분류)에는 항목이 없음 | `CHANGELOG.md` | 짧은 Unreleased 항목 추가 고려(우선순위 낮음, 사용자 비대면 내부 배선) |
| 8 | Documentation / Requirement | `spec/conventions/node-cancellation.md` §6 구현 현황 표(MakeShop/Cafe24 행)가 "미구현 (Planned)" 로 stale 하지만, 이미 `RESOLUTION.md` W2 와 `spec-update-node-cancellation-shutdown-classification.md` 로 적절히 위임·추적되어 있음(발견이라기보다 절차 준수 확인) | `spec/conventions/node-cancellation.md` §6 | 새 조치 불필요 — 위임 문서 갱신만 완료되면 됨 |
| 9 | Side Effect | already-aborted 분기에서도 조기 return 없이 `fetchImpl` 진입 — 취소된 실행에서도 fetch 함수는 매번 호출되며, 실제 소켓 미오픈 여부는 fetch/undici 구현이 이미 aborted 된 signal 을 즉시 reject 하는 데 의존. 커밋 의도상 설계된 동작이며 결함 아님 | `cafe24-api.client.ts` (already-aborted 분기, diff 게이트 1220-1230); makeshop 동형 | 조치 불요. 향후 불필요한 네트워크 라운드트립이 실측되면 조기 return 고려 |
| 10 | Security | (긍정적 변경) 이번 diff 가 `finally` 블록 정리로 성공 경로의 리스너 영구 잔존(사전 결함, 429/401 재귀 시 배가)을 해소함 | `cafe24-api.client.ts:1260-1263`, makeshop 동형 | 없음 — 이미 해결됨. 동일 패턴을 `http-request.handler.ts` 에도 후속 적용 권장(위 WARNING #1 과 연계) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. 리스너 누수 수정(긍정적 변경) 확인 |
| requirement | LOW | SPEC-DRIFT 1건(§4 예시 낡음), 주석 메서드명 오기재 |
| scope | NONE | 범위 일탈 없음, cafe24/makeshop 중복은 기존 미러 설계 결정과 일치 |
| side_effect | NONE | 부작용 없음, 리스너 등록/해제가 올바르게 격리·정리됨 |
| maintainability | LOW | cascade 로직 3중 복제(추적됨), 테스트 fixture 사소한 불일치 |
| testing | MEDIUM | 약한 단언 1건, 근본원인(리스너 누적) 회귀 테스트 부재 |
| documentation | MEDIUM | SPEC-DRIFT(§4 예시가 반증된 버그 패턴을 여전히 정답으로 제시), CHANGELOG 미기재 |
| concurrency | MEDIUM | 429/401 대기 구간이 cascade 된 abortSignal 을 관측하지 않음 |

## 발견 없는 에이전트

- security, scope, side_effect — 실질적 결함 없음(INFO 성격의 확인·긍정적 변경 기록만 존재)

## 권장 조치사항

1. `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 위임 목록에 `spec/conventions/node-cancellation.md` §4 예시 코드·서술 갱신(finally 기반 cleanup 패턴으로 교체) 항목을 신규 추가 — project-planner 위임 (WARNING #1, SPEC-DRIFT)
2. 429/401 재시도 재귀로 인한 리스너 누적을 직접 재현하는 회귀 테스트 최소 1건 추가 (WARNING #4)
3. 취소-vs-타임아웃 경계 테스트의 단언을 `toBeInstanceOf` 로 강화 (WARNING #3)
4. cafe24 파일의 `executeWithRetry` 주석 오기재를 `executeWithRateLimit` 로 정정 (WARNING #2)
5. 429 backoff sleep·401 refresh 대기 구간의 취소 응답성을 signal-aware 로 개선하거나 best-effort 범위 밖임을 plan 에 명시 (WARNING #5)
6. (낮은 우선순위) 테스트 fixture `products`/`product` 통일, `CHANGELOG.md` 항목 추가, 토큰 refresh 구간 범위 제외를 plan 에 명시

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency` (8명)
  - **제외**: 아래 표 (1명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단으로 제외(prompt 에 상세 사유 미기재). 강제 화이트리스트(router_safety) 대상 아님 — 절차상 문제 없음 |