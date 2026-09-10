# 성능(Performance) 코드 리뷰 — `impl-chat-channel-patch-token`

## 개요

리뷰 대상은 `chatChannel` PATCH 가 사용자 비밀(`botToken`·`inboundSigningPlaintext`)을 받지 못하게
막는 신규 DTO(`ChatChannelUpdateConfigDto`, `OmitType` 기반) · `TriggersService` 의 secret 쓰기
게이팅(`storeUserSuppliedSecrets`)·신규 가드(`assertChatChannelAlreadySetUp`,
`assertPatchCarriesNoSecrets`, `assertChatChannelInputSafe` 오버로드) · 관련 DTO/컨트롤러/테스트/문서
변경(`git diff origin/main...HEAD --stat -- 'codebase/**'`, 15 files, +1018/-166)이다.

이 PR 은 이미 두 차례 `/ai-review --route=all` 을 거쳤고(`review/code/2026/09/10/23_21_57`,
`review/code/2026/09/10/23_55_23`), 두 라운드 모두 performance 축은 **NONE** 이었다. 실제 서비스
로직 파일(`triggers.service.ts`)을 직접 열어(`Read`, 뮤테이션 없음) 그 이후 커밋(`83d5f3f94` 등)이
추가한 변경분까지 대조했다 — 추가된 것은 `assertChatChannelInputSafe` 에 붙은 함수 오버로드
시그니처 2개뿐이며, TypeScript 오버로드는 컴파일 타임에만 존재하고 컴파일된 JS 런타임에는 아무
바이트도 남지 않는다. 즉 마지막 performance 리뷰 이후 런타임 동작에 영향을 주는 신규 변경은 없다.

## 발견사항

- **[INFO]** `update()` 경로에 추가된 두 신규 가드는 모두 이미 메모리에 있는 단일 `trigger` 객체
  프로퍼티만 읽는 O(1) 검사이고 신규 DB 왕복이 없다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` 메서드 —
    `assertChatChannelAlreadySetUp(trigger, chatChannel)` 호출(약 521행)과
    `previousInboundSigningRef` 캡처(약 526~528행, `trigger.config` 캐스팅 후 프로퍼티 접근).
  - 상세: `assertChatChannelAlreadySetUp`(약 722~747행)은 `trigger.config.chatChannel.provider`
    문자열 비교 두 번이 전부이고, `assertPatchCarriesNoSecrets`(약 695~713행)는
    `typeof carried.botToken`/`inboundSigningPlaintext` 확인 두 번이 전부다. 둘 다 필드 수가 고정된
    (≤10) 얕은 객체에 대한 상수 시간 연산이며 반복문·재귀·정규식이 없다. 기존 `update()` 의
    재조회(`triggerRepository.findOne`)는 `chatChannel` 이 실린 PATCH 1건당 정확히 1회로 유지되고,
    이 diff 는 그 횟수를 늘리지 않았다 — N+1 패턴 없음.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** PATCH 경로는 외부 I/O(secret store 왕복) 호출 수가 오히려 줄어드는 방향이다
  - 위치: `setupChatChannel()`(약 1075~1260행) 내부 `[쓰기 ①]`(약 1122~1128행,
    `if (storeUserSuppliedSecrets) { await this.secrets.rotate(botTokenRef, ...) }`)과
    `[쓰기 ②]`(약 1135~1149행, `providerIssuedPlaintext = storeUserSuppliedSecrets ? ... : undefined`).
  - 상세: 종전에는 `chatChannel` 이 실린 모든 PATCH 가 무조건 `secrets.rotate()`(bot token)를
    호출했고 slack/discord 는 provider-issued signing 저장까지 추가로 탔다. 이번 변경은
    `storeUserSuppliedSecrets: false`(PATCH)일 때 이 두 secret-store 왕복을 완전히 생략한다 —
    카드 편집 PATCH 당 블로킹 외부 호출이 최대 2회 줄어든다. 알고리즘적 이득은 아니지만 회귀
    방향이 아니다.
  - 제안: 조치 불요.

## 확인된 것 — 위반 없음

- 반복문 내 DB/외부 API 호출(N+1) 없음 — 신규 분기는 전부 이미 로드된 단일 `trigger`/`chatChannel`
  객체에 대한 상수 시간 검사다 (`triggers.service.ts` `update()`, `setupChatChannel()`).
- 불필요한 대규모 객체 생성 없음 — `stripChatChannelPlaintext`(약 758~770행)의 구조 분해는 필드
  5~10개 수준의 얕은 복사이고, 종전 `as` 캐스팅 한 겹을 제거해 오히려 미세하게 가벼워졌다.
- 캐싱이 필요한 반복 계산 없음 — 검증 로직은 요청당 1회 실행이고 재사용할 계산 결과가 없다.
  `ChatChannelUpdateConfigDto`(`OmitType(...)`)의 메타데이터 생성은 모듈 로드 시 1회이고 요청마다
  재계산되지 않는다(NestJS/class-transformer 표준 데코레이터 캐싱).
- 블로킹 동기 I/O 없음 — `secrets.rotate`, `adapter.setupChannel`, `triggerRepository.*` 는 기존과
  동일하게 전부 `await` 로 비동기 처리된다.
- 과도한 문자열 연결(O(n²)) 없음 — 신규 에러 메시지·Swagger 서술은 전부 정적 리터럴 또는 단일
  template literal 이다 (`triggers.controller.ts` 약 119~131행, `chat-channel-config.dto.ts`
  약 383~407행).
- 자료구조 선택 부적절 사례 없음 — `Record<string, unknown>` 캐스팅은 필드 수가 작은 고정 스키마
  객체에 대한 기존 저장소 관례를 그대로 따른다.
- 지연 로딩 위반 없음 — `previousInboundSigningRef` 는 병합 직전 시점에만 필요한 값을 그 시점에만
  추출하며, 불필요하게 선행 로드하는 리소스는 없다.
- 문서(CHANGELOG.md, `*.mdx` 6파일)·plan/review 산출물 변경은 런타임 코드 경로가 아니므로 성능
  평가 대상이 없다.

## 방법론 메모 (뮤테이션 규약 준수)

가설 검증을 위해 저장소 파일을 고쳐야 할 필요가 없었다 — `Read`/`Bash`(`git log -p`, `git show`)로
직접 열람·대조하는 것만으로 "마지막 performance 리뷰 이후 런타임 변경 없음" 을 확인할 수 있었다.
저장소 트리에 아무것도 쓰지 않았고, 세션 종료 시 `git status --short` 결과는 이 리뷰 세션 자신의
출력 디렉터리(`review/code/2026/09/11/01_27_26/`, untracked) 하나뿐이다 — 다른 파일에 대한 잔여
뮤테이션 없음.

## 요약

이번 diff 는 chatChannel PATCH 의 secret 쓰기 게이팅과 DTO 분리를 다루며, 추가된 검증 로직은 모두
이미 메모리에 있는 단일 객체에 대한 상수 시간 분기이고 신규 DB 쿼리·N+1 패턴·블로킹 I/O·비효율
자료구조·O(n²) 문자열 연산은 발견되지 않았다. 오히려 PATCH 경로에서 불필요했던 secret-store 왕복
(최대 2회/요청)을 조건부로 생략하게 되어 외부 I/O 호출 수가 소폭 감소하는 방향이다. 이전 두 리뷰
라운드의 performance 판정(NONE)과 일치하며, 직전 라운드 이후 추가된 유일한 변경(함수 오버로드
시그니처)은 컴파일 타임 전용이라 런타임 성능에 영향이 없다. 성능 관점에서 이 PR 을 막을 사유는
없다.

## 위험도

NONE
