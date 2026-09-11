# 변경 범위(Scope) 리뷰

## 검토 범위와 방법

`git show 2ae81077c`(HEAD, `refactor(triggers): chat-channel 입력 규칙을 TriggersService 에서
떼어낸다`)로 실제 커밋 diff 전체를 조회해 프롬프트 번들(11개 파일)과 대조했다. `triggers.service.ts`
는 번들에 "전체 파일 컨텍스트" 가 실리지 않아 `git show` 로 직접 diff 를 재확인했다. 커밋 전/후
`chat-channel-input-rules.ts` 함수 본문을 대조해 순수 이동 여부를 확인했고, 작업 트리는
읽기만 했다(`git status --short` 로 뮤테이션 없음 확인 — 세션 시작·종료 시점 모두 clean, 리뷰
세션 디렉터리만 untracked).

## 발견사항

- **[WARNING] 커밋에 포함된 plan 문서가 같은 커밋의 실제 코드와 모순되는 설계를 서술한다**
  - 위치: `plan/in-progress/impl-chat-channel-binder.md:93` (`### 처방 — 문서화된 진입점 2개는
    **얇은 delegator** 로 남긴다`) 및 그 하위 서술(파일 내 93~102줄)
  - 상세: plan 본문은 `TriggersService.setupChatChannel` ·
    `TriggersService.assertInboundSigningPlaintextByProvider` 를 "한 줄 위임 메서드로 남긴다"고
    명시하고, 그 근거로 "spec 14개 문장이 위임 뒤에도 전부 참이다 — drift 가 0" 이라고 주장한다.
    그런데 같은 커밋의 실제 diff(`triggers.service.ts`)는 `assertInboundSigningPlaintextByProvider`
    를 위임 없이 완전히 제거했다 — `chat-channel-input-rules.ts` 내부에서만 호출되고
    `TriggersService` 는 더 이상 이 심볼을 참조하지 않는다. 커밋 메시지 본문에는 이 설계 반전이
    상세히 설명돼 있다("**내 처방은 …이었는데 그것이 틀렸다** … → 남기지 않았다")지만, **plan
    파일 자체는 반전 전 설계를 그대로 남긴 채 정정되지 않았다.** plan 은 이 저장소에서 "왜 이런
    선택을 했는가"의 단일 진실로 취급되는 문서인데, 같은 diff 안에 서로 모순되는 두 산출물(plan
    서술 vs 실제 코드)이 공존한다. 다음에 이 plan 을 읽는 사람은 delegator 가 남아 있다고 오인할
    수 있다.
  - 제안: `plan/in-progress/impl-chat-channel-binder.md` 의 "처방" 절에 반전 사실을 짧게 추가하거나
    (원문은 취소선으로 남기고 정정 각주 추가), 최소한 커밋 본문의 반전 설명을 가리키는 링크를
    plan 에 남긴다. 커밋 메시지만으로는 plan 파일을 단독으로 읽는 미래 독자에게 전달되지 않는다.

- **[INFO] plan 체크리스트가 이번 커밋에서 실제로 완료된 T1 단계를 미체크 상태로 남겼다**
  - 위치: `plan/in-progress/impl-chat-channel-binder.md` `## 체크리스트` (`- [ ] T1 이동 + 테스트
    diff 0줄 확인`)
  - 상세: 커밋 메시지는 T1 이동이 완료됐고 테스트 diff 0줄·뮤테이션 5/5 RED·타입 진단
    baseline 유지를 실측으로 확인했다고 기술하는데, 같은 커밋에 포함된 plan 파일의 체크리스트는
    해당 항목을 그대로 미체크로 남겼다. 이 저장소 관례상 "체크박스 = 실제 상태" 원칙이 있고
    T1 은 이 커밋에서 이미 참인 상태다. 다만 이 PR 이 T1 만 다루고 T2 는 별도 트래커 항목으로
    이연됐다는 점을 고려하면, "전체 작업 완료 시 일괄 체크" 관례(plan 종결과 체크가 한 동작)로도
    설명 가능해 CRITICAL/WARNING 은 아니다.
  - 제안: T1 항목만이라도 체크해 두면 이 plan 을 다시 여는 다음 세션(T2 착수 시)이 "이미 끝난
    범위"를 재확인하는 수고를 던다.

## 스코프 내로 확인된 항목 (참고용)

- `chat-channel-input-rules.ts`(신규) ↔ `triggers.service.ts`(삭제분)의 함수 본문·JSDoc·인라인
  주석을 대조한 결과 **텍스트 수준에서 동일**하다 — `private` → `export function` 전환과 호출부의
  `this.` 제거를 제외하면 로직·주석·에러 메시지·타입 서명이 한 글자도 바뀌지 않았다. 커밋이 주장하는
  "순수 이동"과 diff 내용이 정확히 일치한다.
  - `BadRequestException`·`ErrorCode` 등 기존 import 는 `triggers.service.ts` 안에 여전히 사용처가
    남아 있어(예: `ErrorCode.INVALID_FIELD` 2곳) 불필요 import 잔존이 없다.
  - 이동에 따라 제거된 `ChatChannelConfigDto`/`ChatChannelUpdateConfigDto`/
    `SLACK_SIGNING_SECRET_REGEX`/`DISCORD_PUBLIC_KEY_REGEX`/`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`
    import 는 새 위치(`chat-channel-input-rules.ts`)로 정확히 옮겨갔고 원 위치에서 미사용 잔존이
    없다.
  - `setupChatChannel`/`teardownChatChannel`(T2, secret 쓰기 계층)과 `rotateBotToken` 등 3개
    orchestration 메서드는 plan 이 명시한 대로 이번 커밋에서 건드리지 않았다 — plan 이 정한 T1/T2
    경계와 실제 diff 경계가 일치한다.
  - `review/consistency/2026/09/11/14_59_33/**` 8개 파일은 `--impl-prep` 의무 사전 점검(프로젝트
    상시 규약)의 산출물로, 코드 변경과 별개의 무관한 수정이 아니라 이 작업의 필수 절차 증거다.
  - 포맷팅/줄바꿈만 바뀐 hunk, 사용하지 않는 신규 import, 의도치 않은 설정 파일 변경은 발견하지
    못했다.

## 요약

이 PR 은 커밋 메시지·plan 이 주장하는 범위(T1 계층 6개 함수의 순수 이동)와 실제 diff 가 정확히
일치하며, 이동 외의 추가 리팩터링·기능 확장·무관한 파일 수정·불필요한 포맷팅/주석/임포트 변경은
발견되지 않았다. 유일한 스코프 관점 결함은 **같은 커밋 안에서 plan 문서(파일 3)가 서술하는 설계와
실제 코드(파일 1·2)가 서로 모순**된다는 점이다 — commit 본문에는 그 반전이 설명돼 있지만 plan
파일 자체는 정정되지 않아, plan 만 읽는 독자에게 잘못된 최종 설계를 전달한다.

## 위험도

LOW
