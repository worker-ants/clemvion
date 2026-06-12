# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: chat-channel-gaps — CCH-CV-03(b) + §5.4 rotate-bot-token 응답 확장

---

## 발견사항

### [WARNING] `handleChatChannelWebhook` 함수 과다 길이 — 다중 책임 혼재
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` — `handleChatChannelWebhook` (lines ~1040–1417, 약 370 라인)
- 상세: 단일 private 메서드가 (1) provider 인증, (2) 비활성 단락, (3) Slack/Discord handshake, (4) parseUpdate/enrich, (5) /help·/cancel 명령, (6) open_form_modal, (7) form_submission (락·검증·EIA submit 포함), (8) 활성 execution 인터랙션 forwarding, (9) 새 execution 시작까지 약 9개 책임을 수행한다. 이번 변경(`CCH-CV-03 (b)` 분기 추가)이 이 메서드에 또 하나의 분기를 추가하여 복잡도가 더 높아졌다. 순환 복잡도가 대단히 높아 버그 수정·기능 추가 시 인지 부담이 크다.
- 제안: 명령별 핸들러(`handleCancelCommand`, `handleFormSubmission`, `dispatchActiveExecution` 등)를 private 메서드로 추출하면 각 책임의 경계가 명확해진다. 단, 이번 변경 범위에서 즉각 리팩터링을 강제할 필요는 없으나 후속 PR 기술 부채로 등록 권장.

### [WARNING] `executionsService['executionRepository']` 문자열 인덱스 접근 — 캡슐화 위반
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` `getActiveExecutionStatus` (~line 1650)
- 상세: `this.executionsService['executionRepository']?.findOne?.(...)` 는 private 멤버에 문자열 키로 우회 접근한다. `ExecutionsService` 의 내부 구조가 변경되면 컴파일 오류 없이 런타임에서 조용히 실패하는 취약 지점이다. 이 패턴은 이번 변경 전 `isActiveExecution` 에서도 동일하게 존재했고 이번 변경도 동일 패턴을 유지했다.
- 제안: `ExecutionsService` 에 `getExecutionStatus(id: string): Promise<ExecutionStatus | null>` 같은 public 메서드를 추가하고 해당 메서드를 통해 조회하도록 리팩터링. 이번 변경에서 `isActiveExecution` 을 `getActiveExecutionStatus` 로 대체한 시점이 리팩터링 적기였으나 누락됨.

### [WARNING] `handleChatChannelWebhook` 반환 타입 인라인 객체 리터럴 — 타입 중복
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` `handleChatChannelWebhook` 시그니처 (~line 1045)
- 상세: 반환 타입이 `{ executionId: string; status?: 'pending'; challenge?: string; discordPing?: boolean; interactionHttpResponse?: unknown }` 인라인 리터럴로 선언되어 있다. `handleWebhook` 의 반환 타입과 일부 겹치지만 별도 인라인으로 관리되어 동기화 위험이 있다.
- 제안: `ChatChannelWebhookResult` 같은 명명 타입(또는 인터페이스)으로 추출 후 두 메서드에서 공유.

### [INFO] `getActiveExecutionStatus` — `isTerminal` 조건 중복
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` `getActiveExecutionStatus` (~line 1657)
- 상세: `COMPLETED | FAILED | CANCELLED` terminal 상태 목록이 이 메서드에 하드코딩되어 있다. 동일한 terminal 상태 목록이 코드베이스 다른 위치에서도 반복될 가능성이 높다. `ExecutionStatus` enum 자체 또는 별도 유틸(`isTerminalStatus(s: ExecutionStatus): boolean`)로 단일화하면 terminal 상태 추가 시 한 곳만 변경하면 된다.
- 제안: `execution.entity.ts` 또는 공용 유틸에 `TERMINAL_STATUSES` 상수 또는 `isTerminalStatus` 헬퍼 추출 고려.

### [INFO] `sendExecutionStillRunningNotice` — `maybeNotifyIgnored` 와 구조적 중복
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` `sendExecutionStillRunningNotice` (~line 1670) vs `maybeNotifyIgnored` (~line 1496)
- 상세: 두 메서드 모두 `adapter.sendMessage({ conversationKey, body: { kind: 'text', text } }, config)` 패턴을 try/catch + logger.warn 로 감싼다. `sendExecutionStillRunningNotice` 가 신설되며 이 패턴이 한 번 더 복제됐다.
- 제안: `trySendText(conversationKey, text, config, adapter, logTag)` 같은 private 헬퍼로 추출하면 try/catch 중복이 제거됨.

### [INFO] `ROTATE_RESULT` 상수 내 `chatChannelHealth: 'healthy' as const` — 테스트 픽스처 타입 노이즈
- 위치: `/codebase/backend/src/modules/chat-channel/chat-channel.controller.spec.ts` line 39
- 상세: `'healthy' as const` 는 필요하지만 테스트 픽스처 객체에서 as-const 단언이 필요한 이유가 주석 없이 인라인으로 등장한다. 향후 타입이 변경될 때 이 단언이 노이즈인지 필수인지 구분하기 어렵다.
- 제안: 픽스처 위에 간단한 주석 추가("컨트롤러 반환 타입이 TriggerChatChannelHealth literal union 이므로 as const 필요") 또는 픽스처를 타입 명시(`const ROTATE_RESULT: RotateBotTokenResult = { ... }`)로 변경.

### [INFO] `Awaited<ReturnType<TriggersService['rotateBotToken']>>` — 컨트롤러 반환 타입 간접 참조
- 위치: `/codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` line 169 (변경 후)
- 상세: `Promise<Awaited<ReturnType<TriggersService['rotateBotToken']>>>` 패턴은 service 반환 타입을 controller 가 구조적으로 재사용한다는 점에서 단일 진실 원칙에 부합한다. 그러나 `Awaited<ReturnType<...>>` 이중 unwrap이 처음 읽는 개발자에게 의도가 불명확할 수 있다.
- 제안: `TriggersService` 의 반환 타입을 named export(`export type RotateBotTokenResult = ...`)로 추출하면 컨트롤러에서 `Promise<RotateBotTokenResult>` 로 더 명확해진다. 강제 수준은 아님.

### [INFO] 테스트 내 `moduleRef: any` 타입
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.spec.ts` line 338
- 상세: `let moduleRef: any` 는 타입 안전성이 없다. `execRepo` 접근 시(`moduleRef.get(ExecutionsService) as {...}`) 수동 타입 캐스팅이 복잡해진다.
- 제안: `let moduleRef: TestingModule` 으로 변경하면 `.get()` 호출에 TypeScript 지원이 생긴다. 기존 패턴을 그대로 따른 것이므로 이번 변경 범위에서 필수는 아님.

---

## 요약

전체적으로 이번 변경은 spec 요구사항을 정확히 구현하고 있으며, 명명(`getActiveExecutionStatus`, `sendExecutionStillRunningNotice`)도 의도를 잘 전달한다. 주요 유지보수성 위험은 (1) 이미 거대한 `handleChatChannelWebhook` 에 분기가 하나 더 추가되어 복잡도가 누적된 것과, (2) `executionsService['executionRepository']` 문자열 인덱스 접근이 private 캡슐화를 우회하여 향후 리팩터링 시 조용한 런타임 실패를 유발할 수 있는 것이다. 두 문제 모두 이번 변경이 최초 도입한 것이 아니라 기존 패턴을 유지·확장한 결과이지만, `isActiveExecution` → `getActiveExecutionStatus` 로 대체한 이번 변경이 캡슐화 수정의 적기였다. 나머지 발견사항은 INFO 등급으로 즉각 대응 의무는 없다.

---

## 위험도

MEDIUM
