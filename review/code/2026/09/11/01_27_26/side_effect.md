# 부작용(Side Effect) 코드 리뷰 — chatChannel PATCH 비밀 차단 (D-1·D-2·D-3, 신규 라운드)

## 검토 방법

`git diff origin/main...HEAD -- 'codebase/**'`(누적 15개 파일, 커밋 `4a8b5f456`~`c817a44c4`)를
전량 읽고, `triggers.service.ts`·DTO·컨트롤러·테스트 diff 를 직접 재구성해 확인했다. 이 changeset 은
이미 5차례 `/ai-review` 라운드(`23_21_57`→`23_55_23`→`00_21_55`→`00_45_18`→`01_10_43`)를 거쳤고
`side_effect` 리뷰는 그중 3라운드(`23_21_57`, `23_55_23`, `00_21_55`)에서 이미 독립 수행되어 매번
**LOW** 로 수렴했다. 이번 라운드는 (a) 그 결론이 최신 소스에서도 유지되는지 재확인하고 (b) 마지막
`side_effect` 라운드(`00_21_55`) **이후** 실제로 추가된 델타에 새 부작용이 있는지에 집중했다.

`00_21_55` 이후 델타(`5976587c7`·`464f2ba1a`·`c817a44c4`)를 커밋 단위로 열어 대조한 결과,
`codebase/backend/src/modules/triggers/triggers.service.ts` — 즉 secret 쓰기 게이팅·설정 병합
로직이 들어 있는 production 파일 — 은 이 세 커밋 어디에서도 변경되지 않았다(`git diff 00_21_55델타
이후 -- triggers.service.ts` 출력 0줄, 아래 "검증한 것" 참조). 저장소 트리는 건드리지 않았다 —
`Read`/`git diff`/`git show`/`grep` 만 사용했고, 세션 시작·종료 시점 `git status --short` 가
동일함(이번 세션 산출물 디렉터리만 untracked)을 확인했다.

## 발견사항

- **[INFO]** PATCH `/api/triggers/:id` 의 공개 계약이 세 축에서 breaking 하게 바뀐다 — 의도된
  보안 수정이며 유일한 알려진 소비자는 영향받지 않는다 (이전 3라운드와 동일 결론, 최신 소스로 재확인)
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts`
    (`chatChannel?: ChatChannelUpdateConfigDto`), `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
    `ChatChannelUpdateConfigDto`(`OmitType` 서브클래스), `codebase/backend/src/modules/triggers/triggers.service.ts`
    `assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`
  - 상세: ① `botToken`/`inboundSigningPlaintext` 를 실은 PATCH 는 이제 항상 400(종전엔
    `ChatChannelConfigDto` 상속으로 `botToken` 이 오히려 **필수**였다 — 정반대 방향 전환),
    ② 아직 setup 되지 않은 트리거에 PATCH 로 `chatChannel` 을 처음 붙이면 이제 명시적 400
    (종전엔 `setupChannel` 실패가 best-effort catch 에 삼켜져 200 + `chatChannelHealth=degraded`
    로 조용히 "성공" 처리됐다), ③ PATCH 로 `provider` 를 바꾸면 이제 400(종전엔 무검증 통과,
    다른 provider 의 토큰을 오용할 수 있는 경로였다). 세 변경 모두 CHANGELOG.md·컨트롤러
    `@ApiBadRequestResponse` Swagger 설명·mdx 사용자 문서(`triggers.mdx`/`.en.mdx` 포함, 이번
    라운드에서 두 신설 400 사유가 추가됨)·회귀 테스트로 다중 고정돼 있다. 프런트엔드 유일 소비자
    (`ChatChannelCard`)는 PATCH 바디에 두 비밀 필드나 `provider` 변경을 싣지 않으므로 영향 없음 —
    저장소 밖 API 클라이언트가 있다면 조용히 깨질 수 있는 계약 변경이라는 사실 자체는 이미 3개
    라운드가 동일하게 지적·수용했다.
  - 제안: 별도 조치 불요 — 의도된 보안 수정이고 영향 범위·문서·테스트가 이미 갖춰짐.

- **[INFO]** (해소 확인) 클래스 JSDoc 의 "내부 서사"가 공개 OpenAPI `description` 으로 새던 것이
  이번 델타(`464f2ba1a`)에서 실제로 닫혔다 — 부작용 관점에서 긍정적 변화
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` —
    `ChatChannelUpdateConfigDto` 클래스 선언 바로 위
  - 상세: `@nestjs/swagger` 플러그인이 `introspectComments` 로 클래스 JSDoc 을 그대로 공개
    스키마 `description` 에 싣는다(`spec/conventions/swagger.md:315`). 직전 커밋(`cf4ba26e9`)까지는
    "왜 `OmitType` 인가" · "왜 `Patch` 가 아니라 `Update` 인가" 같은 구현 경위 3단락이 JSDoc
    안에 있어 공개 API 소비자에게 그대로 노출되는 상태였다 — 이것은 "예상치 못한 인터페이스
    노출"에 해당하는 실질적 부작용이었다. `464f2ba1a` 가 그 세 단락을 클래스 선언 위 `//` 라인
    주석으로 옮기고 JSDoc 에는 소비자용 정보 + `@see` 만 남겨 해소했다(`git show 464f2ba1a --
    chat-channel-config.dto.ts` 로 직접 대조). 런타임 동작 변화는 없다 — 주석 위치만 바뀌었다.
  - 제안: 조치 불요 — 이미 해소됨. 향후 새 DTO JSDoc 작성 시 이 규약(공개 스키마로 새는 채널)을
    다시 놓치지 않도록 유의.

- **[INFO]** 마지막 side_effect 라운드(`00_21_55`) 이후 델타 3커밋은 `triggers.service.ts` 를
  건드리지 않는다 — secret 쓰기 게이팅·config 병합 로직에 새 변경 없음
  - 위치: `git diff 00_21_55 시점 대비 HEAD -- codebase/backend/src/modules/triggers/triggers.service.ts`
    (아래 "검증한 것" 명령으로 0줄 확인)
  - 상세: `5976587c7`(테스트 단언 8줄 강화 + mdx 4파일 + plan 트래커) · `464f2ba1a`(DTO JSDoc 재배치
    30줄 + 테스트 orphan JSDoc 정정 26줄 + mdx 2파일) · `c817a44c4`(CHANGELOG + plan, `codebase/`
    미접촉) 세 커밋 전부 프로덕션 로직이 아니라 주석·문서·테스트 단언 강화만 포함한다. 즉 이전
    3라운드가 검증한 secret-store 쓰기 게이팅(`storeUserSuppliedSecrets`)·ref 보존
    (`preservedInboundSigningRef`/`inboundSigningRefSurvives`)·private 메서드 시그니처 4개의
    내부 봉인 상태는 그대로 유지된다.
  - 제안: 조치 불요 — 재검증 완료.

## 검증한 것 — 위반 없음

- 새 전역 변수·모듈 레벨 mutable 상태 없음. `type ChatChannelInput`/`type ChatChannelInputMode`
  는 `export` 되지 않는 컴파일 타임 전용 타입 별칭.
- 파일시스템·`process.env` 읽기/쓰기 신규 도입 없음 —
  `git diff origin/main...HEAD -- 'codebase/**' | grep -nE '^\+.*(process\.env|fs\.|readFile|writeFile|fetch\(|axios|global\.)'`
  결과 0건.
- 이벤트 emitter·콜백 등록/해제 변경 없음 — 같은 grep 패턴에 `emit(`/`EventEmitter`/`publish`
  포함해도 0건.
- private 메서드 시그니처 변경(`assertChatChannelInputSafe`·`setupChatChannel`·
  `stripChatChannelPlaintext`·`mergeExternalConfig`) 4개 전부 `TriggersService` 내부 호출부에
  봉인돼 있고, `create()`/`update()` 양쪽 모두 새 시그니처로 갱신됨을 grep 으로 재확인. 파일 밖
  호출자 없음.
- `OmitType(ChatChannelConfigDto, ['botToken', 'inboundSigningPlaintext'])` 는 부모 클래스
  (`ChatChannelConfigDto`, `CreateTriggerDto` 가 계속 사용)의 메타데이터를 변형하지 않고 새
  클래스에 복사만 한다 — 회귀 테스트(`trigger-dto-validation.spec.ts`
  `'CreateTriggerDto 는 여전히 botToken 을 요구한다'`)가 생성 경로 무회귀를 고정한다.
  `git diff 00_21_55...HEAD -- triggers.service.ts` 로 마지막 side_effect 라운드 이후 이 파일에
  변경이 없음을 확인.
- `codebase/backend/src/modules/triggers/triggers.service.ts` (production 로직): 마지막
  side_effect 라운드(`00_21_55`) 이후 diff 0줄.
- `git status --short` — 세션 시작·종료 동일, 이번 세션 산출물 디렉터리(`review/code/2026/09/11/01_27_26/`)만
  untracked. 저장소 뮤테이션 없음.

## 요약

이 changeset 은 이미 3개 독립 `side_effect` 라운드에서 LOW 로 수렴했고, 그 이후 추가된 3개 커밋은
프로덕션 로직(`triggers.service.ts`)을 전혀 건드리지 않은 채 테스트 단언 강화·사용자 문서 보강·
CHANGELOG/plan 기록·DTO JSDoc 재배치에 그쳤다. 유일하게 새로 확인할 가치가 있었던 항목은 DTO
클래스 JSDoc 의 내부 서사가 `introspectComments` 를 통해 공개 OpenAPI 스키마로 새던 실질적 노출
부작용인데, 이번 델타(`464f2ba1a`)에서 이미 해소되었다(JSDoc→`//` 이동, 런타임 무영향). 남은
유일한 실질적 부작용은 PATCH `/api/triggers/:id` 공개 API 계약의 세 가지 **의도된** breaking
change(비밀 필드 거부·최초 setup 거부·provider 전환 거부)이며, 이는 diff 스스로 문서화·테스트로
고정했고 유일하게 알려진 프런트엔드 소비자가 영향받지 않음이 이미 여러 라운드에 걸쳐 확인돼 있다.
전역 변수·환경 변수·파일시스템·이벤트/콜백 관련 신규 부작용은 발견되지 않았다.

## 위험도

LOW
