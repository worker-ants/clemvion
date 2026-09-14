# 부작용(Side Effect) Review — trigger-config-lost-update (6라운드)

## 검토 범위 및 방법

`codebase/backend/src/modules/{hooks,triggers}/**` 15개 파일(운영 코드 5 + 테스트/가드 10) 의
최종 diff를 실제 소스 파일(`Read`)로 대조했다. 이 PR은 이미 5라운드의 `/ai-review`
(`18_17_44`~`20_49_15`)를 거쳤고, `plan/in-progress/trigger-config-lost-update.md`가 각
라운드의 지적·처분·뮤테이션 실측을 기록해 두고 있어, 그 기록과 실제 코드 상태가 일치하는지
확인하는 방식으로 진행했다. 저장소에 쓰기는 하지 않았다(`git status --short` 로 확인 —
이 세션이 만든 산출물 디렉터리 외 변경 없음). 아래는 이전 5라운드가 아직 짚지 않은 두 가지
신규 관측이다.

## 발견사항

- **[WARNING]** 삭제 경로의 `SET LOCAL lock_timeout` 이 advisory lock 획득 한 줄이 아니라
  **그 트랜잭션의 이후 모든 lock wait**(DELETE 자체의 row-lock, FK CASCADE 로 인한 연쇄 lock
  포함)에 적용된다 — JSDoc이 서술하는 범위보다 실제 부작용 범위가 넓다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:44-50`
    (`acquireTriggerConfigLock` 의 `SET LOCAL lock_timeout = '${...}ms'`) 와 그 호출부
    `codebase/backend/src/modules/triggers/triggers.service.ts:968-974` (`remove()` 의
    `manager.transaction(async (m) => { await acquireTriggerConfigLock(m, id, { timeoutMs:
    TRIGGER_DELETE_LOCK_TIMEOUT_MS }); await m.remove(trigger); })`)
  - 상세: PostgreSQL 의 `SET LOCAL lock_timeout` 은 "다음 lock 획득 시도 하나"가 아니라
    **현재 트랜잭션이 끝날 때까지의 모든 lock wait**에 적용되는 세션 파라미터다. `remove()`
    는 advisory lock 을 잡은 **같은 트랜잭션 안에서** 곧바로 `m.remove(trigger)` (`DELETE FROM
    trigger ...`)를 실행하는데, `Schedule.triggerId` 는 `onDelete: 'CASCADE'`
    (`codebase/backend/src/modules/schedules/entities/schedule.entity.ts:28`)로 걸려 있어 이
    `DELETE` 한 문장이 `schedule` 테이블 CASCADE 삭제까지 같은 statement 안에서 수행한다.
    그 사이 그 trigger 행 또는 연쇄된 `schedule` 행을 잡고 있는 **다른** 쓰기(예: 같은 plan
    문서 §D "후속" 표가 명시적으로 이 락에 아직 참여시키지 않은 `rotateNotificationSecret` ·
    `normalizeNotificationSecretRef` · `promoteRotatedNotificationSecrets` · schedule 갱신
    등)가 5초 이상 그 행을 붙들고 있으면, 종전(설정 안 함 = Postgres 기본값 0 = 무제한 대기)과
    달리 이 `DELETE` 는 **advisory lock 과 무관하게** `55P03 lock timeout` 오류로 실패한다.
    이 자체가 데이터 손상은 아니지만(트랜잭션이 롤백되어 반쯤 삭제 상태는 안 남는다), 실패
    원인이 "삭제 경로가 무한 대기하지 않도록" 설계한 advisory lock 문서(§`trigger-config-lock.ts`
    JSDoc, `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc)가 서술하는 대상(advisory lock 대기)이
    아니라 **의도치 않게 걸려든 다른 테이블의 row-lock 대기**일 수 있어, 장애 시 원인 추적이
    엇나갈 수 있다. 실측(뮤테이션·e2e)은 이 라운드 어디에도 이 상호작용을 겨냥하지 않는다 —
    `triggers.service.spec.ts:3851-3872` 의 순서 단언은 락 mock 이 즉시 resolve 되는 상황만
    본다.
  - 제안: (1) advisory lock 획득 직후 `SET LOCAL lock_timeout = DEFAULT` (또는 이전 값)로
    되돌려 범위를 advisory lock 한 줄로 좁히거나, (2) 의도적으로 DELETE 전체를 같은 상한으로
    묶는 것이라면 그 사실과 CASCADE 연쇄 대상(`schedule`)을 JSDoc/plan 후속 표에 명시해
    "advisory lock 대기 상한"이 아니라 "삭제 트랜잭션 전체의 lock 대기 상한"으로 문서를
    정정한다. 지금 배치를 막을 사유는 아니다 — 발생 조건이 좁고(비참여 writer 가 5초 이상
    같은 행을 점유) 실패 시 데이터 손상 없이 트랜잭션이 롤백되기 때문이다.

- **[INFO]** 리팩터링으로 기존 JSDoc 블록이 다른 메서드 위로 밀려나 **엉뚱한 대상을 설명하는
  상태**가 됐다 (side-effect 도메인 밖이지만 이 PR 의 diff 가 직접 만든 결함이라 병기)
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:957-984`
  - 상세: `touchLastTriggeredAt` 신설 메서드(및 그 JSDoc)가 기존 `markChatChannelRateLimited`
    바로 위에 삽입됐는데, 그 자리에는 원래 `markChatChannelRateLimited` 를 설명하던
    "`* CCH-NF-03 — per-chat 분당 rate-limit 초과 시 ...`" JSDoc(957-961행)이 이미 있었다.
    삽입 위치가 그 JSDoc **뒤**라서, 지금은 그 JSDoc 이 `touchLastTriggeredAt` 바로 위에 오고
    `markChatChannelRateLimited`(986행)는 어떤 JSDoc 도 갖지 않는다. 런타임 동작 변화는
    없지만, 다음 사람이 `touchLastTriggeredAt` 을 "CCH-NF-03 규칙(rate-limit degraded 처리)"
    으로 오독하거나 `markChatChannelRateLimited` 의 의도(CCH-SE-01 / R-CC-19)를 놓칠 수 있다.
    이 저장소가 이미 반복 관찰한 "orphan JSDoc" 결함 클래스(`feedback_my_own_fix_is_the_next_defect.md`)
    와 같은 형태다.
  - 제안: 새 JSDoc+메서드를 `markChatChannelRateLimited` **뒤**로 옮기거나, 기존 CCH-NF-03
    JSDoc 을 `markChatChannelRateLimited` 선언 바로 위로 함께 이동한다.

## 관점별 확인 (이전 라운드 대비 변화 없음 확인)

- **의도치 않은 상태 변경 / 전역 변수**: `trigger-config-lock.ts` 가 내보내는 것은
  `TRIGGER_CONFIG_LOCK_PREFIX`·`TRIGGER_DELETE_LOCK_TIMEOUT_MS`(상수) 와 순수 함수/헬퍼뿐이다
  — 모듈 레벨 mutable 상태 없음. `touchLastTriggeredAt` 이 `trigger.lastTriggeredAt` 을
  in-memory 로 갱신하는 것은 JSDoc 이 명시한 의도된 동작이고, 두 호출부(`hooks.service.ts:227,
  686`) 모두 그 갱신 이후 `trigger.config` 를 읽지 않아 부수 영향이 없음을 확인했다.
- **파일시스템 부작용**: 코드 변경 자체는 없음. e2e 스펙(`trigger-config-lost-update.e2e-spec.ts`)
  이 `afterAll` 에서 자신이 만든 트리거 행만 `DELETE FROM trigger WHERE id = $1` 로 정리—
  테스트 격리 목적의 예상된 DB 부작용이며 스코프가 생성한 id 로 한정돼 있다.
  파일 생성/삭제는 없음.
- **시그니처/인터페이스 변경**: `touchLastTriggeredAt` 은 신규 `private` 메서드라 외부 호출자
  없음. `extractInboundSigningRef(config: unknown)` 은 신규 export 함수지만 기존 인라인 캐스트
  3곳을 대체하는 것이라 호출 계약 변경 없음(`chat-channel-input-rules.spec.ts` 7갈래 표로
  검증됨). `rewriteTriggerConfigLocked`/`acquireTriggerConfigLock` 은 이전 라운드에서 이미
  도입된 시그니처이며 이번 diff 에서 시그니처 변경 없음(호출부 배선만 `remove()` 로 확장).
  공개 API(컨트롤러/DTO/라우트)는 15개 파일 어디에도 없음.
- **환경 변수**: 신규/변경 없음. e2e 의 `process.env.E2E_BASE_URL` 은 기존 e2e 스펙들과 동일한
  기존 관용구(fallback 값 포함) 재사용.
- **네트워크 호출**: 신규 외부 호출 없음. 오히려 `rewriteTriggerConfigLocked` 의 설계 자체가
  "외부 호출을 advisory lock 트랜잭션 밖에 둔다"를 강제해, PATCH/rotate 경로의 외부 HTTP 요청
  (`adapter.setupChannel`, `secrets.rotate`)이 이미 완료된 뒤에만 락 구간에 진입하도록 배선돼
  있음을 `chat-channel-binder.service.ts:243-322`, `triggers.service.ts:1188-1237` 에서
  재확인했다.
- **이벤트/콜백**: `channelListenerRegistry.register`/`unregister` 호출 조건(쓰기 성공 시에만
  등록)은 이전 라운드에서 이미 고정됐고 이번 diff 에서 변경되지 않음
  (`chat-channel-binder.service.ts:286-291`). `withTransactionMock`/`trigger-config-lock.spec.ts`
  의 `onLock`/`onLockTimeout` 콜백은 프로덕션 코드가 아니라 테스트 관측 고리이며 프로덕션
  동작에 영향 없음.

## 요약

이 라운드는 5차례 리뷰가 반복 지적한 상태-변경/전역-자원 관련 결함(fail-open 재발, 삭제된
트리거의 부활, 유령 listener 등록, 무기한 삭제 대기)을 코드·테스트 양쪽에서 닫아 왔고, 이번
diff(웹훅 hot path 통합, `extractInboundSigningRef` 추출, 정적 가드 확장, 삭제 락 순서 배선)
자체는 그 마무리 작업이라 새로운 전역 상태·파일시스템·네트워크·환경변수 부작용을 만들지
않는다. 다만 두 가지를 새로 관측했다: (1) 삭제 경로에 새로 건 `SET LOCAL lock_timeout` 이
advisory lock 한 줄이 아니라 같은 트랜잭션의 `DELETE`(및 `schedule` CASCADE) 전체의 lock
대기에도 적용돼, 아직 이 락에 참여하지 않는 것으로 plan 문서가 명시한 다른 writer 와 우연히
겹치면 advisory lock 과 무관한 사유로 실패할 수 있는데 문서 범위가 이를 반영하지 않는다
(WARNING, 차단 사유는 아님) — (2) 리팩터링으로 기존 JSDoc 블록이 옆 메서드로 밀려나 지금은
`touchLastTriggeredAt` 을 설명하는 것처럼 보이는 orphan 상태다(INFO). 그 외 관점(전역 변수·
파일시스템·시그니처·인터페이스·환경변수·네트워크·이벤트/콜백)은 모두 이전 라운드의 처분이
그대로 유지되고 있음을 소스 대조로 재확인했다.

## 위험도

LOW
