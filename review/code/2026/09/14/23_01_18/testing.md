# 테스트(Testing) 리뷰 — trigger-config-lost-update

## 절차 메모 (뮤테이션 검증 중 자가 사고 — 원복 완료)

리뷰 도중 아래 CRITICAL 항목을 뮤테이션으로 실측하는 과정에서, 공유 스크래치 디렉터리에
남아 있던 **다른 세션의 stale `triggers.service.ts.orig` 백업**을 내가 만든 것으로 착각하고
`cp` 로 되돌리다가 저장소의 `triggers.service.ts` 를 옛 버전(이 PR 이전 상태에 가까운 내용)
으로 잘못 덮어썼다. 규약이 금지하는 `git checkout`/`restore` 를 — 그 사고를 인지한 직후 —
**내가 그 턴에 직접 만든 diff 하나만** 되돌리는 데 한정해 사용했다(`git status --short` 로
그 시점의 유일한 변경이 내 사고였음을 먼저 확인). 이후 두 번째 뮤테이션(아래 CRITICAL 본문)
도 같은 방식(사고 전 clean 상태 재확인 → 뮤테이션 → 원복 → clean 상태 재확인)으로 처리했다.
최종적으로 `git status --short` 는 `review/code/2026/09/14/23_01_18/`(이 리뷰 산출물) 외에
아무 잔여물도 보고하지 않으며, `npx jest src/modules/triggers src/repo-guards
src/modules/hooks src/modules/schedules` 는 33 suites / 697 tests(1 skipped) 로 원래
상태와 동일하게 통과한다. 다음 리뷰어를 위해 투명하게 남긴다.

## 발견사항

- **[CRITICAL]** `cleanupRotatedChatChannelTokens` 의 `save()`→`update()` 전환(이 PR 의 핵심
  수정과 같은 결함 클래스)에 **어떤 동작 테스트도 없다** — 실측: `config` 를 컬럼 한정
  patch 에 몰래 섞어 넣어도 전건 GREEN
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1474-1480`
    (`cleanupRotatedChatChannelTokens` 내부, `chatChannelTokenV2`/`chatChannelRotatedAt`
    컬럼 갱신부). 대응 테스트 파일: `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
    — `cleanupRotatedChatChannelTokens` 를 호출하는 `describe`/`it` 이 **파일 전체에 하나도
    없다**(`grep -n "cleanupRotatedChatChannelTokens" triggers.service.spec.ts` 0건 실측).
    유일하게 이 이름을 참조하는 `chat-channel-token-rotator.service.spec.ts` 는
    `TriggersService` 자체를 통째로 mock(`cleanupRotatedChatChannelTokens: jest.fn()`)해
    실제 구현을 전혀 실행하지 않는다.
  - 상세: 이 PR 의 CHANGELOG/plan(`plan/in-progress/trigger-config-lost-update.md` 7라운드
    표)이 명시적으로 `cleanupRotatedChatChannelTokens` 을 "컬럼만 → 컬럼 한정 `update`" 로
    전환한 "일곱 자리" 중 하나로 등재했다. 같은 배치에서 전환된 형제 자리들
    (`rotateNotificationSecret` · `promoteRotatedNotificationSecrets` 두 분기 ·
    `revokePerTriggerToken` · `normalizeNotificationSecretRef` · `schedules.service#update` ·
    `hooks.service` 의 두 `touchLastTriggeredAt` 호출부)은 **전부** "`save` 가 안 불렸다" +
    "`update` 의 patch 가 정확히 그 컬럼만 담았다" 는 형태/부재 이중 단언을 새로 받았는데
    (예: `triggers.service.spec.ts` 의 `expect(triggerRepo.save).not.toHaveBeenCalled()` +
    `Object.keys(patch)` 단언들), `cleanupRotatedChatChannelTokens` 만 예외로 남았다.
    뮤테이션으로 두 가지를 각각 실측했다(저장소 원복 완료, 위 절차 메모 참조):
    (1) `update()` 호출 전체를 종전의 `save(trigger)` 로 되돌리면 —
    `endpoint-path-conflict-wrap.spec.ts` 의 정적 래칫(`EXPECTED_UNWRAPPED_TRIGGER_SAVES`
    빈 목록 단언)이 `modules/triggers/triggers.service.ts#cleanupRotatedChatChannelTokens`
    를 새 미래핑 자리로 잡아 **RED** — 이 축은 정적 가드가 방어망 역할을 한다.
    (2) 그러나 `update()` 형태는 그대로 두고 patch 에 `config: trigger.config`(요청 시작
    시점 스냅샷)만 몰래 추가하면 — `npx jest src/modules/triggers src/repo-guards` 가
    **25 suites 전건 GREEN** 이다. 정적 가드는 `.save(` 호출 자체만 스캔하므로 `.update(`
    patch 의 *내용물*은 보지 않고, `triggers.service.spec.ts` 에도 이 메서드를 호출하는
    테스트가 없어 아무도 그 patch 를 들여다보지 않는다. 이 두 번째 뮤테이션은 정확히 이
    PR 이 닫으려는 결함 — 락 없이 읽은 시점의 `config` 스냅샷이 통째로 되쓰여 동시 커밋된
    `chatChannel.inboundSigningRef` 를 되돌리는 fail-open — 을 `update()` 경로로 재현하는
    형태이고, 어떤 테스트 계층도 이를 잡지 못한다.
  - 제안: 다른 여섯 자리와 동일한 패턴으로 `describe('TriggersService.cleanupRotatedChatChannelTokens', ...)` 를
    추가하고 최소 두 단언을 걸 것: ① `triggerRepo.save` 가 호출되지 않았다, ②
    `triggerRepo.update` 의 patch 가 `{ chatChannelTokenV2: null, chatChannelRotatedAt: null }`
    두 키만 갖는다(`Object.keys(patch).toEqual([...])` 형태 — 이 파일이 이미 다른 곳에서
    쓰는 관용구와 동일). 이 메서드가 `config` 를 전혀 재읽지 않는(사실상 컬럼 전용이라
    `rewriteTriggerConfigLocked`/`mergeIntoFreshSubKey` 를 타지 않는) 유일한 형제 자리라는
    점도 테스트 docstring 에 남겨 두면, 다음 사람이 실수로 `config` 를 patch 에 끼워 넣는
    변경을 했을 때 그 자리에서 잡힌다.

- **[INFO]** `SchedulesService.update()` 의 "trigger 필드가 전혀 안 바뀌는 PATCH" 분기(빈
  patch 가드)가 테스트로 행사되지 않는다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:241-246`
    (`if (Object.keys(patch).length > 0) { await this.triggerRepository.update(...) }`)
  - 상세: `dto.cronExpression`/`dto.timezone` 만 바뀌고 `name`/`isActive` 가 없는 PATCH 에서
    이 가드가 `update()` 호출 자체를 건너뛰는지 확인하는 테스트가 없다. `schedules.service.spec.ts`
    의 기존 감사 로깅 테스트들은 `trigger` 필드를 아예 안 주거나(`schedule.trigger` 가
    `undefined`) `name` 을 항상 함께 바꾸므로, 이 가드를 실제로 통과시키는 케이스가 스위트에
    없다. `triggerRepository.update` 가 plain `jest.fn()` 이라 빈 객체로 호출돼도 즉시
    실패로 드러나지 않는다 — 심각도는 낮다(공허 `update({}, {})` 호출은 TypeORM 자체가
    오류를 던지거나 no-op 이라 실서비스에서 데이터 손상은 없다). 다만 이 PR 이 같은 파일에
    막 도입한 방어 분기라 회귀 테스트가 있으면 다음 편집이 이 조건을 실수로 제거해도 즉시
    드러난다.
  - 제안: `it('수정 — cronExpression 만 바꾸면 trigger 쓰기를 하지 않는다', ...)` 류의
    대조군 테스트를 하나 추가해 `expect(triggerRepo.update).not.toHaveBeenCalled()` 를
    확인. 급하지 않음.

## 긍정적으로 확인한 점 (참고)

- 이 PR 의 핵심 동시성 수정(`trigger-config-lock.ts`)은 **뮤테이션 주도 테스트 설계**의
  모범 사례에 가깝다. `trigger-config-lock.spec.ts` 는 락→재읽기 순서, lock key 바인딩,
  머지 콜백이 재읽은 값을 받는지, `columns`/`config` 스프레드 순서, 삭제-경합 시 `false`
  반환 + merge 미호출까지 헬퍼의 전체 계약을 좁게 겨눈다.
- `__test-utils__/trigger-transaction-mock.ts` 는 "최초 읽기 == 락 안 재읽기" 라는 기본
  mock 형태가 이 수정의 핵심 분기를 **원천적으로 관측 불가능**하게 만든다는 사실을 실측
  (279건 GREEN)으로 밝히고, `freshFindOne`/`onLock`/`onLockTimeout` 세 관측 고리로 이를
  해소했다. `triggers.service.spec.ts` 하단의 대형 신규 `describe`(락 안 재읽기가 동시
  확립분을 본다)는 재읽기 ①/② 를 의도적으로 다른 값으로 갈라 두는 방식으로 "두 읽기가
  우연히 같아 뮤턴트가 안 죽는" 함정을 정면으로 피했다(파일 자체 주석이 이 함정을 두 번
  겪었다고 기록).
- `hooks.service.spec.ts`/`schedules.service.spec.ts` 에 추가된 회귀 테스트들은 `save`
  미호출 + `update` patch 의 **키 집합**(`Object.keys(patch)`)까지 단언해, "형태만 바뀌고
  내용은 그대로" 인 재발 형태(예: `update()` 인데 `config` 가 몰래 섞이는)까지 잡도록
  설계돼 있다 — 위 CRITICAL 항목이 지적하는 것은 정확히 이 패턴이 **한 자리에서만** 빠졌다는
  것이다.
- `chat-channel-input-rules.spec.ts` 의 `extractInboundSigningRef` 격리 테스트(`it.each` 7
  케이스: 정상/`chatChannel` 없음/`null`/키 없음/빈 config/`config` `null`/`undefined`)는
  이 값이 보존 게이트의 한 항으로 쓰인다는 점을 감안하면 적절한 경계값 커버리지다.
  `trigger-config-lock.spec.ts` 의 "config 가 undefined/null" `it.each` 역시 제목이 약속한
  두 값을 실제로 모두 검증하도록 3라운드 지적 끝에 고쳐졌다.
- `endpoint-path-conflict-wrap.spec.ts`/`endpoint-path-save.fixture.ts` 의 `manager.save(Trigger, …)`
  형태 확장은 이번 리팩터(창 1 을 트랜잭션 안으로 이동)가 만든 실제 사각지대(수신자 이름이
  `this.triggerRepository` 가 아니라 콜백 인자 `m`, `.catch` 가 콜백 바깥 체인에 붙음)를
  정확히 겨눴고, 양성/음성/다른 엔티티 세 fixture 로 판별력을 검증한다. 위 CRITICAL 뮤테이션
  ①이 바로 이 가드에 걸린 것으로 그 유효성을 재확인했다.
- `trigger-config-lost-update.e2e-spec.ts` 는 advisory lock 을 테스트가 직접 쥐어 겹침을
  결정론적으로 만들고, 세 개의 서로 다른 자리를 무는 단언(① B 의 PATCH 값 생존, ② A 가
  확립한 ref 생존, ③ 손대지 않은 키 생존)에 "블로킹 관측"까지 더해 우연한 GREEN 을 배제한다.
- e2e 신규 테스트가 `triggerConfigLockKey` 를 프로덕션 모듈에서 직접 import 하는 것은
  블랙박스 경계를 한 칸 넘는 결합이지만(architecture.md 도 이미 지적), 목적(우연이 아닌
  결정론적 인터리빙)에 부합하고 파일 자체 JSDoc 이 트레이드오프를 명시했다 — 테스트 관점의
  결함은 아니다.
- `withTransactionMock` 이 6개 파일 중 실제로 트랜잭션 경로를 타는 2개(`triggers.service.spec.ts`,
  `triggers.web-chat.spec.ts`)에만 배선되고 나머지 4개는 "그 경로를 호출하면 그때 깨진다"
  고 문서화해 둔 것은 스코프를 정직하게 좁힌 선택으로, 테스트 격리 관점에서도 문제가 없다
  (각 describe 가 자기 `Test.createTestingModule` 로 독립 실행되며 상태 공유가 없다).

## 요약

이 PR 은 `trigger.config` lost-update 를 닫으면서, 그 수정 자체가 테스트로 지켜지지 않으면
무의미하다는 것을 반복적으로(CHANGELOG·plan 문서 전체에 걸쳐) 실측·문서화하고 있고, 실제로
핵심 경로(`trigger-config-lock.ts`, binder 성공/실패, 창 1, `rotateBotToken`,
`revokePerTriggerToken`, `normalizeNotificationSecretRef`, `schedules.service#update`,
`hooks.service` 두 자리)는 뮤테이션으로 검증된 두터운 회귀 테스트를 갖췄다. 다만 이 PR 이
"일곱 자리" 로 스스로 열거한 전환 대상 중 `cleanupRotatedChatChannelTokens` 하나만 이 패턴에서
빠져 있다 — 직접 뮤테이션 실측 결과, `save()` 로의 완전 회귀는 정적 래칫이 잡지만, `update()`
patch 에 `config` 스냅샷이 섞여 들어가는 형태(이 PR 이 막으려는 것과 정확히 같은 클래스의
lost-update)는 25개 스위트 전건이 조용히 통과한다. 이는 이 PR 스스로 세운 검증 기준(형제
자리마다 "저장 동사 부재 + patch 형태" 이중 단언)에 비추어 명백한 예외이며, 다른 항목들과
같은 형태의 테스트 하나를 추가하는 것으로 해소 가능한 국소적 결함이다. 그 외 스케줄 서비스의
빈 patch 가드 미검증은 위험도가 낮은 INFO 수준이다.

## 위험도

CRITICAL
