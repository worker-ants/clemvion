# 요구사항(Requirement) Review

## 검토 범위

`trigger.config` lost-update(동시 PATCH/rotate/hot-path 가 서로의 `chatChannel.inboundSigningRef`
를 되돌려 인입 서명 검증이 fail-open 되는 결함) 수정 PR. 핵심 프로덕션 코드
(`trigger-config-lock.ts` 신규, `chat-channel-binder.service.ts`, `triggers.service.ts`,
`hooks.service.ts`, `chat-channel-input-rules.ts`)를 전문 Read 로 직접 열어 diff 가 생략된
자리까지 확인했고, 관련 유닛 테스트(`trigger-config-lock.spec.ts`,
`triggers.service.spec.ts` 신규 3건, `hooks.service.spec.ts` 신규 2건)·e2e
(`trigger-config-lost-update.e2e-spec.ts`)·plan(`plan/in-progress/trigger-config-lost-update.md`)
·관련 spec(`spec/2-navigation/4-integration.md` Cafe24 advisory-lock 기각 선례,
`spec/5-system/15-chat-channel.md` R-CC-21/CCH-SE-01/§5.4 에러표)을 대조했다.

## 발견사항

- **[INFO]** `rotateNotificationSecret`·`cleanupRotatedChatChannelTokens`·
  `schedules.service.ts#update` 등 7개 자리가 여전히 같은 클래스(무가드 full-entity
  `save()`)의 lost-update 위험을 안고 있다 — 이번 PR 은 미해결
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`rotateNotificationSecret`,
    line 1006-1009 부근 — `save(trigger)`가 `findById` 시점의 `trigger.config` 스냅샷을 함께
    싣는다)
  - 상세: 실제 확인 결과 이 함수는 `config` 를 건드릴 의도가 없는데도 `save(entity)` 가 통째로
    저장하는 부작용으로 동시 PATCH 가 그 사이 커밋한 `chatChannel.inboundSigningRef` 를 되돌릴
    수 있다 — 다만 이는 **이번 PR 이 새로 만든 결함이 아니고**, `plan/in-progress/trigger-config-lost-update.md`
    §"같은 클래스의 자리가 넷보다 많다"가 전수 열거(21건 스캔 → 8곳 `save(entity)`)로 이미
    찾아냈고, 명시적으로 후속으로 유예한다고 적어 뒀다. 요구사항 관점에서 지적할 새 결함이
    아니라 투명하게 추적된 기존 갭이라 판단해 등급을 INFO 로 둔다.
  - 제안: 조치 불요(추적됨). 후속 PR 착수 시 이 8곳을 순회할 것.

- **[INFO]** `rotateBotToken` 의 secret-store 쓰기(`secrets.rotate(botTokenRef, ...)`)가
  `rewriteTriggerConfigLocked` 의 삭제 가드보다 **먼저** 일어난다 — 동시 `remove()` 와 겹치면
  삭제된 트리거에 대한 고아 secret row 가 생길 수 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1159`
    (`await this.secrets.rotate(botTokenRef, ...)`) vs `:960-963` (`remove()` 의 락+삭제)
  - 상세: `rotateBotToken` 은 `findById` 직후 곧바로 secret store 에 새 토큰을 UPSERT 한 뒤,
    한참 뒤(`adapter.setupChannel` 호출 이후)에야 `rewriteTriggerConfigLocked` 로 삭제 여부를
    확인해 404 를 던진다. 그 사이 `remove()` 가 `secrets.deleteByPrefix` 를 먼저 끝내고
    트리거 행을 지우면, 방금 회전된 `botToken` secret row 는 삭제되지 않은 채로 남는다(고아
    row). 데이터 손상·보안 영향은 없고(고아 secret 은 다시 참조되지 않음), 이 PR 이 새로
    만든 경로도 아니다(회전 순서 자체는 이번 PR 이 바꾸지 않았다) — INFO 수준의 참고.
  - 제안: 조치 불요. 후속에서 `remove()` 의 `secrets.deleteByPrefix` 도 config 락 안으로
    옮기는 것을 고려할 수 있으나 이번 PR 범위 밖.

- **[INFO]** spec 문서에 이번 동시성 보장이 명문화돼 있지 않음(spec 누락, drift 아님)
  - 위치: `spec/5-system/15-chat-channel.md` (R-CC-21, CCH-SE-01), `spec/2-navigation/4-integration.md:1444`
  - 상세: 이번 수정은 `chatChannel.inboundSigningRef` 가 PATCH 후에도 보존되어야 한다는
    **기존에 이미 문서화된 불변식**(§5.4.1.1, `inboundSigningRef` 대칭 보존)을 동시성 하에서도
    지키도록 내부 구현을 고친 것이지, 새로운 외부 관찰 가능한 계약을 도입하지 않는다.
    `plan/in-progress/trigger-config-lost-update.md` frontmatter 의 `spec_impact: none` 이
    타당하다 — API 응답 형식·에러 코드·상태 전이 표는 그대로다(신규 404 도 기존
    `RESOURCE_NOT_FOUND` 코드 재사용, `spec/5-system/15-chat-channel.md:371` 과 정합). SPEC-DRIFT
    아님(코드가 spec 을 앞서가는 것이 아니라 spec 이 이미 요구한 불변식을 실제로 지키게
    고친 것) — 회색지대 INFO 로 분류.
  - 제안: 조치 불요.

## 교차검증 — CHANGELOG/JSDoc 서술 vs 실제 코드

CHANGELOG.md 와 각 파일 JSDoc 의 서술(네 창 전부 락 안으로, 삭제도 같은 락, 외부 호출은
락 밖, presence 게이트 재계산, 대기 상한 없음, hot path 컬럼 한정 update)을 실제 코드와
줄 단위로 대조했다 — 전부 일치한다:

- `trigger-config-lock.ts:106-143` (`rewriteTriggerConfigLocked`) — 락→재읽기→머지→쓰기 순서,
  `!fresh` 시 `false`, `columns` 뒤에 `config` 스프레드. 유닛 테스트
  (`trigger-config-lock.spec.ts`)가 순서·분기 전부를 독립적으로 고정.
- `chat-channel-binder.service.ts:189-321` — `survivesWithFresh` 가 재읽은 행의
  `extractInboundSigningRef` 를 세 번째 항으로 더함, 성공/실패 경로 둘 다
  `rewriteTriggerConfigLocked` 사용, 외부 호출(`adapter.setupChannel`)이 그 이전에 이미 완료.
- `triggers.service.ts:557-624`(update 창1) — `findByIdForUpdate`(가벼운 조회)→
  `acquireTriggerConfigLock`→재읽기(`relations:['workflow']` 포함)→`fresh` 없으면
  404→`m.save(Trigger, fresh)`. `:932-963`(remove) — `teardownChatChannel`(락 밖)→같은 락→
  `m.remove(trigger)`. `:1199-1229`(rotateBotToken) — `wrote===false` 시 404+감사 미기록.
- `hooks.service.ts:978-984`(`touchLastTriggeredAt`) — 두 호출부(`:227`,`:686`) 모두 `save`
  대신 컬럼 한정 `update`. `hooks.service.spec.ts` 가 두 호출부 모두에 대해
  `save` 미호출 + `update` patch keys `===['lastTriggeredAt']` 를 개별 검증(하나는
  `chatChannel` 트리거 경로 — CHANGELOG 가 명시한 "이전엔 한쪽만 테스트가 있었다"는
  자기반증 서술과 실제 diff 가 정확히 일치).
- `endpoint-path-conflict-wrap-guard.ts` — `manager.transaction(async (m) => ...).catch(...)`
  형태에서 `.catch` 가 콜백 바깥 체인에 붙는 것을 정적으로 따라가는 로직을 AST 상에서
  직접 추적해 확인했고(`ts.isFunctionLike(cur) && !ts.isCallExpression(cur.parent)` 정지
  조건), fixture(`managerSaveWrapped`/`Unwrapped`/`OtherEntity`) 세 케이스의 기대값과 일치함을
  손으로 재현했다.

새 404(`rotateBotToken` 삭제 경합)의 에러 코드(`RESOURCE_NOT_FOUND`)는
`spec/5-system/15-chat-channel.md:371` 이 이미 문서화한 코드와 동일해 계약 위반이 아니다.

## 요약

동시 PATCH/rotate/삭제가 `trigger.config` 를 스냅샷 기반으로 통째 덮어써
`chatChannel.inboundSigningRef` 를 잃고 인입 서명 검증이 fail-open 되던 lost-update 를,
advisory lock(`pg_advisory_xact_lock`) + "락 안에서 재읽어 머지" 패턴으로 네 창(창1
`update()`, binder 성공/실패, `rotateBotToken`) 모두와 삭제 경로까지 닫은 수정이다. 프로덕션
코드를 직접 읽어 CHANGELOG·JSDoc 의 모든 구체적 서술(락 순서, presence 게이트 재계산, 외부
호출을 락 밖에 두는 설계, 삭제 시 창별로 다른 부재 처리, hot path 컬럼 한정 update)이 실제
구현과 정확히 일치함을 확인했다. 엣지 케이스(행 삭제 후 재읽기, `chatChannel` 미포함 PATCH,
빈/`null`/`undefined` config)에 대한 유닛·e2e 테스트가 각 분기를 독립적으로 고정하고 있고,
정적 분석 가드(`endpoint-path-conflict-wrap-guard.ts`)의 AST 순회 로직도 새 `manager.transaction`
형태를 정확히 따라간다. spec 관점에서는 이번 수정이 이미 문서화된 불변식(inboundSigningRef
보존)을 동시성 하에서 실제로 지키게 만드는 내부 구현 수정이라 `spec_impact: none` 이 타당하고,
새 에러 코드도 기존 spec 표와 일치한다. 남은 항목(다른 7곳의 같은 클래스 lost-update,
rotateBotToken-remove 간 고아 secret row 가능성)은 이번 PR 범위 밖이며 plan 문서에 이미
투명하게 추적돼 있어 차단 사유가 아니다. 요구사항 충족 관점에서 CRITICAL/WARNING 급 결함은
발견하지 못했다.

## 위험도

LOW
