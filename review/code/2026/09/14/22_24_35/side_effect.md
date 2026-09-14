# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** `UpdateTriggerDto.config`(raw 필드)를 PATCH 에 실으면 이번 PR 이 도입한 락 안 재읽기 병합을 우회해, 이 PR 이 닫으려는 바로 그 fail-open 클래스가 그대로 재현된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 트랜잭션 콜백의 `const baseConfig = this.stripInlineAuthKeys(config ?? fresh?.config ?? trigger.config ?? {});` (함수 `TriggersService.update`, `acquireTriggerConfigLock` 블록 내부). DTO 선언은 `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` 의 `config?: Record<string, unknown>;` (`@IsObject()`, `additionalProperties: true`, 예시 `{ method: 'POST' }` — 문서화된 공개 API 필드, `chatChannel`/`notification`/`interaction` 과 상호 배타 검증 없음).
  - 상세: 이번 PR 의 핵심 처방은 "락 안에서 다시 읽은 행(`fresh.config`)을 병합 기준으로 삼는다"이고, `chatChannel` 을 아예 싣지 않은 PATCH 에 대해서는 이 처방이 정확히 적용돼 있다(§D 의 "창 1" 수정, `review/code/2026/09/14/18_17_44` security CRITICAL#1 대응). 그런데 클라이언트가 `config` 필드를 **명시적으로** 채워 보내면 `baseConfig` 는 `fresh?.config` 를 건너뛰고 **요청 바디의 `config` 값 그 자체**가 된다. 즉 같은 트리거에 대해 (a) 동시에 커밋된 다른 요청(예: `chatChannel` PATCH 가 확립한 `inboundSigningRef`, `revokePerTriggerToken`/`rotateNotificationSecret`/`normalizeNotificationSecretRef` 등이 방금 쓴 `interaction`/`notification` 서브키)과 (b) `config` 를 실은 이 PATCH 가 겹치면, 이 PATCH 의 커밋이 그 서브키들을 **조용히 지운다** — 이 PR 이 CHANGELOG 에서 "«모든 자리»를 참인 문장으로 만든다" 고 선언한 바로 그 lost-update/fail-open 이, 닫았다고 표시된 창 1 자체 안에서 이 요청 형태로는 여전히 열려 있다. `config` 는 자유 스키마 객체라 클라이언트가 `chatChannel`/`interaction`/`notification` 하위 구조를 알 이유가 없으므로(예: `{ method: 'POST' }` 처럼 무관한 목적으로 보낸 값), 우연히 그 서브키를 포함하지 않는 한 항상 이 경로를 탄다. `plan/in-progress/trigger-config-lost-update.md` 는 7라운드에 걸쳐 "config 를 다시 쓰는 자리" 를 함수 단위로 전수 열거하고 닫았음을 검증했지만(§ "전수 재확인" — `save(` 3건 전부 신규 INSERT), 같은 함수(`update()`) 안에서 **요청 바디의 형태에 따라 병합 기준이 갈리는** 이 경로는 어느 라운드의 표에도, "후속(developer 범위)" 목록에도, `## 하지 않는 것` 절에도 등장하지 않는다 — grep 으로 확인(`dto\.config|config 필드|raw.*config`, plan 전체 + 14개 리뷰 라운드 산출물).
  - 제안: 이 경로도 §D 창 1 과 같은 규율로 닫거나(예: `config` 가 명시된 경우에도 `fresh?.config` 위에 얕은 병합 — 단 그러면 "클라이언트가 `config` 전체를 의도적으로 교체한다" 는 기존 계약과 충돌하므로 설계 판단이 필요하다), 최소한 이 PR 의 "모든 자리를 닫았다" 는 완결 선언 옆에 이 잔여 경로를 §D 스타일로 명시적으로 등재해 다음 사람이 "config 재작성은 이제 전부 안전하다" 고 오해하지 않게 한다. 판단은 developer/plan 소유자 몫이므로 여기서는 사실만 보고한다.

- **[INFO]** `acquireTriggerConfigLock` 의 `SET LOCAL lock_timeout` 문자열 보간 — 이미 별도 라운드(side_effect WARNING#6, database INFO)에서 지적·수용된 항목의 재확인
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:57` (`` `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` ``)
  - 상세: 파라미터 바인딩이 불가능한 자리라 문자열 보간을 쓰지만, `Math.trunc()` 로 정수만 들어가게 강제하고 프로덕션 호출부는 모듈 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`)만 넘긴다(전수 확인: `triggers.service.ts` 삭제 경로 한 곳뿐). 사용자 입력이 이 값에 닿는 경로는 없다. 이 `SET LOCAL` 은 advisory lock 하나가 아니라 **그 트랜잭션의 모든 락 대기**(뒤따르는 `DELETE` 행 잠금·CASCADE 포함)에 적용된다는 점도 JSDoc 에 이미 명시돼 있다. 새로운 위험은 없음 — side-effect 관점에서 "세션/트랜잭션 설정을 SQL 로 변경한다" 는 사실 자체를 기록해 둔다.
  - 제안: 조치 불요(이미 수용됨).

- **[INFO]** `ChannelListenerRegistry.register()` 호출이 무조건 → `wrote` 조건부로 바뀜 — 의도된 콜백 배선 변경
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:286-289` (`if (wrote) { this.channelListenerRegistry.register(trigger.id, chatChannelCfg.provider); }`)
  - 상세: 종전엔 `setupChatChannel` 성공 시 DB 쓰기 결과와 무관하게 listener registry 에 항상 등록했다. 이제 `rewriteTriggerConfigLocked` 가 삭제 경합으로 쓰기를 skip 했으면(`false`) 등록도 건너뛴다. in-memory registry 에 대응하는 DB 행이 없는 유령 entry 가 남는 것을 막는 의도된 변경이고, 4·5라운드 리뷰에서 음성/양성 대조군으로 이미 테스트가 걸려 있다(`chat-channel-binder.service.spec.ts` 등). 부작용 관점에서 "콜백 호출 조건이 바뀌었다" 는 사실만 기록 — 새 결함 아님.
  - 제안: 조치 불요(이미 검증됨).

## 요약

이번 변경은 `trigger.config` lost-update 를 닫기 위해 advisory lock + 락 안 재읽기 패턴을 도입하고, 7라운드에 걸쳐 "config 를 다시 쓰는 모든 write-site" 를 함수 단위로 전수 열거해 `save()`/`update()` 형태별로 닫았다 — 그 과정에서 side effect 관점의 이슈들(유령 listener 등록, 반쯤 삭제된 트리거, `SET LOCAL` 의 범위, 반환값 관측 등)은 이미 스스로 상세히 문서화·검증했다. 다만 그 "write-site 전수 열거" 는 **함수 단위**였고, 같은 함수(`TriggersService.update()`) 안에서 **요청 바디의 형태**(`chatChannel`/`notification`/`interaction` 구조화 필드 vs `UpdateTriggerDto.config` 원시 필드)에 따라 병합 기준이 갈린다는 축은 어느 라운드에서도 열거되지 않았다. `config` 필드가 명시되면 병합 기준이 `fresh?.config`(락 안 재읽은 최신 행)가 아니라 요청 바디 그대로가 되어, 동시에 커밋된 `chatChannel.inboundSigningRef`/`interaction`/`notification` 서브키가 조용히 사라질 수 있다 — 이는 이 PR 이 닫았다고 선언한 것과 같은 결함 클래스가, 닫힌 것으로 표시된 바로 그 창 안에 남아 있는 경우다. 그 밖에 확인한 side effect(SET LOCAL 의 세션 범위, listener 등록 조건화, in-memory 필드 갱신, `save`→`update` 전환에 따른 TypeORM 동작 변화 등)는 모두 이미 다수 라운드에 걸쳐 문서화·테스트로 고정되어 새로운 위험이 없다.

## 위험도

MEDIUM
