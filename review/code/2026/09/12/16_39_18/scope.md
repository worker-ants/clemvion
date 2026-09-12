# 변경 범위(Scope) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강 (라운드 2)

## 검증 방법

프롬프트 번들이 파일 2(`chat-channel-input-rules.ts`)의 diff 를 예산 초과로 72/262줄만 실었기
때문에, `git diff origin/main..HEAD`(커밋 `18b0c6aa6` + `d8ad68b25`, `c9bc5dca6` 기준)로 전체
diff 를 직접 열어 대조했다. 저장소 파일은 조회만 했고 아무것도 쓰지 않았다(`git status --short`
로 확인 — 이 리뷰가 만든 미커밋 변경은 `review/code/2026/09/12/16_39_18/`(본 리뷰 출력) 뿐).

- `git diff --stat origin/main..HEAD` → 31개 파일, `+1904/-107`.
- `plan/in-progress/chat-channel-rules-cleanup.md` 가 선언한 6개 작업 항목 및 `RESOLUTION.md` 가
  기록한 라운드 1 조치(CRITICAL 1 · WARNING 3) 각각과 diff 를 1:1 대조.
- `chat-channel-input-rules.ts` 전체 diff, `triggers.service.ts`/`triggers.controller.ts`/
  `chat-channel-rotate-bot-token.dto.ts` 의 두 커밋(`18b0c6aa6`→`d8ad68b25`) 분리 diff를
  각각 직접 열람.

## 발견사항

없음.

## 근거

- **파일 1·2·3·4 (`chat-channel-input-rules.{ts,spec.ts}`, `chat-channel-rejection-messages.const.ts`,
  `dto/chat-channel-config.dto.ts`)**: 전체 diff 를 직접 대조한 결과 `throwInvalidField`/
  `hasField`/`rejectBlockedField` 헬퍼 추출과 11개 호출부 치환은 기존 `throw new
  BadRequestException({code, message, details})` 블록을 글자 단위로 함수 호출로 옮긴 것뿐이다 —
  `field`/`message`/검사 순서 어디에도 로직 변경이 없다. 3곳의 stale `TriggersService` 귀속
  주석 정정도 문면만 바뀌었다(코드·타입 변경 없음). plan 작업 #1~#4 와 정확히 대응.
- **파일 5 (`dto/chat-channel-rotate-bot-token.dto.ts`, 신규)**: plan 작업 #6 의 일부. 라운드 1
  CRITICAL(동명 클래스 `ChatChannelBotIdentityDto` 충돌)에 대한 라운드 2 수정(`d8ad68b25`)이
  개명(`ChatChannelRotateBotIdentityDto`)과 `publicKey` 필드 추가(W1)만 건드렸음을 diff 로 확인 —
  같은 라운드 리뷰가 지목한 항목 범위를 벗어나지 않는다.
- **파일 6 (`dto/trigger-dto-validation.spec.ts`)**: 추가된 테스트 1건은 plan §설계 판단 (3)이
  "`incoming.provider &&` 도달 불가" 주장의 근거로 명시적으로 요구한 DTO 계층 테스트와 정확히
  일치.
- **파일 7·8 (`triggers.controller.ts`, `triggers.service.ts`)**: `triggers.controller.ts` 는
  `@ApiUnauthorizedResponse`(W2)·`@ApiNotFoundResponse`/`@ApiOkWrappedResponse`(작업 #6)·반환
  타입 DTO 화만 포함하고, 신규 import 는 실제 사용되는 `ChatChannelRotateBotTokenDto` 하나뿐이다
  (`ApiUnauthorizedResponse` 등 기존 데코레이터 import 는 변경 전부터 있었음을 `grep` 으로 확인).
  `triggers.service.ts` 는 `botIdentity` 필드 타입 선언 1줄만 `NonNullable<ChatChannelConfig
  ['botIdentity']>` 로 바뀌었다(W1) — `ChatChannelConfig` 는 이미 5번 줄에서 import 돼 있던
  타입이라 신규 import 도 없다. 둘 다 라운드 1 SUMMARY 의 W1·W2 항목 그대로다.
- **파일 9·10 (plan 문서)**: `spec-draft-nullable-notation-followups.md` 는 2900줄대 대형 공유
  트래커인데, diff 는 이 작업이 참조한 항목(§rotateBotToken swagger·§구조정리 6건·§spec 보강 5건)
  체크 처리 + 신규 항목 2건 등재에 국한됐다 — 트래커의 다른 수백 개 항목은 건드리지 않았다.
  `chat-channel-rules-cleanup.md` 는 이 작업 자신의 진행 기록(정지 규칙·뮤테이션 실측표)이다.
  둘 다 `spec/**` 는 건드리지 않아 plan frontmatter `spec_impact: none` 과 일치.
- **파일 11~31 (`review/code/2026/09/12/16_17_57/**`, `review/consistency/2026/09/12/15_53_35/**`)**:
  각각 CLAUDE.md 가 규정한 코드 리뷰 산출물 위치(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)와
  구현 착수 전 의무 `/consistency-check --impl-prep` 산출물 위치(`review/consistency/**`)에
  정확히 부합한다. 새로 프로세스를 발명한 것이 아니라 규약이 요구하는 표준 산출물이며, 이
  reviewer 자신의 스코프 관점에서도 무관한 추가가 아니다.
- **포맷팅·임포트·설정**: `codebase/` 안에서 위 작업 항목이 가리키는 파일 외에는 건드리지
  않았다(frontend diff 0줄, `.claude/**`·`package.json`·`tsconfig*.json`·lint 설정 등 diff 0줄).
  `chat-channel-input-rules.ts` 의 `import` 변경은 `ChatChannelBlockedField` 타입 1개 추가뿐이고
  실제로 `rejectBlockedField` 시그니처에 쓰인다(불필요 import 아님).
- **라운드 2(fix) 커밋의 범위**: `d8ad68b25` 는 `/ai-review` `16_17_57` 이 지목한 CRITICAL 1 ·
  WARNING 3 정확히 4건만 건드렸다 — CLAUDE.md 가 "구현 완료 후 Critical/Warning fix 는 같은 턴의
  강제 의무" 로 규정한 워크플로 그대로이며, 그 4건 외의 코드 재작업(예: INFO 항목 선반영, 관련
  없는 리팩터 추가)은 없음을 diff 로 확인했다.

## 요약

31개 변경 파일 전체를 `plan/in-progress/chat-channel-rules-cleanup.md` 의 6개 선언 작업 + 라운드 1
리뷰(`16_17_57`)가 지목한 CRITICAL 1·WARNING 3 건에 1:1 대응시켜 확인했다. 프로덕션 코드
변경(`chat-channel-input-rules.ts`/`.spec.ts`, `triggers.controller.ts`, `triggers.service.ts`,
신규 `chat-channel-rotate-bot-token.dto.ts`, stale 주석 2개 파일)은 모두 해당 작업 항목 또는
라운드 1 리뷰 지적사항의 정확한 구현이며, 응답 형태·엔드포인트 동작을 바꾸지 않는 순수 리팩터 +
문서화 보강이라는 plan 의 주장과 실제 diff 가 일치한다. `plan/**`·`review/**` 산출물은 CLAUDE.md 가
요구하는 표준 워크플로 위치와 정확히 일치해 스코프 밖 추가가 아니다. 의도 이상의 변경·불필요한
리팩토링·요청하지 않은 기능 추가·무관한 파일 수정·의미 없는 포맷팅/주석/임포트/설정 변경은
발견하지 못했다.

## 위험도

NONE
