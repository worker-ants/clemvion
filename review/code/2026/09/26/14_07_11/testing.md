# 테스트(Testing) Review

## 배경 — 이번 라운드는 직전 라운드 WARNING 조치의 재검증

`review/code/2026/09/26/13_39_09/testing.md` 가 지적한 **WARNING**("`AssistantSessionDetailDto.messages` 하위 5개 DTO 가 e2e 에서
한 번도 대조되지 않는다")이 이번 diff(`bf1fa96fc`)의 e2e 테스트 H(`codebase/backend/test/workflow-assistant.e2e-spec.ts`)로
조치됐는지, 그리고 같은 커밋의 가드 리팩터(`classifyDecorators` 분리)·triggers 반환 타입 narrowing 이 테스트 관점에서 새 갭을
만들지 않았는지를 중심으로 다시 봤다.

## 발견사항

- **[INFO]** 테스트 H 가 직전 WARNING 을 실효성 있게 닫았다 — 공허하지 않은 근거까지 갖췄다
  - 위치: `codebase/backend/test/workflow-assistant.e2e-spec.ts` — `it('H. 세션 상세 — 메시지(도구 호출 · 계획 · 사용량)까지 응답 DTO 와 맞는다', ...)`
  - 상세: 이 파일은 머리 주석("SSE 스트리밍·LLM 호출 자체는 LLM 의존이라 unit / integration 이 담당")대로 LLM 을 부르지 않으므로,
    `workflow_assistant_message` 행을 `db.query`(raw INSERT)로 직접 넣어 두 끝(선택 키가 전부 빠진 `user` 메시지, 선택 키를
    전부 채운 `assistant` 메시지 — `toolCalls`/`plan`/`usage`/`finishReason`/`autoResumed`/`autoResumeReason`/`autoResumeAttempt`)을
    만든다. 이어서 `GET /sessions/:id` 로 상세를 조회해 `messages.map(m=>m.role)`·`toolCalls`·`plan`·`usage` 를 `toStrictEqual`
    로 먼저 단언한 **뒤에** `assertMatchesContract(detail.body.data, contractForDto(AssistantSessionDetailDto))` 를 부른다 — 넣은
    모양이 그대로 왔는지 먼저 확인해 대조가 "빈 배열이라 통과했을 뿐" 인 공허한 GREEN 이 아님을 보장한다(`feedback_vacuous_test_three_shapes`
    가 지적하는 실패 형태를 피함). 삽입에 쓴 컬럼명(`tool_calls`/`plan`/`usage`/`finish_reason`/`auto_resumed`/`auto_resume_reason`/
    `auto_resume_attempt`)도 엔티티(`workflow-assistant-message.entity.ts`)의 `@Column({ name: ... })` 과 대조해 정확히 일치함을
    확인했다. `title: null` 로 세션을 만들어(제목 없이 생성) INFO11(직전 라운드)까지 함께 닫는다.
  - 참고: 조치 불필요 — 신규 문제 없음, 회귀 방지력 확인용 기록.

- **[INFO]** 가드 리팩터(`classifyDecorators` 분리)는 뮤테이션 커버리지를 유지했고, 새 분기(리다이렉트 두 경로)도 전용 fixture · 전용 `it()` 로 갈라 잡는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts`(`classifyDecorators`/`judgeHandler`),
    `codebase/backend/src/repo-guards/__tests__/http-status-advertised.spec.ts`(`'성공 응답을 하나도 광고하지 않는 자리를 잡는다'`,
    `'리다이렉트만 광고한 라우트는 2xx 짝을 대조하지 않는다'`), `plan/in-progress/success-advert.md` 뮤턴트 표(리팩터 후 S1~S7, 8/8 KILLED)
  - 상세: `judgeHandler` 에서 데코레이터 순회 로직을 순수 함수 `classifyDecorators`(비-export)로 떼어냈는데, 이 함수 자체를 겨냥한
    단위 테스트는 없다 — 기존에도 `judgeHandler` 자체가 직접 단위 테스트되지 않고 `scanHttpStatusAdvertised` 를 통한 통합
    테스트 + 대조군 fixture(`sample.controller.ts`)로만 검증되는 이 파일의 기존 관례를 그대로 따른 것이라 새로운 결함은
    아니다. 대조군 fixture 에 `getRedirect`(`@ApiFoundResponse`)·`getRedirectViaApiResponse`(`@ApiResponse({ status: 302 })`)
    두 자리가 추가돼 `@ApiResponse` 분기와 이름 표 분기가 공유하게 된 헬퍼 `advertise()` 를 각각 따로 죽이는지 뮤턴트
    표(S3a/S3b)로 갈라 확인했다 — 헬퍼 공유가 두 분기 중 하나만 죽이는 뮤턴트를 숨기지 않음을 실측으로 보였다.
  - 참고: 조치 불필요.

- **[INFO]** `ApiOkWrappedNullableResponse` 의 핵심 동작(`data: null`)이 이 라우트에서 실제 null 응답으로 e2e 대조된 적은 없다
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` `latest()`(`@ApiOkWrappedNullableResponse(AssistantSessionDto, ...)`),
    `codebase/backend/test/workflow-assistant.e2e-spec.ts` `it('F. sessions/latest ...')`
  - 상세: 테스트 F 는 조회 직전에 같은 `workflowId` 로 세션을 새로 만들어 두므로 `latest` 응답은 사실상 항상 "찾음"(`status===200`
    이고 `data` 가 객체) 분기를 타고, `assertMatchesContract` 도 그 분기 안에서만 호출된다 — `data: null` 로 실제 응답이 오는
    경로는 이 PR 의 어떤 e2e 도 실행하지 않는다. `latest.status` 를 `[200, 204, 405, 404]`(실측: `[200, 204, 404]`)로 넓게
    허용하는 것도 이 컨트롤러가 항상 200(Nest 기본 GET 값, `@HttpCode` 없음)만 낼 수 있는 구현과 맞지 않아 — 만약 실제로
    `data` 가 `null` 로 온다면 그 분기(`if (latest.status === 200)`)를 그대로 타면서 `latest.body.data?.id` 를 `toBeDefined()`
    로 확인하는데 `null?.id === undefined` 라 그 단언이 실패한다(이 테스트는 이 PR 이 새로 만든 것이 아니라 기존 파일에
    `assertMatchesContract` 두 줄만 추가한 것이라, 이 잠재적 취약함 자체는 이 PR 의 신규 결함이 아니다). 다만 이 PR 의
    산출물인 `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse` 가 "wire 로 `data: null` 이 실제로 나가는가" 를 이
    라우트에서 증명하는 자동화 테스트는 여전히 없다 — 스키마 모양 자체는 `api-wrapped.spec.ts`(단위, `toStrictEqual`)가,
    범용 null 래핑 동작은 `transform.interceptor.spec.ts`(`should wrap null in { data: null }`, 기존)가 각각 따로 보증하므로
    조합 리스크는 낮지만, "이 특정 라우트의 null 분기"를 직접 때리는 e2e 는 없다.
  - 제안: 급하지 않음 — `workflowId` 를 방금 만든 워크플로우가 아니라 세션이 아예 없는 새 워크플로우로 질의하는 케이스를
    하나 추가하면(`status` 를 `200` 하나로 좁히고 `expect(latest.body.data).toBeNull()`), 이 라우트의 null 분기를 직접
    실증하면서 위 `[200,204,404]` 관용도 함께 정리(엄격화)할 수 있다.

- **[INFO]** `AssistantToolCallDto` 의 선택적 필드(`result`/`planStepId`/`planStepIds`/`signature`)가 "키 생략" 방향으로는
  이번 신규 e2e 에서 대조되지 않는다 — 항상 "전부 채움" 변형만 삽입
  - 위치: `codebase/backend/test/workflow-assistant.e2e-spec.ts` 테스트 H(`toolCalls` 배열 리터럴), `codebase/backend/src/modules/workflow-assistant/dto/responses/assistant-session-response.dto.ts` `AssistantToolCallDto`
  - 상세: 테스트 H 의 `user` 메시지는 `toolCalls` 자체가 `null`(최상위 nullable 경로는 검증)이고, `assistant` 메시지의
    `toolCalls[0]` 은 `result`·`planStepId`·`planStepIds`·`signature` 를 모두 채운 값이다. `assertMatchesContract` 의 "required
    아님(키 생략형) → 키가 없어도 된다" 판정 자체는 이 DTO 만 놓고 보면 이번 PR 로 처음 실행되는 것이라, 이 네 필드가 실제로
    "결과 미기록"·"서명 없음" 등으로 **키 자체가 빠진** 실제 응답에서도 계약대로 통과하는지는 아직 이 e2e 로 실증되지 않았다.
  - 제안: 급하지 않음 — 값 검사기의 "키 생략 허용" 로직 자체는 이 DTO 전용이 아니라 `visit()` 공용 로직이고 이미 최상위
    `content: string | null`(그 자체는 nullable, 다른 optional 필드는 별도) 등 다른 지점에서 간접적으로 단련됐다. 여유가
    있을 때 두 번째 `tool_calls` 행(선택 키를 하나도 안 채운 최소 형태)을 추가하면 이 DTO 에 대해서도 양방향을 직접 실증할
    수 있다.

## 회귀 확인

- `http-status-advertised.spec.ts` — 기존 통과 케이스(위반 6곳, 대조 제외 자리)는 이번 diff 로 로직이 이동만 됐을 뿐 그대로
  유지되고, `judgeHandler` 반환 타입에 `unadvertised` 필드가 추가됐지만 기존 소비자(같은 spec)는 필드별 접근만 하므로
  `toEqual` 전체비교 깨짐 없음.
- `triggers.controller.ts` 두 핸들러의 반환 타입을 `Promise<NotificationRotateSecretDto>`/`Promise<InteractionRevokeTokenDto>`
  로 좁혔지만 `TriggersService` 쪽 두 메서드는 여전히 인라인 리터럴 타입(`Promise<{ secret: string; rotatedAt: string }>` 등)을
  반환한다 — 구조적 타이핑이라 지금은 컴파일이 통과하고, 컨트롤러 경계에서 필드가 늘거나 줄면 `tsc` 가 여전히 그 반환문에서
  잡아낸다. e2e(`advertised-response-contract.e2e-spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`)가 wire 를 별도로
  `assertMatchesContract` 로 실측하므로 테스트 관점의 안전망은 유지된다(이 서비스 레벨 narrowing 은 API 계약 리뷰어가 이미
  INFO 로 별도 기록했다 — 테스트 커버리지 문제는 아님).

## 요약

직전 라운드(`13_39_09`)의 유일한 테스트 WARNING(메시지 하위 5개 DTO 가 e2e 에서 대조되지 않음)은 이번 diff 의 테스트 H 로
견고하게 닫혔다 — DB 직접 삽입으로 두 극단(빈 값·꽉 찬 값)을 만들고, 계약 대조 전에 `toStrictEqual` 로 삽입값이 그대로
왕복했는지 먼저 확인해 공허한 통과가 아님을 실증했다. 같은 diff 의 가드 리팩터(`classifyDecorators` 분리)도 뮤테이션
표(8/8 KILLED, 리다이렉트 두 분기를 S3a/S3b 로 갈라 따로 확인)로 판정이 바뀌지 않았음을 증명했다. 남은 갭은 모두 INFO
수준이다 — `ApiOkWrappedNullableResponse` 의 실제 `data: null` wire 응답이 `sessions/latest` 라우트에서 e2e 로 직접
실증된 적이 없고(구성 요소별 단위 테스트로 조합 리스크는 낮음), `AssistantToolCallDto` 의 선택 필드가 "키 생략" 방향으로는
아직 대조되지 않았다. 둘 다 차단 사유가 아니며 여유가 있을 때 각 한 줄씩 보강하면 된다.

## 위험도

LOW
