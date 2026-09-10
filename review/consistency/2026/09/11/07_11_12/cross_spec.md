# Cross-Spec 일관성 검토 — `spec-draft-chat-channel-drift-3`

## 검토 방법

target 문서의 세 결정(D-1 `details.field` 두 갈래, D-2 신규 400 두 분기, D-3 `store()`→`rotate()`
10곳)이 실제로 `spec/**`의 다른 영역과 충돌하는지 확인하기 위해, 번들에서 컨텍스트 예산 초과로
생략된 `spec/5-system/15-chat-channel.md`, `spec/conventions/secret-store.md`,
`spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/{telegram,slack,discord}.md`
를 저장소에서 직접 읽어 target 이 인용하는 줄 번호·문구를 원문과 대조했다. 또한 target 이 근거로
든 실측(단위 테스트·서비스 코드)을 `codebase/backend/src/modules/triggers/` 에서 직접 열어 재확인했다.

## 발견사항

### `store()` 카운트 재검증 — 10곳 정확히 일치 (교차 검증 결과, 결함 아님)

target 위치: 변경안 표 A4·C1~C4 (10곳 목록)

target 이 주장하는 10개 위치(`15-chat-channel.md:200,201,373,390` · `chat-channel-adapter.md:354,359`
· `telegram.md:58,219` · `slack.md:278` · `secret-store.md:301`)를 `grep -rn 'SecretResolver\.store\|secrets\.store' spec/`
로 전수 재현한 결과 **정확히 10건, 그 외 위치 0건**이었다. `providers/discord.md` 에는 `.store` 언급
자체가 없어 target 이 discord 를 목록에서 제외한 것도 정확하다. 별도 발견사항은 아니지만, cross-spec
전수성 판정의 핵심 전제라 검증 결과를 기록한다.

### `secret-store.md:301` 자기모순 수정은 실제 구현과도 일치 (교차 검증, 결함 아님)

target 위치: C2 (`conventions/secret-store.md:301`)

`secret-store.md §2.1`(줄 146)은 "Trigger 생성(notification/chatChannel 설정 포함)에 `rotate()`
권장"이라고 이미 명시하는데, §5.1 예시 코드(줄 301)는 notification-signing 경로에서 `store()`
를 쓴다 — target 이 지적한 자기모순이 원문에서 그대로 확인된다. 실제 구현
(`codebase/backend/src/modules/triggers/triggers.service.ts:961` `normalizeNotificationSecretRef`)도
`this.secrets.rotate(...)` 를 쓰므로, 수정 방향(`store→rotate`)은 spec-코드 정합과 spec 자기정합
양쪽에 부합한다. cross-spec 충돌 소지 없음.

### `details.field` 두 갈래 서술과 `3-error-handling.md §2.1` 의 정합 (교차 검증, 결함 아님)

target 위치: A1·A2·B1·B2 (두 갈래 `details.field` 표기)

`3-error-handling.md`(줄 270)는 현재 구현이 `details[].field` 를 `nodes[3].type` 같은 **중첩/배열
경로**로 유지한다고 이미 명시한다. target 이 "비어있지 않은 값 → 중첩 경로(`chatChannel.<field>`)"
로 정정하는 것은 이 기존 전역 규약과 일치하며, 오히려 종전 `15-chat-channel.md`/`2-trigger-list.md`
의 flat 표기가 이 전역 규약에서 벗어나 있던 것을 바로잡는 방향이다. 서비스 층 가드
(`assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp`/`assertChatChannelInputSafe`,
`triggers.service.ts:650-747`)가 flat 이름을 직접 `details.field` 에 싣는 것도 코드로 확인되어,
target 의 "두 갈래는 실재하는 두 레이어의 차이"라는 모델이 근거를 갖는다. 새로운 충돌 없음.

### 신규 400 두 분기(`chatChannel` 최초 부착·`provider` 전환)는 기존 결정의 후행 문서화 (교차 검증, 결함 아님)

target 위치: A3, B1, B3

`triggers.service.ts:722-747` (`assertChatChannelAlreadySetUp`)에 두 분기가 이미 구현돼 있고,
`details.field` 값도 각각 `'chatChannel'` · `'provider'` 로 코드와 target 서술이 일치한다.
`2-trigger-list.md` §2.3.1 의 `Chat Channel | provider` 행은 이미 "read-only (생성 후 변경 불가) …
변경하려면 트리거 삭제·재생성"이라 적고 있어(target 이 인용하는 R-12 방향과 동일), target 의
cross-link 추가는 신규 결정이 아니라 기존 read-only 정책에 에러 코드 근거를 보충하는 것이다.
다른 영역(`data-flow/14-chat-channel.md:150-151`)의 setup/PATCH 서술도 "사용자가 보낸 비밀을
secret store 에 쓰지 않는다"는 동일 전제를 이미 공유하고 있어 상충하지 않는다.

### (INFO) `3-error-handling.md` 의 도메인별 `VALIDATION_ERROR` 카탈로그에 chat-channel 세부 필드가 없다

target 위치: (target 변경 범위 밖 — 참고 사항)

`3-error-handling.md` 는 `TRIGGER_ENDPOINT_PATH_CONFLICT` 처럼 도메인 특화 세부 코드는 개별 행으로
등재하지만(줄 238), chat-channel PATCH 의 `details.field` 값 목록(`chatChannel`/`provider`/
`botToken`/`chatChannel.botToken` 등)은 등재하지 않고 `15-chat-channel.md`/`2-trigger-list.md` 만
SoT 로 남아 있다. target 이 이 파일을 `spec_impact` 에 넣지 않은 것 자체는 정당하다(기존에도
개별 도메인 코드를 전부 이 표에 미러링하지 않는 관례가 있다 — 예: EIA `INVALID_COMMAND`,
Webhook `INVALID_WEBHOOK_PAYLOAD` 만 별도 등재되고 chat-channel 계열은 처음부터 미등재).
따라서 이는 target 의 결함이 아니라 기존 관례의 연장이며, 차단 사유가 아니다. 향후 세션에서
chat-channel 도메인 코드를 이 표에 통합할지 여부는 별도 판단 사안으로 남겨도 무방하다.

## 요약

target 문서가 제안하는 세 결정(D-1 `details.field` 두 갈래, D-2 신규 400 두 분기 문서화, D-3
`store()`→`rotate()` 10곳 정정)은 모두 **이미 구현된 코드 동작을 spec 문면이 뒤늦게 반영**하는
성격이며, 새로운 요구사항·API 계약·데이터 모델·상태 전이·RBAC·계층 책임을 도입하지 않는다.
`spec/5-system/15-chat-channel.md`, `spec/conventions/secret-store.md`,
`spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/{telegram,slack}.md`
원문을 직접 대조하고 target 이 인용한 실측(단위 테스트·서비스 코드)을 재현한 결과, target 이
제시한 줄 번호·개수(특히 `store()` 10곳 카운트)는 **전수 grep 결과와 정확히 일치**했고, 손대지
않기로 한 `providers/discord.md`·`providers/slack.md:275`(생성 경로 서비스 가드) 판단도 옳았다.
`data-flow/14-chat-channel.md` 등 target 의 `spec_impact` 밖 인접 문서들도 이번 정정과 상충하는
서술을 갖고 있지 않다. Cross-Spec 관점에서 이 draft 를 채택해도 다른 영역이 깨지거나 모순되는
지점은 발견되지 않았다.

## 위험도

NONE
