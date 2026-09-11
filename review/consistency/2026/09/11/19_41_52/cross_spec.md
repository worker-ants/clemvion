# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done, `impl-chat-channel-binder-t2`)

## 검토 범위 및 방법

이번 diff(`origin/main...HEAD`, 8파일/1130줄)는 `TriggersService.setupChatChannel` /
`teardownChatChannel` 을 신규 `ChatChannelBinderService`(`modules/triggers/chat-channel-binder.service.ts`)
로 이동하고, 공유 헬퍼 `buildTriggerCallbackUrl`(`trigger-callback-url.ts`)을 추출한 **순수
이동 리팩터**다(`plan/in-progress/impl-chat-channel-binder-t2.md` — `spec_impact: none`).
`spec/**` 파일은 이번 diff 에서 **한 글자도 바뀌지 않았다**.

프롬프트 번들은 예산 초과로 `spec/5-system/15-chat-channel.md` 외 15개 파일 본문을 생략했다.
워크트리를 절대경로로 직접 열어 대조했다:

- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`,
  `trigger-callback-url.ts`, `triggers.service.ts`(diff 적용 후 전문) — 실제 이동 결과 확인
- `spec/5-system/15-chat-channel.md` (frontmatter + §5.4/§7/R-CC-* grep)
- `spec/conventions/secret-store.md`, `chat-channel-adapter.md`
- `spec/data-flow/14-chat-channel.md`
- `plan/in-progress/impl-chat-channel-binder-t2.md`, `spec-draft-nullable-notation-followups.md`
  (기존 backlog 등재 여부 대조)
- 직전 `--impl-prep` 라운드 산출물 `review/consistency/2026/09/11/17_39_32/cross_spec.md`
  (동일 대상에 대한 사전 판정과의 연속성 확인)

## 발견사항

- **[WARNING]** `setupChatChannel` 심볼 귀속 서술 3곳이 이번 이동으로 실제로 낡았다 (이미 등재됨)
  - target 위치: 이번 diff 자체 (`spec/**` 미변경) — `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`, `triggers.service.ts` (실제 이동 결과)
  - 충돌 대상:
    - `spec/conventions/secret-store.md:146` — *"`triggers.service.ts.setupChatChannel` 구현체"*
    - `spec/conventions/chat-channel-adapter.md:369` — *"(`TriggersService.setupChatChannel`)"*
    - `spec/data-flow/14-chat-channel.md:29` — 구현 파일 목록에서 `setupChatChannel` 을 `triggers.service.ts` 귀속으로 서술
  - 상세: 코드를 직접 확인한 결과 `setupChatChannel`/`teardownChatChannel` 은 이제 `ChatChannelBinderService`(`chat-channel-binder.service.ts`)의 메서드이고, `triggers.service.ts` 는 `this.chatChannelBinder.setupChatChannel(...)` 로 **호출만** 한다(`triggers.service.ts:448,565,855`). 위 3곳은 심볼 경로(파일·클래스)를 구식으로 지목하고 있어 "지금 그 파일을 열면 그 메서드가 없다" 는 좁은 의미의 모순이 생긴다. 단, **규칙의 실질**(secret store 쓰기 전략·rotate 시맨틱·setup 시점 등)은 여전히 참이다 — `TriggersService` 가 그 규칙을 (간접) 호출해 같은 시점에 실행되므로 동작 계약 자체는 안 깨졌다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:2313-2333`(및 `spec/5-system/15-chat-channel.md` frontmatter `code:` 8개 파일 누락 — 같은 위치 :2200-2224)에 planner 항목으로 정확히 등재돼 있다. 처방도 "`TriggersService` 가 `ChatChannelBinderService` 의 …를 호출해" 형태로 호출자/정의처를 분리 서술하는 것으로 명시돼 있다. **본 리포트는 새 발견이 아니라 독립 재확인**이다 — `--impl-prep`(`17_39_32`) W2 가 이미 짚었고, 이 diff 가 그 예고를 실현시켰을 뿐이다. 자기-반증형 소정정 조건 1(작성자가 developer 자신)이 불성립(그 문장은 이전 planner 턴이 씀)하므로 정정은 developer 가 아니라 planner 턴이 맞다 — plan 서술 그대로다.

- **[INFO]** 신규 파일 2개가 `15-chat-channel.md` frontmatter `code:` 명시 경로 목록에 없음 (이미 등재됨)
  - target 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`, `trigger-callback-url.ts` (신규 파일, 이번 diff)
  - 충돌 대상: `spec/5-system/15-chat-channel.md` frontmatter `code:` (명시 경로 나열, `modules/chat-channel/**` 만 glob)
  - 상세: `code:` 목록에 두 신규 파일이 없어 spec-linked 검증 스코프에서 제외된다. `plan/in-progress/spec-draft-nullable-notation-followups.md:2200-2224` 가 "T1 이 만든 결함 클래스의 재발"(누적 6→8개)로 이미 정확히 같은 개수·같은 파일을 지목하고, `modules/triggers/**` glob 전환 대안까지 병기해 두었다.
  - 제안: 추가 조치 불요 — 기존 backlog 항목 처리로 충분.

## 요약

이 PR 은 `spec_impact: none` 을 선언한 순수 코드 이동이며, 실측 결과 그 주장과 일치한다 — 새
엔드포인트·데이터 모델·상태 전이·RBAC 변경은 없고 에러 코드(`CHAT_CHANNEL_ENDPOINT_REQUIRED`
등)·URL 형태·secret rotate 시맨틱도 이동 전후 동일함을 코드에서 직접 확인했다. 유일한
cross-spec 영향은 "어느 파일/클래스가 `setupChatChannel` 을 소유하는가" 라는 **심볼 귀속
서술**이 3개 문서(`secret-store.md`·`chat-channel-adapter.md`·`data-flow/14-chat-channel.md`)에서
낡는 것인데, 이는 `--impl-prep`(`17_39_32`) 라운드에서 이미 예견돼 planner 후속 항목으로
정확한 위치·처방과 함께 등재돼 있다(`spec-draft-nullable-notation-followups.md`). 규칙의 실질은
깨지지 않았으므로 CRITICAL 은 아니며, 이 PR 자체를 막을 이유는 없다.

## 위험도

LOW
