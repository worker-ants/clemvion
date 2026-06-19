# Convention Compliance Review (재확인)

검토 모드: --impl-done (재확인)
Scope: `spec/2-navigation/4-integration.md`
Diff base: origin/main
PR: #633
직전 세션: 14_18_26

---

## W-3 / I-5 수정 확인

### W-3 — IntegrationUsageNodeDto.id/.label/.type JSDoc 한국어 추가 여부

직접 파일 읽기 결과 (`integration-response.dto.ts` 라인 322–343):

```ts
/** 사용처 조회 응답의 노드 항목 */
export class IntegrationUsageNodeDto {
  /** 노드 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 노드 표시 라벨 */
  @ApiProperty()
  label: string;

  /** 노드 타입 (예: http-request, ai-agent) */
  @ApiProperty()
  type: string;
  ...
}
```

판정: **해소됨**. `id`, `label`, `type` 세 필드 모두 한국어 JSDoc 주석이 추가됐다. `swagger.md §1-1` 의무 충족.

---

### I-5 — e2e 주석 spec 경로 오기 수정 여부

직접 파일 읽기 결과 (`integration-usage-mcp.e2e-spec.ts` 라인 12):

```
(spec/2-navigation/4-integration.md §7 사용처 추적 — usageKind 'direct'|'mcp').
```

판정: **해소됨**. 직전 세션에서 지적한 `spec/4-nodes/4-integration §7` 오기가 올바른 경로 `spec/2-navigation/4-integration.md §7` 로 정정됐다.

---

## 정식 규약 준수 재검토

### 발견사항

#### [INFO] IntegrationUsageItemDto.workflowId/.workflowName/.nodes 필드 JSDoc 부재 (기존 코드)

- **target 위치**: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `IntegrationUsageItemDto.workflowId`, `.workflowName`, `.nodes`
- **위반 규약**: `spec/conventions/swagger.md §1-1` — 모든 필드 JSDoc (한국어) 의무
- **상세**: 세 필드 모두 `@ApiProperty(...)` 만 있고 JSDoc 주석이 없다. 단, 이 필드들은 이번 PR 의 신규 추가 대상이 아니고 원래 코드베이스에 이미 있었다. 이번 PR 에서 새로 추가된 `isActive` 필드는 `/** 워크플로우 활성화 여부... */` JSDoc 이 정확히 붙어 있어 규약을 준수한다. 기존 코드 미준수 사항은 별도 정비 트랙이므로 PR #633 의 채택을 차단하지 않는다.
- **제안**: 별도 리팩터 PR 에서 `workflowId`, `workflowName`, `nodes` 에 JSDoc 주석 보강.

---

#### [INFO] IntegrationUsageNodeDto.usageKind — enum 인라인 배열, enumName 미지정 (직전 세션 I-4 유지)

- **target 위치**: `integration-response.dto.ts` — `IntegrationUsageNodeDto.usageKind` 필드 `@ApiProperty({ enum: ['direct', 'mcp'] })`
- **위반 규약**: `spec/conventions/swagger.md §1-4` — enum 표기에 `enumName` 권장
- **상세**: 이번 재확인에서도 동일하게 `enumName` 없이 인라인 배열만 지정돼 있다. Swagger 스키마에서 `IntegrationUsageKind` 라는 명칭으로 등록되지 않아 스키마 탐색 시 익명 enum 으로 표시된다. 직전 세션과 동일한 INFO 수준이며 채택 차단 사항이 아니다.
- **제안**: `@ApiProperty({ enum: ['direct', 'mcp'], enumName: 'IntegrationUsageKind' })` 로 변경하거나 타입 별칭을 추출 후 참조.

---

#### [INFO] spec §7.1 — MCP 참조 / usageKind 내용 미갱신 (직전 세션 W-2 유지)

- **target 위치**: `spec/2-navigation/4-integration.md §7.1`
- **위반 규약**: CLAUDE.md 단일 진실 원칙 — 기술 명세는 `spec/<영역>/*.md` 본문이 SoT
- **상세**: 이 항목은 `developer` 역할이 직접 수정할 수 없어 `project-planner` 위임이 필요한 사항이다. 이번 PR 재확인 범위에서 spec 파일이 변경되지 않았으므로 갭이 여전히 존재한다. PR #633 의 코드 규약 준수에는 영향을 미치지 않으나 spec-impl 갭으로 별도 추적이 필요하다.
- **제안**: `project-planner` 에 spec §7.1 갱신 위임 (MCP 참조 `@>` 조건 및 `usageKind: 'direct' | 'mcp'` 응답 shape 추가, §7.1 direct 우선 규칙 명시).

---

### 신규 CRITICAL/WARNING 없음

이번 재확인에서 직전 세션 W-3(JSDoc 누락)과 I-5(spec 경로 오기) 가 모두 해소됐다. 나머지 사항은 INFO 수준이며 PR 채택을 차단하지 않는다. 신규 CRITICAL 또는 WARNING 발견 없음.

---

## 요약

PR #633 의 정식 규약 준수 재검토 결과: 직전 세션(14_18_26)이 지적한 W-3(`IntegrationUsageNodeDto.id/.label/.type` JSDoc 누락)과 I-5(e2e 주석 spec 경로 오기) 모두 이번 커밋에서 해소됐음을 파일 직독으로 확인했다. `swagger.md §1-1` 기준 신규 추가 필드(`isActive`, `IntegrationUsageNodeDto` 전체)는 규약을 준수한다. 나머지 INFO 사항(기존 필드 JSDoc 미비, enumName 미지정, spec §7.1 갭)은 이 PR 의 범위 밖이거나 별도 트랙 대상이다. Critical 0건 / Warning 0건.

## 위험도

LOW

STATUS: DONE
