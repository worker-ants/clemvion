# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] `execRepo` 접근 패턴 — private 필드 브래킷 접근을 테스트에서 직접 캐스팅
- 위치: `hooks.service.spec.ts` lines 277-283, 318-323, 350-357, 383-390
- 상세: 4개의 신규 테스트 케이스가 동일 패턴으로 `moduleRef.get(ExecutionsService)` 를 복잡한 타입 캐스트로 unwrap 해 `executionRepository.findOne` 을 직접 mock 한다. 이 패턴이 테스트 내 4회 중복되어 있고, 프로덕션 코드의 `this.executionsService['executionRepository']` 브래킷 접근에 강하게 결합되어 있다. 리팩토링 시 private 필드명이 바뀌면 테스트가 조용히 실패(mock 미적용 → `findOne` undefined → `.catch(() => null)` 로 흡수)할 위험이 있다.
- 제안: `execRepo` 설정 로직을 `beforeEach` 또는 helper 함수로 추출해 중복 제거. 또는 `ExecutionsService` 에 `getExecutionStatus(id)` 공개 메서드를 두어 브래킷 접근 의존을 제거하면 mock 도 단순해진다.

### [INFO] CCH-CV-03 (b) 테스트 — `button_callback` / `contact_share` / `file_upload` 케이스 미포함
- 위치: `hooks.service.spec.ts` 259-299 (CCH-CV-03 b 테스트)
- 상세: 프로덕션 분기 `if (activeStatus !== ExecutionStatus.WAITING_FOR_INPUT)` 는 `text_message` 외에도 `button_callback`, `contact_share`, `file_upload` command kind 에 공통 적용된다 (`hooks.service.ts` line 1036-1039). 신규 테스트는 `text_message` 케이스만 커버한다. 다른 command kind 에서도 동일하게 `executionStillRunning` 이 발송되고 `ignored` 를 반환하는지 확인이 없다.
- 제안: `button_callback` 케이스를 최소 1개 추가 테스트하거나, 기존 `text_message` 케이스에 파라미터화된 테스트(각 command kind)를 적용한다.

### [INFO] `sendExecutionStillRunningNotice` — `languageHints.executionStillRunning` 커스텀 문구 분기 미테스트
- 위치: `hooks.service.ts` lines 1363-1364 (config.languageHints?.executionStillRunning ?? 기본값)
- 상세: `sendExecutionStillRunningNotice` 의 `languageHints?.executionStillRunning` 커스텀 문구 경로가 테스트되지 않는다. `maybeNotifyIgnored` 와 동일 패턴의 언어 힌트 분기인데, 기본값 경로만 확인된다.
- 제안: config 에 `languageHints.executionStillRunning` 을 설정했을 때 해당 문구가 `sendMessage` body 에 전달되는지 단위 테스트 1건 추가.

### [INFO] `getActiveExecutionStatus` — `undefined` vs `null` 반환 경로 명시적 검증 없음
- 위치: `hooks.service.ts` lines 1337-1348
- 상세: `execution` 이 `undefined` 인 경우(findOne 이 undefined 반환 시)와 `null` 인 경우 모두 `!execution` 으로 처리해 `null` 을 반환한다. DB 조회가 `undefined` 를 반환하는 경우는 현재 "DB 오류 → catch → null" 테스트로 간접 커버되나, findOne 이 정상적으로 `undefined` 를 반환(execution 미존재)하는 케이스는 explicit 테스트가 없다. 이 경우 `hasActiveExecution = false` → 새 execution 시작 경로가 맞는지 확인이 필요하다.
- 제안: `conversationService.lookup` 이 `executionId` 를 가진 state 를 반환하지만 `executionRepository.findOne` 이 `undefined` 를 반환(stale execution ID)하는 케이스 테스트 추가.

### [INFO] `TriggersService.rotateBotToken` 신규 필드 — `chatChannelHealth` 가 항상 `'healthy'` 하드코딩 검증 미완
- 위치: `triggers.service.spec.ts` lines 1479-1498
- 상세: 신규 테스트가 `chatChannelHealth: 'healthy'` 를 `expect.objectContaining` 으로 검증하지만, 현재 구현이 항상 `'healthy'` 를 하드코딩 반환하는 것을 검증하는 것에 그친다 (`triggers.service.ts` line 1565). 향후 `setupChannel` 실패 분기(예외 전파 외, 부분 성공) 또는 health 상태가 다른 값이 될 경우에 대한 테스트 명세가 없다. 현 시점에서는 spec §5.4 "성공 시 healthy" 계약을 명확히 표현하는 수준이므로 INFO.
- 제안: 테스트 명칭에 "(setupChannel 성공 시 항상 'healthy')" 를 명시해 의도를 문서화한다.

### [INFO] `ChatChannelController` 반환 타입 변경 — swagger ApiResponse 데코레이터 미업데이트 가능성
- 위치: `chat-channel.controller.ts` line 169 (`Promise<Awaited<ReturnType<TriggersService['rotateBotToken']>>>`)
- 상세: 반환 타입을 `ReturnType` 으로 위임 전환했는데, `@ApiResponse` 데코레이터가 Swagger 문서에 명시적 응답 스키마를 반영하는지 컨트롤러 전체 파일에서 확인이 필요하다. 단위 테스트 범위가 아니지만, OpenAPI 계약 드리프트를 방지하려면 응답 DTO 타입이 swagger에도 등록되어야 한다.
- 제안: `@ApiResponse({ type: RotateBotTokenResponseDto })` 등의 명시적 DTO 등록 여부를 확인한다. (테스트 관점: e2e 또는 swagger 스펙 테스트에서 응답 스키마 검증 추가 검토)

## 요약

이번 변경의 테스트 커버리지는 전반적으로 양호하다. `HooksService` 의 CCH-CV-03 (b) 분기(running/pending 상태 안내+무시)에 대해 4가지 신규 테스트(정상·pending 동등·DB 오류·sendMessage 실패 내성)가 추가되어 핵심 경로를 커버하며, `TriggersService.rotateBotToken` 의 신규 응답 필드(triggerId/chatChannelHealth/botIdentity)에 대해서도 성공·botIdentity 미반환 케이스가 명확히 테스트된다. 주요 리스크는 `execRepo` 브래킷 접근 패턴의 4중 중복으로 인한 유지보수 취약성과, `button_callback`/`contact_share`/`file_upload` command kind 에서의 CCH-CV-03 (b) 분기 커버리지 누락이다. 이 두 항목을 보완하면 테스트 신뢰도가 높아진다. 발견사항 전체가 INFO 등급이므로 블로킹 이슈는 없다.

## 위험도

LOW
