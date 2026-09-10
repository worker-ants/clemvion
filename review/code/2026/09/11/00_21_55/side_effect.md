# 부작용(Side Effect) 코드 리뷰 — chatChannel PATCH 비밀 차단 (D-1·D-2·D-3, 3라운드)

## 검토 방법

`git diff origin/main...HEAD -- 'codebase/**'`(누적 diff, 커밋 `4a8b5f456`~`83d5f3f94`)를
전량 읽고, 변경된 private 메서드 4개(`assertChatChannelInputSafe` · `setupChatChannel` ·
`stripChatChannelPlaintext` · `mergeExternalConfig`)의 호출부를 `grep -n`으로 파일 내
전수 대조했다. 저장소 파일은 건드리지 않았다 — `Read`/`git diff`/`grep`만 사용, 뮤테이션
실험 불필요(로직이 정적 분석으로 충분히 추적 가능). 세션 시작·종료 시점 `git status --short`
동일(이번 세션 자체 산출물 디렉터리만 untracked) — 다른 reviewer 오염 없음.

이 diff는 이미 두 차례 `/ai-review` 라운드(`23_21_57`, `23_55_23`)를 거쳤고 side_effect
관점은 두 라운드 모두 LOW로 수렴했다. 이번 라운드(3번째, 누적 diff 기준)에서 그 사이 추가된
변경분(`83d5f3f94`: `assertChatChannelInputSafe` 오버로드 2개, 컨트롤러 Swagger 문구,
테스트 분리, 문서 4파일 정정)까지 포함해 독립적으로 재확인했다.

## 발견사항

- **[INFO]** PATCH `/api/triggers/:id` 의 공개 계약이 세 축에서 breaking 하게 바뀐다 — 의도된
  보안 수정이며 유일한 알려진 소비자는 영향받지 않는다
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts`
    (`chatChannel?: ChatChannelUpdateConfigDto`), `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
    `ChatChannelUpdateConfigDto`(`OmitType` 서브클래스), `codebase/backend/src/modules/triggers/triggers.service.ts`
    `assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`
  - 상세: ① `botToken`/`inboundSigningPlaintext` 를 실은 PATCH 는 이제 항상 400(종전엔
    `ChatChannelConfigDto` 상속으로 `botToken` 이 오히려 **필수**였다 — 정반대 방향 전환),
    ② 아직 setup 되지 않은 트리거에 PATCH 로 `chatChannel` 을 처음 붙이면 이제 명시적 400
    (종전엔 `setupChannel` 실패가 best-effort catch 에 삼켜져 200 + `chatChannelHealth=degraded`
    로 조용히 "성공" 처리됐다), ③ PATCH 로 `provider` 를 바꾸면 이제 400(종전엔 무검증 통과,
    다른 provider 의 토큰을 오용할 수 있는 경로였다). 세 변경 모두 이 diff 가 스스로 문서화하고
    회귀 테스트(`trigger-dto-validation.spec.ts`, `triggers.service.spec.ts`)로 고정했다.
    프런트엔드 유일 소비자(`ChatChannelCard`)는 PATCH 바디에 두 비밀 필드나 `provider` 변경을
    싣지 않으므로(POST 전용 create 다이얼로그와 분리) 영향 없음 — 다만 이 저장소 밖의 API
    클라이언트(운영 스크립트 등)가 있다면 조용히 깨질 수 있는 계약 변경이라는 사실 자체는
    남긴다(이미 `api_contract`/이전 라운드 `side_effect` 리뷰가 동일하게 지적·수용됨).
  - 제안: 별도 조치 불요 — 의도된 보안 수정이고 영향 범위가 이미 확인·테스트로 고정됨.

- **[INFO]** 4개 private 메서드의 시그니처가 바뀌었지만 전부 `TriggersService` 내부 호출부이고
  `create()`/`update()` 양쪽 모두 새 시그니처로 갱신되어 있음을 재확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` —
    `assertChatChannelInputSafe`(1인자→2인자 `mode`, 이번 라운드에서 오버로드 2개 추가로
    컴파일 타임 결속 강화), `setupChatChannel`(2인자→3인자 옵션 객체), `stripChatChannelPlaintext`/
    `mergeExternalConfig`(파라미터·반환 타입만 `ChatChannelConfigDto`→`ChatChannelInput` 로 확장)
  - 상세: `grep -n "setupChatChannel(\|stripChatChannelPlaintext(\|mergeExternalConfig(\|assertChatChannelInputSafe(\|assertChatChannelAlreadySetUp(\|assertPatchCarriesNoSecrets("` 로 같은 파일 내
    모든 호출부(`create():430,440,442,471`, `update():513,521,536,540,587`, 내부
    `setupChatChannel` 본문:1154)를 확인했고, 전부 새 시그니처와 정합한다. 파일 밖에서 이
    이름들을 부르는 자리는 없다(전부 `private`). `rotateBotToken()`(1451행대, 이 diff 미변경)은
    `setupChatChannel`/`stripChatChannelPlaintext` 를 호출하지 않고 자신만의 `adapter.setupChannel`
    직접 호출 경로를 쓰므로 시그니처 변경의 영향권 밖이다.
  - 제안: 조치 불요.

- **[INFO]** `setupChatChannel` 의 secret-store 쓰기 3곳 중 PATCH 에서 게이팅해야 할 2곳(사용자
  입력 bot token · provider-issued signing)과 무조건 유지해야 할 1곳(telegram server-issued
  signing)이 `storeUserSuppliedSecrets` 플래그로 정확히 분리돼 있다 — **새 외부 호출 추가가
  아니라 기존 `secrets.rotate()` 호출을 조건부로 스킵**하는 변경
  - 위치: `triggers.service.ts` `setupChatChannel` 본문 — `// [쓰기 ①]`(bot token rotate,
    게이팅) · `// [쓰기 ②]`(provider-issued signing, 게이팅) · `// [쓰기 ③]`(telegram
    issuedInboundSigning, 무조건 유지); `inboundSigningRefSurvives` 술어와 `update()` 의
    `previousInboundSigningRef`(병합 전 캡처, `mergeExternalConfig` 호출 이전 지점)
  - 상세: `storeUserSuppliedSecrets: false`(update 경로)일 때 `this.secrets.rotate(botTokenRef, …)`
    호출과 provider-issued `inboundSigningPlaintext` 저장이 스킵되고, telegram 의
    `result.issuedInboundSigning` 저장은 이 플래그와 무관하게 항상 실행된다. `inboundSigningRef`
    는 `mergeExternalConfig` 의 config 통째 교체 **이전**에 `update()` 가 캡처한
    `previousInboundSigningRef` 로 보존된다 — 호출 순서(캡처 526~528행 부근 → `mergeExternalConfig`
    → `setupChatChannel`)를 직접 대조해 캡처가 병합보다 먼저 일어남을 확인했다.
  - 제안: 조치 불요 — 부작용 관점에서 건전하게 설계됨.

- **[INFO]** `assertChatChannelInputSafe` 의 오버로드 시그니처 2개 추가(이번 라운드 신규분,
  `83d5f3f94`)는 순수 컴파일 타임 타입 결속이며 런타임 부작용 없음
  - 위치: `triggers.service.ts` `assertChatChannelInputSafe` 오버로드 선언부(구현 시그니처
    직전 두 개의 `private assertChatChannelInputSafe(...): void;` 선언)
  - 상세: TypeScript 함수 오버로드 시그니처는 트랜스파일 시 제거되며 실행 코드에 남지 않는다.
    구현 시그니처(`ChatChannelInput | undefined`, `ChatChannelInputMode`)는 그대로이고 호출부
    2곳(`create():430`, `update():513`)이 각각 리터럴 `'create'`/`'update'` 를 넘겨 오버로드
    해석과 일치한다.
  - 제안: 조치 불요.

## 확인한 것 — 문제 없음

- 새 전역 변수·모듈 레벨 mutable 상태 없음. `type ChatChannelInput`/`type ChatChannelInputMode`
  는 `export` 되지 않는 컴파일 타임 전용 타입 별칭이라 런타임 부작용이 없다.
- 파일시스템 읽기/쓰기, `process.env` 읽기/쓰기 신규 도입 없음 — 전체 누적 diff에
  `process.env`/`fs.`/`writeFile`/`readFile` 패턴 0건(grep 확인).
- 이벤트 emitter·콜백 등록/해제 변경 없음 — `emit(`/`EventEmitter`/`publish` 패턴이 diff에
  등장하지 않는다.
- `OmitType(ChatChannelConfigDto, ['botToken', 'inboundSigningPlaintext'] as const)` 는 부모
  클래스(`ChatChannelConfigDto`, `CreateTriggerDto` 가 계속 사용)의 메타데이터를 변형하지
  않고 새 클래스에 복사만 한다 — 회귀 테스트(`trigger-dto-validation.spec.ts`
  `'CreateTriggerDto 는 여전히 botToken 을 요구한다 (생성 경로 무회귀)'`)가 `CreateTriggerDto`
  경로의 `botToken` 필수 검증이 그대로 통과함을 고정한다.
- 컨트롤러 변경(`triggers.controller.ts`)은 `@ApiBadRequestResponse` 의 설명 문자열
  (Swagger 문서용)뿐이고 런타임 분기·데코레이터 로직 변경은 없다.
- 4개 mdx 문서 파일(`triggers.mdx`/`.en.mdx`, `telegram.mdx`/`.en.mdx`) 변경은 순수 산문
  텍스트이며 코드 실행 경로와 무관하다.
- 테스트 diff(`trigger-dto-validation.spec.ts`, `triggers.service.spec.ts`)에 `process.env`,
  `jest.mock`/`jest.spyOn`, fake timer 조작 등 전역·공유 상태를 건드리는 패턴이 없다(grep 0건).
  신규 `describe` 블록이 공유하는 `const pipe = new CustomValidationPipe()` 는 상태 없는
  검증 파이프 인스턴스라 테스트 간 오염 위험이 없다.

## 요약

이번 diff(3라운드 누적)는 PATCH 경로의 secret 쓰기 3곳을 2:1 로 정밀 분리하고, 변경된 private
메서드 시그니처 4개는 전부 `TriggersService` 내부 호출부에 봉인되어 있어 외부 영향이 없음을
직접 grep 대조로 재확인했다. 유일한 실질적 부작용은 PATCH `/api/triggers/:id` 공개 API 계약의
세 가지 의도된 breaking change(비밀 필드 거부·최초 setup 거부·provider 전환 거부)이며, diff
스스로 문서화·테스트로 고정했고 유일하게 알려진 프런트엔드 소비자가 영향받지 않음이 이미 확인돼
있다. 이번 라운드에서 새로 추가된 부분(오버로드 2개·Swagger 문구 정정·테스트 분리·문서 4파일
정정)은 전부 컴파일 타임 타입 결속 또는 순수 문서 정정이라 런타임 부작용을 추가하지 않는다.
전역 변수·환경 변수·파일시스템·이벤트/콜백 관련 신규 부작용은 발견되지 않았다.

## 위험도

LOW
