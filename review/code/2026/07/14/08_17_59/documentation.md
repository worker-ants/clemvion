# 문서화(Documentation) 리뷰 — EIA F-1 nodeId 검사 문서 동기화 델타

대상: 이전 `/ai-review` CRITICAL(spec overclaim)·WARNING 조치분 — `CHANGELOG.md`,
`interaction.service.ts` class JSDoc, `hooks.service.spec.ts` 회귀 가드,
`plan/in-progress/eia-command-waiting-surface-guard.md`, `spec/5-system/4-execution-engine.md`
§7.5.1 커버리지 표, `spec/5-system/14-external-interaction-api.md` §5.1 메모,
`spec/data-flow/15-external-interaction.md` dispatch 표. (`review/code/**`, `review/consistency/**`
하위 신규 파일은 이전 리뷰 사이클의 산출물 기록이라 문서 콘텐츠 리뷰 대상에서 제외, 다만 그 안의
지적사항이 이번 델타로 실제 해소됐는지는 코드로 교차 검증했다.)

## 발견사항

- **[WARNING]** 신설 §7.5.1 진입점별 커버리지 표의 `in_process_trusted` 행 "이유" 서술이 여전히
  스코프 내 커맨드 하나(`submit_form`)의 실제 동작을 가리는 과일반화 — 직전 CRITICAL(WS overclaim)과
  같은 패턴이 더 작은 규모로 재발
  - 위치: `spec/5-system/4-execution-engine.md` §7.5.1 신규 커버리지 표 (`| chat-channel scope:
    'in_process_trusted' | 면제 | HooksService.forwardToInteractionService 가 대기 노드의 nodeId 를
    알지 못한 채 ... 고정 매핑 — nodeId 를 싣지 않는다 |`) / `CHANGELOG.md` 신규 항목("chat-channel
    (`scope: 'in_process_trusted'`, 고정 매핑이라 대기 nodeId 미상)은 면제") / (pre-existing, 이번
    델타 밖) `interaction.service.ts` `assertNodeId` JSDoc("`in_process_trusted`... 대기 nodeId 를
    알지 못하므로 면제된다")
  - 상세: 표의 "이유" 컬럼은 `forwardToInteractionService`(text_message→submit_message,
    button_callback→click_button)에만 참인 "대기 nodeId 를 모른다"를 근거로 들지만, 실제로
    `scope: 'in_process_trusted'` 는 `form_submission`/`handleFormStep` 경로도 포함한다 —
    이 두 경로는 `hooks.service.ts:445`(`nodeId: state.pendingFormModal.nodeId`)와 `:890`
    (`nodeId: formState.nodeId`)에서 **실제 대기 nodeId 를 알고 dto 에 명시적으로 싣는다**
    (`hooks.service.spec.ts:1385` "§4.1 form_submission → interact submit_form
    (pendingFormModal.nodeId + fields)" 테스트로 실측 확인). 그런데 `interaction.service.ts:119`
    (`expectedNodeId = isInternalCtx(ctx) ? undefined : dto.nodeId`)는 scope 단위로 일괄 판정하므로
    이 dto.nodeId 값은 F-1 guard 에 전혀 반영되지 않고 항상 버려진다. 즉 표의 "면제" 판정 자체는
    맞지만, 제시된 근거("nodeId 를 모른다")는 이 행이 커버하는 3개 커맨드 중 2개에만 참이고,
    `submit_form`(실제로는 nodeId 를 알면서도 scope 기준으로 면제됨)에는 오도적이다. 이 정확한 뉘앙스는
    같은 diff 세트의 `plan/in-progress/eia-command-waiting-surface-guard.md` F-1 "스코프 밖(검토 중
    명시)" 절("chat-channel `form_submission`(handleFormStep)은 실제 nodeId 를 알지만
    `in_process_trusted` 라 scope-단위로 면제된다 — 정책상 의도")에는 정확히 기록돼 있으나, spec(SoT)
    쪽 커버리지 표에는 반영되지 않았다. `review/code/2026/07/14/01_09_10/testing.md` 가 바로 이
    지점을 회귀 테스트 부재로 지적한 것과 같은 근본 원인이다. plan 문서는 in-progress 동안만 존재하고
    완료 후 archive 로 이동하므로(`.claude/docs/plan-lifecycle.md`), 이 뉘앙스가 spec 에 없으면
    향후 감사·`/spec-coverage`·타 개발자가 "표에 이유가 있으니 맞겠지"로 오신할 위험이, 이번 PR 이
    직접 겪은 WS overclaim CRITICAL 과 동일한 형태로 남아 있다.
  - 제안: 표의 `in_process_trusted` 행 "이유" 컬럼에 각주를 추가 — 예: "`text_message`/
    `button_callback` 은 nodeId 를 모른 채 고정 매핑; `submit_form`(form_submission/handleFormStep)은
    실제 nodeId 를 알지만 진입점이 아닌 **scope 단위**로 판정되어 함께 면제됨(정책적 결정, 후속 검사
    확장 시 재검토)". CHANGELOG 항목의 해당 문구도 같은 방향으로 다듬으면 SoT-CHANGELOG 정합이 유지된다.

- **[INFO]** CHANGELOG 의 F-1 항목이 같은 breaking-behavior 주제를 다루는 후속 F-3 메모(EIA §5.1
  "STATE_MISMATCH 강제 정합")를 cross-reference 하지 않음
  - 위치: `CHANGELOG.md` 신규 `## Unreleased — EIA \`/interact\` 명령의 nodeId 를 실제 대기 노드와
    대조...` 항목 (커밋 `3bbe3cc90`, 01:28) vs `spec/5-system/14-external-interaction-api.md` §5.1
    신규 메모(커밋 `e0d4ddf51`, 08:10, plan F-3 "완료" 처리와 동시)
  - 상세: 두 커밋이 시간차를 두고 순차로 작성되어(F-1 CHANGELOG 항목이 F-3 결정보다 먼저 커밋됨),
    CHANGELOG 의 F-1 항목 서술은 이 202→409 변경이 "breaking" 인지, 외부 공지가 왜 발행되지 않는지에
    대한 근거(EIA §5.1 새 메모)를 전혀 언급하지 않는다. 같은 저장소 관례상(F-2 항목도 CHANGELOG 에
    상세 기록) F-3 의 "공지 불필요" 결정 자체도 독자 입장에서 궁금할 만한 정보인데, 현재는 spec 메모와
    plan 에만 남아 CHANGELOG 만 읽는 리더는 이 근거에 도달하지 못한다.
  - 제안: F-1 CHANGELOG 항목 말미(또는 F-3 를 위한 별도 `## Unreleased —` 항목)에 "외부 breaking-change
    공지는 발행하지 않는다 — 근거: EIA §5.1 `STATE_MISMATCH` 강제 정합 메모" 한 줄을 추가해 두 문서를
    연결. 필수는 아니며(관찰 사실 기록), 다음 CHANGELOG 정리 시 반영해도 무방.

- **[INFO]** (확인, 이슈 아님) 신설 §7.5.1 커버리지 표는 실제 코드(WS gateway·REST `/continue`)와
  교차검증 결과 정확함 — 직전 CRITICAL(WS overclaim)이 올바르게 해소됨
  - 위치: `spec/5-system/4-execution-engine.md` §7.5.1 표 vs
    `codebase/backend/src/modules/websocket/websocket.gateway.ts`(`continueExecution`/
    `continueButtonClick`/`continueAiConversation`/`endAiConversation` 호출부 4곳 모두
    `expectedNodeId` 미전달 확인) / `codebase/backend/src/modules/executions/executions.controller.ts:175`
    (`continueExecution(id, body?.formData)`, nodeId 파라미터 자체 없음)
  - 상세: 이전 리뷰 사이클(`review/code/2026/07/14/01_09_10/`)의 CRITICAL — "spec 이 'WS 도 nodeId
    지정' 이라 overclaim" — 이 이번 델타로 실제 코드와 일치하는 "미적용" 서술로 정정됐음을 grep 으로
    직접 재현·확인했다. `in_process_trusted`(면제, 정책)와 WS/`/continue`(미적용, 계약 부재)를
    개념적으로 구분한 것도 정확하다. 별도 조치 불필요.
  - 제안: 없음.

- **[INFO]** (확인, 이슈 아님) `InteractionService` class JSDoc dispatch 표·`spec/data-flow/
  15-external-interaction.md` dispatch 표 갱신이 실제 `interact()` 4-arg 호출부와 byte 단위로 일치
  - 위치: `interaction.service.ts:84-89`(class JSDoc) vs `:117-182`(`interact()` 본문 4개 분기) /
    `spec/data-flow/15-external-interaction.md` §1.2 표
  - 상세: 이전 리뷰의 requirement/documentation WARNING("class JSDoc 이 2-arg 로 오래됨")이 정확히
    3번째 인자(`expectedNodeId`)를 반영해 해소됐고, data-flow 표도 동일하게 4행 모두 갱신됐다. 두
    문서가 서로, 그리고 실제 코드와 모두 정합한다.
  - 제안: 없음.

- **[INFO]** (확인, 이슈 아님) `hooks.service.spec.ts` 신규 회귀 가드는 정확히 스코프된 주장만 함 —
  과일반화 없음
  - 위치: `hooks.service.spec.ts:817-822`
  - 상세: 주석("chat-channel(in_process_trusted)은 nodeId 를 싣지 않는다")이 다소 넓게 읽힐 수
    있으나, 실제로는 `text_message → submit_message` 단일 테스트 케이스에 국한된 주석이고 assertion도
    그 dto 하나만 검사하므로(위 첫 WARNING 이 지적한 `submit_form` 경로와는 무관), 오해를 낳을 실질적
    위험은 낮다. 이전 testing WARNING("placeholder 제거를 잠그는 테스트 부재")을 정확히 해소.
  - 제안: 없음.

- **[INFO]** (확인, 이슈 아님) plan 문서 F-1/F-3 섹션이 완료 처리·체크리스트·산출물 경로까지 상세
  - 위치: `plan/in-progress/eia-command-waiting-surface-guard.md` F-1(100-123행)·F-3(157-172행)·
    F-6(125-136행 신설)
  - 상세: 체크리스트 8항목이 실제 커밋·산출물과 대조해 모두 존재함을 확인했다
    (`review/code/2026/07/14/01_09_10/*`, `review/consistency/2026/07/14/01_28_53/*` 실재).
    이전 documentation INFO("plan F-1 섹션이 구현 완료를 반영하지 않음")가 완전히 해소됐고, F-6 신규
    항목도 architecture/security 리뷰의 지적(WS payload 에 이미 nodeId 필드가 있는데 미forward)을
    정확히 반영했다.
  - 제안: 없음.

## 요약

이번 델타는 직전 `/ai-review` 사이클(CRITICAL 1 — spec §7.5.1 "WS 도 nodeId 지정" overclaim, WARNING
3 — class JSDoc 오래됨/CHANGELOG 누락/회귀 테스트 부재)에 대한 조치분이며, 코드(websocket.gateway.ts,
executions.controller.ts)와 교차검증한 결과 CRITICAL 은 정확히 해소됐고 3개 WARNING 도 모두 실제로
고쳐졌다 — class JSDoc·data-flow 표는 실제 4-arg 호출부와 정합하고, CHANGELOG 항목은 breaking-behavior
성격(202→409)·근거·커버리지를 상세히 기록했으며, hooks.service.spec.ts 회귀 가드는 정확히 스코프된
assertion 을 추가했다. 다만 신설된 §7.5.1 커버리지 표가 `in_process_trusted` 행에 제시한 근거("대기
nodeId 를 모른다")는 그 행이 포괄하는 3개 커맨드 중 `submit_form`(form_submission/handleFormStep,
실제로는 nodeId 를 알면서 scope 단위로 면제됨)에는 부정확하다 — 판정 결과("면제")는 맞지만 근거가
불완전해, 이번 PR 이 직접 겪었던 "spec 이 실제 구현 범위보다 넓게 서술" 패턴이 더 작은 규모로 반복된
형태다. 이 뉘앙스는 plan 문서(스코프 밖 절)에는 정확히 있으나 spec(SoT)에는 없어 plan 이 archive 로
이동하면 유실될 위험이 있다. 추가로 CHANGELOG F-1 항목이 이후 커밋된 F-3 breaking-change 공지 결정
메모를 cross-reference 하지 않는 사소한 연결 누락이 있다. 두 사항 모두 병합을 막을 수준은 아니다.

## 위험도

LOW
