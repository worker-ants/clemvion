# Rationale 연속성 검토 결과

검토 모드: `--impl-done` (scope=`spec/5-system/15-chat-channel.md`, diff-base=`origin/main`)

대상 변경 요약: C-2 리팩토링 — `ChatChannelController` 삭제 + `rotateBotToken` 엔드포인트를 `TriggersController` 로 이전, `ChatChannelTokenRotatorService` 를 `chat-channel/` 모듈에서 `triggers/` 모듈로 이전, `ChatChannelModule` 의 `forwardRef(() => TriggersModule)` 순환 의존 제거.

---

### 발견사항

해당 없음. CRITICAL/WARNING 발견 없음.

---

### 상세 분석

#### 1. `rotate-bot-token` 엔드포인트 컨트롤러 이전 (`ChatChannelController` → `TriggersController`)

- `spec/5-system/15-chat-channel.md` 의 `## Rationale` 에는 `rotate-bot-token` 엔드포인트를 `ChatChannelController` 에 두어야 한다는 결정이 **존재하지 않는다**. spec 은 해당 컨트롤러 파일 자체를 단 한 번도 언급하지 않는다.
- spec §7 구현 파일 구조 트리 (`/spec/5-system/15-chat-channel.md` line 449-475) 에서 `chat-channel/` 모듈 목록에는 `chat-channel.controller.ts` 가 없다. 트리는 어댑터·dispatcher·registry 등 핵심 파일만 나열하며 controller 파일은 원래부터 미포함이었다.
- spec frontmatter `code:` 목록 (line 8) 은 이미 `codebase/backend/src/modules/triggers/triggers.controller.ts` 를 나열한다. 즉 spec 은 C-2 이전 이미 해당 파일을 코드 귀속으로 선언해 두었다.
- R-CC-18 (`rotate-bot-token` workspace 검증 데코레이터 통일) 에는 "옛 구현은 controller 인라인으로 X-Workspace-Id 헤더만 수동 검사" 라는 구현 이력이 있으나, 이는 어느 모듈이 컨트롤러를 소유하는지에 대한 invariant가 아니라 workspace 검증 방식에 대한 결정이다. 이전(C-2) 후에도 `@WorkspaceId()` 데코레이터 정책은 동일하게 유지되어 R-CC-18 을 위반하지 않는다.

#### 2. `ChatChannelTokenRotatorService` 를 `triggers/` 모듈로 이전

- `spec/5-system/15-chat-channel.md` CCH-SE-04-C 는 서비스 이름(`ChatChannelTokenRotatorService`)과 동작(매시간 BullMQ repeatable scheduler, `NotificationSecretRotatorService` 와 동일 패턴)만 정의하며, 어느 NestJS 모듈에 속해야 한다는 명시적 배치 결정이 없다.
- `spec/data-flow/0-overview.md` line 201 의 BullMQ 큐 카탈로그는 이미 `chat-channel-token-rotator` 큐의 소유 모듈을 `triggers.module.ts` 로 기록한다. spec 이 C-2 결과를 반영해 갱신되어 있음을 확인.
- `spec/data-flow/14-chat-channel.md` line 28 도 이미 `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` 경로를 참조하며 "C-2 로 triggers 모듈로 이전" 을 명시한다. spec 에 갱신 Rationale 가 존재한다.

#### 3. `forwardRef(() => TriggersModule)` 제거 — 합의된 원칙과의 정합

- `spec/5-system/4-execution-engine.md` Rationale "순환 의존 처리" 항은 `forwardRef` 를 "회피해야 할 안티패턴이 아님" 이라고 기술한 바 있으나, 이는 `ExecutionEngineService ↔ WebsocketService` 의 구조적 필수 순환에 대한 서술이다. 해당 항은 "`forwardRef` 를 써도 된다면 항상 써야 한다" 는 invariant가 아니다.
- C-2 는 구조적 필수가 아닌 부수적 배치 문제(rotate endpoint 위치)로 발생한 순환을 역방향 의존 2곳을 `triggers/` 모듈로 이전해 단방향으로 수렴시켰다. 이는 spec 이 기각한 방향이 아니라 spec 이 침묵한 선택이며, `forwardRef` 없이 단방향 import 를 달성하는 개선이다. 어떤 Rationale 에도 "chat-channel ↔ triggers 순환을 유지해야 한다" 는 결정이 없다.

#### 4. `spec/5-system/15-chat-channel.md` §7 파일 구조 트리 미갱신

- **[INFO]** spec §7 구현 파일 구조 트리의 `triggers/` 절에는 `triggers.service.ts`, `dto/create-trigger.dto.ts` 두 파일만 나열되어 있다. C-2 이후 추가된 `triggers.controller.ts` (rotate 엔드포인트 추가) 와 `chat-channel-token-rotator.service.ts` (모듈 이전) 가 미반영이다.
  - target 위치: `spec/5-system/15-chat-channel.md` §7 구현 파일 구조 (line 449-475)
  - 과거 결정 출처: spec §7 자체가 구현 파일 카탈로그이며, `data-flow/14-chat-channel.md` 는 이미 최신 경로를 반영함.
  - 상세: `data-flow/0-overview.md` 및 `data-flow/14-chat-channel.md` 는 이미 C-2 이후 상태를 반영하고 있으나, `spec/5-system/15-chat-channel.md §7` 트리는 구 상태의 부분 목록 그대로다.
  - 제안: `spec/5-system/15-chat-channel.md §7` 의 `triggers/` 항목에 `triggers.controller.ts` (rotate-bot-token 엔드포인트 추가)와 `chat-channel-token-rotator.service.ts` (C-2 이전, BullMQ queue processor) 를 추가하면 파일 구조 카탈로그가 현행화된다. 단 이 트리는 원래부터 선택적 목록이었으며(모든 파일을 망라하지 않음), data-flow spec 에 이미 정확한 경로가 기록되어 있으므로 가독성 개선 수준의 정합 작업이다.

---

### 요약

C-2 리팩토링(`rotate-bot-token` 엔드포인트를 `TriggersController` 로 이전, `ChatChannelTokenRotatorService` 를 `triggers/` 모듈로 이전, `forwardRef` 순환 제거)은 기존 spec `## Rationale` 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하지 않는다. spec 의 어떤 Rationale 도 `rotate-bot-token` 엔드포인트가 반드시 `ChatChannelController` 에 있어야 한다거나 `ChatChannelTokenRotatorService` 가 `chat-channel/` 모듈에 귀속되어야 한다는 결정을 명시한 바 없다. `data-flow/` spec 은 이미 C-2 이후 상태를 반영하고 있으며, `spec/5-system/15-chat-channel.md` frontmatter 의 `code:` 목록도 이미 `triggers.controller.ts` 를 나열한다. 순환 의존 `forwardRef` 에 관한 `4-execution-engine.md` 의 언급은 구조적 필수 순환에 한정된 맥락이었으므로 이번 제거와 충돌하지 않는다. 유일한 INFO 사항은 `spec/5-system/15-chat-channel.md §7` 파일 구조 트리의 `triggers/` 항목이 C-2 이전 파일들을 아직 나열하지 않아 카탈로그 완결성이 낮다는 점이며, data-flow spec 에 이미 최신 경로가 기록되어 있어 심각도는 낮다.

### 위험도

NONE

---

STATUS: OK
