# API 계약(API Contract) 리뷰

## 검토 범위

이번 diff(`impl-chat-channel-binder-t2`, 3라운드 누적 — `origin/main..HEAD` 전체)는
`TriggersService` 의 private 메서드 `setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl`
을 신규 `ChatChannelBinderService`(`chat-channel-binder.service.ts`)와 순수 함수
`buildTriggerCallbackUrl`(`trigger-callback-url.ts`)로 옮기는 내부 리팩터 + 그 위에 쌓인
1·2라운드 리뷰 대응(테스트 신설·강화, JSDoc 정정)이다.

직접 확인한 것:

- `git diff origin/main...HEAD --stat` 로 전체 변경 파일 목록을 실측 — `codebase/` 내
  변경은 `triggers/` 디렉터리 6개 코드/테스트 파일뿐이고, `triggers.controller.ts`·DTO
  (`chat-channel-config.dto.ts` 등)·다른 컨트롤러·`package.json`/lockfile 은 diff 에 전혀
  없다.
- `chat-channel-binder.service.ts` 전문을 `Read` 로 열어, `triggers.service.ts` 삭제분
  (`git diff origin/main...HEAD -- .../triggers.service.ts`)과 대조 — `setupChatChannel`/
  `teardownChatChannel`/`buildCallbackUrl` 로직이 이동 전후 **바이트 단위로 동일**함을
  확인했다(에러 코드·메시지, secret 쓰기 게이팅, `config`/health 컬럼 갱신, catch 경로 전부
  동일). `buildCallbackUrl` → `buildTriggerCallbackUrl` 전환도 조립 결과 문자열이 동일함을
  대조로 확인했다.
- `triggers.service.ts` `create()`/`update()` 호출부를 열어, `this.setupChatChannel(...)` →
  `this.chatChannelBinder.setupChatChannel(...)` 로 호출 대상만 바뀌고 인자·순서·
  `storeUserSuppliedSecrets`/`preservedInboundSigningRef` 값이 그대로임을 확인했다.
- 최근 두 커밋(`92f4b0607`, `8f43b1f56`)은 각각 (a) `buildTriggerCallbackUrl` 을 위치 인자 →
  이름 인자로 바꾼 내부 함수 시그니처 변경(HTTP 로 노출되지 않음) + 신규 `teardownChatChannel`
  단위 테스트, (b) 테스트 mock 을 키-인식형으로 강화 + JSDoc 태그 정정 — 둘 다 프로덕션 동작에
  영향 없는 테스트/문서 변경임을 diff 로 확인했다.
- `git status --short` — 이 리뷰 세션 산출 디렉터리 외 다른 미커밋 변경 없음(이전 라운드
  리뷰들이 보고한 병렬 세션발 워킹트리 오염이 이번 조회 시점엔 관측되지 않음).

## 대조 결과 — 계약 요소별

1. **하위 호환성**: 영향 없음. 엔드포인트 시그니처·요청/응답 스키마·에러 코드 어느 것도 diff
   에 포함되지 않았다. `chatChannel` PATCH 가 사용자 비밀을 쓰지 않는 정책(R-CC-21/D-2, telegram
   server-issued 서명 예외 포함)은 이번 T2 diff 이전(`origin/main`)에 이미 구현돼 있었고, 이번
   변경은 그 로직을 클래스 경계만 옮겼을 뿐 조건·분기를 바꾸지 않았다.
2. **버전 관리**: 해당 없음 — 엔드포인트 버전 표기 변경 없음.
3. **응답 형식**: 변경 없음. 이동된 코드는 `trigger.config`/health 컬럼만 갱신하고 응답 DTO 를
   직접 구성하지 않으며, 변환 지점(`triggers.service.ts` `create()`/`update()`/
   `sanitizeForResponse`)은 diff 밖이다.
4. **에러 응답**: 변경 없음. `CHAT_CHANNEL_ENDPOINT_REQUIRED` 400 의 코드·메시지·발생 조건이
   이동 전후 동일하고, `setupChannel` 실패 시 예외를 삼켜 `degraded` 로 저장하는(엔드포인트로는
   200/201 유지) 기존 계약도 그대로다.
5. **요청 검증**: 변경 없음. `assertChatChannelInputSafe`/`assertChatChannelAlreadySetUp` 등
   검증 로직은 `TriggersService` 에 그대로 남아 있고, 이동한 `ChatChannelBinderService` 는 이미
   검증된 값만 받는다.
6. **URL/경로 설계**: `buildTriggerCallbackUrl` 의 출력 문자열
   (``${resolved.replace(/\/$/, '')}/api/hooks/${endpointPath.replace(/^\//, '')}``)이 구
   `buildCallbackUrl` 과 동일함을 신구 소스 대조로 재확인 — webhook callback URL 형태에 영향
   없음. 신설된 `trigger-callback-url.spec.ts` 가 fallback·후행/선행 슬래시·`??` 의 빈 문자열
   처분까지 캐너리로 고정해, 이 URL 조립 규칙이 향후 조용히 바뀌는 것을 막는 방향으로 오히려
   계약 안정성을 강화한다.
7. **페이지네이션**: 해당 없음 — 목록 API 아님.
8. **인증/인가**: 변경 없음. 컨트롤러 가드·정책 파일은 diff 밖이며, 새 provider
   `ChatChannelBinderService` 는 `TriggersModule` 밖으로 export 되지 않아 공개 표면이
   넓어지지 않는다.

## 발견사항

- **[INFO]** `rotate-bot-token` 엔드포인트의 OpenAPI 문서화 공백은 이번 diff 밖의 사전 존재
  갭이며 이미 트래커에 등재돼 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken`
    — 이번 diff 파일 목록에 포함되지 않음. 근거: `plan/in-progress/spec-draft-nullable-notation-followups.md`,
    `review/consistency/2026/09/11/17_39_32/convention_compliance.md` WARNING #3.
  - 상세: 이전 두 라운드(`review/code/2026/09/11/18_04_36`·`18_42_05` 의 `api_contract.md`)가
    이미 확인·기록했고, 이번 라운드도 해당 컨트롤러 파일을 건드리지 않으므로 재확인만 하며
    중복 등재하지 않는다.
  - 제안: 조치 불요(이미 별도 트래커 등재, 이번 PR 범위 밖).

## 요약

이번 diff 는 `TriggersService` 의 chat-channel adapter setup/teardown/URL 조립 로직을 신규
`ChatChannelBinderService` 및 순수 함수 `buildTriggerCallbackUrl` 로 옮기는 **순수 내부
리팩터**에 이전 리뷰 라운드 대응(테스트 신설·강화, JSDoc 정정)이 누적된 상태다.
`git diff origin/main...HEAD` 로 실제 변경 범위를 직접 조회하고 이동 전/후 소스를 대조한 결과,
컨트롤러·DTO·에러 코드·응답 스키마·URL 형태·인증/인가 어느 것도 변경되지 않았음을 확인했다.
클라이언트가 관측하는 API 계약에는 어떠한 영향도 없으며, 유일하게 관련된 발견은 diff 범위
밖의 사전 존재 갭(`rotate-bot-token` OpenAPI 문서화 부재)으로 이미 별도 추적 중이라 정보성으로만
남긴다.

## 위험도

NONE
