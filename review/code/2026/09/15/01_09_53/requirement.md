# 요구사항(Requirement) 리뷰 — trigger-config-lost-update (라운드 01_09_53)

## 검토 범위 및 방법

`git diff origin/main...HEAD` 로 실제 변경분 전체를 확인했고, 핵심 파일(`trigger-config-lock.ts`,
`triggers.service.ts`, `chat-channel-binder.service.ts`, `chat-channel-input-rules.ts`,
`hooks.service.ts`, `schedules.service.ts` 및 그 테스트·e2e 스펙)을 전체 컨텍스트로 직접
`Read`/`grep` 했다. 이 PR 은 이미 14라운드(`review/code/2026/09/14/18_17_44` ~
`review/code/2026/09/15/00_38_16`)의 전수 리뷰를 거쳤고, 그 라운드들이 지적한 항목은 대부분
후속 커밋으로 닫혀 있음을 코드로 직접 확인했다(예: `mergeIntoFreshSubKey` 도입으로 하위 키
lost-update 닫음, `cleanupRotatedChatChannelTokens` 의 `cleaned++` 무조건 증가는 00_38_16 에서
이미 "별도 결함 아님"으로 수용·문서화됨, `buildFallbackChannel`/`buildMergedChannel` 중복은
`buildChannel` 단일 함수로 통합됨). 이번 라운드는 **가장 최근 커밋
(`2a87eb2f0` — 스케줄 cascade 삭제도 같은 config 락을 잡도록 확장)** 을 포함한 전체 diff를
대상으로, 아직 어느 라운드도 다루지 않은 지점을 중심으로 재검증했다.

## 발견사항

- **[WARNING]** CHANGELOG 안에서 삭제 경로의 "5초 상한" 적용 범위가 자기모순 — 코드는 이미 두 경로 모두에 적용했는데 문서가 한쪽만 반영
  - 위치: `CHANGELOG.md` — "**삭제(`DELETE /api/triggers/:id`)만 5초 상한을 둔다.**" 문단(같은 파일의 몇 줄 앞 "**삭제 경로 둘 다** 같은 락을 잡는다 — `DELETE /api/triggers/:id` 와 스케줄 삭제의 cascade." 문단 바로 다음)
  - 상세: 최신 커밋 `2a87eb2f0`("fix(schedules): 삭제 경로는 둘이었다 — 스케줄 cascade 도 같은 config 락을 잡는다")이 `CHANGELOG.md` 의 "삭제 경로 둘 다 같은 락을 잡는다" 문장은 갱신했지만(`git diff 2a87eb2f0~1 2a87eb2f0 -- CHANGELOG.md` 로 확인), 몇 줄 뒤의 "삭제(`DELETE /api/triggers/:id`)**만** 5초 상한을 둔다" 문장은 손대지 않았다. 그런데 실제 코드는 `codebase/backend/src/modules/schedules/schedules.service.ts` 의 `remove()` 에서도 `acquireTriggerConfigLock(m, triggerId, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })` 로 **같은 5초 상한**을 건다(`codebase/backend/src/modules/triggers/triggers.service.ts` 의 `remove()` 와 동일 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 공유). 즉 CHANGELOG 의 두 문단이 서로 다른 사실을 말한다 — 하나는 "삭제 경로 둘 다 락을 잡는다", 다른 하나는 "그중 하나만 상한을 갖는다". 코드는 정합적(두 경로 모두 락+상한)이므로 이건 코드 결함이 아니라, 커밋이 "락 도입" 문장만 넓히고 "상한 범위" 문장을 그대로 둔 **문서 갱신 누락**이다. 이 PR 은 스스로 "복제가 drift 를 부른다"·"목록은 낡고 규칙은 안 낡는다" 를 반복해 지적해 온 자리인데, 같은 클래스의 drift 가 CHANGELOG 자기 자신 안에서 재발했다.
  - 제안: "**삭제(`DELETE /api/triggers/:id`)만 5초 상한을 둔다**" 를 "**삭제 경로 둘 다(`DELETE /api/triggers/:id` 및 스케줄 삭제 cascade) 5초 상한을 둔다**" 로 정정해 앞 문단과 일치시킨다. `CHANGELOG.md` 는 `spec/` 밖 파일이라 `project-planner` 위임 대상은 아니고, `developer` 가 직접 고칠 수 있는 범위다.

- **[WARNING]** 스케줄 cascade 삭제의 5초 락 타임아웃 적용이 테스트로 관측되지 않는다 — 회귀 시 미검출
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — `삭제 — trigger 행을 config 락 안에서 지운다` 테스트(및 그 `beforeEach` 의 `withTransactionMock(...)` 호출)
  - 상세: `withTransactionMock` 은 `SET LOCAL lock_timeout` SQL 이 실행될 때마다 호출되는 `onLockTimeout` 훅을 제공한다(`codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`) — 이 훅의 JSDoc 자체가 "상한을 지우는 뮤턴트가 305건 전건 GREEN 으로 살아남았다"는 실측을 근거로 이 훅이 왜 필요한지 설명한다. `triggers.service.spec.ts` 는 실제로 `onLockTimeout: (statement) => events.push(...)` 로 `TriggersService.remove()` 의 5초 타임아웃을 관측·단언한다(`triggers.service.spec.ts:3755`). 그런데 `schedules.service.spec.ts` 의 `withTransactionMock` 호출은 `onLock` 만 등록하고 `onLockTimeout` 을 등록하지 않으며(`grep -n "onLockTimeout" codebase/backend/src/modules/schedules/schedules.service.spec.ts` 결과 0건), 해당 `it('삭제 — trigger 행을 config 락 안에서 지운다', …)` 도 락 **키**(`triggerLockKeys`)만 단언하고 타임아웃 SQL 의 존재는 단언하지 않는다. 즉 `schedules.service.ts` 의 `acquireTriggerConfigLock(m, triggerId, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })` 에서 `{ timeoutMs: ... }` 인자를 실수로 제거해도(=상한을 없애도) 이 테스트는 계속 GREEN 이다. 이 PR 이 직접 실측·문서화한 "상한을 지우는 뮤턴트가 살아남는다"는 위험이 정확히 이 새 자리(스케줄 cascade 경로)에 재발할 수 있는 상태로 남아 있다.
  - 제안: `schedules.service.spec.ts` 의 해당 `beforeEach`/테스트에도 `onLockTimeout` 을 등록해 `SET LOCAL lock_timeout` 문에 상한 값이 포함됨을 단언하는 캐너리를 추가한다(`triggers.service.spec.ts:3755` 부근의 패턴을 그대로 재사용 가능).

## 참고 (절차 투명성, 결함으로 집계하지 않음)

리뷰 중 `Read` 도구로 `schedules.service.ts` 를 읽었을 때 `remove()` 의
`acquireTriggerConfigLock(m, triggerId)` 호출에 `{ timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS }`
인자가 **없는** 상태가 한 번 관측됐다. 병렬 fan-out 리뷰 규약이 경고한 "다른 reviewer 가 같은
워킹트리를 동시에 mutate" 상황으로 보인다. 즉시 `sed`/`git show HEAD:...`/`git status --short`
로 재확인한 결과, 파일은 `HEAD`(`2a87eb2f0`)와 정확히 일치하는 상태(`{ timeoutMs: ... }` 포함)
였고 `git status --short` 도 이 파일에 대해 아무 변경도 보고하지 않았다 — 저장소에 잔여 이상
상태는 없다. 다음 라운드 리뷰어를 위해 기록만 남긴다.

## 기능 완전성 · 비즈니스 로직 검증 요약 (변경 없음 확인 항목)

아래는 이번 라운드에서 직접 재확인해 **문제 없음**을 확정한 항목이다(중복 지적 방지 목적으로 기록):

- `trigger-config-lock.ts` 의 `rewriteTriggerConfigLocked`: 락 획득 → 재읽기(`fresh`) → 삭제 시 `false` 반환(skip) → `merge(fresh.config ?? {})` 로 병합 → `columns` 는 delta 로 스프레드 순서 뒤에 `config` 배치. 계약(JSDoc)과 구현이 line-level 로 일치.
- `TriggersService.update()`(창 1): 트랜잭션 내 락 획득 → `workspaceId` 포함 재읽기(`relations: ['workflow']` 동봉, 응답 `workflow` 필드 보존) → `previousInboundSigningRef` 를 재읽은 행에서 재계산 → `assertTriggerFound(fresh)` 후 `Object.assign` → `m.save(Trigger, target)`. `config` 를 명시적으로 보낸 PATCH 는 재읽기를 우회하는 설계이며 이는 이전 라운드(`19_07_43`)가 이미 "REST 의미상 개선"으로 수용.
- `TriggersService.remove()` / `SchedulesService.remove()`: 두 삭제 경로 모두 같은 advisory lock(`triggerConfigLockKey`) + 5초 타임아웃을 잡음(코드 레벨에서는 대칭 확인됨 — 문서 갱신 누락은 위 WARNING 참조).
- `normalizeNotificationSecretRef`/`revokePerTriggerToken`/`rotateBotToken`/`promoteRotatedNotificationSecrets`: 전부 `mergeIntoFreshSubKey` 로 해당 하위 키(`notification`/`interaction`/`chatChannel`) 위에만 델타를 얹고, 삭제 경합 시 `wrote`/`wroteInteraction`/`wrotePromotion` 반환값을 실제로 검사해 동기 요청은 404, cron 은 카운트 미증가로 처리 — JSDoc 의 "부재를 드러내는 방식이 창마다 다르다" 표와 코드가 일치.
- `rotateNotificationSecret`/`cleanupRotatedChatChannelTokens`/`SchedulesService.update()`: `config` 를 건드리지 않는 컬럼 전용 경로라 `rewriteTriggerConfigLocked` 를 거치지 않고 `repository.update()` 단발 호출 — 설계 원칙("config 고치면 락 안 재작성, 컬럼만 고치면 컬럼 한정 update")과 일치.
- `hooks.service.ts` 의 `touchLastTriggeredAt`: 두 호출부(`handleWebhook` 성공 경로, chat-channel 인입 경로) 모두 `save` 대신 단일 헬퍼를 공유하도록 배선됐고, 두 자리 각각 "config 를 다시 쓰지 않는다"는 회귀 테스트가 존재 — 커밋 메시지가 지적한 "한쪽만 회귀 테스트를 가졌던" 결함이 실제로 해소됨을 두 `it` 블록에서 직접 확인.
- `extractInboundSigningRef`: null/undefined config, `chatChannel` 이 null, 키 부재, 빈 객체 등 7가지 케이스가 `it.each` 로 테스트되고 구현(optional chaining)과 일치. 이 함수 도입으로 기존 세 자리의 인라인 캐스트 중복은 정의부 1곳만 남고 모두 제거됨(`grep` 확인).
- `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture: `manager.transaction` 콜백 경계를 넘어 `.catch` 를 추적하도록 확장된 정적 가드가 `TRIGGER_ENTITY = 'Trigger'` 첫 인자 판별과 함께 새 fixture(`managerSaveWrapped`/`managerSaveUnwrapped`/`managerSaveOtherEntity`)로 양성·음성·비대상 세 갈래를 구분해 테스트됨. `EXPECTED_UNWRAPPED_TRIGGER_SAVES` 는 빈 배열로 수렴 — CHANGELOG 의 "빈 목록이 더 강한 상태" 서술과 일치.
- TODO/FIXME/HACK/XXX 마커: 변경된 6개 핵심 소스 파일 전수 grep 결과 0건.
- spec fidelity: 이 PR 이 건드리는 영역은 `spec/5-system/15-chat-channel.md`(R-CC-21, §5.4.1 표), `spec/2-navigation/2-trigger-list.md` 등에 필드 접근 규칙(PATCH 가 비밀을 받지 않는다 등)으로 정의돼 있으나, 이번 변경은 그 필드 접근 규칙 자체를 바꾸지 않고 "이미 정해진 규칙을 지키는 쓰기가 동시성 하에서도 유실되지 않도록" 하는 순수 동시성 버그 수정이다. 관련 spec 본문 어디에도 advisory lock·재읽기 방식 등 구현 세부를 규정하지 않으므로, spec 과의 line-level 불일치는 없음(spec 이 규정하지 않는 영역 — 회색지대/해당 없음).

## 요약

핵심 lost-update 방지 로직(`rewriteTriggerConfigLocked`, 창 1의 인라인 락, 삭제 경로 락, 하위 키 병합 헬퍼)은 14라운드에 걸친 반복 검증과 뮤테이션 실측을 통해 기능적으로 견고하며, 이번 라운드에서 직접 재확인한 결과 코드 레벨의 새로운 CRITICAL 은 발견되지 않았다. 다만 가장 최근 커밋이 스케줄 cascade 삭제 경로에 같은 락+5초 타임아웃을 확장하면서 (1) `CHANGELOG.md` 안에 "삭제 경로 둘 다 락을 잡는다"와 "삭제는 `DELETE /api/triggers/:id` 만 5초 상한을 둔다"가 서로 모순되는 문장으로 남았고, (2) 그 확장된 타임아웃 적용이 테스트로 관측되지 않아 향후 회귀를 잡지 못하는 gap이 있다. 둘 다 이번 PR의 핵심 보안 수정(인입 서명 fail-open 방지)의 정확성 자체를 훼손하지는 않지만, 이 PR이 스스로 여러 차례 반복 지적해 온 "서술이 실측/코드보다 좁거나 넓어지는" 같은 클래스의 결함이 CHANGELOG와 테스트 커버리지에 재발한 것이라 WARNING으로 기록한다.

## 위험도

LOW
