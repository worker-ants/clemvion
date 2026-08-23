# API 계약(API Contract) 리뷰 — nodeoutput-allowlist

## 검토 범위

`GET /api/external/executions/:id` (`InteractionService.getStatus`)의 waiting `nodeOutput` 응답
필드를 fail-open deny-list(`EXTERNAL_STRIPPED_FIELDS=['llmCalls']`)에서 fail-closed
allowlist(`NODE_OUTPUT_ALLOWED_KEYS`)로 전환하는 변경. 요청 DTO·URL·인증/인가·에러 코드·
페이지네이션은 이번 diff 에서 변경되지 않았다(`git diff origin/main --stat` 로 5개 파일만
변경 확인: `interaction.service.ts`, `interaction.service.spec.ts`,
`strip-external-only-fields.ts`, `strip-external-only-fields.spec.ts`,
`spec/5-system/14-external-interaction-api.md`).

## 발견사항

- **[INFO]** REST(`getStatus`)와 SSE(`toFanoutEnvelope`)가 같은 `nodeOutput` 데이터에 대해
  이제 서로 다른 필터 강도를 적용한다 — REST 는 fail-closed allowlist, SSE/fanout 은 여전히
  fail-open deny-list.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:392` (allowlist 적용 지점), `spec/5-system/14-external-interaction-api.md:1739`(R17 표)
  - 상세: `interaction.service.ts`의 waiting 분기 코드 자체 주석("SSE `waiting_for_input` wire
    payload 와 **동일 형식**")과 실제 필터 강도가 이 PR 이후 어긋난다. 다만 이 비대칭은
    `spec/5-system/14-external-interaction-api.md` §R17 에 새로 추가된 표
    (`getStatus waiting nodeOutput` = fail-closed / `SSE/fanout emit` = fail-open, 잔여)로
    명시적으로 문서화됐고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에
    후속 항목으로 등재돼 있다 — 즉 API 계약 관점의 실제 위험(문서화되지 않은 채 두 채널이
    갈라지는 것)은 이미 이 PR 안에서 해소됐다. 다만 SSE 소비자(chat-channel 어댑터 포함)가
    REST 조회를 폴백으로 쓸 경우 두 응답의 필드 집합이 달라질 수 있다는 점은 클라이언트
    구현자가 인지해야 하는 실질적 API 동작 차이이므로 기록해 둔다.
  - 제안: 별도 조치 불요(이미 spec 반영·후속 트래커 등재됨). SSE allowlist 대칭화 후속 PR
    착수 시 이 비대칭이 해소되는지 재확인.

- **[INFO]** 응답 필드 축소가 하위 호환성에 미치는 영향은 사실상 없음(확인됨) — 검증한 근거를
  기록.
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:138`(`NODE_OUTPUT_ALLOWED_KEYS`), `codebase/channel-web-chat/src/lib/eia-events.ts:32`(`parseWaitingForInput`)
  - 상세: `allowlistNodeOutputKeys`가 최상위 키를 `config`/`output`/`meta`/`port`/`status`
    (핸들러 계약 공개분) + `formConfig`/`conversationConfig`/`buttonConfig`/`interactionType`
    (wire 전용)로 제한한다. 실제 공식 클라이언트(`channel-web-chat`)의 `parseWaitingForInput`이
    top-level 로 읽는 키는 정확히 이 wire 전용 4키 + form 폴백의 `nodeOutput` 자체
    (`config`/`output`/`meta` 형태)뿐이라 직접 대조 확인했다. 이번에 새로 차단되는
    `_retryState`/`_resumeState`는 애초에 `NodeHandlerOutput` 자체 JSDoc 이 "표현식 리졸버·
    UI 자동완성에 노출되지 않게 의도적으로 뒀다"고 명시한 엔진 내부 필드라 공개 계약의 일부였던
    적이 없다. 즉 이번 변경은 형식적으로는 응답 스키마를 좁히는 변경이지만, 문서화되지 않은
    (오히려 의도치 않게 새고 있던) 필드만 제거하므로 실질적인 breaking change 가 아니다.
  - 제안: 없음(확인용 기록). 버전 관리(API 버전 bump)도 불필요 — 표준적인 "미노출 의도 필드의
    유출 차단"으로 분류 가능.

- **[INFO]** `NodeOutputContextDto.nodeOutput`/`ButtonsContextDto.buttonConfig.nodeOutput`은
  Swagger 스키마상 `Record<string, unknown>`(자유 형식)으로 선언돼 있어, allowlist 도입으로
  실제 키 집합이 좁아져도 OpenAPI 문서·타입 선언과 충돌하지 않는다.
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:79,95`
  - 상세: 스키마가 애초에 non-strict 열린 객체로 선언돼 있으므로 이번 필드 축소가 "문서화된
    스키마 위반"을 만들지 않는다. (반대로 이는 Swagger 스키마 자체가 이 필드 집합을 강제하지
    않는다는 뜻이기도 하다 — 계약 준수는 코드 레벨의 컴파일타임 assertion
    (`assertAllowlistCoversHandlerContract`)과 리터럴 대조 테스트가 대신 담당한다는 점을
    설계 의도로 확인.)
  - 제안: 없음.

- **[INFO]** `NODE_OUTPUT_ALLOWED_KEYS`에 포함된 `status` 키는 `ExecutionStatusDto`의
  top-level `status` 필드와 이름이 같지만 의미가 다르다(`context.nodeOutput.status`는
  개별 노드 핸들러의 상태, top-level `status`는 execution 전체 상태).
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:143`
  - 상세: 이건 이번 PR 이 새로 만든 문제가 아니라(이 필드는 종전 deny-list 시절에도 통과되고
    있었다) allowlist 화로 존재가 재확인된 것뿐이다. 클라이언트가 두 `status`를 혼동할 여지가
    이론상 있으나, 두 필드는 서로 다른 JSON 경로(top-level vs `context.nodeOutput`)에 있어
    실제 파싱 충돌 위험은 낮다.
  - 제안: 조치 불요. 향후 API 문서에 `nodeOutput.status`의 의미를 명시하면 혼동을 줄일 수
    있다는 정도의 참고.

## 요약

이번 변경은 요청 DTO·URL·인증/인가·페이지네이션·에러 응답 형식에는 손대지 않고, `GET
/api/external/executions/:id`의 waiting `nodeOutput` 응답 필드만 fail-open deny-list 에서
fail-closed allowlist 로 전환한다. allowlist 는 `NodeHandlerOutput` 공개 키에 컴파일타임으로
결속돼 있고, 실제 공식 클라이언트(`channel-web-chat`)가 top-level 로 읽는 wire 키(`formConfig`/
`conversationConfig`/`buttonConfig`/`interactionType`)와 form 폴백 키(`config`/`output`/
`meta`)를 모두 보존하는 것을 코드 대조로 확인했다. 새로 차단되는 `_retryState`/`_resumeState`는
애초에 문서화된 공개 계약이 아니었던 엔진 내부 필드이므로 실질적인 하위 호환성 파괴가 아니다.
유일하게 주목할 점은 REST 와 SSE/fanout 간 `nodeOutput` 필터 강도가 이 PR 이후 갈라진다는
것인데, 이는 `spec/5-system/14-external-interaction-api.md` §R17 에 표로 명시적으로 문서화되고
후속 트래커에 등재돼 있어 API 계약 관점의 실질 위험은 이미 해소된 상태다. CRITICAL/WARNING 급
계약 위반은 발견되지 않았다.

## 위험도

LOW
