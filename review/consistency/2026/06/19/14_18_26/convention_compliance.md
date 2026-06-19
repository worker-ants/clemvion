# Convention Compliance Review

검토 모드: --impl-done
Scope: `spec/2-navigation/4-integration.md`
Diff base: origin/main
PR: #633 — DTO/서비스/e2e/i18n 변경

---

## 발견사항

### [WARNING] IntegrationUsageNodeDto 필드에 JSDoc 한국어 주석 누락

- **target 위치**: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `IntegrationUsageNodeDto` 클래스의 `id`, `label`, `type` 세 필드
- **위반 규약**: `spec/conventions/swagger.md §1-1` — "모든 필드에 JSDoc 추가 (한국어)". CLI 플러그인이 JSDoc `/** ... */` 주석을 `description` 으로 변환하므로 DTO 필드에 JSDoc 이 의무.
- **상세**: `IntegrationUsageNodeDto.id`, `.label`, `.type` 세 필드는 `@ApiProperty` 만 붙어 있고 JSDoc 설명 주석이 없다. 같은 클래스의 `usageKind` 필드는 JSDoc 주석이 달려 있어 일관성이 없다. 또한 `IntegrationUsageItemDto.isActive` 필드도 JSDoc이 아닌 일반 `/** ... */` 인라인 주석 형태이지만, 이는 CLI 플러그인이 인식하는 형식이므로 허용된다. 단, `id`·`label`·`type` 은 `@ApiProperty({ format: 'uuid' })` / `@ApiProperty()` 만 있고 description 이 빈다.
- **제안**: `id`, `label`, `type` 필드에 각각 한국어 JSDoc 주석을 추가한다. 예:
  ```ts
  /** 노드 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 노드 표시 이름 */
  @ApiProperty()
  label: string;

  /** 노드 타입 식별자 (예: 'http-request', 'ai-agent') */
  @ApiProperty()
  type: string;
  ```

---

### [WARNING] spec §7.1 사용처 조회 로직이 MCP 참조를 포함하지 않는 상태로 기술됨

- **target 위치**: `spec/2-navigation/4-integration.md §7.1 사용처 조회 로직` (라인 732–736)
- **위반 규약**: CLAUDE.md "정보 저장 위치 — 기술 명세는 `spec/<영역>/*.md` 본문" + "단일 진실 원칙". `spec/conventions/swagger.md` 와 직접 관련은 없으나, spec 이 구현보다 좁은 조건만 기술하면 spec과 구현 사이 갭이 발생한다 (spec-impl-evidence 원칙).
- **상세**: §7.1 은 사용처 조회를 `config->>'integrationId' = :id` 단일 조건으로 기술하며, 노드 응답 shape 도 `nodes: [{ id, label, type }]` 로만 정의한다. 그러나 PR #633 구현은 `mcpServers[].integrationId` 참조(`@>` containment)를 합집합으로 추가하고, 응답 shape 에 `usageKind: 'direct' | 'mcp'` 필드를 추가했다. e2e 테스트 주석도 `spec §7.1` 을 근거로 `direct` 우선 규칙을 인용하지만, spec §7.1 본문에는 이 내용이 없다.
- **제안**: spec §7.1 을 구현과 일치하도록 갱신해야 한다 (developer 역할이 직접 수정할 수 없으므로 `project-planner` 에 위임). 갱신 내용:
  1. 조회 조건에 `mcpServers[].integrationId @> :id` OR 분기 추가 설명.
  2. 노드 응답 shape 에 `usageKind: 'direct' | 'mcp'` 추가 (우선순위: `direct` > `mcp`).
  3. "§7.1 direct 우선" 규칙을 spec 에 명시.

---

### [INFO] IntegrationUsageNodeDto — enum 표기에 `enumName` 미사용

- **target 위치**: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `IntegrationUsageNodeDto.usageKind` 필드
- **위반 규약**: `spec/conventions/swagger.md §1-4` — "enum: `@ApiProperty({ enum: MyEnum, enumName: 'MyEnum' })`"
- **상세**: `usageKind` 필드가 `@ApiProperty({ enum: ['direct', 'mcp'] })` 로 인라인 배열을 쓰고 있다. 규약은 `enumName` 을 병기해 Swagger 스키마에 named enum 을 등록하도록 권장한다. 단, 이 경우 TypeScript `const` enum 이 아닌 inline union 이라 named enum 등록이 강제되지는 않는다. 관행 불일치 수준의 경미한 사항.
- **제안**: Swagger 스키마의 가독성을 높이려면 `enumName: 'IntegrationUsageKind'` 를 함께 지정한다. 또는 `export type IntegrationUsageKind = 'direct' | 'mcp'` 타입을 추출하고 `@ApiProperty({ enum: ['direct', 'mcp'], enumName: 'IntegrationUsageKind' })` 로 기재한다. 필수 수정 사항은 아니다.

---

### [INFO] i18n 키 `usageMcpBadge` — 한글 번역이 영문과 동일 ('MCP')

- **target 위치**: `codebase/frontend/src/lib/i18n/dict/ko/integrations.ts` — `usageMcpBadge: "MCP"`
- **위반 규약**: `spec/conventions/i18n-userguide.md §Principle 2` — ko/en 사전 leaf key parity. 양 사전이 동일 문자열('MCP')을 갖는 것은 parity 기준 위반은 아니다. 단, Principle 2 의 미번역 임시 처리 주석 ("미번역이면 임시로 동일 영문 문자열을 양쪽에 둘 수 있다 (단 후속 PR 로 번역)")에 비추어, 이 경우 'MCP' 는 고유명사라 번역 불필요한 용어이므로 후속 PR 의무는 없다.
- **상세**: 'MCP' 는 프로토콜 명칭(고유명사)으로 한국어 번역 대상이 아니다. 실질적 위반은 아니며 규약의 적용 범위에도 해당하지 않는다.
- **제안**: 수정 불필요. 고유명사 처리로 정상.

---

### [INFO] e2e 테스트 파일 상단 JSDoc 주석에 `spec §7` 참조 — spec 에 해당 절 부재

- **target 위치**: `codebase/backend/test/integration-usage-mcp.e2e-spec.ts` 라인 318 — `(spec/4-nodes/4-integration §7 사용처 추적 — usageKind 'direct'|'mcp')` 주석
- **위반 규약**: 직접 규약 위반은 아니나 명명 일관성 측면 주의 사항. 실제 spec 경로는 `spec/2-navigation/4-integration.md §7` 이며, `spec/4-nodes/4-integration` 는 별개의 노드 spec 폴더다.
- **상세**: 주석이 가리키는 경로(`spec/4-nodes/4-integration §7`)가 실제 사용처 추적 규칙의 위치(`spec/2-navigation/4-integration.md §7`)와 다르다. 코드 탐색 시 잘못된 spec 위치로 안내될 수 있다.
- **제안**: 주석을 `spec/2-navigation/4-integration.md §7 사용처 추적` 으로 정정한다.

---

## 요약

PR #633 의 변경 범위(DTO 신설, 서비스 확장, e2e 추가, i18n 키 추가)는 정식 규약(`spec/conventions/swagger.md`, `spec/conventions/i18n-userguide.md`, `spec/conventions/error-codes.md`) 에 전반적으로 부합한다. 에러 코드 `INTEGRATION_IN_USE` 는 기존 spec §7.2 에 이미 정의된 코드를 재사용하며 오류 없다. 가장 실질적인 문제는 두 가지다: (1) `IntegrationUsageNodeDto` 의 `id`·`label`·`type` 필드에 JSDoc 한국어 주석이 누락되어 `swagger.md §1-1` 의무를 일부 충족하지 못한 점, (2) 구현이 MCP 참조(`mcpServers[].integrationId`) 와 `usageKind` 필드를 추가했음에도 `spec/2-navigation/4-integration.md §7.1` 이 그 변경을 반영하지 않아 spec-impl 갭이 발생한 점. 후자는 developer 역할이 직접 해소할 수 없으며 `project-planner` 에 위임이 필요하다. 나머지 사항(enum `enumName` 미사용, e2e 주석의 spec 경로 오기)은 INFO 수준의 경미한 개선 권고다. Critical 위반은 없다.

## 위험도

LOW

STATUS: DONE
