# 보안(Security) 코드 리뷰

## 검토 범위

이번 diff 는 이전 두 라운드(`review/code/2026/09/14/18_17_44`, `review/code/2026/09/14/19_07_43`)의
연속으로, security CRITICAL#1("`TriggersService.update()` 의 `save(trigger)` — 창 1 — 을 통해
`inboundSigningRef` fail-open 이 재현 가능")이 이미 이전 커밋(`12ed21ff1`)에서 닫혔음을 확인한 뒤,
이번 라운드가 새로 다루는 변경은 커밋 `c7a9c107e` — **웹훅 hot path(`HooksService.handleWebhook` /
`handleChatChannelWebhook`)의 `trigger.lastTriggeredAt = ...; save(trigger)` 를 컬럼 한정
`update({id}, {lastTriggeredAt})` 로 바꾼 것** — 및 그에 딸린 정적 가드
(`endpoint-path-conflict-wrap-guard.ts` 등)·테스트다. 다음을 직접 열어 확인했다:

- `codebase/backend/src/modules/hooks/hooks.service.ts` (두 저장 지점, 전체 파일 컨텍스트)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (전체, 변경 없음 — 이전 라운드와 동일)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (전체, 변경 없음 — 이전 라운드와 동일)
- `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()`(창 1, 이전 라운드에서 고정)와
  `rotateBotToken()` 의 `rewriteTriggerConfigLocked` 호출부
- `rewriteTriggerConfigLocked` 의 세 호출부 전부가 `findById(id, workspaceId)` 로 워크스페이스 소속을
  검증한 `trigger.id` 만 넘기는지 (`grep -rln`) 재확인
- `codebase/backend/src/repo-guards/__tests__/*` — 정적 분석 가드/픽스처(빌드타임 전용, 런타임 보안
  표면 아님)

## 발견사항

- **[INFO]** 웹훅 hot path 의 `lastTriggeredAt` 갱신이 `save(trigger)` → `update({id}, {lastTriggeredAt})` 로 좁혀져, PATCH 보다 훨씬 빈번한 인입 경로에서의 `inboundSigningRef` fail-open 재발 가능성이 닫혔다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (`handleWebhook` 내 `trigger.lastTriggeredAt = new Date(); await this.triggerRepository.update(...)` 및 `handleChatChannelWebhook` 내 동일 패턴)
  - 상세: 종전엔 인입 메시지마다 `save(trigger)` 로 엔티티 전체를 다시 썼는데, `trigger` 는 요청 시작 시점(핸들러 진입 시 `findOne`)에 읽은 in-memory 스냅샷이다. 동시에 `PATCH`/`rotateBotToken` 이 advisory lock 안에서 `chatChannel.inboundSigningRef` 를 새로 확립·커밋해도, 그 직후 도착하는 웹훅 인입이 이 오래된 스냅샷으로 `config` 를 통째로 되쓰면 방금 확립된 ref 가 사라져 `ChatChannelInboundAuthenticator`(`if (!config.inboundSigningRef) return;`)가 서명 검증을 건너뛴다 — 이 PR 시리즈가 PATCH 경합에 대해 닫은 것과 **동일한 인증 우회 클래스**가 인입 hot path 로 다시 열려 있었다(웹훅은 매 메시지마다 도므로 발생 빈도가 PATCH-PATCH 경합보다 훨씬 높다). 이번 diff 는 `save()` 를 컬럼 한정 `update()` 로 바꿔 `config` 필드 자체를 왕복에서 제거했으므로, 이 경로에서는 더 이상 lost-update 가 발생할 수 없다(쓰기가 `lastTriggeredAt` 단일 컬럼으로 좁혀졌다). 동반 테스트(`hooks.service.spec.ts`)도 `save` 미호출 + `update` 호출 패치가 정확히 `['lastTriggeredAt']` 한 키뿐임을 단언해, 향후 `config` 가 다시 patch 에 섞이는 회귀를 잡도록 배선돼 있다. `trigger.id` 는 이미 `endpointPath` 로 조회·서명 검증을 통과한 트리거의 PK 이므로 크로스 테넌트 스코핑 문제도 없다. 새 결함이 아니라 CRITICAL 급 인증 우회 재발 경로의 해소로 판단해 INFO 로 기록한다.
  - 제안: 조치 불요(이미 닫힘). 향후 이 hot path 에 다른 컬럼 갱신이 추가될 때도 `update()` 의 patch 객체를 필요한 컬럼으로만 명시적으로 좁히는 관례를 유지할 것.

- **[INFO]** `rewriteTriggerConfigLocked`(및 창 1 인라인 트랜잭션)의 재읽기/쓰기가 헬퍼 자체로는 `workspaceId` 로 스코핑되지 않음 — 기존 지적 유지, 이번 diff 로 변화 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — `m.findOne(Trigger, { where: { id: triggerId } })`, `m.update(Trigger, { id: triggerId }, patch)`
  - 상세: 이전 두 라운드에서 이미 지적·수용된 항목의 재확인이다. 오늘 기준 모든 호출부(`chat-channel-binder.service.ts` 성공/실패 경로, `triggers.service.ts::rotateBotToken`, `triggers.service.ts::update()` 내부 인라인 트랜잭션)는 예외 없이 `findById(id, workspaceId)` 로 워크스페이스 소속을 검증한 뒤의 `trigger.id` 만 넘기므로 크로스 테넌트 위험은 실제로 열려 있지 않다. 이번 diff(웹훅 hot path)도 같은 원칙을 따른다 — `hooks.service.ts` 는 `rewriteTriggerConfigLocked` 대신 자체 `update({id: trigger.id}, ...)` 를 쓰지만, 그 `trigger` 는 `endpointPath` 로 조회되고 서명/HMAC 검증을 거친 뒤의 것이라 마찬가지로 안전하다.
  - 제안: 변경 불요. 다음에 이 헬퍼를 재사용하는 새 호출부가 추가될 때, 호출자가 workspace 검증을 생략하지 않도록 헬퍼에 선택적 `workspaceId` 파라미터를 받는 방어적 스코핑을 고려(이전 라운드 제안과 동일, 급하지 않음).

- **[INFO]** e2e/unit 테스트의 시크릿류 값은 전부 테스트 픽스처(실제 자격증명 아님) — 재확인
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` 신규 테스트, `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts` 신규 테스트, `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
  - 상세: 신규 mock/픽스처는 `triggerRepo`/`nodeRepo` 등에 리터럴 mock 값(`id: 'n'`, `TRIGGER_ID = 'trig-x'` 등)만 쓰고, 실제 API 키·비밀번호·프로덕션 토큰 형태의 하드코딩된 시크릿은 없다.
  - 제안: 조치 불요.

- **[INFO]** 신규/변경 raw SQL 은 전부 파라미터 바인딩 — SQL 인젝션 경로 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(`SELECT pg_advisory_xact_lock(hashtext($1))`, `[triggerConfigLockKey(triggerId)]`) — 이번 라운드에 변경되지 않았지만 재확인. `hooks.service.ts` 의 신규 `update()` 호출은 TypeORM 쿼리 빌더 경유라 raw SQL 이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `codebase/backend/src/repo-guards/__tests__/*` 변경(콜백 경계를 넘어 `.catch` 래핑을 추적)은 빌드타임 정적 분석 가드/픽스처이며 런타임 보안 표면이 아니다
  - 위치: `endpoint-path-conflict-wrap-guard.ts`, `endpoint-path-conflict-wrap.spec.ts`, `fixtures/endpoint-path-save.fixture.ts`
  - 상세: 이 가드는 `manager.transaction(async (m) => m.save(Trigger, ...))` 형태로 저장이 트랜잭션 콜백 안으로 이동한 뒤에도 `endpointPath` UNIQUE 충돌 래핑(`rethrowEndpointPathConflict`)이 여전히 걸려 있는지 CI 에서 검증하는 테스트 전용 코드다. 정보 노출·인가 문제와는 무관하고, 오탐(래핑이 있는데 없다고 판정)을 막아 향후 실수로 래핑이 빠지는 것을 잡는 방어적 개선이다.
  - 제안: 조치 불요.

## 요약

이번 라운드의 실질 변경은 이전 라운드 concurrency WARNING#1 이 지적한 웹훅 hot path(`HooksService.handleWebhook`/`handleChatChannelWebhook`)의 `save(trigger)` 를 컬럼 한정 `update({id}, {lastTriggeredAt})` 로 좁힌 것이다. 이 경로는 PATCH-PATCH 경합보다 훨씬 자주 실행되는 자리였고, 고치기 전 상태로는 이 PR 시리즈가 닫으려던 것과 동일한 인증 우회 클래스(`inboundSigningRef` 유실 → 인입 웹훅 서명 검증 fail-open)가 인입 메시지마다 재발할 수 있었다. 이번 diff 로 그 경로의 쓰기가 `config` 를 건드리지 않는 단일 컬럼으로 좁혀져 lost-update 자체가 구조적으로 불가능해졌고, 동반 테스트가 `save` 미호출 + patch 키 단일성을 함께 단언해 회귀를 막는다. 함께 포함된 정적 가드 변경은 저장 래핑 추적 로직을 트랜잭션 콜백 경계까지 확장하는 CI 전용 개선으로 보안 표면과 무관하다. 그 외 파라미터화 쿼리·시크릿 하드코딩 부재·워크스페이스 스코핑(현재 안전, 헬퍼 자체는 id 단일 스코핑이나 모든 호출부가 사전 검증됨) 등은 이전 라운드에서 이미 검토·수용된 항목의 재확인이며 변화가 없다. 신규 CRITICAL/WARNING 없음.

## 위험도

NONE
