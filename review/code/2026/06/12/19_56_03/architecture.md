# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [WARNING] HooksService 단일 책임 원칙 위반 — Chat Channel 오케스트레이션 과부하
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.ts` — `handleChatChannelWebhook` 메서드 (약 380줄)
- 상세: `HooksService`가 일반 webhook 처리와 chat channel inbound 처리를 단일 클래스에서 담당한다. `handleChatChannelWebhook` 메서드 내부에 인증(verify), parseUpdate, enrichInbound, 대화 상태 조회, execution 상태 조회, /help /cancel /start 명령 분기, form 다단계 처리, `getActiveExecutionStatus` 분기(CCH-CV-03), `sendExecutionStillRunningNotice`, `forwardToInteractionService`, `reNoiseFormModal`, `handleFormStep` 등 10개 이상의 서로 다른 책임이 단일 private 메서드 체인으로 집중되어 있다. 이번 변경(`getActiveExecutionStatus` 추출 + `sendExecutionStillRunningNotice` 추출)이 올바른 방향이나, 근본적으로 Chat Channel inbound 오케스트레이션은 별도 `ChatChannelWebhookHandler` 서비스로 분리되어야 응집도가 높아진다.
- 제안: `ChatChannelWebhookHandler` (또는 `ChatChannelInboundHandler`) 서비스를 `chat-channel` 모듈에 배치하고, `HooksService`는 webhook/chat-channel 판별 후 해당 핸들러로 위임만 수행하도록 분리. 현재 변경의 `getActiveExecutionStatus` · `sendExecutionStillRunningNotice` private 메서드 추출은 그 방향의 중간 단계로 긍정적.

### [WARNING] `executionsService['executionRepository']` — 인터페이스 분리·의존성 역전 위반
- 위치: `hooks/hooks.service.ts:1650` — `getActiveExecutionStatus`
- 상세: `this.executionsService['executionRepository']?.findOne?.(...)` 패턴은 `ExecutionsService` 내부 구현 세부사항(private repository 필드)에 string-indexed 접근으로 직접 의존한다. 이는 캡슐화·인터페이스 분리·의존성 역전 원칙을 모두 위반한다. `ExecutionsService`가 공개 메서드(`findById`, `getStatus`, `isTerminal` 등)를 노출하지 않는 것이 근본 원인이며, 테스트에서도 동일하게 `executionRepository` 를 `moduleRef.get(ExecutionsService)` 로 꺼내 직접 모킹(`execRepo.findOne.mockResolvedValue`)해야 하는 부자연스러움이 발생하고 있다.
- 제안: `ExecutionsService`에 `getActiveStatus(executionId: string): Promise<ExecutionStatus | null>` 형태의 공개 메서드를 추가하고, `HooksService`는 이를 통해 의존. 이번 변경에서 `getActiveExecutionStatus` private 메서드를 추출한 것은 좋은 출발이지만, 궁극적으로 책임은 `ExecutionsService` 쪽에 있어야 한다.

### [INFO] `ChatChannelController` 반환 타입 — `Awaited<ReturnType<...>>` structural coupling
- 위치: `chat-channel/chat-channel.controller.ts:226`
- 상세: `Promise<Awaited<ReturnType<TriggersService['rotateBotToken']>>>` 반환 타입은 Controller가 Service 구현 타입에 구조적으로 직접 결합된다. Controller 레이어는 별도 Response DTO를 정의하는 것이 레이어 책임 분리에 맞다. 현재 방식은 `TriggersService.rotateBotToken` 반환 타입이 바뀌면 Controller 타입이 자동으로 변경되므로, 의도치 않은 API 계약 변경 위험이 있다. 단, 테스트(`ROTATE_RESULT` 공유)와 타입 동기를 자동으로 보장한다는 실용적 장점도 있으므로 팀 컨벤션에 따라 판단.
- 제안: `RotateBotTokenResponseDto` 혹은 명시적 인터페이스를 Controller 레이어에 정의해 API 계약을 안정화. TriggersService는 해당 DTO를 반환하거나, 별도 매핑 레이어 추가.

### [INFO] `handleFormStep` — 매직 상수 + 미완성 stub 코드의 아키텍처 노출
- 위치: `hooks/hooks.service.ts:1583` — `MAX_FIELDS_HEURISTIC = 10`
- 상세: `MAX_FIELDS_HEURISTIC` 상수와 `field_<idx>` 키 패턴, "v1 stub" 주석이 서비스 레이어에 직접 노출되어 있다. 이는 미완성 설계(fieldsCatalog 미저장)가 서비스 구현에 hard-coded된 상태로, 확장 시 코드 변경 없이는 다른 동작을 지원하기 어렵다. 이번 PR 변경 범위는 아니지만, `handleFormStep`의 설계 부채가 `HooksService` 클래스 크기를 불필요하게 키우고 있다.
- 제안: PR-E(fieldsCatalog) 구현 시 `FormStepHandler` 또는 `ChatChannelFormDispatcher` 분리를 함께 고려.

### [INFO] `maybeNotifyIgnored` — Telegram 특화 raw body 파싱이 범용 핸들러에 하드코딩
- 위치: `hooks/hooks.service.ts:1501-1527` — `maybeNotifyIgnored`
- 상세: `message.chat.id`, `message.from.is_bot`, `chat.type` 등 Telegram 메시지 구조를 직접 파싱하는 로직이 `HooksService` 레이어에 있다. Chat Channel adapter 추상화(`ChatChannelAdapter` 인터페이스)의 취지는 provider 특화 파싱을 adapter 내부로 캡슐화하는 것이다. 이번 변경 범위 밖이지만, 이 패턴이 확장되면 provider별 분기가 `HooksService`에 누적된다.
- 제안: `ChatChannelAdapter` 인터페이스에 `shouldNotifyIgnored(rawBody: unknown): { conversationKey: string; reason: 'group' | 'unsupported' } | null` 메서드 추가를 고려.

### [INFO] `TriggersService.rotateBotToken` 반환 타입 인라인 정의
- 위치: `triggers/triggers.service.ts:858-864`
- 상세: `rotateBotToken`의 반환 타입이 인라인 객체 리터럴로 정의되어 있다. `TriggerChatChannelHealth`를 import하여 사용하는 점은 좋으나, 반환 타입 전체를 named interface/type(`RotateBotTokenResult`)으로 export하면 Controller, 테스트, 다른 모듈에서 재사용할 수 있다.
- 제안: `export interface RotateBotTokenResult { rotatedAt: string; triggerId: string; chatChannelHealth: TriggerChatChannelHealth; botIdentity: { botId: number; username: string; teamId?: string } | null; }` 정의 후 재사용.

## 요약

이번 변경(CCH-CV-03 (b) 분기 구현 + §5.4 rotate-bot-token 응답 확장)은 spec 요구사항을 정확하게 구현하였고, `isActiveExecution` boolean을 `getActiveExecutionStatus` status-aware로 올바르게 확장하였다. 아키텍처 관점에서 가장 주목할 문제는 `HooksService`에 Chat Channel inbound 오케스트레이션 책임이 과도하게 집중되어 있다는 구조적 부채이며, 특히 `executionsService['executionRepository']` 직접 접근은 인터페이스 분리·캡슐화 원칙을 위반한다. 이번 PR에서 추가된 `getActiveExecutionStatus` · `sendExecutionStillRunningNotice` private 메서드 추출은 책임 분리 방향으로의 올바른 중간 단계이나, 궁극적으로 `ExecutionsService` 공개 API 추가와 Chat Channel webhook 핸들러 분리가 필요하다. Controller 레이어의 `ReturnType<>` 직접 결합과 인라인 반환 타입 정의는 낮은 위험도의 개선 사항이다.

## 위험도

MEDIUM
