# 신규 식별자 충돌 검토 결과

검토 대상:
- `spec/5-system/15-chat-channel.md`
- `spec/conventions/chat-channel-adapter.md`
- `spec/4-nodes/7-trigger/providers/telegram.md`

---

## 발견사항

### [INFO] `renderNode` 함수명 — 프론트엔드 테스트 로컬 헬퍼와 동일 이름

- **target 신규 식별자**: `ChatChannelAdapter.renderNode(event, config)` — `spec/conventions/chat-channel-adapter.md` §1의 6함수 인터페이스 중 하나
- **기존 사용처**: `codebase/frontend/src/components/editor/canvas/__tests__/custom-node.test.tsx:205` — `function renderNode(overrides, options?)` (테스트 로컬 헬퍼, 스코프 한정)
- **상세**: 기존 `renderNode` 는 테스트 파일 내부에서만 유효한 로컬 함수로, 백엔드 어댑터 인터페이스와 직접 충돌하지는 않는다. 그러나 이름이 같아 코드 검색 시 혼동이 생길 수 있다 (백엔드 그래픽 렌더 vs. 어댑터의 EIA→채널 변환). 스코프가 완전히 분리되어 있어 런타임 충돌은 없다.
- **제안**: 현행 유지 가능. 코드 내 검색 시 혼동을 줄이려면 어댑터 함수를 `renderChannelMessage` 또는 `toChannelMessages` 로 명명하는 것을 검토할 수 있으나, spec 상 충돌 위험은 낮다.

---

### [INFO] `SetupResult` 인터페이스명 — 프론트엔드 e2e 테스트와 동일 이름

- **target 신규 식별자**: `SetupResult` — `spec/conventions/chat-channel-adapter.md` §2.4에 정의된 `setupChannel()` 반환 타입
- **기존 사용처**: `codebase/frontend/e2e/profile/profile-edit.spec.ts:41` — `interface SetupResult` (e2e 테스트 내부 로컬 타입)
- **상세**: 프론트엔드 e2e 테스트의 `SetupResult`는 파일 로컬 스코프로, 백엔드 어댑터 인터페이스와 패키지 경계가 완전히 분리된다. 런타임 충돌 없음. 다만 백엔드 어댑터 구현 시 동일 이름을 export 하면, 두 코드베이스가 공유 패키지(`codebase/packages/`)를 둘 경우 충돌 가능성 존재 — 현재는 공유 타입 패키지가 없으므로 문제없음.
- **제안**: 현행 유지 가능.

---

### [INFO] `InteractionRequestContext.scope` 신규 선택 필드 — 기존 `Integration.scope` 와 이름 충돌 가능성

- **target 신규 식별자**: `InteractionRequestContext.scope?: 'in_process_trusted'` — `spec/5-system/15-chat-channel.md` §5.1에서 어댑터의 인터랙션 서비스 직접 호출 시 token 검증 skip을 위한 optional 필드 도입
- **기존 사용처**: `codebase/backend/src/modules/integrations/dto/integration.dto.ts:140,250,366` — `scope: 'personal' | 'organization'` (Integration DTO의 `scope` 필드), `codebase/backend/src/modules/integrations/integration-oauth.service.ts:100` 동일
- **상세**: 두 `scope` 필드는 완전히 다른 엔티티(`InteractionRequestContext` vs `Integration`)에 속해 직접 충돌하지는 않는다. 그러나 `scope`라는 단어가 코드베이스에서 이미 "Integration 가시성 범위(personal/organization)"와 "EIA 토큰 family(`iext`/`itk`)" 두 가지 의미로 혼용되고 있는데, 세 번째 의미("trusted caller 여부")가 추가된다. 검색이나 리뷰 시 혼동 여지가 있다.
- **제안**: `InteractionRequestContext` 의 신규 필드를 `trustedCaller?: true` 또는 `callerTrust?: 'in_process'`로 명명하면 의미가 명확해지고 Integration의 `scope`와 구분이 쉬워진다. 변경은 선택이며 target spec의 기술 수준에서 강제 사항은 아니다.

---

### [INFO] `sendMessage` 메서드명 — 워크플로우 어시스턴트 컨트롤러와 동일 이름

- **target 신규 식별자**: `ChatChannelAdapter.sendMessage(message, config)` — `spec/conventions/chat-channel-adapter.md` §1의 6함수 인터페이스 중 하나
- **기존 사용처**: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:150` — `async sendMessage(...)` (워크플로우 어시스턴트 SSE 엔드포인트 핸들러)
- **상세**: 두 `sendMessage`는 각각 다른 클래스(`workflow-assistant.controller.ts`의 컨트롤러 메서드 vs. 백엔드 어댑터 인터페이스 구현 메서드)로 완전히 다른 도메인이다. IDE 에서 전역 검색 시 결과가 혼재되지만, 런타임 충돌 없음.
- **제안**: 현행 유지 가능.

---

## 검토 결과 — 충돌 없음 항목

아래 식별자는 기존 사용처와 충돌하지 않음을 확인:

| 항목 | 결론 |
|---|---|
| `CCH-*` 요구사항 ID prefix | 기존 spec 전체에서 미사용. 신규 도입 충돌 없음 |
| `spec/5-system/15-chat-channel.md` 파일 경로 | `spec/5-system/` 에 14까지 존재, 15는 신규. 번호 충돌 없음 |
| `spec/conventions/chat-channel-adapter.md` 파일 경로 | `spec/conventions/` 에 동일 파일명 미존재. 충돌 없음 |
| `spec/4-nodes/7-trigger/providers/telegram.md` 파일 경로 | 디렉토리 및 파일 신규 생성. `_overview.md`와 함께 이미 worktree에 존재하며 번호 prefix 없는 네이밍 컨벤션 적용 — 기존 `0-common.md`, `1-manual-trigger.md` 와 공존 적합 |
| `ChatChannelAdapter` 인터페이스명 | spec/codebase 어디에도 동일 이름 미존재 |
| `ChannelUpdate`, `ChannelMessage`, `ChannelButton` 타입명 | spec/codebase 어디에도 동일 이름 미존재 |
| `ChannelAdapterRegistry` 인터페이스명 | spec에서 `spec/5-system/12-webhook.md`에서 참조용으로만 등장, 정의는 신규 컨벤션. 코드베이스 미존재 |
| `ChatChannelConfig` 타입명 | 신규 도입. 충돌 없음 |
| `EiaEvent` union 타입명 | spec/codebase 어디에도 동일 이름 미존재 |
| `KeyboardHint` 타입명 | spec/codebase 어디에도 동일 이름 미존재 |
| `chat_channel_health` / `chat_channel_last_error` / `chat_channel_setup_at` / `chat_channel_token_v2` / `chat_channel_rotated_at` 컬럼명 | codebase에 미존재. `notification_health` 등 기존 컬럼과 prefix 달라 충돌 없음 |
| `POST /api/triggers/:id/chat-channel/rotate-bot-token` 엔드포인트 | 기존 triggers 엔드포인트 목록(`/api/triggers/:id`, `/:id/toggle`, `/:id/history`)에 미존재. EIA의 `/notification/rotate-secret`, `/interaction/revoke-token` 과도 경로 다름 |
| `chat-channel:{triggerId}:{conversationKey}` Redis key prefix | 기존 EIA의 InteractionToken(`interaction-token:...`), ChannelConversation 등과 prefix 상이. `:`-분리 계층형으로 충돌 없음 |
| `Trigger.config.chatChannel` JSON 필드명 | 기존 `config.notification`, `config.interaction` 서브필드와 이름 다름. 충돌 없음 |
| `ackInteraction` 메서드명 | spec/codebase 어디에도 동일 이름 미존재 |
| `setupChannel` / `teardownChannel` 메서드명 | spec에서 `spec/1-data-model.md`의 설명문에서만 참조, codebase에 미존재 |

---

## 요약

세 target 문서가 도입하는 신규 식별자 중 CRITICAL 또는 WARNING 등급의 충돌은 발견되지 않았다. `renderNode`, `SetupResult`, `sendMessage` 세 이름이 프론트엔드 테스트 또는 워크플로우 어시스턴트 컨트롤러의 로컬 스코프 식별자와 이름이 겹치지만, 모두 다른 모듈 경계 안에 있어 런타임 또는 타입 충돌을 유발하지 않는다. `InteractionRequestContext.scope` 의 세 번째 의미 추가는 혼동 여지가 있으나 기존 두 `scope` 사용처와 엔티티가 달라 충돌이 아닌 명명 명확화 권장 수준이다. 요구사항 ID, 파일 경로, API 엔드포인트, Redis 키, DB 컬럼, TypeScript 인터페이스 등 핵심 식별자는 모두 충돌 없이 신규 도입 가능하다.

---

## 위험도

LOW
