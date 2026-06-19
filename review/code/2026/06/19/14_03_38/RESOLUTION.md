# RESOLUTION — PR #633 ai-review 후속 처리

대상: `claude/agent-ae9a373e25190d9f9` (PR #633). SUMMARY: 같은 디렉토리 `SUMMARY.md` (BLOCK: NO, Critical 0).

## 적용한 FIX (이번 PR)

### FIX 1 — Swagger DTO 에 usageKind 반영 (api-contract / side-effect WARNING)
- 파일: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
- 별도 `IntegrationUsageNodeDto` 클래스 추출: `id`(uuid), `label`, `type`, `@ApiProperty({ enum: ['direct','mcp'] }) usageKind`.
- `IntegrationUsageItemDto.nodes` 를 `@ApiProperty({ type: [IntegrationUsageNodeDto] }) nodes: IntegrationUsageNodeDto[]` 로 교체 (기존 `Array<{id,label,type}>` + `type:[Object]` 제거).
- 값(`'direct'|'mcp'`)이 서비스 `IntegrationUsageNode`(`integrations.service.ts`)와 일치.

### FIX 2 — 기존 단위테스트 fixture usage_kind 보강 (testing INFO)
- 파일: `codebase/backend/src/modules/integrations/integrations.service.spec.ts`
- remove() 의 "does not broadcast when removal is blocked"·"throws ConflictException when usages exist" raw fixture 에 `usage_kind: 'direct'` 추가.
- getUsages "groups rows by workflow" 의 3개 raw fixture 에 `usage_kind`(direct/direct/mcp) 추가 + `nodes[].usageKind` 어서션 추가(필드 누락 회귀 차단).

### FIX 3 — direct 우선 규칙 단위테스트 (testing/requirement)
- 파일: `integrations.service.spec.ts` (getUsages describe).
- "keeps direct precedence when a node matches both direct and MCP (spec §7.1)" 추가. 양쪽 매칭 시 SQL CASE 가 단일 raw row 를 `usage_kind='direct'` 로 반환하는 상황을 시뮬레이션해 매핑이 단일 'direct' 노드로 나오는지 검증. CASE 식 자체의 실 DB 검증은 e2e 가 담당함을 주석 명시.

### FIX 4 — 실 PostgreSQL e2e (testing WARNING, MEDIUM 위험 해소)
- 신규 파일: `codebase/backend/test/integration-usage-mcp.e2e-spec.ts`
- registerAndLogin + createTeamWorkspace, 통합은 REST(`POST /api/integrations`, http api_key)로 생성, workflow/node 는 createDbClient 로 직접 INSERT.
- 시나리오 A: 노드 A(`config.integrationId`)→`usageKind='direct'`, 노드 B(AI Agent `config.mcpServers[].integrationId`)→`usageKind='mcp'`, 노드 C(무관 통합 id mcpServers)→미포함. 실 PG `@>` containment + CASE 검증.
- 시나리오 B: MCP-only 참조 통합에 대한 `DELETE /api/integrations/:id` → 409, `error.code === 'INTEGRATION_IN_USE'`.

## DEFER (후속 plan 으로 이관)
- 모두 `plan/in-progress/integration-mcp-usage-followups.md` 에 근거와 함께 기록.
  - ⑤ GIN 인덱스 (`node.config` `USING GIN (config jsonb_path_ops)`) — database WARNING(LOW). 기존 `->>` 도 동일 seq scan 이라 회귀 아님, 관리 UI 소규모 경로.
  - ⑥ 삭제 차단 다이얼로그 프론트 미구현 (spec §4.7/§7.2) — requirement MEDIUM, 기존부터의 갭.
  - ⑦ remove() 이중 findById — side-effect WARNING(LOW perf).

## 검증 결과
- 백엔드 타입체크 `npx tsc --noEmit -p tsconfig.build.json`: PASS (오류 0).
  - 주: 이 worktree 에 node_modules 가 없어 main worktree(`/Volumes/project/private/clemvion/codebase/backend/node_modules`)를 symlink 후 실행.
- 단위테스트 `npx jest src/modules/integrations/integrations.service.spec.ts`: PASS (119/119).
- e2e `make e2e-test` (실 PG/Redis/MinIO, docker): PASS. 전체 35 suites / 204 tests 통과, 신규 `integration-usage-mcp.e2e-spec.ts` 포함 PASS. (이 실행 환경에서 docker 가용하여 실제 실행함.)
- 프론트 타입체크: DTO 변경이 프론트 OpenAPI 클라이언트에 영향 가능 — 별도 보고 항목 참조.
