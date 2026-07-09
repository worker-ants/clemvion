# Rationale 연속성 검토 — spec/4-nodes/7-trigger/1-manual-trigger.md

검토 모드: --impl-done (diff-base `origin/main`, HEAD 워크트리 `/Volumes/project/private/clemvion/.claude/worktrees/manual-trigger-default-param-e0d395`)

## 조사 방법

- target spec (`spec/4-nodes/7-trigger/1-manual-trigger.md`)은 이번 PR 에서 **변경되지 않았다** (순수 코드 정합 fix, `plan/in-progress/manual-trigger-default-param.md` 참조: "3지점 방어로 수정, spec 변경 아님"). target 문서 자체는 `## Rationale` 섹션이 없다(§7 캔버스 요약에서 종료).
- 코드 diff 가 건드리는 두 영역의 관련 spec 을 직접 열람해 과거 결정과 대조했다:
  - `spec/5-system/4-execution-engine.md` (`## Rationale`, "재진입 시 config expression 재평가" 항 포함)
  - `spec/2-navigation/1-workflow-list.md` (`## Rationale` "2. Import 의 permissive config 정책")
  - `spec/3-workflow-editor/0-canvas.md` (`## Rationale` R-3, 2026-07-08 재확정)
  - `spec/data-flow/11-workflow.md` §1.1 (restore 가 saveCanvas 경로를 재사용한다는 서술) 및 `## Rationale`
  - `spec/3-workflow-editor/5-version-history.md` §7.3
  - `spec/1-data-model.md` (`Execution.input_data` 컬럼 정의)
- plan 파일의 자체 반성 기록(cross_spec CRITICAL 재조정, ai-review CRITICAL 되돌림)도 대조해 "이미 한 번 거부된 접근을 다시 넣지 않았는지" 확인했다.

## 발견사항

- **[WARNING]** `restoreVersion` 의 param-schema 게이트 skip 이 "restore = saveCanvas 경로 재사용" 서술과 어긋나는데 새 Rationale 이 없음
  - target 위치: target spec 자체엔 없음(코드: `codebase/backend/src/modules/workflows/workflows.service.ts` `saveCanvas(..., skipParamSchemaValidation = false)` / `restoreVersion` → `saveCanvas(..., true)`)
  - 과거 결정 출처: `spec/data-flow/11-workflow.md` §1.1 "**버전 restore**: … 통과하면 snapshot 을 SaveCanvasDto 로 변환해 **`saveCanvas` 경로를 재사용한다**" (본문 서술, `## Rationale` 자체는 이 항목을 별도로 다루지 않음) + `spec/3-workflow-editor/5-version-history.md` §7.3 "응답: `{ workflow, nodes, edges }` (saveCanvas 와 동일)"
  - 상세: 이번 PR 이전에는 `validateManualTrigger` 에 파라미터 스키마 검증 자체가 없었으므로 save/restore 가 동일 검증을 받는다는 서술과 실제 동작이 일치했다. 이번 PR 은 save 경로에 새 hard-fail 게이트(`INVALID_TRIGGER_PARAMETERS`)를 추가하면서 **restore 경로에만 skip 플래그**를 도입해 "재사용" 서술이 더 이상 완전히 성립하지 않는 예외를 만들었다. 예외 자체(레거시 스냅샷이 신설 게이트로 복원 불가능해지는 것을 막는 하위호환 조치)는 코드 주석과 plan 문서(`workflows.service.spec.ts` 주석 "historical snapshots may pre-date the save-time parameter gate")에는 남아 있지만, `spec/` 어디에도(target 문서에 `## Rationale` 섹션 자체가 없고, `data-flow/11-workflow.md` 의 `## Rationale` 에도 미기재) 이 결정이 SoT 로 기록돼 있지 않다. 다음에 "restore 도 save 와 완전히 동일해야 한다"는 전제로 코드를 되돌리는 회귀가 발생해도 근거를 spec 에서 찾을 수 없다.
  - 제안: `spec/4-nodes/7-trigger/1-manual-trigger.md` 끝에 `## Rationale` 섹션을 신설(§6 gate 도입 근거 + 이 restore 예외)하거나, `spec/data-flow/11-workflow.md` 의 `## Rationale` 에 "restore 는 saveCanvas 를 재사용하되 param-schema 게이트는 예외" 항목을 추가. `data-flow/11-workflow.md` §1.1 본문에도 "(단, param-schema 검증은 restore 시 skip)" 한 줄을 덧붙이는 것으로 최소 정합화 가능.

- **[INFO]** target 문서에 `## Rationale` 섹션 자체가 부재 — 이번 PR 이 도입한 비자명한 결정들의 SoT 가 코드 주석/plan 문서에 흩어져 있음
  - target 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` 전체 (§7 로 종료, `## Rationale` 없음)
  - 과거 결정 출처: 해당 없음 (신설 제안) — CLAUDE.md 정보 저장 규약 "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
  - 상세: 이번 PR 은 (a) §6 이 이미 선언했던 "handler.validate (저장 시점)" 문구를 처음으로 실제 save-time hard-fail 로 구현, (b) `loadTriggerParameterSchema` 조회 키를 `category=TRIGGER` → `type=manual_trigger` 로 전환, (c) 3개 엔진 재진입 dispatch 지점의 `input:{}` → `savedExecution.inputData` 전환 을 수행했다. 셋 다 "왜 이렇게 했는가/왜 이전 방식이 틀렸는가"가 코드 주석·plan 문서에는 잘 남아 있으나, 프로젝트 규약상 SoT 위치인 spec `## Rationale` 에는 없다. 지금 당장 위반은 아니지만(스펙 변경 없이 "구현 정합" 판단은 정당), 향후 이 결정들을 이유 없이 되돌리는 회귀가 생겨도 spec 에서 막을 근거가 없다.
  - 제안: 필수는 아니나, `project-planner` 후속 작업으로 `## Rationale` 섹션을 신설해 (a)(b)(c) 세 결정을 1~2문단씩 기록하면 향후 회귀 방지에 도움.

## 확인했으나 위반 아님 (positive continuity — 참고용)

- **엔진 재진입 `input: {}` → `savedExecution.inputData` 전환**: 과거 spec 이 "재기동 후 input 소실"을 정책으로 못박은 곳이 없다. `Execution.input_data` 는 `spec/1-data-model.md` 상 평범한 JSONB 컬럼(디폴트로 durable) 이라, 옛 코드 주석("재기동 후 사라졌으므로")이 오히려 기존 데이터 모델과 어긋난 버그였다. 이번 fix 는 기존 스펙과 상충하지 않고 오히려 정합화한다.
- **`retry-turn.service.ts` 는 의도적으로 `savedExecution.inputData` fallback 을 쓰지 않음**: 새 주석 "이 경로의 `$input.*` 미해소는 spec 5-system/4-execution-engine.md §retry 에 문서화된 동작"은 실제로 해당 spec 의 `## Rationale` "재진입 시 config expression 재평가" 항목("`_retryState` 는 … 원본 nodeInput 을 포함하지 않으므로 `$input.*` 는 미해소 … documented limitation")과 정확히 일치한다. 다른 두 재진입 경로와의 비대칭 처리를 정당한 근거로 문서화한 좋은 사례.
- **프론트 즉시 store 커밋 미도입**: plan 문서에 따르면 초기 iteration 에서 파라미터 편집을 즉시 store 에 커밋하는 접근을 시도했다가 `spec/3-workflow-editor/0-canvas.md` `## Rationale` R-3(2026-07-08, "설정은 Save changes 클릭 시에만 반영") 위반으로 ai-review CRITICAL 을 받고 되돌렸다. 최종 diff(`trigger-configs.tsx`)는 실제로 인라인 에러 표시만 추가하고 커밋 로직은 건드리지 않아, 기각된 대안이 재도입되지 않았음을 확인했다.
- **"all-or-nothing" 파라미터 스키마 검증 유지**: plan 문서에 따르면 resolve 레벨에서 유효한 파라미터만 부분 채택(lenient partition)하는 대안을 검토했다가 "엔진 handler.validate 게이트가 먼저 throw 해 무의미"하다는 cross_spec CRITICAL 로 기각·원복했다. 최종 diff 에 `resolve-trigger-parameters.ts` 변경이 없어(diff 목록에 파일 자체가 없음) 이 기각이 유지됐음을 확인했다. target §6 의 "4가지 구조 위반 모두 단일 `invalid_schema` 로 산출(머신 코드 단일화)" 원칙과도 부합.
- **에러 코드 재사용**: 신설된 save-time 게이트가 기존 `INVALID_TRIGGER_PARAMETERS` 코드 + 공용 헬퍼 `toTriggerParameterErrorDetails` 를 그대로 재사용한다. target §6 이 이미 문서화한 "내부 분류 문자열은 공용 헬퍼가 `error.details[]` 로 정규화" 패턴과 일치하며, 새 코드를 임의로 발명하지 않았다.
- **type-based 트리거 조회 전환**: `category=TRIGGER` → `type=manual_trigger` 전환에 대해 이를 명시적으로 반대하거나 category 조회를 못박은 과거 Rationale 은 spec 어디에도 없다(구조 위반 재도입이 아님).

## 요약

target spec 문서 자체는 이번 PR 에서 변경되지 않았고, 코드 변경 3건(엔진 재진입 durable input, 트리거 노드 type 기반 조회, save-time 파라미터 스키마 hard-fail) 은 모두 실측 가능한 버그 수정이며 어느 것도 기존 spec `## Rationale` 에서 명시적으로 기각된 대안을 다시 들여오지 않았다. plan 문서 자체가 두 차례(프론트 즉시 커밋, resolve-레벨 lenient partition) 자기 검토로 실제 기각된 대안의 재도입을 막았다는 기록도 확인했다. 유일한 실질적 공백은 `restoreVersion` 이 도입한 param-schema 게이트 skip 이 "restore 는 saveCanvas 경로를 재사용한다"는 `spec/data-flow/11-workflow.md` 서술과 완전히 대칭이 아니게 됐는데 이를 뒷받침하는 Rationale 이 spec 어디에도 없다는 점이다 — 결정 자체는 합리적(레거시 스냅샷 하위호환)이나 문서화가 누락됐다.

## 위험도

LOW
