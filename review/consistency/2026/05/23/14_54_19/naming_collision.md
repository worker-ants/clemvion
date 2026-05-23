# 신규 식별자 충돌 검토 결과

**대상 문서**: `spec/5-system/15-chat-channel.md`
**검토 모드**: 구현 착수 전 (--impl-prep)
**검토일**: 2026-05-23

---

## 발견사항

### 발견 1

- **[INFO]** `TRIGGER_NOT_FOUND` — 신규 에러 코드가 기존 에러 코드 카탈로그와 어긋남
  - target 신규 식별자: `TRIGGER_NOT_FOUND` (`spec/5-system/15-chat-channel.md §5.4` 응답 표)
  - 기존 사용처: `spec/5-system/3-error-handling.md §1.3` 의 유효성 검증 에러 카탈로그는 리소스 부재를 `RESOURCE_NOT_FOUND` (HTTP 404) 로 통일하고 있다. 기존 다른 API 에서 트리거 미존재 에러가 `RESOURCE_NOT_FOUND` 로 사용되는 사례는 spec 에 명시되지 않았으나, 카탈로그의 단일 진실은 `RESOURCE_NOT_FOUND`.
  - 상세: `TRIGGER_NOT_FOUND` 는 spec/5-system/3-error-handling.md 의 공식 에러 코드 카탈로그에 존재하지 않는다. 카탈로그의 관용은 도메인-특정 404 세분화를 허용하는지 여부가 불명확하다. 다른 API 에서 동일 상황(trigger 미존재)에 `RESOURCE_NOT_FOUND` 를 쓸 경우 일관성이 깨진다.
  - 제안: `spec/5-system/3-error-handling.md §1.3` 에 `TRIGGER_NOT_FOUND` 를 등재하거나, 아니면 기존 `RESOURCE_NOT_FOUND` 를 사용하고 `details.resourceType='trigger'` 로 세분화하는 방안을 명확히 결정한다. 다른 도메인-특정 404 코드(예: `WORKFLOW_NOT_FOUND`)가 없는 상황이라면 `RESOURCE_NOT_FOUND` 통일이 일관성에 유리하다.

---

### 발견 2

- **[INFO]** `executionStillRunning` — `languageHints` 키가 `config.chatChannel.languageHints` JSON 예시와 불일치
  - target 신규 식별자: `languageHints.executionStillRunning` (CCH-CV-03 요구사항 본문에서 참조)
  - 기존 사용처: `spec/5-system/15-chat-channel.md §4.1` 의 `languageHints` JSON 예시에는 `groupChatRefusal` / `executionStarted` / `executionCompleted` 세 키만 포함. `executionStillRunning` 키는 CCH-CV-03 본문에서 `languageHints.executionStillRunning` 으로 참조되나 §4.1 JSON 예시에 누락.
  - 상세: CCH-CV-03 에서 "`running` 케이스의 안내 default 문구 = '워크플로우가 처리 중입니다. 잠시만 기다려 주세요.'" 라고 직접 값을 명시하면서 `languageHints.executionStillRunning` 키를 사용한다고 하나, §4.1 의 예시 JSON 은 이 키 없이 3개만 보여준다. `spec/2-navigation/2-trigger-list.md §2.3.1` 는 `executionStillRunning` 을 포함해 열거하고 있어(`groupChatRefusal` / `executionStarted` / `executionCompleted` / `executionStillRunning` / `help`), 본 spec 의 §4.1 예시가 누락된 것으로 보인다.
  - 제안: `spec/5-system/15-chat-channel.md §4.1` 의 `languageHints` 예시 JSON 에 `executionStillRunning` 키(및 default 문구)를 추가해 CCH-CV-03 참조와 정합시킨다. 의미 충돌은 없으므로 단순 보완이다.

---

### 발견 3

- **[INFO]** `R-CC-N` Rationale prefix 체계 — 외부 spec 참조(`[EIA §R10]`, `[EIA §R11]`, `[EIA §R12]`) 와 동일 패턴 사용 가능성
  - target 신규 식별자: Rationale prefix `R-CC-10`, `R-CC-11`, `R-CC-12` (`spec/5-system/15-chat-channel.md §Rationale`)
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md` 는 자체 Rationale 을 `R10`, `R11`, `R12` 로 명명. 본 spec 의 본문(line 33, 138, 353 등)에서 `[EIA §R10]` 형태로 자주 참조.
  - 상세: target spec 의 `§Rationale ID 컨벤션` (2026-05-23 항) 에서 prefix 없는 `R10/R11/R12` 사용 시 EIA 의 외부 참조와 혼동 위험을 인식하고 `R-CC-N` prefix 를 도입했다고 명시. 이 자체 인식과 대응이 이미 spec 에 기재되어 있어 의도된 구분이다. 하지만 `R-K` (기존), `R1~R9` (기존) 와 신규 `R-CC-10~R-CC-12` 가 한 문서 안에 혼재하는 네이밍 스킴은 독자 입장에서 비직교적이다.
  - 제안: 현재로서는 충돌이 발생하지 않으며 spec 자체가 이미 근거를 명시하고 있다. 향후 `R-K` 도 `R-CC-K` 로 rename 하는 일관화를 검토할 수 있으나, spec 이 "cross-link 깨짐 위험"을 이유로 하위 호환 유지를 명시했으므로 즉각적 차단 사항 아님.

---

### 발견 4

- **[INFO]** `ChatChannelDispatcher` vs `chat-channel.dispatcher.ts` — 클래스명과 파일 내 노출 이름 간 사소한 불일치
  - target 신규 식별자: `ChatChannelDispatcher` (§7 구현 파일 구조: `chat-channel.dispatcher.ts`) + `spec/5-system/14-external-interaction-api.md §3.3.1` 에서 `ChatChannelDispatcher` 로 참조
  - 기존 사용처: `spec/5-system/15-chat-channel.md §R8` 에서는 `ChatChannelDispatcher` 로, `spec/conventions/secret-store.md §5.4` 주석에서는 `ChatChannelTokenRotatorService` 로 각각 참조. 파일 경로는 `chat-channel.dispatcher.ts` 와 `ChatChannelDispatcher` 명명이 동시 사용되며, `spec/5-system/14-external-interaction-api.md §3.3.1` 도 동일명을 사용.
  - 상세: 두 spec(`14-external-interaction-api.md`, `15-chat-channel.md`)이 같은 `ChatChannelDispatcher` 이름을 동일 의미로 참조하고 있어 명명 충돌은 없다. 단, §R8 과 CCH-AD-05 에서 부르는 이름이 동일한지 구현 파일 경로(`chat-channel.dispatcher.ts`)와 정합하는지 구현 시 주의가 필요하다.
  - 제안: 이미 여러 spec 에서 동일 의미로 일관되게 사용 중. 충돌 없음. 현 명명 유지.

---

### 발견 5

- **[INFO]** `chat-channel:{triggerId}:{conversationKey}` Redis 키 패턴 — 기존 Redis 키 네임스페이스와의 관계 미명시
  - target 신규 식별자: Redis 키 `chat-channel:{triggerId}:{conversationKey}` (`spec/5-system/15-chat-channel.md §4.3`)
  - 기존 사용처: 다른 spec 문서들은 Redis 키 패턴을 spec 레벨에서 명시적으로 정의한 곳이 없어 직접 비교가 어렵다. BullMQ queue 이름(`background-execution` 등)은 실행 엔진 spec 에 등장하나 Redis key 네임스페이스 목록은 별도 정의 없음.
  - 상세: target spec §4.3 에서 스스로 "콜론 separator + 계층형 (다른 모듈의 prefix 와 충돌 없음)" 이라고 명시하고 있다. 기존 Redis key prefix 의 카탈로그가 없으므로 충돌 여부를 spec 레벨에서 완전히 검증할 수는 없으나, `chat-channel:` prefix 가 다른 모듈(BullMQ queue 이름, SSE 버퍼 등)과 동일한 prefix 를 사용한다는 근거도 없다.
  - 제안: 실제 충돌 가능성은 낮다. 향후 Redis 키 네임스페이스 카탈로그(예: `spec/conventions/redis-keys.md`)를 신설하면 체계적 관리가 가능하다. 현 시점에서 차단 사항 아님.

---

### 발견 6

- **[INFO]** `NotificationSecretRotatorService` vs `ChatChannelTokenRotatorService` — 패턴명 참조가 spec 내에서 혼용
  - target 신규 식별자: `ChatChannelTokenRotatorService` (`spec/5-system/15-chat-channel.md §3.4 CCH-SE-04-C`)
  - 기존 사용처: `spec/5-system/15-chat-channel.md §3.4 CCH-SE-04-C` 에서 "매시간 cron — `NotificationSecretRotatorService` 와 동일 패턴" 이라고 기술. `NotificationSecretRotatorService` 는 EIA spec 의 notification secret rotation 담당 서비스 이름이다.
  - 상세: `ChatChannelTokenRotatorService` 와 `NotificationSecretRotatorService` 는 별개 클래스로 충돌은 없으며, 두 이름의 의미도 명확히 다르다. "동일 패턴" 은 동일 구현체가 아니라 동일 cron 주기·동일 cleanup 로직 참조를 뜻한다. 의미 혼동 없음.
  - 제안: 충돌 없음. 현 명명 유지.

---

## 요약

`spec/5-system/15-chat-channel.md` 가 도입하는 신규 식별자 중 기존 spec 과의 의미 충돌에 해당하는 CRITICAL 또는 WARNING 수준 항목은 발견되지 않았다. 요구사항 ID(`CCH-*`), DB 컬럼명(`chat_channel_*`), API 엔드포인트(`POST /api/triggers/:id/chat-channel/rotate-bot-token`), SSE·WebSocket 이벤트명(`execution.*`), 환경변수·설정키, 파일 경로(`spec/5-system/15-chat-channel.md`) 모두 기존 식별자와 충돌하지 않는다. `TRIGGER_NOT_FOUND` 에러 코드가 기존 에러 카탈로그의 `RESOURCE_NOT_FOUND` 와 역할이 중복될 수 있어 일관성 보완을 권장하며, `languageHints.executionStillRunning` 키가 §4.1 JSON 예시에 누락되어 같은 spec 내 CCH-CV-03 과의 사소한 불일치가 있다. 나머지 항목들은 이미 spec 안에서 스스로 근거를 명시한 의도적 설계다.

---

## 위험도

LOW
