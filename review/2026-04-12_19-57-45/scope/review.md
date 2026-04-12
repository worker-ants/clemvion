## 발견사항

### [WARNING] `client.ts` paramsSerializer — 전역 axios 설정 변경
- **위치**: `frontend/src/lib/api/client.ts`
- **상세**: `paramsSerializer` 추가는 integration list API의 배열 파라미터 직렬화 문제를 해결하지만, 이 설정은 애플리케이션의 **모든** API 호출에 영향을 미칩니다. 현재 작업 범위(integration 노드 구현)와 연관이 있기는 하나, 다른 API 엔드포인트의 기존 배열 파라미터 직렬화 동작이 암묵적으로 변경됩니다.
- **제안**: 변경 이유(NestJS ValidationPipe + Express querystring 호환성)가 명확하므로 기술적으로는 타당하지만, 회귀 영향 범위를 확인하는 별도 테스트가 필요합니다.

---

### [WARNING] `http-request.handler.ts` — 범위 외 동작 변경 포함
- **위치**: `http-request.handler.ts` (execute 메서드)
- **상세**: 두 가지 기존 동작이 변경되었습니다.
  1. `queryParams`의 기본값이 `undefined`에서 `{}`로 바뀌고, 조건 검사가 `queryParams && typeof queryParams === 'object'`에서 `Object.keys(queryParams).length > 0`으로 변경됨 — 기능적으로 동일하지 않습니다.
  2. `bodyType === 'raw'`일 때 `String(body)`에서 `typeof body === 'string' ? body : JSON.stringify(body)`로 변경됨 — 객체 body를 raw로 넘기는 기존 동작을 조용히 바꿉니다.
- **제안**: integration 인증 로직과 무관한 동작 변경이므로 별도 PR로 분리하거나 최소한 spec에서 의도적 변경임을 확인해야 합니다.

---

### [INFO] 엔티티 파일 순수 포맷팅 변경
- **위치**: `integration.entity.ts:54`, `integration-oauth-state.entity.ts:61`
- **상세**: `@Column` 데코레이터의 줄바꿈 포맷팅만 변경되었습니다. 기능적 변경 없음.
- **제안**: 기능 변경 PR에 포맷팅 변경이 섞이면 diff 검토가 어려워집니다. 별도 커밋으로 분리하는 것이 바람직하지만 위험도는 없음.

---

### [INFO] `SendEmailHandler` — `IntegrationHandlerBase` 미상속 (일관성 문제)
- **위치**: `send-email.handler.ts`
- **상세**: `HttpRequestHandler`, `DatabaseQueryHandler`, `SlackHandler`는 모두 `IntegrationHandlerBase`를 상속하여 `resolveIntegration`/`logUsage`를 공유하지만, `SendEmailHandler`만 직접 구현(`safeLogUsage`)하고 있습니다. `resolveIntegration`의 serviceType/status 검사 로직도 인라인으로 중복 구현되어 있어, 향후 공통 정책 변경 시 누락 가능성이 있습니다.
- **제안**: `IntegrationHandlerBase`를 상속하도록 리팩토링하면 코드 중복이 제거됩니다. 단, 현재 동작 자체는 올바릅니다.

---

### [INFO] `package-lock.json` — dev→production 의존성 승격
- **위치**: `package-lock.json` (asynckit, combined-stream, delayed-stream, form-data, mime-types 등)
- **상세**: `@slack/web-api`가 `axios`를 production 의존성으로 끌어들이면서, 기존에 devDependency였던 여러 패키지(asynckit, form-data 등)에서 `"dev": true` 플래그가 제거되었습니다. 의도된 간접 변경이나, 프로덕션 번들 크기에 영향을 줄 수 있습니다.
- **제안**: 별도 조치 불필요, 인지만 하면 충분합니다.

---

## 요약

이번 변경의 핵심 범위는 **Slack·Database·HTTP·SendEmail 노드에 Integration 서비스 연동**을 추가하는 것으로, 대부분의 변경(새 핸들러 구현, 테스트, IntegrationHandlerBase, IntegrationSelector UI, IntegrationsService.getForExecution 추가)은 의도한 범위 내에 있습니다. 다만 `client.ts`의 전역 paramsSerializer 변경과 `http-request.handler.ts`의 기존 동작 변경(raw body, queryParams 기본값)이 scope 경계를 소폭 넘어선 점, 그리고 `SendEmailHandler`만 `IntegrationHandlerBase`를 상속하지 않아 일관성이 깨진 점이 주요 지적 사항입니다.

## 위험도

**LOW**