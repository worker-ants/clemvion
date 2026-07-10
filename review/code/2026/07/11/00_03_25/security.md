# 보안(Security) 코드 리뷰 — EIA/WS continuation 명령 ↔ 대기 노드 표면 매트릭스 가드

검토 대상: `resolveWaitingNodeExecutionId` publisher 사전 검증 확장(`assertCommandMatchesWaitingSurface`
+ `waiting-surface-guard.ts` 신설) + `hooks.service.ts` chat-channel forwarding graceful catch +
관련 unit/e2e 테스트 및 plan 문서. (review/consistency/2026/07/10/23_19_34/** 는 이전 세션의
consistency-check 산출물로 코드가 아니므로 별도 보안 분석 대상에서 제외, 참고만 함.)

## 발견사항

- **[INFO] (특정 점검 요청 1 — 확인됨) 409 거부 client 응답에 내부 상세(대기 nodeId·노드 타입·표면) 미노출**
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts:33-43,113-119`
    (`ExecutionError`/`InvalidExecutionStateError`), `execution-engine.service.ts:5213-5236`
    (`assertCommandMatchesWaitingSurface`), `interaction.service.ts:410-418`
    (`dispatchContinuation`), `websocket.gateway.ts:940-956` (`buildContinuationErrorAck`)
  - 상세: `InvalidExecutionStateError` 생성자는 `message` 를 항상 고정 문자열
    `'Execution is not waiting for input.'` 로 못박고, 호출측이 넘긴 진단 문자열(대기
    `nodeId`, `node.type`, 판정된 `surface`, `expectedCommand`, `executionId`)은 전부
    `serverDetail` 로만 보존된다. `dispatchContinuation` 은 `err.message`(고정 문구)만 꺼내
    `ConflictException({error:{code:'STATE_MISMATCH', message: err.message}})` 로 던지므로
    `serverDetail` 은 EIA REST 응답에 절대 섞이지 않는다. WS ack 경로(`buildContinuationErrorAck`)
    도 동일 원칙(`error.serverDetail` 은 `this.logger.warn` 으로만 소비, ack payload 에는
    `error.message`+`error.code` 만 포함)을 따른다 — 신규 표면-불일치 케이스도 기존
    `ExecutionError` 계층을 재사용하므로 자동으로 이 안전장치에 편입된다.
    `assertCommandMatchesWaitingSurface` 내부의 `logger.warn`/`logger.debug` 호출도 서버 로그
    전용이며 client 응답 경로와 분리돼 있다.
  - 검증: `waiting-surface-guard.spec.ts`/`execution-engine.service.spec.ts` 의
    `'거부 메시지는 client-safe 고정 문자열, 상세는 serverDetail 에만'` 테스트가
    `err.message === 'Execution is not waiting for input.'` && `!err.message.includes('n-wait')`
    && `err.serverDetail` 에 상세가 있음을 명시적으로 단언한다. e2e
    (`execution-park-resume.e2e-spec.ts` 신규 케이스)도
    `expect(JSON.stringify(rejected.body)).not.toContain(form.id)` 로 실제 HTTP 응답 바디에
    nodeId 가 섞이지 않음을 실증한다. CWE-209(민감 정보를 포함한 에러 메시지) 관점에서 안전.
  - 결론: 문제 없음 — §7.5.2 계약대로 정확히 구현됨.

- **[INFO] (특정 점검 요청 2 — 확인됨) `hooks.service.ts` ConflictException graceful catch 가 인증/인가 실패를 삼키지 않음**
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:750-761`
    (`forwardToInteractionService`), `interaction.service.ts:90-171` (`interact`)
  - 상세: `forwardToInteractionService` 는 `scope: 'in_process_trusted'` 로 ctx 를 합성해
    `InteractionService.interact()` 를 in-process 로 직접 호출한다 — 이는 EIA-AU-08 스펙이
    이미 명시한 기존 설계(토큰 검증은 `InteractionGuard` 계층의 책임이고, chat-channel
    webhook 서명검증은 그 이전 단계에서 이미 끝나 있음, 본 PR 로 신규 도입된 우회가 아님).
    `InteractionService.interact()` 자체는 인증/인가 검사를 하지 않는(facade 주석에 "토큰
    검증은 InteractionGuard 가 이미 통과시킨 상태" 명시) 메서드이고, `ForbiddenException`
    은 이 메서드가 아니라 별도 메서드 `refreshToken()`(`TOKEN_REFRESH_FORBIDDEN`)에서만
    던져진다. 즉 `catch (err) { if (err instanceof ConflictException) {...} throw err; }`
    코드 경로에서 애초에 인증/인가 예외가 발생할 수 있는 지점이 아니다. 신규 catch 는 오직
    `assertWaiting`/`dispatchContinuation`(publisher 표면 가드 포함)이 던지는
    `ConflictException`(409 `STATE_MISMATCH`)만 대상이며, 그 외 모든 예외(`Error`,
    `NotFoundException`, `GoneException` 등)는 `throw err` 로 그대로 재전파된다.
  - 검증: `hooks.service.spec.ts` 신규 테스트 `'표면 불일치 외의 예외는 그대로 전파 (삼키지
    않음)'` 가 `interactionService.interact` 가 일반 `Error('redis down')` 를 던질 때
    `handleWebhook` 이 그대로 reject 함을 명시적으로 단언한다 — 광범위한 삼킴이 아님을
    회귀 테스트로 고정.
  - 결론: 문제 없음 — 인증/인가 예외를 삼키는 경로가 아니며, 이를 회귀 테스트로 고정함.

- **[WARNING] `catch (err instanceof ConflictException)` 가 신규 "표면 불일치"뿐 아니라 기존 일반
  `STATE_MISMATCH`(예: execution 이 이미 completed/failed/cancelled 상태일 때의
  `assertWaiting` 거부)까지 함께 삼킨다 — 의도된 범위보다 넓음**
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:752-759`
  - 상세: `interactionService.interact()` 에서 `ConflictException` 은 두 지점에서 던져진다 —
    (1) `assertWaiting()`: execution 이 애초에 `waiting_for_input` 이 아닐 때(예: 이미
    completed 된 execution 에 지연 도착한 webhook update), (2) `dispatchContinuation()`:
    신규 표면 불일치(publisher §7.5.1 가드). 그러나 catch 블록은 예외 **타입**(`ConflictException`)
    만으로 분기하므로 두 경우를 구분하지 못하고 둘 다 동일하게 warn 로그 한 줄 남기고 202 로
    삼킨다. 주석/plan 문서(§배경, F-2)는 이 graceful 처리의 명시적 근거를 "표면 불일치" 케이스로만
    서술하고 있어("*표면 불일치(409 STATE_MISMATCH)는 graceful*"), 코드의 실제 동작 범위가
    문서화된 의도보다 넓다. 보안 취약점은 아니지만(오히려 5xx→재시도 폭주 방지라는 동일한
    이유로 두 경우 모두 삼키는 편이 안전 측에 가깝다), 향후 `InteractionService.interact()` 에
    (예: idempotency나 다른 목적의) 새로운 `ConflictException` 트리거가 추가될 경우 별도 검토
    없이 자동으로 이 catch 에 포섭되어 조용히 무시될 위험이 있다 — 에러 처리 관점에서
    관측성(observability) 저하 소지.
  - 제안: `err.getResponse()` 의 `error.code === 'STATE_MISMATCH'` 확인까지는 이미 사실상
    보장되지만(현재 `interact()` 의 유일한 `ConflictException` 코드가 `STATE_MISMATCH`), 향후
    다른 코드의 `ConflictException` 이 추가될 가능성에 대비해 (a) 코드 값을 명시적으로 좁혀
    매칭하거나 (b) 최소한 plan 문서/주석에 "assertWaiting 유래의 일반 STATE_MISMATCH 도 같은
    catch 로 흡수됨(의도적)"을 명시해 향후 리뷰어가 범위를 재확인하지 않도록 할 것. 차단
    사유는 아님.

- **[INFO] 이번 PR 은 워크플로 무결성 관점의 실질적 결함을 fail-closed 로 교정 — 순보안 개선**
  - 위치: `waiting-surface-guard.ts` 전체, `execution-engine.service.ts` 의
    `assertCommandMatchesWaitingSurface`
  - 상세: 변경 이전에는 인증된(토큰 보유) 호출자가 대기 중인 노드의 실제 interaction 표면과
    무관하게 임의 명령을 publish 할 수 있었고, worker 측 재개 라우팅(`dispatchResumeTurn`)이
    도착 payload 의 `type` 이 아니라 노드 표면만으로 처리기를 선택하는 구조상 이종 명령이
    "조용히" 오처리됐다(form 대기 + `end_conversation` → 빈 폼이 제출된 것처럼 완료,
    buttons 대기 + 비-button 명령 → 엉뚱한 `continue` 포트로 그래프 분기). 이는 인증된
    당사자가 자신의 정상 권한 범위 내에서 워크플로 상태 전이 무결성을 깨뜨릴 수 있는
    business-logic 결함(유사 분류: CWE-841 Improper Enforcement of Behavioral Workflow)이며,
    분기 조작(buttons 케이스)은 조건에 따라 승인/거부 등 민감한 워크플로 로직을 우회하는
    결과로 이어질 수 있어 보안 인접 리스크였다. 신규 가드는 판정 불가 시에도 fail-closed
    로 거부하도록 설계되어(§7.5 자매 게이트 `dispatchResumeTurn` 과 동일 정책), 안전한
    기본값을 택했다. e2e 테스트가 가드 부재 시 실제로 202(재현)·가드 복원 시 409 를
    실증해 vacuous 테스트가 아님을 확인했다.
  - 결론: 발견사항이라기보다 확인 — 이번 diff 는 보안 개선 방향.

- **[INFO] e2e 테스트의 하드코딩 JWT 테스트 시크릿 — 기존 패턴 재확인, 신규 노출 아님**
  - 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts:39-41`
    (`'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7'`)
  - 상세: 이번 diff 는 두 describe 블록에 중복돼 있던 동일 상수를 파일 최상단으로 통합한
    것뿐이며, 같은 리터럴이 `codebase/backend/test/external-interaction.e2e-spec.ts` 에도
    이미 동일하게 존재한다(grep 확인). 주석이 "테스트 전용 시크릿, repo 에 공개됨"임을
    명시하고 `docker-compose.e2e.yml` 값과의 fallback 관계로 문서화돼 있어, 프로덕션 시크릿
    유출이 아닌 의도된 e2e 픽스처다. 신규 노출 아님 — 조치 불요.

- **[INFO] SQL/인젝션·입력 검증**: 신규 코드는 TypeORM `find()`/`findOne()` 의 파라미터화된
  `where` 객체만 사용하고 문자열 결합 SQL 이 없다. `readPersistedInteractionType` 은 `unknown`
  타입 `outputData` 에서 `meta`/`interactionType` 두 고정 키만 안전하게 타입가드로 읽어
  prototype-pollution·임의 키 접근 위험이 없다. `node.type` 기반 `handlerRegistry.getMetadata()`
  조회는 기존 코드베이스 전역에서 이미 쓰이는 동일 패턴(신규 공격면 아님). 문제 없음.

- **[INFO] `plan/in-progress/eia-command-waiting-surface-guard.md` F-1 (nodeId 미검증)은 본 PR
  범위 밖으로 이미 문서화·추적됨 — 실질 위험 낮음**
  - 위치: `interaction.service.ts:385-392` (`assertNodeId`), plan 문서 F-1 절
  - 상세: `assertNodeId` 는 `dto.nodeId` 의 **존재**만 검사하고 실제 대기 노드의 `nodeId` 와
    **일치**하는지는 검사하지 않는다(spec §7.5.1 이 요구하는 "다른 nodeId" 케이스 미검증).
    다만 클라이언트가 보낸 `nodeId` 값 자체는 실제 노드 조회/선택 로직에 쓰이지 않는다 —
    `resolveWaitingNodeExecutionId` 는 항상 서버가 DB 에서 조회한 "현재 WAITING_FOR_INPUT
    행"만을 대상으로 하므로, 클라이언트가 임의 `nodeId` 문자열을 보내도 실제 대상 노드
    선택에는 영향이 없다(신뢰되지 않는 입력이 인가 결정에 쓰이지 않음 — IDOR 아님). 즉
    spec 표현 정합성 갭이지 인가 우회는 아니다. plan 문서가 이미 F-1 로 등재하고 선행 작업
    (chat-channel 실제 nodeId 조회)이 필요함을 명시했으므로 별도 조치 불요, 참고만.

## 요약

두 가지 특정 점검 요청 모두 코드·테스트로 확인됨: (1) 신규 409 거부 경로는 `InvalidExecutionStateError`
의 기존 client-safe/`serverDetail` 분리 아키텍처를 그대로 재사용해 대기 nodeId·노드 타입·판정된
표면을 client 응답에 노출하지 않으며 e2e/unit 테스트로 회귀 고정돼 있다. (2)
`hooks.service.ts` 의 `ConflictException` graceful catch 는 인증/인가 예외가 발생할 수 없는
호출 경로(`InteractionService.interact()` 는 토큰 검증을 하지 않음, 인가는 이전 계층 책임)에
있고 예외 타입도 `STATE_MISMATCH` 계열로 좁혀져 있어 auth 실패를 삼키지 않으며, 이는
"그 외 예외는 그대로 전파" 회귀 테스트로 고정돼 있다. 인젝션·하드코딩 시크릿·암호화·의존성
관점에서도 신규 이슈 없음(e2e JWT 시크릿은 기존 문서화된 test-only 패턴의 재배치일 뿐). 유일한
개선 권고는 WARNING 1건 — chat-channel forwarding 의 `ConflictException` catch 가 타입
기반이라 신규 "표면 불일치" 의도보다 넓게(기존 일반 `STATE_MISMATCH` 도) 삼키는데, 현재는
안전 측 동작이지만 향후 다른 `ConflictException` 트리거 추가 시 관측성 저하 위험이 있어 code
값 명시 매칭 또는 주석 보강을 권고한다. 전반적으로 이번 diff 는 실제 워크플로 무결성 결함을
fail-closed 로 교정하는 보안 개선 성격이 강하다.

## 위험도

LOW
