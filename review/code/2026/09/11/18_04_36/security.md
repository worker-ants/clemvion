# 보안(Security) 코드 리뷰

## 검토 범위

이번 diff 는 `TriggersService` 안에 있던 `setupChatChannel` / `teardownChatChannel` (secret store 쓰기 ·
ref 보존 로직 포함, 총 212줄)과 `buildCallbackUrl` 을 각각 새 클래스 `ChatChannelBinderService`
(`codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`)와 순수 함수
`buildTriggerCallbackUrl` (`codebase/backend/src/modules/triggers/trigger-callback-url.ts`)로
**그대로 옮기는** 리팩터다. `triggers.module.ts` 는 새 provider 를 등록(export 하지 않음), 나머지
`*.spec.ts` 변경은 테스트 provider 목록에 `ChatChannelBinderService` 추가뿐이다.

`chat-channel-binder.service.ts` 를 이동 전 `triggers.service.ts` 의 원본 private 메서드와 대조한
결과, secret 쓰기 게이팅(`storeUserSuppliedSecrets`) · `inboundSigningRef` 보존 술어
(`inboundSigningRefSurvives`) · 실패 경로 fallback · 로그 메시지 리터럴까지 **바이트 단위로 동일**하다.
`plan/in-progress/impl-chat-channel-binder-t2.md` 가 스스로 명시한 목표("단언 diff 0줄", "순수 이동")와
실제 diff 가 일치함을 확인했다(테스트 파일 diff 는 provider 등록 줄만, `expect` 변경 없음).

## 발견사항

- **[INFO]** 실패 경로에서 외부 adapter(Slack/Discord/Telegram) 오류 메시지가 `chatChannelLastError` 로
  DB 에 저장되고 `TriggerResponseDto.chatChannelLastError` 로 워크스페이스 멤버에게 그대로 노출된다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:267` (`chatChannelLastError: message.slice(0, 1024)`), 노출 지점은 `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:118`
  - 상세: `err instanceof Error ? err.message : String(err)` 를 그대로 저장한다. 외부 provider 에러 문자열에 내부 구현 세부(스택 일부, 상대 호스트 등)가 섞여 나올 가능성이 있다. **다만 이 동작은 이번 diff 가 만든 것이 아니라 이동 전 `triggers.service.ts` 의 원본 private 메서드에 이미 있던 것을 그대로 옮긴 것**이며(`git show` 로 대조), diff 는 이 값의 생성·저장·노출 경로 어느 것도 바꾸지 않았다. 새로 도입된 리스크는 아니다.
  - 제안: 이 PR 범위에서 조치할 필요는 없다. 다음에 이 함수를 손댈 기회가 있으면 provider 원문 메시지 대신 분류된 코드(예: `translateSetupChannelError` 가 `rotateBotToken` 에서 쓰는 방식)로 대체하는 것을 고려.

- **[INFO]** `ChatChannelBinderService` 는 `TriggersModule.providers` 에만 등록되고 `exports` 에는 없다(모듈 diff 주석이 "이 모듈 안에서만 쓰인다" 로 명시).
  - 위치: `codebase/backend/src/modules/triggers/triggers.module.ts` (`providers: [...]` 블록, `exports: [TriggersService]`)
  - 상세: secret store 에 직접 쓰는 협력자의 공개 표면을 최소화한 설계로, 다른 모듈이 이 서비스를 주입해 `storeUserSuppliedSecrets` 게이트를 우회하는 경로를 원천 차단한다. 긍정적 관찰이며 조치 불요.

## 점검 관점별 확인 결과 (해당 없음/문제 없음)

- **인젝션**: 신규 `buildTriggerCallbackUrl` 은 문자열 결합으로 URL 을 조립하지만, 유일한 가변 입력인 `endpointPath` 는 DTO 레벨에서 v4 UUID 로 강제 검증된다(`dto/create-trigger.dto.ts`, `dto/trigger-dto-validation.spec.ts` "endpointPath — v4 UUID 강제 (W1 보안)"). 경로/CRLF 삽입 여지 없음. `triggerRepository.update`/`findOne` 은 TypeORM 파라미터 바인딩만 사용, raw SQL 없음.
- **하드코딩된 시크릿**: `http://localhost:3011` fallback 은 개발용 기본 호스트일 뿐 시크릿이 아니다. 테스트의 `'xoxb-fake-token'` 등은 명백한 가짜 fixture.
- **인증/인가**: 이 diff 는 컨트롤러·가드 계층을 건드리지 않는다. `setupChatChannel`/`teardownChatChannel` 호출부(`create`/`update`/`remove`)는 이전과 동일하게 `findById(id, workspaceId)` 로 워크스페이스 스코프가 이미 확정된 `trigger` 객체를 넘긴다 — 새 클래스가 자체적으로 인가를 재검증하지 않는 것은 이동 전과 동일한 설계(호출자 책임)이며 회귀 아님.
- **입력 검증**: PATCH 에서 사용자 제공 비밀 쓰기를 건너뛰는 `storeUserSuppliedSecrets` 게이트, provider-issued vs server-issued 분기, `inboundSigningRefSurvives` fail-open 방지 로직 모두 원본과 동일하게 보존됨(라인 단위 대조 완료).
- **암호화**: 이 diff 는 `SecretResolverService.rotate/resolve` 호출 방식을 바꾸지 않는다 — 암호화 자체는 그 서비스 내부 구현이라 스코프 밖.
- **의존성 보안**: 신규 외부 패키지 없음, 기존 `@nestjs/*`·`typeorm` import 만 재배치.

## 요약

이번 변경은 `TriggersService` 의 chat-channel adapter 바인딩 로직(secret store 쓰기 3곳, ref 보존 술어, 실패 fallback 포함)을 새 `ChatChannelBinderService` 로 옮기는 순수 리팩터로, 이동 전후 로직을 라인 단위로 대조한 결과 보안에 영향을 주는 동작 변화는 없다. `endpointPath` 는 기존과 동일하게 UUID 로 검증돼 콜백 URL 조립에 인젝션 여지가 없고, 새 서비스는 모듈 밖으로 export 되지 않아 공개 표면이 오히려 좁아졌다. 유일하게 언급할 만한 지점(외부 provider 에러 메시지가 `chatChannelLastError` 로 노출되는 것)은 이동 전부터 존재하던 동작이며 이번 diff 가 만들거나 악화시킨 것이 아니므로 이 PR 을 막을 사유가 아니다.

## 위험도

NONE
