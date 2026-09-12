# 부작용(Side Effect) 리뷰 — chat-channel-input-rules 구조 정리

## 발견사항

- **[INFO]** 컨트롤러 반환 타입 애노테이션 변경 — 실질 영향 없음을 실측으로 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:292` (`rotateBotToken` 반환 타입 `Promise<ChatChannelRotateBotTokenDto>`, 종전 `Promise<Awaited<ReturnType<TriggersService['rotateBotToken']>>>`)
  - 상세: 시그니처(반환 타입)가 바뀌었다. `TriggersService.rotateBotToken()`(`triggers.service.ts:985`)의 실제 선언 반환 타입 `{ rotatedAt: string; triggerId: string; chatChannelHealth: TriggerChatChannelHealth; botIdentity: { botId: number; username: string; teamId?: string } | null }` 을 직접 열어 대조한 결과, 신설된 `ChatChannelRotateBotTokenDto` 와 필드·타입이 완전히 동일하다 — 지금 시점에는 런타임 payload 변화가 없다. 이 컨트롤러 메서드는 HTTP 라우팅으로만 호출되고(`grep` 결과 다른 모듈에서 직접 호출하는 코드 없음), 이 메서드를 직접 부르는 내부 caller 도 없어 시그니처 변경의 호출자 영향은 없다.
  - 참고: 다만 이 변경은 안전성의 방향을 바꾼다 — 종전에는 서비스가 반환 타입을 바꾸면 컨트롤러 타입이 **자동으로 따라갔고** swagger 문서는 그 실측과 무관하게 고정 문구였다. 이제는 서비스 반환 타입이 DTO와 구조적으로 안 맞으면 `tsc` 가 이 자리에서 에러를 낸다(주석이 그 의도를 명시). 즉 이번 diff 로 인한 부작용은 아니고, 향후 드리프트를 컴파일 타임에 잡는 방향의 의도된 강화다.
  - 제안: 조치 불요. 관측 사실만 기록.

- **[INFO]** 공개 OpenAPI(swagger) 스펙 확장 — 인터페이스 변경이지만 additive-only
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken` 데코레이터 블록(`@ApiNotFoundResponse` · `@ApiOkWrappedResponse(ChatChannelRotateBotTokenDto, ...)` 추가)
  - 상세: `POST /api/triggers/:id/chat-channel/rotate-bot-token` 엔드포인트가 노출하는 공개 OpenAPI 문서에 404 응답과 200 응답 스키마가 새로 추가된다. 이는 "인터페이스 변경" 체크리스트 항목에 해당하지만, 실제 HTTP 동작(상태 코드·응답 바디)은 이미 그렇게 동작하고 있었고 이번 변경은 **문서화 누락을 메우는 것**이라 기존 클라이언트를 깨뜨리지 않는다(additive, 기존 필드/상태코드 제거 없음).
  - 제안: 조치 불요 — 이 PR 의 명시적 목적(swagger 정합화)과 일치.

- **[INFO]** 새 파일 생성 — `chat-channel-rotate-bot-token.dto.ts` (의도된 파일시스템 변경)
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts` (신규)
  - 상세: 리뷰 대상 diff 자체가 신규 소스 파일 생성이다. 다른 파일에서 import 되어 사용되는 것으로 보아(`triggers.controller.ts` 의 `import { ChatChannelRotateBotTokenDto } from './dto/chat-channel-rotate-bot-token.dto'`) 의도된 추가이며 우발적 파일 생성이 아니다. 파일 배치 근거(디렉터리 위치가 `dto/responses/` 관례를 벗어난 이유)도 파일 헤더 주석에 실측으로 남겨져 있다.
  - 제안: 조치 불요. (참고: 이 파일명이 `15-chat-channel.md` frontmatter `code:` glob 을 벗어날 위험은 이미 `review/consistency/2026/09/12/15_53_35/SUMMARY.md` WARNING #1 로 별도 등재돼 있어 본 리뷰에서 중복 지적하지 않음 — spec-coverage 축이지 런타임 부작용 축이 아니다.)

- **[INFO]** 헬퍼 함수 추출(`throwInvalidField` · `hasField` · `rejectBlockedField`) — 동작 보존 리팩터, 순서·문구·필드명 대조 완료
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (56행 `throwInvalidField`, 70행 `hasField`, 85행 `rejectBlockedField`; 호출부 161-163행 · 187-188행 · 205-208행 · 223-226행 · 270-273행 · 284-287행 · 294-297행 · 301-304행)
  - 상세: 기존 11곳의 `throw new BadRequestException({ code: 'VALIDATION_ERROR', message, details: { field, code: ErrorCode.INVALID_FIELD } })` 인라인 블록을 단일 헬퍼로 치환했다. 각 호출부의 `field` 문자열·`message` 값·검사 순서(botTokenRef → inboundSigningRef → inboundSigning, botToken → inboundSigningPlaintext)를 원본과 대조한 결과 전부 동일하며, early-return/early-throw 순서도 보존된다. 새로 도입된 함수 3개는 모두 `export` 되지 않은 module-private 함수라 외부 공개 인터페이스에 영향이 없다.
  - 제안: 조치 불요.

- **[INFO]** `plan/` · `review/` 아래 신규 문서 파일 다수 — 예상된 워크플로 산출물
  - 위치: `plan/in-progress/chat-channel-rules-cleanup.md`(신규), `review/consistency/2026/09/12/15_53_35/*`(신규 다수)
  - 상세: 이 diff 에 포함된 파일시스템 변경 중 코드가 아닌 부분은 프로젝트 표준 워크플로(작업 plan 기록 + `/consistency-check` 산출물)가 만든 것으로, `CLAUDE.md` 가 규정하는 정상 저장 위치(`plan/in-progress/`, `review/consistency/**`)와 일치한다. 우발적·범위 밖 파일 생성이 아니다.
  - 제안: 조치 불요.

## 검증 메모

저장소 파일은 수정하지 않았다(`grep`/`Read`만 사용). `git status --short` 는 리뷰 시작 전 상태(`plan/in-progress/*.md` 두 건 unstaged 수정 + 리뷰 산출물 디렉터리)를 그대로 유지하며, 본 리뷰로 인한 추가 변경은 없다.

## 요약

이번 변경은 `chat-channel-input-rules.ts` 의 반복되던 에러 봉투 생성 코드를 헬퍼 3개로 추출하고, `rotateBotToken` 컨트롤러의 swagger 문서를 보강하는 **동작 보존 리팩터링**이다. 유일하게 "시그니처 변경"에 해당하는 지점(컨트롤러 반환 타입)은 실제 서비스 반환 타입과 신설 DTO 를 직접 대조한 결과 구조적으로 동일함을 확인했고, 이 메서드를 직접 호출하는 내부 caller 가 없어 호출자 영향이 없다. 새로 추가된 헬퍼 함수·타입은 모두 비공개(module-private)이며, 11곳의 에러 발생 로직은 필드명·메시지·순서 모두 원본과 일치한다. 전역 상태·환경 변수·네트워크 호출·이벤트/콜백에 대한 변경은 없으며, 파일시스템 변경은 신규 DTO 파일 1개와 표준 워크플로 산출물(plan/review 문서)뿐으로 모두 의도된 것이다. 부작용 관점에서 문제 삼을 CRITICAL/WARNING 은 없다.

## 위험도

NONE
