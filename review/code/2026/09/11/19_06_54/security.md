# 보안(Security) 코드 리뷰

## 검토 범위

이 changeset(`impl-chat-channel-binder-t2`)은 `TriggersService`의 private 메서드
`setupChatChannel` / `teardownChatChannel` / `buildCallbackUrl`을 신규
`ChatChannelBinderService`(`codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`)와
순수 함수 `buildTriggerCallbackUrl`(`codebase/backend/src/modules/triggers/trigger-callback-url.ts`)로
옮기는 **Extract-Class 리팩터**다(3개 코드 커밋: `a2e5b7e16` 이동, `92f4b0607`/`8f43b1f56` 이전
`/ai-review` 라운드의 WARNING 해소). `triggers.controller.ts`·DTO·가드는 diff에 포함되지 않았다.

신규 파일(`chat-channel-binder.service.ts` 전문, `chat-channel-binder.service.spec.ts`,
`trigger-callback-url.ts`, `trigger-callback-url.spec.ts`)을 `Read`로 직접 열어 확인했고,
`triggers.service.ts`/`triggers.module.ts`는 `git diff origin/main --`로 실제 diff를 조회해
삭제된 원본 private 메서드와 신설 파일 본문을 줄 단위로 대조했다. 저장소에는 아무것도 쓰지
않았다(읽기 전용 확인만 수행, `git status --short` 확인 완료).

secret 쓰기 게이팅(`storeUserSuppliedSecrets`) · `inboundSigningRef` 보존 술어
(`inboundSigningRefSurvives`) · PATCH 비밀 미기록(R-CC-21, 선행 커밋 `fad828884`가 닫은
CRITICAL 2건) · `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/
`assertChatChannelAlreadySetUp`(`chat-channel-input-rules.ts`, 이번 diff 밖) 전부 이동 전후
바이트 단위로 동일함을 확인했다.

## 저장소 위생 — 병렬 리뷰 오염 여부 확인

이전 라운드(`review/code/2026/09/11/18_04_36/dependency.md`)가 `chat-channel-binder.service.ts`의
`if (storeUserSuppliedSecrets)` → `if (true)` 미커밋 뮤테이션(병렬 리뷰어 추정, PATCH 비밀-쓰기
게이트를 무력화하는 형태)을 관측했다고 기록했다. 이번 세션 시작 시점 직접 확인한 결과
`git status --short`는 clean(이번 세션 디렉터리만 untracked)이고,
`grep -n "storeUserSuppliedSecrets" chat-channel-binder.service.ts`로 게이트가 `if
(storeUserSuppliedSecrets)`로 정상 복원돼 있음을 재확인했다 — 해당 뮤테이션은 이미 원복되어
현재 코드에 남아 있지 않다. 이번 리뷰는 아무것도 고치거나 쓰지 않았다.

## 발견사항

- **[INFO]** 외부 adapter(Slack/Discord/Telegram) 오류 메시지가 `chatChannelLastError`로 DB에
  저장되고, `TriggerResponseDto.chatChannelLastError`를 통해 워크스페이스 멤버에게 그대로
  노출된다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` —
    `setupChatChannel`의 `catch` 블록, `chatChannelLastError: message.slice(0, 1024)`
    (함수명 `setupChatChannel`, 파일 하단부 catch 절).
  - 상세: `err instanceof Error ? err.message : String(err)` 원문을 그대로 저장한다. 외부
    provider 에러 문자열에 내부 구현 세부(호스트명 일부 등)가 섞여 나올 가능성이 있다. 다만
    이 동작은 이번 diff가 만든 것이 아니라 `triggers.service.ts` 원본 private 메서드에 이미
    있던 것을 그대로 옮긴 것이며(`git diff origin/main -- triggers.service.ts`로 삭제분과
    대조해 확인), 두 차례 이전 라운드 security 리뷰가 이미 같은 사실을 지적해 트래커
    (`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재돼 있다. 새로 도입된
    리스크가 아니다.
  - 제안: 이 PR 범위 조치 불요. 후속으로 provider 원문 메시지 대신 분류 코드(예:
    `translateSetupChannelError`가 `rotateBotToken`에서 쓰는 방식)로 대체하는 것을 고려.

- **[INFO]** `ChatChannelBinderService`는 `TriggersModule.providers`에만 등록되고 `exports`에는
  없다(긍정 관찰).
  - 위치: `codebase/backend/src/modules/triggers/triggers.module.ts` (`providers: [...]` 블록,
    `exports: [TriggersService]`).
  - 상세: secret store에 직접 쓰는 협력자의 공개 표면을 모듈 경계 밖으로 넓히지 않는 설계로,
    다른 모듈이 이 서비스를 주입해 `storeUserSuppliedSecrets` 게이트를 우회하는 경로를 원천
    차단한다. 조치 불요.

## 점검 관점별 확인 결과 (해당 없음/문제 없음)

- **인젝션**: `buildTriggerCallbackUrl`은 문자열 결합(`replace(/\/$/, '')`,
  `replace(/^\//, '')` + 템플릿 리터럴)으로 URL을 조립하지만, 가변 입력인 `endpointPath`는
  DTO 레벨에서 v4 UUID로 강제 검증된다(`dto/create-trigger.dto.ts`,
  `dto/trigger-dto-validation.spec.ts` "endpointPath — v4 UUID 강제 (W1 보안)" — 이번 diff
  밖의 기존 가드). `baseUrl`은 사용자 입력이 아니라 `ConfigService.get('app.url')`(서버 환경
  변수)에서만 온다 — SSRF/오픈 리다이렉트 벡터 없음. `triggerRepository.update`/`findOne`은
  TypeORM 파라미터 바인딩만 사용, raw SQL 없음.
- **하드코딩된 시크릿**: 없음. `diff`·plan/review 문서 전체를 시크릿 패턴(`api_key`/`secret`/
  `password`/`token`/`bearer` + 12자 이상 값)으로 grep한 결과 실제 자격증명 0건. 신규 테스트
  fixture(`'secret://x'`, `'xoxb-fake-token'`, `'https://workflow-api.getit.co.kr'`)는 모두
  명백한 가짜 값. `http://localhost:3011` fallback은 dev 전용 기본 호스트 리터럴일 뿐
  시크릿이 아니며, `app.config.ts`가 `APP_URL` 미설정 시 이미 같은 값으로 fallback하므로
  프로덕션 경로에서 발화하지 않는다.
- **인증/인가**: 이 diff는 컨트롤러·가드 계층을 건드리지 않는다. 호출부(`create`/`update`/
  `remove`)는 이전과 동일하게 `findById(id, workspaceId)`로 워크스페이스 스코프가 확정된
  `trigger` 객체를 넘긴다 — 새 클래스가 자체 인가를 재검증하지 않는 것은 이동 전과 동일한
  설계(호출자 책임)이며 회귀 아님.
- **입력 검증**: PATCH에서 사용자 제공 비밀 쓰기를 건너뛰는 `storeUserSuppliedSecrets` 게이트
  (`create()`는 `true`, `update()`는 `false` 전달 — `triggers.service.ts:449,566`),
  provider-issued vs server-issued 분기, `inboundSigningRefSurvives` fail-open 방지 로직
  모두 이동 전후 라인 단위로 동일하게 보존됨을 직접 대조로 확인. `assertChatChannelInputSafe`
  오버로드가 `mode: 'create' | 'update'`를 컴파일 타임에 DTO 타입과 묶어 PATCH 경로에서
  생성 전용 검증이 실수로 재사용되는 것을 막는다(이번 diff 밖, 참조만).
- **암호화**: `SecretResolverService.rotate/resolve` 호출 방식·인자 변경 없음 — 암호화 자체는
  그 서비스 내부 구현이라 스코프 밖. `buildSecretRef`(정규식 화이트리스트로
  `secret://<scope>/<resourceId>/<name>` 형식 강제)도 호출 방식 불변.
- **에러 처리**: 위 INFO 항목(사전 존재) 외 신규 노출 없음. `BadRequestException`
  (`CHAT_CHANNEL_ENDPOINT_REQUIRED` 등)의 코드·메시지·발생 조건 불변.
- **의존성 보안**: 신규 외부 패키지 없음(`git diff origin/main --stat`에 `package.json`/
  lockfile 변경 0건), 기존 `@nestjs/common`·`@nestjs/config`·`@nestjs/typeorm`·`typeorm`
  import 재배치뿐.

## 요약

이 changeset은 `TriggersService`의 chat-channel adapter setup/teardown/URL 조립 로직(secret
store 쓰기 3곳, ref 보존 술어, 실패 fallback 포함)을 새 `ChatChannelBinderService`/
`buildTriggerCallbackUrl`로 옮기는 순수 리팩터로, 이동 전후 로직을 직접 소스 대조로 확인한 결과
보안에 영향을 주는 동작 변화는 없다. 선행 커밋(`fad828884`)이 닫은 두 CRITICAL(PATCH가 사용자
비밀을 secret store에 쓰던 결함)의 수정 상태가 이번 이동 후에도 바이트 단위로 보존되며,
`endpointPath`는 UUID 검증·`baseUrl`은 서버 설정값 고정으로 URL 조립에 인젝션/SSRF 여지가
없다. 새 서비스는 모듈 밖으로 export되지 않아 공개 표면이 오히려 좁아졌다. 이전 라운드가
관측한 병렬 리뷰어의 미커밋 뮤테이션(게이트 무력화)은 현재 워킹트리에서 이미 원복되어 있음을
직접 확인했다. 유일하게 언급할 만한 지점(외부 adapter 에러 메시지의 `chatChannelLastError`
노출)은 이 diff 이전부터 존재하던 동작이며 이미 트래커에 등재돼 있어 이 PR을 막을 사유가
아니다.

## 위험도

NONE
