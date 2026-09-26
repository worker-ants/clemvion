# 보안(Security) 리뷰 — success-advert (OpenAPI 성공 응답 광고 보강)

## 범위 요약

이 변경 세트는 11개 엔드포인트에 대해 **OpenAPI 성공 응답 스키마를 새로 광고**하고(`@ApiOkWrappedResponse` 등 데코레이터 부착 + 대응 DTO 신설), 이를 강제하는 repo-guard(`http-status-advertised-guard.ts`)와 e2e 계약 테스트를 추가한다. 확인 결과 **런타임 인증·인가·입력 검증·서비스 로직 파일(`*.service.ts`, guard 클래스)은 diff 에 포함되지 않았다** — `git diff` 로 `triggers.service.ts`, `webauthn.service.ts` 변경 없음을 확인. 즉 이번 PR 은 실질적으로 **문서화 계층(Swagger/OpenAPI) + 테스트 계층**의 변경이며, 기존에 이미 살아있던 엔드포인트 동작(누가 무엇을 반환하는가)을 바꾸지 않는다.

## 발견사항

- **[INFO]** 평문 1회성 secret 발급 엔드포인트의 응답 스키마가 OpenAPI 문서에 처음으로 공식 노출된다
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-secret-issue-response.dto.ts:9-24` (`NotificationRotateSecretDto.secret`, `InteractionRevokeTokenDto.token`), 연결 지점 `codebase/backend/src/modules/triggers/triggers.controller.ts:215`·`246` (`@ApiOkWrappedResponse(NotificationRotateSecretDto, ...)`, `@ApiOkWrappedResponse(InteractionRevokeTokenDto, ...)`)
  - 상세: 두 엔드포인트(`POST /api/triggers/:id/notification/rotate-secret`, `POST /api/triggers/:id/interaction/revoke-token`)는 이전부터 평문 secret 을 응답 바디에 실어 왔다(로직 미변경). 이번 PR 은 그 필드 이름·타입(`secret: string`, `token: string`)을 OpenAPI 스키마로 처음 공식화한다. 값 자체는 절대 노출되지 않고 스키마(필드명/설명)만 노출되며, `main.ts`(`isSwaggerEnabled`)가 production 에서는 Swagger 문서 마운트 자체를 fail-closed 로 막는 기존 안전장치가 있어(본 PR 미변경) 실질 노출 범위는 dev/staging 문서 열람자로 제한된다. 다만 스테이징 등 Swagger 가 켜진 환경에서는 "이 엔드포인트가 평문 secret 을 되돌려준다"는 사실 자체가 공격 대상 선정에 유용한 정보가 될 수 있다.
  - 제안: 기존 위험 수용 범위와 동일(변경 없음)이므로 조치 불필요. 다만 이 두 엔드포인트가 `@Roles('editor')` + 워크스페이스 스코프 검증을 유지하고 있는지(diff 상 유지됨, `triggers.controller.ts:207`·`238` 확인) 회귀 없는지는 향후 리팩터 시 계속 확인할 것.

- **[INFO]** `AssistantToolCallDto.arguments` / `result` 가 `additionalProperties: true` 로 완전히 열린 스키마로 광고된다
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/responses/assistant-session-response.dto.ts:105`, `:115`
  - 상세: 도구별 인자·결과 모양이 제각각이라 의도적으로 연 설계(주석에 근거 명시, §1-4 SoT 이중화 회피)다. OpenAPI 소비자(SDK 생성기 등) 입장에서는 이 필드에 대해 타입 안전성을 전혀 제공하지 않으므로, 이 값을 그대로 렌더링/실행하는 프런트가 있다면 별도로 XSS·역직렬화 검증이 프런트 측에 있어야 한다. 이번 diff 자체는 서버 검증 로직을 바꾸지 않으므로 새로운 취약점은 아니다.
  - 제안: 조치 불필요(설계 의도). 프런트에서 `arguments`/`result` 를 HTML 로 렌더링하는 경로가 있다면 그쪽에서 이스케이프 여부를 별도 확인 권장(본 리뷰 범위 밖).

- **[INFO]** `http-status-advertised` repo-guard 의 fixture(`sample.controller.ts`)에 `res.redirect('/elsewhere')` 두 곳 추가
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/http-status-advertised/sample.controller.ts:118`, `:125`
  - 상세: 리다이렉트 대상이 요청 입력이 아닌 하드코딩된 상수 문자열이라 open-redirect 가능성 없음. 이 파일은 `src/modules` 스캔 루트 밖(`repo-guards/__tests__/fixtures`)이라 실제 애플리케이션 라우트로 마운트되지 않는 테스트 전용 fixture다.
  - 제안: 조치 불필요.

## 점검했으나 문제 없음으로 확인된 항목

- `webauthn.controller.ts`: `webauthnAvailability()`(`@Public()`)는 boolean 플래그 하나만 반환하며 민감정보 없음. `Delete('credentials/:id')` 등 나머지 엔드포인트는 `@UseGuards(JwtAuthGuard)` 유지, 변경분은 `@ApiNoContentResponse` 데코레이터 추가뿐으로 인가 로직 변경 없음.
- `interaction-stream.controller.ts`, `workflow-assistant.controller.ts` (`sendMessage`): SSE 라우트에 `@ApiOkResponse` 문서 데코레이터만 추가, 스트림 인증(`InteractionGuard`, 세션 소유권 검증)·헤더 설정 로직은 diff 대상 아님.
- `http-status-advertised-guard.ts`: AST 기반 정적 분석 도구로 런타임에 실행되지 않는 CI/테스트 전용 코드. 인젝션·인증 표면 없음.
- 신규/변경 e2e 스펙(`advertised-response-contract.e2e-spec.ts`, `workflow-assistant.e2e-spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`)은 응답 계약(`assertMatchesContract`) 검증만 추가하며 secret 값을 로그로 출력하거나 하드코딩하지 않음(placeholder DB 트리거는 `notification.url: https://hooks.example.com/...` 로 예시 도메인만 사용).
- 하드코딩된 자격증명·API 키·평문 credential 없음 — DTO 의 `@ApiProperty({ example: ... })` 값은 전부 플레이스홀더(`'itk_...'`, 날짜 예시 등).
- SQL/커맨드/경로 인젝션에 해당하는 신규 입력 처리 코드 없음(전부 데코레이터·DTO 선언, 서비스 로직 미변경).

## 요약

이번 변경은 기존에 이미 존재하던 11개 엔드포인트의 동작을 바꾸지 않고 OpenAPI 성공 응답 스키마를 사후 문서화하는 작업과, 그 문서화 누락을 잡는 repo-guard·e2e 계약 테스트 추가로 구성된다. 인증/인가 가드, 입력 검증, 암호화, 에러 처리 로직에는 손대지 않았으며 신규 인젝션 벡터나 하드코딩된 시크릿도 발견되지 않았다. 유일하게 주목할 점은 평문 1회성 secret 반환 엔드포인트(trigger notification secret, interaction token)의 응답 필드가 처음으로 OpenAPI 스키마에 공식 노출된다는 점이나, production 에서는 Swagger 자체가 비활성화되는 기존 fail-closed 안전장치가 있어 실제 위험 증가는 미미하다.

## 위험도

NONE
