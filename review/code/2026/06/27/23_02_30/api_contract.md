# API 계약(API Contract) 리뷰

## 발견사항

### [WARNING] X-Deleted-Count 응답 헤더 — CORS expose 누락 가능성
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts` L175, frontend `codebase/frontend/src/lib/api/agent-memories.ts` L312
- 상세: `clearScope`(DELETE `/agent-memories?scopeKey=`) 엔드포인트가 `X-Deleted-Count` 커스텀 응답 헤더를 새로 추가했다. 브라우저는 CORS preflight 응답의 `Access-Control-Expose-Headers` 에 명시되지 않은 헤더를 JavaScript에서 읽을 수 없다. 변경 범위 어디에도 CORS 설정(`Access-Control-Expose-Headers: X-Deleted-Count`)을 추가하는 코드가 없다. 기존 CORS 설정이 와일드카드(`*`)이거나 이미 커스텀 헤더를 모두 노출하고 있다면 문제없지만, 그렇지 않으면 프론트엔드의 `res.headers['x-deleted-count']` 읽기가 브라우저 환경에서 `undefined`를 반환해 항상 0으로 폴백한다. 프론트엔드 단위테스트는 API 클라이언트를 목(mock)으로 대체하므로 이 경로를 실제 검증하지 않는다.
- 제안: 백엔드 CORS 설정 파일(일반적으로 `main.ts` 또는 CORS 미들웨어 설정)에서 `exposedHeaders: ['X-Deleted-Count']` 를 명시적으로 추가하거나, 기존 CORS 설정이 이 헤더를 이미 포함하는지 확인 후 문서화한다.

### [INFO] @ApiHeader 스키마 타입 불일치 — integer vs string
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts` L957~962 (Swagger 데코레이터)
- 상세: `@ApiHeader` 데코레이터에 `schema: { type: 'integer' }` 로 선언했지만 실제 전송값은 `String(deleted)` — HTTP 헤더는 항상 문자열이다. Swagger 문서를 보고 자동 코드를 생성하는 클라이언트(openapi-generator 등)는 이 헤더를 정수로 역직렬화하려 시도할 수 있는데 실제값은 문자열이어서 파싱 오류가 발생할 수 있다. 프론트엔드는 직접 `Number(raw)` 변환을 하므로 현재 클라이언트는 영향 없다.
- 제안: `schema: { type: 'string', example: '5' }` 로 수정하거나, 설명에 "HTTP 헤더로 문자열 전송 / 정수로 파싱 필요"를 명시한다.

### [INFO] clearScope API 클라이언트 반환 타입 변경 (void → number) — 잠재적 소비처 확인 필요
- 위치: `codebase/frontend/src/lib/api/agent-memories.ts` L308
- 상세: `agentMemoriesApi.clearScope()` 반환 타입이 `Promise<void>`에서 `Promise<number>`로 변경됐다. 이는 REST API 계약 자체(HTTP 응답 구조)가 아닌 프론트엔드 내부 클라이언트 계약 변경이다. 현재 유일한 소비처인 `page.tsx`는 올바르게 업데이트됐다. 향후 동일 함수를 참조하는 코드가 추가될 때 새 타입을 인식해야 한다.
- 제안: TypeScript 컴파일러가 타입 불일치를 자동 감지하므로 즉시 조치 불필요. 현재 소비처 외 참조처가 없음을 확인 완료.

### [INFO] listScopes vs listMemories 페이지네이션 total 계산 방식 비대칭
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory-admin.service.ts` L396~434 (listScopes), L468~520 (listMemories)
- 상세: `listScopes`는 `COUNT(*) OVER()` 윈도우 함수를 이용한 단일 쿼리로 total을 산출하지만, `listMemories`는 별도 COUNT 쿼리를 추가로 실행한다(2회 쿼리). 두 엔드포인트 응답의 `pagination.totalItems` 는 같은 시맨틱이지만 구현 방식이 다르다. OFFSET이 전체 건수를 초과할 때 `listScopes`는 `total=0`을 반환하고 `listMemories`는 COUNT 쿼리에서 정확한 총건수를 반환한다 — 동일 "빈 페이지" 시나리오에서 응답 `pagination.totalItems` 값이 달라진다. API 소비자가 두 엔드포인트의 `totalItems`를 같은 방식으로 처리한다면 edge-case에서 혼란이 발생할 수 있다.
- 제안: 단기적으로는 영향이 미미하므로 INFO 수준으로 기록. 향후 `listMemories`도 단일쿼리 방식으로 통일하거나, 두 엔드포인트 모두 "offset 초과시 total은 여전히 전체 건수 반환"으로 동일하게 유지하는 방향을 결정한다.

### [INFO] DELETE /agent-memories?scopeKey= — RESTful 경로 설계 (기존 설계, 이번 변경 도입 아님)
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts` L1133
- 상세: scope 전체 삭제가 `DELETE /agent-memories` + 쿼리 파라미터(`scopeKey`)로 설계되어 있다. RESTful 관례상 리소스 삭제 대상은 경로 세그먼트(`DELETE /agent-memories/scopes/:scopeKey`)로 식별하는 것이 더 표준적이다. 이번 변경이 도입한 설계가 아닌 기존 코드이며, 현재 클라이언트가 이 계약에 의존하므로 기존 동작 유지가 적절하다.
- 제안: 기존 설계이므로 즉시 변경 불필요. 향후 API 재설계 시 `/agent-memories/scopes/:scopeKey` 경로로 이동하고 구 경로를 deprecated 처리하는 방향을 검토한다.

## 요약

이번 변경의 핵심 API 계약 수정은 `DELETE /agent-memories?scopeKey=` 엔드포인트에 `X-Deleted-Count` 응답 헤더를 추가한 것이다. 이는 기존 클라이언트가 이 헤더를 무시하면 영향이 없는 additive 변경으로 하위 호환성이 유지된다. 서비스 계층 분리(`AgentMemoryAdminService` 신설)는 내부 구조 리팩터링이며 REST API 서피스(URL, HTTP 메서드, 요청/응답 스키마)는 변경이 없다. 주목해야 할 위험은 CORS `Access-Control-Expose-Headers` 설정이 `X-Deleted-Count`를 포함하지 않는 경우 브라우저 클라이언트가 이 헤더를 읽지 못해 0건/다건 삭제 UX 분기가 무력화된다는 점이다. 인증·인가(viewer/editor 롤 분리, @WorkspaceId() 강제 격리)는 올바르게 유지되고 있으며, 페이지네이션 응답 형식도 프로젝트 표준 `PaginatedResponseDto`를 준수한다.

## 위험도
LOW
