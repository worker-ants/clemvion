# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 프로덕션 코드 변경은 전무(신규 e2e 테스트 1건 + plan/spec 문서 정리)하고 인젝션·인가·부작용 축은 전부 안전하지만, **독립적인 세 reviewer(requirement · testing · documentation)가 각자 별도로 동일 결론에 수렴**했다: 이 e2e 가 검증하려는 핵심 안전 계약("cancel 후 하류 노드가 dispatch 되지 않는다")을 설명하는 근거 — 테스트 파일 JSDoc 의 `context.abortSignal?.throwIfAborted()` 인용과 직전 리뷰 라운드 `RESOLUTION.md` §C1 의 "guarded UPDATE" 기전 인용 — 가 모두 실제 코드와 대조 시 **적용되지 않는 경로**를 가리키고 있다. e2e 는 3회 반복 PASS + 대조군으로 결과 자체는 재현됐으나, "왜 통과하는지"의 코드상 근거가 여전히 미확인이다. router 강제 화이트리스트(forced) 7명 전원 결과 확보 완료 — 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement/testing/documentation (3인 수렴) | 이 e2e 의 핵심 계약("cancel 후 하류 노드 미도달")을 설명하는 두 근거 — (a) 테스트 JSDoc 의 `context.abortSignal?.throwIfAborted()` 인용, (b) 직전 라운드 `RESOLUTION.md` §C1 의 "guarded UPDATE" 기전 — 이 모두 이 시나리오(선형 2노드, non-parallel, non-resume)에는 적용되지 않는다. `context.abortSignal` 값 대입은 저장소 전체에서 `parallel-executor.ts:245`(parallel branch 전용) 한 곳뿐이라 이 경로에서 항상 `undefined`. RESOLUTION 이 인용한 `execution-engine.service.ts:313`(`ResumeClaimExecTerminalError`)는 §7.5 resume-claim 전용 sentinel — 이 워크플로는 resume/waiting-for-input 을 타지 않는다. 실제로 이 경로가 지나가는 노드 완료 저장(`:5645-5651`)은 Execution 상태와 무관한 무조건 `.save()`이고, dispatch 루프(`:4251-4454`)도 노드 사이 Execution 최신 상태 재조회가 없다. 즉 이 안전 속성이 **어느 코드에 의해 보장되는지 여전히 미확인** — e2e 3회 PASS + 대조군은 유효한 관측이지만 타이밍 우연 가능성을 배제하지 못한다. | `node-cancellation-propagation.e2e-spec.ts:23-24`; `execution-engine.service.ts:5645-5651`, `:4251-4454`, `:6058`; `parallel-executor.ts:245`; `review/code/2026/07/24/20_36_21/RESOLUTION.md:36-41` | 엔진 단위 테스트(mock 기반, ms 단위)로 "선형 두 노드 사이에서 Execution 이 외부에서 cancelled 로 바뀌면 두 번째 노드가 dispatch 되지 않는다"를 직접 고정할 것. 그 전까지 JSDoc/RESOLUTION 의 구체적 기전 인용을 제거하거나 "기전 미확인, 결과만 반복 검증됨"으로 정직하게 격하. RESOLUTION §C1 인용 라인(`:313`)은 실제 근거로 교체 또는 삭제. |
| 2 | maintainability | terminal 상태 대기 폴링 블록 3곳이 완전히 동일한 패턴(probe·done·timeout 인자 동일, label 만 다름)으로 중복 — 바로 위에서 같은 부류 중복(`waitForNodeRunning`)을 이미 헬퍼로 추출했는데 이쪽만 남음 | `node-cancellation-propagation.e2e-spec.ts:271-276, 297-302, 321-326` | `waitForTerminalStatus(executionId, label)` 헬퍼로 추출해 `waitForNodeRunning` 과 대칭을 맞출 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 인젝션(SQL/코드)·하드코딩 시크릿·인증 하드코딩 등 표면 없음 — DB 쿼리 파라미터 바인딩, code 노드는 고정 템플릿+숫자 상수만 보간, 토큰/워크스페이스는 매 실행 동적 발급 | `node-cancellation-propagation.e2e-spec.ts:75-89, 95, 136-140, 216-219` | 조치 불요 |
| 2 | security | stop API 의 cross-tenant(IDOR) 인가 우회 케이스는 이 e2e 범위 밖 — 기존 커버리지 공백이며 이번 diff 가 새로 만든 갭 아님 | 전체 파일(`:262-266, 308-317, 375-379`) | 필요 시 별도 e2e 항목으로 커버 검토 (낮은 우선순위) |
| 3 | security | `waitUntil<T>` 의 타임아웃 에러 메시지가 프로브 값을 `String(last)` 로 직렬화 — 현재는 문자열 상태값만이라 안전하나, 향후 객체 프로브 재사용 시 민감 필드 노출 가능성 | `node-cancellation-propagation.e2e-spec.ts:232` | 향후 재사용 시 재검토 (테스트 전용 코드, 낮은 우선순위) |
| 4 | side_effect/maintainability | e2e 가 최대 15초(3×5초) CPU-바운드 busy-wait 를 수행하나 `isolated-vm` 스레드 격리로 메인 이벤트루프 비점유 확인됨; `afterAll` 이 생성된 DB 행을 정리하지 않으나 인접 e2e 파일군(`execution-concurrency-cap`, `webchat-idle-reaper`)과 동일 관행임을 직접 대조 확인 | `node-cancellation-propagation.e2e-spec.ts:57, 91-93, 136-139` | 조치 불요 |
| 5 | maintainability | 하류 노드 `config.timeout: 5` 가 이름 없는 리터럴로 남음(같은 파일이 `slow` 노드에는 `CODE_TIMEOUT_SEC` 상수 도입); 변수명 `slow` 가 노드 라벨 `'InFlight'` 와 어긋남; stop 요청 호출부 스타일이 테스트마다 다름(변수 추출 vs 인라인) | `:153, :122/126, :262-267/311-319/329-334` | 상수 추출, 변수명 `inFlightNode` 로 정정, 공용 `stopExecution` 헬퍼로 스타일 통일 (모두 낮은 우선순위) |
| 6 | testing | 진행 중이던 노드 A 자신의 최종 `node_execution.status` 는 어떤 테스트에서도 단언되지 않음 — Execution 이 cancelled 여도 A 는 `completed` 로 남는 비대칭이 실제 발생하는지 미고정 | `node-cancellation-propagation.e2e-spec.ts:253-287` | 테스트 종료 직전 A 의 상태를 조회해 현재 동작을 명시적으로 고정 |
| 7 | testing | WS 이벤트(`execution.node.cancelled`/`execution.cancelled`) 발행 미검증 — spec §5.1 표면이 저장소 전체에서 아직 잠겨 있지 않음(기존 지적 유지) | 전체 파일(REST/DB 폴링만 사용) | 별도 조치 불요(이미 인지), 후속 plan 항목으로 고려 |
| 8 | testing/documentation | 인라인 주석/코드가 특정 리뷰 라운드 발견 번호("ai-review testing WARNING 4")를 직접 인용 — 산출물 아카이브/번호 체계 변경 시 dangling 참조 가능 | `node-cancellation-propagation.e2e-spec.ts:283` | 리뷰 번호 없이 자기완결적 서술로 대체 (낮은 우선순위) |
| 9 | requirement/documentation | plan lifecycle 이동(`node-cancellation-inflight-followups.md` 완료 이동, `node-cancellation-infrastructure.md` dangling 링크 3곳 정정, `node-cancellation-residual-signal-propagation.md` 신설) + spec `pending_plans`/§4/§6 포인터 갱신이 line-level 로 전부 일치, 죽은 참조 0(grep 확인) | `spec/conventions/node-cancellation.md`(frontmatter, §4, §6), `plan/complete/node-cancellation-infrastructure.md:70,83,90` | 조치 불요 |
| 10 | documentation | 헬퍼 함수 `execute()`, `getStatus()` 의 JSDoc 이 `nodeStatus()` 에 비해 부족 — 이번 라운드 변경 범위 밖, 기존 지적 유지 | `node-cancellation-propagation.e2e-spec.ts` | 우선순위 낮음, 일관성 원하면 한 줄씩 추가 |
| 11 | scope | "별도 티켓"임을 자체 명시하는 `harness-push-gate-did-not-fire.md` 가 물리적으로는 같은 브랜치에 번들링됨(코드 변경 없어 실질 위험 낮음); 3번째 테스트(재-stop 거부)가 plan §3 acceptance criteria 를 다소 벗어나나 이미 RESOLUTION 에서 인접 표면으로 처분됨 | `plan/in-progress/harness-push-gate-did-not-fire.md`; `node-cancellation-propagation.e2e-spec.ts:307` | 후속 조사는 별도 worktree/브랜치에서 진행해 "PR 분리 원칙"을 실제로 지킬 것; 그 외 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿 표면 없음; cross-tenant stop 커버리지는 기존 갭(참고용) |
| requirement | LOW | JSDoc 기전 인용이 선형 경로에 미적용 — 3인 수렴 발견의 일부 |
| scope | LOW | 하네스 티켓 번들링, 3번째 테스트 범위 소폭 확장 — 둘 다 이미 자체 처분됨 |
| side_effect | NONE | 프로덕션 코드 변경 없음; e2e 비용·DB 미정리는 기존 관행과 일치 |
| maintainability | LOW | terminal 폴링 중복 3곳(WARNING); 매직넘버/변수명/스타일 잔여(INFO) |
| testing | MEDIUM | RESOLUTION §C1 기전 인용 오류 — 핵심 계약 보장 지점 여전히 미확인 |
| documentation | MEDIUM | RESOLUTION §C1 근거 라인이 실제로는 §7.5 resume-claim 전용 경로를 가리킴 |

## 발견 없는 에이전트

해당 없음 — 실행된 7개 reviewer 전원이 최소 INFO 이상의 발견사항을 보고했다.

## 권장 조치사항

1. **(최우선)** `RESOLUTION.md` §C1 및 e2e 파일 JSDoc 이 주장하는 "하류 노드 미도달" 기전을 실제 엔진 코드로 재확인 — mock 기반 엔진 단위 테스트로 "선형 두 노드 사이 Execution 이 cancelled 로 바뀌면 다음 노드가 dispatch 되지 않는다"를 ms 단위로 결정적으로 고정하거나, 확인이 어렵다면 JSDoc/RESOLUTION 의 구체적 코드 인용을 제거하고 "기전 미확인, 결과만 반복 검증됨"으로 정정할 것.
2. maintainability WARNING: terminal 상태 대기 폴링 3곳(`:271-276, :297-302, :321-326`)을 `waitForTerminalStatus` 헬퍼로 추출.
3. (낮은 우선순위, 일괄 처리 가능) 노드 A 자신의 최종 상태 단언 추가, 매직넘버 상수화, 변수명(`slow`→`inFlightNode`) 정정, stop 호출 스타일 통일, 리뷰 라운드 번호 인용 주석 정리, 헬퍼 함수 JSDoc 보강.
4. `harness-push-gate-did-not-fire.md` 의 실제 조사/수정 작업은 반드시 별도 worktree/브랜치에서 진행해 이 문서 자신이 명시한 "PR 분리 원칙"을 지킬 것.
5. WS 이벤트(`execution.node.cancelled`/`execution.cancelled`) 발행 검증은 별도 후속 plan 항목으로 유지(이번 라운드 범위 밖).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 실행된 전원과 동일) — **forced 7명 전원 결과 확보 완료**, 미이행 없음.
  - **제외**: 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(신규 e2e·plan/spec 문서)에 성능 영향 표면 없음 |
  | architecture | 프로덕션 아키텍처 변경 없음 |
  | dependency | 의존성 추가/변경 없음 |
  | database | 스키마 변경 없음(기존 테이블 읽기/쓰기만) |
  | concurrency | 프로덕션 동시성 로직 변경 없음 |
  | api_contract | 공개 API 계약 변경 없음(기존 stop 엔드포인트 재사용) |
  | user_guide_sync | 사용자 대상 문서 변경 없음 |