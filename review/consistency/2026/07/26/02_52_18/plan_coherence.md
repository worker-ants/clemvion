# Plan 정합성 검토 — `plan/in-progress/spec-draft-node-cancellation-chat-channel-correction.md`

## 발견사항

- **[WARNING]** 위임 원본 plan 의 "planner 위임" 포인터가 target 실행 후 갱신되지 않는다
  - target 위치: 문서 전체 (특히 "변경 1"·"변경 2" 실행 범위). 별도 절로 "위임 원본 plan 갱신" 단계가 없음.
  - 관련 plan: `plan/in-progress/node-cancellation-residual-signal-propagation.md`
    - L35-45 (chat-channel 항목): `"spec §6 표의 해당 행 처분은 spec/ 권한 밖이라 위임"`
    - L1763-1768 ("후속으로 남긴 것" 절): `"§6 표 두 행 갱신은 spec/ 권한 밖이라 planner 위임"`
  - 상세: target 의 변경 1(chat-channel §6 행)·변경 2(MakeShop/Cafe24 §6 두 행)가 실제로 spec 에 반영되면, 위 두 위임 포인터는 **더 이상 사실이 아니다** — "위임 중" 상태가 아니라 "이행 완료" 상태가 된다. `node-cancellation-residual-signal-propagation.md` 는 target 과 **같은 worktree**(`node-cancel-chat-9f3e`)에서 developer 가 만든 문서이며, 그 문서의 세 항목(`chat-channel` won't-do·MakeShop·Cafe24)은 이미 `[x]` 로 코드 측은 완료 표시했지만 "spec 표 갱신" 부분만 미해소로 남겨 두었다. target 이 이를 집행하고도 원본 plan 을 그대로 두면, 다음에 이 plan 을 읽는 사람은 spec 표 갱신이 아직도 planner 대기 중이라고 오인한다. 저장소의 확립된 규약("plan 체크박스/서술 = 실제 상태") 및 `plan-lifecycle.md` §3 "인입 참조: spec 등 살아있는 문서의 plan 링크는 이동과 동시에 갱신" 원칙과 같은 결의 문제다.
  - 제안: target(또는 target 을 집행하는 developer/후속 커밋)이 `node-cancellation-residual-signal-propagation.md` 의 위 두 위임 문구를 "spec-draft-node-cancellation-chat-channel-correction.md 로 이행 완료"로 갱신하는 절을 추가한다. `spec-update-node-cancellation-shutdown-classification.md` 의 해당 두 섹션(§6 두 행 / chat-channel 범주 오류)도 "본 두 항목은 target 초안으로 집행됨" 주석을 남기면 위임 이력이 끊기지 않는다.

## 정합성 확인 (문제 없음으로 판정한 항목)

- **미해결 결정 우회 없음**: target 은 `spec-update-node-cancellation-shutdown-classification.md` 의 택일 결정 항목(#1 SIGTERM/timeout 최종 상태 (a)/(b), #2 §4 예시 누수, #3 http-request/text-classifier 검증, #4 AbortError 명명 예외)을 전혀 건드리지 않는다. 원본 plan 의 Rationale("commerce/chat-channel signal 전파는 §5.1 의 `cancelled` 분류가 이미 정답인 경로라 본 충돌과 무관")과 target 의 근거가 일치하며, `node-cancellation-residual-signal-propagation.md` 의 BLOCKED 항목(워크플로 timeout/shutdown 노드 abort 통합)도 그대로 미해소 상태로 남겨 둔다 — 일방적 결정 없음.
- **`harness-consistency-summary-downgrade-rule.md` 와의 관계 정합**: target 의 Rationale "기각한 대안 — impl-done Critical 을 우회한다"는 이 plan 이 지적한 미해결 규약 갭(요약 하향 재량 없음)을 정확히 인용하며, 하향 우회 대신 근본 원인 정정을 택했다 — 열린 (a)/(b)/(c) 선택지 중 어느 것도 선점하지 않는다. 정합.
- **spec 라인 앵커 정확성**: target 의 3개 diff(`node-cancellation.md:24`, `:137-139`, `10-parallel.md:244`)는 실제 파일 현재 내용과 문자 그대로 일치한다(직접 대조 확인). stale diff 아님.
- **`10-parallel.md` 라인 충돌 없음**: 같은 spec 파일을 참조하는 유일한 다른 plan(`node-output-redesign/parallel.md`)은 모두 244행 이전 구간(§5.1/§5.2, ~L70-159)만 인용하고, target 의 diff 는 라인 수 변화 없는 단일행 치환이라 그 인용들에 시프트를 유발하지 않는다.
- **선행 조건 실측 확인**: target 이 전제하는 "MakeShop·Cafe24 §4 cascade + §5.1 재throw 구현 완료"는 `git log` 상 실제 커밋(`e83da5052`, #1019)으로 확인되며, `node-cancellation-residual-signal-propagation.md` 의 진행 기록(mutation 테스트 결과 포함)과도 일치한다. "chat-channel 노드 미존재" 전제 역시 같은 plan 에서 이미 확정(won't-do)된 사실이다 — target 이 새로 주장을 만드는 것이 아니라 이미 결정된 사실을 spec 에 반영하는 것.
- **frontmatter.code 등재 여부 비변경 결정**: 원본 delegation("frontmatter.code 에 두 client 를 추가할지도 함께 판단 대상")이 planner 에게 명시적으로 위임한 판단이며, target 이 "이번 초안에서 바꾸지 않는다"고 내린 결정은 project-planner 권한 범위 내의 정당한 처분이다 — 사용자 합의가 필요한 제품 결정이 아니므로 우회가 아니다.

## 요약

target 초안은 `spec-update-node-cancellation-shutdown-classification.md` 가 명시적으로 위임한 두 항목(§6 chat-channel 범주 오류, §6 commerce 2행 staleness)만 정확히 집행하고, 택일 결정이 필요한 나머지 4항목은 손대지 않아 **미해결 결정과의 충돌은 없다**. spec 앵커 라인·전제 사실(commerce 구현 완료, chat-channel 미존재)도 실측과 일치해 선행 조건 미해소 문제도 없다. 유일한 갭은 target 실행 후 그 위임을 발행한 `node-cancellation-residual-signal-propagation.md`(같은 worktree)의 "spec 권한 밖이라 위임" 포인터 2건이 이행 완료 상태로 갱신되지 않아, 이력을 추적하는 후속 독자에게 "아직 대기 중"이라는 오인을 남길 수 있다는 점이다.

## 위험도

LOW

STATUS: success
