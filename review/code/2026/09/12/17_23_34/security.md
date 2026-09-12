# 보안(Security) 코드 리뷰 — chat-channel-rules-cleanup (라운드 4, `17_23_34`)

## 검토 방법

이 라운드는 이전 3라운드(`16_17_57` CRITICAL 1·WARNING 3 조치, `16_39_18` WARNING 3 조치,
`17_02_19` WARNING 1 조치)가 이미 낸 결함을 전부 조치한 뒤의 상태를 검증하는 자리다.
프롬프트 diff 는 예산 제한으로 일부(`chat-channel-input-rules.ts` 등) 가 생략되어 있어
`Read` 로 다음 실제 소스 파일 전문을 직접 열어 확인했다:

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (전문)
- `codebase/backend/src/modules/triggers/triggers.controller.ts` (`rotateBotToken` 전체 블록)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`rotateBotToken` 전체 — 985행~)
- `codebase/backend/src/modules/chat-channel/types.ts` (`ChatChannelConfig['botIdentity']` 선언)
- `codebase/backend/src/common/__test-utils__/source-scan.ts` (신규 가드가 쓰는 공유 스캔 유틸)

그리고 다음을 실행/실측했다:

- `grep -rnE` 로 diff 대상 11개 애플리케이션/가드 파일 전체에서 AWS 키·`sk-`·`ghp_`·Slack
  토큰·PEM 프라이빗 키 패턴 스캔 — **0건**.
- `grep -n "rotateBotToken\|@Roles\|@ApiBearerAuth"` 로 컨트롤러의 인가 데코레이터가
  `rotateBotToken` 에 그대로 남아 있는지 확인.
- `git status --short` — 본 리뷰가 저장소에 남긴 변경은 이 출력 디렉터리(`review/code/.../17_23_34/`)
  뿐이다. 저장소 파일을 고치거나 뮤테이션하지 않았다.

## 발견사항

이번 diff 범위에서 신규 CRITICAL/WARNING 급 보안 결함은 발견하지 못했다. 이전 라운드들이
지적한 항목(신규 DTO 클래스명 충돌, 서비스 층 `null`/`''` 미검증, 응답 DTO 배치 등)은
`codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` · `triggers.service.ts` ·
`dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 를 직접 열어 개별 재검증했고
실제로 해소된 상태를 확인했다(아래 "확인했으나 문제 없음" 참조).

- **[INFO]** `rotateBotToken` 의 `:id` 파라미터에 `ParseUUIDPipe` 부재 — 이 PR 이전부터 있던
  상태, 재확인만
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken`
    함수 시그니처 `@Param('id') triggerId: string,` (같은 파일의 `revokePerTriggerToken` 은
    `@Param('id', ParseUUIDPipe) id: string` 사용)
  - 상세: 이번 diff 는 이 줄을 바꾸지 않았다(직전 세 라운드가 모두 "PR 이전부터 존재, 스코프
    밖"으로 이미 판정). 비-UUID 문자열이 오면 `TriggersService.findById(id, workspaceId)` 조회
    실패로 이어져 결과적으로 `RESOURCE_NOT_FOUND` 404 로 수렴하므로 인가 우회로 이어지지는
    않는다 — `workspaceId` 스코프가 조회 자체에 걸려 있기 때문(`triggers.service.ts:999`).
  - 제안: 이번 PR 스코프는 아니다. 후속 PR 에서 형제 엔드포인트와 정렬 권장.

- **[INFO]** 신규 응답 DTO(`ChatChannelRotateBotTokenDto`/`ChatChannelRotateBotIdentityDto`)는
  비밀 값을 노출하지 않는다 — 재확인
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts`
  - 상세: 필드(`rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity{botId,username,teamId,publicKey}`)
    를 `codebase/backend/src/modules/chat-channel/types.ts` 의 `ChatChannelConfig['botIdentity']`
    선언과 대조 — `botToken`/`botTokenRef`/`inboundSigningRef`/`inboundSigningPlaintext` 등
    비밀·참조 필드는 어디에도 없다. `publicKey` 는 Discord `verify_key`(ed25519 public key)로
    타입 주석이 "비민감" 이라고 명시하며 실제로도 공개 키다. `SS-SE-01`(secret-store.md §4)
    원칙과 정합.
  - 제안: 없음.

- **[INFO]** 신규 `dto-class-name-collision` 가드(파일 9~13)는 저장소 내부 `.dto.ts` 소스만
  `fs.readFileSync` 로 읽는 정적 분석 테스트라 사용자 입력 표면이 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts`
    (`exportedClassNames`), `dto-class-name-collision.spec.ts`
  - 상세: 스캔 대상 경로는 `collectTsFiles(root)` 가 고정된 `modules/`·`common/` 서브트리에서
    수집하며 외부/사용자 제공 경로를 받지 않는다 — 경로 탐색(path traversal) 표면 없음.
    AST(`typescript` 패키지)로 파싱하므로 주석·문자열 안의 `export class` 텍스트를 오인해
    카운트하지 않는다(정규식 오탐 없음, 대조군 `decoy.dto.ts` fixture 로 실측 확인됨).
  - 제안: 없음.

## 확인했으나 문제 없음 (전 라운드 지적사항의 코드 대조 재검증)

- **차단 5필드(`botTokenRef`·`inboundSigningRef`·`inboundSigning`·`botToken`·
  `inboundSigningPlaintext`) 존재 검사·에러 봉투 보존** — `chat-channel-input-rules.ts` 전문을
  읽어 `rejectBlockedField`/`throwInvalidField`/`hasField` 로 추출된 후에도 필드명·
  `details.field`·`details.code: ErrorCode.INVALID_FIELD` 형태가 유지됨을 확인. `hasField` 는
  `typeof … !== 'undefined'` 판별(존재 검사)을 유지 — falsy 판별(`!value`) 로 바뀌면
  `null`/`''` 값이 두 층(DTO `@IsEmpty()` + 서비스 가드)을 모두 통과해 비밀 필드 차단이
  무력화된다는 것이 라운드 1의 핵심 CRITICAL 이었는데, 그 뮤테이션 시나리오를 막는 `it.each`
  테스트(파일 1, `PATCH 는 %s 로 보낸 botToken/inboundSigningPlaintext 도 거부한다`)가 신설돼
  있다.
- **신규 DTO 클래스명 충돌(라운드 1 CRITICAL)** — `dto/chat-channel-config.dto.ts` 의 기존
  `ChatChannelBotIdentityDto` 와 신규 파일의 클래스명이 `ChatChannelRotateBotIdentityDto` 로
  분리돼 있어 `@nestjs/swagger` 스키마 레지스트리 충돌 없음. 재발 방지용
  `dto-class-name-collision` 가드가 신설돼 향후 재발 시 자동 검출된다.
- **인증/인가** — `rotateBotToken` 은 `@Roles('editor')` + 컨트롤러 레벨 `@ApiBearerAuth` 를
  그대로 유지한다. 서비스 층 `findById(id, workspaceId)` 로 워크스페이스 스코프 조회가
  유지되어 타 워크스페이스 트리거에 대한 IDOR 경로가 없다(이 diff 는 이 부분을 변경하지
  않았다).
- **에러 처리** — `translateSetupChannelError` (로직 미변경) 는 provider 원문 메시지를
  client-safe 고정 문자열로 치환해 응답 본문에 원문을 싣지 않는다. 이를 고정하는 기존
  테스트도 무편집으로 남아 있다.
- **provider 전환/스푸핑 방지** — `assertChatChannelAlreadySetUp` 의 `incoming.provider &&`
  falsy-guard 는 HTTP 경로에서 도달 불가지만(DTO 층이 `provider` 를 상속 필수화), DTO 를
  우회하는 내부 호출자를 위한 defense-in-depth 로 의도적으로 남겨졌고, 그 "도달 불가" 주장을
  뒷받침하는 DTO 계층 테스트(`trigger-dto-validation.spec.ts` 신규 `it.each`)가 실제
  `CustomValidationPipe` 를 태워 vacuous 하지 않음을 확인했다.
- **하드코딩된 시크릿** — 테스트의 `botToken: '1:a'` 류, DTO `example` 값(`123456789`,
  `T0123ABC`, `a1b2…`)은 전부 placeholder. 전체 diff grep 결과 실제 자격 증명 패턴 0건.
- **인젝션** — 이번 diff 는 DB 쿼리 문자열 조합·쉘 실행·파일 경로를 사용자 입력으로 구성하지
  않는다. `triggers.service.ts` 의 `triggerRepository.update({id}, {...})` 는 TypeORM
  파라미터화 경로 그대로.
- **암호화/평문 전송** — 이번 diff 로 해시/암호화 알고리즘이나 전송 방식이 바뀐 곳 없음.

## 요약

`chat-channel-input-rules.{ts,spec.ts}` 의 에러 봉투 헬퍼화(`throwInvalidField`/`hasField`/
`rejectBlockedField`)와 `rotateBotToken` 응답 DTO 신설·재배치, 그리고 재발 방지용
`dto-class-name-collision` 정적 가드 추가로 구성된 4라운드째 diff 를 소스 코드 직접 열람으로
독립 재검증했다. 이전 라운드들이 지목했던 CRITICAL(신규 DTO 클래스명 충돌)과 WARNING(서비스
층 `null`/`''` secret 우회, 응답 DTO 가 실응답보다 좁음, 규약 위치 위반)은 모두 코드
수준에서 해소되어 있고, 그 해소를 고정하는 회귀 테스트(널/빈 문자열 secret 거부, DTO 클래스명
전수 스캔 가드)까지 갖췄다. 인가 데코레이터·워크스페이스 스코프 조회·에러 응답의 client-safe
치환 등 기존 보안 계약은 이 diff 로 변경되지 않았다. 신규로 도입된 보안 관련 표면(응답 DTO)도
비밀 값을 포함하지 않는다. 남는 관찰은 이 PR 이전부터 있던 `ParseUUIDPipe` 부재(스코프 밖,
인가 우회로 이어지지 않음) 하나뿐이며 조치 불요.

## 위험도

NONE
