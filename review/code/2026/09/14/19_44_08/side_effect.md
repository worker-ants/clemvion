# 부작용(Side Effect) Review

## 검토 범위

핵심 변경(`trigger-config-lock.ts` 신규, `chat-channel-binder.service.ts`·`triggers.service.ts`·
`hooks.service.ts` 의 write-site, 관련 테스트/가드 유틸)을 실제 소스로 열어 확인했다. 이전
라운드(`review/code/2026/09/14/19_07_43/side_effect.md`)가 이미 검증한 항목은 이번 라운드의
diff(커밋 `12ed21ff1`·`c7a9c107e`)로 재검증하고, 그 라운드가 다루지 않은 새 코드(창 1의
「재읽은 행」 저장 대상 전환, `hooks.service.ts` 의 `save→update` 전환)를 중심으로 봤다.
`review/`·`plan/`·`CHANGELOG.md` 는 산출물/문서라 런타임 부작용 관점에서는 해당 없음으로
처리했다.

## 발견사항

- **[CRITICAL]** "창 1"(`TriggersService.update()`)이 **동시 삭제와 겹치면 방금 지워진
  트리거를 되살린다** — `save()` 의 TypeORM insert-on-missing-row 시맨틱과 `fresh ?? trigger`
  폴백의 조합
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:557`(`m.findOne`)·
    `:582`(`const target = fresh ?? trigger;`)·`:584`(`return m.save(Trigger, target);`).
    대조군: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:108-109`
    (`if (!fresh) return false;`)
  - 상세: 이번 PR 이 고친 "창 2·3·4"(`rewriteTriggerConfigLocked`)는 락 안에서 다시 읽은 행이
    없으면(`!fresh`, 그 사이 트리거가 삭제됨) **쓰기를 skip 하고 `false` 를 반환**한다 —
    JSDoc 이 명시하는 계약이다. 그런데 같은 파일 안, 같은 락으로 보호되는 "창 1"은 이 계약을
    따르지 않는다: `fresh` 가 `null` 이면 요청 시작 시점에 읽은 **스테일 `trigger` 객체**를
    저장 대상으로 삼아 그대로 `m.save(Trigger, target)` 를 부른다.

    TypeORM 의 `save()` 는 대상 엔티티에 PK 가 있어도 무조건 UPDATE 하지 않는다 —
    `SubjectDatabaseEntityLoader` 가 **같은 트랜잭션 안에서** PK 로 존재 여부를 다시 조회하고,
    행이 없으면(`databaseEntity === undefined`) `Subject.mustBeInserted = canBeInserted &&
    !databaseEntity` 가 참이 되어 **INSERT** 를 실행한다(`node_modules/typeorm/persistence/
    Subject.js:107-108`, `EntityPersistExecutor.js:74` 의 `canBeInserted: this.mode === "save"`
    로 실측 확인 — 저장소 vendored TypeORM 소스를 직접 열어 확인했고 코드 자체를 고치지는
    않았다). 즉 `remove()` 가 커밋한 DELETE 를 창 1 의 `m.save` 가 **같은 id 로 재삽입해
    덮어쓴다.** `remove()`(`triggers.service.ts:893-922`)는 이 advisory lock 을 전혀 잡지
    않으므로(이미 `database.md`/`plan` 이 "삭제 레이스의 좁은 창"으로 추적 중인 사실) DELETE 는
    창 1의 트랜잭션 아무 시점에나 끼어들 수 있다.

    결과: 사용자가 트리거를 삭제했는데, 그 순간 다른 요청의 PATCH 가 겹치면 **200 OK 로 조용히
    성공**하면서 그 트리거가 (삭제 전 스냅샷 + 이번 PATCH 필드로) **되살아난다.** `remove()`
    가 이미 실행한 `teardownChatChannel`·`channelListenerRegistry.unregister`·
    `secrets.deleteByPrefix` 는 되돌려지지 않으므로, 되살아난 행은 이미 지워진 secret-store
    ref 를 가리키게 될 수 있고, `chatChannel` 이 이번 PATCH 에 실려 있으면
    `chatChannelBinder.setupChatChannel` 이 방금 되살린 트리거에 대해 **다시 provider
    setupChannel + listener 재등록**까지 수행한다 — 사용자가 명시적으로 끊은 통합이 그 사용자
    모르게 재활성화되는 셈이다. 감사 로그도 `TRIGGER_UPDATED` 만 남아 "삭제됐다가 되살아났다"
    는 사실이 어디에도 기록되지 않는다.

    이 PR 이 새로 만든 결함은 아니다(`save()` 기반 업데이트는 이 PR 이전에도 삭제-경합에
    같은 취약점을 갖고 있었다) — 다만 이 PR 은 **같은 파일 안에서 이 정확한 클래스의 문제를
    이미 알고 있었고(3곳에서 `!fresh` → skip 으로 명시 처리), 창 1 만 그 처리를 적용하지 않은
    채로** "락 + 재읽기"를 새로 얹어 경합 창(advisory lock 획득 + 추가 SELECT 왕복)을 넓혔다.
    또한 기존 `database.md`/`plan` 이 추적 중인 "삭제 레이스"는 전부 **무해한 orphan
    UPDATE**(창 2~4, 데이터 손상 없음)로 서술돼 있는데, 창 1 은 그와 **다른 등급** — 삭제된
    행의 **재생성**이다. 지금까지의 리뷰 라운드(18_17_44/19_07_43/19_44_08 다른 관점 파일들)
    어디에도 이 구분이 등재돼 있지 않다.
  - 제안: `!fresh` 를 `trigger` 폴백으로 삼지 말 것. 셋 중 하나를 권고: (a) `findById` 처럼
    `NotFoundException` 을 던져 락 재읽기 결과가 없으면 명시적으로 실패시킨다(창 2~4 의 "skip"
    계약과 일관), (b) `rewriteTriggerConfigLocked` 처럼 `update()`(부분 컬럼)로 바꿔 애초에
    INSERT 경로 자체를 차단한다 — 이 경우 반환 엔티티가 없어지므로 창 1 이 `save` 를 유지한
    원래 사유(반환 엔티티·UNIQUE 충돌 경로)를 다시 확인해야 한다, (c) 최소한 `remove()` 가
    같은 advisory lock 을 잡게 해 이 인터리빙 자체를 막는다(이미 "후속" 표에 다른 이유로
    등재돼 있는 항목과 동일한 수정으로 이 문제도 함께 닫힌다).

- **[WARNING]** (2라운드 `side_effect.md` WARNING 재확인 — 이번 라운드에서 **미해결**)
  `trigger.config` 를 락 없이 통째로 덮어쓰는 형제 write-site 3곳이 여전히 남아 있다
  - 위치: `triggers.service.ts:745-776`(`normalizeNotificationSecretRef`, 쓰기는 `:775`),
    `:982-1017`(`revokePerTriggerToken`, 쓰기는 `:1008`), `:1199-1260`
    (`promoteRotatedNotificationSecrets`, 쓰기는 `:1225`·`:1256`)
  - 상세: 세 메서드 모두 여전히 "한 번 읽은 `trigger`/`fresh` 를 `await` 뒤 그 스냅샷으로
    `config` 를 스프레드해 `triggerRepository.save(trigger)`" 패턴이다 — 이 PR 이 나머지
    4곳에서 걷어낸 것과 같은 모양의 lost-update 이고, 그중 하나(`revokePerTriggerToken`)가
    이 트리거의 `chatChannel.inboundSigningRef` 와 동시에 겹치면 이 PR 이 닫으려는 fail-open이
    인접 엔드포인트로 재현된다. `plan/in-progress/trigger-config-lost-update.md` §D/§후속이
    이 셋을 "이 PR 로 넓히지 않는다"고 명시적으로 유예했고 `revokePerTriggerToken` 을 최우선
    후속으로 적어 뒀으므로 **놓친 결함은 아니다** — 다만 이번 라운드 코드에서 실제로 그대로
    남아 있음을 재확인했고, 코드가 아니라 plan 문서에만 그 위험이 적혀 있어 이 파일들을
    단독으로 읽는 다음 개발자는 이 갭을 모를 수 있다.
  - 제안: 새 조치를 요구하지 않는다(이미 추적됨). 다음에 이 셋을 손볼 때는 §후속 표의
    우선순위(`revokePerTriggerToken` 최우선)를 그대로 따르는 것을 권고.

- **[INFO]** `hooks.service.ts` 의 `save(trigger)` → `update({id}, {lastTriggeredAt})` 전환 —
  실측으로 부작용 없음을 확인
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:232-236`,`:700-704`
  - 상세: `Repository.update()` 는 `@BeforeUpdate`/`@AfterUpdate`/`EntitySubscriberInterface`
    리스너를 타지 않는데, 저장소 전체에 `EventSubscriber`/`@BeforeUpdate`/`@AfterUpdate` 데코레이터가
    **0건**임을 grep 으로 확인했다(`grep -rn "EventSubscriber\|@BeforeUpdate\|@AfterUpdate"
    codebase/backend/src`) — 그래서 리스너 우회로 인한 부작용은 없다. `@UpdateDateColumn`
    (`trigger.entity.ts:162`, `updated_at`)도 `save()` 뿐 아니라 `Repository.update()`(내부
    `UpdateQueryBuilder`)가 **똑같이** `CURRENT_TIMESTAMP` 를 자동으로 얹는다는 것을 vendored
    TypeORM 소스(`typeorm/query-builder/UpdateQueryBuilder.js:403-406`)로 확인했다 — 두 자리
    모두 `trigger.lastTriggeredAt` 반환값을 소비하지 않던 기존 호출 패턴과 동일하다. 순수
    긍정 확인이며 조치 불필요.

## 검증한 것 — 부작용 없음으로 판정

- **`withTransactionMock`**(신규 테스트 유틸, `codebase/backend/src/modules/triggers/
  __test-utils__/trigger-transaction-mock.ts`)은 인자로 받은 mock 을 스프레드로 감싸 새
  객체를 반환할 뿐 원본을 mutate 하지 않는다(`manager` 가 이미 있으면 원본 참조를 그대로
  반환하는 것도 mutate 가 아니다) — 두 spec 파일(`triggers.service.spec.ts`,
  `triggers.web-chat.spec.ts`)이 같은 헬퍼를 부르지만 테스트 간 mock 오염 경로가 없다.
- **`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture** 변경은 `src/repo-guards/
  __tests__/` 하위의 정적 분석 전용 코드다 — 런타임에 로드되지 않고, 스캔 대상도
  `modules/triggers/` 로 한정돼 있어 무관한 코드를 잘못 집어내는 부작용이 없다.
- **새 export**(`rewriteTriggerConfigLocked`·`acquireTriggerConfigLock`·`triggerConfigLockKey`·
  `TRIGGER_CONFIG_LOCK_PREFIX`·`extractInboundSigningRef`)는 기존 함수 시그니처를 하나도 바꾸지
  않는 순수 추가다.
- **외부 네트워크 호출**(`adapter.setupChannel`·`this.secrets.rotate`·`this.secrets.resolve`)의
  호출 횟수·순서는 이번 라운드 diff 로 바뀌지 않았다 — 바뀐 것은 그 호출들이 끝난 뒤의 컬럼/
  config 쓰기 경로뿐이다.
- **환경 변수**: 새로 읽거나 쓰는 환경 변수 없음. **전역 변수**: 새 프로세스 전역 상태 없음
  (advisory lock 은 DB 쪽 공유 자원이며, 그 성격은 `concurrency.md`/`database.md` 가 이미
  다루므로 여기서는 중복 등재하지 않는다). **이벤트/콜백**: `channelListenerRegistry.register`
  호출 조건은 이전 라운드 대조(`git show`)에서 이미 diff 이전과 동일함이 확인됐고, 이번
  라운드 변경도 그 호출 자체를 건드리지 않는다(위 CRITICAL 항목이 지적하는 것은 그 호출이
  "되살아난 트리거"에 대해 **다시 실행될 수 있다**는 것이지, 호출 조건식 자체의 변경이 아니다).

## 요약

핵심 수정(창 2~4 의 advisory-lock 재읽기, `hooks.service.ts` 의 컬럼 한정 update, 새 테스트
유틸/가드)은 광고된 대로 동작하고 새 부작용을 만들지 않는다. 다만 같은 커밋이 "창 1"에 얹은
「락 안에서 재읽은 행을 저장 대상으로 쓴다」는 수정 자체가, 재읽은 행이 **없는**(동시 삭제)
경우의 처리를 나머지 세 창과 다르게 남겨 뒀다 — `fresh ?? trigger` 폴백이 TypeORM 의
save-or-insert 시맨틱과 만나 **동시 삭제된 트리거를 조용히 재삽입(되살림)** 하는 경로를
새로 넓혔다. 이는 이 PR 이 지금까지 추적해 온 "삭제 레이스는 무해한 orphan UPDATE" 라는
서술과 다른 등급의 결과(행 재생성)이고, 어느 라운드 리뷰에도 아직 등재되지 않았다. 그 밖에
2라운드 side_effect 리뷰가 지적한 "락 없는 형제 write-site 3곳"은 여전히 미해결이지만
plan 이 명시적으로 후속 등재해 둔 상태라 새 결함은 아니다.

## 위험도

HIGH
