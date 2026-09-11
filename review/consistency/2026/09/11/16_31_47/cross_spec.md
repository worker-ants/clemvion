# Cross-Spec 일관성 검토 — target: `spec/5-system/` (--impl-done)

## 컨텍스트

`spec/5-system/` 델타는 0개 파일 — 이 PR 은 spec 을 바꾸지 않는다. 실제 변경은 `codebase/backend/src/modules/triggers/` 하위 3개 파일(diff 1010줄)로, `TriggersService` 의 chat-channel 검증 헬퍼 6개(T1: `assertChatChannelInputSafe`·`assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`·`stripChatChannelPlaintext`·`assertInboundSigningPlaintextByProvider`·`translateSetupChannelError`)를 신규 파일 `chat-channel-input-rules.ts` 의 순수 함수로 추출하는 **동작 보존 리팩터**다. `setupChatChannel`/`teardownChatChannel`(T2, secret 쓰기·ref 보존 계층)은 이번 PR 범위 밖이며 `TriggersService` 에 그대로 남는다(계획 문서의 애초 T1+T2 동시 추출안이 구현 중 T1-only 로 축소됐다).

프롬프트 번들이 `spec/5-system/15-chat-channel.md` 본문과 `<git diff>` 를 예산 초과로 절단했으므로, 워킹트리를 절대경로로 직접 `git diff origin/main...HEAD`, `Read`, `grep` 해 3개 코드 파일 전문과 관련 spec 9개 파일(`15-chat-channel.md`, `1-auth.md`, `2-api-convention.md`, `1-data-model.md`, `2-trigger-list.md`, `providers/{slack,discord,telegram}.md`, `conventions/{chat-channel-adapter,secret-store}.md`, `data-flow/14-chat-channel.md`)을 직접 대조했다. 또한 같은 작업의 `--impl-prep` 검토(`review/consistency/2026/09/11/14_59_33`)와 developer 의 plan(`plan/in-progress/impl-chat-channel-binder.md`)·durable 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)를 대조해, developer 가 이미 스스로 발견·기록한 항목과 내 독립 실측이 일치하는지 검증했다.

---

## 발견사항

- **[WARNING]** `assertInboundSigningPlaintextByProvider` 가 `TriggersService` 밖으로 옮겨져 provider spec 2곳의 클래스 귀속 서술이 사실과 어긋난다
  - target 위치: 코드 diff — `codebase/backend/src/modules/triggers/triggers.service.ts` 에서 `private assertInboundSigningPlaintextByProvider` 가 삭제되고, `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 의 module-level `export function assertInboundSigningPlaintextByProvider`로 이동(그 파일의 `export`, `TriggersService` 는 이제 이를 free function 으로 import 만 함).
  - 충돌 대상: `spec/4-nodes/7-trigger/providers/slack.md:275`, `spec/4-nodes/7-trigger/providers/discord.md:297` — 둘 다 *"Backend 의 `TriggersService.assertInboundSigningPlaintextByProvider` 가 트리거 생성 시점에 정규식 검증"* 이라고 **클래스 접두를 명시**해 인용한다.
  - 상세: 이동 후에도 `TriggersService.create()`/`update()` 가 이 함수를 호출하므로 **동작·호출 경로는 그대로 참**이지만, 심볼의 **정의처(소유 클래스)** 는 더 이상 `TriggersService` 가 아니다. 같은 함수를 클래스 접두 없이 인용하는 다른 3곳(`spec/2-navigation/2-trigger-list.md:155`, `spec/4-nodes/7-trigger/providers/discord.md:76`, `spec/5-system/15-chat-channel.md:432`)은 여전히 참이라 대상이 아니다 — 정확히 "`TriggersService.` 접두가 붙은 인용" 2곳만 stale.
  - 참고: developer 가 이미 실측으로 이 정확한 drift(2곳, 나머지 3곳은 비대상)를 발견해 `plan/in-progress/impl-chat-channel-binder.md`(§`--impl-prep` 이 설계를 바꿨다)에 근거를 남기고, `spec/` 쓰기 권한이 없어(자기-반증형 소정정 조건 1 불성립 — 그 문장은 이전 planner 턴이 씀) `plan/in-progress/spec-draft-nullable-notation-followups.md`(약 L2523 부근, "SPEC-DRIFT" 항목)에 planner 턴 대상으로 등재해 두었다. 독립 재실측 결과 그 분석은 정확하다 — 추가로 발견된 것 없음.
  - 제안: 별도 조치 불필요(이미 올바르게 처리됨) — 다음 planner 턴에서 `slack.md:275`·`discord.md:297` 를 *"`TriggersService` 가 `chat-channel-input-rules.ts` 의 `assertInboundSigningPlaintextByProvider` 를 호출해 트리거 생성 시점에 검증"* 형태로 호출자/정의처를 분리해 갱신할 것.

- **[INFO]** `spec/5-system/15-chat-channel.md` frontmatter `code:` 목록(정확한 파일 열거, glob 아님)에 신규 파일 `chat-channel-input-rules.ts` 가 미등재
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` (현재 `triggers.service.ts`·`triggers.controller.ts`·`chat-channel-token-rotator.service.ts`·`dto/chat-channel-config.dto.ts` 등만 열거).
  - 충돌 대상: 없음(신규 파일이 기존 다른 영역과 모순되는 것은 아님) — spec-impl-evidence 추적성 문제.
  - 상세: 이 gap 은 신규가 아니라 `--impl-prep`(`14_59_33` plan_coherence WARNING)에서 이미 "3라운드 연속 관측"으로 지적된 기존 미해소 gap(배선 파일 4개 미등재)의 연장이며, 이번 PR 로 `chat-channel-input-rules.ts` 한 파일이 더 추가된다. developer 의 followups 트래커에 새로 등재된 5개 항목 중 이 frontmatter 등재 자체를 명시적으로 다루는 항목은 없다(기존 L2194 항목은 4개의 다른 파일만 언급).
  - 제안: planner 턴에서 기존 4개 미등재 파일 + `chat-channel-input-rules.ts` 를 한 배치로 `code:` 에 추가할 것(developer 자신의 `spec-draft-nullable-notation-followups.md` L2194 항목과 병합 가능). Cross-spec 모순은 아니므로 INFO — plan_coherence/convention_compliance 축의 지적과 중복될 수 있음.

### 발견 없음 (관점 1~5, 6의 나머지)

- **데이터 모델**: `Trigger.config.chatChannel` JSON 구조·`chat_channel_*` 컬럼(health/last_error/setup_at/token_v2/rotated_at) 정의 무변경. 신규 엔티티·필드 없음.
- **API 계약**: 변경된 3개 파일 중 controller 는 없음 — endpoint·request/response shape 무변경. 새 함수는 기존 private 메서드를 그대로 옮긴 것으로 시그니처·호출 인자·throw 하는 예외 형태(`BadRequestException` code/details) 모두 동일(diff 로 확인 — 로직 재작성 없이 `this.` → 자유 함수 호출로만 치환, 새 주석 1건은 discord verify_key 502 기존 버그에 대한 캐너리 설명 추가일 뿐 동작 변경 아님).
- **요구사항 ID**: 신규 `R-CC-*`/`CCH-*` ID 부여 없음. 기존 ID(R-CC-21 등) 재정의 없음.
- **상태 전이**: `chat_channel_health` 등 상태 enum 변경 없음.
- **RBAC**: 인가 로직·권한 매트릭스(`spec/5-system/1-auth.md §3`) 무관.
- **계층 책임 (T2 관련)**: `--impl-prep` 라운드가 우려했던 `setupChatChannel`/`teardownChatChannel`(T2) 이전은 이번 PR 에 **포함되지 않았다** — 실제 diff 에서 두 메서드는 `TriggersService` 의 private 메서드로 그대로 남아 있고 내부에서 이동된 `translateSetupChannelError`/`stripChatChannelPlaintext` 를 자유 함수로 호출할 뿐이다. 따라서 그 우려가 지목했던 `data-flow/14-chat-channel.md:29`·`secret-store.md:146,357`·`chat-channel-adapter.md:369` 세 문서의 "`TriggersService.setupChatChannel` 소유" 서술은 **여전히 정확**하며 이번 diff 로 인한 drift 없음(전수 재확인 완료).

---

## 요약

이번 PR 은 `TriggersService` 내부의 chat-channel 입력-검증 로직(외부 협력자 0개)을 동작 변경 없이 `chat-channel-input-rules.ts` 로 옮기는 순수 리팩터이며, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 축에서는 cross-spec 충돌이 없다. 계층 책임(관점 6) 축에서 실질적 drift 가 하나 있으나 — `assertInboundSigningPlaintextByProvider` 를 `TriggersService.X` 로 명시 인용하는 `slack.md:275`·`discord.md:297` 두 곳이 이제 클래스 귀속만 부정확(동작·호출 경로는 참) — developer 가 이미 정확히 같은 범위로 발견해 `spec/` 쓰기 권한 밖이라는 이유로 durable 트래커(`spec-draft-nullable-notation-followups.md`)에 planner 턴 대상으로 올바르게 등재해 두었다. 독립 재실측 결과 그 분석(2곳 stale·3곳 비대상)에 추가·누락이 없다. 부수적으로 `15-chat-channel.md` frontmatter `code:` 목록에 신규 파일이 미등재된 점(기존에 이미 3라운드 관측된 gap 의 연장)을 INFO 로 덧붙인다. 두 항목 모두 이 PR 자체를 차단할 사유는 아니다.

## 위험도

LOW
