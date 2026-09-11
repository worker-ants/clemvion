# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 요약

이번 PR(`impl-chat-channel-binder`)은 `spec/5-system/` 를 한 줄도 바꾸지 않는다(scope 델타 0, `spec_impact: none`). 실제 변경은 `codebase/backend/src/modules/triggers/` 내부의 **순수 코드 재배치**다:

- `TriggersService` 의 private 메서드 6개 + module-scope 타입 2개(`ChatChannelInput`, `ChatChannelInputMode`)를 새 파일 `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 로 이동하고 `export` 로 전환
- 이동 대상: `assertChatChannelInputSafe`(+overload) · `assertPatchCarriesNoSecrets` · `assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext` · `assertInboundSigningPlaintextByProvider` · `translateSetupChannelError`
- `triggers.service.ts` 는 이 함수들을 `import` 해서 호출하는 형태로 바뀜(동작 델타 없음)
- 신규 테스트 파일 `chat-channel-input-rules.spec.ts` 추가

이 모든 식별자(함수명·타입명)는 **PR 이전에도 동일한 이름으로 이미 존재**했다(단, `TriggersService` 의 `private` 멤버 또는 파일 module-scope 였던 것이 이번에 파일 밖으로 `export` 됨). 따라서 "새로 도입된 이름"은 사실상 **새 파일 경로 하나**(`chat-channel-input-rules.ts`)뿐이고, 함수/타입 이름 자체는 재사용이지 신규 조어가 아니다.

## 발견사항

### [INFO] 이동으로 인해 spec 의 클래스-한정 심볼 경로 2곳이 부정확해짐 (이미 트래킹됨)

- target 신규 식별자: `assertInboundSigningPlaintextByProvider` 가 `TriggersService` 의 멤버에서 `chat-channel-input-rules.ts` 의 module-level export 함수로 이동
- 기존 사용처:
  - `spec/4-nodes/7-trigger/providers/slack.md:275` — `` Backend 의 `TriggersService.assertInboundSigningPlaintextByProvider` 가 trigger 생성 시점에 정규식 검증 ``
  - `spec/4-nodes/7-trigger/providers/discord.md:297` — 동일 패턴의 `` `TriggersService.assertInboundSigningPlaintextByProvider` ``
  - (참고: `discord.md:76` 은 클래스 접두 없이 함수명만 인용하므로 영향 없음)
- 상세: 두 spec 문장은 이 함수를 `TriggersService` 의 **멤버**로 지목하는데, 이번 이동 이후 이 함수는 `TriggersService` 소속이 아니라 `chat-channel-input-rules.ts` 의 독립 함수다. 함수 자체는 여전히 존재하고 `TriggersService` 가 그것을 호출하므로 **실질(호출 관계)은 참**이지만, **심볼 경로 표기(`TriggersService.X`)는 부정확**해졌다 — 새로 옮겨진 자리의 이름이 기존 문서가 가리키던 "소속"과 어긋나는 경우다.
- 이것은 새 식별자가 **다른 의미로 이미 쓰이는** 충돌이 아니라, 기존 문서의 포인터가 이동 후 **틀린 소속**을 가리키게 된 경우다. 위험은 낮지만(오탐이 아니라 실측 확인함) 다음 사람이 `TriggersService` 안에서 이 메서드를 찾다가 못 찾는 정도의 혼선은 있다.
- 이미 처리됨: `developer` 는 이 PR 에서 `spec/` 쓰기 권한이 없고(자기-반증형 소정정 조건 1 불성립 — 해당 문장은 이전 planner 턴이 작성), plan 본문(`plan/in-progress/impl-chat-channel-binder.md` §"실제 결정")에서 이 드리프트를 실측·인지하고 `plan/in-progress/spec-draft-nullable-notation-followups.md:2523` 에 planner 후속 항목으로 명시 등재했다. `spec_impact: none` 은 이 PR 이 spec 을 실제로 편집하지 않으므로 정확하다.
- 제안: 추가 조치 불필요 — 이미 durable 트래커에 등재됨. 후속 planner 턴에서 `TriggersService.assertInboundSigningPlaintextByProvider` → `assertInboundSigningPlaintextByProvider`(클래스 접두 제거, 또는 `chat-channel-input-rules.ts` 경유로 명시) 로 두 문장만 정정하면 된다.

## 점검했으나 충돌 없음 확인

- **파일 경로**: `chat-channel-input-rules.ts` 는 `modules/triggers/` 및 형제 모듈 `modules/chat-channel/` 의 기존 명명 관행(`chat-channel-inbound-authenticator.ts`, `chat-channel-token-rotator.service.ts`, `chat-channel-rejection-messages.const.ts`, `discord-signing.ts` 등 — 접미사 없는 순수 로직 파일도 다수 존재)과 충돌하지 않으며 기존 파일과 겹치지 않는다.
- **타입명**: `ChatChannelInput`/`ChatChannelInputMode` 는 새 조어가 아니라 `triggers.service.ts` 에 있던 module-scope 타입을 그대로 옮긴 것 — 인접한 기존 타입 `ChatChannelConfig`(어댑터 내부 형태, `chat-channel/types.ts`)·`ChatChannelConfigDto`/`ChatChannelUpdateConfigDto`(요청 DTO)와 접미사로 명확히 구분되며 의미 충돌 없음.
- **함수명**: 이동된 6개 함수명 전부 `git grep` 전수 검색 결과 이 PR 관련 파일(신규 파일·`triggers.service.ts`·해당 spec 파일)에만 나타나며, 다른 모듈·다른 의미로 재사용되는 동명 식별자 없음.
- **API endpoint**: 이 PR 은 `triggers.controller.ts`/`triggers.module.ts` 를 건드리지 않는다 — 신규·변경 endpoint 없음.
- **이벤트/큐/웹소켓 이름**: 신규 도입 없음.
- **환경변수·설정키**: 신규 도입 없음.
- **요구사항 ID**: 신규 `R-CC-*` 등 ID 부여 없음(기존 `R-CC-21` 을 주석에서 참조만 함).

## 요약

이번 PR 은 `TriggersService` 내부의 chat-channel 검증 로직을 같은 모듈(`triggers/`) 안의 새 파일 `chat-channel-input-rules.ts` 로 재배치하는 순수 리팩터이며, 이동된 함수·타입명은 모두 기존에 동일한 이름·의미로 이미 존재하던 것이라 "신규 식별자가 기존과 다른 의미로 충돌"하는 사례는 발견되지 않았다. 유일한 주목할 점은 이동으로 인해 `spec/4-nodes/7-trigger/providers/slack.md:275` · `discord.md:297` 의 `TriggersService.assertInboundSigningPlaintextByProvider` 표기가 부정확해진 것인데, 이는 이미 developer 가 실측하고 planner 후속 트래커(`spec-draft-nullable-notation-followups.md`)에 등재했으며 `spec_impact: none` 선언도 정확하다. 파일 경로·타입명·함수명·endpoint·env var·이벤트명 어느 축에서도 새로운 충돌은 없다.

## 위험도

LOW
