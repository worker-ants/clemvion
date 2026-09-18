# 변경 범위(Scope) 리뷰

## 검토 방법

`git show 537488983`(이 작업의 커밋)와 `plan/in-progress/trigger-release-stale-comments.md` 의
실측표(1~8행)를 diff 훅 단위로 1:1 대조했다. 프롬프트에서 본문이 잘린 세 파일
(`triggers.service.ts`·`triggers.service.spec.ts`·`workspaces.service.spec.ts`)은
`git show`로 전체 diff 를 직접 읽어 확인했다. 저장소 파일은 건드리지 않았다(`git status --short`
확인 결과 세션 시작 시점의 untracked `review/code/2026/09/18/` 외 변경 없음).

## 발견사항

- **[INFO]** 메서드 리네임(`teardownChannelConfig` → `teardownRegisteredChannel`)이 "stale 주석"
  작업에 번들됨
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (정의부 JSDoc·본문),
    `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:123`,
    `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts:53,315`
  - 상세: 순수 주석 정정이 아니라 식별자 리네임이 섞여 있다. 다만 이는 세션이 임의로 추가한 것이
    아니라 `plan/in-progress/trigger-release-stale-comments.md` 실측표 #4행에 사전 등재된 항목이고
    (`teardownChatChannel` 과 어순만 달라 grep/로그에서 혼동된다는 근거), `--impl-prep` 의
    `naming_collision` 체커가 신규 식별자 저장소 전역 충돌 0건을 별도로 검증했다. 동작 변경은
    없다(순수 리네임, 호출 인자·로직 불변). Scope 위반으로 보지 않는다 — plan 에 명시되고
    게이트로 검증된 사전 승인 항목이기 때문.
  - 제안: 조치 불요.

- **[INFO]** 두 곳의 "지나가는 김에" bare 인용 정정이 comment-only 작업에 동반됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:735`(`` `/ai-review` 18_45_09 `` → `` `review/code/2026/09/17/18_45_09` ``),
    `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:320-322`(`SUMMARY#24` bare 인용 해소)
  - 상세: 이 두 정정은 이번 stale-comment 정리가 목표로 하는 결함 클래스(§4.3 사실관계 정정)와는
    다른 축(review-citation 표기 규약, `spec/conventions/review-citations.md §4`)이다. 하지만
    plan 실측표 #3·#8행에 각각 사전 등재돼 있고, "그 주석을 어차피 여는 김에" 라는 명시적 근거가
    적혀 있다(#8: "4 로 여는 파일이라 같이 맞춘다"). 두 곳 다 이번 diff 가 이미 손대는 동일 파일·
    인접 주석 블록 안이라 별도 파일을 새로 여는 것도 아니다. Scope 위반으로 보지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `review/consistency/2026/09/18/11_26_25/**` 8개 파일이 diff 에 포함됨
  - 위치: `review/consistency/2026/09/18/11_26_25/{SUMMARY.md,_retry_state.json,convention_compliance.md,cross_spec.md,meta.json,naming_collision.md,plan_coherence.md,rationale_continuity.md}`
  - 상세: 이 작업이 명시적으로 요청한 코드 변경(주석·이름 정정)과는 별개 산출물이지만,
    `CLAUDE.md` 규약상 `developer` 는 구현 착수 직전 `consistency-check --impl-prep` 을 의무로
    돌려야 하고 그 산출물은 `review/consistency/**` 에 커밋되는 것이 표준 관례다(plan 체크리스트에도
    항목으로 등재됨, BLOCK: NO). 코드 스코프 이탈이 아니라 워크플로 강제 단계의 정상 부산물.
  - 제안: 조치 불요.

## 비대상 확인 (검토했으나 스코프 위반 없음)

- 9개 codebase 파일의 diff 훅 개수(총 11개)를 `git show` 원본과 대조 — 프롬프트에 실린 훅과
  정확히 일치, 숨은 추가 훅 없음.
- 각 훅의 실질 변경이 전부 JSDoc/inline 주석 텍스트 또는 순수 리네임뿐이며, 로직·시그니처·
  import·설정 파일 변경은 0건.
- `teardownChannelConfig` 잔존 참조를 `codebase/` 전역 grep — 리네임 후 남은 것은 "이전 이름"을
  설명하는 신규 JSDoc 문장 하나뿐(의도된 서술).
- 포맷팅(공백·줄바꿈)만의 변경은 발견되지 않음 — 모든 변경 줄이 텍스트 내용을 동반.
- 커밋 메시지("동작 변경 없음")와 실제 diff 가 일치 — 로직 변경이 섞여 있지 않음을 확인.

## 요약

이 변경은 계획서(`plan/in-progress/trigger-release-stale-comments.md`)에 사전 등재된 8개 항목을
정확히 그 항목 수만큼만 건드리는 comment/rename-only 정리다. `git show` 로 재구성한 diff 는
프롬프트에 실린 훅과 1:1 일치하며, 리네임과 두 건의 bare 인용 정정도 "이 파일을 어차피 여는 김에"
라는 근거가 plan 표에 명시돼 있고 impl-prep 게이트(naming_collision 0건 충돌)로 별도 검증됐다.
`review/consistency/**` 8개 파일은 의무 워크플로 단계의 표준 산출물이지 스코프 이탈이 아니다.
의도 이상의 변경, 불필요한 리팩토링, 기능 확장, 무관한 파일 수정, 포맷팅 혼입, 불필요한 임포트·
설정 변경은 발견되지 않았다.

## 위험도

NONE
