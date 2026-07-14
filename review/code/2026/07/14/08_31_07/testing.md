# 테스트(Testing) 리뷰 — hooks.service.spec.ts F-1 회귀 assertion 관용구 변경

## 리뷰 대상

- `codebase/backend/src/modules/hooks/hooks.service.spec.ts` — F-1 회귀 가드 테스트("parseUpdate 성공 + 활성 execution 있음 → InteractionService.interact() in-process 호출 (CCH-CV-03 forwarding 경로)") 내 nodeId 부재 assertion 을 `mock.calls[0][1]` 직접 인덱싱 + `toBeUndefined()` 에서 `toHaveBeenCalledWith(expect.anything(), expect.not.objectContaining({ nodeId: expect.anything() }))` 관용구로 교체.
- `CHANGELOG.md`, `spec/5-system/4-execution-engine.md` §7.5.1 표 — 문서성 변경(코드/테스트 무변경). "chat-channel 면제는 scope 단위이며 진입점 판정이 아니다" 를 명확화.

## 발견사항

- **[INFO]** null 관용 차이 — 규약상 실질 리스크 낮음
  - 위치: `hooks.service.spec.ts` 변경된 assertion (diff 353-361행 상당, 실제 파일 807-822행 부근)
  - 상세: 기존 `expect(dtoArg.nodeId).toBeUndefined()` 는 `nodeId === undefined` 만 통과시킨다(`null` 이면 실패). 신규 `expect.not.objectContaining({ nodeId: expect.anything() })` 는 `expect.anything()` 이 `null`/`undefined` 를 매치하지 않으므로, `nodeId` 가 부재·`undefined`·`null` 중 어느 것이어도 모두 통과한다 — 즉 새 관용구가 구조적으로 더 느슨하다. 실제 프로덕션 코드(`hooks.service.ts` `forwardToInteractionService`, 735-767행)를 확인하니 `dto` 객체는 `nodeId` 키 자체를 아예 싣지 않고(`InteractDto.nodeId?: string` 타입도 `null` 미허용), 현재로선 이 차이가 실제로 악용될 경로가 없다. 다만 "종전 `nodeId: 'chat-channel'` placeholder 제거 회귀 가드" 라는 테스트 취지(F-1 코멘트)를 감안하면, 회귀 가드는 원래 의도(엄격한 부재 검사)보다 미세하게 약해졌다.
  - 제안: 현재 리스크는 낮으므로 필수 수정은 아니나, 구조적 부재를 더 정확히 표현하려면 `expect(dtoArg).not.toHaveProperty('nodeId')` 조합을 고려할 수 있다. 그대로 두어도 무방.

- **[INFO]** `toHaveBeenCalledWith` + 부정 매처의 existential 시맨틱스 — 향후 테스트 확장 시 함정 가능성
  - 위치: 동일 assertion
  - 상세: `toHaveBeenCalledWith` 는 "mock 이 주어진 인자로 **한 번이라도** 호출됐는가" 를 검사하는 존재 한정(existential) 매처다. `expect.not.objectContaining(...)` 처럼 부정 매처를 이 안에 넣으면 "모든 호출이 nodeId 를 안 실었다" 가 아니라 "**적어도 한 번**은 nodeId 없이 호출됐다" 를 검사하게 된다. 이번 테스트는 `interactionService.interact` 를 정확히 1회만 호출하므로(같은 `it` 블록 안에서 807-816행 assertion 이 이미 그 단일 호출을 검증) 현재는 원본과 동등하게 동작한다. 그러나 이 관용구는 "mock 이 여러 번 호출될 수 있는" 테스트에 재사용되면, 한 호출이 실수로 `nodeId` 를 실어도 다른 호출이 안 실었다면 assertion 이 통과해버리는 **회귀 은폐** 위험이 있다 — 이 idiom 을 다른 테스트에 복붙할 때 특히 주의가 필요하다.
  - 제안: 현재 단일-호출 시나리오에서는 문제 없음. 재사용 시 `toHaveBeenCalledTimes(1)` 을 함께 assert 하거나, 특정 call index 를 명시적으로 검사하는 편이 안전하다는 점을 팀 컨벤션/코드 코멘트로 남기면 좋다.

- **[INFO]** 회귀 유효성 확인 — 프로덕션 코드와 정합
  - 위치: `hooks.service.ts` 735-767행 (`forwardToInteractionService`)
  - 상세: 변경된 assertion 이 실제로 검증하려는 대상(`dto` 에 `nodeId` 키가 없음)은 프로덕션 코드와 일치함을 직접 확인했다. `dto` 는 `{ command: 'submit_message', message }` 또는 `{ command: 'click_button', buttonId }` 로만 구성되고 `nodeId` 필드가 아예 없다. 리팩터링이 테스트 의도를 그대로 보존했다.

- **[INFO]** 스타일 일관성 — 개선
  - 위치: 파일 전체
  - 상세: `hooks.service.spec.ts` 는 이미 `expect.objectContaining(...)` 관용구를 광범위하게 사용 중이다(613·768·814·884·1047·1094·1138·1176·1180·1189·1292·1444·1550·1689행 등, grep 확인). 이번 변경은 `mock.calls[0][1] as {...}` 캐스팅 + 수동 인덱싱을 제거하고 기존 파일 관용구에 맞춰 통일한 것으로, 가독성·일관성 면에서 개선이다.

- **[INFO]** 관련이지만 이번 델타 범위 밖 — scope 단위 면제의 "알고도 면제" 케이스는 별도 테스트로 이미 커버됨
  - 위치: `spec/5-system/4-execution-engine.md` §7.5.1 표 diff, `hooks.service.spec.ts` 1385-1447행(§4.1 form_submission 테스트, 이번 diff 로 변경되지 않음)
  - 상세: 문서 diff 는 "chat-channel 면제는 scope 단위이며, nodeId 를 아는 form 제출(`handleFormStep`, `pendingFormModal.nodeId`)도 동일 정책으로 면제된다" 는 뉘앙스를 명확화했다. 실제로 기존(비변경) 테스트 `§4.1 form_submission → interact submit_form (pendingFormModal.nodeId + fields)` (1385행)는 `interact` 가 `nodeId: 'node-form'` 을 **포함해서** 호출됨을 이미 검증하고 있어 — F-1 테스트(nodeId 완전 부재)와 대조적으로 "nodeId 를 실어도 검증 대상이 아니다(면제)" 를 방증한다. 다만 그 nodeId 값이 실제 대기 노드와 **불일치**해도 여전히 통과(면제)하는지를 직접 검증하는 테스트는 이 파일 범위 밖(publisher/`resolveWaitingNodeExecutionId` 쪽)에 있을 것으로 보이며, 이번 payload 에는 포함되지 않았다. 이번 델타(assertion 관용구 교체)의 책임 범위는 아니므로 CRITICAL/WARNING 으로 격상하지 않음 — 참고용 기록.

## 요약

리뷰 대상 델타는 `hooks.service.spec.ts` F-1 회귀 가드 테스트의 assertion 을 수동 `mock.calls` 인덱싱+타입 캐스팅에서 `toHaveBeenCalledWith` + `expect.not.objectContaining` 관용구로 바꾼 순수 스타일 리팩터다. 실제 프로덕션 코드(`forwardToInteractionService`)와 대조한 결과 테스트가 검증하는 불변식(chat-channel forwarding DTO 에 `nodeId` 미포함)은 그대로 유효하며, 이 테스트가 단일 호출 시나리오라는 점에서 새 관용구도 기존과 동등하게 동작한다. 다만 (1) `expect.not.objectContaining({nodeId: expect.anything()})` 은 `nodeId: null` 도 허용하는 구조적으로 더 느슨한 매처이고, (2) `toHaveBeenCalledWith` 의 존재 한정(existential) 시맨틱스는 향후 같은 mock 이 여러 번 호출되는 테스트로 이 패턴이 복제될 경우 회귀를 은폐할 잠재 위험이 있다 — 둘 다 현재 시점에는 실질적 위험이 낮은 INFO 수준이나 유지보수자가 인지하고 있어야 할 트레이드오프다. CHANGELOG/spec 문서 변경은 코드·테스트에 영향 없는 wording 정합화로 리뷰상 문제 없음.

## 위험도

LOW
