# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 새 모듈 상수 `TRIGGER_RESPONSE_STRIP_COLUMNS` 의 JSDoc 이 엉뚱한 자리(그 앞의 `NOTIFICATION_SIGNING_STRIP_KEYS`)에 붙어 있다 — 두 신규 상수 사이에서 주석 순서가 어긋났다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:63-76` (엔티티 컬럼 strip 을 설명하는 JSDoc, 내용상 `TRIGGER_RESPONSE_STRIP_COLUMNS` 를 가리킴) 바로 뒤 `:77-87` (`NOTIFICATION_SIGNING_STRIP_KEYS` 를 설명하는 JSDoc, 올바르게 `:88` 의 선언 바로 위) → 그 결과 실제 `TRIGGER_RESPONSE_STRIP_COLUMNS` 선언(`:93-96`)에는 **바로 위에 아무 주석도 붙어 있지 않다**.
  - 상세: `git diff origin/main -- .../triggers.service.ts` 로 대조하면 이 PR 이 두 상수(`NOTIFICATION_SIGNING_STRIP_KEYS`, `TRIGGER_RESPONSE_STRIP_COLUMNS`)를 한 번에 신설하면서 두 JSDoc 블록을 순서대로 붙였는데, 첫 번째 블록("응답에서 제거할 **엔티티 컬럼**... `notification_secret_v2`... `chat_channel_token_v2`...")은 명백히 `TRIGGER_RESPONSE_STRIP_COLUMNS`(`= ['notificationSecretV2', 'chatChannelTokenV2']`)를 설명하는 내용인데, 코드 순서상으로는 `NOTIFICATION_SIGNING_STRIP_KEYS` 선언 앞에 놓였다. `NOTIFICATION_SIGNING_STRIP_KEYS` 는 두 번째 블록("`config.notification.signing` 에서 제거할 키...")과 정확히 대응해 그쪽은 문제 없다. 결과적으로 위에서 아래로 읽으면 "엔티티 컬럼 strip" 설명 뒤에 `secret`/`secretRef` 목록이 나와 잠깐 헷갈리고, TSDoc/IDE hover 같은 "가장 가까운 앞 주석을 그 선언의 문서로 취급" 하는 도구를 쓰면 `TRIGGER_RESPONSE_STRIP_COLUMNS` 는 문서가 없는 것으로, `NOTIFICATION_SIGNING_STRIP_KEYS` 의 문서 자리에 다른 상수 설명이 끼어든 것으로 보인다. 이 두 상수는 이번 PR 이 고친 보안 결함(회전 secret 유출)의 핵심 방어 목록이라, 다음에 세 번째 strip 목록을 추가하는 사람이 이 주석을 보고 오해할 여지가 있다.
  - 제안: `TRIGGER_RESPONSE_STRIP_COLUMNS` 의 JSDoc(63-76행)을 그 선언(93행) 바로 위로 옮기고, `NOTIFICATION_SIGNING_STRIP_KEYS` 의 JSDoc(77-87행)은 그대로 88행 위에 남긴다.

- **[WARNING]** `sanitizeForResponse` 위에 **JSDoc 두 블록이 연속으로** 남아 있다 — rename 하면서 새 설명을 앞에 추가했는데 옛 설명을 지우지 않아, 옛 블록이 이제는 부정확한 상태로 방치됐다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:547-557` (옛 JSDoc, 舊 `sanitizeChatChannelForResponse` 시절 그대로) 바로 뒤 `:558-569` (이번 PR 이 새로 쓴 JSDoc) → `:570` `private sanitizeForResponse<T extends Trigger>(trigger: T): T {`
  - 상세: 옛 블록(547-557)은 "Strip 키 집합(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`)은 module-level 상수로 **단일 진실**" 이라고 적는데, 이 PR 로 실제 strip 목록은 3개(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`, `NOTIFICATION_SIGNING_STRIP_KEYS`, `TRIGGER_RESPONSE_STRIP_COLUMNS`)로 늘었고 함수도 config.chatChannel / config.notification.signing / 엔티티 컬럼 세 곳을 정화하도록 넓어졌다 — "단일 진실" 서술이 더 이상 맞지 않는다. `git diff origin/main` 대조 결과 이 옛 블록은 이번 diff 가 **그대로 남긴** 컨텍스트 줄이고, 바로 아래 새 블록(558-569)이 정확한 최신 설명을 담고 있다. 즉 같은 메서드를 설명하는 주석이 하나는 stale, 하나는 최신인 채로 둘 다 남아 다음 사람이 어느 쪽을 믿어야 할지 헷갈린다.
  - 제안: 옛 블록(547-557)을 삭제하고 새 블록(558-569) 하나만 남긴다. `hasBotToken` derived 필드 설명처럼 새 블록에 없는 유용한 내용이 있다면 새 블록에 흡수한다.

- **[INFO]** `sanitizeForResponse` 안에서 "strip-key-set 으로 객체 필드를 거르는" 동일 패턴이 `config.chatChannel` 축과 `config.notification.signing` 축에 나란히 반복된다 (`for (const [key, value] of Object.entries(...)) { if (STRIP_SET.has(key)) continue; ... }`).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:588-592` (`sanitizedChatChannel` 루프, `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` 사용) 와 `:604-610` (`sanitizedSigning` 루프, `NOTIFICATION_SIGNING_STRIP_KEYS` 사용) — 두 루프가 있는 메서드 전체는 `:570-633`.
  - 상세: 두 루프는 변수명만 다르고 로직이 동일하다(엔티티/JSONB 두 계층에서 비밀을 걷어내는, 이 PR 의 핵심 보안 로직이라는 점에서 사소하지 않다). 지금은 함수 하나 안에 있어 당장 위험하지는 않지만, 세 번째 strip 목록이 이 메서드에 또 추가되면(예: 이번 라운드의 security 리뷰가 지적한 것처럼 다른 JSONB 키가 나중에 추가될 가능성) 같은 필터링 코드가 세 번째로 복붙될 가능성이 높다.
  - 제안: `omitKeys(obj: Record<string, unknown>, keys: ReadonlySet<string>): Record<string, unknown>` 같은 private 헬퍼로 추출해 두 루프를 대체하면, 다음 strip 목록 추가 시 헬퍼 재사용만으로 끝난다.

- **[INFO]** `SchedulesController.toResponse()` 의 지역 변수 `t`(= `schedule.trigger`)가 여전히 축약형이다 — 이전 라운드(`review/code/2026/09/05/18_23_02/maintainability.md`)가 같은 지점을 INFO 로 지적했으나 이번 diff 에도 그대로 남아 있다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:68` (`const t = schedule.trigger;`), 사용처 `:72-79`.
  - 상세: 이 메서드는 이번 PR 의 보안 목적(조인된 Trigger 엔티티 전체를 4필드로 좁힘)을 담당하는 자리이고 JSDoc(53-66행)은 상세한데, 본문 핵심 변수만 `t` 로 축약돼 있어 파일 내 다른 코드(서술적 이름 사용)와 스타일이 어긋난다. 기능 영향 없음, 재지적이라 우선순위는 낮음.
  - 제안: `t` → `trigger` (타입 `Trigger` 와 네임스페이스가 달라 충돌 없음). 강제 아님.

- **[INFO]** "이미 응답에 실려 나가고 있었다…" 로 시작하는 동일한 배경 설명 주석 블록이 4개 DTO 파일(`alert-rule-response.dto.ts`, `integration-response.dto.ts`, `knowledge-base-response.dto.ts`, `trigger-response.dto.ts`)에 그대로 반복된다 — 이전 라운드가 이미 INFO 로 기록하고 "각 파일 자기완결" 관례상 조치 불요로 처리한 항목이며, 이번 diff 에도 동일하게 남아 재확인만 한다.
  - 위치: 각 DTO 파일의 신규 필드 블록 도입부 (예: `alert-rule-response.dto.ts:55-58`, `trigger-response.dto.ts:69-72`).
  - 상세/제안: 이전 라운드 판단(조치 불요, 서사 정정 시 4곳 동기화)과 동일 — 재차단 사유 아님.

## 요약

핵심 로직(`TriggersService.sanitizeForResponse`, `SchedulesController.toResponse`, `swagger-dto-contract-guard.ts` 의 `findOptionalNullableResponseFields`, `response-contract.ts` 의 `contractForDto` 메모이제이션)은 네이밍이 명확하고 함수 길이·중첩 모두 적정 범위이며, 이전 라운드가 지적한 죽은 코드(이중 순회 루프)는 실제로 제거된 것을 `git diff origin/main` 대조로 확인했다. 다만 이번 diff 가 새로 만든 두 실질 결함이 있다 — (1) `TRIGGER_RESPONSE_STRIP_COLUMNS` 의 JSDoc 이 코드 순서상 엉뚱하게 `NOTIFICATION_SIGNING_STRIP_KEYS` 앞에 붙어 두 상수 중 하나는 사실상 무주석 상태가 됐고, (2) `sanitizeForResponse` rename 시 새 JSDoc 을 추가하면서 이제는 부정확해진 옛 JSDoc 을 지우지 않아 같은 메서드에 상충하는 문서 두 벌이 남았다. 둘 다 런타임에는 영향이 없지만, 이 코드가 정확히 회전 secret 유출을 막는 보안 경계라는 점에서 다음 유지보수자가 잘못된 서술을 신뢰할 위험이 있어 WARNING 으로 표기한다. 추가로 같은 메서드 안에 strip-key-set 필터링 루프가 두 번 복붙된 작은 DRY 여지, 그리고 이전 라운드에서 이미 INFO 로 남았던 변수명·주석 중복 2건이 그대로 재확인된다. 전반적 위험도는 낮다.

## 위험도

LOW
