# 부작용(Side Effect) 리뷰

## 검토 범위 및 방법

`git diff origin/main...HEAD` 로 실제 코드 변경 파일을 확정했다 (`meta.json` 의 파일 목록 중
plan/review 산출물은 코드가 아니므로 부작용 관점 대상에서 제외):

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (신규, 324줄)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (수정 — 324줄 삭제, import 4곳 교체)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (신규, 268줄)

저장소 파일은 전혀 수정하지 않았다 — `Read`/`Bash grep`/`git diff` 만 사용. `git status --short`
로 잔여물 없음을 재확인했다(세션 산출 디렉터리 자체만 untracked, 정상).

핵심 검증:
- `grep -rn "assertChatChannelInputSafe\|assertPatchCarriesNoSecrets\|assertChatChannelAlreadySetUp\|stripChatChannelPlaintext\|assertInboundSigningPlaintextByProvider\|translateSetupChannelError" codebase/ --include="*.ts"` — 이동된 6개 함수의 **모든** 참조 지점을 전수 확인. `chat-channel-input-rules.ts`(정의) · `chat-channel-input-rules.spec.ts`(신규 단위 테스트) · `triggers.service.ts`(호출부) 세 파일 밖에는 어떤 참조도 없다.
- `grep -rn "spyOn.*assert\|spyOn.*strip\|spyOn.*translateSetup"` / `"service\['assert\|\.prototype\.assert"` — 0건. 이전에 `private` 메서드였던 이 함수들을 `jest.spyOn` 이나 프로토타입 접근으로 가로채던 테스트가 없어, "메서드 제거로 spy 가 조용히 no-op 된다" 류의 부작용은 발생하지 않는다.
- `triggers.service.ts` 의 import 블록에서 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` / `SLACK_SIGNING_SECRET_REGEX` / `DISCORD_PUBLIC_KEY_REGEX` / `ChatChannelConfigDto` / `ChatChannelUpdateConfigDto` 가 제거됐는데, 파일 전체를 grep 한 결과 이 심볼들에 대한 잔여(orphan) 참조가 **0건** — 이동이 깨끗하다. `ErrorCode` 는 이 파일의 다른 곳(`:482`, `:756`)에서 여전히 쓰이므로 import 유지가 맞다.
- 이동된 6개 함수 본문을 구 위치(`triggers.service.ts` 의 `-` 블록)와 신 위치(`chat-channel-input-rules.ts`)에서 줄 단위로 대조 — `BadRequestException` 페이로드, provider 분기, 정규식 사용, 에러 코드가 텍스트 그대로 동일하다. 포맷팅(구조 분해를 한 줄로 합침 등)만 다르고 로직 변경은 없다.
- `chat-channel-input-rules.spec.ts` 는 신규 파일이지만 순수 함수를 직접 호출하는 unit test 만 담고 있다 — 파일시스템 쓰기, 환경 변수 접근, 네트워크 호출, mock 서버 기동 등 부작용을 유발하는 코드는 없다.

## 발견사항

- **[INFO]** private 인스턴스 메서드 6개가 module-level export 함수로 승격되어 캡슐화 경계가 넓어졌다 — 이번 diff 안에서 오용 사례는 없음
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (전체 — `export function` 선언 6곳) / 대비되는 구 코드는 `codebase/backend/src/modules/triggers/triggers.service.ts` 의 삭제된 `private` 키워드 블록(구 `:608-1341` 부근, 이번 diff 의 `-` 라인)
  - 상세: `assertChatChannelInputSafe` · `assertPatchCarriesNoSecrets` · `assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext` · `assertInboundSigningPlaintextByProvider` · `translateSetupChannelError` 는 이전엔 `TriggersService` 의 `private` 메서드라 그 클래스 내부에서만 호출 가능했다. 지금은 `export` 된 module-level 함수라 `codebase/backend/src` 어디서든 import 해 단독 호출할 수 있다. 예를 들어 `assertChatChannelAlreadySetUp(trigger, incoming)` 은 `TriggersService.update()` 가 보장하던 "이 trigger 는 이미 workspace 소유권 검증을 통과했다" 는 호출 맥락과 무관하게, 임의로 구성한 `Trigger`-shape 객체로 호출될 수 있다(함수 자체는 순수해서 그 자체로 위험하진 않지만, 이 함수가 지키던 "생성 전용 setup 규칙" 을 향후 다른 서비스/컨트롤러가 `TriggersService` 를 거치지 않고 재사용·오용할 길이 열렸다). 전수 grep 으로 확인한 바 **현재는 실제 외부 소비자가 0개**이므로 이번 diff 자체가 만드는 즉각적 부작용은 아니다. architecture reviewer 가 같은 지점을 캡슐화/응집도 관점(INFO)으로 이미 지적했다 — 여기서는 "차후 호출부가 서비스 계층의 사전조건 없이 직접 부를 수 있다" 는 side-effect 관점만 덧붙인다.
  - 제안: 지금 조치 불필요. 후속 PR 에서 이 모듈 밖의 코드가 이 함수들을 import 하기 시작하면, 그 호출부가 `TriggersService` 가 원래 보장하던 사전조건(workspace 소유권 확인된 `Trigger`, DTO 유효성 등)을 스스로 재현하고 있는지 그 시점에 재검토한다.

- **[INFO]** 시그니처 자체는 무변경 — 호출부 전수 갱신 확인, 외부 영향 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:42-47` (신규 import 블록) · `:404,414,487,495,510,912,1291` (호출부)
  - 상세: 6개 함수의 파라미터·오버로드·반환 타입은 이동 전후 바이트 단위로 동일하다(구조 분해 한 줄 병합 같은 포맷팅만 다름). 바뀐 것은 수신자 표기(`this.foo(...)` → `foo(...)`)뿐이며, `triggers.service.ts` 안의 7개 호출부가 전부 새 형태로 일괄 치환됐고 잔여 `this.assert...`/`this.strip...`/`this.translate...` 호출은 0건이다. 이 함수들이 `private` 이었으므로 이 시그니처 변경 형태(메서드→함수)로 영향을 받는 외부 호출자는 원천적으로 존재할 수 없다.
  - 제안: 없음 — 확인 기록.

- **[INFO]** 전역 상태·환경 변수·파일시스템·네트워크·이벤트/콜백 — 이번 diff 범위에서 해당 없음
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 전체 / `chat-channel-input-rules.spec.ts` 전체
  - 상세: 이동된 6개 함수는 인자로 받은 DTO/`Trigger` 를 읽기만 하며 mutate 하지 않는다 (`stripChatChannelPlaintext` 는 구조 분해로 **새 객체**를 반환). 모듈 스코프의 가변 상태·`process.env` 접근·`fs`/`http` 호출·`EventEmitter`/콜백 등록은 이 파일과 신규 테스트 파일 어디에도 없다. `SLACK_SIGNING_SECRET_REGEX`/`DISCORD_PUBLIC_KEY_REGEX` 는 `g`/`y` 플래그 없는 리터럴이라 `.test()` 간 `lastIndex` 공유 상태 문제도 없다(이번 PR 신규 도입 아님, 기존 import 를 그대로 옮김).
  - 제안: 없음 — 확인 기록.

## 요약

이번 변경은 `TriggersService` 안에 있던 chat-channel 입력 검증/정화 함수 6개를 신규 모듈로 옮기는 순수 이동(behavior-preserving move) 이며, 부작용 관점의 8개 점검 항목(상태 변경·전역 변수·파일시스템·시그니처·인터페이스·환경 변수·네트워크·이벤트) 중 실질적 리스크로 이어지는 항목은 없다. 유일하게 주목할 지점은 `private` 메서드 6개가 module-level `export` 함수로 승격되어 캡슐화 경계가 넓어진 것인데, 전수 grep 으로 확인한 결과 현재 이 함수들을 두 파일(`triggers.service.ts`, 신규 `chat-channel-input-rules.spec.ts`) 밖에서 호출하는 코드는 없고 `jest.spyOn`/프로토타입 접근으로 옛 메서드 형태에 결합된 테스트도 없다 — 그래서 이번 diff 가 즉시 만드는 회귀는 없지만, 향후 다른 모듈이 이 함수들을 `TriggersService` 의 사전조건 검증 없이 직접 호출할 수 있는 문을 열어 둔다는 점만 기록해 둔다.

## 위험도

LOW
