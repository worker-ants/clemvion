# API 계약(API Contract) 리뷰

## 검토 범위

이번 diff(`impl-chat-channel-binder-t2`, 2라운드 — 1라운드 `review/code/2026/09/11/18_04_36` 의
W1(콜백 URL 인자 순서)·W2(`teardownChatChannel` adapter 경로 미검증) 해소분 포함)는
`TriggersService` 의 private 메서드 `setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl`
을 신규 `ChatChannelBinderService`(`chat-channel-binder.service.ts`)와 순수 함수
`buildTriggerCallbackUrl`(`trigger-callback-url.ts`, 이번 라운드에서 위치 인자 →
이름 인자로 시그니처 변경)로 옮기는 내부 리팩터다. `triggers.controller.ts`, DTO
(`chat-channel-config.dto.ts` 등)는 이번 diff 에 포함되지 않았고, 엔드포인트 시그니처·요청
검증·응답 스키마·에러 코드·인증/인가 데코레이터에 직접 손대는 파일이 없다.

`git diff origin/main HEAD -- codebase/backend/src/modules/triggers/` 로 실제 커밋된 diff
(8파일, +581/-247)를 직접 조회하고, 프롬프트에서 생략된 `chat-channel-binder.service.ts`
전문은 `Read` 로 직접 열어 대조했다.

## 대조 결과 — 계약 요소별

1. **하위 호환성**: 영향 없음. `chat-channel-binder.service.ts` 전문을 직접 읽어 확인한 결과,
   `BadRequestException({code:'CHAT_CHANNEL_ENDPOINT_REQUIRED', ...})`, `setupChannel`
   성공/실패 시 `trigger.config`/`chatChannelHealth`/`chatChannelLastError` 갱신, 3종 secret
   쓰기의 `storeUserSuppliedSecrets` 게이팅 로직이 이동 전(`triggers.service.ts` 삭제분)과 문자
   그대로 동일하다. 이번 라운드에서 추가된 `buildTriggerCallbackUrl` 이름 인자 시그니처 변경도
   내부 함수 호출 규약일 뿐 HTTP 로 노출되지 않아 클라이언트에 영향이 없다.
2. **버전 관리**: 해당 없음 — 엔드포인트 버전 표기 변경 없음.
3. **응답 형식**: 변경 없음. 이동된 코드는 `trigger.config`/health 컬럼만 갱신하고 응답 DTO 를
   직접 구성하지 않는다. 변환 지점(`triggers.service.ts` `create()`/`update()`)은 diff 밖.
4. **에러 응답**: 변경 없음. `CHAT_CHANNEL_ENDPOINT_REQUIRED` 400 코드·메시지·발생 조건 동일.
   `setupChannel` 실패 시 예외를 삼키고 `degraded` 로 저장(엔드포인트로는 200/201 유지)하는
   기존 계약도 그대로.
5. **요청 검증**: 변경 없음. `chatChannelCfg` 검증(`assertChatChannelInputSafe` 등)은
   `TriggersService` 에 그대로 남아 있고, 이동한 코드는 이미 검증된 값만 받는다.
6. **URL/경로 설계**: `buildTriggerCallbackUrl` 출력 문자열
   (``${resolved.replace(/\/$/, '')}/api/hooks/${endpointPath.replace(/^\//, '')}``)이 구
   `buildCallbackUrl` 과 동일함을 신구 소스 대조로 확인 — webhook callback URL 형태 영향 없음.
   이번 라운드에서 신설된 `trigger-callback-url.spec.ts` 가 fallback·후행/선행 슬래시·`??` 의
   빈 문자열 처분까지 캐너리로 고정해, 향후 이 URL 조립 규칙이 조용히 바뀌는 것을 막는다(계약
   안정성을 오히려 강화하는 방향).
7. **페이지네이션**: 해당 없음 — 목록 API 아님.
8. **인증/인가**: 변경 없음. 컨트롤러 가드·정책은 diff 밖.

## 발견사항

- **[INFO]** 리뷰 대상 워킹트리에 이번 diff 에 포함되지 않은 대규모 미커밋 변경이 존재한다
  (다른 병렬 세션/리뷰어의 잔여물로 추정).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `git status --short`
    상 `M` 상태, `git diff HEAD --stat` 기준 +555/-38. 커밋된 diff
    (`git diff origin/main HEAD --stat`, +258/-247 상당의 순수 이동)와 이 미커밋 diff 는
    별개다.
  - 상세: 미커밋 내용을 직접 열람한 결과, `ChatChannelBinderService` 로 옮겨진 로직을 다시
    `TriggersService` 인라인으로 되돌리고 `ChatChannelConfigDto`/`ChatChannelUpdateConfigDto`
    를 재도입하는 등, 이번 T2 리팩터 자체를 부분적으로 되감는 형태다. 병렬 fan-out 리뷰
    규약("저장소 트리에 아무것도 쓰지 말라")을 다른 세션이 위반한 것으로 보이며, 1라운드
    `dependency.md` 가 이미 유사한 사례(`storeUserSuppliedSecrets` → `true` 미커밋 뮤테이션)를
    보고한 바 있다 — 같은 클래스의 재발.
  - **이번 API 계약 평가는 이 미커밋 상태가 아니라 `git diff origin/main HEAD`(실제 커밋된
    diff)를 기준으로 수행했다** — 커밋되지 않는 한 이 내용은 병합 대상이 아니기 때문이다.
    다만 이 잔여물 자체를 원복하지는 않았다(원인 미상 파일을 임의로 `checkout`/`restore` 하는
    것은 검증용 뮤테이션 규약이 금지하는 행위이며, 다른 세션의 진행 중 작업일 수 있다).
  - 제안: 통합(`merge-coordinator`) 또는 최종 push 전에 `git status --short` 로 재확인해 이
    미커밋 변경이 남아 있으면 원작성자에게 확인 후 정리할 것. API 계약 관점에서는 조치 불요
    (이번 diff 의 판정에 영향 없음).

- **[INFO]** (참고, 이번 diff 밖) `rotate-bot-token` 엔드포인트의 OpenAPI 데코레이터 부재는
  1라운드 `api_contract.md` 가 이미 확인했고 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  에 등재돼 있다. 이번 라운드는 컨트롤러 파일을 건드리지 않아 재확인만 하며 중복 등재하지 않는다.

## 요약

이번 2라운드 diff 는 1라운드 WARNING(W1 콜백 URL 인자 순서, W2 teardown adapter 미검증
테스트 갭)을 해소하는 테스트 신설 + `buildTriggerCallbackUrl` 시그니처 변경(위치→이름 인자)
으로 구성되며, 둘 다 API 외부 표면과 무관한 내부 리팩터·테스트 보강이다. `chat-channel-binder.service.ts`
전문을 직접 열어 이동 전후 로직이 바이트 단위로 동일함을 재확인했고, 컨트롤러·DTO·에러 코드·
응답 스키마·인증/인가·URL 형태 어느 것도 diff 로 변경되지 않았다. 유일한 관측 사항은 이 diff
와 무관한 워킹트리 미커밋 잔여물(다른 세션의 것으로 추정)이며, 실제 병합 대상인 커밋 diff 만
놓고 볼 때 API 계약 관점의 위험은 없다.

## 위험도

NONE
