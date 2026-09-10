# 부작용(Side Effect) 코드 리뷰 — chatChannel PATCH 비밀 차단 (D-1·D-2·D-3, 7라운드)

## 검토 방법

`git diff origin/main...HEAD -- 'codebase/**'`(누적, 커밋 `4a8b5f456`~`84a6aeaa8`)를 전량
확인했다. 이 changeset 은 이미 6차례 `/ai-review` 라운드(`23_21_57`→`23_55_23`→`00_21_55`→
`00_45_18`→`01_10_43`→`01_27_26`)를 거쳤고, `side_effect` 는 그중 4라운드(`23_21_57`,
`23_55_23`, `00_21_55`, `01_27_26`)에서 독립 수행되어 매번 **LOW** 로 수렴했다. 이번 라운드는
(a) 그 결론이 최신 소스에서도 유지되는지 재확인하고, (b) 마지막 `side_effect` 라운드
(`01_27_26`) **이후** 커밋(`84a6aeaa8` 1개)에 새 부작용이 있는지에 집중했다.

`84a6aeaa8`(`test(backend): 내부 3필드에 null/'' 테스트가 없었다`)를 커밋 단위로 직접
`git show`로 열어 대조한 결과, 변경된 4개 파일 전부 **주석/문서/테스트 단언 추가뿐**이었다:

- `triggers.service.ts` — `stripChatChannelPlaintext` JSDoc 의 `SecretResolver.store` →
  `SecretResolver.rotate (UPSERT)` 용어 정정 2줄. 런타임 로직 변경 0.
- `slack.adapter.ts` — `setupChannel` JSDoc 의 같은 용어 정정 + 근거 1줄 추가.
- `chat-channel-config.dto.ts` — `inboundSigningPlaintext` JSDoc 의 같은 용어 정정 1줄.
- `triggers.service.spec.ts` — 기존 `it.each` 배열에 6개 조합(`botTokenRef`/
  `inboundSigningRef`/`inboundSigning` × `null`/`''`) 추가. 새 mock·새 전역 상태 없음, 기존
  `describe` 블록 안의 파라미터화 케이스 확장.

프로덕션 로직 파일(`triggers.service.ts`) 자체의 **동작**은 이 델타에서 한 글자도 바뀌지
않았다 — 바뀐 것은 그 파일의 JSDoc 뿐이다. 저장소 트리는 건드리지 않았다: `Read`/`git diff`/
`git show`/`grep`만 사용했고, 세션 시작·종료 시점 `git status --short`가 동일함(이번 세션
산출물 디렉터리 `review/code/2026/09/11/01_52_59/`만 untracked)을 확인했다.

## 발견사항

- **[INFO]** PATCH `/api/triggers/:id` 의 공개 계약이 세 축에서 breaking 하게 바뀐다 — 의도된
  보안 수정이며 유일한 알려진 소비자는 영향받지 않는다 (이전 4라운드와 동일 결론, 최신 소스로
  재확인)
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts`
    (`chatChannel?: ChatChannelUpdateConfigDto`), `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
    (`ChatChannelUpdateConfigDto` — `OmitType` 서브클래스), `codebase/backend/src/modules/triggers/triggers.service.ts`
    (`assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`)
  - 상세: ① `botToken`/`inboundSigningPlaintext`를 실은 PATCH는 이제 항상 400(종전엔
    `ChatChannelConfigDto` 상속으로 `botToken`이 오히려 **필수**였다 — 정반대 방향 전환),
    ② 아직 setup되지 않은 트리거에 PATCH로 `chatChannel`을 처음 붙이면 이제 명시적 400(종전엔
    `setupChannel` 실패가 best-effort catch에 삼켜져 200 + `chatChannelHealth=degraded`로
    조용히 "성공" 처리됐다), ③ PATCH로 `provider`를 바꾸면 이제 400(종전엔 무검증 통과, 다른
    provider의 토큰을 오용할 수 있는 경로였다). `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx`
    를 직접 열어 확인한 결과 PATCH 바디(`patchChatChannel`)에 `botToken`·
    `inboundSigningPlaintext`·`provider` 변경을 싣지 않아 영향 없음 — 저장소 밖 API
    클라이언트가 있다면 조용히 깨질 수 있는 계약 변경이라는 사실 자체는 CHANGELOG.md·
    Swagger·mdx 문서·회귀 테스트로 다중 고정돼 있다.
  - 제안: 별도 조치 불요 — 의도된 보안 수정이고 영향 범위·문서·테스트가 이미 갖춰짐.

- **[INFO]** 마지막 `side_effect` 라운드(`01_27_26`) 이후 델타(`84a6aeaa8`)는 JSDoc 용어 정정
  2줄 + 테스트 조합 6개 추가뿐이며 production 동작 변경 0
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`stripChatChannelPlaintext`
    JSDoc 두 줄), `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts`
    (`setupChannel` JSDoc), `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
    (`inboundSigningPlaintext` JSDoc), `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
    (`it.each` 배열 확장 — `TriggersService — chatChannel PATCH 는 사용자 비밀을 쓰지 않는다` describe)
  - 상세: `git show 84a6aeaa8`로 4개 파일 전문을 직접 대조했다. `secrets.rotate()` 호출부
    자체(`triggers.service.ts` `setupChatChannel` `[쓰기 ①]`)는 이 델타에서 바뀌지 않았고
    이미 이전 커밋(`cf4ba26e9`)부터 `rotate`를 쓰고 있었다 — 이번 델타는 **주석이 실제
    구현(`rotate`)을 뒤늦게 따라잡은 것**뿐이다(주석이 낡은 `store()` 용어를 쓰던 문제이지
    코드가 `store()`를 호출하다 `rotate()`로 바뀐 것이 아니다). 테스트 배열 확장은 기존
    `it.each` 파라미터에 항목만 추가한 것이라 새 mock·새 side effect 표면을 만들지 않는다.
  - 제안: 조치 불요 — 재검증 완료.

## 검증한 것 — 위반 없음

- 새 전역 변수·모듈 레벨 mutable 상태 없음 — `type ChatChannelInput`/`type ChatChannelInputMode`
  는 `export`되지 않는 컴파일 타임 전용 타입 별칭(이전 라운드부터 불변).
- 파일시스템·`process.env` 읽기/쓰기 신규 도입 없음 —
  `git diff origin/main...HEAD -- 'codebase/**' | grep -nE '^\+.*(process\.env|fs\.|readFile|writeFile|fetch\(|axios|global\.)'`
  결과 0건(재실행 확인).
- 이벤트 emitter·콜백 등록/해제 변경 없음 — 같은 grep 패턴에 `emit(`/`EventEmitter`/`publish`
  포함해도 0건.
- private 메서드 시그니처 변경(`assertChatChannelInputSafe` 오버로드 2개·`setupChatChannel`
  옵션 인자·`stripChatChannelPlaintext`·`mergeExternalConfig`) 전부 `TriggersService` 내부
  호출부에 봉인돼 있고 `create()`/`update()` 양쪽 모두 새 시그니처로 갱신됨을 grep으로
  재확인(`grep -n "setupChatChannel(" codebase/backend/src codebase/backend/test` → 정의 1건 +
  호출 2건, 둘 다 옵션 인자 포함). 파일 밖 호출자 없음.
- `OmitType(ChatChannelConfigDto, ['botToken', 'inboundSigningPlaintext'])`는 부모 클래스
  (`ChatChannelConfigDto`, `CreateTriggerDto`가 계속 사용)의 메타데이터를 변형하지 않고 새
  클래스에 복사만 한다 — 회귀 테스트(`trigger-dto-validation.spec.ts`
  `'CreateTriggerDto 는 여전히 botToken 을 요구한다'`)가 생성 경로 무회귀를 고정한다.
- `git status --short` — 세션 시작·종료 동일, 이번 세션 산출물 디렉터리만 untracked. 저장소
  뮤테이션 없음.

## 요약

이 changeset은 이미 4개 독립 `side_effect` 라운드에서 LOW로 수렴했고, 마지막 라운드 이후
추가된 유일한 커밋(`84a6aeaa8`)은 JSDoc 용어 정정(2곳)과 테스트 조합 확장(6개)뿐으로
프로덕션 로직(`triggers.service.ts`의 실제 동작)을 전혀 건드리지 않는다. 남은 유일한
실질적 부작용은 PATCH `/api/triggers/:id` 공개 API 계약의 세 가지 **의도된** breaking
change(비밀 필드 거부·최초 setup 거부·provider 전환 거부)이며, 이는 diff 스스로 CHANGELOG·
Swagger·mdx 사용자 문서·회귀 테스트로 다중 고정했고 유일하게 알려진 프런트엔드 소비자
(`ChatChannelCard`)가 영향받지 않음을 소스 레벨에서 재확인했다. 전역 변수·환경 변수·
파일시스템·이벤트/콜백·공개 함수 시그니처 관련 신규 미고지 부작용은 발견되지 않았다.

## 위험도

LOW
