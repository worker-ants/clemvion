# 부작용(Side Effect) 코드 리뷰

**대상 브랜치**: `claude/agent-a5522a5d692774509`  
**diff 범위**: `origin/main..HEAD -- codebase/`  
**일시**: 2026-06-19 14:09:20  
**리뷰어**: side-effect-reviewer

---

## 발견사항

### 1. [WARNING] `remove()` 내부 `findById` 이중 호출 — 불필요한 DB 왕복

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` L691-702
- **상세**: `remove()`는 (1) 자체적으로 `integrationRepository.findOne()`을 수행한 뒤, (2) `getUsages()`를 호출하면 그 안에서 다시 `findById()` → `integrationRepository.findOne()`을 수행한다. 동일 레코드에 대한 DB 조회가 한 트랜잭션 스코프 내에서 두 번 발생한다. 데이터 불일치 가능성은 없으나(동일 결과를 반환), 삭제 경로에서의 불필요한 부작용(추가 DB I/O)이다.
- **비고**: 사용자가 "이중 findById 는 후속 plan ⑦ 로 이관" 으로 인지하고 있어 차단 등급으로 올리지 않는다.
- **제안**: 후속 plan ⑦에서 `getUsages()`에 optional `skipExistenceCheck` 파라미터를 추가하거나, `remove()` 내부에서 직접 사용 노드 수를 카운트하는 쿼리로 대체.

---

### 2. [WARNING] `IntegrationUsageItemDto`에 `isActive` 필드 누락 — Swagger 문서와 실제 응답 불일치

- **위치**: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` L342-357
- **상세**: `IntegrationUsageWorkflow` 인터페이스(서비스 레이어)와 실제 응답 JSON에는 `isActive: boolean` 이 포함되어 있다. 그러나 `IntegrationUsageItemDto` 클래스에는 해당 필드가 없다. `@ApiOkWrappedResponse(IntegrationUsagesDto, ...)` 는 이 DTO 기반으로 OpenAPI 스펙을 생성하므로, 생성된 API 문서에서 `isActive`가 누락된다. 또한 Swagger Codegen 또는 타입 생성 도구를 사용하는 외부 소비자라면 이 필드를 알 수 없다.
  - `IntegrationUsageItemDto.nodes`는 `IntegrationUsageNodeDto[]`로 정확히 업데이트됐으나 `isActive`는 반영되지 않았다.
- **제안**: `IntegrationUsageItemDto`에 `@ApiProperty() isActive: boolean;` 필드 추가.

---

### 3. [INFO] `listUsages` 컨트롤러가 `IntegrationUsagesDto` 대신 `IntegrationUsageWorkflow[]` 원배열 반환

- **위치**: `codebase/backend/src/modules/integrations/integrations.controller.ts` L330-335
- **상세**: 컨트롤러는 `@ApiOkWrappedResponse(IntegrationUsagesDto, ...)` 로 선언했으나 실제로는 `IntegrationWorkflow[]` 배열을 직접 반환한다. `TransformInterceptor`가 `{ data: [...] }` 로 래핑하고, 프론트엔드의 `unwrap()` 함수가 `data` 키를 꺼내 배열로 소비한다. 현재 동작은 유지되나, `IntegrationUsagesDto.usages` 필드는 응답에 실재하지 않으며 Swagger 문서가 실제 응답 구조와 다르다.
  - 이는 이번 PR의 신규 도입 이슈가 아닌 기존 패턴이나, `IntegrationUsageNodeDto` 추가로 Swagger/DTO 정확성이 다시 주목받는 시점이다.
- **제안**: (a) 컨트롤러가 `{ usages: [...] }` 래핑 객체를 반환하도록 변경하거나, (b) `@ApiOkWrappedResponse`의 DTO를 실제 반환 타입(배열 직렬화)에 맞게 조정. 기존 프론트엔드 소비 방식과의 정합성 확인 필요.

---

### 4. [INFO] `ConflictException` 페이로드 `usages`에 `usageKind` 포함 — 오류 응답 스키마 미문서화

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` L703-708
- **상세**: `remove()` 에서 던지는 `ConflictException` 의 페이로드에 `usages: IntegrationUsageWorkflow[]` 가 포함된다. 각 노드 항목에 이제 `usageKind: 'direct' | 'mcp'` 가 포함되지만, 이 409 응답 형태는 Swagger 에 `@ApiConflictResponse`로 문서화되지 않았다. e2e 테스트(B케이스)는 `error.code === 'INTEGRATION_IN_USE'` 만 검증하고 페이로드 구조는 검증하지 않는다. 부작용 자체는 없으나 `usageKind` 추가로 409 응답 크기가 증가하고 소비자가 이 구조에 의존할 경우 미래 변경 시 영향이 있다.
- **제안**: `@ApiConflictResponse`에 실제 페이로드 형태 문서화 추가(선택적).

---

### 5. [INFO] SQL CASE 식의 named parameter `:integrationId` — TypeORM `addSelect` 에서의 바인딩 유효성

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` L766-769
- **상세**: `Brackets` 내 `where`/`orWhere` 에서 `:integrationId` 를 바인딩하고, `addSelect` 의 CASE 식에서도 동일 파라미터를 참조한다. TypeORM 에서 `addSelect` 내 named parameter는 `setParameter` 없이 `Brackets` 바인딩만으로는 scope가 다를 수 있다. 단위 테스트는 mock 기반이어서 이 동작을 실행하지 않는다. 실제 PG 실행은 e2e에서만 검증된다.
  - e2e 테스트 A케이스가 이 경로를 커버하므로 런타임 오류 발생 시 e2e에서 잡힌다.
- **제안**: `getUsages()` 쿼리 빌더에 `.setParameter('integrationId', id)` 를 명시적으로 추가해 `where` + `addSelect` 양측의 바인딩을 확실히 공유하도록 보장.

---

## 요약

이번 변경은 `IntegrationUsageNode`에 `usageKind: 'direct' | 'mcp'` 필드를 추가하고 `getUsages()` 쿼리를 MCP 참조(`config.mcpServers[].integrationId`)까지 포함하도록 확장한 것이다. 부작용 관점에서 치명적 이슈는 없다. 인터페이스 측면에서 `IntegrationUsageItemDto`에 `isActive` 필드가 빠져 Swagger 문서가 실제 응답과 불일치하는 점이 가장 실질적 위험이다(WARNING). `remove()`에서 `getUsages()` 재사용으로 인한 이중 `findById` 는 이미 후속 plan ⑦로 이관이 확인된 알려진 부작용이다(WARNING). 프론트엔드 타입 정의(`usageKind` 추가)는 `nodes` 배열 인라인 타입에 정확히 반영됐고, UI 렌더링(`n.usageKind === "mcp"` 분기)도 선택적 배지 표시이므로 `undefined`이 오더라도 렌더링을 망가뜨리지 않는다.

---

## 위험도

**MEDIUM**

*Critical: 0건, Warning: 2건, Info: 3건*

STATUS: DONE
