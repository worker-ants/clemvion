# Cross-Spec 일관성 검토 — chat-channel-rules-cleanup

## 검토 방법 메모

전달된 프롬프트 번들은 예산 초과로 `spec/5-system/*` 본문 다수(16개)와 실제 `git diff` 블록이
절단되어 있었다. 프롬프트 자체가 지시한 대로 판정은 프롬프트 텍스트가 아니라 워크트리 절대경로
(`/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rules-cleanup`)에서 직접
`git diff origin/main...HEAD`, 관련 `spec/5-system/15-chat-channel.md`·`spec/2-navigation/2-trigger-list.md`·
`spec/conventions/swagger.md`·`spec/5-system/1-auth.md`·`plan/in-progress/chat-channel-rules-cleanup.md`·
`plan/in-progress/spec-draft-nullable-notation-followups.md` 를 직접 읽어 수행했다.

**이 검토 대상 델타**: `spec/5-system/` 자체는 변경 0건(`spec_impact: none`, plan frontmatter 와 일치).
실 코드 diff 는 `codebase/backend/src/modules/triggers/**` 14개 파일 / 948줄 — 전량이
`chat-channel-input-rules.{ts,spec.ts}` 구조 정리(헬퍼 추출) + `rotateBotToken` swagger 응답
DTO 신설 + 신규 `dto-class-name-collision` repo-guard 다. plan 은 "응답 형태를 한 바이트도
바꾸지 않는다"고 선언하며, 실제 diff 대조 결과 그 선언은 참이다 — 모든 `throw` 호출부가
동일한 `code`/`field`/`message`를 유지한 채 `throwInvalidField`/`rejectBlockedField` 헬퍼로만
재배선됐다.

## 발견사항

- **[INFO]** `15-chat-channel.md §7` 파일 트리가 신규 응답 DTO 파일을 아직 열거하지 않음
  - target 위치: (target 자체는 무편집이므로) 코드 diff `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 신설
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §7 파일 트리(트리거 하위 목록, `dto/chat-channel-config.dto.ts` · `dto/create-trigger.dto.ts` 만 등재) 및 그 `code:` glob(`triggers/dto/chat-channel-*.dto.ts` — `*` 가 `/` 를 넘지 않아 `dto/responses/` 하위 미포함)
  - 상세: 신규 파일은 `spec/conventions/swagger.md §5-1`(`dto/responses/*-response.dto.ts`) 규약에는 정확히 맞고, `spec/2-navigation/2-trigger-list.md` 의 `code:` glob(`dto/**`)이 이미 이 파일을 포괄해 spec-link 자체는 끊기지 않는다. 다만 `15-chat-channel.md` 관점에서는 "자기 파일을 자기 spec 이 못 본다"는 좁은 갭이 실측대로 남아 있다. 이는 이번 PR 이 새로 만든 모순이 아니라, PR 이 스스로 인지하고 코드 주석(`dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 헤더)과 `plan/in-progress/spec-draft-nullable-notation-followups.md:3083-3092`(processed 항목, 2026-09-12 등재)에 기록해 둔, planner 축으로 이관된 잔여 항목이다.
  - 제안: 조치 불필요(이미 트래커에 등재됨). planner 가 `15-chat-channel.md` glob 을 `dto/**/chat-channel-*.dto.ts` 로 넓히는 턴에서 함께 정리하면 된다.

- **[INFO]** `chat-channel-input-rules.ts` 가 입력검증+출력변환(§5.4 에러 번역) 두 책임을 겸함을 §7 파일 트리 한 줄 설명이 아직 반영하지 않음
  - target 위치: 코드 diff 상단 헤더 주석 확장분(신규 서술: "입력만 있는 파일이 아니다 — `translateSetupChannelError` 는 …")
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §7, `chat-channel-input-rules.ts` 한 줄 설명("입력 검증·변환 순수 함수")
  - 상세: `translateSetupChannelError` 자체는 이번 diff 로 신설된 함수가 아니라 기존 코드이므로 이 PR 이 새로 만든 계층 책임 충돌은 아니다. PR 은 파일 분리 대신 헤더 주석만 넓히기로 명시적으로 결정했고(plan §설계 판단 (2)), 그 트레이드오프와 planner 후속 항목(`spec-draft-nullable-notation-followups.md:2973`)을 함께 남겨 두었다. 코드-스펙 불일치가 존재하긴 하나 신규도 은닉도 아니다.
  - 제안: 조치 불필요 — planner 가 §7 파일 트리를 다음에 만질 때 파일 분리 여부와 함께 결정하기로 이미 예정됨.

다른 4개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC)에서는 충돌을 찾지 못했다:

- API 계약: `rotateBotToken` 신규 응답 DTO(`ChatChannelRotateBotTokenDto`/`ChatChannelRotateBotIdentityDto`)의 필드(`rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity{botId,username,teamId?,publicKey?}`)는 `15-chat-channel.md §5.4` 의 성공 응답 예시·설명과 정확히 일치한다. 신규 swagger 애노테이션(`@ApiUnauthorizedResponse`·`@ApiNotFoundResponse`)도 §5.4 실패표(404 `RESOURCE_NOT_FOUND`)·인증 전역 규약과 어긋나지 않는다.
- 데이터 모델: 이번 diff 는 엔티티·DTO 필드 형태를 바꾸지 않았다(서비스 반환 타입을 손으로 다시 적던 것을 `ChatChannelConfig['botIdentity']` 참조로 바꿨을 뿐 — 오히려 선언-실제 드리프트 위험을 줄이는 방향).
- 클래스명 충돌 재발 방지: 신규 `ChatChannelRotateBotIdentityDto` 는 기존 `chat-channel-config.dto.ts` 의 `ChatChannelBotIdentityDto` 와 이름이 달라 `@nestjs/swagger` 스키마 충돌이 없음을 확인했다(grep 실측). 이 클래스의 첫 판본이 냈던 동명 충돌(별도 코드 리뷰 CRITICAL, `review/code/2026/09/12/16_17_57`)은 이미 해소된 상태로 diff 에 반영돼 있고, 재발 방지용 `dto-class-name-collision` repo-guard 까지 신설됐다.
- RBAC: `rotateBotToken` 의 `editor 이상 권한 필요` 서술은 `spec/5-system/1-auth.md` L431(트리거 시크릿·토큰 회전 = Editor+ 특권 작업)과 일치하며 이번 diff 로 변경되지 않았다.
- 요구사항 ID: 신규로 부여된 ID 없음(`R-CC-21`·`CCH-SE-04` 등 기존 ID 재인용만).
- 상태 전이: 트리거/chat-channel 상태 머신 변경 없음.

## 요약

이번 PR 은 `spec/5-system/` 을 전혀 건드리지 않는 순수 코드 리팩터링(에러 봉투 헬퍼 추출, 테스트
보강, `rotateBotToken` swagger 문서화 완성, DTO 클래스명 충돌 가드 신설)이며, 응답 형태·에러
코드·RBAC·데이터 모델 어느 것도 바꾸지 않았다는 plan 의 주장이 실제 diff 대조로 확인된다.
새 응답 DTO 는 `swagger.md §5-1` 위치 규약과 `15-chat-channel.md §5.4` 응답 계약에 정확히
부합하고, 과거 리뷰가 잡았던 DTO 클래스명 충돌은 이미 해소돼 있다. 유일하게 남는 것은
`15-chat-channel.md §7` 파일 트리·`code:` glob 이 신규 파일 자리를 아직 자기 눈으로 못 본다는
사소한 self-view 갭인데, `2-trigger-list.md` 의 넓은 glob 이 spec-link 자체는 이미 커버하고
있고 두 tracker 항목(`spec-draft-nullable-notation-followups.md`)에 planner 후속으로 명시
등재돼 있어 은닉된 충돌이 아니다. Cross-spec 관점에서 이 PR 을 막을 근거는 없다.

## 위험도

NONE
