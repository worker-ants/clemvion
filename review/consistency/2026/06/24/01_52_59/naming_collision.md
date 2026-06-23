# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system/15-chat-channel.md` (구현 완료 후 검토 — scope: C-2 circular dep 해소 diff)
검토 기준: diff `origin/main...HEAD` 에서 도입된 신규 식별자 vs 기존 코퍼스

---

## 발견사항

충돌에 해당하는 항목이 없습니다. 아래는 항목별 검토 결과입니다.

### [INFO] `ChatChannelTokenRotatorService` — chat-channel 모듈에서 triggers 모듈로 이전

- target 신규 식별자: `ChatChannelTokenRotatorService` (파일 위치 변경: `modules/chat-channel/` → `modules/triggers/`)
- 기존 사용처:
  - `spec/data-flow/0-overview.md` line 201: `| 'chat-channel-token-rotator' | triggers.module.ts | ChatChannelTokenRotatorService ...`
  - `spec/data-flow/14-chat-channel.md` line 28: `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts`
  - `spec/5-system/16-system-status-api.md` line 34: 큐 이름 `chat-channel-token-rotator` 그대로 유지
- 상세: 이미 spec 이 `triggers` 모듈 경로로 갱신되어 있다 (C-2 이전 반영 완료). 서비스 클래스명(`ChatChannelTokenRotatorService`)·큐 상수명(`CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE`)·BullMQ 큐 문자열(`'chat-channel-token-rotator'`)은 모두 불변 — 이름 충돌 없음.
- 제안: 해당 없음.

### [INFO] `TriggersController.rotateBotToken` — ChatChannelController 에서 이전

- target 신규 식별자: `TriggersController` 에 추가된 `rotateBotToken` 메서드 + `POST :id/chat-channel/rotate-bot-token` 라우트
- 기존 사용처:
  - `spec/5-system/15-chat-channel.md` §5.4: `POST /api/triggers/:id/chat-channel/rotate-bot-token` 로 원래부터 정의됨
  - `spec/5-system/2-api-convention.md` line 53: 동일 URL 예시로 이미 포함
  - `spec/conventions/user-guide-evidence.md` lines 139-141: `file="codebase/backend/src/modules/triggers/triggers.controller.ts"` + `symbol="rotateBotToken"` 로 이미 갱신됨
  - `spec/data-flow/14-chat-channel.md` line 151: 동일 라우트 기술
- 상세: 라우트 경로·메서드 모두 spec 상 기존 정의와 일치. `TriggersController` 에 기존에 없던 메서드가 추가된 것으로, 기존 `rotateNotificationSecret` / `revokePerTriggerToken` 과 경로 segment (`notification/`, `interaction/`, `chat-channel/`)가 달라 충돌 없음.
- 제안: 해당 없음.

### [INFO] `CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE` — import 경로 변경

- target 신규 식별자: `system-status.constants.ts` 의 import 경로 `'../triggers/chat-channel-token-rotator.service'` (구 `'../chat-channel/chat-channel-token-rotator.service'`)
- 기존 사용처: `codebase/backend/src/modules/system-status/system-status.constants.ts` line 17 — 동일 파일, 동일 상수명, 경로만 갱신
- 상세: 상수 문자열 값 `'chat-channel-token-rotator'` 는 변경 없음. spec 큐 카탈로그(`data-flow/0-overview.md` §4, `16-system-status-api.md`)도 동일 큐 이름을 기술 — 충돌 없음.
- 제안: 해당 없음.

### [INFO] `spec/5-system/14-external-interaction-api.md` 의 `triggers.controller.ts` 설명

- target 신규 식별자: `TriggersController` 에 `rotateBotToken` 추가
- 기존 사용처: `spec/5-system/14-external-interaction-api.md` line 785 — `"triggers.controller.ts — POST :id/notification/rotate-secret (EIA-NX-12) · POST :id/interaction/revoke-token (EIA-AU-07)"` 로 2개 라우트만 나열
- 상세: 14-external-interaction-api.md 설명 목록에 `chat-channel/rotate-bot-token` 이 추가되지 않았다. 이는 충돌이 아니라 spec 나열의 미완성(누락)이며, Chat Channel spec 15-chat-channel.md 가 해당 라우트의 SoT 이다. 14번 문서의 설명은 EIA 전용 라우트만 나열하는 의도로 해석 가능해 명시적 충돌은 아님.
- 제안: 이후 spec 갱신 시 14-external-interaction-api.md 의 triggers.controller 나열에 `POST :id/chat-channel/rotate-bot-token (CCH-SE-04)` 를 추가하면 독자 혼동을 줄일 수 있음 (차단 불필요).

---

## 요약

이번 diff(C-2 circular dep 해소)는 기존에 `chat-channel` 모듈에 있던 `ChatChannelController` + `ChatChannelTokenRotatorService` 를 `triggers` 모듈로 이전하고, BullMQ 큐 등록을 `TriggersModule` 로 옮기는 구조 리팩터링이다. 신규로 도입되는 식별자(클래스명·큐 이름·API 경로·환경변수·설정키)는 없으며, 이전된 식별자들은 모두 이미 갱신된 spec(`data-flow/14-chat-channel.md`, `data-flow/0-overview.md`, `spec/5-system/15-chat-channel.md`, `spec/conventions/user-guide-evidence.md`)에서 신규 경로/모듈로 명시되어 있다. `spec/5-system/14-external-interaction-api.md` 의 triggers.controller 나열이 `chat-channel/rotate-bot-token` 을 빠뜨리고 있으나 SoT 는 15-chat-channel.md 이므로 식별자 충돌이 아닌 보완 권장 수준이다.

---

## 위험도

NONE
