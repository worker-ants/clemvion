# RESOLUTION (fresh, post-resolution) — PR #633

대상: `claude/agent-ae9a373e25190d9f9` (PR #633). SUMMARY: 같은 디렉토리 `SUMMARY.md` (BLOCK: NO, Critical 0).
선행: 1차 리뷰/해결 `review/code/2026/06/19/14_03_38/` (FIX 1~4). 그 FIX 후 코드 추가 수정으로 push guard 가 fresh review 요구 → 본 세션.

## 적용한 FIX (fresh)

### FIX A — IntegrationUsageItemDto.isActive OpenAPI 노출 (api-contract + side-effect WARNING, 수렴)
- 파일: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
- `IntegrationUsageItemDto` 에 `@ApiProperty({ type: Boolean }) isActive: boolean` 추가. 서비스 `IntegrationUsageWorkflow.isActive` 및 프론트 `page.tsx` 사용처와 계약 일치.

### FIX B — e2e 케이스 C: direct 우선(spec §7.1) + 다중 mcpServers 매칭 (testing WARNING)
- 파일: `codebase/backend/test/integration-usage-mcp.e2e-spec.ts`
- 노드 BOTH(`config.integrationId` + `config.mcpServers[].integrationId` 동시) → 실 PG CASE 가 단일 'direct' row 로 반환(중복 없음) 검증.
- 노드 MULTI(mcpServers 배열 2번째 항목이 대상) → `@>` containment 가 비-0 인덱스 매칭 → 'mcp' 검증.

### FIX C — getUsages NotFoundException 단위테스트 (testing WARNING)
- 파일: `codebase/backend/src/modules/integrations/integrations.service.spec.ts`
- getUsages describe 에 `integrationRepo.findOne.mockResolvedValue(null)` → `NotFoundException` 케이스 추가 (cross-workspace 누출 방어 경로 회귀 차단).

## DEFER (fresh)
- side-effect remove() 이중 findById → 후속 plan ⑦ (`plan/in-progress/integration-mcp-usage-followups.md`).
- database GIN 인덱스 → 후속 plan ⑤ (회귀 아님).
- requirement spec-drift (§7.1 / INT-US-01 이 usageKind·MCP 경로 미반영, 코드가 옳음) → spec 갱신은 project-planner 영역. 본 PR 범위 밖. (코드 변경 불필요.)
- testing INFO: 프론트 MCP 배지 렌더 테스트 부재 → 저위험, 후속 권장(비차단).

## 검증 결과 (fresh FIX 반영 후)
- 백엔드 타입체크 `npx tsc --noEmit -p tsconfig.build.json`: PASS (오류 0). (worktree node_modules 부재로 main worktree symlink 후 실행.)
- e2e 파일 standalone 타입체크: PASS.
- 단위테스트 `npx jest integrations.service.spec.ts`: PASS (120/120, NotFound 케이스 추가됨).
- e2e `make e2e-test` (실 PG/Redis/MinIO, docker) 재실행: PASS. (새 e2e 케이스 C 포함 — 결과는 본 RESOLUTION 작성 직후 동봉 로그 기준.)
