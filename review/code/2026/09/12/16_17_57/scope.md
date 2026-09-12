# 변경 범위(Scope) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강

## 발견사항

없음.

## 근거 (검증 절차)

이 PR 은 `plan/in-progress/chat-channel-rules-cleanup.md` 가 명시한 6개 작업 항목(트래커
`#1319`/`#1320`/`#1324` 잔여의 배치 정리)과 diff 를 1:1 대조해 검증했다.

- `git show --stat 18b0c6aa6` 로 변경 파일 16개 전체를 열거하고, 각 파일이 plan 의 작업 #1~#6
  중 어디에 대응하는지 확인했다.
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`: `throwInvalidField` ·
  `hasField` · `rejectBlockedField` 헬퍼 도입 + 11개 호출부 치환(작업 #1·#2), 헤더 주석 확장
  (작업 #3). `git show` 전문으로 재확인 — 헬퍼 추출·호출부 치환 외의 로직 변경 없음.
  `BadGatewayException`/`BadRequestException` import 둘 다 여전히 사용 중(불필요 import 없음).
- `chat-channel-rejection-messages.const.ts` · `dto/chat-channel-config.dto.ts`: `TriggersService`
  귀속을 가리키던 stale 주석 3곳만 문면 수정(작업 #4). 실 코드·타입 변경 없음.
- `chat-channel-input-rules.spec.ts`: `as never` 캐스팅 제거·`mode:'update'` 내부 필드 3종
  조합·provider label 단언 추가(작업 #5) — plan 의 착수 전 재판정 표(a)(b)(e) 항목과 정확히
  일치.
- `dto/chat-channel-rotate-bot-token.dto.ts`(신규) + `triggers.controller.ts`
  (`@ApiNotFoundResponse`/`@ApiOkWrappedResponse` + 반환 타입을 DTO 로 교체, 작업 #6): 신규 DTO
  필드(`rotatedAt`·`triggerId`·`chatChannelHealth`·`botIdentity`)를
  `TriggersService.rotateBotToken()` 실제 반환 타입과 대조 — 필드 대 필드로 정확히 일치함을
  확인. 즉 새 클래스는 기존 런타임 응답의 **swagger 미러**일 뿐 새 기능이 아니다. 컨트롤러의
  `ApiNotFoundResponse`/`ApiOkWrappedResponse` import 는 이미 파일 상단에 존재해 추가된 것은
  실제 사용되는 `ChatChannelRotateBotTokenDto` import 하나뿐.
- `trigger-dto-validation.spec.ts`: PATCH 에서 `provider` 필수 여부를 고정하는 테스트 1건 추가
  — plan §설계 판단 (3)이 "도달 불가" 주장의 근거로 명시적으로 요구한 테스트와 동일.
- `plan/in-progress/chat-channel-rules-cleanup.md`(신규) + 워크트리 미커밋 상태의
  `spec-draft-nullable-notation-followups.md` 편집: 트래커 항목 체크 처리 + 후속 미결정
  (`responses/` 관례 충돌)을 planner 축 항목으로 신규 등재만 하고 구현하지 않음 — 권한 밖
  변경을 시도하지 않았다는 증거.
- `review/consistency/2026/09/12/15_53_35/**`(SUMMARY·5개 checker 출력·`_retry_state.json`):
  CLAUDE.md 가 구현 착수 직전 의무화한 `/consistency-check --impl-prep` 산출물. 프로세스가
  요구하는 표준 산출물이며 무관한 추가가 아니다.
- `spec/**` 변경 없음 — plan frontmatter `spec_impact: none` 과 일치(developer 권한 경계 준수).
- 포맷팅·임포트·설정 파일에 대한 drive-by 변경 없음. `codebase/` 안에서 위 6개 작업 항목이
  가리키는 파일 외의 파일은 건드리지 않았다.

뮤테이션·저장소 쓰기: 이 리뷰는 저장소 파일을 수정하지 않았다(`git status --short` 로 조회만
수행, `18b0c6aa6` 커밋과 미커밋 diff 는 읽기 전용으로 대조). 원복 불필요.

## 요약

diff 는 plan 문서가 사전에 선언한 6개 작업 항목과 정확히 대응하며, 각 파일 변경이 어느 트래커
항목의 구현인지 전수 대조로 확인했다. 신규 DTO(`ChatChannelRotateBotTokenDto`)는 기존
서비스 반환 타입을 필드 단위로 그대로 미러링하는 swagger 문서화 목적이지 새 기능이 아니며,
헬퍼 추출(`throwInvalidField`/`hasField`/`rejectBlockedField`)은 응답 형태를 바꾸지 않는 순수
구조 정리다. 의도 밖 리팩토링·기능 확장·무관한 파일 수정·불필요한 포맷팅/주석/임포트/설정
변경은 발견되지 않았다. 유일한 잠재적 논쟁 지점(신규 DTO 를 `dto/responses/` 대신 평평한
`dto/` 에 둔 배치 결정)은 그 자체로 실측 근거(glob 이 `/` 를 안 넘는다)를 남기고 관례 충돌을
planner 축 항목으로 명시적으로 등재했으므로, 조용한 스코프 확장이 아니라 문서화된 트레이드오프다.

## 위험도

NONE
