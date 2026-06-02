# 유저 가이드 동반 갱신 (User Guide Sync) Review

## 매트릭스 적재 결과

- SSOT: `/Volumes/project/private/clemvion/.claude/config/doc-sync-matrix.json` 정상 적재 (rows 19개)
- 변경 파일 수(main 대비): 43개 (plan/review 포함)
- 관련 트리거 매칭: `backend-api-change`, `integration-provider-change` — 2개

---

## 발견사항

### [WARNING] 신규 embed-config 공개 엔드포인트 — 사용자 가이드 갱신 누락

- **변경 파일:**
  - `codebase/backend/src/modules/hooks/hooks.controller.ts` (신규 `GET :endpointPath/embed-config` 엔드포인트)
  - `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` (신규 DTO)
  - `codebase/backend/src/modules/hooks/embed-config.service.ts` (신규 서비스)

- **매트릭스 항목:** `backend-api-change` — "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"

- **누락된 동반 갱신:**
  - `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx` (미존재)
  - `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.en.mdx` (미존재)
  - 또는 기존 페이지 `07-workspace-and-team/workspaces-and-members.mdx` / `.en.mdx` 내 `interactionAllowedOrigins` 동작 설명 갱신

- **상세:** 워크스페이스 관리자가 `interactionAllowedOrigins` 를 설정하면 웹챗 위젯이 해당 목록 외 도메인에서 완전히 렌더 거부된다(`enforce=true` + origin 불일치 → `phase: "blocked"` → 위젯 미렌더). 이는 사용자 가시 보안 동작이다. 현재 docs에 `interactionAllowedOrigins` 키 및 "embed 차단" 동작을 설명하는 페이지가 전혀 없으므로, 워크스페이스 관리자가 설정 효과를 인지하지 못한 채 의도치 않게 위젯을 전면 차단할 위험이 있다.

- **제안:**
  1. `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx` + `web-chat.en.mdx` 신설해 채널 웹챗 위젯 설정(embed 스니펫, `interactionAllowedOrigins` allowlist 동작, enforce 모드)을 문서화.
  2. 단기적으로 `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` 및 `.en.mdx` 에 `interactionAllowedOrigins` 설정 키 효과(embed 차단 동작) 설명 추가.

---

### [WARNING] 신규 채널(web-chat) 통합 기능(embed allowlist + rich presentations) — 통합 가이드 페이지 미존재

- **변경 파일:**
  - `codebase/channel-web-chat/src/widget/widget-app.tsx` (`phase === "blocked"` -> null 렌더)
  - `codebase/channel-web-chat/src/widget/use-widget.ts` (embed-config fetch + `isEmbedAllowed` 로직)
  - `codebase/channel-web-chat/src/widget/widget-state.ts` (신규 `"blocked"` phase, `BLOCKED` action)
  - `codebase/channel-web-chat/src/widget/components/presentations.tsx` (carousel/table/chart/template 렌더러)
  - `codebase/packages/web-chat-sdk/README.md` (M2 BYO-UI 섹션 추가)

- **매트릭스 항목:** `integration-provider-change` (semantic) — "codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키"

- **누락된 동반 갱신:**
  - `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx` (미존재)
  - `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.en.mdx` (미존재)

- **상세:** `channel-web-chat`은 사용자가 워크플로우 트리거에 연결해 배포하는 채널 통합이다. 이번 변경으로 (a) embed allowlist soft 검증, (b) carousel/table/chart/template rich presentation inline 렌더, (c) per-execution 토큰 자동 갱신, (d) M2 BYO-UI headless 모드 정식화 등 여러 사용자 가시 기능이 추가됐다. 그러나 `06-integrations-and-config/`에 web-chat 채널 전용 통합 가이드 페이지가 존재하지 않아 사용자가 이 기능들을 발견하거나 올바르게 설정할 수 없다.

- **제안:**
  1. `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx` / `web-chat.en.mdx` 신설 — 스니펫 삽입 방법, `interactionAllowedOrigins` allowlist 설정, presentation 노드 사용법, M2 BYO-UI 사용 방법 포함.
  2. 신설 페이지에서 i18n dict 키가 필요한 경우 `codebase/frontend/src/lib/i18n/dict/{ko,en}/` 양쪽 등록.

---

## 영역 무관 판정 (통과)

| 트리거 | 판정 | 근거 |
|---|---|---|
| `new-node` / `node-schema-change` | 해당 없음 | `codebase/backend/src/nodes/` 변경 없음 |
| `new-ui-string` (TSX i18n parity) | 해당 없음 | `channel-web-chat`은 `codebase/frontend/src/` 외부 독립 위젯 SPA — frontend i18n dict 미사용, 기존 위젯 코드도 동일 inline 한국어 패턴(설계 상 정합) |
| `new-warning-code` / `new-error-code` | 해당 없음 | `error-codes.ts` 변경 없음, 신규 warningRule 없음 |
| `expression-language-change` | 해당 없음 | `packages/expression-engine/` 변경 없음 |
| `run-debug-flow-change` | 해당 없음 | 실행 엔진 변경 없음 |
| `auth-session-flow-change` | 해당 없음 | `backend/src/modules/auth/` 변경 없음 (위젯 토큰 refresh는 클라이언트 사이드 스케줄러, auth 미들웨어 변경 아님) |
| `new-userguide-section-dir` | 해당 없음 | `frontend/src/content/docs/`에 신규 디렉토리 없음 |

---

## 요약

매트릭스 19개 트리거 중 2개(`backend-api-change`, `integration-provider-change` semantic)가 매칭됐으며, 누락 2건이 발견됐다. 두 트리거 모두 `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.{mdx,en.mdx}` 신설 누락을 가리키며, 특히 워크스페이스 관리자가 `interactionAllowedOrigins` 설정 시 웹챗 위젯이 해당 도메인 외에서 완전히 차단되는 사용자 가시 동작이 어떤 가이드 페이지에도 설명되지 않은 점이 핵심 누락이다. 신규 errorCode·warningCode·i18n dict 변경·섹션 디렉토리 신설은 없어 CRITICAL 항목은 없다. 발견된 누락 2건은 WARNING 등급이며 동일 경로(`web-chat.mdx`) 신설로 해결 가능하다.

## 위험도

MEDIUM
