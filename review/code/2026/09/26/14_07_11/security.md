# 보안(Security) 리뷰 — success-advert (OpenAPI 성공 응답 스키마 광고 11곳 + 가드 강화, 2R)

## 범위 요약

이번 diff 는 CHANGELOG·spec draft·plan·이전 라운드(`review/code/2026/09/26/13_39_09/**`, `review/consistency/2026/09/26/{13_07_11,13_17_19}/**`) 산출물을 제외하면 실질적으로 다음 세 축뿐이다.

1. 성공 응답을 광고하지 않던 11개 라우트(WebAuthn availability·credential 삭제, triggers notification-secret 회전·interaction-token 재발급, workflow-assistant 세션 CRUD 6개, EIA SSE)에 `@ApiOkWrappedResponse` 계열 데코레이터 + 신규 DTO 부착.
2. `http-status-advertised-guard.ts` 에 "성공 응답을 하나도 광고하지 않는 라우트" 판정(`unadvertised`)과 3xx(redirect) 예외 축 추가 — 이 파일과 fixture(`sample.controller.ts`)는 `src/modules` 스캔 루트 밖의 CI/테스트 전용 코드로, 런타임에 마운트되지 않는다(`grep -rn "HttpStatusAdvertisedFixtureController" codebase/backend/src`로 프로덕션 모듈 등록 0건 확인).
3. 새 DTO 를 실제 wire 와 대조하는 e2e(`advertised-response-contract.e2e-spec.ts` 신설, `workflow-assistant.e2e-spec.ts`/`chat-channel-trigger-create.e2e-spec.ts` 확장).

컨트롤러·서비스의 인증/인가/입력 검증/암호화 로직 파일은 이번 diff 에 없다 — `git diff origin/main --stat` 대상에 `*.service.ts`, guard 클래스가 없음을 확인했고, 각 컨트롤러를 직접 열어 `@Roles`/`@WorkspaceId`/`@CurrentUser`/`@Public`/`@UseGuards` 가 diff 전후 동일함을 확인했다(`webauthn.controller.ts`, `triggers.controller.ts`, `workflow-assistant.controller.ts`).

## 발견사항

- **[INFO]** 평문 1회성 secret 발급 엔드포인트 두 곳의 응답 필드가 OpenAPI 문서에 처음 공식 노출된다
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-secret-issue-response.dto.ts` (`NotificationRotateSecretDto.secret`, `InteractionRevokeTokenDto.token`), 연결부 `codebase/backend/src/modules/triggers/triggers.controller.ts` (`rotateNotificationSecret`, `revokePerTriggerToken`)
  - 상세: `POST /api/triggers/:id/notification/rotate-secret` · `POST /api/triggers/:id/interaction/revoke-token` 은 이전부터 평문 secret/token 을 응답 바디에 실어 왔다(로직 미변경, `git diff` 로 `triggers.service.ts` 무변경 확인). 이번 PR 은 필드명·타입만 OpenAPI 스키마로 공식화한다. 값 자체는 노출되지 않고 "이 엔드포인트가 평문 secret 을 되돌려준다"는 사실이 Swagger 문서에 드러나는 정도다. `main.ts` 의 `isSwaggerEnabled` 가 production 에서 Swagger 마운트를 기본적으로 막는 fail-closed 안전장치가 있어(이번 diff 로 변경되지 않음) 실질 노출 범위는 dev/staging 문서 열람자로 제한된다. 두 엔드포인트 모두 `@Roles('editor')` + `@WorkspaceId()` 스코프가 diff 전후 동일하게 유지된다(`triggers.controller.ts` 확인).
  - 제안: 기존 위험 수용 범위와 동일하므로 즉시 조치 불필요. 신규 관찰이 아니라 이전 라운드(`review/code/2026/09/26/13_39_09/security.md`)와 동일 결론.

- **[INFO]** `AssistantToolCallDto.arguments`/`result` 가 `additionalProperties: true` 로 완전히 열린 스키마로 광고된다
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/responses/assistant-session-response.dto.ts` (`AssistantToolCallDto` 클래스, `arguments`/`result` 필드)
  - 상세: 도구별 인자/결과 모양이 제각각이라 의도적으로 연 설계다(파일 내 주석이 §1-4 SoT 이중화 회피 근거를 명시). 이 diff 는 서버 검증 로직을 바꾸지 않으므로 새 취약점은 아니다. 다만 이 값을 그대로 HTML 로 렌더링하는 프런트 경로가 있다면 그쪽에 별도 XSS 이스케이프 검증이 필요하다(본 diff 범위 밖, 프런트 코드 변경 없음).
  - 제안: 조치 불필요(설계 의도, 이전 라운드와 동일 결론).

- **[INFO]** 신규 e2e(`advertised-response-contract.e2e-spec.ts`)의 DB 원시 쿼리는 파라미터 바인딩을 쓴다 — 인젝션 벡터 없음
  - 위치: `codebase/backend/test/advertised-response-contract.e2e-spec.ts` (`afterAll` 의 `DELETE FROM trigger WHERE id = $1`), `codebase/backend/test/workflow-assistant.e2e-spec.ts` (테스트 H 의 `INSERT INTO workflow_assistant_message ... VALUES ($1, ...)`)
  - 상세: 모든 raw SQL 이 `$1`/`$2` 파라미터 바인딩을 쓰고, 값도 테스트가 직접 만든 상수/UUID/JSON.stringify 결과이지 외부 입력이 아니다. 확인 목적의 기록이며 결함 아님.
  - 제안: 없음.

## 점검 관점별 확인 — 문제 없음

1. **인젝션** — 이번 diff 에 SQL/커맨드/경로 인젝션에 해당하는 신규 입력 처리 코드가 없다. 전부 데코레이터·DTO 선언·정적 AST 스캔(`http-status-advertised-guard.ts`, 저장소 자신의 `.controller.ts` 만 읽음, 외부/사용자 입력 없음)이다.
2. **하드코딩된 시크릿** — DTO `@ApiProperty({ example: ... })` 값은 전부 플레이스홀더(`'itk_...'`, `'2026-09-26T03:14:00.000Z'` 등). 실제 자격증명·API 키 없음.
3. **인증/인가** — `webauthnAvailability()` 는 diff 전후 `@Public()` 유지(플래그 boolean 하나만 반환, 민감정보 없음). 나머지 신규 광고 대상 엔드포인트의 `@UseGuards`/`@Roles`/`@WorkspaceId`/`@CurrentUser`/`@ApiBearerAuth` 는 모두 diff 이전과 동일 — 변경분은 Swagger 데코레이터·반환 타입 표기뿐이다.
4. **입력 검증** — 이번 diff 는 요청 검증 로직(파이프·DTO validator)을 바꾸지 않는다.
5. **OWASP Top 10** — 접근제어 실패, 인증 실패, SSRF, 역직렬화 취약점 등에 해당하는 신규 표면 없음. `sample.controller.ts` fixture 의 `res.redirect('/elsewhere')` 두 곳은 하드코딩 상수 문자열이라 open-redirect 가능성이 없고, 이 fixture 자체가 프로덕션 모듈에 등록되지 않아(위 grep 확인) 공격 표면이 아니다.
6. **암호화** — 해시/암호화 알고리즘 변경 없음. secret 발급 로직(`triggers.service.ts`) 자체가 diff 대상이 아니다.
7. **에러 처리** — `@ApiBadRequestResponse`/`@ApiUnauthorizedResponse`/`@ApiForbiddenResponse`/`@ApiNotFoundResponse` 등 기존 에러 응답 설명은 유지되며, 새로 추가된 성공 응답 데코레이터는 에러 경로에 영향을 주지 않는다.
8. **의존성 보안** — 새 의존성 추가 없음(`@nestjs/swagger` 기존 데코레이터 재사용).

## 요약

이번 변경은 이전부터 존재하던 11개 엔드포인트의 실제 동작(상태 코드·응답 바디)을 바꾸지 않고 OpenAPI 문서에 성공 응답 스키마를 사후 광고하는 순수 문서화 작업과, 그 누락을 잡는 repo-guard(CI 전용, 프로덕션 미마운트)·e2e 계약 테스트 신설로 구성된다. 인증/인가 데코레이터, 입력 검증, 암호화, 에러 처리 로직은 diff 대상 파일 어디에서도 바뀌지 않았음을 각 컨트롤러 원본 파일 대조로 확인했다. 평문 1회성 secret 필드가 OpenAPI 스키마에 처음 공식 노출되는 점과 도구 인자/결과 필드가 열린 스키마로 광고되는 점은 모두 기존 설계·기존 노출 범위를 그대로 문서화한 것으로, 신규 위험 증가가 아니다(이전 라운드 `review/code/2026/09/26/13_39_09/security.md` 결론과 일치). Critical/Warning 급 발견사항 없음.

## 위험도

NONE
