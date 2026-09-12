# 보안(Security) 코드 리뷰

## 검토 범위

`chat-channel-rules-cleanup` 세션의 diff 7개 애플리케이션 파일(`chat-channel-input-rules.{ts,spec.ts}` ·
`chat-channel-rejection-messages.const.ts` · `dto/chat-channel-config.dto.ts` ·
`dto/chat-channel-rotate-bot-token.dto.ts`(신규) · `dto/trigger-dto-validation.spec.ts` ·
`triggers.controller.ts`)를 검토했다. 나머지(`plan/in-progress/*.md`, `review/consistency/**`)는
프로세스 산출물이라 보안 취약점 표면이 없어 스캔만 하고 상세 분석에서 제외했다(하드코딩 시크릿
패턴 grep 결과 0건).

이 변경은 **순수 리팩터 + 테스트 보강**이다 — `chat-channel-input-rules.ts` 내부에서 반복되던
`BadRequestException({code:'VALIDATION_ERROR', ...})` 11곳을 `throwInvalidField` 헬퍼로, 이중
캐스팅 2곳을 `hasField`/`rejectBlockedField` 로 모았고, `triggers.controller.ts` 에는
`rotateBotToken` 응답용 신규 swagger DTO(`ChatChannelRotateBotTokenDto`)를 추가했다. 응답 형태
자체는 바뀌지 않는다(기존 테스트 무편집 통과가 그 증거).

## 발견사항

이번 diff 범위에서 CRITICAL/WARNING 급 결함은 발견하지 못했다. 참고용 관찰 사항만 남긴다.

- **[INFO]** 리팩터가 오히려 보안 회귀 표면을 줄이는 방향
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `rejectBlockedField` 함수 (게이트 85-92행)
  - 상세: 종전 코드는 `chatChannel as unknown as Record<string, unknown>` 위에서 필드명을
    문자열 리터럴로 두 번(존재 검사 1회 + `details.field` 1회) 손으로 적었다 — 한쪽에서만
    오타가 나면 `undefined` 로 조용히 통과해 해당 필드에 대한 차단 가드가 무력화돼도 아무도
    모른다. 새 `ChatChannelBlockedField` union 타입을 인자로 강제하면서 그 오타 클래스가
    컴파일 에러로 바뀌었다 — 이는 결함 수정이 아니라 리팩터의 부수 효과지만, 보안 관점에서는
    "차단 필드가 조용히 새는" 회귀 클래스를 원천 차단하는 개선이다. 별도 조치 불필요.
  - 제안: 없음(정보성 기록).

- **[INFO]** `rotateBotToken` 신규 응답 DTO 는 시크릿을 노출하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts` (신규 파일)
  - 상세: `ChatChannelRotateBotTokenDto` 필드(`rotatedAt`/`triggerId`/`chatChannelHealth`/
    `botIdentity`)와 `ChatChannelBotIdentityDto`(`botId`/`username`/`teamId`) 어디에도 회전된
    bot token 평문이나 secret store ref 가 없다 — `SS-SE-01`(secret-store.md §4)의 "응답에는
    포함하지 않는다" 원칙과 정합한다. `triggers.controller.ts` 의 `@ApiNotFoundResponse`
    (`RESOURCE_NOT_FOUND — trigger 미존재 또는 워크스페이스 권한 없음`)도 "미존재"와 "권한 없음"을
    하나의 404 로 뭉쳐 문서화해 워크스페이스 간 리소스 존재 여부를 열거(enumeration)로 알아낼
    표면을 늘리지 않는다. 둘 다 좋은 방향이라 조치 불필요, 기록만 남긴다.
  - 제안: 없음.

- **[INFO]** `incoming.provider &&` falsy-guard 는 도달 불가이지만 의도적으로 방어적 이중화(defense-in-depth)로 남겨짐
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `assertChatChannelAlreadySetUp` 함수 (게이트 210-227행)
  - 상세: 주석과 plan 이 스스로 인정하듯 `ChatChannelUpdateConfigDto` 가 `provider` 를 필수로
    상속하므로 HTTP 경로에서는 이 분기가 falsy 가 될 수 없다. 그럼에도 DTO 를 우회하는 내부
    호출자(서비스 직접 호출 등)를 위해 남겨 뒀고, `dto/trigger-dto-validation.spec.ts` 에 그
    DTO 계층 강제 테스트가 신설돼 "도달 불가" 주장을 vacuous 하지 않게 뒷받침한다. provider
    스푸핑/전환을 통한 크로스-테넌트 토큰 재사용 방지라는 원 목적(주석에 명시)이 유지되고
    있음을 확인했다 — 보안 저하 없음.
  - 제안: 없음.

- 인젝션(SQL/XSS/커맨드/경로탐색): 해당 diff 는 DB 쿼리·쉘 실행·파일 경로 조작을 포함하지
  않는다. `PLACEHOLDER_REGEX = /\{[^}]+\}/g` 등 정규식은 변경되지 않았고 유계(bounded)라
  ReDoS 표면도 없다.
- 하드코딩된 시크릿: 테스트의 `botToken: '1:a'` / `'xoxb-a'` 등은 명백한 가짜 값이며 저장소
  전체 grep(`AKIA`/`sk-`/`ghp_`/`xox[baprs]-실제형` 등 패턴)에서 실제 자격 증명은 없음을
  확인했다.
- 인증/인가: `rotateBotToken` 엔드포인트는 `@Roles('editor')` + `@ApiBearerAuth`(컨트롤러
  레벨) + `@WorkspaceId()` 를 그대로 유지한다. 이번 diff 는 이 데코레이터 체인을 건드리지
  않았다.
- 에러 처리: `translateSetupChannelError` (본 diff에서 로직 미변경, 헬퍼 추출 대상 아님)는
  provider 원문·URL 을 응답 본문에 싣지 않는다는 계약을 그대로 유지하며, 이를 고정하는
  기존 테스트(`provider 원문을 응답 본문에 싣지 않는다`)도 무편집으로 남아 있다.
- 의존성: 신규 외부 의존성 추가 없음(`@nestjs/swagger` 기존 사용 패턴 재사용).

## 요약

이 변경은 `chat-channel-input-rules.ts` 의 반복되는 에러 봉투 생성 코드를 `throwInvalidField`/
`hasField`/`rejectBlockedField` 세 헬퍼로 모으고, `rotateBotToken` 엔드포인트에 swagger 응답
문서를 추가하는 순수 리팩터 + 테스트 보강 PR 이다. 인가 데코레이터·시크릿 처리(SS-SE-01)·응답
계약(§5.4, 원문 비노출)이 모두 그대로 유지되며, 오히려 필드명 오타로 인한 차단 가드 누락
가능성을 컴파일 타임 오류로 바꾸는 부수적 개선이 있다. 새 테스트들(내부 필드 3종 × update 모드
조합, provider label 스왑 검출, DTO 계층의 provider 필수 강제)은 기존 결함이 아니라 회귀 방지용
가드를 늘리는 방향이라 보안 저하 요소가 없다. CRITICAL/WARNING 없음.

## 위험도

NONE
