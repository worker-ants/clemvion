# 보안(Security) 코드 리뷰 — EIA/WS 대기 노드 표면 매트릭스 가드

검토 대상: `waiting-surface-guard.ts`(신규) + `execution-engine.service.ts`
(`resolveWaitingNodeExecutionId`/`assertCommandMatchesWaitingSurface` 확장) +
`hooks.service.ts`(`forwardToInteractionService` graceful catch, `readErrorBody`
신설) + `interaction.controller/service.ts`(문서 주석) + 관련 테스트/plan.

지시받은 3가지 집중 항목을 중심으로 실제 소스(`codebase/backend/src/...`)를
직접 읽어 검증했다 (prompt 의 diff 가 execution-engine.service.ts 는 크기 제한으로
생략돼 있어 현재 워킹트리 파일을 직접 확인).

## 발견사항

- **[INFO]** 신규 raw SQL fragment — injection 안전 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5201-5204`
    (`resolveWaitingNodeExecutionId` 내 `.addSelect(...)`)
  - 상세: `COALESCE(ne.output_data -> 'meta' ->> 'interactionType', ne.output_data ->> 'interactionType')`
    는 컬럼명·JSON 키(`'meta'`, `'interactionType'`)가 모두 컴파일타임 고정 리터럴이며 어떤
    변수(사용자 입력·`executionId`·`row.nodeType` 등)도 문자열로 보간(interpolate)되지 않는다.
    같은 쿼리의 유일한 동적 값인 `executionId` 는 `.where('ne.execution_id = :executionId', { executionId })`
    로 TypeORM QueryBuilder named-parameter 를 통해 바인딩되므로 파라미터화가 유지된다.
    `.andWhere('ne.status = :status', {...})` 도 동일. SQL 인젝션 벡터 없음.
  - 제안: 없음 (안전 확인). 참고로 이 fragment 는 `readPersistedInteractionType`(TS)과
    동일 규칙(`meta.interactionType` 우선, legacy flat root fallback)을 SQL 로 미러링한
    것이며, 이 이중 구현 자체는 별건(architecture reviewer 가 이미 triplication 으로 지적)
    이라 보안 범위 밖.

- **[INFO]** `readErrorBody` 로그 — client 미노출 확인, 사용자 입력 로그 인젝션 없음
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `readErrorBody`(파일 하단
    신규 헬퍼), `forwardToInteractionService` catch 블록 (~L758-771)
  - 상세: `readErrorBody(err)` 가 읽는 `err.getResponse()` 는 `interactionService.interact()`
    가 던진 `ConflictException` 의 응답 body 이며, catch 블록은 이를 오직
    `this.logger.warn(...)` 인자로만 사용하고 **HTTP 응답으로 되돌리지 않는다** — 해당 분기는
    `return;` 으로 끝나 `handleWebhook` 의 리턴값(웹훅 ack)에 이 문자열이 전혀 섞이지 않는다.
    즉 client(webhook provider) 에 유출 경로 없음, 서버 로그 전용으로 확인됨.
    로그 인젝션 관점: 보간되는 값은 `dto.command`(고정 리터럴 `'submit_message'`/`'click_button'`
    둘 중 하나, 사용자 입력 아님), `executionId`/`trigger.id`(서버가 발급한 내부 UUID),
    `conflict.message`(추적 결과 아래 참고) 뿐이며, 사용자가 보낸 자유 텍스트(`update.command.text`,
    `dto.message`)는 이 로그 라인에 전혀 포함되지 않는다 — CRLF/제어문자 삽입을 통한 로그 위조
    (log forging) 벡터 없음.
    `conflict.message` 의 실제 출처를 추적하면: `dispatchContinuation`(`interaction.service.ts:414-417`)
    이 `InvalidExecutionStateError` 를 `{error:{code:'STATE_MISMATCH', message: err.message}}` 로
    감싸는데, `InvalidExecutionStateError` 는 `super('Execution is not waiting for input.', detail)`
    (`workflow-errors.ts:117`)로 **client-safe 고정 문자열**만 `message` 로, 진단 상세는
    `serverDetail`(client 응답에 절대 포함 안 됨)로 분리하는 기존 계약을 따른다. 따라서
    `conflict.message` 도 사용자 입력이 아니라 개발자가 하드코딩한 고정 문자열이다.
  - 부가 관찰(비-보안, 참고용): `assertWaiting()` 경유 STATE_MISMATCH(`interaction.service.ts:440-449`)
    는 `Execution is not waiting for input (current=${execution.status})` 로 실제 상태값을
    포함해 다양하지만, 이번 표면 불일치 케이스가 타는 `InvalidExecutionStateError` 경로는
    원인(0건/다중행/표면불일치)과 무관하게 **항상 동일한 고정 문자열**이라 `readErrorBody` 도입
    취지("`err.message` 대신 실제 진단 메시지를 로깅")가 이 특정 케이스에서는 완전히
    달성되지 않는다(원인 구분이 로그에 안 남음). 그러나 이는 정보 노출이 아니라 오히려
    client-safe 고정 메시지 설계의 **의도된 결과**이므로 보안 결함은 아니다 — 운영 관측성
    (observability) 관점의 개선 여지로만 기록. `handleWebhook` unit 테스트(`hooks.service.spec.ts`)가
    `'surface mismatch'` 라는 임의 메시지로 mock 하고 있어 이 정적 문자열 특성이 회귀 테스트로는
    드러나지 않는 점도 참고.

- **[INFO]** hooks catch 좁힘(`STATE_MISMATCH` 코드만 삼킴) — 인증/인가 예외 전파 확인
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts::forwardToInteractionService`
    catch 블록 (~L760-771)
  - 상세: 판정 로직은 `err instanceof ConflictException ? readErrorBody(err) : undefined` →
    `conflict?.code === 'STATE_MISMATCH'` 일 때만 warn 후 `return`(swallow), 그 외 **모든** 경우
    (ConflictException 이 아닌 예외, 또는 ConflictException 이지만 다른 code)는 `throw err;` 로
    무조건 재전파한다 — allowlist 형태가 아니라 정확히 한 조건만 예외적으로 삼키는 방식이라
    fail-safe(기본은 전파, 예외적으로만 흡수)이다.
    이 호출 경로(`InteractionService.interact()`, `scope: 'in_process_trusted'`)에서 실제로
    인증/인가 예외가 던져질 수 있는지 소스를 추적: `interact()` 의 `submit_message`/`click_button`
    분기(`interaction.service.ts:90-171`)는 `assertNodeId`(BadRequestException) →
    `assertWaiting`(ConflictException/STATE_MISMATCH) → `dispatchContinuation`
    (ConflictException/STATE_MISMATCH, 또는 `MessageTooLongError`→400, `FormValidationError`→400,
    그 외는 원본 그대로 rethrow) 순으로만 예외를 던지며, `ForbiddenException`/
    `UnauthorizedException` 은 이 코드 경로에 전혀 존재하지 않는다(`ForbiddenException` 은
    `refreshToken()` 의 `TOKEN_REFRESH_FORBIDDEN` 케이스 하나뿐이며 `interact()` 와 무관).
    토큰 검증(`InteractionGuard`)은 HTTP controller 계층에서만 수행되고, `forwardToInteractionService`
    는 컨트롤러/가드를 우회해 서비스 메서드를 직접 호출하는 **의도된** in-process trusted 경로
    (`scope:'in_process_trusted'`, JSDoc 에 "token 검증 우회" 로 명시)라 애초에 이 지점에서
    Guard 예외가 발생할 수 없다. 실제 인증(webhook 서명 검증)은 이보다 훨씬 앞단
    (`hooks.service.ts` 상위, `chatChannelInboundAuthenticator.verify`, raw body 단계)에서 이미
    완료되어 있고 이 diff 는 그 경로를 변경하지 않는다.
    결론: 오늘 코드베이스에서 이 catch 가 인증/인가류 예외를 삼길 가능성은 없으며, 설령
    향후 이 호출 경로에 인증/인가 예외가 추가되더라도 narrow 판정(`code==='STATE_MISMATCH'`)
    구조상 자동으로 재전파된다(허용 리스트가 아니라 거부 리스트 방식이 아니므로 fail-open
    확장 위험도 없음 — 오직 `ConflictException`+`STATE_MISMATCH` 정확히 일치하는 경우만 흡수).
  - 제안: 없음 (안전 확인). SUMMARY.md 의 INFO #20(`review/code/2026/07/11/00_03_25/SUMMARY.md`)
    이 이미 동일 결론에 도달했고, 본 리뷰가 실제 코드 추적으로 독립 재확인함.

- **[정보 확인 — 문제 없음]** 클라이언트 응답 정보 노출 없음 — e2e 로 실증됨
  - 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts:307-309`
    (`expect(JSON.stringify(rejected.body)).not.toContain(form.id)`)
  - 상세: 표면 불일치 409 응답 body 에 대기 중인 실제 `nodeId` 가 노출되지 않음을 e2e 테스트가
    실 Postgres 대상으로 직접 검증한다. `InvalidExecutionStateError`/`ExecutionError` 계층의
    `serverDetail` 분리 설계(§7.5.2)가 신규 표면 검증 경로에도 그대로 적용됨을 확인.

- **[정보 확인 — 문제 없음]** 하드코딩 시크릿 / 인가 우회 / 암호화 관련 이슈 없음
  - 상세: 본 diff 범위(waiting-surface-guard.ts, execution-engine.service.ts 확장,
    hooks.service.ts catch 개선, interaction.controller/service.ts 문서 주석, 관련
    unit/e2e 테스트, plan/CHANGELOG 문서)에는 API 키·비밀번호·토큰 등 하드코딩된 시크릿이
    없다. 인증/인가 로직(`InteractionGuard`, 토큰 검증, `in_process_trusted` scope)은
    변경되지 않았고 새 검증 단계(`assertCommandMatchesWaitingSurface`)는 기존 인가 체크를
    대체·우회하는 것이 아니라 그 **이후에** 추가되는 순수 상태 검증이라 인가 약화 위험 없음.
    해시/암호화 알고리즘 변경 없음, 평문 전송 관련 변경 없음.

## 요약

지시받은 3가지 집중 항목을 소스코드 직접 추적으로 검증한 결과 모두 안전하다. (1) 신규
`COALESCE(ne.output_data -> 'meta' ->> 'interactionType', ...)` SQL fragment 는 어떤 변수도
보간하지 않는 완전한 고정 리터럴이며, 유일한 동적 값인 `executionId`는 TypeORM named
parameter 로 파라미터화돼 있어 SQL 인젝션 벡터가 없다. (2) `readErrorBody` 가 추출하는
`error.message` 는 client 응답으로 절대 반환되지 않고(catch 분기가 `return`으로 끝나 로그만
남김) 오직 서버 로그(`logger.warn`)로만 흐르며, 그 값 자체도 `InvalidExecutionStateError` 의
client-safe 고정 문자열이지 사용자 자유 텍스트가 아니라 로그 인젝션(CRLF 삽입 등) 벡터도 없다
— 다만 이 고정 문자열 특성 때문에 "표면 불일치" 원인의 세부 진단 가치는 제한적이라는 점을
관측성 관점 참고사항으로만 남긴다(보안 결함 아님). (3) hooks catch 는 `ConflictException` +
`error.code==='STATE_MISMATCH'` 정확 일치일 때만 흡수하고 그 외 전부(다른 409 사유 포함) 재전파하는
fail-safe 구조이며, 이 호출 경로(`InteractionService.interact()`, `in_process_trusted` scope)는
애초에 인증/인가 예외를 던지지 않도록 설계돼 있어(토큰 검증은 Guard 계층에서만 수행, 웹훅
서명 검증은 이보다 앞단에서 완료) 인증/인가류 예외를 삼길 실질적 경로가 없다. 그 외 범위에서도
하드코딩 시크릿, 인가 우회, 안전하지 않은 암호화 등은 발견되지 않았다.

## 위험도

NONE
