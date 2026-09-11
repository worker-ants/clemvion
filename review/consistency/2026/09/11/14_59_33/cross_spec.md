# Cross-Spec 일관성 검토 — target: `spec/5-system/` (--impl-prep)

## 컨텍스트

이번 검토 대상은 spec draft 가 아니라 **현재 커밋된 `spec/5-system/` 상태**이며, 실제로 임박한
변경은 `plan/in-progress/impl-chat-channel-binder.md` (worktree `impl-chat-channel-binder-9d3f1e`,
`spec_impact: none`) 가 예고하는 **순수 코드 리팩터**다 — `TriggersService` 안의 chat-channel
도메인 로직(검증 helper 6개 = T1, `setupChatChannel`/`teardownChatChannel` = T2)을 `triggers/`
하위 신규 파일로 추출한다. 동작 변경은 없다고 선언되어 있으므로, 데이터 모델·API 계약·요구사항
ID·상태 전이·RBAC(관점 1~5) 충돌은 검토 범위에서 실질적으로 발생하지 않는다 — 아래 "발견 없음"
참조. 유일하게 실질적인 위험은 **관점 6 (계층 책임 충돌)** 이다.

프롬프트 예산 초과로 `spec/5-system/15-chat-channel.md` 를 포함한 15개 파일 본문이 잘려
있었기 때문에, 해당 파일과 연관 파일(`spec/conventions/chat-channel-adapter.md`,
`spec/conventions/secret-store.md`, `spec/data-flow/14-chat-channel.md`, `spec/1-data-model.md`,
`spec/2-navigation/2-trigger-list.md`)을 리포지토리에서 직접 `Read`/`grep` 해 분석했다.

---

## 발견사항

- **[WARNING]** `setupChatChannel` 추출 계획이 3개 타 영역 spec 의 "코드 진입점" 서술과 target 자신의 §7 구조도를 동시에 무효화하는데 `spec_impact: none` 이다
  - target 위치: `spec/5-system/15-chat-channel.md` §7 "구현 파일 구조" (L508-540) — `triggers/triggers.service.ts` 줄에 `# 기존 — setupChannel / teardownChannel / rotateBotToken 호출 추가` 주석. 요구사항 CCH-AD-02(§3.1, L54)·CCH-SE-04-C(L90) 도 같은 전제를 공유.
  - 충돌 대상 (target 밖 3개 영역):
    1. `spec/data-flow/14-chat-channel.md` L29 — "코드 진입점" 목록에 `codebase/backend/src/modules/triggers/triggers.service.ts — setupChatChannel / rotateBotToken / cleanupRotatedChatChannelTokens` 라고 **파일 경로 + 메서드명을 명시적으로 고정**.
    2. `spec/conventions/secret-store.md` L146, L357 — "`triggers.service.ts.setupChatChannel` 구현체" 라고 명시 인용 + §5.5 예시 코드 블록에서 `this.registry`/`this.secrets`/`this.repo` 를 쓰는 `async setupChatChannel(...)` 을 `TriggersService` 메서드로 예시.
    3. `spec/conventions/chat-channel-adapter.md` L369 — `revokeBotToken?` JSDoc 이 호출자를 `(TriggersService.setupChatChannel)` 로 명시 인용.
  - 상세: `plan/in-progress/impl-chat-channel-binder.md` 는 실측(코드 확인 결과 `codebase/backend/src/modules/triggers/triggers.service.ts:1101` `private async setupChatChannel`, `:1292` `private async teardownChatChannel`)을 근거로 이 두 메서드(T2, "secret 쓰기·ref 보존" 계층)를 **새 Nest provider** (`triggers/` 안, class 미정이나 `TriggersService` 가 아님)로 옮긴다고 명시한다. 반면 `rotateBotToken`/`cleanupRotatedChatChannelTokens`(§7 이 이미 이전 완료로 기록한 C-2 계열)는 `TriggersService` 에 남는다. 그 결과:
    - `setupChatChannel` 을 명시적으로 인용하는 위 3개 타 영역 문서 + target 자신의 §7 목록은 리팩터 이후 **파일·클래스 경로가 사실과 어긋난다.**
    - `spec-code-paths.test.ts` 빌드 가드는 `rotateBotToken` 등 다른 메서드가 여전히 `triggers.service.ts` 에 남아 glob 을 만족시키므로 **통과한다** — 즉 이 drift 는 어떤 자동 가드도 잡지 못하는 **조용한(silent) SoT 붕괴**다 (`spec/conventions/spec-impl-evidence.md` §4 R-1 이 이미 지적한 "넓은 glob 만 통과시키면 실제로는 아무것도 가리키지 않는다" 패턴과 같은 계열).
    - 새로 생성되는 파일(T1 순수 함수 모듈 + T2 provider)은 `spec/5-system/15-chat-channel.md` frontmatter `code:` 리스트(개별 파일 나열 방식, glob 아님)에도, 위 3개 문서 어디에도 등재 계획이 없다 — spec-impl-evidence 추적에서 완전히 벗어난 코드가 생긴다.
  - 제안: 이 PR 의 범위를 아래 둘 중 하나로 명시적으로 결정한다.
    (a) `spec_impact: none` 을 철회하고 같은 PR 에서 §7 구조도(target) + `data-flow/14-chat-channel.md` L29 + `secret-store.md` L146/L357 + `chat-channel-adapter.md` L369 를 새 클래스/파일명으로 동기 갱신, 또는
    (b) 정말 `spec_impact: none` 을 유지하려면 plan 에 "위 4개 문서는 구현 세부(클래스명)까지 추적하지 않는 서술로 간주하고 갱신하지 않는다"는 근거를 명시하고, 후속 문서 동기화 항목을 트래커에 등록한다.
    현재처럼 **아무 언급 없이 `spec_impact: none`** 으로 진행하면, 다음에 이 코드를 읽는 사람이 spec 을 신뢰해 `triggers.service.ts` 만 열어보고 `setupChatChannel` 을 못 찾는 상황이 된다.

### 발견 없음 (관점 1~5)

- **데이터 모델**: 리팩터가 건드리는 것은 코드 파일 배치뿐, `Trigger.config.chatChannel` JSON 구조·`chat_channel_*` 컬럼 5종 정의는 무변경. `spec/1-data-model.md` §2.8 과 `spec/5-system/15-chat-channel.md` §4 사이에 기존 문구 그대로 정합.
- **API 계약**: `POST /api/triggers/:id/chat-channel/rotate-bot-token` 등 엔드포인트·request/response shape 변경 없음(plan 자체가 "동작 보존"을 유일한 주장으로 선언).
- **요구사항 ID**: `CCH-*` prefix 는 `spec/5-system/15-chat-channel.md` 밖에서 전부 **참조**(하이퍼링크) 용도로만 재등장하며, 재정의(다른 의미의 동일 ID 부여) 사례 없음 — grep 전수 확인.
- **상태 전이**: `chat_channel_health` (`unknown`/`healthy`/`degraded`) 는 `notification_health` 와 값 집합이 같다는 사실이 `spec/1-data-model.md` L252 에 이미 자기-인지 각주로 기록되어 있고 이번 변경과 무관 — 기존에 이미 승인된 상태로 신규 충돌 아님.
- **RBAC**: 이번 리팩터는 인가 로직·권한 매트릭스를 변경하지 않는다. `spec/5-system/1-auth.md` §3 RBAC 매트릭스와 무관.

---

## 요약

target 범위(`spec/5-system/`)에서 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 관점의 신규
cross-spec 충돌은 없다 — 이번 작업이 동작 보존을 유일한 주장으로 삼는 순수 코드 이동이기
때문이다. 다만 계층 책임(관점 6) 에서 실질적인 문제를 하나 확인했다: target 문서 자신의 §7
아키텍처 서술과 `spec/data-flow/14-chat-channel.md`·`spec/conventions/secret-store.md`·
`spec/conventions/chat-channel-adapter.md` 세 타 영역이 `setupChatChannel` 을
`TriggersService`/`triggers.service.ts` 소유로 명시 고정하고 있는데, 진행 중인 plan 이 그 메서드를
다른 provider 로 옮기면서도 `spec_impact: none` 을 선언해 두었다. 이 drift 는 build 가드가 잡지
못하는 조용한 형태라 이번 impl-prep 단계에서 명시적으로 처분(동기 갱신 또는 의도적 예외 기록)을
결정해 두는 것이 안전하다.

## 위험도

MEDIUM
