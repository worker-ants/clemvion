---
worktree: user-guide-sync-4af69c
started: 2026-05-16
owner: developer
---

# User Guide ↔ 구현 정합성 보강 (2026-05-16)

## 배경

`frontend/src/content/docs/**` 사용자 매뉴얼이 일부 영역에서 실제 구현(backend/frontend)·spec 과 어긋남이 확인됨. 가이드를 단일 진실(spec/4-nodes, packages/expression-engine, backend/src/nodes)에 다시 맞춘다.

## 작업 범위

다음 4가지 보강만 본 plan 에서 처리한다. **도구 연결(tool connection) 영역은 손대지 않는다** — 그 부분은 `plan/in-progress/ai-agent-tool-connection-rewrite.md` 가 책임지므로 별도 작업으로 분리.

- [x] **02-nodes/ai.mdx (+ .en.mdx)** — `conversationHistory` / `historyCount` 필드 표 행 제거, 실 구현 필드(`contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `excludeFromConversationThread`) 추가. `## Conversation Context` 섹션 신설.
  - 소스: `backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` L246–384, `spec/conventions/conversation-thread.md` §5, `spec/4-nodes/3-ai/0-common.md` §10.
- [x] **02-nodes/integrations.mdx (+ .en.mdx)** — Cafe24 노드 섹션 추가. 풀 등록 흐름은 `/docs/06-integrations-and-config/cafe24` 로 deep-link.
  - 소스: `backend/src/nodes/integration/cafe24/cafe24.schema.ts`, `spec/4-nodes/4-integration/4-cafe24.md`.
- [x] **02-nodes/overview.mdx (+ .en.mdx)** — Integration 카테고리 한 줄 설명에 Cafe24 포함. 카테고리별 페이지 목록은 그대로.
- [x] **04-expression-language/variables-and-context.mdx (+ .en.mdx)** — `$thread` 변수 행을 한눈에-보기 표에 추가 + `## $thread: Conversation Thread` 섹션 신설.
  - 소스: `backend/src/modules/execution-engine/expression/expression-resolver.service.ts` L100–145, `spec/5-system/5-expression-language.md` §4.1 / §4.4.

## 의도적 제외

- **AI Agent 도구 연결 UX 갱신** (Tool Area 사용법, 신규 입력 경로) — `ai-agent-tool-connection-rewrite` plan 에서 별도 처리.
- **영문 frontmatter** — `frontend/src/lib/docs/registry.ts` 의 `isLocaleSibling` 가 `.en.mdx` 를 navigation 등록에서 제외하므로 frontmatter 필수 대상 아님. 위반 아님으로 결론.
- **cafe24 페이지 IA 등록** — `spec/2-navigation/13-user-guide.md` §2 IA 가 cafe24 항목을 빠뜨림. 이는 spec 갱신 사항이므로 `project-planner` 위임 (아래 spec-update 노트 참고).

## 후속(spec 갱신 위임)

다음 항목은 `developer` 권한 밖이므로 `project-planner` 위임. 본 worktree 의 consistency-check 세션 `review/consistency/2026/05/16/08_22_34/SUMMARY.md` 참고.

- `spec/2-navigation/13-user-guide.md` §2 IA 의 `06-integrations-and-config/` 트리에 `cafe24` 항목 추가
- `spec/4-nodes/4-integration/4-cafe24.md` §2/§5.1 의 `{{ $now.iso }}` → `{{ $now }}` 정정 (W1)
- `spec/4-nodes/4-integration/4-cafe24.md` §9.4/§9.8 에 `install_token mismatch 회복 분기` 보강 (W3)
- ~~`spec/4-nodes/4-integration/4-cafe24.md` §5 섹션 번호 불연속 정리 (W4)~~ — **false positive 확인 (2026-05-16, `cafe24-fields-spec-update-e7a3f2`)**. §5.1·§5.3·§5.8 sparse 스키마는 4 integration 노드 (`http_request`, `database_query`, `send_email`, `cafe24`) 공유 컨벤션 (HTTP status code 풍의 카테고리 구분) 으로 `spec/4-nodes/4-integration/0-common.md` §7 노드 출력 색인표가 이 번호 정렬을 전제로 한다. 변경하지 않는다. 결정 근거는 `review/consistency/2026/05/16/11_36_49/SUMMARY.md` 와 `spec/4-nodes/4-integration/4-cafe24.md` §10 CHANGELOG 2026-05-16 항목 참고.
- `spec/5-system/5-expression-language.md` §4.1 에 `$schedule` 변수 추가 (W2)
- `spec/5-system/5-expression-language.md` 함수 목록에 `today()` 함수 명시
- I3, I7, I8, I9, I10 등 정합·구조 항목 (SUMMARY.md 참고)

## 체크리스트

- [x] consistency-check --impl-prep
- [x] DOCUMENTATION (본 plan = 곧 결과물 자체)
- [x] 테스트 — `registry.ts` 단위 테스트에서 모든 .mdx frontmatter 의 `spec`/`code` 경로 실존을 검증함 (변경 결과로 새 spec/code 경로 추가 시 통과 여부 확인)
- [x] TEST WORKFLOW (lint, unit, build)
- [x] REVIEW WORKFLOW
