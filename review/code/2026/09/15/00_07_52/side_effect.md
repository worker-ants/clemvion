# 부작용(Side Effect) 리뷰 — trigger-config-lost-update

## 검토 범위

`trigger.config` 동시 PATCH lost-update(및 `inboundSigningRef` fail-open) 수정. 핵심 변경은
신규 `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(advisory lock + 락 안
재읽기 유틸)와 그 배선처(`triggers.service.ts`·`chat-channel-binder.service.ts`·
`schedules.service.ts`·`hooks.service.ts`), 그리고 정적 가드(`endpoint-path-conflict-wrap-guard.ts`)
확장이다. `review/**`·`plan/**`는 강제 워크플로 산출물이라 side-effect 관점에서 별도 지적
대상이 아니다.

## 발견사항

- **[INFO]** 새 전역(프로세스 아님, DB 세션) 공유 블로킹 자원 — 트리거 단위 advisory lock
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — `acquireTriggerConfigLock`, `TRIGGER_CONFIG_LOCK_PREFIX`
  - 상세: `pg_advisory_xact_lock(hashtext('trigger-config:<id>'))` 는 이번 PR 이 새로 도입하는 DB 레벨 공유 상태다. 같은 트리거에 대한 동시 쓰기 경로 다수(`TriggersService.update()`·`remove()`·`rotateBotToken`·`normalizeNotificationSecretRef`·`revokePerTriggerToken`·`promoteRotatedNotificationSecrets`·`cleanupRotatedChatChannelTokens`·`ChatChannelBinderService.setupChatChannel` 성공/실패 경로)가 이 락을 공유하게 되어, 이번 배치 이전에는 서로 독립적으로 완료되던 요청들이 이제 상호 직렬화된다. 대기 상한이 없다(삭제만 예외). 이 자체는 결함 수정의 의도된 부작용이고 database.md/concurrency 리뷰에서 이미 INFO/WARNING 으로 수용됐지만, side-effect 관점에서 "새 공유 상태 도입"이라는 사실 자체는 기록해 둔다.
  - 제안: 조치 불요(설계 의도). 다만 향후 이 락의 임계 구간에 외부 호출/긴 계산을 추가하는 변경이 들어오면 `lock_timeout` 추가가 필수라는 점을 코드 리뷰 체크리스트에 남겨 둘 만하다(이미 JSDoc 에 명시됨).

- **[INFO]** `ChannelListenerRegistry.register()` 호출이 조건부로 바뀜(in-memory 레지스트리 부작용 변경)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — `setupChatChannel` 성공 경로, `if (wrote) { this.channelListenerRegistry.register(...) }`
  - 상세: 종전에는 `triggerRepository.update()` 호출 후 무조건 `channelListenerRegistry.register()` 를 불렀다(그 update 가 행 존재 여부와 무관하게 항상 "성공"으로 resolve 됐으므로). 이제는 `rewriteTriggerConfigLocked()` 가 락 안 재읽기에서 트리거가 삭제된 것을 발견하면 `false` 를 반환하고, 그 경우 등록을 스킵한다. 콜백/이벤트 발생 시점과 조건이 바뀌는 변경이라 점검 관점 8("이벤트/콜백")에 해당하지만, 의도된 개선(삭제된 트리거에 대한 유령 registry entry 방지)이고 이미 코드 주석과 이전 라운드 리뷰(side_effect INFO#4)에 문서화되어 있다.
  - 제안: 조치 불요.

- **[INFO]** `TriggersService.remove()` 가 삭제 실패 시 새 로그 부작용 추가 + 에러 유형 변화 가능성
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()`, `.catch((err) => { this.logger.error(...); throw err; })`
  - 상세: 삭제 경로가 이제 advisory lock(5초 타임아웃)을 잡은 뒤 `m.remove(trigger)` 하도록 트랜잭션으로 감쌌다. 락 대기가 타임아웃되면 Postgres `55P03` 에러가 새로 발생할 수 있는 에러 유형이며(종전엔 이 경로에 락이 없어 이 에러 클래스 자체가 없었다), catch 블록이 `this.logger.error`로 "반쯤 삭제된 상태" 경고를 새로 남긴 뒤 그대로 rethrow 한다. 컨트롤러(`triggers.controller.ts:187`)는 그대로 `await` 해 전파하므로 최종적으로 클라이언트에 노출되는 응답(500)은 기존과 동일한 방식으로 처리되지만, 서버 로그에 새로운 부작용(에러 로그 라인)이 생기고 실패 조건의 집합이 넓어진다(기존 FK/DB 오류 + 신규 lock timeout). 설계 의도(조용한 지연보다 드러나는 오류)로 문서화돼 있어 결함은 아니다.
  - 제안: 조치 불요. 운영 관점에서 이 새 에러 로그 패턴이 알람/모니터링 룰에 걸리는지만 후속으로 확인하면 좋다.

- **[INFO]** `SET LOCAL lock_timeout` 문자열 보간 — 사용자 입력 미도달 확인
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — `acquireTriggerConfigLock`, `` `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` ``
  - 상세: 파라미터 바인딩이 불가능한 자리라 문자열 보간을 썼다. `Math.trunc()` 로 숫자로 강제하고, 실제 호출부는 전부 모듈 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 하나만 넘긴다(`grep` 확인: `acquireTriggerConfigLock(m, id, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })` 단일 호출부). 사용자 입력이 이 값에 닿는 경로는 없다 — 인젝션 위험 없음. 이미 JSDoc 에 명시돼 있고 이전 라운드에서도 확인된 사항이라 재확인 차원의 기록.
  - 제안: 조치 불요.

- **[INFO]** 함수 시그니처 변경은 전부 `private` 범위 내부 — 외부 호출자 영향 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `findById()`/`update()`/`remove()`/`rotateBotToken()` 등 공개 메서드의 시그니처(파라미터·반환 타입)는 변경 없음. 신규 `private` 헬퍼(`assertTriggerFound`, `mergeIntoFreshSubKey`, `throwTriggerNotFound`, `findByIdForUpdate`)와 `hooks.service.ts`의 `private touchLastTriggeredAt()` 만 추가됐다.
  - 상세: 클래스 외부에서 관측 가능한 인터페이스(공개 메서드 시그니처, 컨트롤러가 소비하는 반환 타입)는 동일하게 유지된다. `trigger-config-lock.ts`의 신규 export(`triggerConfigLockKey`, `acquireTriggerConfigLock`, `rewriteTriggerConfigLocked`, `TRIGGER_DELETE_LOCK_TIMEOUT_MS`, `TRIGGER_CONFIG_LOCK_PREFIX`)와 `chat-channel-input-rules.ts`의 `extractInboundSigningRef` 는 모두 신규 추가(additive)이며 기존 export 를 제거·변경하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 테스트 mock 헬퍼(`withTransactionMock`)가 6개 spec 파일이 공유하는 `getRepositoryToken(Trigger)` provider 표면에 `manager` 를 추가 — 실사용은 2개뿐
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`, 적용처 `triggers.service.spec.ts`·`triggers.web-chat.spec.ts`
  - 상세: 헬퍼 JSDoc 이 스스로 명시하듯 Trigger repo mock 을 쓰는 파일이 6개 있고 이번엔 트랜잭션 경로를 타는 2개만 이관했다. 나머지 4개(`auth-configs`·`external-interaction`·`hooks`·`schedules` 관련 spec)는 지금은 트리거 서비스의 트랜잭션 경로를 호출하지 않아 영향이 없지만, 향후 그 경로를 호출하도록 바뀌면 `Cannot read properties of undefined (reading 'transaction')` 로 깨질 잠재적 자리다. 테스트 전용이라 프로덕션 부작용은 아니지만, "일부만 이관"이 다음 사람에게 남기는 잠재적 실패 지점이라 기록한다(코드 주석에 이미 명시되어 있어 새로운 지적은 아님).
  - 제안: 조치 불요(문서화됨). 백로그 성격.

- **[INFO]** e2e 신규 테스트가 트랜잭션 밖 raw SQL로 advisory lock 을 직접 잡고, cleanup 은 raw `DELETE` — 격리·부작용 관례 확인
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
  - 상세: 테스트가 `lockDb.query('SELECT pg_advisory_xact_lock(...))` 로 운영 코드와 같은 락 키 네임스페이스를 직접 조작해 경합을 결정적으로 재현한다. 이는 실제 프로덕션 자원(advisory lock 키 공간)을 테스트가 점유하는 것이지만, 트랜잭션 스코프(`BEGIN`/`COMMIT`)로 한정되어 테스트 종료 시 자동 해제되며 다른 트리거 id 를 새로 생성해 사용하므로 다른 테스트와 충돌하지 않는다. `afterAll` 의 raw `DELETE FROM trigger`는 서비스 계층(`remove()`)을 우회해 secret_store/리스너 정리를 건너뛰지만, 이는 기존 `trigger-workflow-ref.e2e-spec.ts` 의 확립된 관례를 따른다고 주석이 명시한다(신규 패턴 아님).
  - 제안: 조치 불요.

## 확인했으나 이슈 없음

- `hooks.service.ts`의 `touchLastTriggeredAt()`은 두 호출부(`handleWebhook`, chat-channel 인입)가 기존과 동일하게 `trigger.lastTriggeredAt` 을 in-memory 로도 갱신하고 컬럼만 DB 에 반영한다 — `save()` → `update()` 전환이지만 두 호출부의 관측 가능한 부작용(DB 컬럼 값, in-memory 필드)은 동일하게 유지된다.
- `schedules.service.ts`의 `save(trigger)` → 컬럼 한정 `update()` 전환에서 `Schedule.trigger` 관계는 `@ManyToOne(() => Trigger, { onDelete: 'CASCADE' })`로 `cascade: true` 가 없어, 이어지는 `scheduleRepository.save(schedule)` 이 `trigger` 서브엔티티를 다시 저장(cascade)하며 방금 한 컬럼 갱신을 스냅샷으로 덮어쓸 위험은 없다 — 확인 완료.
- `TriggersService.update()` 의 window 1(창 1)에서 저장 대상이 `trigger`(요청 시작 시점 in-memory 객체)에서 `target`(락 안에서 재읽은 별도 객체 참조)으로 바뀌지만, 이후 코드(`saved.id`/`saved.type`/`syncScheduleActivation(saved, ...)`/`normalizeNotificationSecretRef(saved)`/재조회 로직)는 모두 `saved`(반환값)를 통해 동일한 필드에 접근하므로 참조 identity 변화로 인한 회귀는 발견되지 않았다.
- 환경 변수 신규 읽기/쓰기 없음(e2e 의 `process.env.E2E_BASE_URL` 은 기존 e2e 관례의 재사용).
- 신규 외부 네트워크 호출 없음 — 외부 호출(`adapter.setupChannel`/`teardownChannel`)은 기존과 동일한 자리에 그대로 있고, 이번 변경은 그 호출을 advisory lock **밖**에 유지하는 것이 핵심 설계 제약이다.

## 요약

이번 변경의 핵심 부작용은 "새 advisory lock 이라는 DB 세션 레벨 공유 상태 도입"과 "여러 쓰기 경로가 그 락으로 상호 직렬화된다"는 것인데, 이는 lost-update/fail-open 결함을 닫기 위한 의도된 설계이며 별도 concurrency/database 리뷰에서 이미 검토·수용됐다. 공개 메서드 시그니처·API 표면·환경 변수 사용은 변경되지 않았고, 신규 export 는 모두 additive 다. `ChannelListenerRegistry.register()` 호출 조건이 바뀌는 것과 `remove()` 의 신규 에러 로그·에러 유형 확장은 관측 가능한 부작용 변화이지만 둘 다 의도적으로 문서화된 개선이다. `schedules.service.ts`의 cascade 저장 여부를 직접 확인해 예상되는 lost-update 재발 경로가 없음을 검증했다. 차단 사유가 되는 CRITICAL/WARNING 급 부작용은 발견하지 못했다.

## 위험도

LOW
