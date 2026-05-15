### 발견사항

---

**[WARNING]** `HttpRequestHandler` — `authentication=integration` 실패 시 에러를 throw하나, 성공 시 `integration` 이외 인증 방식에서는 `logUsage`가 호출되지 않음
- 위치: `http-request.handler.ts`, execute 메서드 내 `integration === 'integration'` 분기 이후
- 상세: `authentication === 'integration'`일 때만 usage 로깅을 수행하지만, 기술적으로는 아무 인증 방식이든 HTTP 요청 성공/실패 자체는 추적할 수 있습니다. 현재 스펙 상 요구사항인지 모호하지만, 비일관성이 존재합니다.
- 제안: 설계 의도를 주석으로 명시하거나, integration 없는 HTTP 노드도 일관되게 처리할 것

---

**[WARNING]** `SendEmailHandler` — `IntegrationHandlerBase`를 상속하지 않고 `safeLogUsage`를 중복 구현
- 위치: `send-email.handler.ts` 전체
- 상세: `DatabaseQueryHandler`, `SlackHandler`, `HttpRequestHandler`는 모두 `IntegrationHandlerBase`를 상속하여 `resolveIntegration`/`logUsage` 공통 메서드를 활용합니다. 그러나 `SendEmailHandler`는 `implements NodeHandler`만 선언하고 `IntegrationHandlerBase`를 상속하지 않아 `safeLogUsage`를 직접 재구현했습니다. 결과적으로 integration 타입 체크, 연결 상태 체크, 에러 로깅 로직이 base class와 다른 형태로 중복 존재합니다.
- 제안: `SendEmailHandler`도 `IntegrationHandlerBase`를 상속하고 `resolveIntegration` / `logUsage`를 사용하도록 리팩토링

---

**[WARNING]** `SlackHandler` — `upload_file` 액션의 `file` 파라미터(base64/path)가 validate는 허용하나 `runAction`에서 실제로 처리되지 않음
- 위치: `slack.handler.ts`, `runAction` 내 `upload_file` case
- 상세: validate에서 `content or file is required`라고 검증하면서 `file` 경우도 허용하지만, `runAction`의 `upload_file` 분기에서는 `content: (config.content as string | undefined) ?? ''`만 처리하고 `config.file`은 완전히 무시됩니다. `file` 파라미터를 전달해도 빈 콘텐츠로 업로드됩니다.
- 제안: `config.file`이 있을 경우 처리 로직 추가, 또는 validate에서 `file` 파라미터를 제거하고 `content`만 허용

---

**[WARNING]** `IntegrationSelector` — `hasSavedButMissing`이 로딩 중(`isLoading=true`)에도 `true`로 평가될 수 있음
- 위치: `integration-selector.tsx`, `hasSavedButMissing` 계산
- 상세: `isLoading` 상태에서는 `integrations`가 빈 배열(`[]`)이므로, 저장된 `value`가 있으면 `hasSavedButMissing`이 항상 `true`가 됩니다. 로딩이 완료되기 전에 `(missing)` 옵션이 깜빡이며 표시될 수 있습니다.
- 제안: `const hasSavedButMissing = !isLoading && value !== "" && !integrations.some((i) => i.id === value);`

---

**[INFO]** `DatabaseQueryHandler` — `queryType='raw'`가 validate에서 허용되지만 실행 결과에 별도 처리 없이 일반 query로 실행됨
- 위치: `database-query.handler.ts`, validate와 execute
- 상세: `queryType` 필드가 결과 객체에 그대로 반영되지만 실행 동작은 구분되지 않습니다. `raw` 타입의 의미가 특별한 경우 실행 분기가 필요할 수 있습니다.
- 제안: `raw` 타입의 의도(DDL 허용 여부 등)를 주석으로 명시

---

**[INFO]** `IntegrationHandlerBase.resolveIntegration` — `integration.status !== 'connected'` 체크는 존재하나, `token_expires_at`이 지난 expired 상태가 DB에서 자동 갱신되지 않는 경우 `status='connected'`로 남아있을 수 있음
- 위치: `integration-handler-base.ts:50`
- 상세: 토큰 만료 시 status가 즉시 업데이트되는지 여부는 별도 스케줄러 로직에 의존합니다. 만약 갱신이 지연되면 만료된 토큰으로 실제 API 호출이 시도될 수 있습니다.
- 제안: 실행 시점에 `tokenExpiresAt`을 보조 체크하거나, 이 케이스가 허용된 설계임을 주석으로 명시

---

**[INFO]** `client.ts` — `paramsSerializer`의 `null` 처리가 `undefined`와 동일하게 skip되나, 의도적으로 `null`을 쿼리 파라미터로 전송해야 하는 케이스가 있을 경우 누락됨
- 위치: `frontend/src/lib/api/client.ts`
- 상세: 현재 null은 무시되지만, 일부 API 엔드포인트에서 명시적 null 전달이 필요한 경우 동작하지 않습니다. 현재 코드베이스 내 해당 케이스는 미확인.
- 제안: 현재 요구사항상 문제없으면 주석으로 의도 명시

---

### 요약

이번 변경은 실행 엔진 노드 핸들러(HTTP, Database, Slack, SendEmail)에 실제 Integration 자격증명 연동, 사용 로그 기록, 프론트엔드 통합 선택 UI를 추가하는 큰 범위의 구현입니다. 핵심 요구사항 충족도는 전반적으로 양호하나, `SendEmailHandler`가 `IntegrationHandlerBase`를 상속하지 않아 공통 로직이 중복 구현된 점, `SlackHandler`의 `upload_file` 액션에서 `file` 파라미터가 validate에서는 허용하면서 실제 실행에서는 무시되는 점, `IntegrationSelector` 컴포넌트의 로딩 중 `(missing)` 깜빡임 문제가 요구사항 관점에서 수정이 필요한 결함으로 식별됩니다.

### 위험도

**MEDIUM**