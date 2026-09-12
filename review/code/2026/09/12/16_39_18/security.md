# 보안(Security) 코드 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강

## 검토 범위

`codebase/backend/src/modules/triggers/` 하위 8개 파일 (chat-channel-input-rules.{ts,spec.ts},
chat-channel-rejection-messages.const.ts, dto/chat-channel-config.dto.ts,
dto/chat-channel-rotate-bot-token.dto.ts(신규), dto/trigger-dto-validation.spec.ts,
triggers.controller.ts, triggers.service.ts). `git diff origin/main...HEAD --stat -- codebase/`
로 대조해 프롬프트에 실린 8개 코드 파일과 실제 diff 파일 목록이 일치함을 확인했다. plan/review
문서(파일 9~13)는 산문 기록이라 별도 보안 판정 대상이 아니다.

## 방법

- `chat-channel-input-rules.ts` 전체 diff(`git diff origin/main...HEAD`)를 라인 단위로 대조해
  기존 5개 차단 필드(`botTokenRef`·`inboundSigningRef`·`inboundSigning`·`botToken`·
  `inboundSigningPlaintext`)의 존재 검사·에러 봉투(`code`·`message`·`details.field`·
  `details.code`)가 리팩터 전후 **1:1 로 보존**되는지 확인 — 전부 보존됨. 헬퍼 추출 과정에서
  가드가 하나라도 누락되면 그것이 바로 이 파일이 막으려는 취약점 클래스(내부 필드/비밀
  값필드가 PATCH 로 새는 것)의 재발이므로 가장 먼저 검증했다.
- `grep -rn "class ChatChannelBotIdentityDto\|class ChatChannelRotateBotIdentityDto"` 로 이전
  라운드(`review/code/2026/09/12/16_17_57`)에서 CRITICAL 로 지목된 OpenAPI 스키마 클래스명
  충돌(`ChatChannelBotIdentityDto` 중복)이 현재 코드에서 실제로 해소됐는지 직접 확인 —
  `chat-channel-config.dto.ts:149` 의 기존 클래스와 `chat-channel-rotate-bot-token.dto.ts:30`
  의 신규 클래스(`ChatChannelRotateBotIdentityDto`)가 서로 다른 이름임을 확인했다.
- `triggers.service.ts` 의 `rotateBotToken` 전체(secret rotate·adapter 호출·감사 로그) 를 읽어
  새 토큰 평문이나 provider 원문 에러가 응답·로그에 노출되지 않는지 확인 — `logger.warn` 은
  provider 에러 메시지만 서버 로그에 남기고 `translateSetupChannelError` 는 client-safe 고정
  문자열만 반환한다(이 diff 가 건드리지 않은 기존 설계, 반환 타입 주석 3줄만 변경).
- 하드코딩 시크릿 여부: `git diff origin/main...HEAD -- codebase/` 전체에 대해 API 키·비밀번호·
  토큰·인증서 패턴 grep — 0건. 신규 DTO 의 `example` 값(`123456789`, `T0123ABC`, `a1b2…`)은
  전부 placeholder.

## 발견사항

발견된 CRITICAL/WARNING 없음. 참고용 INFO만 기록한다 (이미 plan 트래커에 등재·처분됨 — 재작업
불요, 대조 확인 목적).

- **[INFO]** `rotateBotToken` 엔드포인트의 `:id` 파라미터에 `ParseUUIDPipe` 부재 (형제
  `revokePerTriggerToken`은 `@Param('id', ParseUUIDPipe)`).
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:286` (`@Param('id') triggerId: string`)
  - 상세: 이 diff 는 해당 줄을 건드리지 않았다 — PR 이전부터 있던 상태(pre-existing). 비-UUID
    입력 시 `findById` 가 어느 층에서 실패하는지(DB 레벨 vs 400)는 미검증 상태로 이 PR 스코프
    밖이며, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 별도 항목으로
    등재돼 있다(developer, 2026-09-12).
  - 제안: 후속 PR 에서 정렬. 이번 diff 를 막을 사유 아님.

- **[INFO]** (긍정적 관찰) 이번 diff 의 신규 테스트(`chat-channel-input-rules.spec.ts` 의
  `it.each(['null','빈 문자열'])` 2세트)가 이전 라운드(`16_17_57`)에서 WARNING 으로 지목됐던
  "두-층 등가성의 서비스 쪽 절반 미검증" 갭을 실제로 메운다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` — `hasField`
    검증용 `it.each` 블록 (신규 첫 번째·두 번째 `it.each`, `assertPatchCarriesNoSecrets` 대상)
  - 상세: `hasField` 의 `typeof … !== 'undefined'` 판별을 falsy 판별(`!value`)로 바꾸는 뮤턴트가
    조치 전에는 무통과였고(`null`/`''` 로 보낸 `botToken`/`inboundSigningPlaintext` 가 DTO
    `@IsEmpty()` 와 서비스 가드 양쪽을 통과), 이 PR 의 신규 케이스로 그 경로가 고정됐다.
    실제 소스(`hasField`, `chat-channel-input-rules.ts:70`)를 읽어 `typeof … !== 'undefined'`
    구현이 유지되고 있음을 확인 — 회귀 없음.

- **[INFO]** provider 부재 거부 메시지의 label 스왑 방지 단언 추가는 정보노출이라기보다
  UX/정확성 개선이지만, "Slack 요청에 Discord 안내 문구가 나가는" 오분류를 막는다는 점에서
  보안 인접 영역으로 관측만 남긴다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` —
    `assertInboundSigningPlaintextByProvider` provider 부재 `it.each` 블록
  - 상세: 실제 검증 대상 함수 `chat-channel-input-rules.ts:262`
    (`assertInboundSigningPlaintextByProvider`)의 label 분기(`slack`→'Slack signing secret',
    `discord`→'Discord application public key')는 이 diff 로 변경되지 않았고 helper 추출로
    행위가 보존됨을 위 diff 대조로 확인했다.

## 요약

이번 PR 은 `chat-channel-input-rules.ts` 의 반복된 `BadRequestException` 봉투 생성 11곳을
`throwInvalidField`/`hasField`/`rejectBlockedField` 세 헬퍼로 추출하는 순수 리팩터와, 신규
`rotateBotToken` 응답 DTO·swagger 문서화, 그리고 이전 리뷰 라운드(`16_17_57`)가 지목한 CRITICAL
(OpenAPI 스키마 클래스명 충돌)과 WARNING(서비스 층 null/빈문자열 미검증) 을 조치한 커밋을
포함한다. `git diff` 라인 단위 대조로 5개 차단 필드의 존재 검사·에러 봉투 형태가 리팩터 전후
완전히 동일하게 보존됨을 확인했고(가드 누락 없음), 신규 DTO 필드(`publicKey`, `teamId`,
`botId`, `username`)는 모두 비민감 공개 식별자이며 하드코딩된 시크릿·API 키는 diff 전체에서
0건이다. 인증(`@Roles('editor')`)·인가(`workspaceId` 스코프의 `findById`) 흐름은 이 diff 가
건드리지 않았고, 에러 응답(`translateSetupChannelError`)이 provider 원문을 클라이언트에 노출하지
않는 기존 설계도 그대로 유지된다. 새로 발견된 취약점은 없으며, 오히려 `null`/`''` secret 우회
가능성을 테스트로 고정해 회귀 방지 표면을 넓히는 방향의 변경이다.

## 위험도
NONE
