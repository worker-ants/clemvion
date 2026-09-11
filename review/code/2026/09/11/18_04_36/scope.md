# 변경 범위(Scope) 리뷰 — impl-chat-channel-binder-t2

## 검증 방법

`git diff origin/main --stat` 로 실제 diff 를 프롬프트의 16개 파일 목록·라인 수와 전수 대조했다(완전 일치). `git log origin/main..HEAD`(2 커밋: `a2e5b7e16` 코드 이동 + `7e9aaa736` plan 후속 등재)와 `git show --stat`으로 커밋별 파일 경계를 재확인했고, `triggers.service.ts` 에 남은 `BadRequestException`/`buildSecretRef`/`stripChatChannelPlaintext` import 가 이동 후에도 다른 메서드에서 실사용되는지 grep 으로 확인했다(모두 사용 중, dead import 없음).

## 발견사항

- **[INFO]** `buildTriggerCallbackUrl` 순수 함수 추출은 원 요청("chat-channel binder 를 분리")보다 한 걸음 넓은 리팩토링이지만, plan 문서(`plan/in-progress/impl-chat-channel-binder-t2.md` "막힌 지점" 절)에 **왜 불가피한지**(이동 대상 `setupChatChannel` 과 잔류 대상 `rotateBotToken` 이 URL 조립 로직을 공유해, 추출하지 않으면 SoT 가 둘로 쪼개진다)와 기각한 대안 3가지가 근거와 함께 기록돼 있다. `--impl-prep` 컨센시스 체크(`review/consistency/2026/09/11/17_39_32`)도 이 설계를 사전 승인했다(BLOCK:NO). 범위 이탈이 아니라 **문서화된 필연적 부수 추출**로 판단한다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.ts` (신규 파일 전체)
  - 상세: 별도 지적이 필요 없으나, 다음 리뷰어가 "왜 이 파일까지 생겼나"를 되짚지 않도록 기록.
  - 제안: 조치 불요.

- **[INFO]** `chat-channel-binder.service.ts` 로그 리터럴이 이동 후에도 `TriggersService: ...` 접두를 그대로 유지한다(`this.logger.warn(\`TriggersService: chatChannel.provider=...\`)` 등 4곳). 클래스 소유가 바뀌었는데 메시지 문자열은 옛 클래스명을 말해 관측 관점에서는 부정확하지만, 커밋 메시지·plan 체크리스트·`spec-draft-nullable-notation-followups.md`에 "의도적으로 남겼다 + 순수 이동 주장을 지키기 위함 + 후속 등재"라고 명시돼 있어 은폐된 스코프 이탈이 아니다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — `setupChatChannel`/`teardownChatChannel` 내 `this.logger.warn(...)` 4곳(파일 함수명으로 특정, 다이제스트 게이트 숫자는 프롬프트 신규 파일 다이제스트의 100/157/250/253/288줄).
  - 상세: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 "옮긴 로그 메시지가 아직 TriggersService: 접두를 달고 있다"로 등재됨.
  - 제안: 조치 불요 — 후속 트래커에 이미 있음.

## 항목별 점검 결과

1. **의도 이상의 변경**: 없음. 코드 diff(`a2e5b7e16`)는 정확히 (a) `setupChatChannel`/`teardownChatChannel` 두 메서드 + 그 협력자를 `ChatChannelBinderService`로 이동, (b) 공유되는 콜백 URL 조립을 `buildTriggerCallbackUrl` 순수 함수로 추출, (c) `TriggersModule`/테스트 provider 배선 갱신만 포함한다. 로직 변경(분기·조건) 없음 — 원본과 바이트 단위로 대조 가능한 verbatim 이동.
2. **불필요한 리팩토링**: 없음. `buildTriggerCallbackUrl` 추출은 위 INFO 참조 — 필연적. `getAppBaseUrl()`과의 중복 통합은 **의도적으로 하지 않고** 후속 등재로만 처리해 스코프를 지켰다(`common/utils/app-base-url.ts` 미변경 확인).
3. **기능 확장**: 없음. 신규 분기·신규 필드·신규 엔드포인트 없음.
4. **무관한 수정**: 없음. `triggers/` 모듈 파일과 그 자신의 plan/review 산출물에 한정. `chat-channel/` 하위 파일은 미변경.
5. **포맷팅 변경**: 없음. diff 는 이동/추가/삭제 라인만, 문맥 줄의 재포맷 흔적 없음.
6. **주석 변경**: `triggers.module.ts` 의 주석 갱신(구 주석 "TriggersService 가 ... 주입" → "TriggersService 와 ChatChannelBinderService 가 ... 둘 다 쓴다")은 코드 구조 변경을 정확히 반영하는 필요한 갱신이다. 신규 파일의 방대한 JSDoc(클래스 존재 이유·경계표·이동하지 않은 이유)은 이 저장소의 확립된 관례(설계 근거를 코드에 남기는 문화, 다수의 선례 커밋)와 일치하며 불필요한 주석 첨삭이 아니다.
7. **임포트 변경**: `triggers.service.ts` 에 남은 `BadRequestException`/`buildSecretRef`/`stripChatChannelPlaintext` import 는 이동 후에도 `rotateBotToken` 등 잔류 메서드에서 실사용 중임을 grep 으로 확인 — dead import 없음. 신규 파일의 import 전부 본문에서 실사용.
8. **설정 변경**: `triggers.module.ts`의 provider 등록(`ChatChannelBinderService` 추가, `export`에는 미포함 — "이 모듈 안에서만 쓰인다"고 명시)만 있고, 그 외 설정 파일(`.env`, `tsconfig`, CI 워크플로 등) 변경 없음.

두 번째 커밋(`7e9aaa736`)은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 한 파일만 76줄 추가하는 순수 문서 등재로, `--impl-prep` 컨센시스 체크가 낸 WARNING 4건 + 신규 발견 2건을 트래커에 옮긴 것뿐이며 코드 변경이 없다.

`review/consistency/2026/09/11/17_39_32/*` 6개 파일(SUMMARY·checker 5개·meta.json·_retry_state.json)은 프로젝트 규약상 `--impl-prep` 실행 산출물이 커밋되는 정상 경로(`review/consistency/**`)이며, 이번 diff 의 스코프 이탈이 아니라 작업 착수 전 의무 게이트의 증적이다.

## 요약

두 커밋으로 구성된 이 변경은 `plan/in-progress/impl-chat-channel-binder-t2.md`에 기술된 범위(`setupChatChannel`/`teardownChatChannel`을 `TriggersService`에서 `ChatChannelBinderService`로 순수 이동 + 두 메서드가 공유하는 콜백 URL 조립을 부득이하게 별도 순수 함수로 추출)를 정확히 지킨다. `git diff --stat`을 프롬프트 파일 목록과 전수 대조한 결과 완전히 일치했고, 로직 변경·불필요한 리팩토링·무관한 파일 수정·포맷팅 노이즈·dead import·의도치 않은 설정 변경 중 어느 것도 발견되지 않았다. 유일하게 논의할 만한 지점(순수 함수 추출, 옛 클래스명이 남은 로그 리터럴)은 모두 plan 문서·커밋 메시지·후속 트래커에 근거와 함께 사전 공개돼 있어 은폐된 스코프 확장이 아니라 문서화된 설계 결정이다.

## 위험도

NONE
