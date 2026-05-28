---
worktree: cafe24-mcp-usage-api
started: 2026-05-28
owner: developer
---

# cafe24 MCP bridge 활동 로그 API 식별 누락 fix

## 배경

배포 후 사용자 보고 (2026-05-28): AI 에이전트 노드에 연결된 cafe24 MCP 가 호출한 API 가 통합 상세 §4.6 Recent activity 탭의 API 컬럼에 `—` 로 표시됨.

## 원인

PR #338 (`integration-activity-api-label`) 에서 4개 통합 핸들러 (cafe24 node / http / db / email) 의 `logUsage` 호출에 `api` 식별 정보를 채웠으나, **cafe24 MCP bridge (`Cafe24McpToolProvider`) 경로는 누락**됐다.

- `spec/5-system/11-mcp-client.md §8.3` 이 "Internal Bridge (`Cafe24McpBridge`) 경로에서 `api_label`/`api_method`/`api_path` 채운다" 고 약속했으나 구현 미반영 — spec-impl 갭.
- `cafe24-mcp-tool-provider.ts` 의 logUsage 2곳 (success line 480, fail line 509) 이 `api` 없이 호출 → 활동 로그에 NULL 저장 → 프론트가 `—` fallback.

## 진단 (둘 다 확인)

| 경로 | 상태 |
|------|------|
| cafe24 노드 핸들러 (`cafe24.handler.ts`) | 정상 — 4곳 logUsage 모두 `api: apiInfo` (PR #338) |
| cafe24 MCP bridge (`cafe24-mcp-tool-provider.ts`) | **버그** — logUsage 2곳 api 누락 |

## 변경 범위

- `cafe24-mcp-tool-provider.ts`:
  - `opEntry` 에서 `resource` 도 destructure (`{ resource, operation }`)
  - `apiInfo = { label: cafe24.<resource>.<operation.id>, method, path }` 구성
  - success / fail logUsage 2곳에 `api: apiInfo` 전달
- `cafe24-mcp-tool-provider.spec.ts`: success / auth-fail 케이스의 logUsage 검증에 `api` assertion 추가
- spec 변경 없음 (§8.3 이 이미 약속한 surface 의 구현 누락을 메우는 fix)

## Phase

- [x] 원인 진단 (cafe24 노드 정상 / MCP bridge 누락 확인)
- [x] test 선작성 (mcp-tool-provider.spec 의 logUsage api 검증)
- [x] fix (resource destructure + apiInfo + 2곳 api 전달)
- [ ] TEST WORKFLOW (lint/unit/build/e2e)
- [ ] REVIEW WORKFLOW (/ai-review + RESOLUTION)
- [ ] plan complete 이동

## 비고

- catalog key 형식은 노드 핸들러와 동일 (`cafe24.<resource>.<operation>`) — frontend cafe24Catalog dict (PR #339 머지) 가 사람 친화 라벨로 변환. 즉 본 fix 머지 후 AI 에이전트 cafe24 호출도 노드 호출과 동일하게 라벨 표시.
