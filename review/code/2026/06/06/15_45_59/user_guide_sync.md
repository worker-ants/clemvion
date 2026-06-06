# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

SSOT: `/Volumes/project/private/clemvion/.claude/config/doc-sync-matrix.json` — rows 19개.
보조: PROJECT.md §변경 유형 → 갱신 위치 매핑.

## 변경 파일 (HEAD~3..HEAD)

| 파일 | 영역 |
|------|------|
| `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` | 실행 엔진 내부 구현 |
| `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` | 테스트 |
| `codebase/backend/test/execution-park-resume.e2e-spec.ts` | e2e 테스트 |
| `spec/5-system/4-execution-engine.md` | spec |
| `spec/conventions/execution-context.md` | spec conventions |
| `spec/1-data-model.md` | spec |
| `plan/in-progress/spec-update-exec-park-d6-rehydration-step2.md` | plan |

## 발견사항

해당 없음.

### 상세 매칭 분석

**`execution-engine.service.ts`**

글로브 매칭 시도:
- `codebase/backend/src/nodes/**` (new-node / node-schema-change) — 미매칭 (execution-engine 모듈, 노드 디렉토리 아님)
- `codebase/backend/src/modules/auth/**` (auth-session-flow-change) — 미매칭
- `codebase/packages/expression-engine/**` (expression-language-change) — 미매칭
- `codebase/backend/src/nodes/core/error-codes.ts` (new-error-code) — 미매칭
- `codebase/backend/src/**/*.controller.ts`, `**/dto/**` (backend-api-change) — 미매칭

의미 매칭 (`run-debug-flow-change` — 실행·디버깅 흐름 변경) 검토:
이번 변경은 in-memory `pendingContinuations` / `firstSegmentBarriers` / `armFirstSegmentBarrier` / `settleFirstSegment` / detach 모델을 전부 제거하고, 모든 재개 경로를 §7.5 rehydration 단일 경로로 일원화한 내부 아키텍처 리팩터링이다. 사용자가 인식하는 실행 흐름(폼 대기, 버튼 클릭, AI 대화, 실행 결과 확인)은 변경 전후 동일하다. 신규 에러 코드, 신규 경고 코드, 신규 UI 문자열이 없다. `05-run-and-debug/` 유저 가이드는 사용자가 실행을 시작·확인하는 방법을 다루며 내부 park/rehydration 메커니즘은 다루지 않으므로 갱신 필요 없다.

**`spec/5-system/4-execution-engine.md`, `spec/conventions/execution-context.md`**

글로브 `spec/5-*/**`, `spec/conventions/**` 에 매칭 → `spec-major-change` (id). target 은 frontmatter `code:/status:/pending_plans:` 정합성 — spec 내부 일관성 항목이며 유저 가이드 MDX·i18n dict·backend-labels 갱신 항목이 아니다. 해당 guard_tests(`spec-frontmatter.test.ts`, `spec-code-paths.test.ts`)가 자동 검증한다.

**`spec/1-data-model.md`**

매트릭스 글로브(spec/2-/\*\*, spec/3-/\*\*, spec/4-/\*\*, spec/5-/\*\*, spec/conventions/\*\*)에 미매칭. 의미 매칭 해당 없음(AuthConfig enum·표현식 언어 변경 없음).

**테스트 파일들**

`*.spec.ts`, `*.e2e-spec.ts` — 어떤 trigger 에도 매칭되지 않음.

## 요약

매트릭스 19개 trigger 중 글로브 매칭: `spec-major-change` 1건(spec/5-*/\*\*, spec/conventions/\*\*). 해당 trigger 의 target 은 spec frontmatter 정합성(guard_tests 자동 검증)이며 유저 가이드 동반 갱신 항목이 아니다. 실행 엔진 서비스(`execution-engine.service.ts`)는 어떤 유저 가이드·i18n·backend-labels 동반 갱신 trigger 에도 매칭되지 않는다 — 순수 내부 아키텍처 리팩터링(in-memory park 머신 제거 + rehydration 일원화)이며 사용자 가시 동작 변경 없음. 동반 갱신 누락 0건.

## 위험도

NONE
