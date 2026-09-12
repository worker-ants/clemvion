# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `rotateBotToken` 실패 응답의 HTTP status 축이 넓어진다 (400 단일 → 400/502 분기) — 외부 소비자 관점의 인터페이스 변경
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` `translateSetupChannelError` (게이트 317~336, `BadRequestException` 단일 반환 → `BadRequestException | BadGatewayException`), 호출부 `codebase/backend/src/modules/triggers/triggers.service.ts` (게이트 1058~1079, `throw translateSetupChannelError(err);`), 문서화 `codebase/backend/src/modules/triggers/triggers.controller.ts` (게이트 262~274, `@ApiBadGatewayResponse` 신설)
  - 상세: 종전에는 `setupChannel` 실패 사유와 무관하게 항상 `400`(`CHAT_CHANNEL_SETUP_FAILED` 포함)을 반환했으나, 이제 "자격 증명 거부가 아닌" 사유(provider 5xx·네트워크·타임아웃)는 이 저장소 최초로 `502 BadGatewayException` 을 반환한다. `code` 문자열 자체는 유지되지만 **HTTP status 축이 바뀌는 것은 관측 가능한 API 계약 변경**이다 — 4xx→5xx 전환은 재시도·알림 정책이 status 코드에 반응하는 HTTP 클라이언트·게이트웨이·모니터링에 영향을 줄 수 있는 축이다. 저장소 안의 유일한 내부 소비자(`codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx:393-395` `rotateMutation.onError`)는 status/`code` 를 전혀 분기하지 않고 고정 toast 만 띄우므로 직접 확인한 영향은 없다. 이 엔드포인트를 호출하는 저장소 밖 제3자 통합이 있다면 "실패=항상 400" 가정이 깨진다.
  - 판단: 이 변경은 `plan/in-progress/impl-setup-error-code.md`·spec `R-CC-23`·`CHANGELOG.md` Unreleased 섹션("⚠️ 배포 시 확인" 콜아웃 포함)이 모두 명시적으로 선언한 **의도된 breaking change**이며, `chat-channel-input-rules.spec.ts` 의 캐너리가 의도적으로 뒤집혀 diff 에서 의도가 드러난다. CRITICAL 로 보지 않지만, 부작용 관점에서 "인터페이스 변경이 기존 호출자에 미치는 영향"의 정의상 이 항목은 반드시 기록해야 한다.
  - 제안: 이미 CHANGELOG·swagger 문서화가 돼 있어 추가 코드 조치는 불요. 배포 공지 채널(릴리스 노트)에도 동일 내용이 반영됐는지만 확인 권고.

- **[INFO]** `TriggersService.rotateBotToken` 의 catch 블록에 신규 `this.logger.warn(...)` 호출이 **분류와 무관하게 무조건** 실행된다 — 새 로그 이벤트가 모든 실패 경로(400/502 둘 다)에서 발생
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (게이트 1069~1078, `catch (err) { this.logger.warn(...); throw translateSetupChannelError(err); }`)
  - 상세: 이 catch 블록은 신설된 것으로, `credentialRejected` 여부를 가르지 않고 모든 `setupChannel` 실패(자격 증명 거부인 400 케이스 포함)에서 provider 원문 메시지 + `trigger.id` + `provider` 를 WARN 레벨로 로깅한다. 종전 코드는 이 catch 에서 아무 로깅도 하지 않았다 — 즉 사용자가 봇 토큰을 잘못 입력하는 **일상적인 400 케이스**도 이제 서버 로그에 WARN 항목을 남긴다. 세 provider adapter 의 메시지 조립부를 확인한 결과 bot token 값 자체(Authorization 헤더 전용)는 문자열에 결합되지 않아 시크릿 유출 경로는 없음을 확인했다(이전 라운드 `review/code/2026/09/12/13_41_55/side_effect.md` 도 동일 결론). 다만 응답 본문에서 제거된 `details.reason`(provider 원문)이 **두 분류 모두**에서 서버 로그로 옮겨간 것이므로, WARN 레벨 로그를 이상 신호로 취급하는 모니터링/알림 시스템이 있다면 일상적인 사용자 오타로도 알림이 발생할 수 있다.
  - 제안: 기능적 결함은 아님 — 로그 레벨(WARN vs INFO/DEBUG)을 자격 증명 거부(사용자 원인) vs 그 외(인프라 원인)로 분리할지는 운영팀 판단 사항으로 남겨도 무방. 코드 조치 불요, 운영 관측성 참고용 기록.

## 확인 결과 문제 없음으로 판단한 항목

- **[해소 확인]** 이전 라운드(`review/code/2026/09/12/13_41_55/side_effect.md`)가 지적한 `Logger.prototype.warn` 전역 스파이 누출 WARNING — 해소됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (게이트 2027~2053, `'그 밖의 실패 → 502 + provider 원문은 응답이 아니라 warn 로그에만'`)
  - 상세: `jest.spyOn(Logger.prototype, 'warn')` 을 `try { ... } finally { warn.mockRestore(); }` 로 감쌌음을 직접 `Read` 로 확인했다 — 앞선 `expect` 가 실패해도 spy 가 파일 나머지 describe 블록으로 누출되지 않는다. 같은 파일에 `Logger.prototype` 스파이는 이 테스트가 유일하다.
- **[확인]** `codebase/backend/src/common/filters/http-exception.filter.spec.ts` 신규 `BadGatewayException` 필터 통과 테스트 — 전역 상태 오염 없음
  - 위치: 게이트 221~236
  - 상세: `mockHost()` 로 로컬 mock 만 생성하고, `describe` 상단 `afterEach(() => jest.restoreAllMocks())`(게이트 40~42) 가 이미 파일 전체 스파이 원복을 커버한다. 이 신규 테스트는 어떤 것도 mock/spy 하지 않아 원복 대상 자체가 없다.
- **[확인]** `discord.adapter.ts` 의 401/403 판별이 인라인 리터럴에서 이름 있는 상수(`DISCORD_CREDENTIAL_REJECTED_STATUSES`)로 추출됨 — 동작 변경 없음, 상태 없는 `readonly number[]`
  - 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` 게이트 22~28
- **[확인]** `credentialRejectedError`/`isCredentialRejectedError`/`CREDENTIAL_REJECTED_CODE` 신규 export(`chat-channel/types.ts`) — 순환 의존 없음
  - 상세: `chat-channel/types.ts` 는 `../../shared/conversation-thread/...` 외 다른 모듈을 import 하지 않음을 직접 확인(`Read`) — `triggers → chat-channel/types` 단방향 의존만 성립. `credentialRejectedError` 는 `Object.assign(new Error(message), {...})` 로 매 호출마다 새 인스턴스를 생성하며 프로토타입이나 공유 객체를 변경하지 않는다.
- **[확인]** `discord-client.ts` 의 `status: res.status` 필드 추가 — 기존 소비자 영향 없음
  - 상세: `wrapSendResult`(discord.adapter.ts 게이트 449~458)는 `{ id?, ok?, code?, message? }` 로 파라미터 타입을 좁혀 받으므로 새 `status` 필드가 `SendResult` 응답 경로로 새어나가지 않는다. `grep` 결과 `DiscordApiError` 를 엄격 동등(`toEqual`) 비교하는 기존 테스트는 없어 추가 필드로 인한 회귀도 없다.
- **[확인]** `translateSetupChannelError` 반환 타입 변경(`BadRequestException` → `BadRequestException | BadGatewayException`) — 유일 호출자가 즉시 `throw` 하므로 타입 확장의 실질 영향 없음(`grep` 으로 호출부 1곳만 확인).
- **[확인]** 환경 변수 읽기/쓰기, 신규 네트워크 호출 없음 — 이번 diff 는 기존 provider adapter 의 transport(fetch) 호출 경로를 변경하지 않고 실패 **분류** 로직만 재구성한다.
- **[확인]** 저장소 트리 뮤테이션 없음 — 본 리뷰는 `Read`/`Bash grep` 만 사용했고 코드 수정을 가하지 않았다. `git status --short` 로 확인한 미커밋 변경(`plan/in-progress/impl-setup-error-code.md`, `review/code/2026/09/12/14_23_31/`)은 이 리뷰 세션 시작 전 오케스트레이터가 만든 상태이며 본 리뷰어가 발생시킨 것이 아니다.

## 요약

이번 diff(+이전 라운드의 fix 커밋들)는 3개 provider adapter 의 setupChannel 실패 분류를 문자열 매칭에서 `Error.code` 프로퍼티 기반으로 재구성하고, provider 원문을 응답 본문에서 제거해 서버 로그로 옮기며, 비-자격증명 실패를 이 저장소 최초로 `502`로 분리한다. 부작용 관점에서 진짜 실질적인 항목은 두 가지다: (1) HTTP status 축이 `400→502`로 벌어지는 것은 의도됐고 spec·CHANGELOG·frontend 소비자 확인을 거쳤지만 여전히 외부 관측 가능한 **인터페이스 변경**이고, (2) `rotateBotToken` catch 블록의 신규 `logger.warn` 이 분류와 무관하게 모든 실패(일상적인 사용자 오타 포함)에서 새 로그 이벤트를 발생시킨다(시크릿 유출 경로는 확인되지 않음). 이전 라운드가 지적한 `Logger.prototype.warn` 전역 스파이 누출 WARNING 은 `try/finally` 로 정확히 해소됐음을 직접 확인했다. 신규 export·신규 상수·필드 추가는 모두 additive 이고 순환 의존·전역 뮤터블 상태·의도치 않은 네트워크/환경변수 접근은 발견되지 않았다.

## 위험도

LOW
