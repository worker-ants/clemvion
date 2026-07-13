# 문서화(Documentation) 리뷰

대상 델타: §7.5.1 커버리지 표 `in_process_trusted` 행을 scope-단위 면제로 정정 (CHANGELOG.md, spec/5-system/4-execution-engine.md) + hooks.service.spec.ts 관용구화(assert 스타일 변경, 비-행동적).

## 발견사항

- **[WARNING]** SoT(spec/CHANGELOG)는 이번 델타로 "scope-단위 면제" 로 정확히 정정됐으나, 그 근거가 되는 실제 소스 코드의 인접 JSDoc/인라인 주석들은 여전히 구(舊) 프레이밍("in_process_trusted 는 nodeId 를 **모른다/알지 못한다**")을 유지하고 있어 SoT 와 불일치한다.
  - 위치:
    - `codebase/backend/src/modules/external-interaction/interaction.service.ts:118-119` (`interact()` 내부 인라인 주석 — `"in_process_trusted(chat-channel 고정 매핑, nodeId 미상)는 면제"`)
    - `codebase/backend/src/modules/external-interaction/interaction.service.ts:442-443` (`assertNodeId` JSDoc — `"대기 nodeId 를 알지 못하므로 … 면제된다"`)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5278` (`resolveWaitingNodeExecutionId` `@param expectedNodeId` JSDoc — `"in_process_trusted(chat-channel 고정 매핑, nodeId 미상)는 전달하지 않아 …"`)
    - `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:268-269` (테스트 상단 주석 — `"nodeId 를 모르므로 … 면제된다"`)
  - 상세: 실제로는 `HooksService.handleFormStep`(`codebase/backend/src/modules/hooks/hooks.service.ts:888-892`)이 `nodeId: formState.nodeId`(= `pendingFormModal.nodeId`)를 **알고 있고 dto 에 명시적으로 싣는다**. 그런데 `InteractionService.interact()` 가 `expectedNodeId = isInternalCtx(ctx) ? undefined : dto.nodeId` 로 **scope 만 보고 강제로 버린다** — nodeId 가용 여부와 무관하다. 즉 코드의 실제 동작은 이미 "scope-단위 정책적 면제"이지 "정보 부재로 인한 면제"가 아니다. 이는 `plan/in-progress/eia-command-waiting-surface-guard.md:121-123`("chat-channel `form_submission`(handleFormStep)은 실제 nodeId 를 알지만 … scope-단위로 면제된다 — 정책상 의도")와 이번에 정정된 `spec/5-system/4-execution-engine.md:1055`("nodeId 를 아는 chat-channel form 제출 … 도 동일 policy 로 면제된다")가 이미 명시한 바다. 위 4개 소스 위치의 주석만 갱신에서 누락됐다.
  - 위험: 이 주석들만 읽는 향후 유지보수자는 "nodeId 가 없어서 스킵한다"로 오독해, `handleFormStep` 이 이미 nodeId 를 알고 있다는 사실을 근거로 "이제 정보가 있으니 검사를 붙이자"는 식의 의도치 않은 동작 변경(정책 위반)을 시도할 위험이 있다. `plan` §F-1 항목이 "class JSDoc dispatch 표 갱신"을 완료([x])로 표시했으나, 실제로는 module-level dispatch 표(line 84-89, 사실만 기술)만 갱신됐고 위 4곳의 근거 설명은 구 프레이밍에 머물러 있다.
  - 제안: 위 4개 위치의 주석을 "scope 단위 정책 — `handleFormStep` 처럼 nodeId 를 알아도(known) 동일하게 면제됨"으로 정정해 spec/CHANGELOG/plan 과 정합시킨다. `execution-engine.service.ts:5341`(`resolveWaitingNodeExecutionId` 본문 내 짧은 주석 — `"expectedNodeId 미전달 → 이 검사 건너뜀"`)은 사실만 기술해 문제 없음.

- **[INFO]** `hooks.service.spec.ts` 의 유지된(비변경) 테스트 주석(`codebase/backend/src/modules/hooks/hooks.service.spec.ts:351-352` — `"chat-channel(in_process_trusted)은 nodeId 를 싣지 않는다"`)은 이 테스트가 검증하는 `text_message → submit_message` 고정 매핑 경로에 한해서는 사실과 일치한다(그 경로는 실제로 nodeId 를 모른다). 다만 이번 델타로 "scope 전체가 면제 대상이며, nodeId 를 아는 form 제출도 동일하게 면제된다"는 더 넓은 사실이 SoT 에 반영된 만큼, 이 주석에 "본 테스트는 고정 매핑 하위 케이스만 다루며, form 제출(nodeId 기지)은 별도 정책으로 동일 면제됨" 한 줄을 덧붙이면 코드만 보는 독자의 오해를 줄일 수 있다. 차단 사유 아님.

- **[INFO]** CHANGELOG.md·spec/5-system/4-execution-engine.md §7.5.1 diff 자체는 정확하고 표현이 신중하다 — "**scope 단위**"·"진입점 판정이 아님"·`pendingFormModal.nodeId` 구체 참조까지 명시해 정정 근거가 추적 가능하다. `spec/5-system/4-execution-engine.md:1059`("면제" vs "미적용" 구분)와도 모순 없이 정합한다. 마크다운 테이블 파이프 구조도 손상 없음.

- **[INFO]** `hooks.service.spec.ts` 의 assert 스타일 변경(수동 `dtoArg` 추출 → `toHaveBeenCalledWith(expect.anything(), expect.not.objectContaining(...))`)은 순수 관용구 정리로 행동 변화가 없어 CHANGELOG 미기재가 적절하다.

## 요약

CHANGELOG·spec 커버리지 표 정정 자체는 정확하고 근거(코드 경로·plan 참조)가 잘 추적된다. 다만 이번 정정이 바로잡은 "scope-단위 면제(정보 부재가 아니라 정책)"라는 핵심 서술이, 그 판정 로직이 실제로 위치한 소스 코드(`interaction.service.ts`, `execution-engine.service.ts`)의 인접 JSDoc/인라인 주석 4곳에는 반영되지 않아 SoT(spec/plan)와 코드 인접 주석 사이에 설명 불일치가 남아 있다. 동작 자체는 이미 올바르게(scope-단위로) 구현돼 있으므로 기능적 위험은 없으나, 주석만 보고 유지보수할 경우 오독 위험이 있어 후속 정정을 권고한다.

## 위험도

MEDIUM
