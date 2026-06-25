### 발견사항

발견된 충돌·누락 항목이 없다.

**검토 범위 확인**:
- Target: `plan/complete/web-chat-loader-iframe-position.md` (status: complete)
- 관련 spec: `spec/7-channel-web-chat/2-sdk.md §3` (host iframe 코너 고정 — line 107-111)
- 검토한 in-progress plan 전체(web-chat 관련): `channel-web-chat-impl.md`, `channel-web-chat-followups.md`, `web-chat-snippet-queue-stub.md`, `web-chat-preview-improvements.md`, `eia-sdk-publish.md`
- 검토한 in-progress plan 기타: `agent-memory-model-select.md`, `ai-agent-tool-connection-rewrite.md`, `ai-context-memory-followup-v2.md`, `auth-config-webhook-followups.md`, `background-context-key-followups.md`, `cafe24-backlog-residual.md`

**판단 근거**:

1. **미해결 결정과의 충돌 없음**: target 변경(`bridge.ts` 코너 고정 + `BridgeDeps.position/zIndex`)은 spec `2-sdk §3` 이 이미 명문화한 동작("position/zIndex 는 appearance 를 따른다", `bottom:0`, `bottom-left → left:0` / else → `right:0`, `zIndex ?? 2147483000`)을 구현한 것이다. 어떤 in-progress plan 도 `WidgetBridge` 생성자 서명, iframe 코너 anchor 방식, 기본 z-index 값에 대해 "결정 필요"로 열어 둔 항목이 없다.

2. **선행 plan 미해소 없음**: `channel-web-chat-impl.md`(WidgetBridge 구현 완료, spec pending_plans 대상)와 `channel-web-chat-followups.md`(전 항목 완료·보류 확정) 모두 본 변경의 선행 조건이 아니다. target 은 기존 `WidgetBridge` 에 두 opt 필드 추가 + 생성자 내 고정 4줄로, 기존 bridge 계약(postMessage 프로토콜, resize, event fan-out)을 파괴하지 않는다.

3. **후속 항목 누락 없음**:
   - `web-chat-snippet-queue-stub.md`(관련 worktree `web-chat-snippet-queue-stub-629472`)가 `spec/7-channel-web-chat/2-sdk.md §1` 스니펫 예시·콘솔 생성기·유저 가이드를 수정하나, 이는 §1 큐 스텁 누락 수정이며 §3 host anchor 와 직교한다. target 변경은 이 plan 의 범위를 침범하지 않는다.
   - `web-chat-preview-improvements.md`는 `execution.message` 이벤트 신설·미리보기 UX 관련이며 bridge 위치 고정과 무관하다.
   - target 의 spec 변경 없음 선언("spec §3 이 이미 명시, 순수 impl 수정")은 실제 `2-sdk.md §3`(line 107-111)의 최신 서술과 일치한다 — spec 이 이미 `bottom:0; bottom-left→left:0; else→right:0; z-index:appearance.zIndex??2147483000` 전체를 기술하고 있으므로 spec 갱신 불요 판단이 타당하다.
   - `BridgeDeps` 에 `position`/`zIndex` 필드를 추가했으므로 npm 패키지(`@workflow/web-chat`) 타입 계약이 확장된다. 그러나 두 필드 모두 optional 이고 기존 호출처(`boot()`)가 즉시 배선되었으며, `eia-sdk-publish.md` 의 publish 정책(internal-only, 별 지정 전까지)은 외부 breaking change 계약 위험이 없다.

### 요약

`plan/complete/web-chat-loader-iframe-position.md` 는 spec `2-sdk §3` 이 이미 확정한 코너 고정 규약을 구현하는 순수 버그 수정이며, 어떤 in-progress plan 의 미해결 결정·선행 조건·후속 항목과도 충돌하거나 누락을 야기하지 않는다. 동시에 진행 중인 `web-chat-snippet-queue-stub`(§1 큐 스텁)·`web-chat-preview-improvements`(execution.message 이벤트)·`channel-web-chat-followups`(모든 잔여 항목 보류) plan 과 변경 도메인이 직교하여 경합이 없다. Plan 정합성 관점에서 문제 없이 머지 가능한 상태다.

### 위험도

NONE
