# 정식 규약 준수 검토 — node-cancel-signal-b4d1 (impl-done)

> 대상 diff (`origin/main` 대비): `codebase/backend/src/nodes/integration/{cafe24,makeshop}/*.ts(.spec.ts)`,
> `plan/in-progress/node-cancellation-residual-signal-propagation.md`,
> `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`,
> `review/code/2026/07/25/{21_02_33,21_35_11}/RESOLUTION.md`.
> 1차 규약 SoT: `spec/conventions/node-cancellation.md` (프롬프트에는 컨텍스트 예산으로 누락되어
> 워크트리에서 절대경로로 직접 Read/grep 해 확인함).

## 발견사항

- **[CRITICAL]** Cafe24/MakeShop 핸들러가 in-flight 취소를 `cancelled` 로 분류하지 못함 (§5.1 위반, 이번 PR 의 핵심 목적과 정반대 결과)
  - target 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts` catch 블록(약 262–286행) + `mapClientErrorToOutput`(494–559행) / `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts` catch 블록(약 249–277행) + `mapClientErrorToOutput`(459–521행)
  - 위반 규약: `spec/conventions/node-cancellation.md §5.1` ("`error.name === 'AbortError'` 인 throw 는 노드가 실패한 것이 아니라 중단된 것이므로, 엔진이 해당 `NodeExecution.status` 를 `failed` 가 아닌 `cancelled` 로 기록한다"). 엔진 구현도 이를 그대로 강제한다 — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `executeNode` catch 블록(약 5698–5723행)은 `isAbortError(err)` 가 참일 때만 `NodeExecutionStatus.CANCELLED` + `execution.node.cancelled` WS 이벤트를 기록하며, 이는 **`handler.execute()` 가 reject(throw) 해야만** 도달하는 경로다(6058행의 사전 체크는 dispatch **이전** already-aborted 케이스만 담당하고 in-flight 케이스는 이 catch 를 거친다).
  - 상세: 이번 PR 은 `Cafe24ApiClient`/`MakeshopApiClient` 내부의 저수준 `executeWithRateLimit`/`executeWithRetry` catch 에서 `err.name==='AbortError' && upstream?.aborted` 면 `throw err` 하도록(=raw `AbortError` 재throw) 올바르게 고쳤다(RESOLUTION C1 근거). 그러나 그 raw `AbortError` 는 상위 `Cafe24Handler.execute()`/`MakeshopHandler.execute()` 자신의 try/catch 에 다시 걸리고, 그 catch 는 **무조건** `mapClientErrorToOutput(err, …)` 을 호출해 `port:'error'` 리턴값(resolved value)으로 변환한다. `mapClientErrorToOutput` 는 `Cafe24AuthFailedError`/`RateLimitedError`/`TransportFailedError`/`IncompleteCredentialsError`/`IntegrationError` 만 분기하고 `AbortError` 분기가 없어 "Unknown failure" 로 떨어져 `CAFE24_TRANSPORT_FAILED`/`MAKESHOP_TRANSPORT_FAILED` 로 매핑된다 — 즉 핸들러의 `execute()` 프라미스가 **resolve** 되고 엔진의 `isAbortError` catch 블록에 도달하지 못해 최종 `NodeExecution.status` 가 `failed` 로 기록된다(§5.1 의 `cancelled` 가 아님). 같은 저장소의 참조 구현인 `database-query.handler.ts` (320–322행)는 정확히 이 지점 — 핸들러 자신의 catch, D4 error-포트 매핑 직전 — 에 `if (err instanceof Error && err.name === 'AbortError') { throw err; }` 를 두어 우회한다. Cafe24/MakeShop 핸들러에는 이 대응 분기가 **없다**. 테스트도 이 gap 을 못 잡는다: 신규 `cafe24.handler.spec.ts`/`makeshop.handler.spec.ts` 의 `abortSignal forwarding` describe 는 signal 이 `apiClient.call` 로 forward 되는지만 검증하고, `apiClient.call` 이 `AbortError` 를 throw 했을 때 핸들러가 그것을 재throw 하는지는 전혀 검증하지 않는다(두 handler.spec.ts 파일 모두 `AbortError` 문자열 0건).
  - 부가: `review/code/2026/07/25/21_02_33/RESOLUTION.md` 의 C1("catch 에서 `AbortError` 재throw (D4 우회) — … `database-query.handler.ts` 가 이미 쓰는 패턴")은 이 정확한 결함을 지목했지만, 실제 패치는 **client 계층에만** 적용되고 handler 계층에는 누락되어 RESOLUTION 문서의 claim 과 실제 코드가 어긋난다. 또한 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 의 "추가 위임 §6 표 두 행 갱신" 절은 `node-cancellation.md §6` 의 MakeShop/Cafe24 행을 `✓`(구현됨)로 승격 제안하는데, 이 결함이 남아있는 한 그 승격은 **실제로 충족되지 않은 §5.1 계약**(cancelled 분류)을 "구현됨"으로 잘못 기록하는 것이 된다.
  - 제안: `cafe24.handler.ts`/`makeshop.handler.ts` 의 `catch (err) { … mapClientErrorToOutput … }` 진입 직전에 `database-query.handler.ts` 와 동형인 `if (err instanceof Error && err.name === 'AbortError') { throw err; }` (또는 엔진의 `isAbortError` 헬퍼 재사용)을 추가하고, handler.spec.ts 양쪽에 "apiClient.call 이 AbortError 를 throw하면 handler.execute() 도 그것을 그대로 propagate 한다"를 직접 검증하는 테스트를 추가할 것. 수정 전에는 `spec-update-node-cancellation-shutdown-classification.md` 의 §6 표 승격 제안(✓ 전환)을 보류해야 한다 — 지금 승격하면 spec 이 미충족 계약을 구현됨으로 잘못 기술하게 된다.

- **[WARNING]** `node-cancellation-residual-signal-propagation.md` 의 `worktree:` frontmatter 가 착수 후에도 sentinel `(unstarted)` 로 남아있음
  - target 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md` frontmatter 3행 (`worktree: (unstarted)`)
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4` "`worktree` sentinel: 아직 worktree 가 없는 미착수 plan 은 … `(unstarted)` 를 쓴다 … **착수 시 실제 `<task>-<slug>` 로 교체**."
  - 상세: 이 plan 은 diff 안에서 실제로 "착수"된 상태다 — `MakeShop 노드 signal 전파`·`Cafe24 노드 signal 전파` 두 체크박스가 `[x]` 로 바뀌었고 "진행 기록 — commerce 2건 (2026-07-25)" 절이 이번 PR 작업 내용을 상세히 기록한다. 그런데도 frontmatter 는 여전히 `(unstarted)` 다. 이 필드는 "동시 작업 추적"(§4 "용도")과 `plan-stale-audit.sh` 의 "plan 의 worktree 존재 여부 확인"에 쓰이므로, 실제로 활성 작업 중인 plan 이 `(unstarted)` 로 남으면 그 auditing 이 이 plan 을 "미착수"로 오판할 수 있다.
  - 제안: `worktree: node-cancel-signal-b4d1` (현재 worktree 디렉토리명)로 교체. push-gate 의 "연결 판정"(§3) 자체는 이 필드가 틀려도 diff 내 파일 수정으로 별도 충족되므로 즉시 차단되진 않지만, 문서 스키마가 명시한 불변식을 어기고 있어 audit 도구의 신뢰도를 떨어뜨린다.

- **[INFO]** RESOLUTION 문서의 "fixture path 통일" claim 이 실제 코드와 부분적으로 어긋남
  - target 위치: `review/code/2026/07/25/21_35_11/RESOLUTION.md` "INFO 반영: cafe24 fixture path `product` → `products` 통일(makeshop 복붙 흔적)." vs `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts:285` (`await client.call(integration, { method: 'GET', path: 'product' });`)
  - 위반 규약: 명시적 conventions 항목은 아니나, RESOLUTION 문서가 "반영됨"으로 기록한 내용이 실제 워킹트리 상태와 다르면 리뷰 산출물의 신뢰도(정합성) 문제로 이어진다.
  - 상세: cafe24 스펙 파일의 다른 모든 `path:` 는 `'products'` 로 통일돼 있으나, 285행의 "leaves the timeout path untouched when no upstream signal is given" 테스트 한 곳만 makeshop 원본을 그대로 복붙한 `'product'`(단수)가 남아 있다. 기능적으로는 해가 없다(해당 테스트는 `path` 값을 단언하지 않음).
  - 제안: 285행을 `path: 'products'` 로 통일하거나, RESOLUTION 문서의 해당 claim 범위를 "일부 반영"으로 정정.

## 요약

이번 diff 의 핵심 목표(Cafe24/MakeShop 노드에 `context.abortSignal` cascade 배선)는 API 클라이언트 계층에서는 견고하게 구현됐고(재시도 axis 포함 mutation 검증, timeout-vs-cancel 구분, 리스너 누수 수정 등 두 차례 코드 리뷰가 실제로 결함을 걸러냈다는 기록도 충실하다), plan/spec 권한 분리(`developer` 는 `spec/` 미기재, 대신 `project-planner` 위임 문서 신설)도 CLAUDE.md 규약을 정확히 따른다. 그러나 **가장 핵심적인 규약 — `node-cancellation.md §5.1` 의 `AbortError → NodeExecution.cancelled` 분류 — 가 handler 계층에서 누락**되어 있다: 클라이언트가 올바르게 재throw 하도록 고친 raw `AbortError` 가 `Cafe24Handler`/`MakeshopHandler` 자신의 catch 에서 다시 흡수되어 일반 `failed`(`*_TRANSPORT_FAILED`) 로 강등되고, 엔진은 `handler.execute()` 의 reject 여부만으로 `cancelled` 를 판정하므로 이 경로에서는 영구히 `cancelled` 로 분류될 수 없다. 이는 `database-query.handler.ts` 가 이미 정립한 참조 패턴을 handler 계층에서 그대로 놓친 것이며, 같은 코드 리뷰 라운드의 RESOLUTION 문서가 "이미 고쳤다"고 기록한 항목과 실제 코드가 어긋난다는 점에서 단순 누락 이상의 신뢰도 문제다. 나머지 두 발견(WARNING/INFO)은 plan frontmatter 스키마·리뷰 문서 정확도에 대한 경미한 이탈이다.

## 위험도

HIGH
