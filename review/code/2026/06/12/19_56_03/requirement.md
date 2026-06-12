# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] [SPEC-DRIFT] spec/5-system/15-chat-channel.md §5.4 — 응답 계약 기술이 구현보다 낡음

- 위치: `spec/5-system/15-chat-channel.md` line 324–333
- 상세: spec §5.4의 "성공 응답 (200 OK)" 블록은 아직 `rotatedAt` 1필드만 예시 JSON으로 보여주고 line 333에서 "triggerId / chatChannelHealth / botIdentity 3필드 동봉은 **미구현 (Planned)**" 이라고 기술하고 있다. 그러나 `triggers.service.ts` 의 `rotateBotToken` 은 이 변경에서 4필드(`rotatedAt`, `triggerId`, `chatChannelHealth`, `botIdentity`)를 반환하도록 이미 구현됐다. 코드가 옳고 spec 본문만 낡은 상태다.
- 제안: 코드 유지 + spec 반영. `spec/5-system/15-chat-channel.md §5.4` 의 성공 응답 JSON 예시를 4필드로 갱신하고 "미구현(Planned)" 문구를 제거한다 (`project-planner` 위임). `plan/in-progress/spec-sync-chat-channel-gaps.md` 의 §5.4 항목이 "[x] 구현 완료 — spec §5.4 예시 갱신"으로 체크됐으나, 실제 spec 본문은 아직 갱신되지 않은 것으로 보인다.

---

### [INFO] CCH-CV-03 (b) — spec 본문 "(b) 분기 미구현 (Planned)" 문구가 코드 현실과 불일치

- 위치: `spec/5-system/15-chat-channel.md` line 67 (CCH-CV-03 셀 내 괄호 "현재 HooksService.isActiveExecution …은 비-terminal 상태를 모두 single active로 collapse … 미구현 (Planned)")
- 상세: 이 변경에서 `isActiveExecution` → `getActiveExecutionStatus` 로 확장되어 (b) 분기(`running`/`pending` → `executionStillRunning` 안내 + `{ executionId: 'ignored' }`)가 구현됐다. spec 본문의 "현재 미구현" 설명 블록은 코드 현실과 괴리된 상태다.
- 제안: 코드 유지 + spec 반영. CCH-CV-03 셀에서 미구현 단서 블록을 제거하고 "(b) 구현 완료"로 갱신 (`project-planner` 위임). plan 파일은 체크됐으나 spec 본문은 아직 갱신 안 된 것으로 확인.

---

### [WARNING] `sendExecutionStillRunningNotice` — `button_callback` 은 분기 진입 불가능 (dead path 아님, 논리 정합 확인)

- 위치: `hooks.service.ts` line 1337–1349 (인터랙션 분기 진입 조건) + line 1347 (`activeStatus !== ExecutionStatus.WAITING_FOR_INPUT` guard)
- 상세: CCH-CV-03 (b) guard (`activeStatus !== WAITING_FOR_INPUT`) 는 `text_message`, `button_callback`, `contact_share`, `file_upload` 네 종류 모두에 적용된다. `button_callback` 은 `waiting_for_input` 미도달(버튼 미발송) 상태에서 사용자가 이전 버튼을 클릭하는 경우에 현실적으로 발생한다. 이 경우 `sendExecutionStillRunningNotice` 가 발송되며 잘 동작한다. 다만 spec CCH-CV-03 본문은 "두 번째 이후 메시지"라는 전제를 문자 기반 메시지 중심으로 기술하고 있어, `button_callback` 이 running/pending 상태에서 도달했을 때 동일 "처리 중" 안내가 올바른지 문서상 명시가 없다. 논리는 타당하나 spec에 명시되지 않은 확장이다.
- 제안: 실제 동작은 타당하므로 코드 변경 불요. spec CCH-CV-03 (b) 설명에 `button_callback` 케이스도 동일하게 안내 발송 후 무시함을 명시하면 완전해진다 (`project-planner` 위임).

---

### [INFO] `getActiveExecutionStatus` — `PENDING` 상태가 spec 명명 "(b) running/pending" 과 일치 확인

- 위치: `hooks.service.ts` line 1643–1650 (`getActiveExecutionStatus` 메서드)
- 상세: spec CCH-CV-03은 `running`/`pending` (waiting_for_input 미도달) 이라고 명시하고, `getActiveExecutionStatus`는 COMPLETED/FAILED/CANCELLED 이면 null, 그 외(PENDING/RUNNING/WAITING_FOR_INPUT)는 status 반환으로 구현한다. 호출 지점에서 `activeStatus !== WAITING_FOR_INPUT` 조건이 PENDING과 RUNNING을 (b) 분기로 라우팅한다. spec 정의와 코드 구현이 정확히 일치한다.
- 제안: 없음.

---

### [INFO] `ROTATE_RESULT` 테스트 픽스처 — spec §5.4 "3필드 동봉" 주석이 실제로는 4필드

- 위치: `chat-channel.controller.spec.ts` line 36–43 (주석 `// [Spec §5.4] 성공 응답 3필드 동봉.`)
- 상세: 주석은 "3필드 동봉"이라고 하지만 `ROTATE_RESULT` 객체는 `rotatedAt`, `triggerId`, `chatChannelHealth`, `botIdentity` 4필드를 담고 있다. 주석의 "3필드"는 추가된 신규 필드 수(기존 `rotatedAt` 제외 3개)를 가리키는 것으로 보이나, 객체 전체 필드 수와 불일치하여 혼동을 유발할 수 있다.
- 제안: 주석을 `// [Spec §5.4] 성공 응답 — rotatedAt + triggerId / chatChannelHealth / botIdentity 4필드` 등으로 명확화하면 좋다. 기능 결함은 아니므로 INFO.

---

### [INFO] `triggers.service.spec.ts` — `botIdentity=null` 테스트에서 setupChannel 이 `configUpdates: {}` 반환 시 `mergedChannel.botIdentity`가 undefined인지 확인

- 위치: `triggers.service.spec.ts` line 1802–1814 (§5.4 botIdentity=null 테스트)
- 상세: 테스트는 `configUpdates: {}` 반환 시 `result.botIdentity`가 `null`임을 확인한다. 실제 구현(`triggers.service.ts` line 979)은 `mergedChannel.botIdentity ?? null`로 `undefined → null` 변환을 수행한다. `mergedChannel`이 `{ ...chatChannelCfg, ...(result.configUpdates ?? {}) }` 이므로 `configUpdates`에 `botIdentity`가 없으면 기존 `chatChannelCfg.botIdentity`가 유지될 수 있다. 테스트 픽스처에서 기존 trigger config의 `chatChannelCfg.botIdentity`가 어떻게 설정됐는지 확인이 필요하나, 테스트가 통과한다면 픽스처에서 기존 `botIdentity`가 없는 trigger를 사용하는 것으로 추정된다.
- 제안: 실제 rotation 시 기존 trigger에 `botIdentity`가 설정돼 있는 상태에서 `configUpdates`가 `botIdentity`를 반환하지 않는 케이스(예: 구 provider 응답 누락)에 대한 테스트가 추가되면 더 완전해진다. 현재 구현은 `configUpdates` 우선으로 덮어쓰므로 기존 캐시가 유지될 수 있어 spec 의도("getMe 캐시 갱신 결과")와 다를 수 있다. INFO 수준이며 기존 코드 흐름이 spec 의도와 충돌하는지는 `mergedChannel` 생성 로직 전체를 봐야 확정 가능.

---

### [INFO] `chat-channel.controller.ts` — 반환 타입을 `Awaited<ReturnType<TriggersService['rotateBotToken']>>` 로 변경

- 위치: `chat-channel.controller.ts` line 227
- 상세: controller 반환 타입이 `{ rotatedAt: string }` 에서 `Awaited<ReturnType<TriggersService['rotateBotToken']>>` 로 변경됐다. 이는 service 반환 타입과 controller 반환 타입을 자동으로 동기화하는 패턴으로, 추후 service 반환 타입 변경 시 controller가 자동으로 따라간다. 기능상 정확하며 타입 안전성 향상이다. 다만 Swagger DTO 자동 생성 관점에서 `ReturnType` 유틸리티 타입이 Swagger 메타데이터 추론을 방해할 수 있으나, 기존에 명시적 `@ApiResponse` 데코레이터가 없어 이 변경이 추가적 문제를 유발하지는 않는다.
- 제안: 없음 (기능 정확).

---

## 요약

본 변경은 두 가지 미구현 항목을 정확히 구현한다: (1) CCH-CV-03 (b) — `isActiveExecution` boolean을 `getActiveExecutionStatus` status-aware로 확장하여 `waiting_for_input` 미도달(running/pending) 상태에서 `executionStillRunning` 안내를 발송하고 update를 무시하는 R9 결정을 실현했다. (2) §5.4 rotate-bot-token 성공 응답 확장 — `triggerId`/`chatChannelHealth`/`botIdentity` 3필드를 추가하여 spec 요구사항을 충족했다. 기능 완전성과 비즈니스 로직 정확성 모두 양호하다. 주요 잔여 사항은 **spec 본문 갱신** 으로, `spec/5-system/15-chat-channel.md §5.4`의 성공 응답 JSON 예시가 아직 1필드(`rotatedAt`)만 보여주고 "미구현(Planned)" 문구가 남아 있으며, CCH-CV-03 셀의 "현재 미구현" 단서 블록도 제거되지 않았다. 이는 코드 버그가 아닌 spec 갱신 누락이다. 에러 처리, 반환값, 엣지 케이스(setupChannel botIdentity 미반환 → null 변환, sendMessage 실패 swallow) 모두 적절히 구현됐다.

## 위험도

LOW
