# 유지보수성(Maintainability) 리뷰

## 검토 범위 및 방법

이번 라운드(`20_17_16`)의 실질 신규분은 커밋 `369852b4f`(직전 라운드 `19_44_08`가 리뷰한
`c7a9c107e` 대비 델타)다. `git diff c7a9c107e..HEAD`로 그 델타만 별도로 추출해 확인했고,
`origin/main...HEAD` 전체 diff와 저장소의 현재 파일(`Read`)을 함께 대조했다. `review/code/**`·
`review/consistency/**` 하위 파일은 이전 라운드들의 산출물(생성된 보고서)이라 "유지보수할
코드"가 아니므로 관점 적용 대상에서 제외하되, 그 안의 이전 maintainability 발견사항이 이번
델타에서 실제로 해소/추적됐는지는 코드로 재확인했다. 저장소에 뮤테이션은 가하지 않았다
(`git status --short` 로 확인, 클린).

## 발견사항

- **[WARNING]** `hooks.service.ts` 두 호출부에 동일한 5줄 주석 + 4줄 코드 블록이 문자 그대로 복제되어 있다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:227-236` (`handleWebhook`), `:695-704` (`handleChatChannelWebhook`)
  - 상세: 두 자리 모두 `trigger.lastTriggeredAt = new Date();` 뒤에 `this.triggerRepository.update({ id: trigger.id }, { lastTriggeredAt: trigger.lastTriggeredAt })`를 부르고, 그 위에 붙은 5줄 JSDoc 스타일 주석(*"컬럼만 갱신한다 — save(trigger)를 쓰지 않는다..."*)도 한 글자도 다르지 않게 복제돼 있다(직접 `Read`로 대조 확인, `diff`가 아니라 실제 파일 내용 동일). 이번 PR 자체가 "두 자리 중 한쪽만 고쳐 회귀 테스트가 없던 자리가 그대로 fail-open으로 남았다"(`369852b4f`, plan §"측정 범위가 문장보다 좁았다")는 교훈을 이미 한 번 겪었는데, 지금 이 두 자리는 다시 손으로 복제돼 있어 다음에 세 번째 컬럼(예: `chatChannelHealth` 갱신 등)을 추가해야 할 일이 생기면 한쪽만 고치고 다른 쪽을 놓치는 drift가 재현되기 쉬운 모양이다. `HooksService`는 이미 `markChatChannelRateLimited`·`sendBestEffortNotice`·`getActiveExecutionStatus` 등 여러 private 헬퍼로 반복 패턴을 뽑아내는 관례를 갖고 있어, 이 추출이 이 클래스의 기존 스타일과도 맞는다.
  - 제안: `private async touchLastTriggeredAt(trigger: Trigger): Promise<Date>` 같은 private 헬퍼로 두 자리를 통합하고, 그 정당화 주석은 헬퍼 하나에만 남긴다. `chat-channel-binder.service.ts`가 같은 라운드에서 `buildFallbackChannel`/`buildMergedChannel` 중복을 `buildChannel` 하나로 통합한 것과 같은 처방이다.

- **[WARNING]** `CHANGELOG.md`의 새 단락에 이전 단락 소속 문장이 줄바꿈 없이 이어 붙어, advisory-lock 설계 근거가 웹훅 컬럼 갱신 수정의 근거인 것처럼 오귀속된다
  - 위치: `CHANGELOG.md:19` (`되돌릴 수 있었다(PATCH 끼리의 경합보다 훨씬 잦다). 컬럼 한정 갱신으로 바꿨다. 외부 provider 호출은 락 **밖**에 남는다 — Cafe24 토큰 갱신에서`)
  - 상세: `git diff c7a9c107e..HEAD -- CHANGELOG.md`로 직접 대조했다. 원래 "외부 provider 호출은 락 밖에 남는다 — Cafe24 토큰 갱신에서 같은 락을 기각했던 사유(...)가 그대로 이 설계의 제약이다"라는 문장은 advisory-lock 재읽기 단락(현재 11-15번째 줄, `config 를 다시 쓰는 네 자리 전부를 ... 안으로 넣고`)에 속해 있었다. 이번 편집이 그 단락 끝에 "행이 그 사이 삭제됐으면 쓰지 않는다..." 문장을 추가하면서 원래 있던 "외부 provider 호출은 락 밖에..." 문장을 그 자리에서 떼어내, **완전히 다른 새 단락**("웹훅 인입 경로도 함께 고쳤다" — `lastTriggeredAt` 컬럼 한정 update, 락과 무관한 수정)의 마지막 문장 뒤에 문단 구분(빈 줄) 없이 그대로 붙여 넣었다. 그 결과 "컬럼 한정 갱신으로 바꿨다."로 끝난 웹훅 수정 설명 바로 뒤에 "외부 provider 호출은 락 밖에 남는다 — ... 그대로 이 설계의 제약이다"가 이어져, 독자는 이 Cafe24-기각 근거가 **웹훅 컬럼 갱신(락을 전혀 쓰지 않는 수정)에도 적용된다**고 오해하기 쉽다. 실제로는 이 근거는 advisory lock을 쓰는 앞 단락(창 2·3·4·창1)에만 해당한다.
  - 제안: 두 문장을 원래 단락(advisory-lock 재읽기 단락, 11-15번째 줄 근처)으로 되돌리거나, 최소한 "컬럼 한정 갱신으로 바꿨다."와 "외부 provider 호출은 락 밖에 남는다" 사이에 문단 구분(빈 줄)을 넣어 두 서로 다른 수정(웹훅 컬럼 갱신 vs advisory-lock 설계)의 근거가 섞이지 않게 한다.

- **[INFO]** `TriggersService.update()`가 이번 델타로 한 단계 더 길어졌고, 그 안의 `previousInboundSigningRef` 클로저 경계 이동 문제는 여전히 미해결로 plan 후속 표에만 남아 있다 (기존 지적의 재확인, 새 이슈 아님)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:467-651` (`update()`, 약 185줄), 특히 `:513`(선언) → `:562-563`(트랜잭션 콜백 내 재할당) → `:634`(커밋 후 `preservedInboundSigningRef` 인자로 소비)
  - 상세: 직전 라운드(`19_44_08`)가 이미 WARNING으로 지적했고(`review/code/2026/09/14/19_44_08/maintainability.md` WARNING#1), `plan/in-progress/trigger-config-lost-update.md`의 "후속(developer 범위)" 표에도 "`previousInboundSigningRef`가 선언→트랜잭션 내 재대입→커밋 후 소비로 클로저 경계를 셋 넘는다"로 등재돼 추적 중이다. 이번 델타(`369852b4f`)는 그 문제를 고치지 않고 같은 함수에 "행이 사라졌으면 저장하지 않는다"는 `if (!fresh) throw` 분기(15줄 주석 포함)를 추가로 얹어, 함수 길이·인지 부하가 한 단계 더 늘었다. 같은 표에 "`update()` 가 ~160줄 — 창 1 을 `saveWithConfigLock(...)` 으로 분리 | 다음 편집 때"도 이미 등재돼 있어 이 성장 추세 자체는 인지되고 있다.
  - 제안: 이미 트래킹되고 있으므로 이번 배치를 막을 사유는 아니다. 다음에 이 함수를 또 확장할 일이 생기면 plan에 이미 적힌 대로 트랜잭션 콜백을 `saveWithConfigLock(...)` 류의 private 메서드로 분리하는 것을 우선 검토할 것.

- **[INFO]** `'RESOURCE_NOT_FOUND'` / `'Trigger not found'` 에러 봉투 리터럴이 두 자리에 복제됐다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:353-356` (`findById`), `:593-596` (신규, `update()` 트랜잭션 콜백 내부 `if (!fresh)`)
  - 상세: 이번 델타가 추가한 `if (!fresh) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Trigger not found' })`가 `findById()`의 동일한 에러 객체를 문자 그대로 반복한다. 규모가 작아(2곳, 2줄) 당장 문제는 아니지만, 이 클래스에 "트리거를 못 찾았다"는 세 번째 자리가 또 생기면 메시지가 슬쩍 달라질 위험이 있다.
  - 제안: 급하지 않음. 필요하면 `private assertTriggerFound<T>(row: T | null): T` 같은 작은 헬퍼로 통합할 수 있다.

## 이전 라운드 대비 확인한 해소/진행 사항 (참고, 재지적 아님)

- `trigger-config-lock.ts`에 `acquireTriggerConfigLock`이 추출되어(`:39-46`), `triggers.service.ts:550`의 인라인 트랜잭션과 `rewriteTriggerConfigLocked`가 같은 락 획득 코드를 공유한다 — `19_07_43` architecture WARNING#4가 실제로 해소됐음을 재확인했다.
- `chat-channel-input-rules.ts`의 `extractInboundSigningRef`가 `triggers.service.ts:50,513,563`와 `chat-channel-binder.service.ts:14,211`에서 공유되어, 세 자리에 복제됐던 인라인 캐스트(`18_17_44` WARNING#7)가 이번에도 그대로 유지되고 있다(재발 없음).
- `trigger-transaction-mock.ts`의 JSDoc이 "6개 전부를 이관한 것은 아니다 — 실제로는 2개뿐"이라고 스스로 범위를 명시하도록 이번 델타로 갱신됐다(`:26-31`) — `19_44_08` INFO가 지적한 "JSDoc 서술과 실제 적용 범위 사이 괴리"가 문서 쪽에서 해소됐다(코드 이관 자체는 여전히 부분적이나, 그 사실이 이제 정직하게 기록돼 있다).
- `plan/in-progress/trigger-config-lost-update.md`가 이전에 자신이 쓴 "뮤턴트 두 방향 모두 RED 확인했다"는 문장을 취소선으로 남기고 실측(자리별 오프셋 표)으로 정정한 것은, CLAUDE.md가 요구하는 "예고 문장의 자기-반증형 소정정" 절차를 정확히 따른 좋은 사례다.

## 긍정적으로 확인한 점

- `trigger-config-lock.ts`의 네이밍(`triggerConfigLockKey`, `acquireTriggerConfigLock`, `rewriteTriggerConfigLocked`)은 각 함수의 책임을 정확히 드러내고, 락·재읽기·머지·쓰기라는 단일 관심사에 집중된 작은 유틸리티로 잘 분리돼 있다.
- 매직 넘버 없음 — 새/기존 상수 모두 의미가 드러나는 이름과 근거 주석을 갖췄다.
- `hooks.service.spec.ts`에 새로 추가된 대칭 테스트(파일 2, 796-836번째 게이트 부근)는 "부재 단언 + 형태 단언"을 함께 걸어 이전 라운드가 지적한 실측 결함(대칭 자리 회귀 테스트 부재)을 정확히 메운다.

## 요약

이번 델타(`369852b4f`)의 핵심 코드 변경(`triggers.service.ts`의 삭제-레이스 방어, `hooks.service.spec.ts`의 대칭 테스트)은 이전 라운드가 실측으로 잡은 CRITICAL을 정확히 닫는 데 집중돼 있고, 그 과정에서 이전 라운드들이 지적한 중복(클로저 쌍·인라인 타입 캐스트·락 SQL 중복)은 재발하지 않았다. 다만 이번 라운드에서 새로 확인한 것은 두 가지다 — (1) `hooks.service.ts`의 `lastTriggeredAt` 컬럼 갱신 블록이 주석까지 포함해 두 호출부에 문자 그대로 복제돼 있어 이 PR이 이미 한 번 겪은 "한쪽만 고치는 drift" 위험을 그대로 남겨 두고 있고, (2) `CHANGELOG.md`의 편집 과정에서 advisory-lock 설계 근거 문장이 문단 경계 없이 무관한(락을 쓰지 않는) 웹훅 수정 단락 뒤에 붙어 근거가 잘못 귀속되는 문서 오류가 생겼다. 나머지(`update()` 길이 증가, `previousInboundSigningRef` 클로저 경계, 에러 리터럴 소규모 중복)는 이미 plan에 추적되고 있거나 규모가 작아 이번 배치를 막을 사유가 아니다.

## 위험도

LOW
