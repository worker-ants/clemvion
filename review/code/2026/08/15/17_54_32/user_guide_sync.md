# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재 확인
`.claude/config/doc-sync-matrix.json` 의 `rows[]` (21행) 을 SSOT 로 사용. 변경 파일 17건(`git diff` 기반 orchestrator payload)을 각 행의 `trigger.globs`/semantic 기준과 대조.

## 변경 파일 요약
- `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.{ts,spec.ts}` — 종결 이벤트(`completed`/`failed`/`cancelled`) payload 조립을 위한 신규 판별 union 타입 파사드(`emitTerminalExecution`) 도입
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `retry-turn.service.{ts,spec.ts}` — 위 파사드로 직접 `emitExecution` 호출 11곳을 교체, `retry-turn.service.ts` 의 `failRetryExecution` cancelled 분기에 누락돼 있던 `cancelledBy: 'user'` 필드를 채우는 버그 수정
- `plan/in-progress/eia-terminal-emit-facade.md` (신규), `retry-turn-terminal-guard.md`, `spec-sync-external-interaction-api-gaps.md` — plan 갱신
- `review/consistency/2026/08/15/17_20_28/*` — 병행 consistency-check 산출물 (본 리뷰 대상 아님)
- `spec/5-system/14-external-interaction-api.md` — §6 필드 집합 표의 `result.cancelledBy` 행을 "구현됨 — 경로 1곳 누락" → "구현됨" 으로 갱신

## 매트릭스 매칭 결과

- `new-node` (`codebase/backend/src/nodes/**`) — 미매칭. 변경 파일은 전부 `modules/execution-engine/**` 이며 `nodes/**` 아님.
- `node-schema-change` — 미매칭 (동일 사유).
- `new-ui-string` (`**/*.tsx`) — 미매칭. TSX 변경 없음.
- `integration-provider-change` — 미매칭. provider 코드 무변경.
- `new-userguide-section-dir` — 미매칭. `content/docs/` 무변경.
- `backend-api-change` (`**/*.controller.ts`, `**/dto/**`) — 미매칭. controller/DTO 파일 없음.
- `new-warning-code` / `new-error-code` — 미매칭. `warningRules`/`error-codes.ts` 무변경.
- `new-cross-cutting-enum` — 미매칭. `cancelledBy: 'user'|'system'|'timeout'` 은 spec §4.1 에 이미 존재하던 닫힌 union 이고 이번 PR 이 값을 추가하지 않음(구현 파사드로 강제만 함).
- `new-handler-output-field` — 미매칭. `durationMs`/`result.cancelledBy` 는 spec §6 에 기존에 이미 문서화된 필드이며 신규 키 추가가 아님.
- `auth-session-flow-change`, `expression-language-change` — 미매칭. `auth/**`, `packages/expression-engine/**` 무변경.
- `spec-major-change` (`spec/5-*/**`) — **매칭**(`spec/5-system/14-external-interaction-api.md`). 다만 대상(frontmatter `code:`/`status:`/`pending_plans:` 정합)은 consistency-checker 영역이며, 본 changeset 에 이미 병행 consistency-check 산출물(`review/consistency/2026/08/15/17_20_28/`)이 함께 있어 별도 세션에서 다뤄짐. frontmatter 확인 결과 `status: partial` + `pending_plans:` 가 실제로 이 changeset 에서 갱신되는 `spec-sync-external-interaction-api-gaps.md` 를 정확히 가리키고 있어 정합함(참고 확인, 본 리뷰어 판정 범위 밖).
- `run-debug-flow-change` (semantic, "backend 실행 엔진·디버그 로깅 변경 → `05-run-and-debug/`") — **그레이존 매칭**. `execution-engine.service.ts`/`retry-turn.service.ts` 는 문자 그대로 "실행 엔진" 이지만, 실제 변경은 (a) 내부 payload 조립 리팩터(파사드 도입, wire 형태 동일 유지) + (b) 이미 spec 에 명시돼 있던 `result.cancelledBy` 필드가 한 경로에서 누락되던 버그의 수정. `cancelledBy` 는 `codebase/frontend/src` 전체에서 소비처가 0곳(grep 확인) — 메인 앱 UI(`05-run-and-debug/` 대상 run-results/error-handling/running-a-workflow.mdx)에는 노출되지 않는 EIA(외부 API) 전용 필드다. `docs/02-nodes/triggers.mdx` 가 EIA 종결 payload 를 문서화하는 실제 위치인데, 거기도 `durationMs` 는 있지만 `cancelledBy` 자체는 원래부터 문서화돼 있지 않다 — 이는 이번 PR 이전부터 있던 gap 이고, 이번 PR 이 새로 만든 gap 이 아니다(신규 필드 추가가 아니라 기존 스펙 필드의 구현 완결).

## 발견사항

- **[INFO]** `run-debug-flow-change` 그레이존 — docs 갱신 불필요로 판단, 근거 명시
  - 변경 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
  - 매트릭스 항목: `run-debug-flow-change` — "backend 실행 엔진·디버그 로깅 변경이 `05-run-and-debug/` 갱신 누락"
  - 상세: 변경은 (1) 기존 wire 형태를 그대로 유지하는 내부 리팩터(판별 union 파사드), (2) `result.cancelledBy` 가 `failRetryExecution` 한 경로에서 누락되던 기존 버그의 수정(spec §6 표는 이미 "경로 1곳 누락"으로 알려진 gap 을 추적 중이었고, 이번 PR 이 그걸 닫음). `cancelledBy` 는 frontend 메인 앱 어디에서도 소비되지 않는(grep 0건) EIA 전용 필드이며, `05-run-and-debug/*.mdx` (run-results/error-handling/running-a-workflow)는 이 필드를 다루지 않는다. EIA 종결 payload 를 실제로 문서화하는 곳은 `docs/02-nodes/triggers.mdx` 인데, 거기도 `cancelledBy` 는 이번 PR 이전부터 문서화돼 있지 않았다(pre-existing gap, 본 PR 이 만든 gap 아님).
  - 제안: 조치 불필요. 다만 `docs/02-nodes/triggers.mdx` §Inbound 이벤트 스트림에 `execution.cancelled` payload 의 `result.cancelledBy`(`user`/`system`/`timeout`) 필드를 향후 별도 문서 개선 항목으로 등재하면 좋음(이번 PR 범위는 아님).

## 요약
매트릭스 21행 중 glob 매칭 1건(`spec-major-change` — frontmatter 정합, consistency-checker 영역이며 이번 changeset 내 확인 결과 정합), semantic 그레이존 1건(`run-debug-flow-change`)을 검토했으나 두 건 모두 실질적 동반 갱신 누락으로 이어지지 않았다. 변경 세트는 순수 backend 내부 리팩터(종결 이벤트 emit 타입 파사드)와 버그 수정 + plan/spec 추적 갱신으로, `codebase/backend/src/nodes/**`, `frontend/src/**/*.tsx`, `content/docs/**`, `i18n/dict/**`, `backend-labels.ts`, `auth/**`, `expression-engine/**`, `error-codes.ts`/`warningRules` 등 doc-sync 트리거 glob 에 해당하는 파일이 전혀 없다. 유저 가이드(MDX)·i18n dict·backend-labels·locale.ts 동반 갱신 누락 없음.

## 위험도
NONE
