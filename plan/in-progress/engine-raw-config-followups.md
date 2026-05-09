# Engine Raw Config Exposure — Follow-ups

`plan/complete/engine-raw-config-exposure.md` 의 7단계 phase 가 모두 종료된 후에도 회귀 위험을 분리해 별도로 진행하는 후속 작업 모음.

## 배경

본 PR (raw config exposure) 의 25개 핸들러 마이그레이션 (Phase 3) 에서 다음 두 항목은 회귀 위험·범위 한정성 때문에 follow-up 으로 분리됐다.

## Follow-up 1 — AI Agent multi-turn helper rawConfig plumbing — ✅ 완료 (2026-05-09)

**현황** (2026-05-09 재확인 → 조치 완료):
- `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 의 `buildMultiTurnFinalOutput` / `buildConditionOutput` 에 `rawConfig?: Record<string, unknown>` 파라미터 추가, 새 private helper `buildMultiTurnConfigEcho` 가 mode/model 외 systemPrompt·userPrompt·maxTurns·maxToolCalls·responseFormat·knowledgeBases·conditions 를 raw 그대로 echo. 호출자 4 곳 (line 595/1034 buildConditionOutput, line 1159 buildMultiTurnFinalOutput, line 1246 endMultiTurnConversation) 모두 `context.rawConfig` 또는 `state.rawConfig` 를 전달.
- `backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` 의 `MultiTurnState` 에 `rawConfig?` 필드 추가, `executeMultiTurn` 의 stateBase 에 `context.rawConfig ?? config` 저장, `hydrateState` 가 raw.rawConfig 를 hydrate. `multiTurnConfigEcho` 가 raw 의 model·outputSchema·instructions·examples·inputField·maxTurns·maxCollectionRetries 를 우선 echo (state 평가값은 fallback).
- 엔진 `execution-engine.service.ts:1838` 가 첫 waiting tick 에 node.config 를 frozen snapshot 으로 resumeState 에 자동 merge — 라이프사이클상 multi-turn waiting → resumed → ended 모두 동일한 raw snapshot 을 본다 (handler 가 명시 설정한 rawConfig 가 있으면 존중).

**테스트 보강**:
- `ai-agent.handler.spec.ts` — `buildMultiTurnFinalOutput` 에 raw echo 통과 + fallback 케이스 2 건, condition-triggered execute() 의 `output.config` 가 `context.rawConfig` 의 systemPrompt/conditions 를 echo 하는지 검증 1 건.
- `information-extractor.handler.spec.ts` — `buildMultiTurnFinalOutput` 의 raw echo (template 보존) + 평가값 fallback 케이스 2 건.
- TEST WORKFLOW: backend lint clean, 2908 unit tests green, build green.

**Spec 갱신**:
- `spec/4-nodes/3-ai/1-ai-agent.md` §7 머리 — Principle 7 raw echo 정책 명시.
- `spec/4-nodes/3-ai/3-information-extractor.md` §5 머리 — single/multi-turn waiting/ended 모두 raw echo 명시.

## Follow-up 2 — Carousel / Table output 1MB cap — ✅ 완료 (2026-05-09)

**정책 결정**: (b) Presentation 노드는 1MB cap 적용 (사용자 가시 surface — integration 의 256KB 보다 4× 큰 한계 허용). 초과 시 array 형태 유지하면서 tail 부터 element 단위로 잘라낸 뒤 `*Truncated: true` + `*TotalCount` 플래그로 표면화.

**조치**:
- `backend/src/nodes/integration/_base/truncate-body.util.ts` 에 `PRESENTATION_MAX_BYTES = 1024 * 1024` 상수와 `truncateArrayForOutput<T>(arr, maxBytes)` shape-preserving helper 추가 (binary-search tail-drop, cyclic element 안전 처리).
- `backend/src/nodes/presentation/carousel/carousel.handler.ts` — `payload.items` 에 `truncateArrayForOutput` 적용, 초과 시 `payload.itemsTruncated: true` + `payload.itemsTotalCount` 추가.
- `backend/src/nodes/presentation/table/table.handler.ts` — `payload.rows` 에 동일 패턴 적용 (`rowsTruncated` / `rowsTotalCount`). `totalRows` 는 cap 적용 전 전체 데이터셋 크기를 그대로 노출 (다운스트림 mismatch 감지 보조).

**테스트 보강**:
- `truncate-body.util.spec.ts` — `truncateArrayForOutput` 6 케이스 (under-cap pass-through / empty / tail-drop / shape preservation / non-array / cyclic).
- `carousel.handler.spec.ts` — 1MB 미만 pass + 초과 truncation 2 케이스.
- `table.handler.spec.ts` — 1MB 미만 pass + 초과 truncation 2 케이스 (`totalRows` ≠ `rows.length` 검증).
- TEST WORKFLOW: backend lint clean, 2919 unit tests green, build green.

**Spec 갱신**:
- `spec/4-nodes/6-presentation/0-common.md` §4 — 1MB cap + truncation 시 array 형태 유지 + `rendered` 는 cap 대상 아님 + integration 256KB 와의 비교 명시.
- `1-carousel.md` §4, `2-table.md` §4 — output 절에 truncation flag 한 줄씩 추가.

## 우선순위

| Follow-up | 우선순위 | 상태 |
| --- | --- | --- |
| #1 AI Agent helper plumbing | 중 — 일관성 향상, 회귀 위험 중 | ✅ 완료 (commit `808c4c35`) |
| #2 Carousel/Table cap | 저 — 정책 결정 선행 | ✅ 완료 (1MB cap 적용) |

## 후속 작업

- ai-review 1회 (전체 변경 대상) — 두 커밋 합산.
- ai-review 결과 처리 후 본 문서를 `plan/complete/` 로 `git mv`.
