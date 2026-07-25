# 신규 식별자 충돌 검토 — naming_collision

## 사전 확인 (impl-done, diff-base=origin/main)

Target 은 `spec/conventions/` 로 지정돼 있으나, 실제 diff 를 워크트리에서 직접 확인한 결과
**`spec/conventions/` 하위 파일은 이번 diff 에서 단 1줄도 변경되지 않았다**:

```
git -C .../node-cancel-chat-9f3e diff origin/main --stat -- spec/conventions/
(출력 없음)
```

실제 변경분(리뷰 산출물 제외)은 3개 파일뿐이다:

- `codebase/backend/src/nodes/core/node-handler.interface.ts` (JSDoc 주석만, 14줄)
- `plan/in-progress/node-cancellation-residual-signal-propagation.md` (체크리스트 갱신, 14줄)
- `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (위임 절 추가, 26줄)

내용은 전부 **"chat-channel 은 노드가 아니라 `webhook` 트리거의 `config.chatChannel` 변형이며,
어댑터(`modules/chat-channel/**`)는 outbound 전용이라 node-level cancellation cascade 대상이
아니다"** 라는 기존 오분류를 **정정**하는 문서/주석 수정이다. 새 기능·새 엔티티·새 endpoint 를
도입하는 diff 가 아니다.

## 신규 식별자 존재 여부 확인

diff 가 언급하는 식별자들이 실제로 "신규"인지 grep 으로 개별 검증했다 (전부 기존 식별자의
재참조로 확인됨 — 신규 도입 아님):

| 식별자 | 종류 | 기존 존재 확인 |
|---|---|---|
| `CCH-AD-05` | 요구사항 ID | `spec/5-system/15-chat-channel.md:58` 외 3곳에 이미 정의·사용 중 |
| `recordNetworkFailure` | 메서드명 | `cafe24-api.client.ts:1108`, `makeshop-api.client.ts:758` 에 이미 구현·사용 중 |
| `config.chatChannel` | 필드명 | `spec/1-data-model.md:230` (Trigger.type 표)에 이미 정의 |
| `modules/chat-channel/**` | 파일 경로 | 기존 디렉토리, 신규 생성 아님 |
| `executionEvents$` | 필드/스트림명 | `WebsocketService.executionEvents$` 로 기존 정의 (`5-system/4-execution-engine.md` §4.4) |

diff 자체가 새로 부여하는 요구사항 ID, 엔티티/DTO/인터페이스명, API endpoint, 이벤트/메시지명,
환경변수·설정키, spec 파일 경로는 **하나도 없다** — 오히려 잘못 나열됐던 "chat-channel 노드"
분류를 제거하는 방향의 수정이다 (`node-handler.interface.ts` JSDoc 대상 노드 목록에서
`chat-channel` 삭제 → `Cafe24 / MakeShop` 로 교체, plan 체크리스트에서 해당 항목을
"won't-do (범주 오류)" 로 표시).

## 발견사항

없음 — 이번 diff 는 신규 식별자를 도입하지 않으므로 신규 식별자 충돌 관점에서 지적할 항목이
없다. (참고: `spec/conventions/` 자체가 변경되지 않았으므로 프롬프트에 포함된 방대한
`cafe24-api-catalog/*` 등 기존 컨벤션 본문은 이번 PR 의 변경 대상이 아니며 대조 기준선으로만
확인했다.)

## 요약

이번 diff(`node-handler.interface.ts` JSDoc + 2개 plan 문서)는 "chat-channel 이 node-level
cancellation cascade 대상 노드"라는 기존 오분류를 정정하는 문서/주석 수정이며, `spec/conventions/`
자체는 변경되지 않았다. diff 가 언급하는 모든 식별자(`CCH-AD-05`, `recordNetworkFailure`,
`config.chatChannel`, `modules/chat-channel/**`, `executionEvents$`)는 grep 으로 기존 spec/코드에
이미 정의돼 있음을 확인했고, 새로 부여되는 요구사항 ID·엔티티명·endpoint·이벤트명·ENV/설정키·
spec 파일 경로는 전혀 없다. 따라서 신규 식별자 충돌 리스크는 없다.

## 위험도

NONE
