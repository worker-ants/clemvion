# 부작용(Side Effect) 코드 리뷰 — chatChannel PATCH 비밀 차단 (D-1·D-2·D-3)

## 발견사항

- **[INFO]** PATCH `/api/triggers/:id` 의 공개 계약이 세 가지 방향으로 breaking 하게 바뀐다 — 의도된 변경이며 유일한 알려진 소비자(`ChatChannelCard`)는 영향받지 않음을 실측 확인
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` (`chatChannel?: ChatChannelUpdateConfigDto`), `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` `ChatChannelUpdateConfigDto`, `codebase/backend/src/modules/triggers/triggers.service.ts` `assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp`
  - 상세: ① `botToken`/`inboundSigningPlaintext` 를 실은 PATCH 는 이제 항상 400(종전엔 `botToken` 이 필수였다 — 정반대), ② 아직 setup 되지 않은 트리거에 PATCH 로 `chatChannel` 을 처음 붙이면 이제 명시적 400(종전엔 `setupChannel` 실패가 best-effort catch 에 삼켜져 200 + `chatChannelHealth=degraded` 로 조용히 성공 처리됐다), ③ PATCH 로 `provider` 를 바꾸면 이제 400(종전엔 무검증 통과). 세 변경 모두 이 diff 가 스스로 문서화하고 테스트로 고정했다. `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx:346-363` 와 `triggers/page.tsx` 의 create 다이얼로그(POST 전용, PATCH 아님)를 직접 열어 확인한 결과 프런트는 PATCH 바디에 두 비밀 필드나 `provider` 변경을 싣지 않는다. 이 리포지토리 안의 다른 API 클라이언트(운영 스크립트 등)가 있다면 조용히 깨질 수 있는 계약 변경이라는 점만 기록한다(이미 api_contract.md 가 INFO 로 독립 지적).
  - 제안: 별도 조치 불요 — 의도된 보안 수정이고 영향 범위는 이미 확인됨. 배포 노트에만 반영 권고(이미 api_contract 리뷰가 동일 제안).

- **[INFO]** 세 private 메서드의 시그니처가 바뀌었지만 전부 `TriggersService` 내부 호출부이고 두 자리(`create`/`update`) 모두 갱신됨 — 외부 영향 없음을 grep 으로 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `assertChatChannelInputSafe`(1인자→2인자 `mode` 추가), `setupChatChannel`(2인자→3인자 옵션 객체 추가), `stripChatChannelPlaintext`/`mergeExternalConfig`(파라미터 타입만 `ChatChannelConfigDto`→`ChatChannelInput` 로 확장)
  - 상세: 전부 `private` 메서드라 클래스 경계를 벗어나지 않는다. `grep -rn "assertChatChannelInputSafe\|setupChatChannel\|stripChatChannelPlaintext\|mergeExternalConfig"` 로 같은 파일 내 두 호출부(`create():430,471`, `update():513,521,536,587`)가 모두 새 시그니처로 갱신됐음을 확인했고, 파일 밖에서 이 이름들을 부르는 자리는 없다(동명의 e2e 헬퍼 `setupChatChannelTrigger` 는 raw SQL INSERT 함수로 별개).
  - 제안: 조치 불요.

- **[INFO]** `setupChatChannel` 의 secret-store 쓰기 3곳 중 PATCH 에서 게이팅해야 할 2곳(사용자 입력 bot token · provider-issued signing)과 무조건 유지해야 할 1곳(telegram server-issued signing)이 `storeUserSuppliedSecrets` 플래그로 정확히 분리돼 있음을 diff 전체 재구성으로 확인 — 이전 라운드 CRITICAL(inboundSigningRef fail-open)의 수정도 함께 포함
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `setupChatChannel` 본문 — `// [쓰기 ①]`(bot token rotate, 게이팅), `// [쓰기 ②]`(provider-issued signing, 게이팅), `// [쓰기 ③]`(telegram issuedInboundSigning, 무조건 유지); `inboundSigningRefSurvives` 술어와 `update()` 의 `previousInboundSigningRef`(병합 전 캡처)
  - 상세: `origin/main...HEAD` 전체 diff 를 직접 읽어, ① `storeUserSuppliedSecrets: false` 일 때 `this.secrets.rotate(botTokenRef, ...)` 와 provider-issued `inboundSigningPlaintext` 저장이 스킵되고, ② telegram 의 `result.issuedInboundSigning` 저장은 이 플래그와 무관하게 항상 실행되며, ③ `inboundSigningRef` 가 `mergeExternalConfig` 의 config 통째 교체 이전에 `update()` 가 캡처한 `previousInboundSigningRef` 로 보존됨을 확인했다. 이는 새로운 외부 호출을 추가한 것이 아니라 **기존 네트워크 호출(`secrets.rotate`)을 조건부로 스킵하는** 변경이며, 대칭 회귀 테스트(slack/discord `inboundSigningRef` 생존, telegram rotate 호출 적극 단언, setupChannel 실패 시에도 두 ref 보존)가 `triggers.service.spec.ts` 에 존재한다.
  - 제안: 조치 불요 — 부작용 관점에서 건전하게 설계됨.

## 확인된 것 — 위반 없음

- 새 전역 변수·모듈 레벨 mutable 상태 없음. `type ChatChannelInput`/`type ChatChannelInputMode` 는 컴파일 타임 전용 타입 별칭이며 `export` 되지 않아 런타임 부작용이 없다.
- 파일시스템 읽기/쓰기, `process.env` 읽기/쓰기 신규 도입 없음(diff 전체에 `process.env`/`fs` 패턴 grep 0건).
- 이벤트 emitter·콜백 등록/해제 변경 없음(`triggers.service.ts` 에 `EventEmitter`/`emit(` 패턴 없음, 기존과 동일).
- `OmitType(ChatChannelConfigDto, [...])` 는 부모 클래스(`ChatChannelConfigDto`, `CreateTriggerDto` 가 계속 사용)의 메타데이터를 변형하지 않고 새 클래스에 복사만 한다 — `CreateTriggerDto` 의 `botToken` 필수 검증이 여전히 통과함을 회귀 테스트(`trigger-dto-validation.spec.ts` "CreateTriggerDto 는 여전히 botToken 을 요구한다")로 확인.
- PATCH 바디에 `botToken`/`provider` 전환을 싣는 e2e 스펙이 이 변경으로 깨지는지 저장소 전체를 grep 했다 — `trigger-workflow-ref.e2e-spec.ts` 의 case E 한 곳뿐이었고 이미 diff 에 포함돼 바디가 갱신됐다. 다른 `.e2e-spec.ts` 파일에는 chatChannel 을 실은 `.patch(` 호출이 없다.
- git 저장소에 대한 뮤테이션 검증(cp/원복)은 필요하지 않았다 — 모든 분석을 `Read`/`git diff`/`grep` 만으로 수행했고 `git status --short` 로 리뷰 세션 시작 전/후 상태(오직 이번 리뷰 세션의 산출물 디렉터리만 untracked)에 변화가 없음을 확인했다.

## 요약

이번 diff 는 PATCH 경로의 secret 쓰기 3곳을 정밀하게 2:1 로 분리하고, 그 과정에서 바뀐 private 메서드 시그니처들은 전부 클래스 내부에 봉인되어 있어 외부 호출자 영향이 없다. 유일한 실질적 부작용은 PATCH `/api/triggers/:id` 공개 API 계약의 세 가지 의도된 breaking change(비밀 필드 거부·최초 setup 거부·provider 전환 거부)이며, 이는 diff 스스로 문서화·테스트로 고정했고 유일하게 알려진 프런트엔드 소비자가 영향받지 않음을 직접 소스로 확인했다. 이전 라운드에서 발견된 CRITICAL(PATCH 가 `inboundSigningRef` 를 잃어 인입 서명이 fail-open 되는 문제)의 수정도 이번 diff 에 포함돼 있고, `preservedInboundSigningRef`/`inboundSigningRefSurvives` 로 병합-전 캡처가 정확히 이뤄져 있음을 전체 diff 재구성으로 확인했다. 전역 변수·환경 변수·파일시스템·이벤트/콜백 관련 신규 부작용은 발견되지 않았다.

## 위험도

LOW
