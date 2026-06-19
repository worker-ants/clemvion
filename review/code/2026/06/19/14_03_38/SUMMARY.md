# 코드 리뷰 SUMMARY — 통합 사용처 추적 MCP 참조 포함 (PR #633)

BLOCK: NO

- 대상 PR/branch: `claude/agent-ae9a373e25190d9f9` (PR #633)
- 변경 요지: `getUsages` 를 직접참조(`config->>'integrationId'`) ∪ MCP참조(`config->'mcpServers' @> :mcpProbe::jsonb`) 합집합으로 확장 + `CASE ... 'direct' ELSE 'mcp'` 로 `usageKind` 산출. 프론트 UsageTab MCP 배지 + i18n. `remove()` 가 `getUsages` 재사용으로 MCP 노드도 삭제 차단. 단위테스트 3건 추가.
- 리뷰어: database / api-contract / requirement / testing / side-effect / security (6).
- Critical: 0. 따라서 push 차단 없음.

## 발견 사항 통합 표

| # | 등급 | 리뷰어 | 위치 | 내용 | 조치 |
| --- | --- | --- | --- | --- | --- |
| 1 | WARNING | api-contract / side-effect | `dto/responses/integration-response.dto.ts` `IntegrationUsageItemDto.nodes` | `nodes` 가 `Array<{id,label,type}>` + `@ApiProperty({ type: [Object] })` 로 선언돼 신규 `usageKind` 가 OpenAPI 스키마에 노출되지 않음 (계약 누락) | FIX 1 — `IntegrationUsageNodeDto` 추출, `@ApiProperty({ enum: ['direct','mcp'] }) usageKind` 추가 |
| 2 | INFO | testing | `integrations.service.spec.ts` remove()/getUsages raw fixtures | 일부 raw row mock 에 `usage_kind` 누락 → 반환 `usageKind` undefined (회귀 미검출 위험) | FIX 2 — direct fixture 에 `usage_kind:'direct'` 보강 + 그루핑 테스트에 `nodes[].usageKind` 어서션 |
| 3 | WARNING(req)/INFO(test) | testing / requirement | 단위테스트 | spec §7.1 "양쪽 매칭 시 direct 우선" 규칙(CASE)에 대한 명시 테스트 부재 | FIX 3 — direct 우선 매핑 단위테스트 추가(SQL 자체 검증은 e2e 가 담당함을 주석 명시) |
| 4 | WARNING | testing | e2e 부재 | `@>` containment + CASE 분기는 mock 으로 검증 불가 — 실 PG e2e 필요 (MEDIUM 위험) | FIX 4 — `test/integration-usage-mcp.e2e-spec.ts` 신규: direct/mcp 추적 + false-positive 미포함 + 삭제 차단(409) |
| 5 | WARNING (LOW) | database | `getUsages` `node.config` 조회 | `->>` · `@>` 둘 다 seq scan (인덱스 없음) | DEFER — 기존 `->>` 도 동일, 회귀 아님, 관리 UI 소규모 경로. GIN 인덱스 후속 plan ⑤ |
| 6 | MEDIUM | requirement | 프론트 `page.tsx` 삭제 onError | spec §4.7/§7.2 가 요구하는 삭제 차단 다이얼로그(사용처 목록 + MCP 배지) 미구현, toast 만 (기존 갭) | DEFER — 후속 plan ⑥ |
| 7 | WARNING (LOW) | side-effect | `remove()` | `findOne` 후 `getUsages`(내부 `findById`) 로 통합 행 2회 조회 | DEFER — perf 미미, 후속 plan ⑦ |

## security / 기타

- security-reviewer: 인젝션·시크릿·권한 관련 Critical/Warning 없음. `getUsages` 의 SQL 은 모두 파라미터 바인딩(`:integrationId`, `:mcpProbe`)이며, workspace 스코프(`w.workspace_id = :workspaceId`)로 격리된다.

## 비고

- 본 리뷰는 6개 reviewer 만 실행됐다(변경 성격상 router 가 선택). 비실행 reviewer 의 관점은 본 SUMMARY 범위 밖.
- FIX 1~4 는 본 PR 에서 적용, ⑤⑥⑦ 는 `plan/in-progress/integration-mcp-usage-followups.md` 로 이관.
