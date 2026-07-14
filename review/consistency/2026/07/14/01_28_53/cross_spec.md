# Cross-Spec 일관성 검토 — F-1/F-2 (eia-command-waiting-surface-guard)

- 검토 모드: `--impl-done`
- scope: `spec/5-system/4-execution-engine.md`
- diff-base: `origin/main`
- target 문서: `spec/5-system/4-execution-engine.md` (본 PR 에서는 target spec 파일 자체는 변경 없음 — 이미 §7.5.1 에 F-1 nodeId 검사가 사전 문서화되어 있었고, 이번 diff 는 그 spec 을 구현한 코드 변경)

## 발견사항

- **[WARNING]** `spec/data-flow/15-external-interaction.md` §1.2 dispatch 매핑 표가 `expectedNodeId` 3번째 파라미터 반영 없이 stale
  - target 위치: (코드) `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `continueExecution(executionId, formData, expectedNodeId?)` / `continueButtonClick(executionId, buttonId, expectedNodeId?)` / `continueAiConversation(executionId, message, expectedNodeId?)` / `endAiConversation(executionId, expectedNodeId?)` (모두 3번째 인자 신규 추가), 및 `codebase/backend/src/modules/external-interaction/interaction.service.ts` 의 `expectedNodeId = isInternalCtx(ctx) ? undefined : dto.nodeId` 위임 로직
  - 충돌 대상: `spec/data-flow/15-external-interaction.md` §1.2 "dispatch 매핑 (`interaction.service.ts`)" 표 (라인 102-110)
    ```
    | submit_form      | ExecutionEngineService.continueExecution(executionId, data) | nodeId·data 필수 |
    | click_button     | ExecutionEngineService.continueButtonClick(executionId, buttonId) | buttonId 필수 |
    | submit_message   | ExecutionEngineService.continueAiConversation(executionId, message) | 멀티턴 AI 대화 |
    | end_conversation | ExecutionEngineService.endAiConversation(executionId) | — |
    ```
  - 상세: `spec/5-system/4-execution-engine.md` §7.5.1 ("nodeId 검사 진입점별 커버리지" 표) 과 `spec/5-system/14-external-interaction-api.md` §5.1 (`409 STATE_MISMATCH` — "다른 nodeId" 사유) 은 이미 F-1(nodeId 불일치 거부 + `expectedNodeId` optional 파라미터 + in_process_trusted 면제)을 정확히 문서화하고 있고, 이번 diff 의 실제 코드도 그 문서와 완전히 일치한다. 그러나 같은 흐름을 다른 각도(데이터 흐름 시퀀스)로 문서화하는 `spec/data-flow/15-external-interaction.md` 는 여전히 구 2-arg/1-arg 시그니처를 표에 싣고 있어, 세 스펙 간 "위임 대상 함수 시그니처" 서술이 서로 다르다. 런타임 동작에는 영향 없지만(문서일 뿐), `spec/` 가 "단일 진실" 이라는 CLAUDE.md 원칙상 세 문서가 같은 사실을 다르게 진술하는 상태는 그대로 두면 리더가 data-flow 문서를 오래된 계약으로 오인할 소지가 있다. `in_process_trusted` 경로가 `expectedNodeId=undefined` 로 nodeId 검사를 면제받는다는 사실도 이 표에는 반영돼 있지 않다.
  - 제안: `spec/data-flow/15-external-interaction.md` §1.2 표의 "위임 대상" 컬럼을 `ExecutionEngineService.continueExecution(executionId, data, expectedNodeId?)` 등 3-arg 형태로 갱신하고, "In-process trusted 경로" 문단(라인 116-119)에 "`expectedNodeId` 는 undefined 로 전달되어 §7.5.1 nodeId 매칭을 건너뛴다(exemption)" 한 줄을 추가해 `4-execution-engine.md` §7.5.1 / `14-external-interaction-api.md` §5.1 과 정합시킬 것을 권고.

- **[INFO]** `spec/data-flow/14-chat-channel.md` 가 F-2(`STATE_MISMATCH` 삼킴 시 `surfaceMismatch` 안내 발송) 흐름을 다루지 않음
  - target 위치: (코드) `codebase/backend/src/modules/hooks/hooks.service.ts` `forwardToInteractionService` → `sendSurfaceMismatchNotice` (신규)
  - 충돌 대상: `spec/data-flow/14-chat-channel.md` §1.1 시퀀스 다이어그램/표 (라인 41-86) — `InteractionService.interact` 거부(`STATE_MISMATCH`) 시 이후 처리(로그 warn + 안내 발송)가 시퀀스에 없음
  - 상세: 모순은 아니며 단순 누락이다. `spec/5-system/15-chat-channel.md` §4.1.1 (라인 261) 에는 `surfaceMismatch` 발송 흐름이 이미 정확히 문서화되어 있어 시스템 레벨 spec 은 코드와 일치한다. 다만 data-flow 문서가 다루는 "활성 execution + 인터랙션 명령" 분기(라인 66-67, 83)에는 실패 경로가 없어, 그 문서만 보면 거부 시 어떤 부수효과가 있는지 알 수 없다.
  - 제안: 필수는 아니나, 후속 data-flow 동기화 작업 시 §1.1 다이어그램에 `alt STATE_MISMATCH` 분기(안내 발송 + swallow)를 추가하면 완전성이 개선된다.

## 요약

이번 구현(F-1 nodeId 일치 검증 + F-2 surfaceMismatch 안내)은 `spec/5-system/4-execution-engine.md` §7.5.1 과 `spec/5-system/14-external-interaction-api.md` §5.1/§11, `spec/5-system/15-chat-channel.md` §4.1.1 세 개의 1차 SoT 문서와 코드가 정확히 일치하며, WebSocket/REST `/continue` 등 nodeId 를 쓰지 않는 진입점도 spec 이 명시한 "미적용" 범위 그대로 구현되어 있어 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 어느 관점에서도 CRITICAL 급 모순은 없다. 다만 이번 변경으로 함수 시그니처가 3-arg 로 넓어지면서 `spec/data-flow/15-external-interaction.md` 의 dispatch 매핑 표가 구 시그니처인 채로 남아 세 문서 중 하나만 stale 해졌고(WARNING), `spec/data-flow/14-chat-channel.md` 는 신규 실패 경로를 다루지 않는 완전성 누락(INFO)이 있다. 둘 다 기능을 저해하지 않는 문서 동기화 항목이다.

## 위험도

LOW
