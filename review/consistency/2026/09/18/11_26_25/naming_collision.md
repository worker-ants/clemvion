# 신규 식별자 충돌 검토 — `spec/2-navigation/` (--impl-prep)

## 검토 범위 요약

이번 impl-prep 대상 plan(`plan/in-progress/trigger-release-stale-comments.md`)은
`spec_impact: none` 이며, 실제 변경은 `codebase/backend/src/modules/triggers/**` 의
stale 주석 정정 7건 + 메서드 rename 1건(`teardownChannelConfig` → `teardownRegisteredChannel`)뿐이다.
따라서 이 태스크가 **spec 에 새로 도입하는 요구사항 ID·엔티티명·endpoint·이벤트명·ENV
var·파일 경로는 없다**. `spec/2-navigation/` 번들 자체는 기존에 이미 병합되어 있는 spec(대부분
`e63a5bc5d` 등 선행 PR 산출물)이라, 이번 target 이 "새로 도입"하는 식별자로 볼 수 없다.

유일하게 확인이 필요한 신규 식별자는 코드 rename 대상 `teardownRegisteredChannel` (코드 심볼,
spec 대상 아님)이다.

## 발견사항

- **[INFO]** 신규 메서드명 `teardownRegisteredChannel` — 충돌 없음, 검증 완료
  - target 신규 식별자: `teardownRegisteredChannel` (`codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` 의 `teardownChannelConfig` rename 대상, plan 항목 #4)
  - 기존 사용처: 없음 — 저장소 전체(`spec/`, `codebase/`, `plan/`, `review/`)를 대소문자 무시 grep 했고 0건.
  - 상세: plan 문서 자체가 "저장소·spec 0건 확인"이라고 이미 주장하고 있어, 그 주장을 직접 재현·검증했다(`grep -rni teardownregisteredchannel` / `grep -rni RegisteredChannel` 전부 0건, plan 문서 자기 인용 2곳 제외). 인접 기존 심볼 `teardownChatChannel`(저장된 설정 전체 해제, `ChatChannelBinderService`) · `teardownChannelConfig`(rename 전 이름, 보상 경로 전용)와 이름이 겹치지 않으며, 새 이름이 의미(등록된 채널 config 되돌리기)를 더 명확히 분리한다. 충돌 아님, 오히려 §2.6/§4.3 코드-주석 정정 목적에 부합.
  - 제안: 없음 — 그대로 진행 가능.

## 비대상 (검토했으나 신규 식별자 아님)

- `spec/2-navigation/2-trigger-list.md` 의 요구사항 ID(`NAV-WF-07`), Rationale 라벨(`R-1`~`R-17`), 에러 코드(`TRIGGER_ENDPOINT_PATH_CONFLICT`, `INVALID_FIELD` 등), audit 이벤트명(`trigger.deleted`, `trigger.updated`, `trigger.chat_channel_bot_token_rotated`, `trigger.notification_secret_rotated`, `trigger.interaction_token_revoked`), endpoint(`POST /api/triggers/:id/chat-channel/rotate-bot-token` 등) — 전부 이번 plan 이전에 이미 병합된 기존 spec 내용이며, 이번 태스크가 새로 도입하는 것이 아니다. `spec_impact: none` 과 일치.
- plan 항목 #1~#3, #5~#8 (JSDoc/테스트 주석 정정, bare 리뷰 인용 정정) — 식별자 신설이 아니라 기존 사실관계 서술 정정이므로 신규 식별자 충돌 범주 밖.
- `lockParentAndListTriggerIds` (plan 항목 #2 정정문에서 언급) — 기존 코드 심볼 참조일 뿐 이번 태스크가 새로 만드는 이름이 아니다.

## 요약

이번 target 은 `spec_impact: none` 인 순수 주석/코드 정정 + 메서드 rename 1건으로, spec 레벨에서 새로
도입하는 요구사항 ID·엔티티·endpoint·이벤트·ENV var·파일 경로가 전무하다. 유일한 신규 식별자인
`teardownRegisteredChannel` 은 저장소 전역 grep 으로 기존 사용처 0건을 직접 재확인했고, 의미가 겹치는
인접 심볼(`teardownChatChannel`, 구 이름 `teardownChannelConfig`)과도 혼동 소지가 낮다. 신규 식별자
충돌 관점에서 이번 target 은 안전하다.

## 위험도

NONE
