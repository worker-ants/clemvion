# API 계약 리뷰 — integration usages usageKind 추가

- 대상 엔드포인트: `GET /api/integrations/:id/usages`
- 리뷰 범위: `origin/main..HEAD` diff 중 `codebase/` 전체
- 리뷰 일시: 2026-06-19

---

## 발견사항

### [WARNING] IntegrationUsageItemDto 에 isActive 필드 누락 — OpenAPI 스키마와 실제 응답 불일치

- 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` L342-352 (`IntegrationUsageItemDto`)
- 상세:
  서비스(`integrations.service.ts` L779-782)는 `IntegrationUsageWorkflow` 인터페이스 기준으로 `{ workflowId, workflowName, isActive, nodes }` 4개 필드를 반환한다. 컨트롤러는 이 객체를 그대로 직렬화해서 응답에 포함한다. 그러나 OpenAPI DTO인 `IntegrationUsageItemDto`는 `workflowId`, `workflowName`, `nodes` 만 선언하며 `isActive` 에 `@ApiProperty` 데코레이터가 없다. 결과적으로:
  - 실제 HTTP 응답에는 `isActive` 가 포함된다 (NestJS 기본 직렬화).
  - Swagger/OpenAPI 스키마에는 `isActive` 가 누락된다.
  - 프론트엔드 타입 `UsageWorkflow`(`codebase/frontend/src/lib/api/integrations.ts` L165)와 실제 UI 렌더링(`page.tsx` L633, L638)은 `isActive`를 사용하므로 기능 동작에는 문제가 없다.
  - 단, OpenAPI 스키마를 신뢰하는 외부 클라이언트나 SDK 자동 생성 도구는 `isActive` 필드를 알 수 없다.
  - 이번 변경(usageKind 추가)과 동일 DTO를 수정한 기회였으므로 함께 정정하는 것이 적절했다.
- 제안: `IntegrationUsageItemDto`에 `@ApiProperty({ type: Boolean }) isActive: boolean;` 를 추가하여 OpenAPI 스키마와 실제 응답을 일치시킨다. 이는 additive change이며 하위 호환성을 깨지 않는다.

---

### [INFO] @ApiProperty({ enum }) 에 enumName 미지정 — OpenAPI 스키마 타입명 미노출

- 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` L338 (`IntegrationUsageNodeDto.usageKind`)
- 상세:
  `@ApiProperty({ enum: ['direct', 'mcp'] })` 는 OpenAPI 스키마에 인라인 enum(`"enum": ["direct", "mcp"]`)으로 노출된다. `enumName` 을 명시하지 않으면 `@nestjs/swagger`가 별도 enum 컴포넌트를 생성하지 않으므로 SDK 자동 생성 도구가 `'direct' | 'mcp'` 를 named type으로 추출하지 못하고 매번 인라인 리터럴로 처리한다. 동일 패턴이 이미 다른 필드(L31, L82, L367)에서도 사용되고 있어 프로젝트 내 일관성은 유지되고 있다. 기능 동작·스키마 유효성에는 영향 없다.
- 제안: SDK 자동 생성 품질 향상을 원할 경우 `@ApiProperty({ enum: ['direct', 'mcp'], enumName: 'IntegrationUsageKind' })` 로 변경. 현 시점에서는 필수 수정 사항은 아니다.

---

### [INFO] usageKind 의 'direct' 우선 규칙이 응답 스키마 문서에 기술되지 않음

- 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` L333-339
- 상세:
  DTO JSDoc 주석에 'direct' 우선 규칙이 서술되어 있으나, OpenAPI `@ApiProperty`의 `description` 인자에는 포함되지 않았다. Swagger UI에서 이 필드를 확인하는 API 소비자는 우선순위 정책을 알 수 없다.
- 제안: `@ApiProperty({ enum: ['direct', 'mcp'], description: "통합 참조 방식. 'direct'=노드 config.integrationId, 'mcp'=AI Agent config.mcpServers[].integrationId. 한 노드가 양쪽에 해당하면 direct 우선." })` 로 description을 추가한다.

---

### [INFO] 하위 호환성 — 필드 추가 only, breaking change 없음

- 위치: 전체 diff
- 상세:
  기존 응답 구조(`{ workflowId, workflowName, nodes: [{ id, label, type }] }`)에 `nodes[].usageKind` 필드가 추가된다. 필드 추가는 하위 호환 변경이며 기존 클라이언트가 해당 필드를 무시하면 정상 동작한다. 기존 필드의 이름·타입·HTTP 상태 코드·URL 경로 변경은 없다. breaking change 없음.

---

### [INFO] enum 값 정합 검증 — 서비스 인터페이스와 DTO 일치

- 위치:
  - `integrations.service.ts` L178: `usageKind: 'direct' | 'mcp'`
  - `integration-response.dto.ts` L339: `usageKind: 'direct' | 'mcp'`
  - `integrations.ts` (frontend) L163: `usageKind: "direct" | "mcp"`
- 상세:
  백엔드 도메인 인터페이스(`IntegrationUsageNode`), DTO(`IntegrationUsageNodeDto`), SQL CASE 식 리터럴(`'direct'`, `'mcp'`), 프론트엔드 타입 모두 동일한 enum 값을 사용한다. 불일치 없음.

---

### [INFO] MCP-only 참조 시 DELETE 409 차단 — API 에러 응답 형식 일관성

- 위치: `codebase/backend/test/integration-usage-mcp.e2e-spec.ts` L171-172
- 상세:
  e2e 테스트가 `del.body.error?.code === 'INTEGRATION_IN_USE'` 를 검증하며 에러 응답이 `{ error: { code, message } }` 구조임을 확인한다. 이는 GlobalExceptionFilter 의 기존 에러 직렬화 형식과 일치하며 별도 API 계약 위반 없음.

---

## 요약

이번 변경은 `GET /api/integrations/:id/usages` 응답의 `nodes[]` 배열에 `usageKind: 'direct' | 'mcp'` 필드를 추가하는 순수 additive change이다. 하위 호환성이 유지되며 백엔드 도메인 타입·DTO·프론트엔드 타입 간 enum 값 정합도 일치한다. OpenAPI 스키마 노출도 `@ApiProperty({ type: [IntegrationUsageNodeDto] })`로 올바르게 연결되어 있다. 단, `IntegrationUsageItemDto`에서 기존부터 존재하던 `isActive` 필드가 OpenAPI 스키마에 선언되지 않아 스키마와 실제 응답 간 불일치가 존재한다(WARNING). 이번 변경 기회에 함께 수정하는 것이 권장된다. Critical 사항은 없다.

## 위험도

LOW

---

STATUS: DONE
