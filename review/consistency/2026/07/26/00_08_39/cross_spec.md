# Cross-Spec 일관성 검토 — `spec/conventions/`

## 방법론 메모

프롬프트에 번들된 target 은 컨텍스트 예산 초과로 `spec/conventions/node-cancellation.md`,
`chat-channel-adapter.md`, `execution-context.md` 등 이번 diff 와 가장 관련 깊은 파일들이 **본문
없이 파일명만** 나열되고 실제 diff(`## 구현 변경 사항`) 섹션 자체가 프롬프트에 없었다. 이에 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/node-cancel-chat-9f3e`, 절대경로)를 직접 Read/Grep/git
으로 열어 진행했다. diff 범위는 `git merge-base`로 확인한 `origin/main`(=`e83da5052`) 대비 4 커밋
(`60542ee77`/`5f55fa43e`/`35aac3539`/`52453b3ed`) — `codebase/backend/src/nodes/core/node-handler.interface.ts`
JSDoc 정정 + `plan/in-progress/node-cancellation-residual-signal-propagation.md` ·
`plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 갱신이다. 이 diff 자체는
`spec/conventions/**` 를 건드리지 않았지만, diff 가 명시적으로 지목하는 대상 문서
(`spec/conventions/node-cancellation.md`)를 실제로 열어 대조한 결과 아래 발견사항을 확인했다.

## 발견사항

- **[CRITICAL]** `node-cancellation.md` 가 chat-channel 을 "노드"로 오분류 — 데이터 모델 SoT 와 정면 모순
  - target 위치: `spec/conventions/node-cancellation.md` §1 "목적" (24행) — `"장기 외부 I/O 를 수행하는 노드 (HTTP / DB / AI / Email / chat-channel / 이커머스 통합 Cafe24·MakeShop)"`, 및 §6 "구현 현황" 표 137행 — `| chat-channel 노드 signal 전파 | — | 미구현 (Planned) |`
  - 충돌 대상: `spec/1-data-model.md` §2.8 Trigger (`type | Enum | webhook / schedule / manual (chat-channel 은 별도 type 이 아니라 webhook 트리거의 config.chatChannel 변형 — Spec Chat Channel 참조)`) 및 `spec/5-system/15-chat-channel.md` CCH-AD-05 (`ChatChannelDispatcher` 가 `WebsocketService.executionEvents$` 에 **subscribe** 하는 outbound 방향 어댑터)
  - 상세: `node-cancellation.md` 는 chat-channel 을 HTTP/DB/AI/Email 과 나란히 "장기 외부 I/O 노드"로 열거하고 §6 표에 독립된 "chat-channel 노드 signal 전파" 미구현 행을 두어, 마치 chat-channel 이 `NodeHandler.execute(context)` 로 dispatch 되는 노드이며 `context.abortSignal` 을 전파받아야 할 대상인 것처럼 기술한다. 그러나 `1-data-model.md §2.8`(엔티티 정의 SoT)은 chat-channel 이 **Trigger 의 `type` 이 아니라 `webhook` 트리거의 `config.chatChannel` 서브필드**라고 명시하고, `5-system/15-chat-channel.md`(CCH-AD-05/07)는 그 구현체(`ChatChannelDispatcher`)가 `WebsocketService.executionEvents$` 를 **구독해 외부 채널로 발송**하는 outbound listener 이며 실행 엔진의 노드 dispatch 경로에 참여하지 않는다고 규정한다. 실측으로도 `codebase/backend/src/nodes/**` 전 카테고리에 `chat` 이름의 노드 파일이 0건이고 `node-types.constants.ts` 에도 미등록임을 확인했다. 즉 "chat-channel 노드"는 존재하지 않는 개념이며, node-cancellation.md 가 정의하는 "노드 단계 cancellation 계약"의 적용 대상 목록에 애초에 있을 수 없는 항목이 §1/§6 양쪽에 박혀 있다. 이 상태로 §6 표를 그대로 신뢰하면 향후 개발자가 존재하지 않는 "chat-channel 노드"에 `abortSignal` 배선을 시도하거나 (구조적으로 불가능 — outbound listener 는 `context` 자체를 받지 않음), 반대로 정말 필요한 것(취소된 실행에 대해 `execution.cancelled` 이벤트를 어댑터가 outbound 발송하는지 여부)을 "미구현 Planned" 라벨에 가려 놓친다.
  - 제안: `project-planner` 가 `spec/conventions/node-cancellation.md` §1 목록에서 `chat-channel` 을 제거(`HTTP / DB / AI / Email / Cafe24·MakeShop` 로 정정 — 이미 `node-handler.interface.ts` JSDoc 은 이번 diff 에서 이렇게 정정됨)하고, §6 표의 `chat-channel 노드 signal 전파` 행을 삭제하거나 "노드 아님 — `webhook` 트리거의 어댑터, outbound-only 라 §4 cascade 대상 아님" 으로 재기재해야 한다. 이 정정은 이미 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-07-25 #5)" 에 developer 가 제안 형태로 남겨두었고(developer 는 `spec/` 쓰기 권한이 없어 반영 대기 중), 본 검토는 그 제안이 실제 다른 spec 영역(데이터 모델·chat-channel 시스템 스펙)과 직접 모순됨을 독립적으로 확인한 것이다.

- **[WARNING]** 같은 §6 표의 MakeShop/Cafe24 행이 이미 병합된 구현과 불일치 (staleness — 참고용, cross-spec 본연 스코프 밖일 수 있음)
  - target 위치: `spec/conventions/node-cancellation.md` §6 표 138~139행 — `MakeShop 노드 signal 전파 | — | 미구현 (Planned)`, `Cafe24 노드 signal 전파 | — | 미구현 (Planned)`
  - 충돌 대상: 코드 상태(커밋 `e83da5052`, 이미 `origin/main` 에 병합됨) — `feat(nodes): MakeShop·Cafe24 노드에 execution abortSignal 전파 (§4 cascade + §5.1 분류) (#1019)`. 해당 커밋은 `spec/conventions/node-cancellation.md` 를 전혀 건드리지 않았음(`git show --stat e83da5052` 로 확인)
  - 상세: 이 항목은 다른 spec **영역**과의 모순이 아니라 같은 문서의 "구현 현황" 표가 실제 구현 상태를 반영하지 못하는 spec-vs-code drift 라 원칙적으로 cross_spec 보다 spec-coverage/rationale_continuity 관점에 더 가깝다. 다만 위 CRITICAL 발견과 같은 표·같은 파일이 이중으로 stale 상태라, project-planner 가 §6 표를 갱신하는 김에 함께 처리하는 편이 효율적이라 참고로 남긴다.
  - 제안: `project-planner` 가 node-cancellation.md §6 갱신 시 이 두 행도 `✓ 구현됨`으로 함께 정정.

## 요약

diff 자체는 `spec/conventions/**` 를 변경하지 않았지만, diff 가 지목하는 `spec/conventions/node-cancellation.md` 를 열어 대조한 결과 해당 문서의 §1/§6 이 chat-channel 을 "노드"로 서술하는 부분이 `1-data-model.md §2.8`(Trigger 엔티티 SoT) 및 `5-system/15-chat-channel.md`(CCH-AD-05, 어댑터가 outbound listener 임을 규정하는 SoT)와 직접 모순된다. 이는 developer 가 이미 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 에 반증 근거와 함께 제안해 둔 내용과 정확히 일치하며, `spec/` 쓰기 권한이 없어 아직 반영되지 않은 상태다. 부수적으로 같은 §6 표의 MakeShop/Cafe24 행도 이미 병합된 구현과 어긋난 채로 남아 있다. 두 문제 모두 project-planner 의 다음 spec 갱신에서 함께 처리 가능한 국소적 수정이며, target 문서 자체가 새로 도입한 요구사항 ID·API 계약·RBAC·상태 전이 충돌은 발견되지 않았다.

## 위험도

MEDIUM
