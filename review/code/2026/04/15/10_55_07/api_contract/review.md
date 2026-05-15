### 발견사항

- **[WARNING]** `GET /nodes/definitions` 응답 스키마 미문서화
  - 위치: `nodes.controller.ts` — `listDefinitions()` 메서드
  - 상세: `@ApiOkResponse({ description: '노드 정의 목록' })`에 `type` 또는 `schema` 프로퍼티가 없어 Swagger에 응답 본문 형태가 노출되지 않음. `configSchema`, `inputSchema`, `outputSchema` 필드는 TypeScript 타입도 `unknown`이어서 프론트엔드와의 계약이 암묵적임.
  - 제안: `NodeDefinitionView`를 `@ApiProperty()`가 선언된 DTO 클래스로 전환하거나, `@ApiOkResponse({ type: [NodeDefinitionView] })`로 최소한의 응답 형태를 명시.

- **[WARNING]** 신규 엔드포인트의 인증 응답 문서 누락
  - 위치: `nodes.controller.ts` — `listDefinitions()` 메서드
  - 상세: 동일 컨트롤러의 다른 모든 엔드포인트는 `@ApiUnauthorizedResponse()`를 선언하는 반면, `listDefinitions()`에는 없음. 실제 가드가 전역/컨트롤러 수준에서 적용된다면 동작은 동일하나 API 문서에서 계약이 불일치함.
  - 제안: 다른 엔드포인트와 동일하게 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 추가.

- **[WARNING]** `listDefinitions()` 호출 시 부트스트랩 이전 빈 배열 반환
  - 위치: `node-component.registry.ts` — `listDefinitions()` / `bootstrap()`
  - 상세: `bootstrap()`은 `ExecutionEngineService.onModuleInit()`에서 호출되는데, 서버가 초기화 중일 때 HTTP 요청이 유입되면 빈 배열 `[]`이 200으로 반환됨. 에러나 503이 아닌 정상 응답이어서 클라이언트가 이를 "노드 없음" 상태로 오인할 수 있음.
  - 제안: 부트스트랩 완료 여부를 `private bootstrapped = false` 플래그로 추적하고, 미완료 상태에서 호출 시 `ServiceUnavailableException` 등을 throw하거나, `bootstrap()` 호출을 `NodeComponentRegistry`의 `onModuleInit()`으로 이관.

- **[INFO]** 목록 API에 페이지네이션 없음
  - 위치: `nodes.controller.ts` — `GET /nodes/definitions`
  - 상세: 현재 등록된 노드 타입은 ~30개 수준으로 페이지네이션 없이도 문제없음. 향후 마켓플레이스 확장 시 고려 필요.

- **[INFO]** 하위 호환성 — 기존 엔드포인트 변경 없음
  - 모든 기존 엔드포인트(`GET /workflows/:id/nodes`, `POST`, `PATCH`, `DELETE`)는 변경되지 않았으며 완전히 하위 호환됨.

---

### 요약

이번 변경은 `GET /nodes/definitions` 엔드포인트를 추가하는 순수 확장(additive)으로, 기존 API 계약에 대한 breaking change는 없다. 주요 우려사항은 응답 스키마가 Swagger에 문서화되지 않아 프론트엔드와의 계약이 코드 밖에서는 불투명하다는 점, 그리고 동일 컨트롤러 내 인증 응답 문서의 불일치다. 또한 `onModuleInit` 완료 전 요청이 유입될 경우 빈 배열을 정상 응답으로 반환하는 엣지케이스가 운영 환경에서 의도치 않은 동작을 유발할 수 있다.

### 위험도
**LOW**