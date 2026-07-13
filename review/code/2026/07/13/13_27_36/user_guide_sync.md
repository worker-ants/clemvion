# 유저 가이드 동반 갱신(User Guide Sync) Review

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 20건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(L111-197) 본문을 Read 해 적용.

## 변경 컨텍스트 요약
본 changeset 은 워크플로 편집기 캔버스의 순수 프런트엔드 기능(§1.3 엣지 재연결/detach + 역방향 연결 확인) 이며, backend `nodes/**`·provider·auth·expression-engine·warningRules/error-codes.ts 변경은 없다. review artifact(`review/code/2026/07/13/{12_40_48,13_06_50}/**`, 19개 파일)와 `_retry_state.json`/`meta.json` 등은 이전 리뷰 세션 산출물이 커밋된 것으로 매트릭스 trigger 대상이 아니다(문서 SoT 아님).

## trigger 매칭

| # | 변경 파일 | 매칭 trigger | 판정 |
|---|---|---|---|
| 1 | `spec/3-workflow-editor/2-edge.md` | `spec-major-change` (`spec/3-*/**` glob) | 매칭 — 아래 검증 |
| 2 | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (.tsx) | `new-ui-string` (glob `*.tsx`, match:semantic) | 매칭 시도했으나 **의미상 불일치** — 신규 렌더 문자열 없음(추가분은 배선 코드 + 한국어 코드 주석뿐, 사용자 표시 문자열 아님). toast 메시지(`These nodes are already connected.`)는 §1.2 기존 문자열 재사용, 신규 아님 |
| 3 | `codebase/frontend/src/lib/utils/edge-utils.ts`, `use-edge-reconnect.ts`, `editor-store.ts` | `new-node` / `node-schema-change` (glob `codebase/backend/src/nodes/**`) | **불일치** — 전부 frontend 경로, backend 노드 디렉토리 아님 |
| 4 | (없음) | `auth-session-flow-change` / `expression-language-change` / `run-debug-flow-change` / `integration-provider-change` / `new-userguide-section-dir` | 해당 파일 없음 — 미매칭 |

`new-userguide-section-dir`(글롭 `codebase/frontend/src/content/docs/*/`) 은 기존 디렉토리 `03-workflow-editor/` 내부 파일 갱신이라 "신규 디렉토리" 조건 미충족 — 미매칭.

## 동반 갱신 확인 — `spec-major-change` (spec/3-workflow-editor/2-edge.md)

필수 target: (a) frontmatter `code:`/`status:`/`pending_plans:` 정합 (b) `status: partial` 이면 `pending_plans:` 존재 (c) `status: implemented` 이면 `code:` 글로브 ≥1 매치.

- (a) frontmatter `code:` 리스트에 신규 `use-edge-reconnect.ts` 가 diff 로 추가됨(확인) — SSOT 갱신 완료.
- `status: partial` 유지(§3.2 실행 상태 스타일 등 잔여 미구현 항목이 spec 본문에 남아 있어 정확) → (b) `pending_plans: [ai-agent-tool-connection-rewrite.md, spec-sync-edge-gaps.md]` 유지 — `plan/in-progress/spec-sync-edge-gaps.md` 가 같은 changeset 에서 §1.3 체크박스만 `[x]` 로 갱신되고 §3.2 는 `[ ]` 로 남아 plan 자체도 in-progress 상태와 정합.
- §1.3 절 본문이 "미구현 · Planned" → 구현 서술로 갱신되고 신규 구현 내용(역방향 연결 native 지원 확인·재연결/detach 메커니즘)이 상세 반영됨.
- 동반 갱신 **완료** — 누락 없음.

## 유저 가이드 MDX 갱신 확인 (매트릭스에 03-workflow-editor 전용 행은 없으나, checklist §177 "사용자 가시면이 코드 변경 의미를 정확히 반영" 관점에서 확인)

- `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx` + `.en.mdx` — 둘 다 같은 changeset 에서 갱신됨. "입력 포트에서 시작" 역방향 연결 문구 + "연결선 고치기·지우기"(재연결/detach/undo) 신규 절이 ko/en **양쪽** 동일 구조로 추가됨 — parity 유지.
  - frontmatter `code:` 글로브에도 `use-edge-reconnect.ts`, `edge-utils.ts` 가 추가됨(직전 라운드 documentation reviewer WARNING 반영, `RESOLUTION.md` 12_40_48 #4 참조) — stale 아님.
- `codebase/frontend/src/content/docs/03-workflow-editor/containers-and-tools.mdx` + `.en.mdx` — 컨테이너 소속 변경 안내 문구를 "드래그가 아니라 연결선을 다시 연결" → "노드를 컨테이너 안으로 드래그해 넣는 게 아니라 body/emit 연결선을 다시 연결" 로 명확화, ko/en 양쪽 동일 갱신 — parity 유지.
- 두 문서 쌍 모두 ko/en 동시 커밋 — i18n parity 가드 위반 없음.

## i18n dict / backend-labels 확인
- 신규 toast·라벨·에러 문자열 없음(§1.3 은 기존 `evaluateConnection` 의 기존 메시지를 재사용) → `dict/{ko,en}/*.ts` 갱신 대상 없음.
- backend `warningRules`/`error-codes.ts` 변경 없음 → `backend-labels.ts` `WARNING_KO`/`ERROR_KO` 갱신 대상 없음.

## 발견사항
없음. 매칭된 유일 trigger(`spec-major-change`)의 필수 동반 갱신이 모두 같은 changeset 안에서 완료됐고, 매트릭스에 명시되지 않은 관련 유저 가이드 MDX(`connecting-nodes`, `containers-and-tools`) 도 ko/en parity 를 유지한 채 선제적으로 갱신되었다. i18n dict·backend-labels 대상 신규 문자열/코드도 없다.

## 요약
매트릭스 20개 행 중 1개(`spec-major-change`, `spec/3-workflow-editor/2-edge.md`)가 매칭되었고, 필수 동반 갱신(frontmatter `code:`/`status:`/`pending_plans:` 정합) 및 매트릭스 밖 관련 유저 가이드 MDX 2쌍(ko/en 4파일)까지 같은 changeset 안에서 빠짐없이 갱신되어 누락 0건이다. 순수 프런트엔드 편집기 기능 변경으로 노드·provider·auth·표현식·warning/error 코드 trigger 는 모두 미매칭.

## 위험도
NONE
