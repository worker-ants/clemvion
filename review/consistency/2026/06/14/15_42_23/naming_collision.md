### 발견사항

- **[WARNING]** `TOKEN_EXPIRED` / `TOKEN_INVALID` — 기존 인증 도메인 코드와 의미 범위 겹침
  - target 신규 식별자: `TOKEN_EXPIRED`, `TOKEN_INVALID` (EIA §5.1 에러 표, 401 응답)
  - 기존 사용처: `/spec/5-system/3-error-handling.md` §1.4 표 (`TOKEN_EXPIRED` = Access Token 만료, `TOKEN_INVALID` = refresh 토큰 변조/형식 오류/소유자 부재); `/spec/data-flow/2-auth.md` §1.4 Refresh 흐름; `codebase/backend/src/modules/auth/auth.service.ts` (JWT access token 계층에서 동일 문자열 사용)
  - 상세: 기존 `TOKEN_EXPIRED`/`TOKEN_INVALID` 는 워크스페이스 JWT(access/refresh) 만료·무효 에러 코드로 정착되어 있다. EIA가 interaction 토큰(`iext_*`/`itk_*`) 검증 실패에 동일 코드를 재사용한다. 의미가 유사하므로 오작동 충돌은 없지만, 토큰 도메인이 다르다(워크스페이스 JWT vs interaction JWT). `/spec/1-data-model.md` 에 이미 "JWT 만료 REST 에러 `TOKEN_EXPIRED`·WebSocket 이벤트 `auth.token_expired`와 표기가 유사하나 별개 네임스페이스" 라는 경고 주석이 존재한다.
  - 제안: target이 의도적으로 동일 코드명을 사용한 것은 surface-level 일관성 측면에서 합리적이다. 단 `/spec/5-system/3-error-handling.md` §1.4 표에 "EIA(`/api/external/*`) 에서도 동일 코드를 interaction 토큰 실패에 사용" 한다는 주석을 추가해 네임스페이스 혼동을 명시 예방하는 것이 권장된다. 기존 인증 흐름과 완전히 별개 HTTP prefix(`/api/external/`)이므로 런타임 충돌은 없다.

- **[WARNING]** `VALIDATION_FAILED` — 기존 `VALIDATION_ERROR` 와 유사명 혼용
  - target 신규 식별자: `VALIDATION_FAILED` (EIA §5.1 에러 표, `submit_form` 필드 검증 실패 시 400)
  - 기존 사용처: `/spec/5-system/2-api-convention.md` §5.3 — 400 기본 코드는 `VALIDATION_ERROR`; `codebase/backend/src/common/filters/http-exception.filter.ts` — 필터가 400을 `VALIDATION_ERROR`로 정규화; `/spec/4-nodes/1-logic/9-foreach.md` §4.2 에서도 `VALIDATION_FAILED` 가 ForEach 내부 에러 payload에 등장
  - 상세: API 규약 표준 에러 코드는 `VALIDATION_ERROR` (400). EIA는 form 필드 검증 실패에 `VALIDATION_FAILED`를 신규 사용한다. ForEach spec에서도 `VALIDATION_FAILED`가 사용되지만 그것은 노드 내부 출력 payload의 `error.code` 필드이며, HTTP response 에러 코드와 레이어가 다르다. 그러나 HTTP layer에서 `VALIDATION_ERROR` 와 `VALIDATION_FAILED` 두 코드가 공존하면 클라이언트가 어느 엔드포인트에서 어느 코드를 기대해야 하는지 혼란이 생긴다.
  - 제안: target의 `VALIDATION_FAILED` 선택은 EIA가 "EIA 전용 공개 API 표면은 API 규약 내부 코드와 표면별 코드명을 분리한다" (R13 원칙의 확장) 라는 논리에 기반한다. 이 의도를 `/spec/5-system/2-api-convention.md` 또는 `/spec/conventions/error-codes.md` 에 "EIA external endpoint는 `VALIDATION_FAILED`를 사용하며 이는 의도적 별도 표기" 로 명시하면 혼동을 차단할 수 있다.

- **[WARNING]** `EXECUTION_NOT_FOUND` — 기존 AI Assistant / Background 노드 사용처와 의미 미세 차이
  - target 신규 식별자: `EXECUTION_NOT_FOUND` (EIA §5.1 에러 표, 404 — executionId 없음)
  - 기존 사용처: `/spec/3-workflow-editor/4-ai-assistant.md` §4.2/§5.4 — workspace 경계 밖 포함 통합 처리; `/spec/4-nodes/1-logic/12-background.md` §5.3 — `executionId` 부재 또는 워크스페이스 mismatch; `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts`
  - 상세: 기존 용례에서 `EXECUTION_NOT_FOUND`는 "미존재 OR workspace 경계 밖"을 동일 코드로 처리해 IDOR 정보 누출을 막는다. EIA §5.1 에서는 단순 "executionId 없음"으로 정의한다. EIA에서는 interaction token 자체가 executionId-scoped이므로 workspace 경계 침범이 `TOKEN_SCOPE_MISMATCH`(401)로 별도 처리되어 실질적으로 같은 보안 결과가 나온다. 그러나 코드 문자열은 동일하고 의미 범위가 다르다는 점에서 문서 독자가 혼동할 수 있다.
  - 제안: EIA §5.1 에러 표에 "워크스페이스 경계 위반은 interaction token 인증 단계에서 `TOKEN_SCOPE_MISMATCH`(401)로 먼저 걸러지므로, 본 404는 순수 미존재 케이스만 해당" 주석 추가를 권장한다.

- **[INFO]** `EIA-RL-06` ID — 목록 §3.4 에서의 부여와 §9.3 재사용
  - target 신규 식별자: `EIA-RL-06` (§3.4 신뢰성·일관성 표, terminal revoke at-least-once)
  - 기존 사용처: 동일 target 문서 내부에서 일관 재참조, `/spec/data-flow/15-external-interaction.md` 참조. 타 spec에 동일 ID 없음.
  - 상세: 충돌 없음.
  - 제안: 없음.

- **[INFO]** `execution.replay_unavailable` SSE 이벤트명 — WS의 `replay.unavailable`과 네임스페이스 분리 의도
  - target 신규 식별자: `execution.replay_unavailable` (SSE 이벤트 이름)
  - 기존 사용처: `/spec/5-system/6-websocket-protocol.md` §4.1 이벤트 표 — `replay.unavailable` (WS 이벤트명, 다른 prefix)
  - 상세: target 문서 §5.2 와 §11 매핑 표에서 WS의 `replay.unavailable`과 SSE의 `execution.replay_unavailable`이 다른 이름임을 명시적으로 설명하고 있어 충돌이 아닌 의도적 분리로 처리됨.
  - 제안: 없음.

- **[INFO]** `interaction-token` Swagger Bearer scheme 이름
  - target 신규 식별자: `interaction-token` (§10.1 Swagger Bearer scheme 이름)
  - 기존 사용처: `/spec/conventions/swagger.md` §2-1 — 이미 `interaction-token` scheme 등록을 명시; `codebase/backend/src/main.ts` — 이미 등록됨
  - 상세: 충돌 없음. 기존 Swagger 규약과 이미 정합.
  - 제안: 없음.

- **[INFO]** `notification_health` / `notificationHealth` 컬럼 — `chat_channel_health`와 enum 중복
  - target 신규 식별자: `notification_health` 컬럼 (§7.1 Trigger 엔티티 확장 SQL)
  - 기존 사용처: `/spec/1-data-model.md` §2.8 — `chat_channel_health` 컬럼이 이미 존재하며 "향후 공용 DB 타입 통합 검토" 주석; `/spec/5-system/15-chat-channel.md` §4.2
  - 상세: 이름이 다르고 컬럼도 분리되므로 충돌 없음. 기존 spec이 이미 인지하고 "향후 통합 검토" 로 표기.
  - 제안: 없음 (기존 spec에서 이미 인지됨).

---

### 요약

target 문서(`spec/5-system/14-external-interaction-api.md`)가 도입하는 신규 식별자 중 런타임 충돌을 유발하는 항목은 발견되지 않는다. 주요 위험은 명명 차원의 혼동 가능성이다. 가장 주의할 두 가지는 (1) `TOKEN_EXPIRED`/`TOKEN_INVALID` 가 기존 워크스페이스 JWT 계층과 동일 문자열을 interaction 토큰 실패에 재사용해 네임스페이스 경계가 문서상 불명확하다는 점, (2) `VALIDATION_FAILED` 가 API 규약 표준 코드 `VALIDATION_ERROR` 와 유사하지만 다른 문자열을 EIA 전용으로 사용해 혼동 가능성이 존재한다는 점이다. API 경로는 `/api/external/` prefix로 완전히 분리되어 있고, 요구사항 ID prefix(EIA-NX/IN/AU/RL/NF)는 코퍼스 전반에서 신규이며, 엔티티명(`ExecutionToken`, `InteractionRequestContext` 등)도 기존 코드베이스에서 중복 없이 사용 중이다. 파일 경로 `spec/5-system/14-external-interaction-api.md`는 컨벤션상 올바른 자리에 신규 생성되어 기존 파일과 겹치지 않는다.

### 위험도

LOW
