# 테스트(Testing) 리뷰 — EIA F-1 review-fix 델타 (`plan eia-command-waiting-surface-guard`)

대상 델타: 이전 리뷰(`review/code/2026/07/14/01_09_10/`)의 Critical/Warning 조치(RESOLUTION.md) —
CHANGELOG 신설, `interaction.service.ts` class JSDoc 갱신(비기능), plan 갱신, 그리고 실제 테스트
변경인 `hooks.service.spec.ts` 의 `dto.nodeId` undefined 회귀 assertion 1건 추가. 나머지 파일(RESOLUTION.md,
SUMMARY.md, `_retry_state.json`, per-reviewer `.md`, consistency SUMMARY 등)은 이전 라운드 산출물이
레포에 커밋되는 것으로 테스트 관점 검토 대상이 아니다.

## 발견사항

- **[INFO]** 신규 assertion 은 정확한 대상을 검증하고, 실행 확인됨
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:817-822` (`interactionService.interact.mock.calls[0][1]`)
  - 상세: `InteractionService.interact(ctx, dto)` 시그니처(`interaction.service.ts:112-115`)를 직접 확인한 결과 `mock.calls[0][1]` 은 실제로 두 번째 인자인 `dto` 를 가리켜, `dtoArg.nodeId` 검사가 올바른 대상을 잡고 있다. `hooks.service.spec.ts` 단독 실행(`npx jest hooks.service.spec.ts`) 결과 46/46 전부 pass — RESOLUTION.md 가 주장하는 "unit 통과" 와 일치한다. `moduleRef`/mock 은 최상위 `beforeEach` 에서 매 테스트마다 재생성되므로(36행), `mock.calls[0]` 이 이전 테스트의 호출로 오염될 여지도 없다 — 테스트 격리는 양호.
  - 제안: 없음 (확인 목적).

- **[WARNING]** 같은 함수 안의 형제 분기(`button_callback` → `click_button`)는 동일한 placeholder-제거 변경을 받았는데도 회귀 가드가 없고, 애초에 해당 분기 자체를 exercise 하는 테스트가 스위트에 전무함
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:756-767` (`forwardToInteractionService` 의 `dto` 조립 — `text_message → submit_message` 와 `button_callback → click_button` 두 분기 모두 `nodeId` 키 없는 object literal), `hooks.service.spec.ts` (grep 결과 `button_callback`/`click_button` 문자열이 파일 전체에 0건)
  - 상세: 이번 diff 가 제거한 `nodeId: 'chat-channel'` placeholder 는 원래 `forwardToInteractionService` 안에서 두 분기(`submit_message`, `click_button`) 모두에 실려 있었을 것으로 보이며(주석 743행 "button_callback → click_button ... Phase 3 에서 구체화"), 현재 코드는 두 분기 모두 `nodeId` 키 자체가 없는 하드코딩 object literal 이다. 그런데 이번에 추가된 회귀 assertion(`dtoArg.nodeId` undefined 단언)은 `text_message`(→ `submit_message`) 경로 1건에만 붙어 있고, `click_button` 경로는 이 스위트에서 아예 호출되지 않는다(관련 `it` 자체 부재). 즉 누군가 `click_button` 분기에만 실수로 `nodeId: 'chat-channel'` 류 값을 되돌려도 현재 테스트 스위트는 감지하지 못한다 — 이번 F-1 리뷰-픽스가 명시적으로 닫으려 한 "placeholder 회귀" 클래스의 절반만 잠갔다.
  - 제안: `button_callback` → `interact({..., scope:'in_process_trusted'}, {command:'click_button', buttonId, ...})` 호출을 검증하는 최소 1개 테스트(가능하면 기존 `text_message` 테스트와 대칭 구조)를 추가하고, 거기에도 `dtoArg.nodeId` undefined 단언을 붙일 것. `click_button` 자체가 "Phase 3 미구체화" 상태라 스코프 밖이라 판단된다면, 그 판단을 plan/코드 주석에 명시해 의도적 누락임을 남길 것.

- **[INFO]** 이전 라운드(01_09_10) testing 리뷰가 지적한 나머지 2건(W2: `submit_form` 등 다른 커맨드의 internal-ctx 커버리지 부재, W3-연관: `form_submission`/`handleFormStep` 처럼 실제 nodeId 를 아는 경로까지 scope 단위로 통째로 면제되는 설계를 고정하는 테스트 부재)은 이번 델타에서 코드/테스트로 닫히지 않고 plan 문서의 "정책 명시(코드 무변경)" 로만 처분됨
  - 위치: `plan/in-progress/eia-command-waiting-surface-guard.md` "스코프 밖 (검토 중 명시)" 문단, `review/code/2026/07/14/01_09_10/SUMMARY.md` "backlog / 문서화" 항목
  - 상세: RESOLUTION.md 의 W3 fix 는 "dto.nodeId undefined 단언 추가" 라는 범위로 명시적으로 좁혀졌고, 실제로 그 범위(1개 테스트)만 구현됐다. `form_submission`(`handleFormStep`)이 `state.pendingFormModal.nodeId`/`formState.nodeId` 라는 **실제 대기 nodeId 를 알면서도** `scope: 'in_process_trusted'` 단위 면제 때문에 F-1 nodeId 검사를 전혀 받지 않는다는 사실은 여전히 어떤 테스트로도 고정되어 있지 않다 — 이 설계가 향후 리팩터(예: `assertNodeId`/`expectedNodeId` 계산을 scope 대신 dto.nodeId 존재 여부로 바꾸는 시도)로 조용히 바뀌어도 그 사실을 알아챌 테스트가 없다. 다만 이 갭은 이번 델타가 새로 만든 것이 아니라 이전 라운드에서 이미 식별·문서화된 뒤 사용자/plan 이 명시적으로 backlog 로 넘긴 항목이므로, 이번 리뷰의 신규 결함으로 취급하지 않고 잔존 리스크로만 기록한다.
  - 제안: 후속 트랙(F-4/F-6 등)에서 `form_submission` 경로가 "nodeId 를 알면서도 검증되지 않는다" 는 현재 정책을 고정하는 회귀 테스트(예: stale `pendingFormModal.nodeId` 를 실어도 수용됨을 확인)를 추가해, 향후 이 정책이 바뀌었는지 여부를 테스트가 판별할 수 있게 할 것.

- **[INFO]** assertion 스타일은 명확하고 의도가 잘 드러남
  - 위치: `hooks.service.spec.ts:817-822`
  - 상세: `mock.calls[0][1]` 을 별도 변수(`dtoArg`)로 추출하고 F-1 배경(placeholder 제거 이유)을 주석으로 남긴 뒤 `toBeUndefined()` 로 단언하는 구조는 가독성이 좋다. `as { nodeId?: string }` 캐스트는 `InteractDto` 전체를 끌어오지 않고 필요한 필드만 좁혀 타입 안전성과 간결함을 동시에 확보했다 — 과도한 캐스팅이나 `any` 남용 없음.
  - 제안: 없음 (스타일 관찰).

## 요약

이번 델타의 유일한 실질 테스트 변경(`hooks.service.spec.ts` 의 `dto.nodeId` undefined 단언)은 대상 mock 호출 인자 인덱스가 실제 `interact(ctx, dto)` 시그니처와 정확히 일치하고, 스위트 전체(46/46) 통과가 실측 확인됐으며, 테스트 격리·가독성 모두 양호해 — 이전 리뷰가 지적한 W3("hooks.service placeholder 제거를 잠그는 회귀 테스트 부재")를 그 좁은 범위 안에서는 정확히 해소한다. 다만 같은 `forwardToInteractionService` 함수 안에서 동일한 placeholder-제거를 받은 `button_callback → click_button` 분기는 이 스위트에서 전혀 exercise 되지 않아 대칭적인 회귀 위험이 그대로 남아 있고, 이전 라운드가 남긴 두 건(다른 커맨드의 internal-ctx 커버리지, `form_submission` 의 "알면서도 면제됨" 정책을 고정하는 테스트 부재)도 이번 델타에서는 코드/테스트가 아닌 plan 문서 명시로만 처분되어 잔존한다. 이 두 잔존 갭은 이번 델타가 새로 만든 결함이 아니라 명시적으로 스코프 밖으로 이월된 기존 이슈이므로 병합을 막을 사유는 아니다.

## 위험도

LOW
