# 성능(Performance) 리뷰 — `impl-chat-channel-binder-t2`

## 검토 범위

이번 diff 는 `TriggersService` 의 private 메서드 `setupChatChannel` / `teardownChatChannel` /
`buildCallbackUrl` 을 각각 신규 `ChatChannelBinderService`
(`codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`, 신설)와 순수 함수
`buildTriggerCallbackUrl`(`codebase/backend/src/modules/triggers/trigger-callback-url.ts`, 신설)
로 **그대로 옮기는(Extract-Class)** 리팩터다. `git diff origin/main -- .../triggers.service.ts` 로
삭제분과 신설 파일 원문을 직접 대조한 결과, 옮겨진 로직(제어 흐름·조건문·DB 쓰기·secret store
호출 순서)은 문자 그대로 동일 — plan(`plan/in-progress/impl-chat-channel-binder-t2.md`)이 내세우는
"단언 diff 0줄 / 순수 이동"과 일치한다. 나머지 파일(테스트 4종, `triggers.module.ts`,
`plan/**`, `review/code/2026/09/11/18_04_36/**`)은 DI 등록·테스트 provider 추가·이전 리뷰
라운드 산출물(문서)이라 런타임 성능과 무관하다.

## 발견사항

- **[INFO]** secret store 쓰기 2건이 서로 독립적인데도 순차(`await`)로 실행된다 — 병렬화 여지가
  있지만 **이번 diff 가 새로 만든 패턴이 아니다**.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:133-139`
    (`botTokenRef` rotate, `storeUserSuppliedSecrets` 게이팅) 와 `:146-160`
    (`inboundSigningRef` rotate, provider-issued plaintext 게이팅)
  - 상세: 두 `this.secrets.rotate(...)` 호출은 서로 다른 ref(`botTokenRef` vs
    `inboundSigningRef`)에 쓰고 서로의 결과값에 의존하지 않는다(둘 다 `true`인 경로 — 신규
    생성이면서 signing plaintext 도 함께 온 경우 — 에서 관측 가능). 지금은 두 번째 `await`
    가 첫 번째가 끝날 때까지 기다리므로, secret store 쪽 왕복 지연이 있는 백엔드라면 그 지연이
    그대로 두 배로 누적된다. 다만 이 순서·구조는 `triggers.service.ts` 에서 옮겨온 그대로이고
    (git diff 로 확인, 이동 전후 바이트 단위 동일), 세 번째 `secrets.rotate` 호출(`:207-213`,
    adapter 응답의 `issuedInboundSigning`)은 `adapter.setupChannel()` 결과에 의존하므로
    구조적으로 병렬화 불가 — 병렬화 여지가 있는 것은 앞의 두 건뿐이다. 트리거 생성/수정은
    사용자 트래픽 hot path 가 아니라(관리 API, 초당 대량 호출 대상 아님) 영향 규모는 작다.
  - 제안: 이번 PR 범위에서 조치 불요(순수 이동 목표와 상충). 향후 `secrets.rotate` 호출부를
    다시 손댈 일이 생기면 `Promise.all([...])` 로 앞의 두 독립 쓰기를 묶는 것을 고려.

- **[INFO]** `triggers.service.spec.ts`/`triggers.web-chat.spec.ts` 14개 describe 블록이
  `ChatChannelBinderService` 를 mock 없이 **실제 클래스**로 매번 새로 DI 인스턴스화한다 — 테스트
  스위트 실행 시간에 미치는 영향은 무시할 수준.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:41` 등 9개 지점
    (`createBaseProviders()` 내부 및 개별 `Test.createTestingModule` 호출),
    `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts:80`
  - 상세: 각 테스트 모듈이 `ChatChannelBinderService` 의 생성자 의존 4개(리포지토리·registry
    2종·secret resolver)를 추가로 해석해야 하지만, 전부 `jest.fn()` 기반 경량 mock 이라 실제
    I/O 는 발생하지 않는다. `chat-channel` 과 무관한 describe(`findAll`, `Schedule 역방향 동기화`
    등)에서도 이 클래스를 매번 인스턴스화하는 것은 테스트 격리 관점(이미 `architecture.md` INFO
    로 기록됨)에서는 아쉽지만, 실행 시간 자체는 `RESOLUTION.md` 가 기록한 "트리거 스위트
    246 → 257" 규모에서 유의미하게 늘 정도가 아니다.
  - 제안: 조치 불요. 프로덕션 코드 경로가 아니므로 성능 리스크로 분류하지 않는다.

- **[정보 없음]** 그 외 관점(알고리즘 복잡도·N+1·메모리 할당·캐싱·블로킹 I/O·문자열 O(n²) 누적·
  자료구조 선택·지연 로딩)에서 이번 diff 가 새로 만든 이슈는 없다. 확인한 근거:
  - `setupChatChannel`/`teardownChatChannel` 은 모두 단건 트리거(PK 기준) 처리이며 반복문 내부에
    DB/외부 API 호출이 없다 — `secrets.rotate` 호출도 최대 3회(고정 상수, 컬렉션 크기에 무관).
  - `buildTriggerCallbackUrl`(`trigger-callback-url.ts:48-56`)은 정규식 치환 2회 + 문자열 템플릿
    1회로 O(1)(입력 길이에 선형이지만 URL 길이는 무시할 수준) — `triggers.service.ts` 의 옛
    `buildCallbackUrl` 과 정확히 동일한 연산.
  - 객체 스프레드(`{...trigger.config, chatChannel: mergedChannel}` 등, `:216-229`,
    `:258-261`)는 트리거 1건당 얕은 복사 1~2회로 바운드돼 있고 대량 컬렉션 적재가 아니다.
  - `async/await` 전부 올바르게 사용돼 블로킹 동기 I/O 는 없다(`concurrency.md` 가 이미 이 축을
    확인).
  - `ChannelAdapterRegistry.has()/get()` 은 클래스 내부 Map 조회로 추정되며(이 diff 밖) 반복
    호출 비용은 O(1) 수준 — 새로 도입된 캐싱 필요 지점 없음.

## 요약

이번 변경은 `TriggersService` 의 chat-channel adapter setup/teardown 로직을 새
`ChatChannelBinderService` 로 옮기는 **순수 Extract-Class 리팩터**이며, `git diff` 로 이동 전후
로직이 바이트 단위로 동일함을 확인했다. 알고리즘 복잡도·N+1·메모리·캐싱·블로킹 I/O·문자열 연산·
자료구조·지연 로딩 어느 관점에서도 새로 도입된 성능 결함은 없다. 유일한 관찰은 (1) 이동 전부터
있던 두 개의 독립적 `secrets.rotate` 순차 호출(병렬화 여지는 있으나 hot path 가 아니고 이번
diff 가 만든 패턴이 아님)과 (2) 신규 provider 를 mock 없이 주입하는 테스트 설정 확장(런타임과
무관, 테스트 스위트 실행 시간에 미치는 영향도 미미)뿐이며 둘 다 이번 PR 을 막을 사유가 아니다.

## 위험도

NONE
