# 요구사항(Requirement) 충족 리뷰 — node-cancellation §4 cascade (Cafe24/MakeShop)

## 발견사항

- **[CRITICAL]** cascade 로 발생한 `AbortError` 가 엔진의 `cancelled` 분류 경로에 절대 도달하지 못한다 — D4 catch-all 이 그대로 삼켜 `port:'error'` 로 반환한다
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1244` (`throw new Cafe24TransportFailedError(err);`), `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts:532-538` (`mapClientErrorToOutput` 의 `Cafe24TransportFailedError` 분기), `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:869`, `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts:497-503` (동일 구조)
  - 상세: `spec/conventions/node-cancellation.md` §5.1 은 "노드 핸들러는 abort 시 `error.name === 'AbortError'` 를 throw 또는 propagate. 엔진은 이 에러를... `cancelled` 로 분류한다" 고 명시하고, 엔진 쪽 구현(`execution-engine.service.ts:5698-5715`, `isAbortError`)은 정확히 **thrown exception** 을 대상으로만 `NodeExecution.status = CANCELLED` + `NODE_CANCELLED` 이벤트를 발행한다. 그런데 cafe24/makeshop 클라이언트의 `executeWithRateLimit`/`executeWithRetry` 는 cascade 로 유발된 fetch 의 `AbortError` 를 원인 구분 없이 `catch (err) { ... throw new Cafe24TransportFailedError(err); }` (makeshop 동일)로 감싸고, 이 값은 handler 의 `mapClientErrorToOutput` 에서 `err instanceof Cafe24TransportFailedError` 분기를 타 **정상 반환값**(`{code:'CAFE24_TRANSPORT_FAILED', statusCode:0, ...}` → `return {..., port:'error'}`, throw 아님)으로 변환된다. 즉 `handler.execute()` 는 예외 없이 정상적으로 resolve 하므로, 엔진의 `isAbortError` catch 블록에 **결코 도달하지 않는다**. 결과적으로 실행 중 cancel 이 Cafe24/MakeShop 호출을 실제로 중단시키는 것(1차 목적 — 불필요한 대기 회피)은 달성되지만, §5.1 이 약속하는 2차 계약(`NodeExecution.status='cancelled'`, `execution.node.cancelled` WS 이벤트, 타임라인이 `running` 에 잔류하지 않음)은 전혀 이행되지 않는다. 대신 사용자에게는 일반 네트워크 실패와 구분 불가능한 `CAFE24_TRANSPORT_FAILED`/`MAKESHOP_TRANSPORT_FAILED` (`statusCode:0`) 만 남는다.
    같은 저장소에 정확한 참조 패턴이 이미 존재한다 — `database-query.handler.ts:320-322`: `if (err instanceof Error && err.name === 'AbortError') { throw err; }` 로 **D4 error-포트 매핑을 명시적으로 우회**해 엔진이 `cancelled` 로 분류하도록 재throw 한다 (주석: "node-cancellation §5 — ... D4 error-포트 매핑을 우회해 그대로 재throw → 엔진이 노드를 `cancelled` 로 분류"). 이번 PR 은 cafe24/makeshop 에 이 우회 로직을 추가하지 않았다. `Cafe24TransportFailedError`/`MakeshopTransportFailedError` 모두 `readonly cause: unknown` 을 보존하므로 (`cafe24-api.client.ts:205`), `err.cause` 의 `name==='AbortError'` 검사로 수정이 가능하다 — 구조적으로 어려운 수정이 아니다.
  - 제안: cafe24-api.client.ts/makeshop-api.client.ts 의 fetch catch 블록(또는 handler 의 `mapClientErrorToOutput`)에서 원인이 `AbortError` 인 경우를 `database-query.handler.ts` 와 동일하게 식별해 D4 catch-all 을 우회하고 그대로 재throw 하도록 고친다. (참고: `concurrency.md` 리뷰가 같은 코드를 "정상 integration 이 취소만으로 `error(network)` 로 강등" 측면에서 CRITICAL 로 별도 지적했다 — 근본 원인은 동일하다.)

- **[WARNING]** 성공 완료 경로에서 upstream `abort` 리스너가 해제되지 않아, 재시도(429/401)마다 새 리스너가 누적된다 — 주석의 "재시도 간 리스너 누적 방지" 주장과 실제 동작이 어긋난다
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1208-1228`(등록) / `:1245-1247`(`finally` — `clearTimeout(timer)` 뿐), `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:837-857` / `:870-872` 동일
  - 상세: `controller.signal` 의 `'abort'` 이벤트는 timeout 또는 upstream cascade 로만 발화하고, **정상 완료(2xx/4xx 응답 포함)시에는 발화하지 않는다** — 그런데 upstream 리스너 해제는 오직 그 이벤트에 의존한다. 게다가 `executeWithRateLimit`/`executeWithRetry` 는 429/401 재시도마다 재귀 호출되어 매번 새 컨트롤러+새 리스너를 **같은 `opts.signal`**(실행 전체에 걸쳐 공유될 수 있는 `context.abortSignal`)에 등록하므로, 중간에 실패했다가 결국 성공하는 흔한 케이스에서도 앞선 시도들의 리스너가 그대로 남는다. `concurrency.md` 리뷰가 이 문제를 더 상세히(구체적 재현 시나리오 포함) 다뤘으므로 여기서는 spec-fidelity 관점만 덧붙인다: `http-request.handler.ts:400-423` 에 이미 동일한 결함이 존재하는데, 이번 PR 은 이를 "identical to http-request.handler.ts" 로 인용하며 그대로 두 곳 더 복제했다 — 기존 결함의 교정이 아니라 확산이다.
  - 제안: `finally` 블록에서 성공/실패/타임아웃과 무관하게 항상 `upstream?.removeEventListener('abort', onUpstreamAbort)` 를 직접 호출하도록 세 파일(cafe24, makeshop, http-request) 모두 수정.

- **[SPEC-DRIFT]** `spec/conventions/node-cancellation.md` §6 구현 현황 표의 MakeShop/Cafe24 행이 이번 구현 완료 후에도 "— 미구현 (Planned)" 로 남아 있다
  - 위치: `spec/conventions/node-cancellation.md:138`, `:139` (실 소스 줄 번호, 이번 diff 대상 아님 — `Read` 로 확인)
  - 상세: 이번 PR 은 `Cafe24CallOptions.signal`/`MakeshopCallOptions.signal` 신설 + handler cascade 를 완성했고, `plan/in-progress/node-cancellation-residual-signal-propagation.md` 는 두 항목을 `[x]` 로 마킹했다(파일 9). 그러나 그 잔여 plan 이 추적하는 SoT 인 §6 표 자체는 갱신되지 않아 "MakeShop/Cafe24 노드 signal 전파 — 미구현(Planned)" 라는 **이제는 사실이 아닌 문구**가 남는다. `developer` 는 `spec/` 쓰기 권한이 없으므로 코드 fix 대상이 아니라 **spec 갱신 누락**이다 — DB 노드 in-flight 취소 구현 커밋(`640531901`)이 같은 PR 안에서 §6 표를 함께 갱신한 선례가 있다(이번엔 그 선례를 따르지 않음). `documentation.md` 리뷰가 동일 발견을 이미 상세히 기록했다.
  - 제안: 코드는 그대로 두고, `project-planner` 에게 §6 표의 두 행을 `✓`(근거: `cafe24-api.client.ts`/`makeshop-api.client.ts` §4 cascade)로 갱신하도록 위임한다.

- **[INFO]** 신규 주석/테스트가 인용하는 "§2.2 (pre-check)" 는 실제로 그 동작을 규정하는 절이 아니다
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1210` 부근 주석, `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts:89`,`:139`(게이트 기준) 및 makeshop 대응 파일 동일 위치
  - 상세: §2.2 표제는 "CPU 바운드 / 즉시 완료 노드" 이고 "시작 전 cancel 된 경우 즉시 종료(early return)" 를 권고하는 절인데, 이번 코드가 속하는 카테고리는 §2.1(외부 I/O 노드, fetch cascade) 이다. "이미 aborted 인 upstream 은 즉시 abort" 동작은 §4 예시 코드 자체(`if (upstream.aborted) { controller.abort(); }`, node-cancellation.md:87-88)에 이미 포함돼 있어 §4 인용만으로 충분하다. 기능에 영향은 없으나, `documentation.md` 가 지적했듯 향후 spec-impl-evidence 감사에서 §2.2 구현 위치를 이 파일로 오추적할 위험이 있다.
  - 제안: "§2.2" 인용을 제거하거나 "§4 already-aborted 분기" 로 정정.

- **[INFO]** plan 문서의 mutation 커버리지 표 숫자가 신규 테스트 본문만으로는 재현되지 않는 것으로 보인다 (확신도 낮음 — 실측 rerun 권장)
  - 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md` "진행 기록" 절의 표 (`client 의 cascade 블록 제거 | client spec 4 failed`)
  - 상세: 신규 `describe('abortSignal cascade ...')` 블록의 4개 `it` 중 `aborted === true` 를 단언하는 2개(“aborts the in-flight fetch”, “aborts before issuing the request when ALREADY aborted”)만 cascade 블록 제거로 실패할 것으로 보이고, 나머지 2개(“does not abort when signal stays open”, “leaves the timeout path untouched when no upstream signal is given”)는 `aborted === false` 를 단언하므로 cascade 유무와 무관하게 그대로 통과할 것으로 읽힌다. "4 failed" 주장이 어떤 정확한 mutant 범위를 기준으로 했는지 diff 만으로는 재현되지 않는다.
  - 제안: 실제 mutation 재실행으로 표의 숫자를 재확인(제거 범위를 명시)하거나, 표 각주에 "전체 블록 제거 시 2/4 만 신호" 처럼 정정.

## 요약

배선 자체(handler → client `signal` 전달, `Cafe24CallOptions`/`MakeshopCallOptions.signal` 신설, §4 cascade 코드가 spec 예시와 line-level 로 정확히 일치)는 방향이 맞고 신규 테스트(client 4건×2, handler 2건×2)도 forwarding/cascade 의 기본 계약을 검증한다. 그러나 이 변경이 실제로 달성하려는 상위 요구사항 — "취소된 실행의 Cafe24/MakeShop 노드가 `cancelled` 로 분류된다"(§5.1) — 은 D4 catch-all 이 cascade 로 발생한 `AbortError` 를 무분별하게 삼켜 `port:'error'`/`*_TRANSPORT_FAILED` 로 변환하기 때문에 달성되지 않는다(같은 저장소의 `database-query.handler.ts` 가 보여주는 올바른 패턴과 대조됨). 여기에 성공 경로에서의 리스너 미해제(주석의 주장과 불일치, `concurrency.md` 가 상세화), spec §6 상태표 미동기화(SPEC-DRIFT, `documentation.md` 가 상세화)가 더해져, 이번 PR 은 "타임아웃까지 기다리지 않고 fetch 를 즉시 끊는다" 는 1차 목적은 달성하되 spec 이 약속하는 상태 분류 계약은 충족하지 못한 상태로 남는다.

## 위험도

CRITICAL
