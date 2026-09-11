# Rationale 연속성 검토 — spec/5-system/ (--impl-done, T2: chat-channel-binder 추출)

## 컨텍스트 요약

target scope(`spec/5-system/`)의 diff 는 **0개 파일**이다(`plan/in-progress/impl-chat-channel-binder-t2.md` 의 `spec_impact: none`과 일치 — 실제로 `git diff origin/main...HEAD -- spec/5-system/` 는 비어 있음을 확인했다). 실제 구현 변경은 `codebase/backend/src/modules/triggers/` 8개 파일로, `TriggersService.setupChatChannel`/`teardownChatChannel`(secret 쓰기 + ref 보존 로직)을 신규 `ChatChannelBinderService` 로, `buildCallbackUrl` 을 순수 함수 `trigger-callback-url.ts` 로 추출하는 **순수 이동**(동작 보존 주장)이다.

프롬프트 번들에서 `spec/5-system/15-chat-channel.md` 본문이 예산 초과로 생략돼 있어, 대상 spec 파일(844줄)을 절대경로로 직접 `Read` 하고 `## Rationale`(R1~R9, R-CC-10~21) 전체를 확인했다. 또한 실제 코드 diff(`chat-channel-binder.service.ts` 전문, `trigger-callback-url.ts` 전문, `triggers.service.ts`/`triggers.module.ts`/`triggers.service.spec.ts` diff)를 워킹트리에서 직접 읽었다.

이 턴은 동일 트래커의 직전 라운드(`--impl-prep`, `review/consistency/2026/09/11/17_39_32`)의 후속이다. 그 라운드의 `rationale_continuity.md` 는 WARNING 1건(spec SoT 포인터 stale화 미등재)·INFO 1건(§7 본문 다이어그램 stale화)을 남겼다. 이번 라운드는 (a) 그 WARNING 이 실제로 어떻게 처분됐는지, (b) 완료된 코드가 `## Rationale` 의 invariant 를 실제로 지켰는지 재확인한다.

## 발견사항

없음. 아래는 검토 근거로 확인한 정합 지점과, 직전 WARNING 의 처분 상태다.

### 직전 WARNING 처분 확인 — 등재됐다 (재발 아님)

`17_39_32` WARNING(`setupChatChannel` 클래스 귀속을 인용하는 3곳 — `spec/conventions/secret-store.md`·`spec/conventions/chat-channel-adapter.md:369`·`spec/data-flow/14-chat-channel.md:29` — 이동으로 stale화)은 이번 완료 커밋에서 무시되지 않았다. `plan/in-progress/spec-draft-nullable-notation-followups.md` diff 에 신규 체크리스트 항목 `"setupChatChannel 귀속 표기 3곳이 T2 이동으로 낡는다" (planner, 2026-09-11 등재)` 이 정확히 그 3곳을 표로 재열거하고, `"자기-반증형 소정정 조건 1 불성립 → planner 턴"` 이라고 명시해 developer 가 직접 고치지 않고 올바르게 다음 축(project-planner)으로 넘겼다 — CLAUDE.md 의 역할 경계(`spec/` 은 project-planner, developer 는 좁은 예외만) 와 정합. 같은 diff 에 `17_39_32` INFO(§7 본문 다이어그램 stale화)도 같은 항목에 병합 등재됐다. 두 항목 모두 **새로운 spec 결정을 요구하지 않으며**, 대상 파일이 `spec/5-system/` 밖(conventions·data-flow)이라 이번 target scope 의 CRITICAL/WARNING 사유는 아니다.

### `## Rationale` invariant 준수 확인

- **R-CC-21 (PATCH 는 비밀을 쓰지 않는다)** — 이동된 `ChatChannelBinderService.setupChatChannel` 은 `storeUserSuppliedSecrets` 게이팅(botToken rotate·provider-issued inbound-signing 모두 skip) 과 telegram server-issued `issuedInboundSigning` 은 게이팅 없이 무조건 재저장하는 분기를 **원문 그대로** 유지한다(diff 확인 — `triggers.service.ts` 에서 삭제된 191+21줄과 신 파일의 대응 블록이 로직 동일). R-CC-21 이 명시적으로 기각한 두 대안(`SecretResolver.rotate` 빈 값 가드 추가, `botToken` optional 후 침묵 무시)은 재도입되지 않았다.
- **CCH-AD-02/03, CCH-SE-01** — setup/teardown 호출 시점·health 컬럼 갱신·자동 비활성화 금지 로직 모두 이동 전과 동일 코드로 확인됨.
- **모듈 경계 (`#676`/`e827ed2a7`)** — `git show e827ed2a7` 로 실재를 확인했다: chat-channel↔triggers 양방향 `forwardRef` 를 없애기 위해 chat-channel→triggers 의존 2곳을 triggers 로 이전해 단방향화한 결정이다. 신규 `ChatChannelBinderService` 는 그 방향(triggers 가 `ChannelAdapterRegistry`/`ChannelListenerRegistry` 를 일반 import 로 참조)을 그대로 따르며, `triggers.module.ts` diff 에도 forwardRef 가 재도입되지 않았음을 확인했다(`ChatChannelModule` 은 여전히 일반 import). 파일이 `chat-channel/` 이 아니라 `triggers/` 에 남은 이유도 이 결정을 명시적으로 인용해 정당화하고 있다.
- **`buildTriggerCallbackUrl` 분리** — plan 문서가 기각한 대안 3가지(binder public 소유·호출자 인자 전달·양쪽 private 사본) 각각에 반증 가능한 근거를 붙였고, 어느 것도 기존 Rationale 원칙(SoT 단일화)과 충돌하지 않는다.

## 요약

target scope(`spec/5-system/`) 자체의 diff 는 0이며, 관련 구현 diff(triggers 모듈 8파일)는 `15-chat-channel.md` 의 `## Rationale`(R-CC-10, R-CC-21 등)이 보호하는 invariant — PATCH 비밀 미쓰기 3분기, telegram server-issued 예외, chat-channel↔triggers 단방향 의존 — 를 코드 그대로(동작 보존) 이동시켰을 뿐 기각된 대안을 재도입하거나 원칙을 벗어난 지점이 없다. 직전 `--impl-prep` 라운드가 남긴 WARNING(spec 밖 conventions/data-flow 문서의 클래스 귀속 서술 stale화)은 무시되지 않고 durable tracker 에 정확한 3곳 목록과 함께 planner 턴 항목으로 등재돼 올바르게 처분됐다. Rationale 연속성 관점에서 이 구현은 과거 결정을 존중하고 근거를 명시적으로 인용하는 모범적 사례에 해당한다.

## 위험도

NONE
