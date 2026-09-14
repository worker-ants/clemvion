# Requirement Review — trigger-config-lost-update

## 컨텍스트

`plan/in-progress/trigger-config-lost-update.md` 는 이미 13라운드의 `/ai-review` 를 거쳤고
(각 라운드가 Critical/Warning 을 실측·뮤테이션으로 검증하며 처분), 이번 라운드(01_42_04)의
diff 는 그 13라운드째(스케줄 cascade 삭제 락 + 상한 단언·반쯤 삭제 로깅)에 해당한다. 아래는
그 위에서 「의도한 기능을 완전히 구현했는가」 관점으로 실제 소스(`trigger-config-lock.ts` ·
`triggers.service.ts` · `chat-channel-binder.service.ts` · `schedules.service.ts` ·
`hooks.service.ts` 및 대응 spec·e2e)를 직접 읽어 대조한 결과다.

## 검증한 것 (기능 완전성)

- **락 프리미티브** (`trigger-config-lock.ts`): `acquireTriggerConfigLock`(옵션 `timeoutMs` 시
  `SET LOCAL lock_timeout` → `pg_advisory_xact_lock`) · `rewriteTriggerConfigLocked`(락 안 재읽기
  → `!fresh` 면 `false` 반환·머지 미호출 → `config` 를 `columns` **뒤에** 스프레드) — JSDoc 이
  약속한 계약과 `trigger-config-lock.spec.ts` 의 8개 케이스(순서·바인딩·null/undefined 좁히기·
  스프레드 순서·행 삭제 시 false)가 정확히 일치함을 코드 대조로 확인.
- **`TriggersService.update()`(창 1)**: `save(entity)` 계약을 유지한 채 락 안에서 재읽은 행을
  저장 대상으로 쓰도록 전환됐고, `previousInboundSigningRef` 를 락 안에서 재계산(`fresh?.config`)
  하는 것도 확인 — 요청 시작 시점 값에만 의존했다면 이 PR 이 닫으려는 결함이 재발했을 자리.
- **`ChatChannelBinderService.setupChatChannel()`**: 성공·실패 두 경로가 `buildChannel` 하나를
  공유하고, `survivesWithFresh(freshConfig)` 로 presence 게이트를 락 안에서 재계산 — 컨테이너만
  다시 읽는 것으로는 부족하다는 8라운드 교훈이 실제 코드에 반영돼 있음을 확인.
- **`rotateBotToken` / `revokePerTriggerToken` / `normalizeNotificationSecretRef` /
  `promoteRotatedNotificationSecrets`**: 전부 `mergeIntoFreshSubKey`(하위 키 기준 병합, delta 만
  patch)로 통일돼 있고, `rotateBotToken` 의 `patch` 가 `mergedChannel` 전체가 아니라
  `{...configUpdates, botTokenRef, inboundSigningRef}` 델타로 좁혀져 있음을 라인 단위로 확인
  (`triggers.service.ts:1320-1330`) — 10라운드에서 지적된 「헬퍼를 쓰면서 헬퍼가 막으려던 결함을
  낸」 자리가 실제로 고쳐져 있다.
- **삭제 경로 둘 다 같은 락**: `TriggersService.remove()`(`triggers.service.ts:1025-1039`)와
  `SchedulesService.remove()`(`schedules.service.ts:313-331`) 모두
  `acquireTriggerConfigLock(m, id, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })` 뒤 삭제, 실패
  시 `logger.error` + rethrow — CHANGELOG 의 "삭제 경로 둘 다 같은 락을 잡는다" 서술과 코드가
  일치. `schedules.service.spec.ts:609-632` 가 `[timeout, lock, delete]` **순서**를 단언(존재만
  보는 대신)해 상한 제거 뮤턴트를 잡는 구조인 것도 확인.
- **웹훅 인입 hot path**: `hooks.service.ts` 두 호출부(`handleWebhook`·chat-channel 인입) 모두
  `touchLastTriggeredAt()` 으로 통합돼 `triggerRepository.update({id}, {lastTriggeredAt})` 컬럼
  한정 갱신을 쓰고, `hooks.service.spec.ts` 가 두 자리를 **서로 다른 제목**으로 각각
  `Object.keys(patch)` 단일 키 단언 — 10라운드에서 지적된 "한쪽만 테스트가 있어 다른 쪽이
  되돌려져도 GREEN" 결함이 재발하지 않도록 대칭 테스트가 실제로 존재함을 확인.
- **e2e** (`trigger-config-lost-update.e2e-spec.ts`): 테스트가 advisory lock 을 직접 쥐어 겹침을
  강제하고, 판별 단언 3개(B 의 PATCH 값 / A 가 확립한 ref / A 의 손대지 않은 키) + 공허성 가드
  (④ B 가 아직 미완임을 관측)까지 갖춘 구조 — "분기를 못 가르는 fixture" 함정을 피한 설계.
- **repo-guard 확장** (`endpoint-path-conflict-wrap-guard.ts` / fixture): `manager.transaction`
  안으로 들어간 `m.save(Trigger, target)` 형태를 `TRIGGER_ENTITY` 첫 인자 판별로 잡고, 콜백
  경계를 넘어 `.catch` 를 추적하도록 확장 — 음성 대조군(`managerSaveOtherEntity`)까지 포함해
  래칫이 과잉 확장되지 않았음을 확인.

## 발견사항

- **[INFO]** `rotateNotificationSecret` / `cleanupRotatedChatChannelTokens` /
  `SchedulesService.update()` 의 trigger 컬럼 동기화는 여전히 `trigger-config` advisory lock
  도메인 **밖**에서 컬럼만 `update()` 한다. 이론상 `TriggersService.update()`(창 1, 락 안에서
  `fresh` 를 읽어 `save(target)` 하는 full-entity save)가 **같은 트랜잭션이 진행 중인 사이에**
  이 컬럼들 중 하나가 커밋되면, 창 1 의 `save` 가 그 컬럼을 `fresh` 읽기 시점 값으로 되돌릴 수
  있는 창이 남는다(READ COMMITTED 하 통상적 TOCTOU).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`rotateNotificationSecret`
    — 함수 `rotateNotificationSecret`, `cleanupRotatedChatChannelTokens` — 함수
    `cleanupRotatedChatChannelTokens`); `codebase/backend/src/modules/schedules/schedules.service.ts`
    (`update()` 의 trigger 컬럼 동기화 블록).
  - 상세: 이것은 **이미 plan §후속(8라운드 W4 · 9라운드 W2)에 명시적으로 등재되고 의도적으로
    유예된 항목**이라 이번 라운드가 만든 새 결함은 아니다. 다만 CHANGELOG 서두의 "`config` 를
    다시 쓰는 **모든 자리**를 닫았다"는 문장은 `chatChannel`/`inboundSigningRef` 를 잃는 **fail-
    open 경로**에 한정된 것이지, 컬럼 단위의 모든 잔여 lost-update 창을 닫았다는 뜻이 아니다 —
    문장 자체는 본문에서 "컬럼만 고치려던 자리가 의도치 않게 엔티티 전체를 저장하던 경로" 로
    좁혀 정확히 서술하고 있으므로 CHANGELOG 오류는 아니지만, 표제만 읽으면 과대해석될 여지가
    있다.
  - 제안: 코드 변경 불요(이미 스코프 밖으로 합의됨). 다음 세션에서 이 항목을 닫을 때 CHANGELOG
    표제 문장 옆에도 "fail-open 축 한정" 임을 한 번 더 못박으면 다음 사람이 "모든 자리" 를
    글자 그대로 읽는 재발을 막을 수 있다(문서 정밀화 제안이며 spec 변경은 아님).

- **[INFO]** spec fidelity — 이 PR 은 `spec/` 을 건드리지 않고(`spec_impact: none`), 이 범위의
  동시성/락 설계를 명시하는 전용 spec 문서도 없다(회귀 결함 수정이며 API 계약·필드·상태 전이
  변경 없음). `spec/5-system/15-chat-channel.md` §PATCH 재사용 행("기존 `inboundSigningRef`
  그대로 사용")과 이 수정의 동작(재읽은 행의 ref presence 를 게이트에 더함)이 상충하지 않음을
  확인 — 오히려 그 표가 약속한 "변경 없음" 을 동시성 상황에서도 실제로 지키게 만드는 수정이다.
  spec 문서 자체의 결함은 발견되지 않았다.

- **[INFO]** `SchedulesService.remove()` 가 `secrets.deleteByPrefix`·`chatChannelBinder.
  teardownChatChannel` 등 리소스 정리 없이 trigger 행만 지운다 — `TriggersService.remove()` 와
  비교하면 비대칭이다. 다만 이 gap 은 `origin/main` 에도 이미 있던 것이고(이 diff 는 `삭제`
  라인에 `acquireTriggerConfigLock` 만 추가), schedule 타입 트리거는 chatChannel 을 가질 수
  없어 이 PR 의 표적(fail-open)과는 무관하다. 이번 diff 가 만든 새 결함이 아니므로 이 라운드의
  범위 밖으로 판단한다(참고로만 기록).

## 요약

`trigger.config` lost-update 를 닫는다는 이 PR 의 핵심 요구사항(동시 PATCH 가 `chatChannel.
inboundSigningRef` 를 지워 인입 서명 검증이 fail-open 으로 돌아가는 경로 차단)은 네 개 쓰기
창·삭제 경로 둘·웹훅 인입 hot path 둘까지 전부 라인 단위로 대조한 결과 실제로 구현돼 있고,
각 자리마다 대응하는 단위/e2e 테스트가 뮤테이션으로 검증된 상태다(플랜 문서의 13라운드 히스토리
와 실제 코드가 서로 어긋나지 않음을 확인). 새로운 CRITICAL/WARNING 은 발견하지 못했다 — 유일한
잔여 사항은 plan 이 이미 의도적으로 스코프 밖으로 유예한 컬럼 단위 TOCTOU 후속 항목들이며, 이는
이번 diff 의 결함이 아니라 별도로 추적되는 후속 작업이다.

## 위험도

NONE
