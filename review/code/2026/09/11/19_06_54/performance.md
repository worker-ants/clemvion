# 성능(Performance) 코드 리뷰

## 검토 범위 및 방법

이번 diff(T2, `impl-chat-channel-binder-t2`)는 `TriggersService` 의 private 메서드
`setupChatChannel` / `teardownChatChannel` / `buildCallbackUrl` 을 각각 신규
`ChatChannelBinderService`(`chat-channel-binder.service.ts`)와 순수 함수
`buildTriggerCallbackUrl`(`trigger-callback-url.ts`)로 옮기는 **순수 이동(no-op) 리팩터**다.
`git diff origin/main -- codebase/backend/src/modules/triggers/triggers.service.ts` 로
제거분 전체와 신설 파일을 바이트 단위로 대조했고, 로직·분기·await 순서·쿼리 형태가
이동 전후 동일함을 확인했다. 나머지 변경(모듈 provider 등록, DI 주입, 테스트 스펙에
`ChatChannelBinderService` provider 추가)은 순수 배선(wiring)이며 런타임 성능에 영향을
주는 로직이 없다.

## 발견사항

- **[INFO]** `setupChatChannel` 내 secret store 쓰기가 순차 `await` 다 (병렬화 가능하나 기존 동작 유지)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:134` (bot token rotate), `:154` (provider-issued signing rotate), `:208` (issued inbound signing rotate)
  - 상세: `storeUserSuppliedSecrets: true` 인 생성 경로에서 botToken rotate 와 provider-issued signing rotate 가 서로 독립적인 자원(ref 가 다름)임에도 순차로 `await` 된다. `Promise.all` 로 병렬화하면 secret store round-trip 1회분의 지연을 줄일 수 있다. 다만 이 코드는 `TriggersService.setupChatChannel` 에서 **바이트 단위로 그대로 이동**된 것이며 새로 도입된 비효율이 아니다. `review/code/2026/09/11/18_04_36/RESOLUTION.md` 의 INFO 2("secret rotate 순차 await")로 이미 트래커에 등재되어 있어 이번 PR 이 새로 만든 항목이 아니다.
  - 제안: 별도 후속 작업에서 처리(이번 PR 스코프 아님, 재등재 불요).

- **[INFO]** `ChannelAdapterRegistry.has()` / `get()` 이중 조회
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:98`, `:111` (setupChatChannel) / `:282`, `:283` (teardownChatChannel)
  - 상세: 같은 `provider` 키로 `has()` 후 `get()` 을 별도 호출한다. Map 기반 registry 라면 각각 O(1)이라 실질적 영향은 미미하지만, `get()` 이 `undefined` 를 반환할 수 있는 구조라면 조회 1회(`get()` 만 하고 `undefined` 체크)로 줄일 여지는 있다. 이 역시 이동 전 코드와 동일한 형태이므로 새로운 문제는 아니다.
  - 제안: 조치 불요(사전 존재, 영향 미미).

- **[INFO]** 신규 `buildTriggerCallbackUrl` 순수 함수의 정규식 리터럴
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.ts:56`
  - 상세: `resolved.replace(/\/$/, '')`, `endpointPath.replace(/^\//, '')` 두 정규식 모두 앵커가 고정된 단순 패턴(문자열 끝/시작 슬래시 1개 제거)이라 이차 백트래킹 위험이 없고, 호출당 1회씩만 실행돼 비용은 무시할 수준이다. 문제 없음.

- **[INFO]** DI 배선 추가로 인한 오버헤드
  - 위치: `codebase/backend/src/modules/triggers/triggers.module.ts:51` (`ChatChannelBinderService` provider 등록)
  - 상세: `ChatChannelBinderService` 는 Nest 기본 스코프(싱글턴)로 등록되어 애플리케이션 부트 시 1회만 인스턴스화된다. 요청마다 재생성되지 않으므로 성능에 미치는 영향은 없다.

## 요약

이번 변경은 로직을 그대로 옮기는 리팩터로, 알고리즘 복잡도·쿼리 패턴·메모리 할당·캐싱 전략 어느 것도 바뀌지 않았다. `triggers.service.ts` 원본 삭제분과 `chat-channel-binder.service.ts` 신설분을 대조한 결과 완전히 동일한 코드이며, 유일하게 새로 만들어진 로직인 `buildTriggerCallbackUrl` 순수 함수도 O(1) 문자열 치환뿐이라 성능 우려가 없다. 발견된 항목(순차 secret rotate, registry 이중 조회)은 모두 이동 전부터 존재했던 것으로 확인했고 이미 별도 트래커에 등재되어 있어 이번 PR 의 회귀가 아니다. 테스트 파일 변경(신규 provider 추가)도 런타임 성능과 무관한 배선이다.

뮤테이션/트리로 저장소 파일을 수정하지 않았고(`git status --short` 로 clean 확인), 읽기 전용 검토만 수행했다.

## 위험도
NONE
