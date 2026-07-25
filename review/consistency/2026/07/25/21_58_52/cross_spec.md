# Cross-Spec 일관성 검토 결과

## 검토 범위 메모

harness 가 전달한 `target 문서`(`spec/conventions/` 전체 알파벳순 덤프)는 이번 PR 의 실제 diff 와
무관했다(diff 는 `spec/` 변경 0건, `codebase/backend/src/nodes/integration/{cafe24,makeshop}/*`
+ plan 문서 2건만 변경). `git diff origin/main --stat` 로 확인한 실제 변경 범위에 맞춰,
`spec/conventions/node-cancellation.md`(SoT, worktree 절대경로로 직접 Read) 및 이를 구현한
코드(`cafe24-api.client.ts` / `cafe24.handler.ts` / `makeshop-api.client.ts` /
`makeshop.handler.ts`, 대조군으로 `database-query.handler.ts` / `http-request.handler.ts` /
`text-classifier.handler.ts`, `execution-engine.service.ts`)를 절대경로로 직접 열어 실측했다.
(prompt 가 이 파일들을 "컨텍스트 예산 초과로 생략"이라 밝혔으므로 — 생략을 "문제 없음"의
근거로 삼지 말라는 지시에 따라 직접 확인함.)

## 발견사항

- **[CRITICAL]** Cafe24/MakeShop 핸들러가 client 가 재-throw 한 `AbortError` 를 다시 삼켜
  §5.1 `cancelled` 분류를 무효화한다
  - target 위치: 이번 PR 신규 코드 — `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts`
    (inner catch L262, outer catch L346, `mapClientErrorToOutput` L494) ·
    `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts`
    (inner catch L249, outer catch L333, `mapClientErrorToOutput` L459). 둘 다
    `spec/conventions/node-cancellation.md` §4 cascade 배선을 구현하려 한 코드.
  - 충돌 대상: `spec/conventions/node-cancellation.md §5.1` — "노드 핸들러는 abort 시
    `error.name === 'AbortError'` 를 throw 또는 propagate — 엔진의 errorPolicyHandler 가
    그 에러를 cancelled 의미로 분류한다". 이 계약을 실제로 구현하는
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5698-5729`
    의 `executeNode` catch 블록(`isAbortError(err)` 판정, 주석이 "spec/conventions/
    node-cancellation.md §5.1" 을 직접 인용)과 직접 모순.
  - 상세: `Cafe24ApiClient.executeWithRateLimit` / `MakeshopApiClient.executeWithRetry` 는
    이번 PR 에서 `upstream?.aborted` 인 경우 `Cafe24TransportFailedError` /
    `MakeshopTransportFailedError` 로 감싸지 않고 raw `AbortError` 를 재throw 하도록
    수정됐다(client spec 의 "rethrows AbortError and does NOT count a network failure"
    테스트로 실측 확인, `cafe24-api.client.spec.ts` 신규 describe). 그러나 그 raw
    `AbortError` 를 받는 `Cafe24Handler.execute()` / `MakeshopHandler.execute()` 의 catch
    블록은 `err` 를 무조건 `mapClientErrorToOutput()` 에 넘긴다. 그 함수는
    `Cafe24AuthFailedError` / `Cafe24RateLimitedError` / `Cafe24TransportFailedError` /
    `Cafe24IncompleteCredentialsError` / `IntegrationError` 만 분기 처리하며(makeshop 도
    대칭), raw `AbortError` 는 어느 것에도 해당하지 않아 "Unknown failure" 기본분기로
    떨어져 **`{ code: 'CAFE24_TRANSPORT_FAILED'(/`MAKESHOP_TRANSPORT_FAILED`), ...,
    port: 'error' }` 로 매핑되어 handler 가 정상 반환한다 (throw 하지 않음)**.
    `mapClientErrorToOutput` 전체(양쪽 handler)에 `'AbortError'` 문자열이 전혀 없음을
    grep 으로 확인(0건). 즉 엔진의 `executeNode` catch(`isAbortError(err)` 판정)는
    handler 가 애초에 throw 하지 않으므로 **절대 도달하지 않고**,
    `NodeExecutionStatus.CANCELLED` / `execution.node.cancelled` WS 이벤트는 발생하지
    않는다 — 실행이 취소돼도 Cafe24/MakeShop 노드는 여전히 `failed` +
    `CAFE24_TRANSPORT_FAILED`(또는 `MAKESHOP_TRANSPORT_FAILED`) 로 기록된다. 이는 이번
    PR 이 목표한 §5.1 cancelled 분류가 두 노드 타입에서 **관측 불가능**하다는 뜻이며,
    client-layer 수정("`database-query.handler.ts` 의 재throw 패턴 적용" — plan 파일
    자체의 표현)은 handler 층에 동일 가드가 없어 무력화된다. 대조: 올바른 패턴을 가진
    `database-query.handler.ts` 는 handler 자신의 top-level catch 안에서
    `if (err instanceof Error && err.name === 'AbortError') { throw err; }` (L320) 를
    D4 error-port 매핑 **이전에** 실행해 실제로 재throw 한다 — cafe24/makeshop 에는 이
    가드의 handler-층 대응물이 없다.
  - 테스트 커버리지 증거: `cafe24.handler.spec.ts` / `makeshop.handler.spec.ts` 의 신규
    "abortSignal forwarding" describe 는 signal 이 `apiClient.call` 로 forward 되는지만
    검증하고(`apiClient.call.mockResolvedValue(...)`), `apiClient.call` 이 `AbortError`
    로 reject 됐을 때 handler 가 어떻게 반응하는지는 테스트하지 않는다. 대조:
    `cafe24.handler.spec.ts:552` 의 기존 "Cafe24TransportFailedError — error port +
    CAFE24_TRANSPORT_FAILED" 테스트는 있으나 `AbortError` reject 케이스에 대한 동등
    테스트는 없다 — 정확히 이 gap 이 버그를 가렸다.
  - **참고 (범위 확대, 심각도 근거 보강)**: 동일 근본 결함(핸들러가 자체 catch-all 로
    `AbortError` 를 삼켜 엔진까지 전파하지 않음)이 이미 `http-request.handler.ts`
    (node-cancellation.md §6 표에서 "✓ 구현됨"이며 이번 PR 이 "동일 패턴"이라 명시적으로
    인용한 모델)에도 존재한다 — 파일 전체에 `'AbortError'` 문자열 매칭 0건이며, 그 자신의
    취소 테스트(`http-request.handler.spec.ts:1668` `upstream abort` 케이스)조차
    `.resolves.toBeDefined()` 로 단언해("throw 되지 않는다"는 사실을 그대로 승인) 재확인
    된다. `text-classifier.handler.ts` 도 동일(그 catch 는 모든 에러를 `LLM_CALL_FAILED`/
    `LLM_RATE_LIMIT` 로 매핑, AbortError 분기 없음). 유일하게 올바른 재throw 가드를 가진
    것은 `database-query.handler.ts` 뿐이다. 즉 node-cancellation.md §6 의 "✓ 구현됨"은
    "signal 이 하위 SDK/fetch 로 forward 된다"만 검증됐을 뿐, §5.1 이 요구하는 "cancelled
    분류가 실제로 도달한다"는 DB 노드를 제외하고 어디서도 검증되지 않는다 — spec 상태
    표가 실제 보장 범위를 과장하고 있다.
  - 제안: `Cafe24Handler.execute()` / `MakeshopHandler.execute()` 양쪽 모두, **inner catch
    (L262/L249) 와 outer catch (L346/L333) 두 곳 다** (이중 try/catch 구조라 안쪽에서
    재throw 해도 바깥 catch 가 다시 삼킨다) `database-query.handler.ts` 와 동일한 가드
    (`if (err instanceof Error && err.name === 'AbortError') throw err;`) 를 추가하고,
    "handler propagates raw AbortError instead of mapping to port:'error'" 단위 테스트를
    `apiClient.call.mockRejectedValue(Object.assign(new Error('x'), {name:'AbortError'}))`
    로 고정할 것. `plan/in-progress/node-cancellation-residual-signal-propagation.md` 의
    "commerce 2건" `[x]` 완료 표시를 재검토하거나 잔여 항목으로 재등록 필요. `http-request
    .handler.ts` / `text-classifier.handler.ts` 의 동일 결함은 이번 PR 범위 밖이지만
    별도 후속 plan(`developer` 는 spec 쓰기 권한 없음 — `project-planner` 위임)으로 반드시
    추적해야 한다 — 그렇지 않으면 node-cancellation.md §6 의 "✓" 표기가 §5.1 계약을 실제로
    검증하지 않은 채 방치된다.

- **[INFO]** node-cancellation.md §6 표·§4 예시 코드의 알려진 SPEC-DRIFT — 이미 별도 문서로
  추적 중이라 재복제 불필요, 단 위 CRITICAL 이 그 위임 문서에 아직 반영되지 않음
  - target 위치: `spec/conventions/node-cancellation.md §6` 구현 현황 표, §4 cascade 예시
  - 충돌 대상: 실제 구현(`cafe24-api.client.ts` / `makeshop-api.client.ts`), 그리고
    `http-request.handler.ts` 의 선재 리스너 누수
  - 상세: §6 표는 MakeShop/Cafe24 "signal 전파"를 여전히 "— 미구현 (Planned)"으로 표기하지만
    client 층(§4 cascade) 배선은 이번 PR 로 완료됐다(단 위 CRITICAL 이 의미하듯 §5.1
    cancelled 분류까지는 미완). §4 예시 코드는 성공 경로에서 리스너를 해제하지 않는 누수를
    "정답"인 것처럼 제시한다. 이 두 gap 은 `developer` 가 이미
    `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 에
    project-planner 위임으로 명시적으로 등록해뒀다("추가 위임" 2건, 2026-07-25) — CLAUDE.md
    의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 규약을 정확히
    따른 사례다. **새 조치 불필요** — 이미 올바르게 라우팅됨.
  - 제안: project-planner 가 §6 표를 "✓"로 갱신할 때, 위 CRITICAL(handler 층 재throw 누락으로
    cancelled 분류가 실제로는 미검증)을 함께 반영해야 한다 — 그렇지 않으면 표 갱신이 오히려
    CRITICAL 의 실체를 "구현 완료"로 덮어버리는 새로운 SPEC-DRIFT 를 만든다.

## 요약

이번 PR의 실제 변경분(Cafe24/MakeShop 노드의 `context.abortSignal` cascade 배선)은
`spec/conventions/node-cancellation.md` §4(client 레벨 cascade)는 올바르게 구현했으나, §5.1
(엔진이 `cancelled`로 분류할 수 있도록 `AbortError`를 handler 밖으로 propagate 해야 한다는
계약)은 handler 층의 재throw 가드 누락으로 실제로는 충족되지 않는다 — 두 차례의 코드 리뷰가
클라이언트 층의 유사 버그 3건은 잡았지만 이 handler 층 gap 은 놓쳤다. 이는 PR 이 의도한
기능(취소 시 `cancelled` 분류 + `execution.node.cancelled` 이벤트)이 Cafe24/MakeShop 노드에서
관측되지 않는다는 뜻이라 CRITICAL 로 판단한다. 부수적으로 같은 근본 결함이 이미
`http-request.handler.ts`/`text-classifier.handler.ts`(spec §6 "✓ 구현됨")에도 존재함을
확인했는데, 이는 이번 PR 범위 밖이지만 spec 상태 표의 신뢰도에 영향을 준다. spec/conventions/
표·예시의 알려진 staleness(§6 두 행, §4 예시 누수)는 developer 가 이미 project-planner 위임
문서로 적절히 라우팅해뒀으므로 재작업이 필요 없다.

## 위험도

CRITICAL
