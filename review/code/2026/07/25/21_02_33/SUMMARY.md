# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — cascade 로 인한 취소(AbortSignal)가 (1) 엔진의 `cancelled` 상태 분류 계약(§5.1)을 우회해 `port:'error'`/`*_TRANSPORT_FAILED` 로 잘못 반환되고, (2) `recordNetworkFailure` 카운터를 오염시켜 §2.2 사전-aborted 경로에서는 **결정적으로**(race 아님) 정상 integration 을 3회 취소만으로 `error(network)` 로 강등시킬 수 있음. forced 화이트리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과가 확보되어 있어 화이트리스트 미이행으로 인한 거짓 음성은 없음 — 위 CRITICAL 은 실제 확보된 `requirement`/`concurrency` 보고서에 근거함.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항/에러분류 | cascade 로 발생한 `AbortError` 가 D4 catch-all(`mapClientErrorToOutput`)에 흡수되어 엔진의 `cancelled` 분류(§5.1, `execution-engine.service.ts` `isAbortError`)에 결코 도달하지 못하고 정상 반환값 `{code:'*_TRANSPORT_FAILED', statusCode:0, port:'error'}` 로 변환됨. 같은 저장소의 `database-query.handler.ts:320-322` 는 `err.name==='AbortError'` 시 재throw 하여 D4 를 우회하는 올바른 패턴을 이미 갖고 있으나 이번 cafe24/makeshop 변경에는 적용되지 않음 | `cafe24-api.client.ts:1244`, `cafe24.handler.ts:532-538`, `makeshop-api.client.ts:869`, `makeshop.handler.ts:497-503` | fetch catch 블록(또는 `mapClientErrorToOutput`)에서 원인이 `AbortError`(`err.cause?.name==='AbortError'`)인 경우 `database-query.handler.ts` 와 동일하게 D4 우회·재throw 하도록 수정 |
| 2 | 동시성/에러분류 | cascade 로 인한 취소가 "네트워크 장애"로 오분류되어 `recordNetworkFailure` 연속 실패 카운터를 오염시킴. §2.2 사전-aborted 체크(`if (upstream.aborted) controller.abort();`)는 이미 취소된 실행에서 **항상, 결정적으로** 이 catch 블록으로 떨어지므로, 예컨대 `ParallelExecutor` 의 cancel-others-on-fail 로 3개 이상의 형제 브랜치 호출이 동시에 취소되면 즉시 "3회 연속 네트워크 실패"로 카운트되어 정상 integration 이 `error(network)` 로 강등되고 이후 실행이 모두 막힘(수동 재연결 필요) | `cafe24-api.client.ts:1206-1247`(특히 catch `:1238-1243`), `makeshop-api.client.ts:835-869`(catch `:867-868`) | fetch 실패가 취소(`AbortError`)로 인한 것인지 먼저 판별해, upstream 이 원인인 abort 는 `recordNetworkFailure` 를 호출하지 않고 별도 에러(취소 전용 타입)로 분리. 로컬 `timeoutMs` 타임아웃으로 인한 abort 만 기존처럼 네트워크 실패로 카운트 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/자원누수 | upstream `abort` 리스너 정리가 `controller.signal` 의 `'abort'` 이벤트에만 의존하는데, 정상 완료(success) 경로는 `finally { clearTimeout(timer) }` 만 수행하고 `controller.abort()` 를 호출하지 않아 **리스너가 절대 해제되지 않음**. 신규 주석의 "completion 시 해제된다" 주장은 실제와 다름(AbortController 표준 동작과 불일치). 429/401 재시도 시 `executeWithRateLimit`/`executeWithRetry` 가 재귀 호출되며 매번 새 리스너를 같은(실행 전체에 걸쳐 공유되는) `context.abortSignal` 에 추가 — 성공적으로 끝나는 재시도 attempt 마다 리스너가 누적됨(Node `MaxListenersExceededWarning` 대상). 성공경로 cleanup·재시도×cascade 상호작용을 검증하는 테스트도 전무. `http-request.handler.ts:400-423` 에 동일한 기존 결함이 있고, 이번 PR 이 이를 고치지 않고 2곳 더 복제해 노출 표면이 3곳으로 늘어남 (performance/requirement/side_effect/testing/concurrency 5개 reviewer 중복 지적) | `cafe24-api.client.ts:1208-1228`(등록)/`:1245-1247`(finally), `makeshop-api.client.ts:837-857`/`:870-872`; `http-request.handler.ts:400-423` | `finally` 블록에서 완료/실패/타임아웃과 무관하게 항상 `upstream?.removeEventListener('abort', onUpstreamAbort)` 호출하도록 3파일(cafe24, makeshop, http-request) 모두 수정. 성공경로 cleanup 회귀 테스트(`removeEventListener` 스파이) + 재시도×signal 조합 테스트 추가 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/conventions/node-cancellation.md` §6 구현 현황 표의 MakeShop/Cafe24 두 행이 이번 구현(§4 cascade) 완료 후에도 "— 미구현 (Planned)" 으로 남아 있음. 이 저장소는 과거 3명의 리뷰어에게 동일한 라벨(plan 완료)-본문(spec 상태표) 불일치를 이미 지적받은 이력이 있고, DB 노드 in-flight 취소 구현 커밋(`640531901`)은 같은 PR 안에서 §6 표를 함께 갱신한 직접 선례가 있음에도 이번엔 따르지 않음 (requirement, documentation 2개 reviewer 중복 지적) | `spec/conventions/node-cancellation.md:138-139` | `developer` 는 `spec/` 쓰기 권한이 없으므로 `project-planner` 에게 §6 표 두 행을 `✓`(근거: `cafe24-api.client.ts`/`makeshop-api.client.ts` §4 cascade)로 갱신하도록 위임 — 코드 revert 아님 |
| 3 | 문서화 | 신규 주석·테스트 설명 4곳이 인용하는 "§2.2(pre-check)" 는 실제로 이 코드가 속하지 않는 절(§2.2 표제="CPU 바운드/즉시완료 노드", "early-return 권장")이며, 이 코드 자신의 테스트 주석이 "The fetch still runs (the client has no early return)" 라고 스스로 반대되는 설명을 붙임. 이미 aborted 인 upstream 즉시 abort 동작은 §4 예시 코드만으로 충분히 근거됨. 향후 spec-impl-evidence 감사가 §2.2 구현 위치를 이 파일들로 오추적할 위험 | `cafe24-api.client.ts:1210`, `cafe24-api.client.spec.ts:89,139`, `makeshop-api.client.ts:839`, `makeshop-api.client.spec.ts:88,138` | "§2.2" 인용 제거 또는 "§4 already-aborted 분기"로 정정 |
| 4 | 유지보수성 | Prettier 미실행 — 신규 handler spec 2개 파일이 프로젝트 포맷 컨벤션(작은따옴표, 멀티라인 객체 줄바꿈) 위반. 나머지 6개 변경 파일은 통과 확인됨(`npx prettier --check` 재현) | `cafe24.handler.spec.ts:750,757,776`, `makeshop.handler.spec.ts:577,584,602` | `npx prettier --write` 후 재커밋 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | abort-cascade 배선 로직(15~20줄)이 `http-request.handler.ts` + 신규 `cafe24-api.client.ts` + `makeshop-api.client.ts` 3곳에 문자 그대로 중복 — 업체별 도메인 미러링과는 별개인 범용 유틸리티 중복 | `cafe24-api.client.ts:1208-1228`, `makeshop-api.client.ts:837-857`, `http-request.handler.ts:400-421` | `attachAbortCascade(upstream, controller)` 공용 헬퍼로 추출 |
| 2 | 테스트/유지보수성 | 신규 cascade 테스트 일부가 `async/await` 대신 raw `Promise.then()` 체이닝을 사용해 형제 테스트와 스타일 불일치 | `cafe24-api.client.spec.ts:116`, `makeshop-api.client.spec.ts:115` | `async/await` 로 통일 |
| 3 | 테스트 | cascade 테스트 4건 모두 GET 메서드로만 고정 — write-method(POST/PUT) 경로와의 결합 회귀는 이 스위트만으로 보장되지 않음(기능 위험은 낮음) | `cafe24-api.client.spec.ts:94-166`, `makeshop-api.client.spec.ts:93-166` | 우선순위 낮음, 필요 시 write-method 1건 추가 |
| 4 | 테스트 | 기존 광범위 `toEqual` 단언이 새 `signal: undefined` 필드를 Jest 의 undefined-프로퍼티 무시 동작에 암묵적으로 의존해 우연히 통과 — 향후 `context.abortSignal` 기본값 변경 시 조용히 깨질 수 있음 | `cafe24.handler.spec.ts:314-321` 등 | 즉각 조치 불요, 리팩터 시 참고 메모로 남김 |
| 5 | 문서화 | 신규 테스트 제목 "aborts before issuing the request..." 가 실제 동작(주석: "fetch 는 그대로 실행되고 signal 만 이미-aborted 상태로 전달됨")과 표현상 모순되어 보일 수 있음 | `cafe24-api.client.spec.ts:138`, `makeshop-api.client.spec.ts:137` | 제목을 "carries an already-aborted signal..." 식으로 조정(선택) |
| 6 | 범위 | `makeshop-api.client.spec.ts` 신규 `describe` 블록과 다음 블록 사이 빈 줄이 누락되어 cafe24 버전과 미러 구조 불일치 | `makeshop-api.client.spec.ts:167-168` | 빈 줄 1개 추가(선택) |
| 7 | 요구사항/문서화 | plan 문서(`node-cancellation-residual-signal-propagation.md`) mutation 커버리지 표의 숫자가 신규 테스트 본문만으로는 재현되지 않는 것으로 보임(확신도 낮음) — 4개 신규 `it` 중 2개만 cascade 제거로 실패할 것으로 읽히고 나머지 2개는 cascade 유무와 무관하게 통과할 것으로 보임 | `plan/in-progress/node-cancellation-residual-signal-propagation.md` "진행 기록" 표 | 실제 mutation 재실행으로 표의 숫자 재확인 |
| 8 | 유지보수성 | plan 문서 특정 헤더 앞에 빈 줄이 2개 삽입(다른 헤더는 1개) | `plan/in-progress/node-cancellation-residual-signal-propagation.md` | 빈 줄 1개로 정리(선택) |
| 9 | 문서화 | `CHANGELOG.md` 미갱신 — 다만 동일 클래스의 과거 작업(DB 노드 in-flight 취소, HTTP 노드 cascade 최초 도입)도 전용 항목을 추가하지 않은 선례가 있어 규약 위반은 아닌 것으로 판단 | `CHANGELOG.md`(변경 없음) | 참고용, 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | CRITICAL | cascade AbortError 가 엔진 `cancelled` 분류에 도달 못함(D4 우회 미적용); SPEC-DRIFT §6 표 미갱신 |
| concurrency | HIGH | 취소가 네트워크 장애로 오분류되어 `recordNetworkFailure` 오염 → 정상 integration 강등 가능; 성공경로 리스너 미해제 |
| performance | MEDIUM | 성공 경로 리스너 누적(메모리 누수), 재시도마다 배가 |
| side_effect | MEDIUM | 리스너 누적이 주석의 "누적 방지" 주장과 반대 동작 |
| testing | MEDIUM | 성공경로 cleanup·재시도×cascade 상호작용 테스트 전무 |
| documentation | MEDIUM | spec §6 표 stale, §2.2 근거 없는 인용 |
| maintainability | LOW | Prettier 미실행 2파일; abort-cascade 3중 복제 |
| security | LOW | 리스너 정리 관련 주석 과장(INFO 수준, 기존 패턴 대칭 확장이라 심각도 낮음) |
| scope | NONE | 순수 additive 변경, 사소한 서식 불일치 1건만 |
| api_contract | NONE | 발견사항 없음 |

## 발견 없는 에이전트

- **api_contract** — 하위호환성·에러응답·URL설계 등 8개 관점 모두 영향 없음("발견사항: 없음")

## 권장 조치사항

1. **[최우선]** cafe24/makeshop fetch catch 블록에서 취소(`AbortError`)로 인한 실패를 식별해 `database-query.handler.ts` 패턴대로 D4 catch-all 을 우회·재throw — 엔진이 `cancelled` 로 분류하도록 수정 (Critical #1)
2. **[최우선]** 같은 catch 블록에서 취소로 인한 실패가 `recordNetworkFailure` 카운터를 오염시키지 않도록 원인 분리 — 정상 integration 이 취소만으로 `error(network)` 로 강등되는 경로 차단 (Critical #2)
3. `finally` 블록에서 완료/실패/타임아웃과 무관하게 항상 `upstream.removeEventListener` 를 호출하도록 cafe24/makeshop/http-request 3파일 모두 수정하고, 성공경로 cleanup + 재시도×signal 조합에 대한 회귀 테스트 추가 (Warning #1)
4. `project-planner` 에게 `spec/conventions/node-cancellation.md` §6 표의 MakeShop/Cafe24 행을 완료(✓)로 갱신하도록 위임 — 코드 revert 아님, spec 갱신만 필요 (SPEC-DRIFT)
5. 신규 주석·테스트의 "§2.2" 인용을 제거하거나 "§4 already-aborted 분기"로 정정 (Warning #3)
6. `npx prettier --write` 로 handler spec 2파일 포맷 정리 후 재커밋 (Warning #4)
7. (선택, 시급성 낮음) abort-cascade 로직을 공용 헬퍼로 추출해 3중 복제 제거

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract` (10명)
  - **제외**: 표 (reviewer · 이유, 1명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — forced 전원 결과 확보됨(화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 라우터 판단(구체적 사유 미기재 — prompt 에 별도 skip_reason 없음) |