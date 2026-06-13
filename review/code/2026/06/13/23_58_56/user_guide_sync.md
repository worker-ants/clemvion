# 유저 가이드 동반 갱신(User Guide Sync) 검토 결과

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` 19개 row 적재 완료. 보조 PROJECT.md prose 는 JSON 으로 대체됨.

## 변경 파일 목록 (prompt 기준)

| # | 파일 경로 | 성격 |
|---|-----------|------|
| 1 | `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` | JSDoc 주석 교정 (§6.2→§7.5 레이블) |
| 2 | `plan/complete/spec-sync-resume-dispatch-registry.md` | plan complete 신규 |
| 3 | `plan/complete/spec-update-doc-style.md` | plan complete 신규 |
| 4 | `plan/complete/spec-update-pr2-embedding.md` | plan complete 신규 |
| 5 | `plan/complete/spec-update-sse-single-instance-rationale.md` | plan complete 신규 |
| 6 | `plan/in-progress/spec-update-gap-callout-plan-links.md` | heads-up note 추가 |
| 7~14 | `review/consistency/2026/06/13/23_47_46/*` | 리뷰 산출물 신규 |
| 15 | `spec/conventions/interaction-type-registry.md` | frontmatter `code:` + §1.2 note 추가 |
| 16 | `spec/data-flow/15-external-interaction.md` | Rationale SSE 블록 추가 |
| 17 | `spec/data-flow/7-llm-usage.md` | §1.3 attribution 갭 note 압축 |

## trigger 매칭 분석

| 매트릭스 row id | trigger | 매칭 여부 | 근거 |
|----------------|---------|-----------|------|
| `new-node` | `codebase/backend/src/nodes/**` | 불일치 | 파일 1은 `modules/execution-engine/` — `nodes/` 아님 |
| `node-schema-change` | `codebase/backend/src/nodes/**` | 불일치 | 동일 |
| `new-ui-string` | `codebase/frontend/src/**/*.tsx` (semantic) | 불일치 | TSX 변경 없음 |
| `integration-provider-change` | semantic | 불일치 | 신규/변경 provider 없음 |
| `new-userguide-section-dir` | `codebase/frontend/src/content/docs/*/` | 불일치 | docs 신규 디렉토리 없음 |
| `backend-api-change` | `*.controller.ts`, `**/dto/**` (semantic) | 불일치 | controller/DTO 변경 없음 |
| `new-warning-code` | semantic | 불일치 | warningRules 변경 없음 |
| `new-error-code` | `codebase/backend/src/nodes/core/error-codes.ts` | 불일치 | 해당 파일 미변경 |
| `new-cross-cutting-enum` | semantic | 불일치 | 파일 15 명시: "enum 신규 추가 아님 — WaitingInteractionType 4값 불변" |
| `new-backend-ui-zod-value` | semantic | 불일치 | 신규 zod ui.label/hint/group 값 없음 |
| `new-handler-output-field` | semantic | 불일치 | handler output field 변경 없음 |
| `auth-session-flow-change` | `codebase/backend/src/modules/auth/**` (semantic) | 불일치 | auth 모듈 변경 없음 |
| `auth-config-type-enum-change` | semantic | 불일치 | AuthConfig type enum 변경 없음 |
| `expression-language-change` | `codebase/packages/expression-engine/**` (semantic) | 불일치 | expression engine 변경 없음 |
| `run-debug-flow-change` | semantic | 불일치 | 파일 1 변경은 JSDoc 주석 레이블 교정뿐 (동작·인터페이스·흐름 불변). "실행·디버깅 흐름 변경" 에 해당하지 않음 |
| `env-runtime-change` | semantic | 불일치 | env/runtime 변경 없음 |
| **`spec-major-change`** | `spec/conventions/**` (glob) | **일치** | 파일 15 (`spec/conventions/interaction-type-registry.md`) 매칭 |
| `userguide-gui-flow-section` | `codebase/frontend/src/content/docs/02-nodes/**.mdx` 등 | 불일치 | MDX 파일 변경 없음 |
| `spec-defect-found` | semantic | 불일치 | spec 결함 신규 발견 아님 |

## 동반 갱신 누락 검출

### `spec-major-change` (파일 15: `spec/conventions/interaction-type-registry.md`)

매트릭스 targets:
- frontmatter `code:` / `status:` / `pending_plans:` 정합 갱신
- `status: partial` 이면 `pending_plans:` plan 신설
- `status: implemented` 이면 `code:` 글로브 ≥1 매치 보장

파일 15 변경 내용:
- `status: implemented` (변경 없음 — 기존값 유지)
- `code:` 에 `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` 추가 (이번 PR 포함)
- §1.2 매트릭스 하단에 재개 turn 라우팅 진입점 note 추가

평가:
- `status: implemented` → `code:` ≥1 매치 의무: `resume-turn-dispatch.ts` 가 실존하는 파일이며 이번 PR 에서 frontmatter 에 등재됨. 충족.
- `status: partial` 아니므로 `pending_plans:` 신설 불요.
- frontmatter 정합 갱신: `code:` 추가가 이번 변경 set 에 포함됨. 충족.

**누락 없음** — `spec-major-change` trigger 의 모든 동반 갱신이 동일 변경 set 안에 포함됨.

## 발견사항

변경 파일 전체를 매트릭스 19개 trigger 에 대조한 결과, 동반 갱신 누락에 해당하는 항목 없음.

- 파일 1(`resume-turn-dispatch.ts`) — JSDoc 단순 주석 레이블 교정. 동작·인터페이스·흐름 불변. `run-debug-flow-change` (semantic: "실행·디버깅 흐름 변경") 에 해당하지 않음. `codebase/frontend/src/content/docs/05-run-and-debug/` 갱신 불요.
- 파일 2~6 (`plan/`) — plan 파일 생성·수정. 매트릭스 어떤 trigger 에도 해당 없음.
- 파일 7~14 (`review/`) — 리뷰 산출물. 매트릭스 어떤 trigger 에도 해당 없음.
- 파일 15 (`spec/conventions/interaction-type-registry.md`) — `spec-major-change` trigger 매칭. 동반 갱신(frontmatter `code:` 정합 갱신) 이 이번 PR 에 포함됨. 누락 없음.
- 파일 16 (`spec/data-flow/15-external-interaction.md`) — `spec/data-flow/` 경로는 `spec-major-change` glob(`spec/2-*/**`, `spec/3-*/**`, `spec/4-*/**`, `spec/5-*/**`, `spec/conventions/**`)에 미포함. trigger 매칭 없음.
- 파일 17 (`spec/data-flow/7-llm-usage.md`) — 동일 이유로 trigger 매칭 없음.

## 요약

매트릭스 19개 trigger 중 1개(`spec-major-change`)가 파일 15(`spec/conventions/interaction-type-registry.md`)에 매칭되며, 해당 trigger 의 동반 갱신 요건(frontmatter `code:` 정합 갱신)은 이번 변경 set 에 이미 포함됨. 나머지 18개 trigger 는 어떤 변경 파일에도 매칭되지 않음. 유저 가이드(docs MDX)·i18n dict·backend-labels 동반 갱신 누락 0건.

## 위험도

NONE
