### 발견사항

- **[INFO]** `IntegrationHandlerBase` 클래스에 대한 독립 단위 테스트 없음
  - 위치: `integration-handler-base.ts`
  - 상세: `resolveIntegration`, `logUsage`, `getWorkspaceId`, `toLogError`, `IntegrationError` 등 핵심 공유 로직이 각 핸들러 테스트를 통해 간접적으로만 검증됨. `serviceType 불일치`, `status !== connected`, `workspaceId 누락`, `integrationsService 없음` 등의 경계 케이스가 각 핸들러 spec에 중복 분산되어 있음
  - 제안: `integration-handler-base.spec.ts`를 별도로 작성하거나, 현재 상태를 허용한다면 각 핸들러 spec의 중복 케이스를 공유 픽스처로 추출

- **[INFO]** `SendEmailHandler`가 `IntegrationHandlerBase`를 상속하지 않음
  - 위치: `send-email.handler.ts:25` — `export class SendEmailHandler implements NodeHandler`
  - 상세: `DatabaseQueryHandler`, `SlackHandler`, `HttpRequestHandler`는 모두 `IntegrationHandlerBase`를 상속하는데, `SendEmailHandler`만 독자적인 `safeLogUsage` private 메서드와 수동 `serviceType`/`status` 검증 로직을 중복 구현함. 이로 인해 `send-email.handler.spec.ts`는 `INTEGRATION_TYPE_MISMATCH`, `INTEGRATION_NOT_CONNECTED` 케이스를 직접 문자열로 검증하지만, 에러 코드 포맷이 기반 클래스와 미묘하게 다를 수 있음
  - 제안: `SendEmailHandler`를 `IntegrationHandlerBase`로 리팩터링하여 테스트 커버리지와 일관성을 확보

- **[INFO]** `http-request.handler.spec.ts`에서 `authentication=integration` 경로의 fetch 에러(transport 오류) 로깅 케이스 미검증
  - 위치: `http-request.handler.spec.ts` — integration-backed authentication describe 블록
  - 상세: non-2xx 응답의 `logUsage` 호출은 검증하지만, fetch 자체가 throw되는 transport 실패 시 `logUsage`가 `HTTP_TRANSPORT_FAILED`로 호출되는 경로가 테스트되지 않음
  - 제안: `fetch`가 `reject`하는 케이스 추가 (`global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))`)

- **[INFO]** `database-query.handler.spec.ts`의 `validate` describe에서 `new DatabaseQueryHandler()`를 인수 없이 생성하지만 실제 프로덕션 경로(`execute`)에서는 서비스 주입이 필요
  - 위치: `database-query.handler.spec.ts:66`
  - 상세: `validate` 테스트는 인수 없이 핸들러를 생성하며 `execute`를 호출하지 않으므로 문제없음. 그러나 `validate` describe 내에 `queryType: 'raw'`가 허용 목록에 추가된 것에 대한 테스트가 없음 (`'vacuum'` 거부는 있지만 `'raw'` 허용 케이스가 없음)
  - 제안: `handler.validate({ integrationId: 'x', query: 'SELECT 1', queryType: 'raw' }).valid === true` 케이스 추가

- **[INFO]** `integration-selector.test.tsx`에서 `isLoading` 상태의 UI(select 비활성화, "Loading…" 텍스트) 테스트 없음
  - 위치: `integration-selector.test.tsx`
  - 상세: `listMock`이 pending 상태일 때 `<select disabled>` 및 "Loading…" placeholder 텍스트 렌더링 여부가 검증되지 않음
  - 제안: `listMock.mockReturnValue(new Promise(() => {}))` 형태로 로딩 상태 스냅샷 테스트 추가 (선택적)

- **[INFO]** `client.ts`의 `paramsSerializer` 로직에 대한 단위 테스트 없음
  - 위치: `frontend/src/lib/api/client.ts`
  - 상세: 배열 파라미터 직렬화(`?foo=a&foo=b`)는 서버 쪽 `ValidationPipe`와의 호환성에 중요하지만, `apiClient` 인스턴스를 직접 생성하기 어려운 구조라 테스트가 누락됨
  - 제안: `serialize` 함수를 파일 내 export된 별도 함수로 분리하여 독립 테스트 가능하게 구조화 (선택적)

- **[INFO]** `SlackHandler`의 `upload_file` 액션에서 `files.uploadV2` 반환값의 타입 단언 `(res as { files?: unknown }).files` 이 테스트에서 검증되지 않음
  - 위치: `slack.handler.spec.ts` — `filesUploadMock` 설정됐으나 execute 테스트에 `upload_file` 케이스 없음
  - 상세: `filesUploadMock`이 목으로 정의되어 있지만 `upload_file` 액션의 execute 경로를 검증하는 테스트가 없음. `update_message` 액션 execute 케이스도 없음
  - 제안: `upload_file`, `update_message` execute 케이스 추가

---

### 요약

전반적으로 테스트 구조는 양호합니다. 핵심 실행 경로(성공, 실패, 자격증명 누락, 타입 불일치, stub 폴백)가 각 핸들러별로 체계적으로 커버되어 있고, mock 격리도 적절합니다. 주요 미비점은 `SendEmailHandler`가 `IntegrationHandlerBase`를 상속하지 않아 검증 로직이 중복·분산된 점, `SlackHandler`의 `upload_file`/`update_message` execute 경로가 테스트되지 않은 점, `IntegrationHandlerBase` 자체에 대한 독립 테스트가 없는 점입니다. `client.ts`의 `paramsSerializer`와 `IntegrationSelector`의 로딩 상태 테스트는 선택적으로 개선할 수 있습니다.

### 위험도

**LOW**