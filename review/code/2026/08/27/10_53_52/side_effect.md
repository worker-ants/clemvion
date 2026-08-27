# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 공유 boundary 함수 `adaptHandlerReturn` 의 반환 계약이 바뀐다 — "이미 마스킹됨" 보장 제거가 6개 호출부 전체에 전파된다
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:49` (`config: r.config ?? {},`, 주석은 30~48)
  - 상세: `adaptHandlerReturn` 은 `execution-engine.service.ts` 2곳 · `ai-turn-orchestrator.service.ts` 4곳에서 호출되는 공유 boundary 다. 종전엔 이 함수가 `config` 를 `maskSensitiveFields` 로 마스킹해 반환했고, 그 반환값(`adapted.config`)이 in-memory 구조화 캐시(`setStructuredOutput`)·표현식 컨텍스트·일부 WS emit payload 에 그대로 스며든다. 이번 변경으로 그 "호출부가 뭘 하든 이미 안전하다" 는 암묵 계약이 사라지고, **안전성 책임이 각 소비처의 egress 마스킹으로 이동**한다. 직접 추적한 결과:
    - `execution-engine.service.ts:6141` — `PRESENTATION_NODE_TYPES` 노드의 `EXECUTION_MESSAGE` emit 이 `adapted.config` 를 그대로 payload 에 싣는다. → `eventEmitter.emitExecution` → `WebsocketService.emitExecutionEvent` → `maskWireEnvelope`(`deepRedactSecretsPreserving`, 재귀) 를 지나므로 wire·fanout 모두 재마스킹됨을 확인(코드 추적으로 검증).
    - `ai-turn-orchestrator.service.ts` `handleAiMessageTurn` waiting 분기 — `nodeOutput.config` 에 `adaptedConfig`(raw) 를 그대로 포함해 `EXECUTION_WAITING_FOR_INPUT` 을 emit. 같은 `emitExecutionEvent` 경로를 타므로 동일하게 재마스킹됨을 확인.
    - 같은 함수에서 `nodeExec.outputData = withInteractionMeta(safe, 'ai_conversation')` (및 `handleAiTurnError` 의 `nodeExec.outputData = safe`) — 여기서는 **raw config 가 그대로 DB 컬럼에 저장**된다. REST 응답 시점엔 `redactStoredDataForResponse`/`redactNodeExecutionRow` 가 걸리는 것을 확인했으나(`executions.service.ts:704`, `1044` 근방), 이 경로는 "DB 는 원문, egress 만 마스킹"이라는 새 설계 원칙에 정확히 부합하는 **의도된** 동작이다.
  - 이 변경 자체는 `plan/in-progress/masking-expression-egress-split.md` 에 근거·뮤테이션 검증(M1/M2/M3)·consistency-check RESOLUTION 과 함께 잘 기록돼 있고, 같은 커밋 계열에서 spec 6개(파일 16~21)도 함께 정정되어 "문서가 코드보다 넓다" 류의 잔여도 없었다(직접 대조 확인). 다만 **안전성이 "이 함수가 부른다" 는 국소 불변식에서 "모든 소비처가 각자 egress 를 통과한다" 는 전역 불변식으로 바뀌었다** — 향후 이 값을 새 경로로 전달하는 코드가 추가될 때, `maskWireEnvelope`/`redactStoredDataForResponse` 를 거치지 않으면 조용히 raw 값이 샌다. 이 위험은 이번 diff 범위 밖(신규 소비처가 아직 없음)이라 CRITICAL 로 올리지 않지만, 리뷰어·후속 작업자가 반드시 인지해야 할 구조적 트레이드오프다.
  - 제안: 이 함수(또는 `NodeHandlerOutput.config`)의 JSDoc/타입에 "raw, NOT pre-masked — 새 소비처는 자체 egress 마스킹 필수" 같은 명시적 경고를 남겨, 다음 사람이 반환값을 신뢰-이미-마스킹 값으로 오인해 새 노출 경로를 만드는 것을 막는다(현재도 adapter 주석에 그 취지가 있으나, 소비처 쪽 — `execution-engine.service.ts`/`ai-turn-orchestrator.service.ts` — 에는 없음).

- **[INFO]** DB 저장이 raw 로 바뀌는 경로가 실제로 있음을 확인 (계획서 주장과 일치)
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:49`; 소비처는 `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (`handleAiMessageTurn`/`handleAiTurnError` 의 `nodeExec.outputData = ...`, 함수명 기준 — 해당 파일은 이번 diff 대상 아님)
  - 상세: `execution-engine.service.ts` 의 메인 루프에서는 `nodeExecution.outputData = output`(raw handler return, `adaptHandlerReturn` 이전 값)을 저장하는 기존 경로가 있어 그쪽은 이번 변경 전에도 이미 raw 였다. 반면 AI multi-turn 경로는 `adapted`(post-`adaptHandlerReturn`)를 직접 outputData 에 저장하므로, 이번 PR 로 그 경로의 DB 값이 **masked → raw** 로 바뀐 것이 맞다. `plan/in-progress/masking-expression-egress-split.md` 의 "이 변경은 DB 저장을 원문으로 바꾼다" 서술과 실측이 일치한다.
  - 제안: 없음(이미 spec 6개·RESOLUTION 에 반영된 의도된 변경).

- **[INFO]** 공유 worktree 뮤테이션 오염을 리뷰 도중 관측 — 진짜 결함 아님(일시적)
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` (작업 트리, 커밋 아님)
  - 상세: 리뷰 도중 한 시점에 `git status`/`git diff` 로 이 파일이 `idToken` 항목이 빈 줄로 치환된 상태 + `.ts.orig` 백업 파일이 존재하는 것을 확인했고, 그 상태에서 `mask-sensitive-fields.util.spec.ts` 의 `idToken` 케이스가 실제로 RED 였다(직접 실행 확인). 이는 plan 문서에 기록된 뮤테이션 M2(`DEFAULT_SENSITIVE_KEYS` 에서 `idToken` 제거)와 정확히 일치하는 모양이라, 개발자(또는 동시 실행 중인 다른 세션)의 뮤테이션 하네스가 이 공유 worktree 에서 실행 중이던 순간을 관측한 것으로 판단된다. 재확인 결과 `git diff HEAD` 는 clean, `.orig` 파일도 사라졌고, `mask-sensitive-fields.util.spec.ts` + `handler-output.adapter.spec.ts` (82 tests) 및 `execution-engine.service.spec.ts` + `ai-turn-orchestrator.service.spec.ts` (542 tests) 전부 GREEN 을 재확인했다. 커밋된 diff·HEAD 상태 자체에는 문제가 없다.
  - 제안: 이번 PR 자체의 결함은 아니므로 조치 불필요. 다만 프로젝트 관례상 뮤테이션은 커밋 후 `cp` 백업 → 복원이 원칙이므로, 만약 이 세션 종료 후에도 `.orig` 잔존/작업트리 오염이 남아 있다면 다음 작업자가 오탐(false RED)으로 시간을 쓰지 않도록 정리 확인이 필요하다.

- **[INFO]** 시그니처 자체는 불변, 의미론적 계약만 변경
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:26` (`export function adaptHandlerReturn(raw: unknown): NodeHandlerOutput`)
  - 상세: 파라미터·반환 타입은 그대로다. `maskSensitiveFields` import 제거로 이 파일의 유일한 외부 함수 소비 관계가 끊겼을 뿐, `maskSensitiveFields` 자체의 export/시그니처는 손대지 않았고 유일하게 남은 프로덕션 소비처(`modules/workflow-assistant/tools/explore-tools.service.ts`)는 영향받지 않는다(grep 로 확인).
  - 제안: 없음.

- **[INFO]** 테스트 전용 변경 — 부작용 없음
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:129-173` (포함관계 캐너리 신설), `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts` (해당 diff 블록 92~194 게이트 구간 — 마스킹 단언 제거 및 raw-passthrough/egress 대조군 캐너리로 교체)
  - 상세: 두 스펙 파일 모두 새 동작을 고정하는 캐너리이며 프로덕션 코드·전역 상태에 영향 없음. `it.each(KEYS)` 가 `maskSensitiveFields` 호출 결과에서 키를 파생하므로 목록이 넓어져도 자동 추종 — 손으로 나열한 목록보다 안전한 패턴.
  - 제안: 없음.

## 요약

핵심 변경은 `adaptHandlerReturn` 이 더 이상 `config` 를 마스킹하지 않는 것이다. 이는 6개 호출부(엔진 메인 루프 2·AI multi-turn 오케스트레이터 4)에 전파되는 넓은 blast radius 를 가진 boundary 계약 변경이지만, 직접 코드를 추적해 확인한 결과 새로 노출된 raw 값이 WS(`maskWireEnvelope`/`deepRedactSecretsPreserving`, 재귀)·REST(`redactStoredDataForResponse`/`redactNodeExecutionRow`) egress 시점에 여전히 마스킹되고, DB 저장이 raw 로 바뀌는 것은 EIA §R17 egress-only 원칙과 정렬된 의도된 결정이며 관련 spec 6건이 같은 커밋 계열에서 함께 정정되어 문서-코드 괴리도 없다. 뮤테이션 테스트(M1/M3)와 이번 리뷰에서 재실행한 타겟 테스트(82 + 542 tests) 모두 GREEN 이다. 리뷰 도중 공유 worktree 에서 일시적인 뮤테이션 오염(`idToken` 제거 + `.orig` 파일)을 관측했으나 HEAD/현재 작업트리는 clean 하고 재검증도 GREEN 이라 이번 diff 의 결함이 아니다. 남는 구조적 리스크는 "safe-by-construction" 이 "safe-by-convention(각 소비처가 egress 를 반드시 통과)" 으로 바뀐 것으로, 향후 `config`/`adaptedConfig` 를 새 경로로 내보내는 코드가 추가될 때 egress 마스킹을 빠뜨리면 조용히 샐 수 있다는 점을 후속 리뷰가 계속 주시해야 한다.

## 위험도

LOW
