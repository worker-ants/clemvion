# 요구사항(Requirement) 코드 리뷰

## 컨텍스트 — 이 세션의 7번째(사실상 최종) 라운드

이 브랜치는 같은 세션에서 이미 6라운드 리뷰(`16_17_57`→`17_52_34`)를 거쳤고, 라운드 6이
"CRITICAL 0 · WARNING 이 새 결함 클래스가 아니면 수렴" 규칙에 따라 **수렴**을 선언했다.
이번 라운드는 그 이후 발생한 `--impl-done` consistency-check(`18_08_30`)를 반영한 최종
`/ai-review` 패스로 보인다. 과거 라운드의 산출물을 그대로 신뢰하지 않고, 아래 항목을
저장소 파일을 직접 열어 독립적으로 재검증했다.

## 검증 방법

- `chat-channel-input-rules.ts` 전체를 직접 읽고 §5.4.1 / §5.4.1.1 / §5.4.1.2 / R-CC-21 /
  R-CC-23 표와 라인 단위로 대조.
- `triggers.controller.ts`의 `rotateBotToken` 데코레이터·본문을 spec §5.4 실패 응답 표
  (`RESOURCE_NOT_FOUND`/`INVALID_BOT_TOKEN`/`WORKSPACE_ID_REQUIRED`/`CHAT_CHANNEL_NOT_CONFIGURED`/
  `CHAT_CHANNEL_PROVIDER_UNKNOWN`/`CHAT_CHANNEL_ENDPOINT_REQUIRED`/`BOT_TOKEN_INVALID`/
  `CHAT_CHANNEL_SETUP_FAILED`)와 대조.
- `triggers.service.ts`의 `rotateBotToken()` 6단계 전문을 읽고 성공 응답 필드(`rotatedAt`/
  `triggerId`/`chatChannelHealth`/`botIdentity`)를 spec 예시 JSON과 대조.
- 신규 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`의 `ChatChannelRotateBotIdentityDto`
  필드(`botId`/`username`/`teamId?`/`publicKey?`)를 `chat-channel/types.ts`의
  `ChatChannelConfig['botIdentity']` 실제 선언과 필드 단위로 대조 — 완전 일치.
- 신규 `repo-guards/__tests__/dto-class-name-collision-guard.ts` + `.spec.ts`를 읽고,
  `find . -name '*.dto.ts'`로 `src/` 전체 117개 중 `modules/`+`common/` 114개(스캔 대상) /
  `repo-guards`(fixture) 3개로 실측 분리를 재현 — 가드의 "베이스라인 0, 전수 114개" 주장과
  grep 실측이 일치.
- `trigger-dto-validation.spec.ts`의 신규 `provider` 필수 테스트가 검증하려는 DTO 상속 관계
  (`OmitType(ChatChannelConfigDto, ['botToken','inboundSigningPlaintext'])`)를 실제 DTO 선언에서
  확인.
- 관련 3개 스펙(`chat-channel-input-rules.spec.ts`, `trigger-dto-validation.spec.ts`,
  `dto-class-name-collision.spec.ts`) + `triggers.service.spec.ts`를 `npx jest`로 직접 재실행 —
  전부 GREEN(114 + 128 tests).
- `TODO|FIXME|HACK|XXX` grep — 리뷰 대상 코드 파일 전체에서 0건.
- `git status --short` — 이 리뷰 출력 디렉터리(`review/code/2026/09/12/18_21_05/`) 외 워킹트리
  변경 없음. 저장소 파일을 뮤테이션하지 않았다(원복 불필요).

## 발견사항

- **[INFO]** (기존에 이미 등재·수렴된 항목, 재확인만) `spec/5-system/15-chat-channel.md`
  frontmatter `code:` glob이 신규 파일 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`를
  못 잡는다.
  - 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` (glob `.../dto/chat-channel-*.dto.ts`)
  - 상세: `*`가 `/`를 넘지 않는 정본 glob 매처 특성상 `dto/responses/` 하위는 이 spec의 시야
    밖이다. 다만 이는 **spec 이 낡은 쪽**(코드는 `swagger.md §5-1` 응답 DTO 배치 규약을 정확히
    따랐다)이고, `2-trigger-list.md`의 `dto/**` glob이 spec-link 판정 자체는 여전히 덮는다.
    developer 축은 `spec/` 쓰기 권한이 없어 이 PR 범위에서 고칠 수 없는 항목이며, 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md` (하단 체크리스트, `code:` glob을
    `dto/**/chat-channel-*.dto.ts`로 넓히는 processor=planner 항목)에 정확히 등재돼 있다.
  - 제안: [SPEC-DRIFT] 코드 유지(재배치가 올바른 결정) + `spec/5-system/15-chat-channel.md`
    frontmatter `code:` 를 `dto/**/chat-channel-*.dto.ts` 로 넓히는 것을 planner 턴에서 반영.
    이번 developer 턴/리뷰에서 추가 조치 불요 — 이미 계획대로 처리 중인 항목의 재확인일 뿐
    새 결함이 아니다.

이 외 CRITICAL/WARNING 급 요구사항 결함은 발견하지 못했다. 아래는 확인한 강점(발견사항 아님,
검증 근거로 기록):

- `chat-channel-input-rules.ts`의 `assertChatChannelInputSafe` 오버로드가 `mode`와 DTO 타입을
  컴파일 타임에 묶어, 이전 보안 결함 클래스(create/update DTO 오배치)가 타입 레벨에서 재발
  불가능하도록 구조화돼 있다 — 함수 본문·오버로드 시그니처·주석의 의도가 정확히 일치.
- `assertInboundSigningPlaintextByProvider`의 provider 분기(telegram 금지 / slack·discord 필수 +
  형식 검증)가 spec `providers/{slack,discord}.md §6`과 라인 단위로 일치하고, "부재" 분기와
  "형식 불일치" 분기 양쪽 모두 provider별 label 스왑을 잡는 `it.each` 대칭 테스트로 뮤테이션
  검증돼 있다(라운드 6에서 형제 분기 누락이 실제로 잡혀 수정된 이력 확인).
- `rotateBotToken` 서비스의 6단계(secret resolve → v2 백업 → primary rotate → setupChannel 재호출
  → issuedInboundSigning 저장 → DB 컬럼 갱신)에서 감사 로그(`recordAudit`)가 **DB 갱신 이후에만**
  기록돼, 중간 실패 시 "회전됐다"는 거짓 audit row가 남지 않는다 — 반환값도 모든 실패 경로에서
  적절한 예외(`BadRequestException`/`BadGatewayException`)로 귀결되고 성공 경로만 DTO 객체를
  반환해 반환값 누락 경로가 없다.
- 신규 `ChatChannelRotateBotIdentityDto`가 `chat-channel-config.dto.ts`의 기존
  `ChatChannelBotIdentityDto`와 클래스명이 겹치지 않음을 재확인(과거 라운드 CRITICAL의 해소가
  유지됨) — 재발 방지용 `dto-class-name-collision` 가드가 실측 그대로 GREEN.
- `provider` PATCH 필수성 테스트가 `chat-channel-input-rules.ts`의 "HTTP 경로 도달 불가"
  주석 근거를 실제로 고정한다 — 의도(주석)와 구현(DTO 상속 체인)이 일치.

## 요약

6라운드에 걸친 기존 리뷰가 CRITICAL 1건(응답 DTO 클래스명 충돌)과 WARNING 다수(필드 누락 문서,
파일 배치 규약, orphan 주석, 인용 형식, 형제 분기 뮤테이션 누락)를 모두 실측 기반으로 조치·검증한
상태이며, 이번 라운드에서 소스를 직접 재대조한 결과 그 조치들은 spec(`15-chat-channel.md` §5.4 /
§5.4.1 / §5.4.1.1 / §5.4.1.2 / R-CC-21 / R-CC-23)과 line-level로 정확히 일치한다. `rotateBotToken`
엔드포인트의 성공/실패 응답 필드, `chatChannel` 입력 검증의 create/update 분기, provider별
`inboundSigningPlaintext` 요구/금지 규칙 모두 spec 표·서술과 대조해 어긋남이 없고, 관련 테스트가
전부 GREEN이며 TODO/FIXME 등 미완성 표식도 없다. 유일한 잔여 항목(spec `code:` glob이 신규 파일
경로를 못 잡음)은 SPEC-DRIFT로, 코드가 아니라 spec frontmatter 쪽이 낡은 것이고 이미 planner 축
백로그에 등재돼 있어 이번 PR의 신규 결함이 아니다.

## 위험도

NONE
