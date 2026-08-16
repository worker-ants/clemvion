# Plan 정합성 검토 — `spec/5-system/` (impl-done)

## 검토 방법
- prompt 번들의 `plan/in-progress/**` 다수가 컨텍스트 예산으로 절단되어 있어, 실제 target 변경(diff)과 관련
  plan 파일은 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-followups-1464c0`)에서 직접
  `git diff origin/main...HEAD` 및 `Read`/`grep` 으로 재확인했다.
- 실제 diff 범위: `spec/5-system/14-external-interaction-api.md` · `spec/5-system/6-websocket-protocol.md` ·
  `spec/1-data-model.md` · `spec/2-navigation/14-execution-history.md` · `spec/4-nodes/1-logic/12-background.md` ·
  `spec/conventions/secret-store.md` + `codebase/backend/src/shared/utils/redact-stored-error.ts`(신규) ·
  `codebase/backend/src/modules/executions/executions.service.ts` 등. `plan/` 쪽은
  `plan/in-progress/eia-internal-rest-error-masking.md`(신규) + `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  갱신 + 5개 plan 의 `in-progress/ → complete/` rename.

## 발견사항

없음 — CRITICAL/WARNING 대상 불일치를 찾지 못했다.

### 확인한 내용 (참고용, 조치 불요)

- **미해결 결정과의 충돌 없음**: 정본 트래커 `spec-sync-external-interaction-api-gaps.md` 는 이번 PR 이
  집행하는 두 항목(**I1** "내부 REST/WS 가 같은 `Execution.error` 에 다른 값을 말한다", **D**
  `interaction.triggerToken` 평문 보관)을 사전에 "택일해서 근거를 남긴다" 로 미결 등재해 두었고,
  `eia-internal-rest-error-masking.md` 는 "사용자가 2026-08-16 에 택일했다" 는 명시적 결정 기록과 함께
  그 결정을 집행한다. target 의 §R17 교체 문구·`secret-store.md §1` 신설 블록이 그 결정 텍스트와 일치한다.
  트래커의 I1·D 항목도 같은 diff 안에서 `[ ]` → `[x]` 로 갱신되어 실제 파일 상태와 부합한다
  (`git diff` 로 대조 완료).
- **선행 plan 미해소 없음**: target 이 재사용하는 `deepRedactSecrets`(→ `eia-terminal-error-sanitize.md`,
  이미 `plan/complete/` 로 rename) · `toTerminalErrorPayload`(→ `eia-terminal-payload.md`, 체크리스트 전항목
  완료) 는 모두 실제로 완료 상태이며 코드도 워크트리에 존재한다(`redact-stored-error.ts`,
  `executions.service.ts` 확인).
- **후속 항목 누락 없음**: target 스코프 밖으로 남긴 3건(WS `execution.node.*` emit 원문 ·
  내부 REST `inputData`/`outputData` 원문 · workflow-assistant `explore-tools.service.ts` 의 키-기반
  마스킹 비대칭)은 모두 트래커에 `[ ]` 로 개별 신규 등재되어 있고, 각각 근거·범위·왜 이번 PR 에서
  안 하는지가 기록돼 있다. `explore-tools.service.ts` 가 `ExecutionsService` 를 경유하지 않고 Repository 를
  직접 주입한다는 사실은 `spec/3-workflow-editor/4-ai-assistant.md:1458` 의 기존 서술과도 정합해,
  이번 마스킹 관문이 그 경로를 구조적으로 비켜간다는 target 의 주장을 뒷받침한다.
- **spec 링크·frontmatter 정합**: `14-external-interaction-api.md`/`14-execution-history.md`/
  `12-background.md` 의 `code:` frontmatter 에 신규 파일(`redact-stored-error.ts`) 및
  `executions.service.ts` 가 반영되어 있고, 헤더(`###`) 텍스트는 변경되지 않아 다른 문서의 앵커 참조
  (`#종결-이벤트의-필드-집합-normative` 등)가 깨지지 않는다.
- **plan rename 후 링크 정합**: `eia-stalled-atomicity.md` 등 5개 plan 이 `in-progress/ → complete/` 로
  이동하면서, 이를 참조하던 다른 4개 in-progress plan(`backend-lint-gate-broken-on-main.md`,
  `retry-turn-terminal-guard.md`, `spec-draft-eia-notification-payload-contract.md`,
  `spec-sync-external-interaction-api-gaps.md`)의 상대경로 링크도 같은 diff 안에서 `../complete/...` 로
  함께 갱신되어 dangling link 가 없다.
- `plan/in-progress/eia-internal-rest-error-masking.md` 의 유일한 미체크 항목은
  `push 게이트 통과 → PR` 뿐이며, 본 검토(`plan_coherence`, impl-done)가 그 게이트의 일부로 보인다 —
  이는 상태 불일치가 아니라 예상된 순서다.

## 요약
target(`spec/5-system/`) 변경은 `plan/in-progress/eia-internal-rest-error-masking.md` 가 문서화한 사용자
택일 결정(I1·D)을 그대로 집행한 결과이며, 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)의
해당 항목·frontmatter·plan rename 링크가 모두 실제 diff 상태와 일치한다. 범위 밖으로 남긴 3건의 잔여
갭도 트래커에 개별 등재되어 후속 항목 누락이 없다. Plan 정합성 관점에서 조치가 필요한 발견사항은 없다.

## 위험도
NONE
